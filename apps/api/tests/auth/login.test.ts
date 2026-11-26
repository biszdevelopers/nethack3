import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sha256Hex } from "../../src/authentication/crypto.js";
import { startHarness, type TestHarness } from "../support/app-harness.js";
import { queryAsOwner, uniqueEmail } from "../support/test-database.js";

describe("Basis Auth discovery and login", () => {
    let harness: TestHarness;

    beforeAll(async () => {
        harness = await startHarness();
    });

    afterAll(async () => {
        await harness.closeHarness();
    });

    it("publishes the discovery metadata the application expects", async () => {
        const response = await fetch(
            `${harness.provider.baseUrl}/.well-known/openid-configuration`,
        );
        expect(response.status).toBe(200);
        const metadata = (await response.json()) as Record<string, unknown>;
        expect(metadata.issuer).toBe(harness.provider.issuer);
        expect(metadata.authorization_endpoint).toBe(`${harness.provider.baseUrl}/oauth/authorize`);
        expect(metadata.token_endpoint).toBe(`${harness.provider.baseUrl}/oauth/token`);
        expect(metadata.jwks_uri).toBe(`${harness.provider.baseUrl}/oauth/jwks`);
        expect(metadata.revocation_endpoint).toBe(`${harness.provider.baseUrl}/oauth/revoke`);
        expect(metadata.end_session_endpoint).toBe(`${harness.provider.baseUrl}/oauth/logout`);
        expect(metadata.response_types_supported).toEqual(["code"]);
        expect(metadata.subject_types_supported).toEqual(["public"]);
        expect(metadata.id_token_signing_alg_values_supported).toEqual(["RS256"]);
        expect(metadata.token_endpoint_auth_methods_supported).toEqual(["client_secret_basic"]);
        expect(metadata.code_challenge_methods_supported).toEqual(["S256"]);
    });

    it("starts login with state, nonce, PKCE, and the resource audience", async () => {
        const attempt = await harness.startLogin();
        const authorizeUrl = new URL(attempt.authorizeUrl);
        expect(authorizeUrl.origin).toBe(harness.provider.baseUrl);
        expect(authorizeUrl.pathname).toBe("/oauth/authorize");
        expect(authorizeUrl.searchParams.get("client_id")).toBe(harness.provider.clientId);
        expect(authorizeUrl.searchParams.get("response_type")).toBe("code");
        expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(harness.provider.redirectUri);
        expect(authorizeUrl.searchParams.get("scope")).toContain("openid");
        expect(authorizeUrl.searchParams.get("resource")).toBe(harness.provider.resource);
        expect(authorizeUrl.searchParams.get("code_challenge_method")).toBe("S256");
        expect(authorizeUrl.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(authorizeUrl.searchParams.get("state")?.length).toBeGreaterThan(20);
        expect(authorizeUrl.searchParams.get("nonce")?.length).toBeGreaterThan(20);
        expect(attempt.code).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });

    it("creates a local user and an opaque application session", async () => {
        const email = uniqueEmail("login");
        const auth = await harness.signIn({ email, name: "Login User" });

        expect(auth.session.user.email).toBe(email);
        expect(auth.session.user.displayName).toBe("Login User");
        expect(auth.session.memberships).toEqual([]);
        expect(auth.csrfToken.length).toBeGreaterThan(20);
        expect(auth.session.expiresAt).toBeTruthy();

        expect(auth.setCookieHeader).toContain("__Host-nethack_session=");
        expect(auth.setCookieHeader).toMatch(/HttpOnly/i);
        expect(auth.setCookieHeader).toMatch(/Secure/i);
        expect(auth.setCookieHeader).toMatch(/SameSite=Lax/i);
        expect(auth.setCookieHeader).toMatch(/Path=\//i);
        expect(auth.setCookieHeader).not.toMatch(/Domain=/i);

        const rows = await queryAsOwner<{
            token_hash: string;
            csrf_hash: string;
            access_token_encrypted: string | null;
            refresh_token_encrypted: string | null;
        }>(
            `select token_hash, csrf_hash, access_token_encrypted, refresh_token_encrypted
             from sessions where id = $1`,
            [auth.sessionId],
        );
        const row = rows[0];
        expect(row).toBeDefined();
        expect(row?.token_hash).not.toBe(auth.cookieValue);
        expect(row?.token_hash).toBe(sha256Hex(auth.cookieValue));
        expect(row?.csrf_hash).toBe(sha256Hex(auth.csrfToken));

        const issued = harness.provider.getLastIssuedTokens();
        expect(issued).not.toBeNull();
        expect(row?.access_token_encrypted).toMatch(/^v1\./);
        expect(row?.access_token_encrypted).not.toContain(issued?.accessToken ?? "");
        expect(row?.refresh_token_encrypted).toMatch(/^v1\./);
        expect(row?.refresh_token_encrypted).not.toContain(issued?.refreshToken ?? "");
        expect(row?.access_token_encrypted).not.toContain("eyJ");
        expect(row?.refresh_token_encrypted).not.toContain("eyJ");

        const identities = await queryAsOwner<{ subject: string; email_at_login: string }>(
            "select subject, email_at_login from external_identities where user_id = $1",
            [auth.userId],
        );
        expect(identities).toHaveLength(1);
        expect(identities[0]?.subject).toBe(auth.subject);
        expect(identities[0]?.email_at_login).toBe(email);
    });

    it("rejects a callback whose state does not match a pending transaction", async () => {
        const attempt = await harness.startLogin();
        const mismatched = new URL(attempt.callbackUrl);
        mismatched.searchParams.set("state", "not-the-state");
        const response = await harness.completeLogin(attempt, mismatched);

        expect(response.statusCode).toBe(302);
        expect(String(response.headers.location)).toContain("/auth/error?reason=login_expired");
        expect(response.headers["set-cookie"]).toBeUndefined();
    });

    it("rejects a reused authorization code without creating a session", async () => {
        harness.provider.setNextUser({ email: uniqueEmail("reuse"), name: "Reuse User" });
        const first = await harness.startLogin();
        const firstResponse = await harness.completeLogin(first);
        expect(firstResponse.statusCode).toBe(302);

        const setCookie = firstResponse.headers["set-cookie"];
        const setCookieValue = Array.isArray(setCookie) ? setCookie[0] : setCookie;
        expect(setCookieValue).toContain("__Host-nethack_session=");
        const cookiePair = (setCookieValue ?? "").split(";")[0] ?? "";
        const sessionResponse = await harness.runtime.app.inject({
            method: "GET",
            url: "/api/v1/auth/session",
            headers: { cookie: cookiePair },
        });
        expect(sessionResponse.statusCode).toBe(200);
        const session = sessionResponse.json() as { user: { id: string } };

        const second = await harness.startLogin();
        expect(second.state).not.toBeNull();
        const override = new URL(first.callbackUrl);
        override.searchParams.set("state", second.state ?? "");
        const reused = await harness.completeLogin(second, override);

        expect(reused.statusCode).toBe(302);
        expect(String(reused.headers.location)).toContain("/auth/error?reason=login_failed");
        expect(reused.headers["set-cookie"]).toBeUndefined();

        const counts = await queryAsOwner<{ count: string }>(
            "select count(*)::text as count from sessions where user_id = $1",
            [session.user.id],
        );
        expect(counts[0]?.count).toBe("1");
    });

    it("redirects to login_expired for an unknown or expired transaction", async () => {
        const unknown = new URL("http://localhost:3002/api/v1/auth/callback");
        unknown.searchParams.set("code", "unknown-code");
        unknown.searchParams.set("state", "unknown-state");
        const unknownResponse = await harness.runtime.app.inject({
            method: "GET",
            url: `${unknown.pathname}${unknown.search}`,
        });
        expect(unknownResponse.statusCode).toBe(302);
        expect(String(unknownResponse.headers.location)).toContain(
            "/auth/error?reason=login_expired",
        );
        expect(unknownResponse.headers["set-cookie"]).toBeUndefined();

        const attempt = await harness.startLogin();
        await queryAsOwner(
            `update auth_transactions set expires_at = now() - interval '1 second'
             where state_hash = $1`,
            [sha256Hex(attempt.state ?? "")],
        );
        const expiredResponse = await harness.completeLogin(attempt);
        expect(expiredResponse.statusCode).toBe(302);
        expect(String(expiredResponse.headers.location)).toContain(
            "/auth/error?reason=login_expired",
        );
        expect(expiredResponse.headers["set-cookie"]).toBeUndefined();
    });

    it("rejects an ID token whose nonce does not match the transaction", async () => {
        harness.provider.setWrongNonce(true);
        try {
            const attempt = await harness.startLogin();
            const response = await harness.completeLogin(attempt);
            expect(response.statusCode).toBe(302);
            expect(String(response.headers.location)).toContain("/auth/error?reason=login_failed");
            expect(response.headers["set-cookie"]).toBeUndefined();
        } finally {
            harness.provider.setWrongNonce(false);
        }
    });

    it("maps a provider access_denied response to login_cancelled", async () => {
        harness.provider.setErrorMode("access_denied");
        try {
            const attempt = await harness.startLogin();
            expect(attempt.callbackUrl.searchParams.get("error")).toBe("access_denied");
            const response = await harness.completeLogin(attempt);
            expect(response.statusCode).toBe(302);
            expect(String(response.headers.location)).toContain(
                "/auth/error?reason=login_cancelled",
            );
            expect(response.headers["set-cookie"]).toBeUndefined();
        } finally {
            harness.provider.setErrorMode(null);
        }
    });
});
