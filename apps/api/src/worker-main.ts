import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { loadLocalEnvironment } from "./bootstrap.js";
import { loadConfiguration } from "./core/configuration.js";
import { NethackRuntime } from "./core/runtime.js";

loadLocalEnvironment();

const config = loadConfiguration();
const runtime = new NethackRuntime({ config });
await runtime.initialize();

const workerId = `${hostname()}-${process.pid}-${randomUUID().slice(0, 8)}`;
let running = true;
let lastMaintenance = 0;
let lastRefreshSweep = 0;

function sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
        const timer = setTimeout(resolve, milliseconds);
        timer.unref();
    });
}

async function drainOutbox(): Promise<number> {
    const events = await runtime.events.claimBatch(50);
    for (const event of events) {
        const handlers = runtime.registry
            .getEventSubscriptions()
            .filter((subscription) => subscription.eventType === event.eventType);
        try {
            if (handlers.length > 0) {
                await runtime.database.transaction(
                    { organizationId: event.organizationId },
                    async (session) => {
                        for (const handler of handlers) {
                            await handler.handle(event.payload, session);
                        }
                    },
                );
            }
            await runtime.events.markProcessed(event.id);
        } catch (error) {
            const message = error instanceof Error ? error.message : "unknown";
            const dead = await runtime.events.markFailed(event.id, message, event.attempts);
            runtime.logger.error("Outbox event handling failed.", {
                eventId: event.id,
                eventType: event.eventType,
                attempts: event.attempts,
                dead,
                error: message,
            });
        }
    }
    return events.length;
}

async function drainJobs(): Promise<number> {
    const jobs = await runtime.jobs.claim(workerId, 10);
    for (const job of jobs) {
        const handler = runtime.registry.getJobHandler(job.kind);
        if (handler === undefined) {
            await runtime.jobs.fail(job.id, `No handler registered for job kind "${job.kind}".`, {
                dead: true,
            });
            runtime.logger.error("Job has no handler.", { jobId: job.id, kind: job.kind });
            continue;
        }
        try {
            await runtime.database.transaction(
                { organizationId: job.organizationId },
                async (session) => {
                    await handler(job.payload, session);
                },
            );
            await runtime.jobs.complete(job.id);
        } catch (error) {
            const message = error instanceof Error ? error.message : "unknown";
            const dead = job.attempts >= job.maxAttempts;
            const retryAt = new Date(Date.now() + Math.min(3600, 2 ** job.attempts * 10) * 1000);
            await runtime.jobs.fail(job.id, message, { dead, retryAt });
            runtime.logger.error("Job failed.", {
                jobId: job.id,
                kind: job.kind,
                attempts: job.attempts,
                dead,
                error: message,
            });
        }
    }
    return jobs.length;
}

async function refreshSessions(): Promise<void> {
    const due = await runtime.auth.tokens.findSessionsDueForRefresh(25);
    for (const sessionId of due) {
        await runtime.auth.tokens.refreshSession(sessionId);
    }
}

async function maintain(): Promise<void> {
    const now = Date.now();
    await runtime.database.db.execute(
        sql`delete from sessions where (expires_at < now() - interval '30 days') or (revoked_at is not null and revoked_at < now() - interval '30 days')`,
    );
    await runtime.database.db.execute(
        sql`delete from auth_transactions where expires_at < now() - interval '1 hour'`,
    );
    await runtime.database.db.execute(sql`delete from revoked_access_tokens where expires_at < now()`);
    await runtime.database.db.execute(
        sql`delete from idempotency_keys where expires_at < now()`,
    );
    await runtime.jobs.purgeCompleted(new Date(now - 7 * 24 * 60 * 60 * 1000));
    await runtime.auth.sessions.pruneExpired(new Date(now - 30 * 24 * 60 * 60 * 1000));
}

async function loop(): Promise<void> {
    while (running) {
        try {
            let processed = 0;
            do {
                const events = await drainOutbox();
                const jobs = await drainJobs();
                processed = events + jobs;
            } while (processed > 0 && running);

            const now = Date.now();
            if (now - lastRefreshSweep > 60_000) {
                lastRefreshSweep = now;
                await refreshSessions();
            }
            if (now - lastMaintenance > 5 * 60_000) {
                lastMaintenance = now;
                await maintain();
            }
        } catch (error) {
            runtime.logger.error("Worker iteration failed.", {
                error: error instanceof Error ? error.message : "unknown",
            });
        }
        await sleep(2000);
    }
}

async function shutdown(signal: string): Promise<void> {
    if (!running) {
        return;
    }
    running = false;
    runtime.logger.info("Worker shutting down.", { signal });
    const force = setTimeout(() => process.exit(1), 15_000);
    force.unref();
    await runtime.close();
    clearTimeout(force);
    process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

runtime.logger.info("Worker started.", {
    workerId,
    capabilities: runtime.registry.list().map((entry) => entry.definition.id),
});

await loop();
