import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { MigrationTarget } from "./database.ts";
import { MigrationConflictError, type MigrationPlan } from "./planner.ts";
import { formatSchemaIssues, migrationMapSchema, type MigrationMap } from "./schema.ts";

export const PRODUCTION_CONFIRMATION = "MIGRATE_LEGACY_DATA";

export class MigrationUsageError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "MigrationUsageError";
    }
}

export interface EnvironmentGuardInput {
    readonly nodeEnv: string | undefined;
    readonly allowProduction: boolean;
    readonly confirm: string | undefined;
}

export function assertEnvironmentAllowed(input: EnvironmentGuardInput): void {
    if (input.nodeEnv !== "production") {
        return;
    }
    if (!input.allowProduction) {
        throw new MigrationUsageError(
            "NODE_ENV=production requires --allow-production. Refusing to run.",
        );
    }
    if (input.confirm !== PRODUCTION_CONFIRMATION) {
        throw new MigrationUsageError(
            `NODE_ENV=production requires --confirm ${PRODUCTION_CONFIRMATION}. Refusing to run.`,
        );
    }
}

export function loadMigrationMap(
    path: string,
    sourceSystem: string,
    inputSha256: string,
): MigrationMap | null {
    const resolved = resolve(path);
    if (!existsSync(resolved)) {
        return null;
    }
    let raw: unknown;
    try {
        raw = JSON.parse(readFileSync(resolved, "utf8")) as unknown;
    } catch (error) {
        throw new MigrationUsageError(
            `Migration map ${resolved} is not valid JSON: ${error instanceof Error ? error.message : "unknown error"}`,
        );
    }
    const parsed = migrationMapSchema.safeParse(raw);
    if (!parsed.success) {
        throw new MigrationUsageError(
            `Migration map ${resolved} is invalid:\n${formatSchemaIssues(parsed.error)
                .map((issue) => `- ${issue}`)
                .join("\n")}`,
        );
    }
    if (parsed.data.sourceSystem !== sourceSystem) {
        throw new MigrationUsageError(
            `Migration map ${resolved} belongs to source system "${parsed.data.sourceSystem}", not "${sourceSystem}".`,
        );
    }
    if (parsed.data.inputSha256 !== inputSha256) {
        throw new MigrationUsageError(
            `Migration map ${resolved} was produced from a different export. Do not reuse it for changed input.`,
        );
    }
    return parsed.data;
}

export function createMigrationMap(
    plan: MigrationPlan,
    appliedOrganizations: readonly string[],
): MigrationMap {
    return {
        format: "nethack-legacy-migration-map/1",
        sourceSystem: plan.sourceSystem,
        inputSha256: plan.inputSha256,
        updatedAt: new Date().toISOString(),
        appliedOrganizations: [...new Set(appliedOrganizations)],
        ids: { ...plan.mapIds },
    };
}

export function writeMigrationMap(path: string, map: MigrationMap): void {
    const resolved = resolve(path);
    mkdirSync(dirname(resolved), { recursive: true });
    const temporary = `${resolved}.${process.pid}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(map, null, 2)}\n`, "utf8");
    try {
        renameSync(temporary, resolved);
    } catch {
        rmSync(resolved, { force: true });
        renameSync(temporary, resolved);
    }
}

export interface MigrationRunOptions {
    readonly plan: MigrationPlan;
    readonly mode: "dry-run" | "apply";
    readonly target?: MigrationTarget | null;
    readonly onOrganizationApplied?: (organizationExternalId: string) => void | Promise<void>;
}

export interface MigrationRunReport {
    readonly mode: "dry-run" | "apply";
    readonly organizationsPlanned: number;
    readonly organizationsApplied: number;
    readonly organizationsSkipped: number;
    readonly rowsWritten: number;
}

export async function runMigration(options: MigrationRunOptions): Promise<MigrationRunReport> {
    const { plan, mode } = options;
    if (mode === "dry-run") {
        return {
            mode,
            organizationsPlanned: plan.organizations.length,
            organizationsApplied: 0,
            organizationsSkipped: plan.appliedOrganizations.length,
            rowsWritten: 0,
        };
    }

    const target = options.target;
    if (target === undefined || target === null) {
        throw new MigrationUsageError("Apply mode requires a database target.");
    }

    const appliedOrganizations = new Set(plan.appliedOrganizations);
    let organizationsApplied = 0;
    let organizationsSkipped = 0;
    let rowsWritten = 0;

    for (const organization of plan.organizations) {
        if (appliedOrganizations.has(organization.externalId)) {
            const exists = await target.verifyOrganization(organization.id);
            if (!exists) {
                throw new MigrationConflictError(
                    `The migration map marks organization "${organization.externalId}" as applied, but the target database does not contain it. Do not reuse a map from a different database.`,
                );
            }
            organizationsSkipped += 1;
            continue;
        }

        const result = await target.applyOrganization(organization, {
            sourceSystem: plan.sourceSystem,
            inputSha256: plan.inputSha256,
            generatedAt: plan.generatedAt,
        });
        organizationsApplied += 1;
        rowsWritten += result.rows;
        appliedOrganizations.add(organization.externalId);
        await options.onOrganizationApplied?.(organization.externalId);
    }

    return {
        mode,
        organizationsPlanned: plan.organizations.length,
        organizationsApplied,
        organizationsSkipped,
        rowsWritten,
    };
}
