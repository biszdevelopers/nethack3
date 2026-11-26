import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client, Pool, type QueryResultRow } from "pg";

/**
 * Test database lifecycle.
 *
 * Migrations run as the database owner. Application queries run as the
 * non-owner runtime role so row-level security applies. Every test file starts
 * from a truncated schema; fileParallelism is disabled in vitest.config.ts.
 */

const HOST = process.env.NETHACK_TEST_DB_HOST ?? "127.0.0.1";
const PORT = process.env.NETHACK_TEST_DB_PORT ?? "55432";
const DATABASE = process.env.NETHACK_TEST_DB_NAME ?? "nethack_test";

export const ownerDatabaseUrl =
    process.env.NETHACK_TEST_OWNER_URL ??
    `postgres://nethack:nethack_dev_password@${HOST}:${PORT}/${DATABASE}`;

export const runtimeDatabaseUrl =
    process.env.NETHACK_TEST_RUNTIME_URL ??
    `postgres://nethack_app:nethack_app_password@${HOST}:${PORT}/${DATABASE}`;

const supportDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(supportDirectory, "../../../../database/migrations");

let ownerPool: Pool | null = null;
let migrated = false;

function pool(): Pool {
    ownerPool ??= new Pool({
        connectionString: ownerDatabaseUrl,
        max: 2,
        application_name: "nethack-tests-owner",
        statement_timeout: 120_000,
    });
    return ownerPool;
}

export async function migrateTestDatabase(): Promise<void> {
    if (migrated) {
        return;
    }
    const migrationPool = new Pool({
        connectionString: ownerDatabaseUrl,
        max: 1,
        application_name: "nethack-tests-migrate",
        statement_timeout: 120_000,
    });
    try {
        await migrate(drizzle(migrationPool), { migrationsFolder });
        migrated = true;
    } finally {
        await migrationPool.end();
    }
}

export async function truncateAllTables(): Promise<void> {
    const tables = await queryAsOwner<{ tablename: string }>(
        "select tablename from pg_tables where schemaname = 'public' order by tablename",
    );
    if (tables.length === 0) {
        return;
    }
    const list = tables.map((table) => `"${table.tablename.replaceAll('"', '""')}"`).join(", ");
    await queryAsOwner(`truncate table ${list} restart identity cascade`);
}

/**
 * Idempotent per test file: applies pending migrations once and clears every
 * table so files cannot leak state into each other.
 */
export async function resetTestDatabase(): Promise<void> {
    await migrateTestDatabase();
    await truncateAllTables();
}

export async function queryAsOwner<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values: readonly unknown[] = [],
): Promise<T[]> {
    const result = await pool().query<T>(text, [...values]);
    return result.rows;
}

/**
 * Runs a query as the non-owner runtime role inside a transaction that sets a
 * tenant context, then rolls back. This is how RLS enforcement is asserted.
 */
export async function queryAsRuntimeTenant<T extends QueryResultRow = QueryResultRow>(
    organizationId: string,
    text: string,
    values: readonly unknown[] = [],
): Promise<T[]> {
    const client = new Client({
        connectionString: runtimeDatabaseUrl,
        application_name: "nethack-tests-runtime",
    });
    await client.connect();
    try {
        await client.query("begin");
        await client.query("select set_config('nethack.organization_id', $1, true)", [
            organizationId,
        ]);
        const result = await client.query<T>(text, [...values]);
        await client.query("rollback");
        return result.rows;
    } finally {
        await client.end();
    }
}

export async function closeTestDatabase(): Promise<void> {
    if (ownerPool !== null) {
        await ownerPool.end();
        ownerPool = null;
    }
}

let emailCounter = 0;

export function uniqueEmail(prefix = "user"): string {
    emailCounter += 1;
    const run = `${Date.now().toString(36)}-${process.pid.toString(36)}-${emailCounter}`;
    return `${prefix}-${run}@example.test`;
}

let slugCounter = 0;

export function uniqueSlug(prefix = "org"): string {
    slugCounter += 1;
    const run = `${Date.now().toString(36)}-${slugCounter}`;
    return `${prefix}-${run}`.toLowerCase().replace(/[^a-z0-9-]/g, "");
}
