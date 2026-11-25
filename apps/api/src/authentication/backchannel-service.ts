import { createHmac } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { AppConfig } from "../core/configuration.js";
import type { Clock } from "../core/clock.js";
import { InvalidTokenError } from "../core/errors.js";
import type { Logger } from "../core/logger.js";
import type { DatabaseConnection } from "../infrastructure/database/client.js";
import {
    backchannelEvents,
    externalIdentities,
    revokedAccessTokens,
} from "../infrastructure/database/schema/index.js";
import type { BasisAuthClient } from "./basis-auth-client.js";
import { sha256Hex } from "./crypto.js";
import type { SessionService } from "./session-service.js";

const BASE64URL_43 = /^[A-Za-z0-9_-]{43}$/;

export class BackchannelService {
    private readonly config: AppConfig;
    private readonly database: DatabaseConnection;
    private readonly authClient: BasisAuthClient;
    private readonly sessions: SessionService;
    private readonly clock: Clock;
    private readonly logger: Logger;
    private readonly fetchImpl: typeof fetch;

    constructor(
        config: AppConfig,
        database: DatabaseConnection,
        authClient: BasisAuthClient,
        sessions: SessionService,
        clock: Clock,
        logger: Logger,
        fetchImpl: typeof fetch = fetch,
    ) {
        this.config = config;
        this.database = database;
        this.authClient = authClient;
        this.sessions = sessions;
        this.clock = clock;
        this.logger = logger.child({ component: "backchannel" });
        this.fetchImpl = fetchImpl;
    }

    async handle(form: URLSearchParams): Promise<number> {
        const action = form.get("action");
        if (action === "test") {
            return this.handleTest(form);
        }
        if (action === "revoke_access_token") {
            return this.handleRevocation(form);
        }
        const logoutToken = form.get("logout_token");
        if (logoutToken !== null) {
            return this.handleLogout(logoutToken);
        }
        return 400;
    }

    private async handleTest(form: URLSearchParams): Promise<number> {
        const nonce = form.get("nonce");
        const challenge = form.get("challenge");
        if (nonce === null || challenge === null) {
            return 400;
        }
        if (!BASE64URL_43.test(nonce) || !BASE64URL_43.test(challenge)) {
            return 400;
        }

        if (this.config.basisAuth.internalUrl === null) {
            this.logger.warn(
                "Backchannel test received but BASIS_AUTH_INTERNAL_URL is not configured; proof cannot be delivered.",
            );
            return 202;
        }

        const challengeHash = createHmac("sha256", this.config.basisAuth.resourceSecret)
            .update(challenge, "utf8")
            .digest("hex");

        try {
            const response = await this.fetchImpl(
                new URL("/internal/backchannel/validate", this.config.basisAuth.internalUrl),
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${this.config.basisAuth.resourceSecret}`,
                        "X-Basis-Resource": encodeURIComponent(this.config.basisAuth.resource),
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ nonce, challenge_hash: challengeHash }),
                    signal: AbortSignal.timeout(8000),
                },
            );
            if (!response.ok) {
                this.logger.warn("Backchannel webhook proof was rejected.", {
                    status: response.status,
                });
            }
        } catch (error) {
            this.logger.warn("Backchannel webhook proof delivery failed.", {
                error: error instanceof Error ? error.message : "unknown",
            });
        }
        return 202;
    }

    private async handleLogout(logoutToken: string): Promise<number> {
        let claims;
        try {
            claims = await this.authClient.verifyLogoutToken(logoutToken);
        } catch (error) {
            return error instanceof InvalidTokenError ? 400 : 400;
        }

        const dedupeKey = claims.tokenId ?? sha256Hex(logoutToken);
        const firstDelivery = await this.recordEvent("logout", dedupeKey, logoutToken);
        if (!firstDelivery) {
            return 200;
        }

        const identities = await this.database.db
            .select({ userId: externalIdentities.userId })
            .from(externalIdentities)
            .where(
                and(
                    eq(externalIdentities.issuer, this.config.basisAuth.issuer),
                    eq(externalIdentities.subject, claims.subject),
                ),
            );

        for (const identity of identities) {
            await this.sessions.revokeAllForUser(identity.userId, "backchannel_logout");
        }
        this.logger.info("Backchannel logout processed.", { identities: identities.length });
        return 200;
    }

    private async handleRevocation(form: URLSearchParams): Promise<number> {
        const jti = form.get("jti");
        const validAfterRaw = form.get("valid_after");
        const revocationToken = form.get("revocation_token");
        if (jti === null || validAfterRaw === null || revocationToken === null) {
            return 400;
        }
        const validAfterSeconds = Number.parseInt(validAfterRaw, 10);
        if (!Number.isFinite(validAfterSeconds) || validAfterSeconds < 0) {
            return 400;
        }

        let claims;
        try {
            claims = await this.authClient.verifyRevocationToken(revocationToken);
        } catch {
            return 400;
        }
        if (claims.accessTokenJti !== jti || claims.validAfter !== validAfterSeconds) {
            return 400;
        }

        const firstDelivery = await this.recordEvent("revoke_access_token", jti, revocationToken);
        if (!firstDelivery) {
            return 200;
        }

        const validAfter = new Date(validAfterSeconds * 1000);
        const expiresAt =
            claims.accessTokenExpiresAt === null
                ? new Date(validAfter.getTime() + 60 * 60 * 1000)
                : new Date((claims.accessTokenExpiresAt + 300) * 1000);

        await this.database.db
            .insert(revokedAccessTokens)
            .values({ jti, validAfter, expiresAt })
            .onConflictDoUpdate({
                target: revokedAccessTokens.jti,
                set: {
                    validAfter: sql`least(${revokedAccessTokens.validAfter}, excluded.valid_after)`,
                    expiresAt: sql`greatest(${revokedAccessTokens.expiresAt}, excluded.expires_at)`,
                },
            });

        return 200;
    }

    private async recordEvent(
        eventType: string,
        externalId: string,
        rawToken: string,
    ): Promise<boolean> {
        const inserted = await this.database.db
            .insert(backchannelEvents)
            .values({
                eventType,
                externalId,
                payloadHash: sha256Hex(rawToken),
                processedAt: this.clock.now(),
            })
            .onConflictDoNothing()
            .returning({ id: backchannelEvents.id });
        return inserted.length > 0;
    }
}
