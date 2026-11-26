import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startHarness, type TestHarness, type TestSession } from "../support/app-harness.js";
import { uniqueSlug } from "../support/test-database.js";

function organizationPayload(): { name: string; slug: string; description: string } {
    const slug = uniqueSlug("csrf");
    return { name: `CSRF Test ${slug}`, slug, description: "" };
}

describe("session CSRF and origin enforcement", () => {
    let harness: TestHarness;
    let auth: TestSession;

    beforeAll(async () => {
        harness = await startHarness();
        auth = await harness.signIn();
    });

    afterAll(async () => {
        await harness.closeHarness();
    });

    it("rejects an unsafe cookie-authenticated request without a CSRF token", async () => {
        const response = await harness.inject({
            method: "POST",
            url: "/api/v1/organizations",
            headers: {
                cookie: auth.cookie,
                origin: "http://localhost:5173",
            },
            payload: organizationPayload(),
        });
        expect(response.statusCode).toBe(403);
        expect((response.json() as { error: { code: string } }).error.code).toBe("forbidden");
    });

    it("rejects an unsafe request from a disallowed origin", async () => {
        const response = await harness.inject({
            method: "POST",
            url: "/api/v1/organizations",
            headers: {
                cookie: auth.cookie,
                origin: "https://malicious.example",
                "x-csrf-token": auth.csrfToken,
            },
            payload: organizationPayload(),
        });
        expect(response.statusCode).toBe(403);
        expect((response.json() as { error: { code: string } }).error.code).toBe("forbidden");
    });

    it("rejects an unsafe request with a wrong CSRF token", async () => {
        const response = await harness.inject({
            method: "POST",
            url: "/api/v1/organizations",
            headers: {
                cookie: auth.cookie,
                origin: "http://localhost:5173",
                "x-csrf-token": "wrong-token",
            },
            payload: organizationPayload(),
        });
        expect(response.statusCode).toBe(403);
    });

    it("rejects an unsafe cookie-authenticated request without an Origin header", async () => {
        const response = await harness.inject({
            method: "POST",
            url: "/api/v1/organizations",
            headers: {
                cookie: auth.cookie,
                "x-csrf-token": auth.csrfToken,
            },
            payload: organizationPayload(),
        });
        expect(response.statusCode).toBe(403);
    });

    it("accepts an unsafe request with the session cookie, allowed origin, and CSRF token", async () => {
        const response = await harness.authenticatedRequest(auth, {
            method: "POST",
            url: "/api/v1/organizations",
            payload: organizationPayload(),
        });
        expect(response.statusCode).toBe(201);
    });
});
