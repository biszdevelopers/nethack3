import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startHarness, type TestHarness } from "../support/app-harness.js";
import { queryAsOwner, queryAsRuntimeTenant } from "../support/test-database.js";
import { buildSecurityFixture, type SecurityFixture } from "./support/security-fixtures.js";
import { queryAsRuntime } from "./support/runtime-query.js";

interface Probe {
    readonly table: string;
    readonly column: "id" | "organization_id";
    readonly value: string;
}

async function countAsRuntime(probe: Probe, organizationId: string | null): Promise<number> {
    const sql = `select count(*)::int as count from ${probe.table} where ${probe.column} = $1`;
    const rows =
        organizationId === null
            ? await queryAsRuntime<{ count: number }>(sql, [probe.value])
            : await queryAsRuntimeTenant<{ count: number }>(organizationId, sql, [probe.value]);
    return rows[0]?.count ?? 0;
}

describe("row-level security fails closed", () => {
    let harness: TestHarness;
    let fixture: SecurityFixture;
    let probes: readonly Probe[];

    beforeAll(async () => {
        harness = await startHarness();
        fixture = await buildSecurityFixture(harness);

        const participantRows = await queryAsOwner<{ id: string }>(
            "select id from participants where organization_id = $1 and user_id = $2",
            [fixture.organizationId, fixture.participant.userId],
        );
        const participantId = participantRows[0]?.id;
        if (participantId === undefined) {
            throw new Error("The participant row was not created.");
        }

        const teamMemberRows = await queryAsOwner<{ id: string }>(
            "select id from team_members where team_id = $1 and user_id = $2",
            [fixture.teamId, fixture.participant.userId],
        );
        const teamMemberId = teamMemberRows[0]?.id;
        if (teamMemberId === undefined) {
            throw new Error("The team member row was not created.");
        }

        const projectMemberRows = await queryAsOwner<{ id: string }>(
            "select id from project_members where project_id = $1 and user_id = $2",
            [fixture.projectId, fixture.participant.userId],
        );
        const projectMemberId = projectMemberRows[0]?.id;
        if (projectMemberId === undefined) {
            throw new Error("The project member row was not created.");
        }

        probes = [
            {
                table: "organization_settings",
                column: "organization_id",
                value: fixture.organizationId,
            },
            { table: "competition_series", column: "id", value: fixture.privateSeriesId },
            { table: "competition_editions", column: "id", value: fixture.privateEditionId },
            { table: "divisions", column: "id", value: fixture.privateDivisionId },
            { table: "milestones", column: "id", value: fixture.privateMilestoneId },
            { table: "teams", column: "id", value: fixture.teamId },
            { table: "team_members", column: "id", value: teamMemberId },
            { table: "team_invitations", column: "id", value: fixture.invitationId },
            { table: "registrations", column: "id", value: fixture.registrationId },
            { table: "participants", column: "id", value: participantId },
            { table: "projects", column: "id", value: fixture.projectId },
            { table: "project_members", column: "id", value: projectMemberId },
            { table: "submissions", column: "id", value: fixture.submissionId },
            { table: "submission_versions", column: "id", value: fixture.submissionVersionId },
            { table: "submission_files", column: "id", value: fixture.fileId },
            { table: "judging_rubrics", column: "id", value: fixture.rubricId },
            { table: "judging_criteria", column: "id", value: fixture.criterionId },
            { table: "judge_assignments", column: "id", value: fixture.assignmentId },
            { table: "evaluations", column: "id", value: fixture.evaluationId },
            { table: "evaluation_scores", column: "id", value: fixture.evaluationScoreId },
            { table: "voting_rounds", column: "id", value: fixture.roundId },
            { table: "ballots", column: "id", value: fixture.ballotId },
            { table: "votes", column: "id", value: fixture.voteId },
            { table: "announcements", column: "id", value: fixture.announcementId },
        ];
    });

    afterAll(async () => {
        await harness.closeHarness();
    });

    it("returns the row with the correct tenant context", async () => {
        for (const probe of probes) {
            const count = await countAsRuntime(probe, fixture.organizationId);
            expect(count, `${probe.table} row should be visible to its tenant`).toBe(1);
        }
    });

    it("returns zero rows without tenant context", async () => {
        for (const probe of probes) {
            const count = await countAsRuntime(probe, null);
            expect(count, `${probe.table} leaked without tenant context`).toBe(0);
        }
    });

    it("returns zero rows with another tenant's context", async () => {
        for (const probe of probes) {
            const count = await countAsRuntime(probe, fixture.outsiderOrganizationId);
            expect(count, `${probe.table} leaked to another tenant`).toBe(0);
        }
    });

    it("enforces row-level security on recognition and judging workflow tables", async () => {
        const tables = await queryAsOwner<{ tablename: string; rowsecurity: boolean }>(
            "select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename in ('awards', 'team_awards', 'edition_results', 'judge_flags')",
        );
        expect(tables).toHaveLength(4);
        for (const table of tables) {
            expect(table.rowsecurity, `${table.tablename} must force RLS`).toBe(true);
        }
        const policies = await queryAsOwner<{ policyname: string }>(
            "select policyname from pg_policies where schemaname = 'public' and policyname = 'edition_results_public_read'",
        );
        expect(policies).toHaveLength(1);
    });
});
