import { expect, test, type Page } from "@playwright/test";
import {
    API_ORIGIN,
    FIXTURE,
    SITE_ORIGIN,
    USERS,
    WORKSPACE_ORIGIN,
} from "../support/e2e/config.js";
import { signIn } from "../support/e2e/app.js";
import { ownerTenantBatch, ownerTenantQuery } from "../support/e2e/db.js";

const DESIGN_DIVISION_ID = "f7000000-0000-4000-8000-000000000001";
const DESIGN_DIVISION_SLUG = "parity-design";
const DESIGN_DIVISION_NAME = "Design";

const ENTRIES = [
    {
        teamId: "f7000000-0000-4000-8000-000000000011",
        projectId: "f7000000-0000-4000-8000-000000000021",
        submissionId: "f7000000-0000-4000-8000-000000000031",
        assignmentId: "f7000000-0000-4000-8000-000000000041",
        evaluationId: "f7000000-0000-4000-8000-000000000051",
        teamName: "Parity Design Alpha",
        projectTitle: "Parity Design Alpha",
        projectSlug: "parity-design-alpha",
        weightedScore: 96,
        divisionId: DESIGN_DIVISION_ID,
    },
    {
        teamId: "f7000000-0000-4000-8000-000000000012",
        projectId: "f7000000-0000-4000-8000-000000000022",
        submissionId: "f7000000-0000-4000-8000-000000000032",
        assignmentId: "f7000000-0000-4000-8000-000000000042",
        evaluationId: "f7000000-0000-4000-8000-000000000052",
        teamName: "Parity Design Bravo",
        projectTitle: "Parity Design Bravo",
        projectSlug: "parity-design-bravo",
        weightedScore: 88,
        divisionId: DESIGN_DIVISION_ID,
    },
    {
        teamId: "f7000000-0000-4000-8000-000000000013",
        projectId: "f7000000-0000-4000-8000-000000000023",
        submissionId: "f7000000-0000-4000-8000-000000000033",
        assignmentId: "f7000000-0000-4000-8000-000000000043",
        evaluationId: "f7000000-0000-4000-8000-000000000053",
        teamName: "Parity Design Charlie",
        projectTitle: "Parity Design Charlie",
        projectSlug: "parity-design-charlie",
        weightedScore: 77,
        divisionId: DESIGN_DIVISION_ID,
    },
    {
        teamId: "f7000000-0000-4000-8000-000000000014",
        projectId: "f7000000-0000-4000-8000-000000000024",
        submissionId: "f7000000-0000-4000-8000-000000000034",
        assignmentId: "f7000000-0000-4000-8000-000000000044",
        evaluationId: "f7000000-0000-4000-8000-000000000054",
        teamName: "Parity Design Delta",
        projectTitle: "Parity Design Delta",
        projectSlug: "parity-design-delta",
        weightedScore: 66,
        divisionId: DESIGN_DIVISION_ID,
    },
    {
        teamId: "f7000000-0000-4000-8000-000000000015",
        projectId: "f7000000-0000-4000-8000-000000000025",
        submissionId: "f7000000-0000-4000-8000-000000000035",
        assignmentId: "f7000000-0000-4000-8000-000000000045",
        evaluationId: "f7000000-0000-4000-8000-000000000055",
        teamName: "Parity Open Echo",
        projectTitle: "Parity Open Echo",
        projectSlug: "parity-open-echo",
        weightedScore: 94,
        divisionId: FIXTURE.divisionId,
    },
] as const;

const AWARD_ID = "f7000000-0000-4000-8000-000000000061";
const AWARD_NAME = "E2E Parity Award";
const AWARDED_TEAM_ID = ENTRIES[1].teamId;

async function csrfToken(page: Page): Promise<string> {
    const response = await page.request.get(`${API_ORIGIN}/api/v1/auth/csrf`);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as { csrfToken: string };
    return body.csrfToken;
}

function requestHeaders(token: string): Record<string, string> {
    return {
        "content-type": "application/json",
        "x-csrf-token": token,
        "x-nethack-organization-id": FIXTURE.organizationId,
        origin: WORKSPACE_ORIGIN,
    };
}

async function seedResultsFixture(): Promise<void> {
    const statements: { text: string; values: readonly unknown[] }[] = [
        {
            text: `insert into divisions (id, organization_id, edition_id, name, slug, description)
                   values ($1, $2, $3, $4, $5, 'Second track used by the results parity journey.')
                   on conflict do nothing`,
            values: [
                DESIGN_DIVISION_ID,
                FIXTURE.organizationId,
                FIXTURE.editionId,
                DESIGN_DIVISION_NAME,
                DESIGN_DIVISION_SLUG,
            ],
        },
        {
            text: `insert into awards
                       (id, organization_id, edition_id, namespace, name, description, icon, color,
                        created_by_user_id)
                   values ($1, $2, $3, 'e2e-parity', $4, 'Award used by the results parity journey.',
                           'award', 'gold', $5)
                   on conflict do nothing`,
            values: [
                AWARD_ID,
                FIXTURE.organizationId,
                FIXTURE.editionId,
                AWARD_NAME,
                FIXTURE.organizerId,
            ],
        },
    ];

    for (const entry of ENTRIES) {
        statements.push(
            {
                text: `insert into teams
                           (id, organization_id, edition_id, division_id, name, description, status,
                            captain_user_id, max_members)
                       values ($1, $2, $3, $4, $5, '', 'ready', $6, 4)
                       on conflict do nothing`,
                values: [
                    entry.teamId,
                    FIXTURE.organizationId,
                    FIXTURE.editionId,
                    entry.divisionId,
                    entry.teamName,
                    FIXTURE.participantId,
                ],
            },
            {
                text: `insert into projects
                           (id, organization_id, edition_id, team_id, owner_user_id, title, slug,
                            summary, description_markdown, tags, status, published_at)
                       values ($1, $2, $3, $4, $5, $6, $7,
                               'A project seeded for the public results parity journey.',
                               'Parity fixture.', array['parity'], 'published', now())
                       on conflict do nothing`,
                values: [
                    entry.projectId,
                    FIXTURE.organizationId,
                    FIXTURE.editionId,
                    entry.teamId,
                    FIXTURE.participantId,
                    entry.projectTitle,
                    entry.projectSlug,
                ],
            },
            {
                text: `insert into submissions
                           (id, organization_id, edition_id, project_id, team_id, status,
                            current_version, submitted_at)
                       values ($1, $2, $3, $4, $5, 'submitted', 0, now())
                       on conflict do nothing`,
                values: [
                    entry.submissionId,
                    FIXTURE.organizationId,
                    FIXTURE.editionId,
                    entry.projectId,
                    entry.teamId,
                ],
            },
            {
                text: `insert into judge_assignments
                           (id, organization_id, edition_id, rubric_id, submission_id, judge_user_id,
                            status, assignment_note, due_at, assigned_by_user_id)
                       values ($1, $2, $3, $4, $5, $6, 'assigned', 'Results parity assignment.',
                               now() + interval '7 days', $7)
                       on conflict do nothing`,
                values: [
                    entry.assignmentId,
                    FIXTURE.organizationId,
                    FIXTURE.editionId,
                    FIXTURE.labRubricId,
                    entry.submissionId,
                    FIXTURE.judgeId,
                    FIXTURE.organizerId,
                ],
            },
            {
                text: `insert into evaluations
                           (id, organization_id, assignment_id, judge_user_id, status,
                            overall_comment, weighted_score, submitted_at)
                       values ($1, $2, $3, $4, 'submitted', 'Results parity evaluation.', $5, now())
                       on conflict do nothing`,
                values: [
                    entry.evaluationId,
                    FIXTURE.organizationId,
                    entry.assignmentId,
                    FIXTURE.judgeId,
                    entry.weightedScore,
                ],
            },
        );
    }

    statements.push({
        text: `insert into team_awards
                   (id, organization_id, edition_id, team_id, award_id, note, assigned_by_user_id)
               values ('f7000000-0000-4000-8000-000000000062', $1, $2, $3, $4,
                       'Awarded by the results parity journey.', $5)
               on conflict do nothing`,
        values: [
            FIXTURE.organizationId,
            FIXTURE.editionId,
            AWARDED_TEAM_ID,
            AWARD_ID,
            FIXTURE.organizerId,
        ],
    });

    await ownerTenantBatch(FIXTURE.organizationId, statements);
}

async function setVisibility(showScores: boolean, showRanking: boolean): Promise<void> {
    await ownerTenantQuery(
        FIXTURE.organizationId,
        "update competition_editions set show_scores = $2, show_ranking = $3 where id = $1",
        [FIXTURE.editionId, showScores, showRanking],
    );
}

async function cleanupResultsFixture(): Promise<void> {
    const teamIds = ENTRIES.map((entry) => entry.teamId);
    const projectIds = ENTRIES.map((entry) => entry.projectId);
    const submissionIds = ENTRIES.map((entry) => entry.submissionId);
    const assignmentIds = ENTRIES.map((entry) => entry.assignmentId);
    const evaluationIds = ENTRIES.map((entry) => entry.evaluationId);
    await ownerTenantBatch(FIXTURE.organizationId, [
        {
            text: "delete from team_awards where award_id = $1",
            values: [AWARD_ID],
        },
        {
            text: "delete from awards where id = $1",
            values: [AWARD_ID],
        },
        {
            text: "delete from evaluations where id = any($1::uuid[])",
            values: [evaluationIds],
        },
        {
            text: "delete from judge_assignments where id = any($1::uuid[])",
            values: [assignmentIds],
        },
        {
            text: "delete from submissions where id = any($1::uuid[])",
            values: [submissionIds],
        },
        {
            text: "delete from projects where id = any($1::uuid[])",
            values: [projectIds],
        },
        {
            text: "delete from teams where id = any($1::uuid[])",
            values: [teamIds],
        },
        {
            text: "delete from divisions where id = $1",
            values: [DESIGN_DIVISION_ID],
        },
        {
            text: `update competition_editions
                   set show_scores = false, show_ranking = false
                   where id = $1`,
            values: [FIXTURE.editionId],
        },
    ]);
}

test.describe("public results parity", () => {
    test("groups tracks, hides rankings, toggles scores, and links projects and certificates", async ({
        page,
    }) => {
        test.setTimeout(300_000);
        await signIn(page, USERS.organizer);
        const token = await csrfToken(page);

        async function unpublish(): Promise<void> {
            const response = await page.request.delete(
                `${API_ORIGIN}/api/v1/competitions/${FIXTURE.editionId}/results/publish`,
                { headers: requestHeaders(token) },
            );
            expect([204, 404]).toContain(response.status());
        }

        async function publish(): Promise<void> {
            const response = await page.request.post(
                `${API_ORIGIN}/api/v1/competitions/${FIXTURE.editionId}/results/publish`,
                { headers: requestHeaders(token) },
            );
            expect(response.status()).toBe(200);
        }

        await unpublish();
        await cleanupResultsFixture();
        await seedResultsFixture();

        await test.step("hidden rankings and scores show a notice without rank labels", async () => {
            await setVisibility(false, false);
            await publish();
            await page.goto(`${SITE_ORIGIN}/results`);
            await expect(page.getByRole("heading", { name: "Results", level: 1 })).toBeVisible();
            const tracks = page.getByRole("region", { name: "Results by track" });
            await expect(tracks.getByRole("region", { name: DESIGN_DIVISION_NAME })).toBeVisible();
            await expect(tracks.getByRole("region", { name: "Open" })).toBeVisible();
            await expect(page.getByText("Rankings are not public for this edition")).toBeVisible();
            expect(await tracks.getByText(/Rank #/).count()).toBe(0);
            expect(await tracks.getByText(/\/ 100/).count()).toBe(0);
            await expect(page.getByText(AWARD_NAME).first()).toBeVisible();
            await expect(
                page.locator(`a[href="/certificates/${AWARDED_TEAM_ID}"]`).first(),
            ).toBeVisible();
            await expect(
                page.getByRole("link", { name: ENTRIES[0].projectTitle }).first(),
            ).toHaveAttribute("href", `/projects/${ENTRIES[0].projectSlug}`);
        });

        await test.step("visible rankings and scores render ranks, podium, and scores", async () => {
            await unpublish();
            await setVisibility(true, true);
            await publish();
            await page.goto(`${SITE_ORIGIN}/results`);
            const tracks = page.getByRole("region", { name: "Results by track" });
            await expect(tracks.getByText(/Rank #\d+/).first()).toBeVisible();
            const design = tracks.getByRole("region", { name: DESIGN_DIVISION_NAME });
            await expect(design.getByText(/^Rank #\d+$/)).toHaveCount(4);
            await expect(tracks.getByText(/\d+\.\d{2} \/ 100/).first()).toBeVisible();
            await expect(page.getByText("Rankings are not public for this edition")).toBeHidden();
            await expect(
                page.locator(`a[href="/certificates/${AWARDED_TEAM_ID}"]`).first(),
            ).toBeVisible();
        });

        await test.step("project preview opens in a dialog", async () => {
            await page.getByRole("button", { name: "Preview project" }).first().click();
            const dialog = page.getByRole("dialog");
            await expect(dialog).toBeVisible();
            await expect(dialog.getByRole("heading", { level: 2 })).toBeVisible();
            await expect(dialog.getByText("AI-use disclosure", { exact: true })).toBeVisible();
            await page.keyboard.press("Escape");
            await expect(dialog).toBeHidden();
        });

        await test.step("project links open the public project page", async () => {
            await page.getByRole("link", { name: ENTRIES[0].projectTitle }).first().click();
            await expect(
                page.getByRole("heading", { name: ENTRIES[0].projectTitle, level: 1 }),
            ).toBeVisible();
        });

        await test.step("unpublish restores the edition for later journeys", async () => {
            await unpublish();
            await cleanupResultsFixture();
        });
    });
});
