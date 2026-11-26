import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startHarness, type TestHarness } from "../support/app-harness.js";

describe("login route rate limiting", () => {
    let harness: TestHarness;

    beforeAll(async () => {
        harness = await startHarness();
    });

    afterAll(async () => {
        await harness.closeHarness();
    });

    it("returns 429 after the per-route login burst is exceeded", async () => {
        const statuses: number[] = [];
        let configuredLimit: string | undefined;
        for (let attempt = 0; attempt < 25; attempt += 1) {
            const response = await harness.runtime.app.inject({
                method: "GET",
                url: "/api/v1/auth/login",
                remoteAddress: "203.0.113.9",
            });
            configuredLimit ??= response.headers["x-ratelimit-limit"]?.toString();
            statuses.push(response.statusCode);
            if (response.statusCode === 429) {
                expect(response.headers["retry-after"]).toBeDefined();
                break;
            }
        }
        expect(configuredLimit).toBe("20");
        expect(statuses).toContain(429);
        expect(statuses.filter((status) => status === 302).length).toBeLessThan(25);
    });
});
