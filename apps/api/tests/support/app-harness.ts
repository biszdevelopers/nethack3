import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
    organizationSchema,
    sessionSchema,
    type Organization,
    type Session,
} from "@nethack/contracts";
import type { InjectOptions, LightMyRequestResponse } from "fastify";
import { loadConfiguration } from "../../src/core/configuration.js";
import { NethackRuntime } from "../../src/core/runtime.js";
import { MockOidcProvider, type MockUserClaims } from "./mock-oidc-provider.js";
import {
    closeTestDatabase,
    queryAsOwner,
    resetTestDatabase,
    runtimeDatabaseUrl,
    uniqueEmail,
    uniqueSlug,
} from "./test-database.js";

const WORKSPACE_ORIGIN = "http://localhost:5173";
const API_ORIGIN = "http://localhost:3002";
const SESSION_COOKIE_NAME = "__Host-nethack_session";
const SESSION_ENCRYPTION_KEY = Buffer.from("nethack-test-session-encryption!").toString("base64");

export interface LoginAttempt {
    readonly authorizeUrl: string;
    readonly callbackUrl: URL;
    readonly code: string | null;
    readonly state: string | null;
}

export interface TestSession {
    readonly session: Session;
    readonly cookie: string;
    readonly cookieValue: string;
    readonly csrfToken: string;
    readonly userId: string;
    readonly subject: string;
    readonly sessionId: string;
    readonly setCookieHeader: string;
}

export interface AuthenticatedRequestOptions {
    readonly method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
    readonly url: string;
    readonly payload?: NonNullable<InjectOptions["payload"]>;
    readonly headers?: Record<string, string>;
}

export interface OrganizationInput {
    readonly name?: string;
    readonly slug?: string;
    readonly description?: string;
}

export interface TestHarness {
    readonly runtime: NethackRuntime;
    readonly provider: MockOidcProvider;
    readonly config: ReturnType<typeof loadConfiguration>;
    startLogin(): Promise<LoginAttempt>;
    completeLogin(attempt: LoginAttempt, callbackOverride?: URL): Promise<LightMyRequestResponse>;
    signIn(claims?: MockUserClaims): Promise<TestSession>;
    inject(options: AuthenticatedRequestOptions): Promise<LightMyRequestResponse>;
    authenticatedRequest(
        auth: TestSession,
        options: AuthenticatedRequestOptions,
    ): Promise<LightMyRequestResponse>;
    buildHeaders(auth: TestSession, organizationId?: string): Record<string, string>;
    createOrganization(auth: TestSession, input?: OrganizationInput): Promise<Organization>;
    findSessionId(userId: string): Promise<string>;
    closeHarness(): Promise<void>;
}

async function findSessionId(userId: string): Promise<string> {
    const rows = await queryAsOwner<{ id: string }>(
        "select id from sessions where user_id = $1 order by created_at desc limit 1",
        [userId],
    );
    const row = rows[0];
    if (row === undefined) {
        throw new Error("No session row exists for the signed-in user.");
    }
    return row.id;
}

function buildHeaders(auth: TestSession, organizationId?: string): Record<string, string> {
    return {
        cookie: auth.cookie,
        origin: WORKSPACE_ORIGIN,
        "x-csrf-token": auth.csrfToken,
        ...(organizationId === undefined ? {} : { "x-nethack-organization-id": organizationId }),
    };
}

export async function startHarness(): Promise<TestHarness> {
    // The API's discovery call refuses plain HTTP issuers even when
    // BASIS_AUTH_ALLOW_INSECURE_HTTP is set (see the test report). The mock
    // provider runs over TLS with a throwaway certificate so the rest of the
    // flow can be exercised. This affects only the local test transport.
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    await resetTestDatabase();

    const provider = await MockOidcProvider.create({
        redirectUri: `${API_ORIGIN}/api/v1/auth/callback`,
        enableTls: true,
    });
    await provider.start();

    const storageRoot = mkdtempSync(join(tmpdir(), "nethack-api-tests-"));
    const config = loadConfiguration(buildEnvironment(provider, storageRoot));
    const runtime = new NethackRuntime({ config });
    await runtime.initializeHttp();

    async function startLogin(): Promise<LoginAttempt> {
        const response = await runtime.app.inject({
            method: "GET",
            url: "/api/v1/auth/login",
        });
        if (response.statusCode !== 302) {
            throw new Error(
                `Login start did not redirect (status ${response.statusCode}): ${response.body}`,
            );
        }
        const location = headerValue(response.headers.location);
        if (location === null) {
            throw new Error("Login start returned no Location header.");
        }
        const authorizeResponse = await fetch(location, { redirect: "manual" });
        const redirectLocation = authorizeResponse.headers.get("location");
        if (redirectLocation === null) {
            const body = await authorizeResponse.text();
            throw new Error(
                `Authorize did not redirect (status ${authorizeResponse.status}): ${body}`,
            );
        }
        const callbackUrl = new URL(redirectLocation);
        return {
            authorizeUrl: location,
            callbackUrl,
            code: callbackUrl.searchParams.get("code"),
            state: callbackUrl.searchParams.get("state"),
        };
    }

    async function completeLogin(
        attempt: LoginAttempt,
        callbackOverride?: URL,
    ): Promise<LightMyRequestResponse> {
        const target = callbackOverride ?? attempt.callbackUrl;
        return runtime.app.inject({
            method: "GET",
            url: `${target.pathname}${target.search}`,
        });
    }

    async function signIn(claims: MockUserClaims = {}): Promise<TestSession> {
        const user: MockUserClaims = {
            email: claims.email ?? uniqueEmail("signin"),
            name: claims.name ?? "Integration User",
            ...(claims.picture === undefined ? {} : { picture: claims.picture }),
            ...(claims.subject === undefined ? {} : { subject: claims.subject }),
        };
        provider.setNextUser(user);
        const attempt = await startLogin();
        const response = await completeLogin(attempt);
        if (response.statusCode !== 302) {
            throw new Error(
                `Login callback did not redirect (status ${response.statusCode}): ${response.body}`,
            );
        }
        const location = headerValue(response.headers.location);
        if (location === null || location.includes("/auth/error")) {
            throw new Error(`Sign-in failed: ${location ?? "no Location header"}`);
        }
        const setCookie = response.headers["set-cookie"];
        const cookieValue = extractCookieValue(setCookie, SESSION_COOKIE_NAME);
        if (cookieValue === null) {
            throw new Error("Sign-in did not set the application session cookie.");
        }
        const cookie = `${SESSION_COOKIE_NAME}=${cookieValue}`;
        const sessionResponse = await runtime.app.inject({
            method: "GET",
            url: "/api/v1/auth/session",
            headers: { cookie },
        });
        if (sessionResponse.statusCode !== 200) {
            throw new Error(
                `Session lookup failed (status ${sessionResponse.statusCode}): ${sessionResponse.body}`,
            );
        }
        const session = sessionSchema.parse(sessionResponse.json());
        const identity = await queryAsOwner<{ subject: string }>(
            "select subject from external_identities where user_id = $1 and issuer = $2 limit 1",
            [session.user.id, config.basisAuth.issuer],
        );
        const subject = identity[0]?.subject;
        if (subject === undefined) {
            throw new Error("The signed-in user has no external identity record.");
        }
        const sessionId = await findSessionId(session.user.id);
        return {
            session,
            cookie,
            cookieValue,
            csrfToken: session.csrfToken,
            userId: session.user.id,
            subject,
            sessionId,
            setCookieHeader: Array.isArray(setCookie) ? (setCookie[0] ?? "") : (setCookie ?? ""),
        };
    }

    async function authenticatedRequest(
        auth: TestSession,
        options: AuthenticatedRequestOptions,
    ): Promise<LightMyRequestResponse> {
        const base = buildHeaders(auth);
        return runtime.app.inject(
            toInjectOptions({ ...options, headers: { ...base, ...options.headers } }),
        );
    }

    async function createOrganization(
        auth: TestSession,
        input: OrganizationInput = {},
    ): Promise<Organization> {
        const slug = input.slug ?? uniqueSlug();
        const response = await authenticatedRequest(auth, {
            method: "POST",
            url: "/api/v1/organizations",
            payload: {
                name: input.name ?? `Organization ${slug}`,
                slug,
                description: input.description ?? "Integration test organization.",
            },
        });
        if (response.statusCode !== 201) {
            throw new Error(
                `Organization creation failed (status ${response.statusCode}): ${response.body}`,
            );
        }
        return organizationSchema.parse(response.json());
    }

    return {
        runtime,
        provider,
        config,
        startLogin,
        completeLogin,
        signIn,
        inject: async (options) => runtime.app.inject(toInjectOptions(options)),
        authenticatedRequest,
        buildHeaders,
        createOrganization,
        findSessionId,
        closeHarness: async () => {
            await runtime.close();
            await provider.stop();
            await closeTestDatabase();
            rmSync(storageRoot, { recursive: true, force: true });
        },
    };
}

function buildEnvironment(provider: MockOidcProvider, storageRoot: string): NodeJS.ProcessEnv {
    return {
        NODE_ENV: "test",
        LOG_LEVEL: process.env.NETHACK_TEST_LOG_LEVEL ?? "silent",
        DATABASE_URL: runtimeDatabaseUrl,
        DATABASE_POOL_MAX: "5",
        SESSION_COOKIE_NAME: SESSION_COOKIE_NAME,
        SESSION_TTL_SECONDS: "604800",
        SESSION_CSRF_HEADER: "x-csrf-token",
        SESSION_ENCRYPTION_KEYS: SESSION_ENCRYPTION_KEY,
        API_ORIGIN,
        WORKSPACE_ORIGIN,
        SITE_ORIGIN: "http://localhost:3000",
        ASSET_ORIGIN: API_ORIGIN,
        TRUST_PROXY: "false",
        BASIS_AUTH_ISSUER: provider.issuer,
        BASIS_AUTH_CLIENT_ID: provider.clientId,
        BASIS_AUTH_CLIENT_SECRET: provider.clientSecret,
        BASIS_AUTH_RESOURCE: provider.resource,
        BASIS_AUTH_SCOPES: "openid profile email offline_access nethack.access",
        BASIS_AUTH_RESOURCE_SECRET: provider.resourceSecret,
        BASIS_AUTH_INTERNAL_URL: provider.baseUrl,
        BASIS_AUTH_REDIRECT_URI: provider.redirectUri,
        BASIS_AUTH_POST_LOGOUT_REDIRECT_URI: `${WORKSPACE_ORIGIN}/`,
        BASIS_AUTH_ALLOW_INSECURE_HTTP: "true",
        STORAGE_ROOT: storageRoot,
        MAX_UPLOAD_BYTES: "1048576",
        MAX_REQUEST_BYTES: "1048576",
        RATE_LIMIT_MAX: "100000",
        RATE_LIMIT_WINDOW_MS: "60000",
        LOGIN_TRANSACTION_TTL_SECONDS: "600",
        REFRESH_SKEW_SECONDS: "60",
        BACKCHANNEL_MAX_TOKEN_AGE_SECONDS: "120",
    };
}

function toInjectOptions(options: AuthenticatedRequestOptions): InjectOptions {
    const result: InjectOptions = {
        method: options.method,
        url: options.url,
    };
    if (options.headers !== undefined) {
        result.headers = options.headers;
    }
    if (options.payload !== undefined) {
        result.payload = options.payload;
    }
    return result;
}

function headerValue(value: string | string[] | undefined): string | null {
    if (value === undefined) {
        return null;
    }
    return Array.isArray(value) ? (value[0] ?? null) : value;
}

function extractCookieValue(setCookie: string | string[] | undefined, name: string): string | null {
    const entries =
        setCookie === undefined ? [] : Array.isArray(setCookie) ? setCookie : [setCookie];
    for (const entry of entries) {
        const pair = entry.split(";")[0] ?? "";
        const separator = pair.indexOf("=");
        if (separator > 0 && pair.slice(0, separator) === name) {
            return pair.slice(separator + 1);
        }
    }
    return null;
}
