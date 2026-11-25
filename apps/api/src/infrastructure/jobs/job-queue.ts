import { sql } from "drizzle-orm";
import type { DatabaseConnection, DatabaseSession } from "../database/client.js";
import { jobs } from "../database/schema/index.js";

export interface EnqueueJobOptions {
    readonly kind: string;
    readonly payload: Record<string, unknown>;
    readonly organizationId?: string | null;
    readonly dedupeKey?: string;
    readonly runAt?: Date;
    readonly maxAttempts?: number;
}

export interface ClaimedJob {
    readonly id: string;
    readonly kind: string;
    readonly payload: Record<string, unknown>;
    readonly organizationId: string | null;
    readonly attempts: number;
    readonly maxAttempts: number;
}

/**
 * PostgreSQL-backed job queue. Claiming uses FOR UPDATE SKIP LOCKED so multiple
 * worker processes can drain the queue without duplicate execution. Time
 * complexity per claim is O(k log n) with the queue index, space O(k), where k
 * is the batch size. A job whose lease expires is eligible again.
 */
export class JobQueue {
    private readonly database: DatabaseConnection;

    constructor(database: DatabaseConnection) {
        this.database = database;
    }

    async enqueue(session: DatabaseSession, options: EnqueueJobOptions): Promise<void> {
        await session.db
            .insert(jobs)
            .values({
                kind: options.kind,
                payload: options.payload,
                organizationId: options.organizationId ?? null,
                ...(options.dedupeKey === undefined ? {} : { dedupeKey: options.dedupeKey }),
                ...(options.runAt === undefined ? {} : { runAt: options.runAt }),
                ...(options.maxAttempts === undefined
                    ? {}
                    : { maxAttempts: options.maxAttempts }),
            })
            .onConflictDoNothing();
    }

    async claim(workerId: string, limit = 10, leaseSeconds = 60): Promise<readonly ClaimedJob[]> {
        const result = await this.database.db.execute(sql`
            with claimed as (
                select id from jobs
                where (
                    (status = 'pending' and run_at <= now())
                    or (status = 'running' and locked_until is not null and locked_until <= now())
                )
                order by run_at
                limit ${limit}
                for update skip locked
            )
            update jobs job
            set status = 'running',
                attempts = job.attempts + 1,
                locked_until = now() + make_interval(secs => ${leaseSeconds}),
                locked_by = ${workerId}
            from claimed
            where job.id = claimed.id
            returning job.id, job.kind, job.payload, job.organization_id, job.attempts, job.max_attempts
        `);
        return (result.rows as unknown as ClaimedJobRow[]).map((row) => ({
            id: row.id,
            kind: row.kind,
            payload: row.payload,
            organizationId: row.organization_id,
            attempts: row.attempts,
            maxAttempts: row.max_attempts,
        }));
    }

    async complete(id: string): Promise<void> {
        await this.database.db.execute(sql`
            update jobs
            set status = 'completed', completed_at = now(), locked_until = null, last_error = null
            where id = ${id}
        `);
    }

    async fail(
        id: string,
        error: string,
        options: { retryAt?: Date; dead: boolean },
    ): Promise<void> {
        const message = error.slice(0, 2000);
        if (options.dead) {
            await this.database.db.execute(sql`
                update jobs
                set status = 'dead', last_error = ${message}, locked_until = null
                where id = ${id}
            `);
            return;
        }
        await this.database.db.execute(sql`
            update jobs
            set status = 'pending',
                last_error = ${message},
                locked_until = null,
                run_at = ${options.retryAt ?? new Date()}
            where id = ${id}
        `);
    }

    async purgeCompleted(olderThan: Date): Promise<number> {
        const result = await this.database.db.execute(sql`
            delete from jobs
            where status = 'completed' and completed_at < ${olderThan}
        `);
        return result.rowCount ?? 0;
    }
}

interface ClaimedJobRow {
    readonly id: string;
    readonly kind: string;
    readonly payload: Record<string, unknown>;
    readonly organization_id: string | null;
    readonly attempts: number;
    readonly max_attempts: number;
}
