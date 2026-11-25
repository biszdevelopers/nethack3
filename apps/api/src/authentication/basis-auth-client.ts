import { createRemoteJWKSet, jwtVerify, type JWTPayload, type RemoteJWKSet } from "jose";
import { z } from "zod";
import {
    allowInsecureRequests,
    authorizationCodeGrant,
    buildAuthorizationUrl,
    buildEndSessionUrl,
    ClientSecretBasic,
    discovery,
    randomNonce,
    randomPKCECodeVerifier,
    randomState,
    refreshTokenGrant,
    tokenRevocation,
    calculatePKCECodeChallenge,
    type Configuration,
    type TokenEndpointResponse,
    type TokenEndpointResponseHelpers,
} from "openid-client";
import type { AppConfig } from "../core/configuration.js";
import { ExternalDependencyError, InvalidTokenError } from "../core/errors.js";
import type { Logger } from "../core/logger.js";

export interface IdTokenClaims {
    readonly subject: string;
    readonly email: string | null;
    readonly name: string | null;
    readonly pictureUrl: string | null;
}

export interface TokenResult {
    readonly accessToken: string;
    readonly refreshToken: string | null;
    readonly accessTokenExpiresAt: Date;
    readonly claims: IdTokenClaims;
}

export interface BackchannelLogoutClaims {
    readonly subject: string;
    readonly tokenId: string | null;
    readonly issuedAt: number;
}

export interface BackchannelRevocationClaims {
    readonly accessTokenJti: string;
    readonly validAfter: number;
    readonly accessTokenExpiresAt: number | null;
}

export interface AccessTokenClaims {
    readonly subject: string;
    readonly jti: string;
    readonly issuedAt: number;
    readonly expiresAt: number;
    readonly scope: string;
    readonly permissions: readonly string[];
}

export interface InternalUserState {
    readonly disabled: boolean;
    readonly tokensValidAfter: number | null;
}

const internalUserStateSchema = z.object({
    disabled: z.boolean(),
    tokensValidAfter: z.number().nullable(),
});

const DISCOVERY_TTL_MS = 5 * 60 * 1000;
const BACKCHANNEL_EVENT_CLAIM = "http://schemas.openid.net/event/backchannel-logout";

export class BasisAuthClient {
    private readonly config: AppConfig["basisAuth"];
    private readonly maxBackchannelTokenAgeSeconds: number;
    private readonly logger: Logger;
    private configuration: Configuration | null = null;
    private configurationExpiresAt = 0;
    private discoveryInFlight: Promise<Configuration> | null = null;
    private jwks: RemoteJWKSet | null = null;

    constructor(
        config: AppConfig["basisAuth"],
        maxBackchannelTokenAgeSeconds: number,
        logger: Logger,
    ) {
        this.config = config;
        this.maxBackchannelTokenAgeSeconds = maxBackchannelTokenAgeSeconds;
        this.logger = logger.child({ component: "basis-auth" });
    }

    async getConfiguration(): Promise<Configuration> {
        if (this.configuration !== null && Date.now() < this.configurationExpiresAt) {
            return this.configuration;
        }
        if (this.discoveryInFlight !== null) {
            return this.discoveryInFlight;
        }
        this.discoveryInFlight = this.performDiscovery();
        try {
            return await this.discoveryInFlight;
        } finally {
            this.discoveryInFlight = null;
        }
    }

    private async performDiscovery(): Promise<Configuration> {
        try {
            const configuration = await discovery(
                new URL(this.config.issuer),
                this.config.clientId,
                undefined,
                ClientSecretBasic(this.config.clientSecret),
            );
            if (this.config.allowInsecureHttp) {
                allowInsecureRequests(configuration);
            }
            if (configuration.serverMetadata().issuer !== this.config.issuer) {
                throw new ExternalDependencyError("The identity provider issuer does not match.");
            }
            this.configuration = configuration;
            this.configurationExpiresAt = Date.now() + DISCOVERY_TTL_MS;
            this.jwks = null;
            return configuration;
        } catch (error) {
            this.logger.error("OIDC discovery failed.", { error: describeError(error) });
            throw new ExternalDependencyError("Sign-in is temporarily unavailable.", error);
        }
    }

    async createAuthorizationUrl(): Promise<{
        url: URL;
        state: string;
        nonce: string;
        codeVerifier: string;
        expiresAt: Date;
    }> {
        const configuration = await this.getConfiguration();
        const state = randomState();
        const nonce = randomNonce();
        const codeVerifier = randomPKCECodeVerifier();
        const codeChallenge = await calculatePKCECodeChallenge(codeVerifier);
        const url = buildAuthorizationUrl(configuration, {
            redirect_uri: this.config.redirectUri,
            response_type: "code",
            scope: this.config.scopes,
            resource: this.config.resource,
            state,
            nonce,
            code_challenge: codeChallenge,
            code_challenge_method: "S256",
        });
        return {
            url,
            state,
            nonce,
            codeVerifier,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        };
    }

    async exchangeCode(
        currentUrl: URL,
        options: { expectedState: string; expectedNonce: string; codeVerifier: string },
    ): Promise<TokenResult> {
        const configuration = await this.getConfiguration();
        try {
            const response = await authorizationCodeGrant(configuration, currentUrl, {
                expectedState: options.expectedState,
                expectedNonce: options.expectedNonce,
                pkceCodeVerifier: options.codeVerifier,
                idTokenExpected: true,
            });
            return toTokenResult(response);
        } catch (error) {
            this.logger.warn("Authorization code exchange failed.", { error: describeError(error) });
            throw new ExternalDependencyError("Sign-in could not be completed.", error);
        }
    }

    async refresh(refreshToken: string): Promise<TokenResult> {
        const configuration = await this.getConfiguration();
        const response = await refreshTokenGrant(configuration, refreshToken, {
            resource: this.config.resource,
        });
        return toTokenResult(response);
    }

    async revoke(token: string, hint: "refresh_token" | "access_token"): Promise<void> {
        const configuration = await this.getConfiguration();
        await tokenRevocation(configuration, token, { token_type_hint: hint });
    }

    async endSessionUrl(): Promise<string> {
        const configuration = await this.getConfiguration();
        return buildEndSessionUrl(configuration, {
            post_logout_redirect_uri: this.config.postLogoutRedirectUri,
        }).toString();
    }

    private async getJwks(): Promise<RemoteJWKSet> {
        if (this.jwks !== null) {
            return this.jwks;
        }
        const configuration = await this.getConfiguration();
        const metadata = configuration.serverMetadata();
        if (metadata.jwks_uri === undefined) {
            throw new ExternalDependencyError("The identity provider does not publish a JWKS URI.");
        }
        this.jwks = createRemoteJWKSet(new URL(metadata.jwks_uri));
        return this.jwks;
    }

    async verifyLogoutToken(token: string): Promise<BackchannelLogoutClaims> {
        const payload = await this.verifyBackchannelJwt(token, "logout+jwt");
        const event = payload[BACKCHANNEL_EVENT_CLAIM];
        if (event === null || typeof event !== "object" || payload.sub === undefined) {
            throw new InvalidTokenError();
        }
        return {
            subject: payload.sub,
            tokenId: typeof payload.jti === "string" ? payload.jti : null,
            issuedAt: typeof payload.iat === "number" ? payload.iat : 0,
        };
    }

    async verifyRevocationToken(token: string): Promise<BackchannelRevocationClaims> {
        const payload = await this.verifyBackchannelJwt(token, "at-revocation+jwt");
        const jti = payload.access_token_jti;
        const validAfter = payload.valid_after;
        const expires = payload.access_token_expires_at;
        if (typeof jti !== "string" || typeof validAfter !== "number") {
            throw new InvalidTokenError();
        }
        return {
            accessTokenJti: jti,
            validAfter,
            accessTokenExpiresAt: typeof expires === "number" ? expires : null,
        };
    }

    async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
        if (token.length > 8192) {
            throw new InvalidTokenError();
        }
        const jwks = await this.getJwks();
        const { payload } = await jwtVerify(token, jwks, {
            issuer: this.config.issuer,
            audience: this.config.resource,
            algorithms: ["RS256"],
            typ: "at+jwt",
            clockTolerance: 5,
        });
        if (
            typeof payload.sub !== "string" ||
            typeof payload.jti !== "string" ||
            typeof payload.iat !== "number" ||
            typeof payload.exp !== "number"
        ) {
            throw new InvalidTokenError();
        }
        const permissions = Array.isArray(payload.permissions)
            ? payload.permissions.filter((entry): entry is string => typeof entry === "string")
            : [];
        return {
            subject: payload.sub,
            jti: payload.jti,
            issuedAt: payload.iat,
            expiresAt: payload.exp,
            scope: typeof payload.scope === "string" ? payload.scope : "",
            permissions: Object.freeze(permissions),
        };
    }

    async fetchInternalUserState(subject: string): Promise<InternalUserState | null> {
        if (this.config.internalUrl === null) {
            return null;
        }
        try {
            const url = new URL(
                `/internal/users/${encodeURIComponent(subject)}`,
                this.config.internalUrl,
            );
            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${this.config.resourceSecret}`,
                    "X-Basis-Resource": encodeURIComponent(this.config.resource),
                    Accept: "application/json",
                },
                signal: AbortSignal.timeout(5000),
            });
            if (!response.ok) {
                this.logger.warn("Internal identity state lookup failed.", {
                    status: response.status,
                });
                return null;
            }
            const body: unknown = await response.json();
            const parsed = internalUserStateSchema.safeParse(body);
            return parsed.success ? parsed.data : null;
        } catch (error) {
            this.logger.warn("Internal identity state lookup errored.", {
                error: describeError(error),
            });
            return null;
        }
    }

    private async verifyBackchannelJwt(token: string, typ: string): Promise<JWTPayload> {
        if (token.length > 8192) {
            throw new InvalidTokenError();
        }
        try {
            const jwks = await this.getJwks();
            const { payload } = await jwtVerify(token, jwks, {
                issuer: this.config.issuer,
                audience: this.config.resource,
                algorithms: ["RS256"],
                typ,
                clockTolerance: 5,
                maxTokenAge: `${this.maxBackchannelTokenAgeSeconds}s`,
            });
            return payload;
        } catch (error) {
            this.logger.warn("Backchannel token validation failed.", { error: describeError(error) });
            throw new InvalidTokenError();
        }
    }
}

function toTokenResult(
    response: TokenEndpointResponse & TokenEndpointResponseHelpers,
): TokenResult {
    const claims = response.claims();
    if (claims === undefined) {
        throw new ExternalDependencyError("The identity provider returned no ID token.");
    }
    if (claims.sub === undefined) {
        throw new ExternalDependencyError("The identity provider returned no subject.");
    }
    const expiresIn = response.expires_in ?? 3600;
    const email = typeof claims.email === "string" ? claims.email.toLowerCase() : null;
    const name =
        typeof claims.name === "string"
            ? claims.name
            : typeof claims.preferred_username === "string"
              ? claims.preferred_username
              : null;
    const picture = typeof claims.picture === "string" ? claims.picture : null;
    return {
        accessToken: response.access_token,
        refreshToken: response.refresh_token ?? null,
        accessTokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
        claims: {
            subject: claims.sub,
            email,
            name,
            pictureUrl: picture,
        },
    };
}

function describeError(error: unknown): string {
    if (error instanceof Error) {
        return `${error.name}: ${error.message}`;
    }
    return "Unknown error";
}
