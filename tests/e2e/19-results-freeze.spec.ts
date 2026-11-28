import { expect, test, type Page } from "@playwright/test";
import { API_ORIGIN, FIXTURE, USERS, WORKSPACE_ORIGIN } from "../support/e2e/config.js";
import { chooseOption, expectToast, newAppContext, signIn } from "../support/e2e/app.js";
import { ownerTenantBatch, ownerTenantQuery } from "../support/e2e/db.js";

const ROUND_NAME = "E2E Freeze Round";
const PROJECT_ID = "f6000000-0000-4000-8000-000000000001";
const SUBMISSION_ID = "f6000000-0000-4000-8000-000000000002";
const ASSIGNMENT_ID = "f6000000-0000-4000-8000-000000000003";

interface Criterion {
    readonly id: string;
    readonly minScore: number;
    readonly maxScore: number;
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

async function submissionIdsByTitle(): Promise<ReadonlyMap<string, string>> {
    const rows = await ownerTenantQuery<{ id: string; title: string }>(
        FIXTURE.organizationId,
        `select s.id, v.title
           from submissions s
           join submission_versions v
             on v.submission_id = s.id and v.version = s.current_version
          where s.organization_id = $1 and s.edition_id = $2`,
        [FIXTURE.organizationId, FIXTURE.editionId],
    );
    return new Map(rows.map((row) => [row.title, row.id]));
}

async function editionStatus(): Promise<string> {
    const rows = await ownerTenantQuery<{ status: string }>(
        FIXTURE.organizationId,
        "select status from competition_editions where id = $1",
        [FIXTURE.editionId],
    );
    return rows[0]?.status ?? "";
}

async function openRoundCount(): Promise<number> {
    const rows = await ownerTenantQuery<{ count: number }>(
        FIXTURE.organizationId,
        "select count(*)::int as count from voting_rounds where edition_id = $1 and status = 'open'",
        [FIXTURE.editionId],
    );
    return rows[0]?.count ?? 0;
}

test.describe("results publication freeze", () => {
    test.beforeAll(async () => {
        await ownerTenantBatch(FIXTURE.organizationId, [
            {
                text: `insert into projects
                       (id, organization_id, edition_id, team_id, owner_user_id, title, slug,
                        summary, description_markdown, tags, status, published_at)
                       values ($1, $2, $3, null, $4, 'Freeze Evaluation Project',
                               'freeze-evaluation-project', 'Results freeze fixture.',
                               'Results freeze fixture.', array['freeze'], 'published', now())
                       on conflict (id) do nothing`,
                values: [
                    PROJECT_ID,
                    FIXTURE.organizationId,
                    FIXTURE.editionId,
                    FIXTURE.participantId,
                ],
            },
            {
                text: `insert into submissions
                       (id, organization_id, edition_id, project_id, team_id, status,
                        current_version, submitted_at)
                       values ($1, $2, $3, $4, null, 'submitted', 0, now())
                       on conflict (id) do nothing`,
                values: [SUBMISSION_ID, FIXTURE.organizationId, FIXTURE.editionId, PROJECT_ID],
            },
            {
                text: `insert into judge_assignments
                       (id, organization_id, edition_id, rubric_id, submission_id, judge_user_id,
                        status, assignment_note, due_at, assigned_by_user_id)
                       values ($1, $2, $3, $4, $5, $6, 'assigned',
                               'Results freeze assignment.', now() + interval '7 days', $7)
                       on conflict do nothing`,
                values: [
                    ASSIGNMENT_ID,
                    FIXTURE.organizationId,
                    FIXTURE.editionId,
                    FIXTURE.labRubricId,
                    SUBMISSION_ID,
                    FIXTURE.judgeId,
                    FIXTURE.organizerId,
                ],
            },
        ]);
    });

    test("publishing freezes voting and judging, notifies participants, and unpublishing restores", async ({
        page,
        browser,
    }) => {
        test.setTimeout(300_000);
        await signIn(page, USERS.organizer);

        const criteria = await ownerTenantQuery<Criterion>(
            FIXTURE.organizationId,
            `select id, min_score as "minScore", max_score as "maxScore"
               from judging_criteria
              where rubric_id = $1
              order by position`,
            [FIXTURE.labRubricId],
        );
        expect(criteria.length).toBeGreaterThan(0);
        const evaluationScores = criteria.map((criterion) => ({
            criterionId: criterion.id,
            score: Math.max(criterion.minScore, Math.min(5, criterion.maxScore)),
            comment: "Results freeze probe.",
        }));

        const organizerToken = await csrfToken(page);

        await test.step("clear any earlier publication", async () => {
            const cleanup = await page.request.delete(
                `${API_ORIGIN}/api/v1/competitions/${FIXTURE.editionId}/results/publish`,
                { headers: requestHeaders(organizerToken) },
            );
            expect([204, 404]).toContain(cleanup.status());
        });
        const previousStatus = await editionStatus();

        const ids = await submissionIdsByTitle();
        const fixtureId = ids.get(FIXTURE.projectTitle) ?? "";
        const labId = ids.get(FIXTURE.labProjectTitle) ?? "";
        expect(fixtureId).not.toBe("");
        expect(labId).not.toBe("");

        let roundId = "";
        await test.step("open a round with a per-voter cap", async () => {
            const created = await page.request.post(
                `${API_ORIGIN}/api/v1/competitions/${FIXTURE.editionId}/voting-rounds`,
                {
                    headers: requestHeaders(organizerToken),
                    data: {
                        name: ROUND_NAME,
                        description: "Freeze journey round.",
                        eligibleRoles: ["participant"],
                        maxSelections: 10,
                        maxVotesPerUser: 2,
                        opensAt: null,
                        closesAt: null,
                    },
                },
            );
            expect(created.status()).toBe(201);
            const round = (await created.json()) as { id: string; maxVotesPerUser: number };
            expect(round.maxVotesPerUser).toBe(2);
            roundId = round.id;
            const opened = await page.request.post(
                `${API_ORIGIN}/api/v1/voting-rounds/${roundId}/open`,
                { headers: requestHeaders(organizerToken) },
            );
            expect(opened.status()).toBe(200);
        });

        const participantContext = await newAppContext(browser);
        try {
            const participantPage = await participantContext.newPage();
            await signIn(participantPage, USERS.participant);
            const participantToken = await csrfToken(participantPage);

            await test.step("participant casts a reasoned ballot", async () => {
                const response = await participantPage.request.post(
                    `${API_ORIGIN}/api/v1/voting-rounds/${roundId}/ballot`,
                    {
                        headers: requestHeaders(participantToken),
                        data: {
                            scores: [
                                { submissionId: fixtureId, stars: 5 },
                                { submissionId: labId, stars: 5 },
                            ],
                            reasoning: "Freeze journey reasoning.",
                        },
                    },
                );
                expect(response.status()).toBe(201);
            });

            const judgeContext = await newAppContext(browser);
            try {
                const judgePage = await judgeContext.newPage();
                await signIn(judgePage, USERS.judge);
                const judgeToken = await csrfToken(judgePage);

                await test.step("publish the results from the awards page", async () => {
                    await page.goto("/awards");
                    await chooseOption(page.getByLabel("Competition edition"), FIXTURE.editionName);
                    await page.getByRole("button", { name: "Publish results" }).click();
                    const dialog = page.getByRole("alertdialog", {
                        name: "Publish results",
                    });
                    await expect(dialog).toBeVisible();
                    await expect(dialog).toContainText("freezes the edition");
                    await expect(dialog).toContainText("voting rounds close");
                    await expect(dialog).toContainText("judges can no longer");
                    await dialog.getByRole("button", { name: "Publish results" }).click();
                    await expectToast(page, "Results published");
                });

                await test.step("the edition is completed and open rounds are closed", async () => {
                    await expect.poll(editionStatus).toBe("completed");
                    expect(await openRoundCount()).toBe(0);
                });

                await test.step("voting mutations are frozen", async () => {
                    const blockedRound = await page.request.post(
                        `${API_ORIGIN}/api/v1/competitions/${FIXTURE.editionId}/voting-rounds`,
                        {
                            headers: requestHeaders(organizerToken),
                            data: {
                                name: "E2E Frozen Round",
                                description: "",
                                eligibleRoles: ["participant"],
                                maxSelections: 10,
                                maxVotesPerUser: 0,
                                opensAt: null,
                                closesAt: null,
                            },
                        },
                    );
                    expect(blockedRound.status()).toBe(409);

                    await page.goto(`/voting?edition=${FIXTURE.editionId}`);
                    const form = page
                        .getByRole("button", { name: "Create round" })
                        .locator("xpath=ancestor::form");
                    await form.getByLabel("Name").fill("E2E Frozen Round");
                    await form.getByRole("button", { name: "Create round" }).click();
                    await expectToast(page, "Could not create the voting round");
                });

                await test.step("judging evaluation saves and submits are frozen", async () => {
                    const saved = await judgePage.request.put(
                        `${API_ORIGIN}/api/v1/assignments/${ASSIGNMENT_ID}/evaluation`,
                        {
                            headers: requestHeaders(judgeToken),
                            data: { scores: evaluationScores, overallComment: "Frozen probe." },
                        },
                    );
                    expect([403, 409]).toContain(saved.status());
                    const submitted = await judgePage.request.post(
                        `${API_ORIGIN}/api/v1/assignments/${ASSIGNMENT_ID}/evaluation/submit`,
                        { headers: requestHeaders(judgeToken) },
                    );
                    expect([403, 409]).toContain(submitted.status());
                });

                await test.step("participants receive one results notification", async () => {
                    await expect
                        .poll(
                            async () => {
                                const rows = await ownerTenantQuery<{ count: number }>(
                                    FIXTURE.organizationId,
                                    `select count(*)::int as count
                                       from notifications
                                      where user_id = $1 and title = 'Results published'`,
                                    [FIXTURE.participantId],
                                );
                                return rows[0]?.count ?? 0;
                            },
                            { timeout: 60_000 },
                        )
                        .toBe(1);
                    await participantPage.goto("/notifications");
                    await expect(
                        participantPage.getByText("Results published").first(),
                    ).toBeVisible({ timeout: 30_000 });
                });

                await test.step("unpublishing restores the previous edition status", async () => {
                    await page.goto("/awards");
                    await chooseOption(page.getByLabel("Competition edition"), FIXTURE.editionName);
                    await page.getByRole("button", { name: "Unpublish results" }).click();
                    const dialog = page.getByRole("alertdialog", {
                        name: "Unpublish results",
                    });
                    await expect(dialog).toBeVisible();
                    await dialog.getByRole("button", { name: "Unpublish results" }).click();
                    await expectToast(page, "Results unpublished");
                    await expect.poll(editionStatus).toBe(previousStatus);
                    expect(await openRoundCount()).toBe(0);
                });

                await test.step("voting and judging accept writes again after the explicit reopen", async () => {
                    const allowedRound = await page.request.post(
                        `${API_ORIGIN}/api/v1/competitions/${FIXTURE.editionId}/voting-rounds`,
                        {
                            headers: requestHeaders(organizerToken),
                            data: {
                                name: "E2E Reopened Round",
                                description: "",
                                eligibleRoles: ["participant"],
                                maxSelections: 10,
                                maxVotesPerUser: 0,
                                opensAt: null,
                                closesAt: null,
                            },
                        },
                    );
                    expect(allowedRound.status()).toBe(201);

                    const saved = await judgePage.request.put(
                        `${API_ORIGIN}/api/v1/assignments/${ASSIGNMENT_ID}/evaluation`,
                        {
                            headers: requestHeaders(judgeToken),
                            data: { scores: evaluationScores, overallComment: "Reopened probe." },
                        },
                    );
                    expect(saved.status()).toBe(200);
                });
            } finally {
                await judgeContext.close();
            }
        } finally {
            await participantContext.close();
        }
    });
});
