#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { createPgMigrationTarget, type MigrationTarget } from "./legacy-migration/database.ts";
import {
    hashExport,
    MigrationConflictError,
    MigrationValidationError,
    planMigration,
    type MigrationPlan,
} from "./legacy-migration/planner.ts";
import {
    assertEnvironmentAllowed,
    createMigrationMap,
    loadMigrationMap,
    MigrationUsageError,
    PRODUCTION_CONFIRMATION,
    runMigration,
    writeMigrationMap,
    type MigrationRunReport,
} from "./legacy-migration/runtime.ts";
import {
    formatSchemaIssues,
    legacyExportSchema,
    type LegacyExport,
} from "./legacy-migration/schema.ts";

const USAGE = `Usage: bun scripts/migrate-legacy.ts --input <file> --dry-run [--map <file>]
       bun scripts/migrate-legacy.ts --input <file> --apply --map <file>

Reads a nethack-legacy-export/1 JSON file, validates it, and either reports the
planned migration (--dry-run) or writes it to PostgreSQL (--apply).
Runs with Bun or Node.js 24 and later.

Required:
  --input <file>     Legacy JSON export.
  --dry-run          Validate and report. Performs no database writes.
  --apply            Write the migration. Requires --map and DATABASE_MIGRATION_URL.

Apply options:
  --map <file>       Mapping/audit file. Required for --apply; written after each
                     committed organization. A map produced from different input
                     is rejected.
  --allow-production Required when NODE_ENV=production.
  --confirm <value>  Required when NODE_ENV=production; value must be
                     ${PRODUCTION_CONFIRMATION}.

Environment:
  DATABASE_MIGRATION_URL  Owner/migration PostgreSQL connection string. Never
                          logged. DATABASE_URL is never used.

Exit codes:
  0  Dry run succeeded, or every organization transaction committed.
  1  Invalid input, conflict, guard failure, or database error.
`;

interface CliOptions {
    readonly input: string;
    readonly mode: "dry-run" | "apply";
    readonly map: string | null;
    readonly allowProduction: boolean;
    readonly confirm: string | undefined;
    readonly help: boolean;
}

function fail(message: string): never {
    throw new MigrationUsageError(message);
}

function parseArguments(argv: readonly string[]): CliOptions {
    let input: string | undefined;
    let map: string | undefined;
    let mode: "dry-run" | "apply" | undefined;
    let allowProduction = false;
    let confirm: string | undefined;
    let help = false;

    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === undefined) {
            continue;
        }
        if (argument === "--help" || argument === "-h") {
            help = true;
            continue;
        }
        if (argument === "--dry-run") {
            if (mode !== undefined && mode !== "dry-run") {
                fail("Choose exactly one of --dry-run and --apply.");
            }
            mode = "dry-run";
            continue;
        }
        if (argument === "--apply") {
            if (mode !== undefined && mode !== "apply") {
                fail("Choose exactly one of --dry-run and --apply.");
            }
            mode = "apply";
            continue;
        }
        if (argument === "--allow-production") {
            allowProduction = true;
            continue;
        }
        if (argument === "--input" || argument === "--map" || argument === "--confirm") {
            const value = argv[index + 1];
            if (value === undefined || value.startsWith("--")) {
                fail(`${argument} requires a value.`);
            }
            index += 1;
            if (argument === "--input") {
                if (input !== undefined) {
                    fail("--input was provided more than once.");
                }
                input = value;
            } else if (argument === "--map") {
                if (map !== undefined) {
                    fail("--map was provided more than once.");
                }
                map = value;
            } else {
                if (confirm !== undefined) {
                    fail("--confirm was provided more than once.");
                }
                confirm = value;
            }
            continue;
        }
        fail(`Unknown argument: ${argument}`);
    }

    if (help) {
        return {
            input: input ?? "",
            mode: mode ?? "dry-run",
            map: map ?? null,
            allowProduction,
            confirm,
            help: true,
        };
    }
    if (input === undefined) {
        fail("--input is required.");
    }
    if (mode === undefined) {
        fail("Choose exactly one of --dry-run and --apply.");
    }
    if (mode === "apply" && map === undefined) {
        fail("--apply requires --map so the run can be resumed and audited.");
    }

    return {
        input,
        mode,
        map: map ?? null,
        allowProduction,
        confirm,
        help: false,
    };
}

function readExport(path: string): LegacyExport {
    const resolved = resolve(path);
    if (!existsSync(resolved)) {
        fail(`Input file not found: ${resolved}`);
    }
    let raw: unknown;
    try {
        raw = JSON.parse(readFileSync(resolved, "utf8")) as unknown;
    } catch (error) {
        fail(
            `Input file ${resolved} is not valid JSON: ${
                error instanceof Error ? error.message : "unknown error"
            }`,
        );
    }
    const parsed = legacyExportSchema.safeParse(raw);
    if (!parsed.success) {
        throw new MigrationValidationError(formatSchemaIssues(parsed.error));
    }
    return parsed.data;
}

function requireDatabaseUrl(): string {
    const raw = process.env.DATABASE_MIGRATION_URL?.trim();
    if (raw === undefined || raw === "") {
        fail("--apply requires DATABASE_MIGRATION_URL with owner/migration credentials.");
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
    if (url.pathname.replace(/^\//, "") === "") {
        fail("DATABASE_MIGRATION_URL must include a database name.");
    }
    return raw;
}

function printPlan(plan: MigrationPlan): void {
    const counts = plan.counts;
    console.log(`Source system: ${plan.sourceSystem}`);
    console.log(`Export generated: ${plan.generatedAt.toISOString()}`);
    console.log(`Input SHA-256: ${plan.inputSha256}`);
    console.log("Counts:");
    console.log(`  organizations: ${counts.organizations}`);
    console.log(`  users: ${counts.users}`);
    console.log(`  identities: ${counts.identities}`);
    console.log(`  memberships: ${counts.memberships}`);
    console.log(`  series: ${counts.series}`);
    console.log(`  editions: ${counts.editions}`);
    console.log(`  divisions: ${counts.divisions}`);
    console.log(`  registrations: ${counts.registrations}`);
    console.log(`  teams: ${counts.teams}`);
    console.log(`  team members: ${counts.teamMembers}`);
    console.log(`  participants: ${counts.participants}`);
    console.log(`  projects: ${counts.projects}`);
    console.log(`  project members: ${counts.projectMembers}`);
    console.log(`  submissions: ${counts.submissions}`);
    console.log(`  submission versions: ${counts.submissionVersions}`);
    console.log(`  file metadata rows: ${counts.files}`);
    if (plan.appliedOrganizations.length > 0) {
        console.log(`Already applied per map: ${plan.appliedOrganizations.length} organization(s)`);
    }
    if (plan.warnings.length > 0) {
        console.log("Warnings:");
        for (const warning of plan.warnings) {
            console.log(`  - ${warning}`);
        }
    }
}

function printReport(report: MigrationRunReport): void {
    console.log(`Organizations planned: ${report.organizationsPlanned}`);
    console.log(`Organizations applied: ${report.organizationsApplied}`);
    console.log(`Organizations skipped as already applied: ${report.organizationsSkipped}`);
    console.log(`Rows written: ${report.rowsWritten}`);
}

async function main(): Promise<void> {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
        console.log(USAGE);
        return;
    }

    assertEnvironmentAllowed({
        nodeEnv: process.env.NODE_ENV,
        allowProduction: options.allowProduction,
        confirm: options.confirm,
    });

    const input = readExport(options.input);
    const inputSha256 = hashExport(input);
    const map =
        options.map === null
            ? null
            : loadMigrationMap(options.map, input.sourceSystem, inputSha256);
    const plan = planMigration(input, { map });

    console.log(options.mode === "dry-run" ? "Legacy migration dry run" : "Legacy migration apply");
    printPlan(plan);

    if (options.mode === "dry-run") {
        const report = await runMigration({ plan, mode: "dry-run" });
        printReport(report);
        console.log("Dry run complete. No database writes were performed.");
        return;
    }

    const databaseUrl = requireDatabaseUrl();
    const mapPath = options.map;
    if (mapPath === null) {
        fail("--apply requires --map.");
    }

    let target: MigrationTarget | null = null;
    try {
        target = createPgMigrationTarget(databaseUrl);
        const appliedOrganizations = new Set(plan.appliedOrganizations);
        const report = await runMigration({
            plan,
            mode: "apply",
            target,
            onOrganizationApplied: (organizationExternalId) => {
                appliedOrganizations.add(organizationExternalId);
                writeMigrationMap(mapPath, createMigrationMap(plan, [...appliedOrganizations]));
            },
        });
        printReport(report);
        console.log(`Migration map written to: ${resolve(mapPath)}`);
        if (report.organizationsApplied === 0) {
            console.log("No organization was written; the map already covered every organization.");
        }
    } finally {
        if (target !== null) {
            await target.close();
        }
    }
}

try {
    await main();
} catch (error) {
    if (error instanceof MigrationValidationError) {
        console.error(error.message);
    } else if (error instanceof MigrationUsageError) {
        console.error(`${error.message}\n\n${USAGE}`);
    } else if (error instanceof MigrationConflictError) {
        console.error(error.message);
    } else {
        console.error(error instanceof Error ? error.message : String(error));
    }
    process.exitCode = 1;
}
