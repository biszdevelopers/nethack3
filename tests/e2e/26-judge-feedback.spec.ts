import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { FIXTURE, USERS } from "../support/e2e/config.js";
import { newAppContext, signIn } from "../support/e2e/app.js";
import { ownerTenantBatch } from "../support/e2e/db.js";

const RUN = Date.now().toString(36).slice(-6);
const AUTHOR_ID = "f2000000-0000-4000-8000-000000000041";
const RUBRIC_ID = FIXTURE.labRubricId;
const DIVISION_ID = FIXTURE.divisionId;

const TEAM_A = {
    id: randomUUID(),
    name: `Anonymous Feedback Team A ${RUN}`,
    projectId: randomUUID(),
    submissionId: randomUUID(),
    projectTitle: `Anonymous Feedback Project A ${RUN}`,
    description: "A project with three reviewers and a complete showcase.",
    repositoryUrl: "https://example.com/feedback-repo-a",
    demoUrl: "https://example.com/feedback-demo-a",
    videoUrl: "https://example.com/feedback-video-a",
    aiDisclosure: "Used an image model for the hero illustration.",
    comments: [
        "Reviewer one: strong evidence and clear trade-offs.",
        "Reviewer two: the demo shows a focused and useful workflow.",
        "Reviewer three: the repository is organized and easy to follow.",
    ],
} as const;

const TEAM_B = {
    id: randomUUID(),
    name: `Anonymous Feedback Team B ${RUN}`,
    projectId: randomUUID(),
    submissionId: randomUUID(),
    projectTitle: `Anonymous Feedback Project B ${RUN}`,
    description: "A project with only two reviewers.",
} as const;

interface SeededEvaluation {
    readonly assignmentId: string;
    readonly evaluationId: string;
    readonly judgeUserId: string;
    readonly comment: string;
    readonly weightedScore: number;
}

const TEAM_A_EVALUATIONS: readonly SeededEvaluation[] = [
    {
        assignmentId: randomUUID(),
        evaluationId: randomUUID(),
        judgeUserId: FIXTURE.judgeId,
        comment: TEAM_A.comments[0],
        weightedScore: 80,
    },
    {
        assignmentId: randomUUID(),
        evaluationId: randomUUID(),
        judgeUserId: FIXTURE.organizerId,
        comment: TEAM_A.comments[1],
        weightedScore: 90,
    },
    {
        assignmentId: randomUUID(),
        evaluationId: randomUUID(),
        judgeUserId: AUTHOR_ID,
        comment: TEAM_A.comments[2],
        weightedScore: 70,
    },
];

const TEAM_B_EVALUATIONS: readonly SeededEvaluation[] = [
    {
        assignmentId: randomUUID(),
        evaluationId: randomUUID(),
        judgeUserId: FIXTURE.judgeId,
        comment: "Only the first review for the two-reviewer team.",
        weightedScore: 60,
    },
    {
        assignmentId: randomUUID(),
        evaluationId: randomUUID(),
        judgeUserId: FIXTURE.organizerId,
        comment: "Only the second review for the two-reviewer team.",
        weightedScore: 65,
    },
];

async function seedTeam(
    team: {
        readonly id: string;
        readonly name: string;
        readonly projectId: string;
        readonly submissionId: string;
        readonly projectTitle: string;
        readonly description: string;
        readonly repositoryUrl?: string;
        readonly demoUrl?: string;
        readonly videoUrl?: string;
        readonly aiDisclosure?: string;
    },
    evaluations: readonly SeededEvaluation[],
): Promise<void> {
    await ownerTenantBatch(FIXTURE.organizationId, [
        {
            text: `insert into teams
                   (id, organization_id, edition_id, division_id, name, description, status,
                    captain_user_id, max_members)
                   values ($1, $2, $3, $4, $5, 'Anonymous feedback fixture team.',
                           'ready', $6, 4)
                   on conflict (id) do nothing`,
            values: [
                team.id,
                FIXTURE.organizationId,
                FIXTURE.editionId,
                DIVISION_ID,
                team.name,
                FIXTURE.organizerId,
            ],
        },
        {
            text: `insert into projects
                   (id, organization_id, edition_id, team_id, owner_user_id, title, slug, summary,
                    description_markdown, repository_url, demo_url, video_url, ai_disclosure,
                    tags, status, published_at)
                   values ($1, $2, $3, $4, $5, $6, $7, 'Anonymous feedback fixture project.',
                           $8, $9, $10, $11, $12, array['feedback'], 'published', now())
                   on conflict (id) do nothing`,
            values: [
                team.projectId,
                FIXTURE.organizationId,
                FIXTURE.editionId,
                team.id,
                FIXTURE.organizerId,
                team.projectTitle,
                `${team.projectTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${RUN}`,
                team.description,
                team.repositoryUrl ?? null,
                team.demoUrl ?? null,
                team.videoUrl ?? null,
                team.aiDisclosure ?? "",
            ],
        },
        {
            text: `insert into submissions
                   (id, organization_id, edition_id, project_id, team_id, status,
                    current_version, submitted_at)
                   values ($1, $2, $3, $4, $5, 'submitted', 0, now())
                   on conflict (id) do nothing`,
            values: [
                team.submissionId,
                FIXTURE.organizationId,
                FIXTURE.editionId,
                team.projectId,
                team.id,
            ],
        },
        ...evaluations.flatMap((evaluation, index) => [
            {
                text: `insert into judge_assignments
                       (id, organization_id, edition_id, rubric_id, submission_id, judge_user_id,
                        status, assignment_note, due_at, assigned_by_user_id)
                       values ($1, $2, $3, $4, $5, $6, 'submitted',
                               'Anonymous feedback assignment.', now() + interval '7 days', $7)
                       on conflict (id) do nothing`,
                values: [
                    evaluation.assignmentId,
                    FIXTURE.organizationId,
                    FIXTURE.editionId,
                    RUBRIC_ID,
                    team.submissionId,
                    evaluation.judgeUserId,
                    FIXTURE.organizerId,
                ],
            },
            {
                text: `insert into evaluations
                       (id, organization_id, assignment_id, judge_user_id, status,
                        overall_comment, weighted_score, submitted_at)
                       values ($1, $2, $3, $4, 'submitted', $5, $6,
                               now() - ($7 || ' minutes')::interval)
                       on conflict (id) do nothing`,
                values: [
                    evaluation.evaluationId,
                    FIXTURE.organizationId,
                    evaluation.assignmentId,
                    evaluation.judgeUserId,
                    evaluation.comment,
                    evaluation.weightedScore,
                    String(index + 1),
                ],
            },
        ]),
    ]);
}

test.describe("judging feedback and history context", () => {
    test.beforeAll(async () => {
        await seedTeam(TEAM_A, TEAM_A_EVALUATIONS);
        await seedTeam(TEAM_B, TEAM_B_EVALUATIONS);
    });

    test.afterAll(async () => {
        const assignments = [...TEAM_A_EVALUATIONS, ...TEAM_B_EVALUATIONS].map(
            (evaluation) => evaluation.assignmentId,
        );
        const evaluations = [...TEAM_A_EVALUATIONS, ...TEAM_B_EVALUATIONS].map(
            (evaluation) => evaluation.evaluationId,
        );
        await ownerTenantBatch(FIXTURE.organizationId, [
            {
                text: "delete from evaluations where id = any($1::uuid[])",
                values: [evaluations],
            },
            {
                text: "delete from judge_assignments where id = any($1::uuid[])",
                values: [assignments],
            },
            {
                text: "delete from submissions where id = any($1::uuid[])",
                values: [[TEAM_A.submissionId, TEAM_B.submissionId]],
            },
            {
                text: "delete from projects where id = any($1::uuid[])",
                values: [[TEAM_A.projectId, TEAM_B.projectId]],
            },
            {
                text: "delete from teams where id = any($1::uuid[])",
                values: [[TEAM_A.id, TEAM_B.id]],
            },
        ]);
    });

    test("organizers see anonymous feedback only after three reviews, and judges see full history context", async ({
        page,
        browser,
    }) => {
        test.setTimeout(240_000);
        await signIn(page, USERS.organizer);
        await page.goto(`/judging?edition=${FIXTURE.editionId}`);

        const results = page.getByRole("region", { name: "Results" });
        await expect(results).toBeVisible();

        await test.step("releases written feedback for a team with three submitted evaluations", async () => {
            const row = results.getByRole("row", { name: new RegExp(TEAM_A.projectTitle) });
            await expect(row).toBeVisible();
            await row.getByRole("button", { name: "View anonymous feedback" }).click();

            const panel = page.getByRole("region", { name: "Anonymous team feedback" });
            await expect(panel).toBeVisible();
            await expect(panel.getByText("Feedback withheld for anonymity")).toHaveCount(0);
            for (const comment of TEAM_A.comments) {
                await expect(panel.getByText(comment)).toBeVisible();
            }
            await expect(panel.getByText("Anonymous evaluation")).toHaveCount(3);
            await expect(panel.getByText(USERS.judge.name)).toHaveCount(0);
            await expect(panel.getByText(USERS.judge.email)).toHaveCount(0);
        });

        await test.step("withholds written feedback with fewer than three reviewers", async () => {
            const row = results.getByRole("row", { name: new RegExp(TEAM_B.projectTitle) });
            await expect(row).toBeVisible();
            await row.getByRole("button", { name: "View anonymous feedback" }).click();

            const panel = page.getByRole("region", { name: "Anonymous team feedback" });
            await expect(panel).toBeVisible();
            await expect(panel.getByText("Feedback withheld for anonymity")).toBeVisible();
            await expect(panel.getByText("2 of 3")).toBeVisible();
            await expect(panel.getByText(TEAM_B_EVALUATIONS[0]?.comment ?? "")).toHaveCount(0);
        });

        const judgeContext = await newAppContext(browser);
        try {
            const judgePage = await judgeContext.newPage();
            await signIn(judgePage, USERS.judge);
            await judgePage.goto(`/judging/history?edition=${FIXTURE.editionId}`);

            await test.step("judge history shows team, track, description, links, disclosure, and state", async () => {
                await expect(
                    judgePage.getByRole("heading", { name: "Judging history", level: 1 }),
                ).toBeVisible();
                const historyCard = judgePage.getByRole("region", {
                    name: TEAM_A.projectTitle,
                });
                await expect(historyCard).toBeVisible();
                await expect(
                    historyCard.getByRole("heading", {
                        name: TEAM_A.projectTitle,
                        level: 3,
                    }),
                ).toBeVisible();
                await expect(historyCard.getByText(TEAM_A.name).first()).toBeVisible();
                await expect(
                    historyCard.getByText(TEAM_A.description, { exact: true }),
                ).toBeVisible();
                await expect(
                    historyCard.getByText(TEAM_A.aiDisclosure, { exact: true }),
                ).toBeVisible();
                await expect(
                    historyCard.getByText("Submitted", { exact: true }).first(),
                ).toBeVisible();
                await expect(
                    historyCard.getByRole("link", { name: "Open repository" }),
                ).toHaveAttribute("href", TEAM_A.repositoryUrl);
                await expect(historyCard.getByRole("link", { name: "Open demo" })).toHaveAttribute(
                    "href",
                    TEAM_A.demoUrl,
                );
                await expect(
                    historyCard.getByRole("link", { name: "Watch demonstration video" }),
                ).toHaveAttribute("href", TEAM_A.videoUrl);
                await expect(
                    historyCard.getByText(TEAM_A_EVALUATIONS[0]?.comment ?? ""),
                ).toBeVisible();
            });
        } finally {
            await judgeContext.close();
        }
    });
});
