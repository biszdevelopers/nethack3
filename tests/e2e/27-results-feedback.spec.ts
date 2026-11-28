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

const EDITION_ID = "f8000000-0000-4000-8000-000000000001";
const DIVISION_ID = "f8000000-0000-4000-8000-000000000002";
const TEAM_A_ID = "f8000000-0000-4000-8000-000000000011";
const TEAM_B_ID = "f8000000-0000-4000-8000-000000000012";
const MEMBER_A_ID = "f8000000-0000-4000-8000-000000000013";
const PROJECT_A_ID = "f8000000-0000-4000-8000-000000000021";
const PROJECT_B_ID = "f8000000-0000-4000-8000-000000000022";
const PROJECT_C_ID = "f8000000-0000-4000-8000-000000000023";
const SUBMISSION_A_ID = "f8000000-0000-4000-8000-000000000031";
const SUBMISSION_B_ID = "f8000000-0000-4000-8000-000000000032";
const ROUND_ID = "f8000000-0000-4000-8000-000000000040";
const BALLOT_ONE_ID = "f8000000-0000-4000-8000-000000000041";
const BALLOT_TWO_ID = "f8000000-0000-4000-8000-000000000042";

const EDITION_SLUG = "e2e-results-feedback";
const RANKED_TITLE = "Feedback Ranked Project";
const LOW_REVIEW_TITLE = "Feedback Low Review Project";
const UNJUDGED_TITLE = "Feedback Unjudged Project";

const REVIEWERS = [
    { userId: FIXTURE.judgeId, comment: "Reviewer one feedback." },
    { userId: FIXTURE.applicantId, comment: "Reviewer two feedback." },
    {
        userId: "f2000000-0000-4000-8000-000000000041",
        comment: "Reviewer three feedback.",
    },
] as const;

function fixtureUuid(value: number): string {
    return `f8000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
}

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

async function seedFixture(): Promise<void> {
    const statements: { text: string; values: readonly unknown[] }[] = [
        {
            text: `insert into competition_editions
                       (id, organization_id, series_id, name, slug, description, theme_name,
                        theme_description, show_scores, show_ranking, status, timezone,
                        starts_at, ends_at, team_min_size, team_max_size, rules_markdown,
                        results_open_at, published_at)
                   values ($1, $2, $3, 'E2E Results Feedback', $4, '',
                           null, null, true, true, 'judging', 'UTC',
                           now() - interval '2 days', now() + interval '1 day', 1, 4, '',
                           now() + interval '1 day', now())
                   on conflict do nothing`,
            values: [EDITION_ID, FIXTURE.organizationId, FIXTURE.seriesId, EDITION_SLUG],
        },
        {
            text: `insert into divisions (id, organization_id, edition_id, name, slug, description)
                   values ($1, $2, $3, 'Solo', 'solo', 'Results feedback division.')
                   on conflict do nothing`,
            values: [DIVISION_ID, FIXTURE.organizationId, EDITION_ID],
        },
        {
            text: `insert into teams
                       (id, organization_id, edition_id, division_id, name, description, status,
                        captain_user_id, max_members)
                   values ($1, $2, $3, $4, 'Feedback Ranked Team', '', 'ready', $5, 4),
                          ($6, $2, $3, $4, 'Feedback Low Review Team', '', 'ready', $5, 4)
                   on conflict do nothing`,
            values: [
                TEAM_A_ID,
                FIXTURE.organizationId,
                EDITION_ID,
                DIVISION_ID,
                FIXTURE.participantId,
                TEAM_B_ID,
            ],
        },
        {
            text: `insert into team_members (id, organization_id, team_id, user_id, role)
                   values ($1, $2, $3, $4, 'captain')
                   on conflict do nothing`,
            values: [MEMBER_A_ID, FIXTURE.organizationId, TEAM_A_ID, FIXTURE.participantId],
        },
        {
            text: `insert into projects
                       (id, organization_id, edition_id, team_id, owner_user_id, title, slug,
                        summary, description_markdown, tags, status, published_at)
                   values ($1, $2, $3, $4, $8, $5, 'feedback-ranked',
                           'Ranked project for results feedback.', 'Ranked fixture.',
                           array['feedback'], 'published', now()),
                          ($6, $2, $3, $7, $8, $9, 'feedback-low-review',
                           'Low review project for results feedback.', 'Low review fixture.',
                           array['feedback'], 'published', now()),
                          ($10, $2, $3, null, $8, $11, 'feedback-unjudged',
                           'Unjudged project for the all projects section.', 'Unjudged fixture.',
                           array['feedback'], 'published', now())
                   on conflict do nothing`,
            values: [
                PROJECT_A_ID,
                FIXTURE.organizationId,
                EDITION_ID,
                TEAM_A_ID,
                RANKED_TITLE,
                PROJECT_B_ID,
                TEAM_B_ID,
                FIXTURE.participantId,
                LOW_REVIEW_TITLE,
                PROJECT_C_ID,
                UNJUDGED_TITLE,
            ],
        },
        {
            text: `insert into submissions
                       (id, organization_id, edition_id, project_id, team_id, status,
                        current_version, submitted_at)
                   values ($1, $2, $3, $4, $5, 'submitted', 0, now()),
                          ($6, $2, $3, $7, $8, 'submitted', 0, now())
                   on conflict do nothing`,
            values: [
                SUBMISSION_A_ID,
                FIXTURE.organizationId,
                EDITION_ID,
                PROJECT_A_ID,
                TEAM_A_ID,
                SUBMISSION_B_ID,
                PROJECT_B_ID,
                TEAM_B_ID,
            ],
        },
        {
            text: `insert into voting_rounds
                       (id, organization_id, edition_id, name, description, status,
                        eligible_roles, max_selections, max_votes_per_user, opens_at, closes_at,
                        published_at)
                   values ($1, $2, $3, 'People choice', '', 'published', array['participant'],
                           10, 0, now() - interval '2 days', now() - interval '1 day', now())
                   on conflict do nothing`,
            values: [ROUND_ID, FIXTURE.organizationId, EDITION_ID],
        },
        {
            text: `insert into ballots (id, organization_id, round_id, user_id, reasoning, submitted_at)
                   values ($1, $2, $3, $4, '', now()), ($5, $2, $3, $6, '', now())
                   on conflict do nothing`,
            values: [
                BALLOT_ONE_ID,
                FIXTURE.organizationId,
                ROUND_ID,
                FIXTURE.participantId,
                BALLOT_TWO_ID,
                FIXTURE.applicantId,
            ],
        },
        {
            text: `insert into votes (id, organization_id, round_id, ballot_id, user_id,
                                  submission_id, stars)
                   values ($1, $2, $3, $4, $5, $6, 5),
                          ($7, $2, $3, $8, $9, $6, 5),
                          ($10, $2, $3, $4, $5, $11, 2),
                          ($12, $2, $3, $8, $9, $11, 2)
                   on conflict do nothing`,
            values: [
                fixtureUuid(101),
                FIXTURE.organizationId,
                ROUND_ID,
                BALLOT_ONE_ID,
                FIXTURE.participantId,
                SUBMISSION_A_ID,
                fixtureUuid(102),
                BALLOT_TWO_ID,
                FIXTURE.applicantId,
                fixtureUuid(103),
                SUBMISSION_B_ID,
                fixtureUuid(104),
            ],
        },
    ];

    for (const [reviewerIndex, reviewer] of REVIEWERS.entries()) {
        const assignmentId = fixtureUuid(201 + reviewerIndex);
        const evaluationId = fixtureUuid(301 + reviewerIndex);
        statements.push(
            {
                text: `insert into judge_assignments
                           (id, organization_id, edition_id, rubric_id, submission_id,
                            judge_user_id, status, assignment_note, due_at, assigned_by_user_id)
                       values ($1, $2, $3, $4, $5, $6, 'assigned', '', now() + interval '1 day',
                               $7)
                       on conflict do nothing`,
                values: [
                    assignmentId,
                    FIXTURE.organizationId,
                    EDITION_ID,
                    FIXTURE.labRubricId,
                    SUBMISSION_A_ID,
                    reviewer.userId,
                    FIXTURE.organizerId,
                ],
            },
            {
                text: `insert into evaluations
                           (id, organization_id, assignment_id, judge_user_id, status,
                            overall_comment, weighted_score, submitted_at)
                       values ($1, $2, $3, $4, 'submitted', $5, 92, now())
                       on conflict do nothing`,
                values: [
                    evaluationId,
                    FIXTURE.organizationId,
                    assignmentId,
                    reviewer.userId,
                    reviewer.comment,
                ],
            },
        );
    }

    statements.push(
        {
            text: `insert into judge_assignments
                       (id, organization_id, edition_id, rubric_id, submission_id, judge_user_id,
                        status, assignment_note, due_at, assigned_by_user_id)
                   values ($1, $2, $3, $4, $5, $6, 'assigned', '', now() + interval '1 day', $7)
                   on conflict do nothing`,
            values: [
                fixtureUuid(401),
                FIXTURE.organizationId,
                EDITION_ID,
                FIXTURE.labRubricId,
                SUBMISSION_B_ID,
                FIXTURE.judgeId,
                FIXTURE.organizerId,
            ],
        },
        {
            text: `insert into evaluations
                       (id, organization_id, assignment_id, judge_user_id, status, overall_comment,
                        weighted_score, submitted_at)
                   values ($1, $2, $3, $4, 'submitted', 'Single review.', 60, now())
                   on conflict do nothing`,
            values: [fixtureUuid(501), FIXTURE.organizationId, fixtureUuid(401), FIXTURE.judgeId],
        },
    );

    await ownerTenantBatch(FIXTURE.organizationId, statements);
}

async function cleanupFixture(): Promise<void> {
    await ownerTenantBatch(FIXTURE.organizationId, [
        {
            text: "delete from edition_results where edition_id = $1",
            values: [EDITION_ID],
        },
        {
            text: "delete from votes where round_id = $1",
            values: [ROUND_ID],
        },
        {
            text: "delete from ballots where round_id = $1",
            values: [ROUND_ID],
        },
        {
            text: "delete from voting_rounds where id = $1",
            values: [ROUND_ID],
        },
        {
            text: "delete from evaluations where assignment_id in (select id from judge_assignments where edition_id = $1)",
            values: [EDITION_ID],
        },
        {
            text: "delete from judge_assignments where edition_id = $1",
            values: [EDITION_ID],
        },
        {
            text: "delete from submissions where edition_id = $1",
            values: [EDITION_ID],
        },
        {
            text: "delete from projects where edition_id = $1",
            values: [EDITION_ID],
        },
        {
            text: "delete from team_members where team_id in ($1, $2)",
            values: [TEAM_A_ID, TEAM_B_ID],
        },
        {
            text: "delete from teams where edition_id = $1",
            values: [EDITION_ID],
        },
        {
            text: "delete from divisions where edition_id = $1",
            values: [EDITION_ID],
        },
        {
            text: "delete from competition_editions where id = $1",
            values: [EDITION_ID],
        },
    ]);
}

test.describe("results feedback and all projects", () => {
    test("shows the scheduled release, withholds low review results, previews every project, and returns participant feedback", async ({
        page,
    }) => {
        test.setTimeout(300_000);
        await cleanupFixture();
        await seedFixture();
        await ownerTenantQuery(
            FIXTURE.organizationId,
            "delete from edition_results where organization_id = $1",
            [FIXTURE.organizationId],
        );

        await signIn(page, USERS.organizer);
        const token = await csrfToken(page);

        await test.step("locked results show the scheduled release", async () => {
            await page.goto(`${SITE_ORIGIN}/results`);
            await expect(page.getByText("Results not published yet")).toBeVisible();
            await expect(page.getByText(/Scheduled release:/)).toBeVisible();
        });

        await test.step("publish the new edition results", async () => {
            const response = await page.request.post(
                `${API_ORIGIN}/api/v1/competitions/${EDITION_ID}/results/publish`,
                { headers: requestHeaders(token) },
            );
            expect(response.status()).toBe(200);
        });

        await test.step("low review withholding and People's Choice preview", async () => {
            await page.goto(`${SITE_ORIGIN}/results`);
            await expect(page.getByRole("heading", { name: "Results", level: 1 })).toBeVisible();
            await expect(page.getByText(RANKED_TITLE).first()).toBeVisible();

            const tracks = page.getByRole("region", { name: "Results by track" });
            const lowReviewRow = tracks.locator("li").filter({ hasText: LOW_REVIEW_TITLE });
            await expect(lowReviewRow.getByText(/Not enough reviews/)).toBeVisible();
            await expect(lowReviewRow.getByText(/Rank #/)).toHaveCount(0);

            await expect(tracks.getByText(RANKED_TITLE, { exact: true }).first()).toBeVisible();
            await expect(tracks.getByText(/Rank #\d+/).first()).toBeVisible();

            await page.getByRole("button", { name: "Preview project" }).first().click();
            const dialog = page.getByRole("dialog");
            await expect(dialog.getByText(RANKED_TITLE).first()).toBeVisible();
            await expect(dialog.getByText("AI-use disclosure", { exact: true })).toBeVisible();
            await page.keyboard.press("Escape");
            await expect(dialog).toBeHidden();
        });

        await test.step("all submitted projects include unjudged projects", async () => {
            const allProjects = page.getByRole("region", { name: "All submitted projects" });
            await expect(allProjects.getByText(UNJUDGED_TITLE)).toBeVisible();
            const projectCard = allProjects
                .locator("div")
                .filter({ has: page.getByRole("link", { name: UNJUDGED_TITLE, exact: true }) })
                .last();
            await projectCard.getByRole("button", { name: "Preview project" }).click();
            const dialog = page.getByRole("dialog");
            await expect(dialog.getByText(UNJUDGED_TITLE).first()).toBeVisible();
            await page.keyboard.press("Escape");
            await expect(dialog).toBeHidden();
        });

        await test.step("participant results expose score, rank, and anonymous feedback", async () => {
            await signIn(page, USERS.participant);
            const response = await page.request.get(
                `${API_ORIGIN}/api/v1/competitions/${EDITION_ID}/my-results`,
                { headers: { "x-nethack-organization-id": FIXTURE.organizationId } },
            );
            expect(response.status()).toBe(200);
            const body = (await response.json()) as {
                current: {
                    score: number | null;
                    rank: number | null;
                    feedback: { comment: string; submittedAt: string | null }[];
                } | null;
            };
            expect(body.current?.score).toBe(92);
            expect(body.current?.rank).toBe(1);
            expect(body.current?.feedback).toHaveLength(REVIEWERS.length);
            const comments = body.current?.feedback.map((entry) => entry.comment) ?? [];
            for (const reviewer of REVIEWERS) {
                expect(comments).toContain(reviewer.comment);
            }
            for (const entry of body.current?.feedback ?? []) {
                expect(Object.keys(entry).toSorted()).toEqual(["comment", "submittedAt"]);
            }
        });

        await cleanupFixture();
    });
});
