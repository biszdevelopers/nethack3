import { sql } from "drizzle-orm";
import type { DomainEvent } from "./domain-event.js";
import type { DatabaseConnection, DatabaseSession } from "../infrastructure/database/client.js";
import { outboxEvents } from "../infrastructure/database/schema/index.js";

export interface OutboxEventRecord {
    readonly id: string;
    readonly organizationId: string | null;
    readonly aggregateType: string;
    readonly aggregateId: string;
    readonly eventType: string;
    readonly payload: Record<string, unknown>;
    readonly occurredAt: Date;
    readonly attempts: number;
}

/**
 * Publishes domain events through the transactional outbox. The insert uses the
 * caller's transaction so an event exists only if the business change commits.
 */
export class OutboxPublisher {
    private readonly database: DatabaseConnection;

    constructor(database: DatabaseConnection) {
        this.database = database;
    }

    async publish(session: DatabaseSession, event: DomainEvent): Promise<void> {
        await session.db.insert(outboxEvents).values({
            organizationId: event.organizationId,
            aggregateType: event.aggregateType,
            aggregateId: event.aggregateId,
            eventType: event.type,
            payload: event.payload,
            ...(event.dedupeKey === undefined ? {} : { dedupeKey: event.dedupeKey }),
        });
    }

    async claimBatch(limit: number): Promise<readonly OutboxEventRecord[]> {
        const result = await this.database.db.execute(sql`
            with claimed as (
                select id from outbox_events
                where processed_at is null and available_at <= now()
                order by occurred_at
                limit ${limit}
                for update skip locked
            )
            update outbox_events event
            set attempts = event.attempts + 1
            from claimed
            where event.id = claimed.id
            returning event.id, event.organization_id, event.aggregate_type, event.aggregate_id,
                      event.event_type, event.payload, event.occurred_at, event.attempts
        `);
        return (result.rows as unknown as OutboxEventRecordRow[]).map((row) => ({
            id: row.id,
            organizationId: row.organization_id,
            aggregateType: row.aggregate_type,
            aggregateId: row.aggregate_id,
            eventType: row.event_type,
            payload: row.payload,
            occurredAt: new Date(row.occurred_at),
            attempts: row.attempts,
        }));
    }

    async markProcessed(id: string): Promise<void> {
        await this.database.db.execute(sql`
            update outbox_events
            set processed_at = now(), last_error = null
            where id = ${id}
        `);
    }

    async markFailed(id: string, error: string, attempts: number): Promise<boolean> {
        const message = error.slice(0, 2000);
        if (attempts >= 10) {
            // Dead-letter: the row is retained with its final error but no longer retried.
            await this.database.db.execute(sql`
                update outbox_events
                set processed_at = now(), last_error = ${`dead-lettered: ${message}`}
                where id = ${id}
            `);
            return true;
        }
        const delaySeconds = Math.min(3600, 2 ** attempts * 5);
        await this.database.db.execute(sql`
            update outbox_events
            set last_error = ${message}, available_at = now() + make_interval(secs => ${delaySeconds})
            where id = ${id}
        `);
        return false;
    }
}

interface OutboxEventRecordRow {
    readonly id: string;
    readonly organization_id: string | null;
    readonly aggregate_type: string;
    readonly aggregate_id: string;
    readonly event_type: string;
    readonly payload: Record<string, unknown>;
    readonly occurred_at: string;
    readonly attempts: number;
}
