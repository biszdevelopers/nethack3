import { createHmac, randomBytes } from "node:crypto";
import { decodeJwt } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startHarness, type TestHarness } from "../support/app-harness.js";
import { queryAsOwner } from "../support/test-database.js";

describe("backchannel callbacks", () => {
    let harness: TestHarness;

    beforeAll(async () => {
        harness = await startHarness();
    });

    afterAll(async () => {
        await harness.closeHarness();
    });

    async function postBackchannel(form: URLSearchParams) {
        return harness.runtime.app.inject({
            method: "POST",
            url: "/api/v1/auth/backchannel",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            payload: form.toString(),
        });
    }

    it("ends the user's sessions on a logout token and tolerates replay", async () => {
        const auth = await harness.signIn();
        const logoutToken = await harness.provider.createLogoutToken(auth.subject);

        const first = await postBackchannel(new URLSearchParams({ logout_token: logoutToken }));
        expect(first.statusCode).toBe(200);

        const sessionRequest = await harness.runtime.app.inject({
            method: "GET",
            url: "/api/v1/auth/session",
            headers: { cookie: auth.cookie },
        });
        expect(sessionRequest.statusCode).toBe(401);

        const rows = await queryAsOwner<{ revoked_reason: string | null }>(
            "select revoked_reason from sessions where id = $1",
            [auth.sessionId],
        );
        expect(rows[0]?.revoked_reason).toBe("backchannel_logout");

        const replay = await postBackchannel(new URLSearchParams({ logout_token: logoutToken }));
        expect(replay.statusCode).toBe(200);

        const events = await queryAsOwner<{ count: string }>(
            "select count(*)::text as count from backchannel_events where event_type = 'logout'",
        );
        expect(events[0]?.count).toBe("1");
    });

    it("denies a revoked access token to the bearer authenticator", async () => {
        const auth = await harness.signIn();
        const tokens = await harness.runtime.auth.sessions.readTokens(auth.sessionId);
        if (tokens === null) {
            throw new Error("The session has no readable tokens.");
        }
        const claims = decodeJwt(tokens.accessToken);
        if (typeof claims.jti !== "string" || typeof claims.iat !== "number") {
            throw new Error("The access token is missing jti or iat.");
        }

        const accepted = await harness.runtime.auth.bearer.authenticate(tokens.accessToken);
        expect(accepted).not.toBeNull();

        const revocationToken = await harness.provider.createRevocationToken({
            jti: claims.jti,
            validAfter: claims.iat,
            expiresAt: claims.iat + 3600,
        });

        const response = await postBackchannel(
            new URLSearchParams({
                action: "revoke_access_token",
                jti: claims.jti,
                valid_after: String(claims.iat),
                revocation_token: revocationToken,
            }),
        );
        expect(response.statusCode).toBe(200);

        const denied = await harness.runtime.auth.bearer.authenticate(tokens.accessToken);
        expect(denied).toBeNull();

        const me = await harness.runtime.app.inject({
            method: "GET",
            url: "/api/v1/me",
            headers: { authorization: `Bearer ${tokens.accessToken}` },
        });
        expect(me.statusCode).toBe(401);

        const stored = await queryAsOwner<{ jti: string }>(
            "select jti from revoked_access_tokens where jti = $1",
            [claims.jti],
        );
        expect(stored).toHaveLength(1);

        const replay = await postBackchannel(
            new URLSearchParams({
                action: "revoke_access_token",
                jti: claims.jti,
                valid_after: String(claims.iat),
                revocation_token: revocationToken,
            }),
        );
        expect(replay.statusCode).toBe(200);
    });

    it("answers a webhook challenge with 202 and proves the HMAC to the provider", async () => {
        const nonce = randomBytes(32).toString("base64url");
        const challenge = randomBytes(32).toString("base64url");
        harness.provider.expectBackchannelChallenge(nonce, challenge);

        const response = await postBackchannel(
            new URLSearchParams({ action: "test", nonce, challenge }),
        );
        expect(response.statusCode).toBe(202);

        const record = harness.provider.getLastBackchannelValidation();
        expect(record).not.toBeNull();
        expect(record?.nonce).toBe(nonce);
        expect(record?.challengeHash).toBe(
            createHmac("sha256", harness.provider.resourceSecret)
                .update(challenge, "utf8")
                .digest("hex"),
        );
        expect(record?.authorization).toBe(`Bearer ${harness.provider.resourceSecret}`);
        expect(record?.resourceHeader).toBe(encodeURIComponent(harness.provider.resource));
        expect(response.body).toBe("");
    });
});
