import { eq, sql } from "drizzle-orm";
import type { AppConfig } from "../core/configuration.js";
import { InvalidTokenError } from "../core/errors.js";
import type { Logger } from "../core/logger.js";
import type { DatabaseConnection } from "../infrastructure/database/client.js";
import {
    externalIdentities,
    revokedAccessTokens,
    users,
} from "../infrastructure/database/schema/index.js";
import type { BasisAuthClient, AccessTokenClaims } from "./basis-auth-client.js";
import type { SessionService } from "./session-service.js";
import type { AuthContext } from "./types.js";

export type { AccessTokenClaims };

export class BearerAuthenticator {
    private readonly config: AppConfig;
    private readonly database: DatabaseConnection;
    private readonly authClient: BasisAuthClient;
    private readonly sessions: SessionService;
    private readonly logger: Logger;

    constructor(
        config: AppConfig,
        database: DatabaseConnection,
        authClient: BasisAuthClient,
        sessions: SessionService,
        logger: Logger,
    ) {
        this.config = config;
        this.database = database;
        this.authClient = authClient;
        this.sessions = sessions;
        this.logger = logger.child({ component: "bearer-auth" });
    }

    async authenticate(token: string): Promise<AuthContext | null> {
        if (token.length < 32 || token.length > 8192) {
            return null;
        }
        let claims: AccessTokenClaims;
        try {
            claims = await this.authClient.verifyAccessToken(token);
        } catch (error) {
            this.logger.warn("Bearer access token rejected.", {
                error: error instanceof Error ? error.message : "unknown",
            });
            return null;
        }

        const denied = await this.database.db
            .select({ jti: revokedAccessTokens.jti, validAfter: revokedAccessTokens.validAfter })
            .from(revokedAccessTokens)
            .where(eq(revokedAccessTokens.jti, claims.jti))
            .limit(1);
        const denial = denied[0];
        if (
            denial !== undefined &&
            claims.issuedAt >= Math.floor(denial.validAfter.getTime() / 1000)
        ) {
            return null;
        }

        if (this.config.basisAuth.internalUrl !== null) {
            const state = await this.authClient.fetchInternalUserState(claims.subject);
            if (state === null) {
                return null;
            }
            if (state.disabled) {
                return null;
            }
            if (state.tokensValidAfter !== null && claims.issuedAt <= state.tokensValidAfter) {
                return null;
            }
        }

        const rows = await this.database.db
            .select({ user: users })
            .from(externalIdentities)
            .innerJoin(users, eq(users.id, externalIdentities.userId))
            .where(
                sql`${externalIdentities.issuer} = ${this.config.basisAuth.issuer} and ${externalIdentities.subject} = ${claims.subject}`,
            )
            .limit(1);
        const user = rows[0]?.user;
        if (user === undefined || user.status !== "active") {
            return null;
        }

        const memberships = await this.sessions.loadMemberships(user.id);
        return {
            method: "bearer",
            sessionId: null,
            sessionTokenHash: null,
            csrfToken: null,
            csrfHash: null,
            user,
            memberships,
            globalAdministrator: await this.sessions.isGlobalAdministrator(user.id),
            permissions: claims.permissions,
            expiresAt: new Date(claims.expiresAt * 1000),
        };
    }
}

export function extractBearerToken(header: string | undefined): string | null {
    if (header === undefined) {
        return null;
    }
    const match = /^Bearer ([A-Za-z0-9._~+/-]+=*)$/.exec(header);
    return match?.[1] ?? null;
}

export function assertAccessTokenClaims(claims: AccessTokenClaims): void {
    if (claims.subject.length === 0) {
        throw new InvalidTokenError();
    }
}
