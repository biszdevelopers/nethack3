import { and, eq, isNull, lt, sql } from "drizzle-orm";
import type { AppConfig } from "../core/configuration.js";
import type { Clock } from "../core/clock.js";
import type { Logger } from "../core/logger.js";
import type { DatabaseConnection } from "../infrastructure/database/client.js";
import { sessions } from "../infrastructure/database/schema/index.js";
import type { BasisAuthClient } from "./basis-auth-client.js";
import { decryptSecret, encryptSecret } from "./crypto.js";

export class TokenService {
    private readonly database: DatabaseConnection;
    private readonly config: AppConfig;
    private readonly authClient: BasisAuthClient;
    private readonly clock: Clock;
    private readonly logger: Logger;

    constructor(
        database: DatabaseConnection,
        config: AppConfig,
        authClient: BasisAuthClient,
        clock: Clock,
        logger: Logger,
    ) {
        this.database = database;
        this.config = config;
        this.authClient = authClient;
        this.clock = clock;
        this.logger = logger.child({ component: "tokens" });
    }

    /**
     * Serialized refresh. The session row lock ensures two concurrent requests
     * cannot consume the same rotating refresh token. Waiting work re-reads the
     * row after acquiring the lock and skips the exchange when the access token
     * is already fresh.
     */
    async refreshSession(sessionId: string): Promise<void> {
        await this.database.transaction({}, async (session) => {
            const rows = await session.db
                .select()
                .from(sessions)
                .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)))
                .limit(1)
                .for("update");
            const row = rows[0];
            if (row === undefined) {
                return;
            }
            const now = this.clock.now();
            if (row.expiresAt <= now) {
                await session.db
                    .update(sessions)
                    .set({ revokedAt: now, revokedReason: "session_expired" })
                    .where(eq(sessions.id, sessionId));
                return;
            }
            if (
                row.accessTokenExpiresAt !== null &&
                row.accessTokenExpiresAt.getTime() - now.getTime() >
                    this.config.refreshSkewSeconds * 1000
            ) {
                return;
            }
            if (row.refreshTokenEncrypted === null) {
                return;
            }

            let refreshToken: string;
            try {
                refreshToken = decryptSecret(
                    row.refreshTokenEncrypted,
                    this.config.session.encryptionKeys,
                );
            } catch (error) {
                this.logger.error("Stored refresh token could not be decrypted.", {
                    sessionId,
                });
                await session.db
                    .update(sessions)
                    .set({ revokedAt: now, revokedReason: "refresh_token_unreadable" })
                    .where(eq(sessions.id, sessionId));
                void error;
                return;
            }

            try {
                const result = await this.authClient.refresh(refreshToken);
                const access = encryptSecret(
                    result.accessToken,
                    this.config.session.encryptionKeys,
                );
                const nextRefresh =
                    result.refreshToken === null
                        ? null
                        : encryptSecret(result.refreshToken, this.config.session.encryptionKeys);
                await session.db
                    .update(sessions)
                    .set({
                        accessTokenEncrypted: access.ciphertext,
                        refreshTokenEncrypted: nextRefresh?.ciphertext ?? null,
                        tokenKeyVersion: access.keyVersion,
                        accessTokenExpiresAt: result.accessTokenExpiresAt,
                        refreshTokenExpiresAt:
                            result.refreshToken === null
                                ? null
                                : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
                        lastUsedAt: now,
                    })
                    .where(eq(sessions.id, sessionId));
            } catch (error) {
                if (isInvalidGrant(error)) {
                    this.logger.warn(
                        "Refresh token was rejected; the session must sign in again.",
                        {
                            sessionId,
                        },
                    );
                    await session.db
                        .update(sessions)
                        .set({
                            revokedAt: now,
                            revokedReason: "refresh_token_rejected",
                            refreshTokenEncrypted: null,
                        })
                        .where(eq(sessions.id, sessionId));
                    return;
                }
                this.logger.warn("Refresh attempt failed; it will be retried.", {
                    sessionId,
                    error: error instanceof Error ? error.message : "unknown",
                });
            }
        });
    }

    async findSessionsDueForRefresh(limit: number): Promise<readonly string[]> {
        const threshold = new Date(
            this.clock.now().getTime() + this.config.refreshSkewSeconds * 1000,
        );
        const rows = await this.database.db
            .select({ id: sessions.id })
            .from(sessions)
            .where(
                and(
                    isNull(sessions.revokedAt),
                    sql`${sessions.refreshTokenEncrypted} is not null`,
                    lt(sessions.accessTokenExpiresAt, threshold),
                ),
            )
            .limit(limit);
        return rows.map((row) => row.id);
    }
}

function isInvalidGrant(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "error" in error &&
        (error as { error?: unknown }).error === "invalid_grant"
    );
}
