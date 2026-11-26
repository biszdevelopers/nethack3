import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startHarness, type TestHarness, type TestSession } from "../support/app-harness.js";
import { queryAsOwner } from "../support/test-database.js";

describe("session logout", () => {
    let harness: TestHarness;

    beforeAll(async () => {
        harness = await startHarness();
    });

    afterAll(async () => {
        await harness.closeHarness();
    });

    it("revokes the session, clears the cookie, and rejects the old cookie", async () => {
        const auth: TestSession = await harness.signIn();

        const before = await harness.runtime.app.inject({
            method: "GET",
            url: "/api/v1/auth/session",
            headers: { cookie: auth.cookie },
        });
        expect(before.statusCode).toBe(200);

        const issued = harness.provider.getLastIssuedTokens();
        expect(issued?.refreshToken).not.toBeNull();

        const logout = await harness.authenticatedRequest(auth, {
            method: "POST",
            url: "/api/v1/auth/logout",
        });
        expect(logout.statusCode).toBe(200);
        const body = logout.json() as { providerLogoutUrl: string | null };
        expect(body.providerLogoutUrl).not.toBeNull();
        expect(body.providerLogoutUrl).toContain(`${harness.provider.baseUrl}/oauth/logout`);
        expect(body.providerLogoutUrl).toContain("post_logout_redirect_uri");

        const setCookie = logout.headers["set-cookie"];
        const cleared = Array.isArray(setCookie) ? (setCookie[0] ?? "") : (setCookie ?? "");
        expect(cleared).toContain("__Host-nethack_session=");
        expect(cleared).toMatch(/Max-Age=0/i);

        const rows = await queryAsOwner<{ revoked_at: Date | null; revoked_reason: string | null }>(
            "select revoked_at, revoked_reason from sessions where id = $1",
            [auth.sessionId],
        );
        expect(rows[0]?.revoked_at).not.toBeNull();
        expect(rows[0]?.revoked_reason).toBe("user_logout");

        const revoked = harness.provider.getRevokedTokens();
        expect(revoked.some((entry) => entry.token === issued?.refreshToken)).toBe(true);
        expect(revoked.some((entry) => entry.tokenTypeHint === "refresh_token")).toBe(true);

        const after = await harness.runtime.app.inject({
            method: "GET",
            url: "/api/v1/auth/session",
            headers: { cookie: auth.cookie },
        });
        expect(after.statusCode).toBe(401);
        expect((after.json() as { error: { code: string } }).error.code).toBe(
            "authentication_required",
        );
    });
});
