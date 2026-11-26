import { execFileSync } from "node:child_process";
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import {
    createServer as createHttpServer,
    type IncomingMessage,
    type Server,
    type ServerResponse,
} from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SignJWT, exportJWK, generateKeyPair, type JWK } from "jose";

/**
 * A real OpenID Connect provider for integration tests.
 *
 * The provider issues signed tokens from a random RSA key pair generated at
 * startup. It is deliberately small: only the behavior the nethack API relies
 * on is implemented.
 *
 * The API's discovery call cannot use a plain HTTP issuer because
 * BasisAuthClient does not pass allowInsecureRequests to openid-client's
 * discovery(). The provider therefore also listens over TLS with a throwaway
 * self-signed certificate generated at startup, and the harness uses that
 * listener.
 */

const BACKCHANNEL_EVENT = "http://schemas.openid.net/event/backchannel-logout";
const ACCESS_TOKEN_TTL_SECONDS = 3600;
const ID_TOKEN_TTL_SECONDS = 600;
const AUTHORIZATION_CODE_TTL_MS = 60_000;

export interface MockUserClaims {
    readonly email?: string;
    readonly name?: string;
    readonly picture?: string;
    readonly subject?: string;
}

export interface IssuedTokenSet {
    readonly accessToken: string;
    readonly accessTokenJti: string;
    readonly idToken: string;
    readonly refreshToken: string | null;
    readonly subject: string;
    readonly email: string | null;
    readonly scope: string;
    readonly issuedAt: number;
}

export interface RevokedTokenRecord {
    readonly token: string;
    readonly tokenTypeHint: string | null;
    readonly revokedAt: number;
}

export interface BackchannelValidationRecord {
    readonly authorization: string | null;
    readonly resourceHeader: string | null;
    readonly nonce: string;
    readonly challengeHash: string;
    readonly receivedAt: number;
}

export interface RevocationTokenInput {
    readonly jti: string;
    readonly validAfter: number;
    readonly expiresAt?: number;
}

export interface LogoutTokenOptions {
    readonly tokenId?: string;
    readonly issuedAt?: number;
    readonly expiresInSeconds?: number;
}

interface AuthorizationCodeRecord {
    readonly code: string;
    readonly clientId: string;
    readonly redirectUri: string;
    readonly nonce: string;
    readonly codeChallenge: string;
    readonly scope: string;
    readonly subject: string;
    readonly claims: MockUserClaims;
    readonly expiresAt: number;
    used: boolean;
}

interface RefreshTokenRecord {
    readonly token: string;
    readonly familyId: string;
    readonly subject: string;
    readonly claims: MockUserClaims;
    readonly scope: string;
    readonly expiresAt: number;
    used: boolean;
    revoked: boolean;
}

interface TokenEndpointInput {
    readonly grantType: string;
    readonly form: URLSearchParams;
    readonly clientId: string;
    readonly clientSecret: string;
}

export type AuthorizeErrorMode = "access_denied" | "login_required";

export interface MockOidcProviderOptions {
    readonly redirectUri?: string;
    readonly enableTls?: boolean;
}

export class MockOidcProvider {
    readonly clientId = "nethack-integration-client";
    readonly resource = "devconnect://nethack.test";
    readonly clientSecret: string;
    readonly resourceSecret: string;
    readonly redirectUri: string;

    private readonly enableTls: boolean;
    private privateKey: CryptoKey | null = null;
    private publicJwk: JWK | null = null;
    private kid = "";
    private httpServer: Server | null = null;
    private httpsServer: Server | null = null;
    private httpBaseUrl: string | null = null;
    private httpsBaseUrl: string | null = null;
    private tlsDirectory: string | null = null;

    private readonly authorizationCodes = new Map<string, AuthorizationCodeRecord>();
    private readonly refreshTokens = new Map<string, RefreshTokenRecord>();
    private readonly issuedTokens: IssuedTokenSet[] = [];
    private readonly revokedTokens: RevokedTokenRecord[] = [];
    private readonly backchannelValidations: BackchannelValidationRecord[] = [];
    private readonly expectedChallenges = new Map<string, string>();

    private pendingUser: MockUserClaims | null = null;
    private defaultUser: MockUserClaims;
    private lastSubject: string | null = null;
    private wrongNonce = false;
    private errorMode: AuthorizeErrorMode | null = null;
    private rejectCodeExchange = false;
    private forceInvalidGrant = false;
    private accessTokenTtlSeconds = ACCESS_TOKEN_TTL_SECONDS;

    private constructor(options: MockOidcProviderOptions = {}) {
        this.clientSecret = randomBytes(32).toString("base64url");
        this.resourceSecret = randomBytes(32).toString("base64url");
        this.redirectUri = options.redirectUri ?? "http://localhost:3002/api/v1/auth/callback";
        this.enableTls = options.enableTls ?? true;
        this.defaultUser = {
            email: `oidc-user-${randomUUID()}@example.test`,
            name: "OIDC Test User",
        };
    }

    static async create(options: MockOidcProviderOptions = {}): Promise<MockOidcProvider> {
        const provider = new MockOidcProvider(options);
        await provider.initializeKeys();
        return provider;
    }

    private async initializeKeys(): Promise<void> {
        const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
        this.privateKey = privateKey;
        this.kid = `nethack-test-${randomBytes(8).toString("hex")}`;
        const jwk = await exportJWK(publicKey);
        jwk.kid = this.kid;
        jwk.alg = "RS256";
        jwk.use = "sig";
        this.publicJwk = jwk;
    }

    async start(): Promise<void> {
        if (this.privateKey === null || this.publicJwk === null) {
            throw new Error("The mock provider must be created with MockOidcProvider.create().");
        }
        this.httpServer = createHttpServer((request, response) => {
            void this.handleRequest(request, response, () => this.httpBaseUrl ?? "");
        });
        const httpPort = await listen(this.httpServer);
        this.httpBaseUrl = `http://127.0.0.1:${httpPort}`;

        if (this.enableTls) {
            const material = generateTlsMaterial();
            if (material === null) {
                throw new Error(
                    "The integration suite needs openssl to run the OIDC provider over TLS. " +
                        "The API cannot discover a plain HTTP issuer because BasisAuthClient omits " +
                        "allowInsecureRequests during discovery.",
                );
            }
            this.tlsDirectory = material.directory;
            this.httpsServer = createHttpsServer(
                { key: material.key, cert: material.cert },
                (request, response) => {
                    void this.handleRequest(request, response, () => this.httpsBaseUrl ?? "");
                },
            );
            const httpsPort = await listen(this.httpsServer);
            this.httpsBaseUrl = `https://127.0.0.1:${httpsPort}`;
        }
    }

    async stop(): Promise<void> {
        const servers = [this.httpServer, this.httpsServer].filter(
            (server): server is Server => server !== null,
        );
        await Promise.all(
            servers.map((server) => {
                server.closeAllConnections();
                return new Promise<void>((resolve, reject) => {
                    server.close((error) => (error === undefined ? resolve() : reject(error)));
                });
            }),
        );
        this.httpServer = null;
        this.httpsServer = null;
        if (this.tlsDirectory !== null) {
            rmSync(this.tlsDirectory, { recursive: true, force: true });
            this.tlsDirectory = null;
        }
    }

    get baseUrl(): string {
        if (this.httpsBaseUrl !== null) {
            return this.httpsBaseUrl;
        }
        if (this.httpBaseUrl !== null) {
            return this.httpBaseUrl;
        }
        throw new Error("The mock provider has not been started.");
    }

    get httpUrl(): string {
        if (this.httpBaseUrl === null) {
            throw new Error("The mock provider has not been started.");
        }
        return this.httpBaseUrl;
    }

    get issuer(): string {
        return this.baseUrl;
    }

    get lastIssuedSubject(): string | null {
        return this.lastSubject;
    }

    setNextUser(claims: MockUserClaims): void {
        this.pendingUser = claims;
    }

    setUserClaims(claims: MockUserClaims): void {
        this.defaultUser = { ...this.defaultUser, ...claims };
    }

    setWrongNonce(enabled: boolean): void {
        this.wrongNonce = enabled;
    }

    setErrorMode(mode: AuthorizeErrorMode | null): void {
        this.errorMode = mode;
    }

    setRejectCodeExchange(enabled: boolean): void {
        this.rejectCodeExchange = enabled;
    }

    setForceInvalidGrant(enabled: boolean): void {
        this.forceInvalidGrant = enabled;
    }

    setAccessTokenTtl(seconds: number): void {
        this.accessTokenTtlSeconds = seconds;
    }

    getIssuedTokens(): readonly IssuedTokenSet[] {
        return [...this.issuedTokens];
    }

    getLastIssuedTokens(): IssuedTokenSet | null {
        return this.issuedTokens[this.issuedTokens.length - 1] ?? null;
    }

    getRevokedTokens(): readonly RevokedTokenRecord[] {
        return [...this.revokedTokens];
    }

    getBackchannelValidations(): readonly BackchannelValidationRecord[] {
        return [...this.backchannelValidations];
    }

    getLastBackchannelValidation(): BackchannelValidationRecord | null {
        return this.backchannelValidations[this.backchannelValidations.length - 1] ?? null;
    }

    expectBackchannelChallenge(nonce: string, challenge: string): void {
        this.expectedChallenges.set(nonce, challenge);
    }

    subjectForEmail(email: string): string | null {
        const token = this.issuedTokens.toReversed().find((entry) => entry.email === email);
        return token?.subject ?? null;
    }

    async createLogoutToken(subject: string, options: LogoutTokenOptions = {}): Promise<string> {
        const key = this.requirePrivateKey();
        const issuedAt = options.issuedAt ?? Math.floor(Date.now() / 1000);
        const expiresAt = issuedAt + (options.expiresInSeconds ?? 120);
        return new SignJWT({
            sub: subject,
            [BACKCHANNEL_EVENT]: {},
        })
            .setProtectedHeader({ alg: "RS256", typ: "logout+jwt", kid: this.kid })
            .setIssuer(this.issuer)
            .setAudience(this.resource)
            .setIssuedAt(issuedAt)
            .setExpirationTime(expiresAt)
            .setJti(options.tokenId ?? randomUUID())
            .sign(key);
    }

    async createRevocationToken(input: RevocationTokenInput): Promise<string> {
        const key = this.requirePrivateKey();
        const issuedAt = Math.floor(Date.now() / 1000);
        const expiresIn =
            input.expiresAt === undefined ? 120 : Math.max(1, input.expiresAt - issuedAt);
        return new SignJWT({
            access_token_jti: input.jti,
            valid_after: input.validAfter,
            ...(input.expiresAt === undefined ? {} : { access_token_expires_at: input.expiresAt }),
        })
            .setProtectedHeader({ alg: "RS256", typ: "at-revocation+jwt", kid: this.kid })
            .setIssuer(this.issuer)
            .setAudience(this.resource)
            .setIssuedAt(issuedAt)
            .setExpirationTime(issuedAt + expiresIn)
            .setJti(randomUUID())
            .sign(key);
    }

    private requirePrivateKey(): CryptoKey {
        if (this.privateKey === null) {
            throw new Error("The mock provider has not been initialized.");
        }
        return this.privateKey;
    }

    private async handleRequest(
        request: IncomingMessage,
        response: ServerResponse,
        baseUrl: () => string,
    ): Promise<void> {
        try {
            const url = new URL(request.url ?? "/", baseUrl() || "http://127.0.0.1");
            const method = request.method ?? "GET";
            await this.route(method, url, request, response, baseUrl());
        } catch (error) {
            if (!response.headersSent) {
                writeJson(response, 500, {
                    error: "server_error",
                    error_description: error instanceof Error ? error.message : "unknown",
                });
            } else {
                response.end();
            }
        }
    }

    private async route(
        method: string,
        url: URL,
        request: IncomingMessage,
        response: ServerResponse,
        baseUrl: string,
    ): Promise<void> {
        if (method === "GET" && url.pathname === "/.well-known/openid-configuration") {
            writeJson(response, 200, this.metadata(baseUrl));
            return;
        }
        if (method === "GET" && url.pathname === "/oauth/jwks") {
            writeJson(response, 200, { keys: [this.publicJwk] });
            return;
        }
        if (method === "GET" && url.pathname === "/oauth/authorize") {
            this.handleAuthorize(url, response);
            return;
        }
        if (method === "POST" && url.pathname === "/oauth/token") {
            await this.handleToken(request, response);
            return;
        }
        if (method === "POST" && url.pathname === "/oauth/revoke") {
            await this.handleRevoke(request, response);
            return;
        }
        if ((method === "GET" || method === "POST") && url.pathname === "/oauth/logout") {
            const body = method === "POST" ? new URLSearchParams(await readBody(request)) : null;
            const redirectTarget =
                url.searchParams.get("post_logout_redirect_uri") ??
                body?.get("post_logout_redirect_uri") ??
                null;
            if (redirectTarget !== null) {
                response.writeHead(302, { location: redirectTarget });
                response.end();
                return;
            }
            writeJson(response, 200, { status: "logged_out" });
            return;
        }
        if (method === "POST" && url.pathname === "/internal/backchannel/validate") {
            await this.handleBackchannelValidation(request, response);
            return;
        }
        if (method === "GET" && url.pathname.startsWith("/internal/users/")) {
            this.handleInternalUser(url, request, response);
            return;
        }
        writeJson(response, 404, { error: "not_found" });
    }

    private metadata(baseUrl: string): Record<string, unknown> {
        return {
            issuer: baseUrl,
            authorization_endpoint: `${baseUrl}/oauth/authorize`,
            token_endpoint: `${baseUrl}/oauth/token`,
            jwks_uri: `${baseUrl}/oauth/jwks`,
            revocation_endpoint: `${baseUrl}/oauth/revoke`,
            end_session_endpoint: `${baseUrl}/oauth/logout`,
            response_types_supported: ["code"],
            subject_types_supported: ["public"],
            id_token_signing_alg_values_supported: ["RS256"],
            scopes_supported: ["openid", "profile", "email", "offline_access", "nethack.access"],
            token_endpoint_auth_methods_supported: ["client_secret_basic"],
            claims_supported: [
                "sub",
                "iss",
                "aud",
                "exp",
                "iat",
                "nonce",
                "email",
                "name",
                "picture",
            ],
            code_challenge_methods_supported: ["S256"],
        };
    }

    private handleAuthorize(url: URL, response: ServerResponse): void {
        const params = url.searchParams;
        const clientId = params.get("client_id");
        const responseType = params.get("response_type");
        const redirectUri = params.get("redirect_uri");
        const scope = params.get("scope") ?? "";
        const state = params.get("state");
        const nonce = params.get("nonce");
        const codeChallenge = params.get("code_challenge");
        const codeChallengeMethod = params.get("code_challenge_method");

        if (clientId !== this.clientId) {
            writeJson(response, 400, { error: "invalid_client" });
            return;
        }
        if (responseType !== "code") {
            writeJson(response, 400, { error: "unsupported_response_type" });
            return;
        }
        if (redirectUri !== this.redirectUri) {
            writeJson(response, 400, { error: "invalid_redirect_uri" });
            return;
        }
        if (!scope.split(/\s+/).includes("openid")) {
            writeJson(response, 400, { error: "invalid_scope" });
            return;
        }
        if (state === null || state.length === 0 || nonce === null || nonce.length === 0) {
            writeJson(response, 400, { error: "invalid_request" });
            return;
        }
        if (
            codeChallenge === null ||
            codeChallenge.length === 0 ||
            codeChallengeMethod !== "S256"
        ) {
            writeJson(response, 400, {
                error: "invalid_request",
                error_description: "S256 PKCE is required.",
            });
            return;
        }

        if (this.errorMode !== null) {
            const target = new URL(this.redirectUri);
            target.searchParams.set("error", this.errorMode);
            target.searchParams.set("state", state);
            response.writeHead(302, { location: target.toString() });
            response.end();
            return;
        }

        const claims = this.pendingUser ?? this.defaultUser;
        this.pendingUser = null;
        const subject = claims.subject ?? this.subjectForClaims(claims);
        this.lastSubject = subject;

        const code = randomBytes(32).toString("base64url");
        this.authorizationCodes.set(code, {
            code,
            clientId,
            redirectUri,
            nonce,
            codeChallenge,
            scope,
            subject,
            claims,
            expiresAt: Date.now() + AUTHORIZATION_CODE_TTL_MS,
            used: false,
        });

        const target = new URL(this.redirectUri);
        target.searchParams.set("code", code);
        target.searchParams.set("state", state);
        response.writeHead(302, { location: target.toString() });
        response.end();
    }

    private subjectForClaims(claims: MockUserClaims): string {
        if (claims.email !== undefined) {
            const existing = [...this.authorizationCodes.values()].find(
                (record) => record.claims.email === claims.email,
            );
            if (existing !== undefined) {
                return existing.subject;
            }
        }
        return `oidc-${randomUUID()}`;
    }

    private async handleToken(request: IncomingMessage, response: ServerResponse): Promise<void> {
        const credentials = basicCredentials(request.headers.authorization);
        if (
            credentials === null ||
            !constantTimeEqual(credentials.clientId, this.clientId) ||
            !constantTimeEqual(credentials.clientSecret, this.clientSecret)
        ) {
            response.setHeader("www-authenticate", 'Basic realm="mock-oidc"');
            writeJson(response, 401, { error: "invalid_client" });
            return;
        }

        const form = new URLSearchParams(await readBody(request));
        const grantType = form.get("grant_type") ?? "";
        const input: TokenEndpointInput = {
            grantType,
            form,
            clientId: credentials.clientId,
            clientSecret: credentials.clientSecret,
        };

        if (this.forceInvalidGrant) {
            writeJson(response, 400, { error: "invalid_grant" });
            return;
        }

        if (grantType === "authorization_code") {
            await this.handleCodeExchange(input, response);
            return;
        }
        if (grantType === "refresh_token") {
            await this.handleRefreshGrant(input, response);
            return;
        }
        writeJson(response, 400, { error: "unsupported_grant_type" });
    }

    private async handleCodeExchange(
        input: TokenEndpointInput,
        response: ServerResponse,
    ): Promise<void> {
        if (this.rejectCodeExchange) {
            writeJson(response, 400, { error: "invalid_grant" });
            return;
        }
        const code = input.form.get("code");
        const verifier = input.form.get("code_verifier");
        const redirectUri = input.form.get("redirect_uri");
        if (code === null || verifier === null) {
            writeJson(response, 400, { error: "invalid_request" });
            return;
        }
        const record = this.authorizationCodes.get(code);
        if (
            record === undefined ||
            record.used ||
            record.expiresAt <= Date.now() ||
            record.clientId !== input.clientId ||
            (redirectUri !== null && redirectUri !== record.redirectUri)
        ) {
            writeJson(response, 400, { error: "invalid_grant" });
            return;
        }
        const challenge = createHash("sha256").update(verifier, "utf8").digest("base64url");
        if (challenge !== record.codeChallenge) {
            writeJson(response, 400, { error: "invalid_grant" });
            return;
        }
        record.used = true;

        const tokens = await this.issueTokens({
            subject: record.subject,
            claims: record.claims,
            scope: record.scope,
            nonce: this.wrongNonce ? `wrong-${record.nonce}` : record.nonce,
            includeRefreshToken: true,
        });
        writeJson(response, 200, tokens);
    }

    private async handleRefreshGrant(
        input: TokenEndpointInput,
        response: ServerResponse,
    ): Promise<void> {
        const token = input.form.get("refresh_token");
        if (token === null) {
            writeJson(response, 400, { error: "invalid_request" });
            return;
        }
        const record = this.refreshTokens.get(token);
        if (record === undefined) {
            writeJson(response, 400, { error: "invalid_grant" });
            return;
        }
        if (record.used || record.revoked || record.expiresAt <= Date.now()) {
            this.revokeFamily(record.familyId);
            writeJson(response, 400, { error: "invalid_grant" });
            return;
        }
        record.used = true;

        const tokens = await this.issueTokens({
            subject: record.subject,
            claims: record.claims,
            scope: record.scope,
            nonce: null,
            includeRefreshToken: true,
            familyId: record.familyId,
        });
        writeJson(response, 200, tokens);
    }

    private async issueTokens(input: {
        readonly subject: string;
        readonly claims: MockUserClaims;
        readonly scope: string;
        readonly nonce: string | null;
        readonly includeRefreshToken: boolean;
        readonly familyId?: string;
    }): Promise<Record<string, unknown>> {
        const key = this.requirePrivateKey();
        const issuedAt = Math.floor(Date.now() / 1000);
        const accessExpiresAt = issuedAt + this.accessTokenTtlSeconds;
        const idExpiresAt = issuedAt + ID_TOKEN_TTL_SECONDS;
        const accessTokenJti = randomUUID();

        const accessToken = await new SignJWT({
            client_id: this.clientId,
            scope: input.scope,
            permissions: ["nethack.access"],
        })
            .setProtectedHeader({ alg: "RS256", typ: "at+jwt", kid: this.kid })
            .setIssuer(this.issuer)
            .setAudience(this.resource)
            .setSubject(input.subject)
            .setJti(accessTokenJti)
            .setIssuedAt(issuedAt)
            .setExpirationTime(accessExpiresAt)
            .sign(key);

        const idClaims: Record<string, unknown> = {
            ...(input.claims.email === undefined ? {} : { email: input.claims.email }),
            ...(input.claims.name === undefined ? {} : { name: input.claims.name }),
            ...(input.claims.picture === undefined ? {} : { picture: input.claims.picture }),
            ...(input.nonce === null ? {} : { nonce: input.nonce }),
        };
        const idToken = await new SignJWT(idClaims)
            .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: this.kid })
            .setIssuer(this.issuer)
            .setAudience(this.clientId)
            .setSubject(input.subject)
            .setIssuedAt(issuedAt)
            .setExpirationTime(idExpiresAt)
            .sign(key);

        let refreshToken: string | null = null;
        if (input.includeRefreshToken) {
            refreshToken = randomBytes(32).toString("base64url");
            this.refreshTokens.set(refreshToken, {
                token: refreshToken,
                familyId: input.familyId ?? randomUUID(),
                subject: input.subject,
                claims: input.claims,
                scope: input.scope,
                expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
                used: false,
                revoked: false,
            });
        }

        this.issuedTokens.push({
            accessToken,
            accessTokenJti,
            idToken,
            refreshToken,
            subject: input.subject,
            email: input.claims.email ?? null,
            scope: input.scope,
            issuedAt,
        });

        return {
            access_token: accessToken,
            token_type: "Bearer",
            expires_in: this.accessTokenTtlSeconds,
            id_token: idToken,
            ...(refreshToken === null ? {} : { refresh_token: refreshToken }),
            scope: input.scope,
        };
    }

    private revokeFamily(familyId: string): void {
        for (const record of this.refreshTokens.values()) {
            if (record.familyId === familyId) {
                record.revoked = true;
            }
        }
    }

    private async handleRevoke(request: IncomingMessage, response: ServerResponse): Promise<void> {
        const form = new URLSearchParams(await readBody(request));
        const token = form.get("token");
        if (token === null) {
            writeJson(response, 400, { error: "invalid_request" });
            return;
        }
        const record = this.refreshTokens.get(token);
        if (record !== undefined) {
            record.revoked = true;
        }
        this.revokedTokens.push({
            token,
            tokenTypeHint: form.get("token_type_hint"),
            revokedAt: Date.now(),
        });
        writeJson(response, 200, {});
    }

    private async handleBackchannelValidation(
        request: IncomingMessage,
        response: ServerResponse,
    ): Promise<void> {
        if (!this.validResourceCredentials(request)) {
            writeJson(response, 401, { error: "unauthorized" });
            return;
        }
        const body = await readBody(request);
        let parsed: unknown;
        try {
            parsed = JSON.parse(body) as unknown;
        } catch {
            writeJson(response, 400, { error: "invalid_request" });
            return;
        }
        if (
            typeof parsed !== "object" ||
            parsed === null ||
            !("nonce" in parsed) ||
            !("challenge_hash" in parsed) ||
            typeof parsed.nonce !== "string" ||
            typeof parsed.challenge_hash !== "string"
        ) {
            writeJson(response, 400, { error: "invalid_request" });
            return;
        }
        if (
            !/^[A-Za-z0-9_-]{43}$/.test(parsed.nonce) ||
            !/^[a-f0-9]{64}$/.test(parsed.challenge_hash)
        ) {
            writeJson(response, 400, { error: "invalid_request" });
            return;
        }
        const challenge = this.expectedChallenges.get(parsed.nonce);
        if (challenge !== undefined) {
            const expected = createHmac("sha256", this.resourceSecret)
                .update(challenge, "utf8")
                .digest("hex");
            if (!constantTimeEqual(expected, parsed.challenge_hash)) {
                writeJson(response, 400, { error: "invalid_request" });
                return;
            }
        }
        this.backchannelValidations.push({
            authorization: headerValue(request.headers.authorization),
            resourceHeader: headerValue(request.headers["x-basis-resource"]),
            nonce: parsed.nonce,
            challengeHash: parsed.challenge_hash,
            receivedAt: Date.now(),
        });
        writeJson(response, 200, { status: "successful" });
    }

    private handleInternalUser(url: URL, request: IncomingMessage, response: ServerResponse): void {
        if (!this.validResourceCredentials(request)) {
            writeJson(response, 401, { error: "unauthorized" });
            return;
        }
        const subject = decodeURIComponent(url.pathname.slice("/internal/users/".length));
        if (subject.length === 0) {
            writeJson(response, 404, { error: "not_found" });
            return;
        }
        writeJson(response, 200, { disabled: false, tokensValidAfter: null });
    }

    private validResourceCredentials(request: IncomingMessage): boolean {
        const authorization = request.headers.authorization;
        if (authorization === undefined || !authorization.startsWith("Bearer ")) {
            return false;
        }
        const secret = authorization.slice("Bearer ".length);
        if (!constantTimeEqual(secret, this.resourceSecret)) {
            return false;
        }
        const resourceHeader = request.headers["x-basis-resource"];
        const value = Array.isArray(resourceHeader) ? resourceHeader[0] : resourceHeader;
        return value === encodeURIComponent(this.resource) || value === this.resource;
    }
}

function basicCredentials(
    header: string | undefined,
): { clientId: string; clientSecret: string } | null {
    if (header === undefined || !header.startsWith("Basic ")) {
        return null;
    }
    const decoded = Buffer.from(header.slice("Basic ".length), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator <= 0) {
        return null;
    }
    return {
        clientId: formUrlDecode(decoded.slice(0, separator)),
        clientSecret: formUrlDecode(decoded.slice(separator + 1)),
    };
}

function formUrlDecode(value: string): string {
    return decodeURIComponent(value.replace(/\+/g, " "));
}

function constantTimeEqual(left: string, right: string): boolean {
    const a = Buffer.from(left, "utf8");
    const b = Buffer.from(right, "utf8");
    if (a.length !== b.length) {
        return false;
    }
    return timingSafeEqual(a, b);
}

function headerValue(value: string | string[] | undefined): string | null {
    if (value === undefined) {
        return null;
    }
    return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function readBody(request: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of request as AsyncIterable<Buffer>) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString("utf8");
}

function writeJson(response: ServerResponse, status: number, body: unknown): void {
    response.writeHead(status, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        pragma: "no-cache",
    });
    response.end(JSON.stringify(body));
}

async function listen(server: Server): Promise<number> {
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            server.off("error", reject);
            resolve();
        });
    });
    const address = server.address();
    if (address === null || typeof address === "string") {
        throw new Error("The mock provider did not bind to a TCP port.");
    }
    return address.port;
}

function generateTlsMaterial(): { directory: string; key: Buffer; cert: Buffer } | null {
    const directory = mkdtempSync(join(tmpdir(), "nethack-oidc-tls-"));
    const keyPath = join(directory, "key.pem");
    const certPath = join(directory, "cert.pem");
    try {
        execFileSync(
            "openssl",
            [
                "req",
                "-x509",
                "-newkey",
                "rsa:2048",
                "-nodes",
                "-keyout",
                keyPath,
                "-out",
                certPath,
                "-days",
                "1",
                "-subj",
                "/CN=localhost",
                "-addext",
                "subjectAltName=DNS:localhost,IP:127.0.0.1",
            ],
            { stdio: "ignore" },
        );
        return {
            directory,
            key: readFileSync(keyPath),
            cert: readFileSync(certPath),
        };
    } catch {
        rmSync(directory, { recursive: true, force: true });
        return null;
    }
}
