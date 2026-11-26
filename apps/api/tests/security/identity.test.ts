import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decodeJwt } from "jose";
import { startHarness, type TestHarness } from "../support/app-harness.js";
import { queryAsOwner } from "../support/test-database.js";

describe("account state and token revocation", () => {
    let harness: TestHarness;

    beforeAll(async () => {
        harness = await startHarness();
    });

    afterAll(async () => {
        await harness.closeHarness();
    });

    it("rejects a disabled user's existing session and revokes it", async () => {
        const auth = await harness.signIn();
        await harness.createOrganization(auth);

        const before = await harness.inject({
            method: "GET",
            url: "/api/v1/auth/session",
            headers: { cookie: auth.cookie },
        });
        expect(before.statusCode).toBe(200);

        await queryAsOwner(
            "update users set status = 'disabled', updated_at = now() where id = $1",
            [auth.userId],
        );

        const after = await harness.inject({
            method: "GET",
            url: "/api/v1/auth/session",
            headers: { cookie: auth.cookie },
        });
        expect(after.statusCode).toBe(401);

        const organizations = await harness.inject({
            method: "GET",
            url: "/api/v1/organizations",
            headers: { cookie: auth.cookie },
        });
        expect(organizations.statusCode).toBe(401);

        const sessions = await queryAsOwner<{ revoked_reason: string | null }>(
            "select revoked_reason from sessions where id = $1",
            [auth.sessionId],
        );
        expect(sessions[0]?.revoked_reason).toBe("account_disabled");
    });

    it("rejects a revoked access token JWT at the bearer authenticator", async () => {
        const auth = await harness.signIn();
        const tokens = await harness.runtime.auth.sessions.readTokens(auth.sessionId);
        if (tokens === null) {
            throw new Error("The session has no readable access token.");
        }
        const claims = decodeJwt(tokens.accessToken);
        if (typeof claims.jti !== "string" || typeof claims.iat !== "number") {
            throw new Error("The access token is missing jti or iat.");
        }

        const accepted = await harness.inject({
            method: "GET",
            url: "/api/v1/me",
            headers: { authorization: `Bearer ${tokens.accessToken}` },
        });
        expect(accepted.statusCode).toBe(200);

        const revocationToken = await harness.provider.createRevocationToken({
            jti: claims.jti,
            validAfter: claims.iat,
            expiresAt: claims.iat + 3600,
        });
        const revoked = await harness.inject({
            method: "POST",
            url: "/api/v1/auth/backchannel",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            payload: new URLSearchParams({
                action: "revoke_access_token",
                jti: claims.jti,
                valid_after: String(claims.iat),
                revocation_token: revocationToken,
            }).toString(),
        });
        expect(revoked.statusCode).toBe(200);

        const denied = await harness.inject({
            method: "GET",
            url: "/api/v1/me",
            headers: { authorization: `Bearer ${tokens.accessToken}` },
        });
        expect(denied.statusCode).toBe(401);
        expect(await harness.runtime.auth.bearer.authenticate(tokens.accessToken)).toBeNull();
    });

    it("rejects a bearer token whose external subject has no local account", async () => {
        await harness.signIn();
        const issued = harness.provider.getLastIssuedTokens();
        if (issued === null) {
            throw new Error("The provider issued no tokens.");
        }
        const forged = `${issued.accessToken.slice(0, -4)}aaaa`;
        const response = await harness.inject({
            method: "GET",
            url: "/api/v1/me",
            headers: { authorization: `Bearer ${forged}` },
        });
        expect(response.statusCode).toBe(401);
    });
});
