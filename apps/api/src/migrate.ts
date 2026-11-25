import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { loadLocalEnvironment } from "./bootstrap.js";
import { loadConfiguration } from "./core/configuration.js";

loadLocalEnvironment();

const config = loadConfiguration();
const migrationUrl = process.env.DATABASE_MIGRATION_URL ?? config.database.url;
const migrationsFolder = resolve(
    process.env.MIGRATIONS_DIR ?? resolve(process.cwd(), "../../database/migrations"),
);

if (!existsSync(migrationsFolder)) {
    console.error(`Migrations folder not found: ${migrationsFolder}`);
    process.exit(1);
}

const pool = new Pool({
    connectionString: migrationUrl,
    max: 1,
    application_name: "nethack-migrate",
    statement_timeout: 120_000,
});

try {
    const database = drizzle(pool);
    await migrate(database, { migrationsFolder });
    console.log(`Migrations applied from ${migrationsFolder}`);
} catch (error) {
    console.error("Migration failed.", error instanceof Error ? error.message : error);
    process.exitCode = 1;
} finally {
    await pool.end();
}
