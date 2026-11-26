import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { MigrationTarget } from "../../scripts/legacy-migration/database.ts";
import {
    deterministicUuid,
    MigrationConflictError,
    MigrationValidationError,
    planMigration,
} from "../../scripts/legacy-migration/planner.ts";
import {
    assertEnvironmentAllowed,
    createMigrationMap,
    MigrationUsageError,
    PRODUCTION_CONFIRMATION,
    runMigration,
} from "../../scripts/legacy-migration/runtime.ts";
import { legacyExportSchema, type LegacyExport } from "../../scripts/legacy-migration/schema.ts";

const fixtureJson = JSON.parse(
    readFileSync(
        new URL("../../docs/implementation/migration-fixture.json", import.meta.url),
        "utf8",
    ),
) as unknown;

function parseFixture(): LegacyExport {
    return legacyExportSchema.parse(fixtureJson);
}

function cloneFixture(): LegacyExport {
    return structuredClone(parseFixture());
}

function first<T>(items: readonly T[]): T {
    const item = items[0];
    if (item === undefined) {
        throw new Error("Expected at least one item.");
    }
    return item;
}

function expectPlanFailure(input: LegacyExport, pattern: RegExp): void {
    try {
        planMigration(input);
    } catch (error) {
        expect(error).toBeInstanceOf(MigrationValidationError);
        if (error instanceof MigrationValidationError) {
            expect(error.issues.join("\n")).toMatch(pattern);
        }
        return;
    }
    throw new Error(`Expected migration validation to fail with ${pattern}.`);
}

class FakeTarget implements MigrationTarget {
    applyCalls = 0;
    verifyCalls = 0;
    verifyResult = true;

    async applyOrganization(organization: { readonly id: string }): Promise<{
        organizationId: string;
        rows: number;
    }> {
        this.applyCalls += 1;
        return { organizationId: organization.id, rows: 5 };
    }

    async verifyOrganization(): Promise<boolean> {
        this.verifyCalls += 1;
        return this.verifyResult;
    }

    async close(): Promise<void> {
        // No connection to close.
    }
}

describe("legacy export validation", () => {
    it("accepts the documented fixture", () => {
        const input = parseFixture();
        expect(input.organizations).toHaveLength(1);
        expect(input.users).toHaveLength(2);
    });

    it("rejects unknown fields", () => {
        const raw = structuredClone(fixtureJson) as Record<string, unknown>;
        raw.unexpected = true;
        const result = legacyExportSchema.safeParse(raw);
        expect(result.success).toBe(false);
    });

    it("rejects a user without an external identity", () => {
        const input = cloneFixture();
        first(input.users).identities = [];
        const result = legacyExportSchema.safeParse(input);
        expect(result.success).toBe(false);
    });

    it("rejects duplicate user external IDs", () => {
        const input = cloneFixture();
        input.users.push(structuredClone(first(input.users)));
        expectPlanFailure(input, /Duplicate user externalId/);
    });

    it("rejects a duplicate identity across users", () => {
        const input = cloneFixture();
        const identity = structuredClone(first(first(input.users).identities));
        first(input.users.slice(1)).identities = [identity];
        expectPlanFailure(input, /already belongs to user/);
    });

    it("rejects a duplicate email instead of linking by email", () => {
        const input = cloneFixture();
        first(input.users.slice(1)).email = first(input.users).email;
        expectPlanFailure(input, /Email is shared/);
    });

    it("rejects an unknown user reference", () => {
        const input = cloneFixture();
        first(first(input.organizations).memberships).userExternalId = "missing-user";
        expectPlanFailure(input, /Unknown user externalId "missing-user"/);
    });

    it("rejects a duplicate organization slug", () => {
        const input = cloneFixture();
        const organization = structuredClone(first(input.organizations));
        organization.externalId = "fixture-org-2";
        input.organizations.push(organization);
        expectPlanFailure(input, /Duplicate organization slug/);
    });

    it("rejects a duplicate project slug in one organization", () => {
        const input = cloneFixture();
        const project = structuredClone(first(first(input.organizations).projects));
        project.externalId = "fixture-project-2";
        first(input.organizations).projects.push(project);
        expectPlanFailure(input, /Duplicate project slug/);
    });
});

describe("migration planning", () => {
    it("counts every mapped entity", () => {
        const plan = planMigration(parseFixture());
        expect(plan.counts).toEqual({
            organizations: 1,
            users: 2,
            identities: 2,
            memberships: 2,
            series: 1,
            editions: 1,
            divisions: 1,
            registrations: 2,
            teams: 1,
            teamMembers: 2,
            participants: 2,
            projects: 1,
            projectMembers: 2,
            submissions: 1,
            submissionVersions: 1,
            files: 1,
        });
    });

    it("derives stable UUIDs from external IDs", () => {
        const firstPlan = planMigration(parseFixture());
        const secondPlan = planMigration(parseFixture());
        expect(firstPlan.organizations[0]?.id).toBe(secondPlan.organizations[0]?.id);
        expect(firstPlan.users[0]?.id).toBe(secondPlan.users[0]?.id);
        expect(firstPlan.organizations[0]?.id).toBe(
            deterministicUuid("organization", "global", "fixture-org"),
        );
    });

    it("uses an existing map ID when the input hash matches", () => {
        const plan = planMigration(parseFixture());
        const organizationKey = Object.keys(plan.mapIds).find((key) =>
            key.startsWith("organization:"),
        );
        if (organizationKey === undefined) {
            throw new Error("Expected an organization mapping key.");
        }
        const replacement = "11111111-1111-4111-8111-111111111111";
        const map = {
            ...createMigrationMap(plan, []),
            ids: { ...plan.mapIds, [organizationKey]: replacement },
        };
        const mapped = planMigration(parseFixture(), { map });
        expect(mapped.organizations[0]?.id).toBe(replacement);
    });

    it("refuses a map produced from different input", () => {
        const plan = planMigration(parseFixture());
        const map = createMigrationMap(plan, []);
        const changed = cloneFixture();
        changed.generatedAt = "2026-01-16T12:00:00.000Z";
        expect(() => planMigration(changed, { map })).toThrow(/inputSha256/);
    });

    it("reports users that are exported but never referenced", () => {
        const input = cloneFixture();
        const unused = structuredClone(first(input.users));
        unused.externalId = "fixture-unused-user";
        unused.email = "unused@example.invalid";
        first(unused.identities).subject = "fixture-unused-subject";
        input.users.push(unused);
        const plan = planMigration(input);
        expect(plan.counts.users).toBe(2);
        expect(plan.warnings.join("\n")).toMatch(/fixture-unused-user/);
    });
});

describe("dry run and apply", () => {
    it("performs no target calls in dry-run mode", async () => {
        const plan = planMigration(parseFixture());
        const target = new FakeTarget();
        const report = await runMigration({ plan, mode: "dry-run", target });
        expect(report.organizationsApplied).toBe(0);
        expect(report.rowsWritten).toBe(0);
        expect(target.applyCalls).toBe(0);
        expect(target.verifyCalls).toBe(0);
    });

    it("applies one organization and reports the callback", async () => {
        const plan = planMigration(parseFixture());
        const target = new FakeTarget();
        const applied: string[] = [];
        const report = await runMigration({
            plan,
            mode: "apply",
            target,
            onOrganizationApplied: (externalId) => {
                applied.push(externalId);
            },
        });
        expect(target.applyCalls).toBe(1);
        expect(report.organizationsApplied).toBe(1);
        expect(report.rowsWritten).toBe(5);
        expect(applied).toEqual(["fixture-org"]);
    });

    it("skips organizations already marked in the map", async () => {
        const initial = planMigration(parseFixture());
        const map = createMigrationMap(initial, ["fixture-org"]);
        const plan = planMigration(parseFixture(), { map });
        const target = new FakeTarget();
        const report = await runMigration({ plan, mode: "apply", target });
        expect(target.applyCalls).toBe(0);
        expect(target.verifyCalls).toBe(1);
        expect(report.organizationsSkipped).toBe(1);
    });

    it("fails when the map says applied but the target is empty", async () => {
        const initial = planMigration(parseFixture());
        const map = createMigrationMap(initial, ["fixture-org"]);
        const plan = planMigration(parseFixture(), { map });
        const target = new FakeTarget();
        target.verifyResult = false;
        await expect(runMigration({ plan, mode: "apply", target })).rejects.toThrow(
            MigrationConflictError,
        );
    });
});

describe("production guard", () => {
    it("refuses production without --allow-production", () => {
        expect(() =>
            assertEnvironmentAllowed({
                nodeEnv: "production",
                allowProduction: false,
                confirm: PRODUCTION_CONFIRMATION,
            }),
        ).toThrow(MigrationUsageError);
    });

    it("refuses production without the exact confirmation", () => {
        expect(() =>
            assertEnvironmentAllowed({
                nodeEnv: "production",
                allowProduction: true,
                confirm: "yes",
            }),
        ).toThrow(MigrationUsageError);
    });

    it("allows production with both guard flags", () => {
        expect(() =>
            assertEnvironmentAllowed({
                nodeEnv: "production",
                allowProduction: true,
                confirm: PRODUCTION_CONFIRMATION,
            }),
        ).not.toThrow();
    });

    it("does not require guard flags outside production", () => {
        expect(() =>
            assertEnvironmentAllowed({
                nodeEnv: "development",
                allowProduction: false,
                confirm: undefined,
            }),
        ).not.toThrow();
    });
});
