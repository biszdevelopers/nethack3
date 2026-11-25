import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type { AppConfig } from "../core/configuration.js";
import type { Clock } from "../core/clock.js";
import type { Logger } from "../core/logger.js";
import type { DatabaseConnection } from "../infrastructure/database/client.js";
import {
    globalAdministrators,
    organizationMemberships,
    organizations,
    sessions,
    users,
} from "../infrastructure/database/schema/index.js";
import { deriveCsrfToken, decryptSecret, encryptSecret, hashIp, randomToken, sha256Hex } from "./crypto.js";
import type { AuthContext, RequestMetadata, SessionCreationResult, SessionMembership } from "./types.js";
import type { TokenResult } from "./basis-auth-client.js";

export interface SessionTokens {
    readonly accessToken: string;
    readonly refreshToken: string | null;
    readonly accessTokenExpiresAt: Date;
}

export class SessionService {
    private readonly database: DatabaseConnection;
    private readonly config: AppConfig;
    private readonly clock: Clock;
    private readonly logger: Logger;

    constructor(
        database: DatabaseConnection,
        config: AppConfig,
        clock: Clock,
        logger: Logger,
    ) {
        this.database = database;
        this.config = config;
        this.clock = clock;
        this.logger = logger.child({ component: "sessions" });
    }

    async create(
        userId: string,
        tokens: TokenResult,
        metadata: RequestMetadata,
    ): Promise<SessionCreationResult> {
        const sessionToken = randomToken(32);
        const sessionTokenHash = sha256Hex(sessionToken);
        const currentKey = this.config.session.encryptionKeys[0];
        if (currentKey === undefined) {
            throw new Error("No session encryption key configured.");
        }
        const csrfToken = deriveCsrfToken(sessionToken, currentKey.key);
        const access = encryptSecret(tokens.accessToken, this.config.session.encryptionKeys);
        const refresh =
            tokens.refreshToken === null
                ? null
                : encryptSecret(tokens.refreshToken, this.config.session.encryptionKeys);
        const now = this.clock.now();
        const expiresAt = new Date(now.getTime() + this.config.session.ttlSeconds * 1000);
        const refreshExpiresAt =
            tokens.refreshToken === null ? null : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const primaryKey = currentKey.key;

        const created = await this.database.db
            .insert(sessions)
            .values({
                userId,
                tokenHash: sessionTokenHash,
                csrfHash: sha256Hex(csrfToken),
                accessTokenEncrypted: access.ciphertext,
                refreshTokenEncrypted: refresh?.ciphertext ?? null,
                tokenKeyVersion: access.keyVersion,
                accessTokenExpiresAt: tokens.accessTokenExpiresAt,
                refreshTokenExpiresAt: refreshExpiresAt,
                ipHash: hashIp(metadata.ip, primaryKey),
                userAgent: metadata.userAgent.slice(0, 400),
                expiresAt,
            })
            .returning({ id: sessions.id });

        const sessionId = created[0]?.id;
        if (sessionId === undefined) {
            throw new Error("The application session could not be created.");
        }

        return {
            sessionId,
            sessionToken,
            csrfToken,
            expiresAt,
        };
    }

    async resolve(sessionToken: string, metadata: RequestMetadata): Promise<AuthContext | null> {
        const sessionTokenHash = sha256Hex(sessionToken);
        const now = this.clock.now();
        const rows = await this.database.db
            .select({
                session: sessions,
                user: users,
            })
            .from(sessions)
            .innerJoin(users, eq(users.id, sessions.userId))
            .where(
                and(
                    eq(sessions.tokenHash, sessionTokenHash),
                    isNull(sessions.revokedAt),
                    gt(sessions.expiresAt, now),
                ),
            )
            .limit(1);

        const row = rows[0];
        if (row === undefined) {
            return null;
        }
        if (row.user.status !== "active") {
            await this.revoke(row.session.id, "account_disabled");
            return null;
        }

        const memberships = await this.loadMemberships(row.user.id);
        const administrator = await this.isGlobalAdministrator(row.user.id);
        const currentKey = this.config.session.encryptionKeys[0];
        const csrfToken =
            currentKey === undefined ? null : deriveCsrfToken(sessionToken, currentKey.key);

        if (now.getTime() - row.session.lastUsedAt.getTime() > 60_000) {
            await this.database.db
                .update(sessions)
                .set({ lastUsedAt: now })
                .where(eq(sessions.id, row.session.id));
        }

        return {
            method: "session",
            sessionId: row.session.id,
            sessionTokenHash,
            csrfToken,
            csrfHash: row.session.csrfHash,
            user: row.user,
            memberships,
            globalAdministrator: administrator,
            permissions: [],
            expiresAt: row.session.expiresAt,
        };
    }

    async loadMemberships(userId: string): Promise<readonly SessionMembership[]> {
        const rows = await this.database.db
            .select({
                organizationId: organizationMemberships.organizationId,
                role: organizationMemberships.role,
                status: organizationMemberships.status,
                organizationName: organizations.name,
                organizationSlug: organizations.slug,
            })
            .from(organizationMemberships)
            .innerJoin(organizations, eq(organizations.id, organizationMemberships.organizationId))
            .where(eq(organizationMemberships.userId, userId));

        return rows.map((row) => ({
            organizationId: row.organizationId,
            organizationName: row.organizationName,
            organizationSlug: row.organizationSlug,
            role: row.role,
            status: row.status,
        }));
    }

    async isGlobalAdministrator(userId: string): Promise<boolean> {
        const rows = await this.database.db
            .select({ userId: globalAdministrators.userId })
            .from(globalAdministrators)
            .where(eq(globalAdministrators.userId, userId))
            .limit(1);
        return rows.length > 0;
    }

    async revoke(sessionId: string, reason: string): Promise<void> {
        await this.database.db
            .update(sessions)
            .set({ revokedAt: this.clock.now(), revokedReason: reason })
            .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
    }

    async revokeByToken(sessionToken: string, reason: string): Promise<void> {
        await this.database.db
            .update(sessions)
            .set({ revokedAt: this.clock.now(), revokedReason: reason })
            .where(
                and(eq(sessions.tokenHash, sha256Hex(sessionToken)), isNull(sessions.revokedAt)),
            );
    }

    async revokeAllForUser(userId: string, reason: string): Promise<number> {
        const result = await this.database.db
            .update(sessions)
            .set({ revokedAt: this.clock.now(), revokedReason: reason })
            .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)))
            .returning({ id: sessions.id });
        return result.length;
    }

    async markTokenRefreshed(
        sessionId: string,
        accessToken: string,
        refreshToken: string | null,
        accessTokenExpiresAt: Date,
        refreshTokenExpiresAt: Date | null,
    ): Promise<void> {
        const access = encryptSecret(accessToken, this.config.session.encryptionKeys);
        const refresh =
            refreshToken === null
                ? null
                : encryptSecret(refreshToken, this.config.session.encryptionKeys);
        await this.database.db
            .update(sessions)
            .set({
                accessTokenEncrypted: access.ciphertext,
                refreshTokenEncrypted: refresh?.ciphertext ?? null,
                tokenKeyVersion: access.keyVersion,
                accessTokenExpiresAt,
                refreshTokenExpiresAt,
                lastUsedAt: this.clock.now(),
            })
            .where(eq(sessions.id, sessionId));
    }

    async readTokens(sessionId: string): Promise<SessionTokens | null> {
        const rows = await this.database.db
            .select({
                accessTokenEncrypted: sessions.accessTokenEncrypted,
                refreshTokenEncrypted: sessions.refreshTokenEncrypted,
                accessTokenExpiresAt: sessions.accessTokenExpiresAt,
                revokedAt: sessions.revokedAt,
            })
            .from(sessions)
            .where(eq(sessions.id, sessionId))
            .limit(1);
        const row = rows[0];
        if (
            row === undefined ||
            row.revokedAt !== null ||
            row.accessTokenEncrypted === null ||
            row.accessTokenExpiresAt === null
        ) {
            return null;
        }
        return {
            accessToken: decryptSecret(row.accessTokenEncrypted, this.config.session.encryptionKeys),
            refreshToken:
                row.refreshTokenEncrypted === null
                    ? null
                    : decryptSecret(row.refreshTokenEncrypted, this.config.session.encryptionKeys),
            accessTokenExpiresAt: row.accessTokenExpiresAt,
        };
    }

    async pruneExpired(before: Date): Promise<number> {
        const result = await this.database.db.execute(sql`
            delete from sessions
            where revoked_at is not null and revoked_at < ${before}
        `);
        return result.rowCount ?? 0;
    }

    cookieOptions(): {
        httpOnly: boolean;
        secure: boolean;
        sameSite: "lax";
        path: string;
        maxAge: number;
    } {
        return {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            path: "/",
            maxAge: this.config.session.ttlSeconds,
        };
    }

    logSecurityEvent(message: string, context: Record<string, unknown>): void {
        this.logger.warn(message, context);
    }
}
