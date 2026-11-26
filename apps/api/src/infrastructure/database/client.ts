import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase, type NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import type { AppConfig } from "../../core/configuration.js";
import type { Clock } from "../../core/clock.js";
import * as schema from "./schema/index.js";

export type Database = NodePgDatabase<typeof schema>;
export type DatabaseExecutor = PgDatabase<NodePgQueryResultHKT, typeof schema>;

export interface DatabaseSession {
    readonly db: DatabaseExecutor;
    readonly organizationId: string | null;
    readonly userId: string | null;
}

export interface TransactionOptions {
    readonly organizationId?: string | null;
    readonly userId?: string | null;
}

export class DatabaseConnection {
    readonly pool: Pool;
    readonly db: Database;
    private readonly clock: Clock;

    constructor(config: AppConfig["database"], clock: Clock) {
        this.pool = new Pool({
            connectionString: config.url,
            max: config.poolMax,
            idleTimeoutMillis: 30_000,
            connectionTimeoutMillis: 5_000,
            statement_timeout: 15_000,
            query_timeout: 20_000,
            application_name: "nethack-api",
        });
        this.db = drizzle(this.pool, { schema });
        this.clock = clock;
    }

    async transaction<T>(
        options: TransactionOptions,
        work: (session: DatabaseSession) => Promise<T>,
    ): Promise<T> {
        const organizationId = options.organizationId ?? null;
        const userId = options.userId ?? null;
        return this.db.transaction(async (tx) => {
            // SET LOCAL is transaction-scoped: pooled connections cannot leak tenant context.
            await tx.execute(
                sql`select set_config('nethack.organization_id', ${organizationId ?? ""}, true)`,
            );
            await tx.execute(sql`select set_config('nethack.user_id', ${userId ?? ""}, true)`);
            return work({ db: tx, organizationId, userId });
        });
    }

    async healthCheck(): Promise<void> {
        await this.pool.query("select 1");
    }

    serverTime(): Date {
        return this.clock.now();
    }

    async close(): Promise<void> {
        await this.pool.end();
    }
}
