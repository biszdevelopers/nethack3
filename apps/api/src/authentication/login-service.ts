import { and, eq, isNull, gt } from "drizzle-orm";
import type { AppConfig } from "../core/configuration.js";
import type { Clock } from "../core/clock.js";
import type { Logger } from "../core/logger.js";
import type { DatabaseConnection } from "../infrastructure/database/client.js";
import { authTransactions } from "../infrastructure/database/schema/index.js";
import type { BasisAuthClient } from "./basis-auth-client.js";
import { decryptSecret, encryptSecret, hashIp, randomToken, sha256Hex } from "./crypto.js";
import type { SessionService } from "./session-service.js";
import type { RequestMetadata } from "./types.js";
import { AccountLinkRequiredError, type UserService } from "./user-service.js";
import { normalizeReturnTo } from "./return-to.js";

export { normalizeReturnTo } from "./return-to.js";

export type LoginFailureReason =
    | "login_cancelled"
    | "login_expired"
    | "login_failed"
    | "account_disabled"
    | "account_link_required";

export interface LoginStartResult {
    readonly authorizationUrl: string;
}

export interface LoginCompletionResult {
    readonly redirectUrl: string;
    readonly sessionToken: string;
    readonly expiresAt: Date;
}

export class LoginService {
    private readonly config: AppConfig;
    private readonly database: DatabaseConnection;
    private readonly authClient: BasisAuthClient;
    private readonly sessions: SessionService;
    private readonly users: UserService;
    private readonly clock: Clock;
    private readonly logger: Logger;

    constructor(
        config: AppConfig,
        database: DatabaseConnection,
        authClient: BasisAuthClient,
        sessions: SessionService,
        users: UserService,
        clock: Clock,
        logger: Logger,
    ) {
        this.config = config;
        this.database = database;
        this.authClient = authClient;
        this.sessions = sessions;
        this.users = users;
        this.clock = clock;
        this.logger = logger.child({ component: "login" });
    }

    async start(returnTo: string | null, metadata: RequestMetadata): Promise<LoginStartResult> {
        const safeReturnTo = normalizeReturnTo(returnTo, this.config.origins.workspace);
        const authorization = await this.authClient.createAuthorizationUrl();
        const encryptedVerifier = encryptSecret(
            authorization.codeVerifier,
            this.config.session.encryptionKeys,
        );
        const primaryKey = this.config.session.encryptionKeys[0]?.key;
        if (primaryKey === undefined) {
            throw new Error("No session encryption key configured.");
        }
        await this.database.db.insert(authTransactions).values({
            stateHash: sha256Hex(authorization.state),
            nonce: authorization.nonce,
            codeVerifierEncrypted: encryptedVerifier.ciphertext,
            tokenKeyVersion: encryptedVerifier.keyVersion,
            returnTo: safeReturnTo,
            ipHash: hashIp(metadata.ip, primaryKey),
            expiresAt: new Date(
                this.clock.now().getTime() + this.config.loginTransactionTtlSeconds * 1000,
            ),
        });
        return { authorizationUrl: authorization.url.toString() };
    }

    async complete(
        query: URLSearchParams,
        metadata: RequestMetadata,
        previousSessionToken: string | null,
    ): Promise<LoginCompletionResult> {
        const providerError = query.get("error");
        if (providerError !== null) {
            const reason: LoginFailureReason =
                providerError === "access_denied" ? "login_cancelled" : "login_failed";
            return this.failure(reason);
        }

        const state = query.get("state");
        const code = query.get("code");
        if (state === null || code === null) {
            return this.failure("login_failed");
        }

        const now = this.clock.now();
        const stateHash = sha256Hex(state);
        const consumed = await this.database.transaction({}, async (session) => {
            const rows = await session.db
                .update(authTransactions)
                .set({ consumedAt: now })
                .where(
                    and(
                        eq(authTransactions.stateHash, stateHash),
                        isNull(authTransactions.consumedAt),
                        gt(authTransactions.expiresAt, now),
                    ),
                )
                .returning();
            return rows[0] ?? null;
        });

        if (consumed === null) {
            return this.failure("login_expired");
        }

        const callbackUrl = new URL(this.config.basisAuth.redirectUri);
        callbackUrl.search = query.toString();
        let tokens;
        try {
            const codeVerifier = decryptSecret(
                consumed.codeVerifierEncrypted,
                this.config.session.encryptionKeys,
            );
            tokens = await this.authClient.exchangeCode(callbackUrl, {
                expectedState: state,
                expectedNonce: consumed.nonce,
                codeVerifier,
            });
        } catch (error) {
            this.logger.warn("Token exchange failed.", {
                error: error instanceof Error ? error.message : "unknown",
            });
            return this.failure("login_failed");
        }

        let user;
        try {
            user = await this.users.findOrCreateFromIdentity(
                tokens.claims,
                this.config.basisAuth.issuer,
            );
        } catch (error) {
            if (error instanceof AccountLinkRequiredError) {
                return this.failure("account_link_required");
            }
            throw error;
        }

        if (user.status !== "active") {
            return this.failure("account_disabled");
        }

        // Session fixation defense: always mint a new session and discard any
        // session token presented by the browser before authentication.
        if (previousSessionToken !== null) {
            await this.sessions.revokeByToken(previousSessionToken, "login_regenerated");
        }

        const created = await this.sessions.create(user.id, tokens, metadata);
        const redirectTarget = consumed.returnTo ?? "/";
        this.logger.info("Login completed.", { userId: user.id });

        return {
            redirectUrl: toWorkspaceUrl(redirectTarget, this.config.origins.workspace),
            sessionToken: created.sessionToken,
            expiresAt: created.expiresAt,
        };
    }

    async providerLogoutUrl(): Promise<string | null> {
        try {
            return await this.authClient.endSessionUrl();
        } catch (error) {
            this.logger.warn("Provider logout URL could not be built.", {
                error: error instanceof Error ? error.message : "unknown",
            });
            return null;
        }
    }

    private failure(reason: LoginFailureReason): LoginCompletionResult {
        return {
            redirectUrl: new URL(
                `/auth/error?reason=${encodeURIComponent(reason)}`,
                this.config.origins.workspace,
            ).toString(),
            sessionToken: "",
            expiresAt: this.clock.now(),
        };
    }
}

function toWorkspaceUrl(path: string, workspaceOrigin: string): string {
    return new URL(path, workspaceOrigin).toString();
}

export function createStateToken(): string {
    return randomToken(32);
}
