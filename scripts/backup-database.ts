#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";

const USAGE = `Usage: node scripts/backup-database.ts

Writes a timestamped custom-format dump to BACKUP_DIR.

Required environment:
  DATABASE_MIGRATION_URL   Owner connection string (never logged)

Optional environment:
  BACKUP_DIR               Output directory (default: ./backups)
  PG_BIN                   Directory containing pg_dump when not on PATH
`;

interface Connection {
    readonly host: string;
    readonly port: string;
    readonly database: string;
    readonly environment: NodeJS.ProcessEnv;
}

function fail(message: string): never {
    console.error(message);
    process.exit(1);
}

function parseConnection(raw: string | undefined): Connection {
    if (raw === undefined || raw.trim() === "") {
        fail("DATABASE_MIGRATION_URL is required.");
    }
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        fail("DATABASE_MIGRATION_URL is not a valid URL.");
    }
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
        fail("DATABASE_MIGRATION_URL must use postgres:// or postgresql://.");
    }
    const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
    if (database === "") {
        fail("DATABASE_MIGRATION_URL must include a database name.");
    }
    const environment: NodeJS.ProcessEnv = {
        ...process.env,
        PGHOST: url.hostname,
        PGPORT: url.port === "" ? "5432" : url.port,
        PGUSER: decodeURIComponent(url.username),
        PGDATABASE: database,
    };
    if (url.password !== "") {
        environment.PGPASSWORD = decodeURIComponent(url.password);
    }
    const sslmode = url.searchParams.get("sslmode");
    if (sslmode !== null) {
        environment.PGSSLMODE = sslmode;
    }
    return {
        host: url.hostname,
        port: environment.PGPORT ?? "5432",
        database,
        environment,
    };
}

function pgBinary(name: string): string {
    const directory = process.env.PG_BIN?.trim();
    if (directory === undefined || directory === "") {
        return name;
    }
    return join(directory, process.platform === "win32" ? `${name}.exe` : name);
}

function run(
    binary: string,
    args: readonly string[],
    environment: NodeJS.ProcessEnv,
): Promise<number> {
    return new Promise((resolvePromise, rejectPromise) => {
        const child = spawn(binary, args, {
            stdio: ["ignore", "inherit", "inherit"],
            env: environment,
        });
        child.on("error", (error) => {
            rejectPromise(new Error(`Failed to start ${binary}: ${error.message}`));
        });
        child.on("close", (code) => {
            resolvePromise(code ?? 1);
        });
    });
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(USAGE);
    process.exit(0);
}
const extraArguments = process.argv.slice(2);
if (extraArguments.length > 0) {
    fail(`Unexpected argument: ${extraArguments[0]}\n\n${USAGE}`);
}

const connection = parseConnection(process.env.DATABASE_MIGRATION_URL);
const backupDirectory = resolve(process.env.BACKUP_DIR?.trim() || "./backups");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = join(backupDirectory, `nethack-${timestamp}.dump`);
const partial = `${target}.partial`;

mkdirSync(backupDirectory, { recursive: true });
console.log(`Dumping ${connection.host}:${connection.port}/${connection.database} to ${target}`);

let exitCode: number;
try {
    exitCode = await run(
        pgBinary("pg_dump"),
        ["--format=custom", "--compress=9", "--no-owner", "--no-privileges", "--file", partial],
        connection.environment,
    );
} catch (error) {
    rmSync(partial, { force: true });
    fail(error instanceof Error ? error.message : "pg_dump failed to start.");
}

if (exitCode !== 0) {
    rmSync(partial, { force: true });
    fail(`pg_dump exited with code ${exitCode}.`);
}

renameSync(partial, target);
const size = statSync(target).size;
console.log(`Backup complete: ${target} (${Math.round(size / 1024)} KiB)`);
