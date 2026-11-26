import { and, eq } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import type { AuthContext } from "../authentication/types.js";
import { sha256Hex } from "../authentication/crypto.js";
import type { Clock } from "../core/clock.js";
import { ConflictError, ValidationError } from "../core/errors.js";
import type { DatabaseConnection } from "../infrastructure/database/client.js";
import { idempotencyKeys } from "../infrastructure/database/schema/index.js";

export interface IdempotentResult<T> {
    readonly status: number;
    readonly body: T;
}

const KEY_PATTERN = /^[A-Za-z0-9._~-]{16,128}$/;

/**
 * Idempotency records for critical mutations. The unique (user, route, key)
 * constraint means a retried request returns the stored response instead of
 * repeating the operation. Database constraints remain the final defense for
 * concurrent duplicates when no key is supplied.
 */
export class IdempotencyService {
    private readonly database: DatabaseConnection;
    private readonly clock: Clock;

    constructor(database: DatabaseConnection, clock: Clock) {
        this.database = database;
        this.clock = clock;
    }

    async execute<T>(
        request: FastifyRequest,
        auth: AuthContext,
        routeKey: string,
        work: () => Promise<IdempotentResult<T>>,
    ): Promise<IdempotentResult<T>> {
        const header = request.headers["idempotency-key"];
        const key = Array.isArray(header) ? header[0] : header;
        if (key === undefined) {
            return work();
        }
        if (!KEY_PATTERN.test(key)) {
            throw new ValidationError("The idempotency key has an invalid format.");
        }
        const requestHash = sha256Hex(
            JSON.stringify({
                method: request.method,
                url: request.url,
                body: request.body ?? null,
            }),
        );

        const existing = await this.database.db
            .select()
            .from(idempotencyKeys)
            .where(
                and(
                    eq(idempotencyKeys.userId, auth.user.id),
                    eq(idempotencyKeys.route, routeKey),
                    eq(idempotencyKeys.key, key),
                ),
            )
            .limit(1);

        const record = existing[0];
        if (record !== undefined) {
            if (record.requestHash !== requestHash) {
                throw new ConflictError(
                    "This idempotency key was already used with a different request.",
                );
            }
            return { status: record.responseStatus, body: record.responseBody as T };
        }

        const result = await work();
        const expiresAt = new Date(this.clock.now().getTime() + 24 * 60 * 60 * 1000);
        await this.database.db
            .insert(idempotencyKeys)
            .values({
                userId: auth.user.id,
                route: routeKey,
                key,
                requestHash,
                responseStatus: result.status,
                responseBody: result.body,
                expiresAt,
            })
            .onConflictDoNothing();
        return result;
    }
}
