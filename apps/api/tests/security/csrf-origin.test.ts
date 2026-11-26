import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startHarness, type TestHarness, type TestSession } from "../support/app-harness.js";
import { uniqueSlug } from "../support/test-database.js";

function organizationPayload(): { name: string; slug: string; description: string } {
    const slug = uniqueSlug("security-csrf");
    return { name: `CSRF ${slug}`, slug, description: "" };
}

describe("CSRF, Origin, and bearer exemption", () => {
    let harness: TestHarness;
    let auth: TestSession;

    beforeAll(async () => {
        harness = await startHarness();
        auth = await harness.signIn();
    });

    afterAll(async () => {
        await harness.closeHarness();
    });

    it("rejects an unsafe cookie request without a CSRF token", async () => {
        const response = await harness.inject({
            method: "POST",
            url: "/api/v1/organizations",
            headers: { cookie: auth.cookie, origin: "http://localhost:5173" },
            payload: organizationPayload(),
        });
        expect(response.statusCode).toBe(403);
    });

    it("rejects an unsafe cookie request without an Origin header", async () => {
        const response = await harness.inject({
            method: "POST",
            url: "/api/v1/organizations",
            headers: { cookie: auth.cookie, "x-csrf-token": auth.csrfToken },
            payload: organizationPayload(),
        });
        expect(response.statusCode).toBe(403);
    });

    it("rejects an unsafe cookie request from a foreign origin", async () => {
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
    });

    it("rejects an unsafe cookie request with the wrong CSRF token", async () => {
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

    it("rejects an unsafe cookie request whose CSRF token belongs to another session", async () => {
        const other = await harness.signIn();
        const response = await harness.inject({
            method: "POST",
            url: "/api/v1/organizations",
            headers: {
                cookie: auth.cookie,
                origin: "http://localhost:5173",
                "x-csrf-token": other.csrfToken,
            },
            payload: organizationPayload(),
        });
        expect(response.statusCode).toBe(403);
    });

    it("keeps safe GET requests usable without a CSRF token", async () => {
        const response = await harness.inject({
            method: "GET",
            url: "/api/v1/auth/session",
            headers: { cookie: auth.cookie, origin: "http://localhost:5173" },
        });
        expect(response.statusCode).toBe(200);

        const organizations = await harness.inject({
            method: "GET",
            url: "/api/v1/organizations",
            headers: { cookie: auth.cookie },
        });
        expect(organizations.statusCode).toBe(200);
    });

    it("accepts a correctly signed cookie request", async () => {
        const response = await harness.authenticatedRequest(auth, {
            method: "POST",
            url: "/api/v1/organizations",
            payload: organizationPayload(),
        });
        expect(response.statusCode).toBe(201);
    });

    it("exempts a bearer-authenticated unsafe request from Origin and CSRF checks", async () => {
        const tokens = await harness.runtime.auth.sessions.readTokens(auth.sessionId);
        if (tokens === null) {
            throw new Error("The session has no readable access token.");
        }
        const response = await harness.inject({
            method: "POST",
            url: "/api/v1/organizations",
            headers: { authorization: `Bearer ${tokens.accessToken}` },
            payload: organizationPayload(),
        });
        expect(response.statusCode).toBe(201);

        const session = await harness.inject({
            method: "GET",
            url: "/api/v1/auth/session",
            headers: { authorization: `Bearer ${tokens.accessToken}` },
        });
        expect(session.statusCode).toBe(200);
        expect((session.json() as { csrfToken: string }).csrfToken).toBe("");
    });

    it("rejects a bad bearer token with 401 even when a cookie is absent", async () => {
        const response = await harness.inject({
            method: "GET",
            url: "/api/v1/me",
            headers: { authorization: "Bearer not-a-valid-token-not-a-valid-token" },
        });
        expect(response.statusCode).toBe(401);
    });
});
