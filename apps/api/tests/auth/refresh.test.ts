import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SessionTokens } from "../../src/authentication/session-service.js";
import { startHarness, type TestHarness } from "../support/app-harness.js";
import { queryAsOwner } from "../support/test-database.js";

function requireTokens(tokens: SessionTokens | null): SessionTokens {
    if (tokens === null) {
        throw new Error("The session has no readable tokens.");
    }
    return tokens;
}

describe("refresh token rotation", () => {
    let harness: TestHarness;

    beforeAll(async () => {
        harness = await startHarness();
    });

    afterAll(async () => {
        await harness.closeHarness();
    });

    it("rotates the refresh token and revokes the session when the old token is reused", async () => {
        const auth = await harness.signIn();
        const before = requireTokens(
            await harness.runtime.auth.sessions.readTokens(auth.sessionId),
        );
        expect(before.refreshToken).not.toBeNull();
        if (before.refreshToken === null) {
            throw new Error("The provider did not issue a refresh token.");
        }
        const oldRefreshToken = before.refreshToken;
        const oldAccessToken = before.accessToken;

        await queryAsOwner(
            `update sessions set access_token_expires_at = now() - interval '5 seconds'
             where id = $1`,
            [auth.sessionId],
        );

        await harness.runtime.auth.tokens.refreshSession(auth.sessionId);

        const after = requireTokens(await harness.runtime.auth.sessions.readTokens(auth.sessionId));
        expect(after.accessToken).not.toBe(oldAccessToken);
        expect(after.refreshToken).not.toBeNull();
        expect(after.refreshToken).not.toBe(oldRefreshToken);
        if (after.refreshToken === null) {
            throw new Error("The provider did not rotate the refresh token.");
        }

        const due = await harness.runtime.auth.tokens.findSessionsDueForRefresh(50);
        expect(due).not.toContain(auth.sessionId);

        const issuedBeforeReuse = harness.provider.getIssuedTokens().length;

        // A client that lost the rotation writes the consumed token back. The
        // provider must reject it and revoke the whole refresh family.
        await harness.runtime.auth.sessions.markTokenRefreshed(
            auth.sessionId,
            after.accessToken,
            oldRefreshToken,
            new Date(Date.now() - 5_000),
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        );

        await harness.runtime.auth.tokens.refreshSession(auth.sessionId);
        expect(harness.provider.getIssuedTokens().length).toBe(issuedBeforeReuse);

        const rows = await queryAsOwner<{
            revoked_at: Date | null;
            revoked_reason: string | null;
            refresh_token_encrypted: string | null;
        }>(
            "select revoked_at, revoked_reason, refresh_token_encrypted from sessions where id = $1",
            [auth.sessionId],
        );
        expect(rows[0]?.revoked_at).not.toBeNull();
        expect(rows[0]?.revoked_reason).toBe("refresh_token_rejected");
        expect(rows[0]?.refresh_token_encrypted).toBeNull();

        const sessionRequest = await harness.runtime.app.inject({
            method: "GET",
            url: "/api/v1/auth/session",
            headers: { cookie: auth.cookie },
        });
        expect(sessionRequest.statusCode).toBe(401);

        await expect(harness.runtime.auth.client.refresh(after.refreshToken)).rejects.toThrow();
    });

    it("refreshes before the access token expires when the skew window is reached", async () => {
        const auth = await harness.signIn();
        const before = requireTokens(
            await harness.runtime.auth.sessions.readTokens(auth.sessionId),
        );
        await queryAsOwner(
            `update sessions set access_token_expires_at = now() + interval '30 seconds'
             where id = $1`,
            [auth.sessionId],
        );

        await harness.runtime.auth.tokens.refreshSession(auth.sessionId);

        const after = requireTokens(await harness.runtime.auth.sessions.readTokens(auth.sessionId));
        expect(after.accessToken).not.toBe(before.accessToken);
    });
});
