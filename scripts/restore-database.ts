#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const USAGE = `Usage: node scripts/restore-database.ts <dump-file> [--force]

Restores a custom-format dump created by scripts/backup-database.ts.
The target database must be empty (no user tables) unless --force is given.
Restore uses pg_restore --clean --if-exists and may drop existing objects.

Required environment:
  DATABASE_MIGRATION_URL   Owner connection string (never logged)

Optional environment:
  PG_BIN                   Directory containing pg_restore/psql when not on PATH
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

function capture(
    binary: string,
    args: readonly string[],
    environment: NodeJS.ProcessEnv,
): Promise<string> {
    return new Promise((resolvePromise, rejectPromise) => {
        const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"], env: environment });
        let stdout = "";
        let stderr = "";
        if (child.stdout === null || child.stderr === null) {
            rejectPromise(new Error(`${binary} did not expose output streams.`));
            return;
        }
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (chunk: string) => {
            stdout += chunk;
        });
        child.stderr.on("data", (chunk: string) => {
            stderr += chunk;
        });
        child.on("error", (error) => {
            rejectPromise(new Error(`Failed to start ${binary}: ${error.message}`));
        });
        child.on("close", (code) => {
            if (code === 0) {
                resolvePromise(stdout);
                return;
            }
            rejectPromise(new Error(`${binary} exited with code ${code}. ${stderr.trim()}`));
        });
    });
}

const argumentsList = process.argv.slice(2);
if (argumentsList.includes("--help") || argumentsList.includes("-h")) {
    console.log(USAGE);
    process.exit(0);
}

const force = argumentsList.includes("--force");
const positional = argumentsList.filter((argument) => argument !== "--force");
const unknown = positional.filter((argument) => argument.startsWith("--"));
if (unknown.length > 0) {
    fail(`Unknown option: ${unknown[0]}\n\n${USAGE}`);
}
if (positional.length !== 1 || positional[0] === undefined) {
    fail(`Exactly one dump file is required.\n\n${USAGE}`);
}

const dumpFile = resolve(positional[0]);
if (!existsSync(dumpFile)) {
    fail(`Dump file not found: ${dumpFile}`);
}

const connection = parseConnection(process.env.DATABASE_MIGRATION_URL);
console.log(
    `Restoring ${dumpFile} into ${connection.host}:${connection.port}/${connection.database}`,
);

if (!force) {
    let tableCount: number;
    try {
        const output = await capture(
            pgBinary("psql"),
            [
                "--no-psqlrc",
                "--tuples-only",
                "--no-align",
                "--set",
                "ON_ERROR_STOP=1",
                "--command",
                "select count(*) from pg_tables where schemaname not in ('pg_catalog', 'information_schema')",
            ],
            connection.environment,
        );
        tableCount = Number.parseInt(output.trim(), 10);
    } catch (error) {
        fail(
            `Could not verify that the target database is empty: ${
                error instanceof Error ? error.message : "unknown error"
            }\nRe-run with --force only after confirming the target may be replaced.`,
        );
    }
    if (!Number.isInteger(tableCount) || tableCount < 0) {
        fail(
            "Could not read the target table count. Re-run with --force after confirming the target may be replaced.",
        );
    }
    if (tableCount > 0) {
        fail(
            `Target database contains ${tableCount} user table(s). Restore is destructive; re-run with --force to replace them.`,
        );
    }
}

let exitCode: number;
try {
    exitCode = await run(
        pgBinary("pg_restore"),
        [
            "--clean",
            "--if-exists",
            "--no-owner",
            "--no-privileges",
            "--exit-on-error",
            "--dbname",
            connection.database,
            dumpFile,
        ],
        connection.environment,
    );
} catch (error) {
    fail(error instanceof Error ? error.message : "pg_restore failed to start.");
}

if (exitCode !== 0) {
    fail(`pg_restore exited with code ${exitCode}.`);
}

console.log("Restore complete. Run the migration job to confirm the schema is current.");
