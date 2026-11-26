import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startHarness, type TestHarness } from "../support/app-harness.js";
import { queryAsOwner } from "../support/test-database.js";

describe("PostgreSQL job queue", () => {
    let harness: TestHarness;

    beforeAll(async () => {
        harness = await startHarness();
    });

    afterAll(async () => {
        await harness.closeHarness();
    });

    it("claims a job once, leases it, and marks it complete", async () => {
        const dedupeKey = "worker-test-complete";
        await harness.runtime.database.transaction({}, async (session) => {
            await harness.runtime.jobs.enqueue(session, {
                kind: "test.complete",
                payload: { value: 1 },
                dedupeKey,
            });
        });

        const claimed = await harness.runtime.jobs.claim("worker-one", 10);
        const job = claimed.find((entry) => entry.kind === "test.complete");
        expect(job).toBeDefined();
        expect(job?.attempts).toBe(1);

        const competing = await harness.runtime.jobs.claim("worker-two", 10);
        expect(competing.some((entry) => entry.id === job?.id)).toBe(false);

        if (job === undefined) {
            throw new Error("The job was not claimed.");
        }
        await harness.runtime.jobs.complete(job.id);
        const rows = await queryAsOwner<{ status: string; attempts: number }>(
            "select status, attempts from jobs where id = $1",
            [job.id],
        );
        expect(rows[0]).toEqual({ status: "completed", attempts: 1 });
    });

    it("returns a failed job to the queue with a retry time", async () => {
        await harness.runtime.database.transaction({}, async (session) => {
            await harness.runtime.jobs.enqueue(session, {
                kind: "test.retry",
                payload: {},
            });
        });
        const first = await harness.runtime.jobs.claim("worker-one", 10);
        const job = first.find((entry) => entry.kind === "test.retry");
        if (job === undefined) {
            throw new Error("The retry job was not claimed.");
        }
        const retryAt = new Date(Date.now() + 60_000);
        await harness.runtime.jobs.fail(job.id, "transient failure", { dead: false, retryAt });

        const immediate = await harness.runtime.jobs.claim("worker-two", 10);
        expect(immediate.some((entry) => entry.id === job.id)).toBe(false);

        const rows = await queryAsOwner<{ status: string; last_error: string | null }>(
            "select status, last_error from jobs where id = $1",
            [job.id],
        );
        expect(rows[0]?.status).toBe("pending");
        expect(rows[0]?.last_error).toBe("transient failure");
    });

    it("dead-letters a job after its final failure", async () => {
        await harness.runtime.database.transaction({}, async (session) => {
            await harness.runtime.jobs.enqueue(session, {
                kind: "test.dead",
                payload: {},
                maxAttempts: 1,
            });
        });
        const claimed = await harness.runtime.jobs.claim("worker-one", 10);
        const job = claimed.find((entry) => entry.kind === "test.dead");
        if (job === undefined) {
            throw new Error("The dead-letter job was not claimed.");
        }
        await harness.runtime.jobs.fail(job.id, "permanent failure", { dead: true });
        const rows = await queryAsOwner<{ status: string; last_error: string | null }>(
            "select status, last_error from jobs where id = $1",
            [job.id],
        );
        expect(rows[0]).toEqual({ status: "dead", last_error: "permanent failure" });
    });

    it("claims, retries, and dead-letters outbox events", async () => {
        await harness.runtime.database.transaction({}, async (session) => {
            await harness.runtime.events.publish(session, {
                type: "test.outbox",
                organizationId: null,
                aggregateType: "worker_test",
                aggregateId: "worker-test-outbox",
                payload: { value: 1 },
            });
        });

        const claimed = await harness.runtime.events.claimBatch(10);
        const event = claimed.find((entry) => entry.eventType === "test.outbox");
        if (event === undefined) {
            throw new Error("The outbox event was not claimed.");
        }
        expect(event.attempts).toBe(1);
        await harness.runtime.events.markProcessed(event.id);
        const processed = await queryAsOwner<{ processed_at: Date | null }>(
            "select processed_at from outbox_events where id = $1",
            [event.id],
        );
        expect(processed[0]?.processed_at).not.toBeNull();

        await harness.runtime.database.transaction({}, async (session) => {
            await harness.runtime.events.publish(session, {
                type: "test.outbox.retry",
                organizationId: null,
                aggregateType: "worker_test",
                aggregateId: "worker-test-outbox-retry",
                payload: {},
            });
        });
        const retryClaim = await harness.runtime.events.claimBatch(10);
        const retryEvent = retryClaim.find((entry) => entry.eventType === "test.outbox.retry");
        if (retryEvent === undefined) {
            throw new Error("The retry outbox event was not claimed.");
        }
        expect(await harness.runtime.events.markFailed(retryEvent.id, "temporary", 1)).toBe(false);
        const retrying = await queryAsOwner<{ last_error: string | null; available_at: Date }>(
            "select last_error, available_at from outbox_events where id = $1",
            [retryEvent.id],
        );
        expect(retrying[0]?.last_error).toBe("temporary");
        expect(new Date(retrying[0]?.available_at ?? 0).getTime()).toBeGreaterThan(Date.now());

        const deadRows = await queryAsOwner<{ id: string }>(
            "select id from outbox_events where event_type = 'test.outbox.retry'",
        );
        const deadId = deadRows[0]?.id;
        if (deadId === undefined) {
            throw new Error("The retry event disappeared.");
        }
        expect(await harness.runtime.events.markFailed(deadId, "permanent", 10)).toBe(true);
        const dead = await queryAsOwner<{ processed_at: Date | null; last_error: string | null }>(
            "select processed_at, last_error from outbox_events where id = $1",
            [deadId],
        );
        expect(dead[0]?.processed_at).not.toBeNull();
        expect(dead[0]?.last_error).toContain("dead-lettered");
    });
});
