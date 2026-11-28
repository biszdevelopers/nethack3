import { expect, test } from "@playwright/test";
import { FIXTURE, USERS } from "../support/e2e/config.js";
import { expectToast, newAppContext, signIn } from "../support/e2e/app.js";
import { ownerQuery, ownerTenantBatch } from "../support/e2e/db.js";

const PROJECT_ID = "f5000000-0000-4000-8000-000000000060";
const SUBMISSION_ID = "f5000000-0000-4000-8000-000000000070";
const ASSIGNMENT_ID = "f5000000-0000-4000-8000-000000000030";
const PROJECT_TITLE = "Queue Workflow Project";
const FLAG_REASON = "Queue workflow flag for organizer review.";
const AUTHOR_ID = "f2000000-0000-4000-8000-000000000041";

test.describe("judging workflow", () => {
    test.beforeAll(async () => {
        await ownerTenantBatch(FIXTURE.organizationId, [
            {
                text: `insert into projects
                       (id, organization_id, edition_id, owner_user_id, title, slug, summary,
                        description_markdown, tags, status, published_at)
                       values ($1, $2, $3, $4, $5, 'queue-workflow-project',
                               'A fixture project for the judging queue workflow.',
                               'Judging queue fixture.', array['judging'], 'published', now())
                       on conflict (id) do nothing`,
                values: [
                    PROJECT_ID,
                    FIXTURE.organizationId,
                    FIXTURE.editionId,
                    AUTHOR_ID,
                    PROJECT_TITLE,
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
                               'Queue workflow assignment.', now() + interval '7 days', $7)
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

    test("judges from the queue, reviews history, and an organizer resolves a flag", async ({
        page,
        browser,
    }) => {
        test.setTimeout(300_000);
        await signIn(page, USERS.judge);

        await test.step("shows progress and assignments on the overview", async () => {
            await page.goto("/judging");
            await expect(
                page.getByRole("heading", { name: "My assignments", level: 2 }),
            ).toBeVisible();
            await expect(
                page.getByRole("progressbar", { name: "Evaluations submitted" }),
            ).toBeVisible();
            await expect(page.getByText(PROJECT_TITLE).first()).toBeVisible();
        });

        await test.step("opens the queue at the next unscored project", async () => {
            await page.getByRole("tab", { name: "Continue judging" }).click();
            await expect(
                page.getByRole("heading", { name: "Continue judging", level: 2 }),
            ).toBeVisible();
            await expect(
                page.getByRole("heading", { name: PROJECT_TITLE, level: 3 }),
            ).toBeVisible();
            await expect(page.getByRole("group", { name: "Judging queue controls" })).toBeVisible();
            await expect(page.getByText("Judging queue fixture.").first()).toBeVisible();
            await expect(page.getByText("No team").first()).toBeVisible();
            await expect(page.getByText("Submitted", { exact: true }).first()).toBeVisible();
            await page.getByRole("link", { name: "Open project" }).click();
            await expect(page).toHaveURL(new RegExp(`/judging/assignments/${ASSIGNMENT_ID}$`));
            await expect(
                page.getByRole("heading", { name: PROJECT_TITLE, level: 1 }),
            ).toBeVisible();
        });

        await test.step("saves a draft and submits the evaluation", async () => {
            await page.getByRole("radio", { name: "7 of 10 for Impact" }).check();
            await page.getByLabel("Comment on Impact").fill("Useful reach.");
            await page.getByRole("radio", { name: "8 of 10 for Craft" }).check();
            await page.getByLabel("Comment on Craft").fill("Solid execution.");
            await page.getByLabel("Overall comment").fill("Queue workflow evaluation.");
            await page.getByRole("button", { name: "Save draft" }).click();
            await expectToast(page, "Draft saved");
            await page.getByRole("button", { name: "Submit evaluation" }).click();
            const dialog = page.getByRole("alertdialog", { name: "Submit evaluation" });
            await expect(dialog).toBeVisible();
            await dialog.getByRole("button", { name: "Submit evaluation" }).click();
            await expectToast(page, "Evaluation submitted");
            await expect(page.getByText("Submitted", { exact: true }).first()).toBeVisible();
        });

        await test.step("flags the submitted project for the organizers", async () => {
            await page.getByRole("button", { name: "Flag for organizers" }).click();
            const dialog = page.getByRole("dialog", {
                name: "Flag this project for organizers",
            });
            await expect(dialog).toBeVisible();
            await dialog.getByLabel("Reason").fill(FLAG_REASON);
            await dialog.getByRole("button", { name: "Report flag" }).click();
            await expectToast(page, "Flag reported to the organizers");
        });

        await test.step("sees the submitted evaluation in history", async () => {
            await page.getByRole("link", { name: "Back to judging" }).click();
            await page.getByRole("tab", { name: "History" }).click();
            const row = page.getByRole("row", { name: new RegExp(PROJECT_TITLE) });
            await expect(row).toBeVisible();
            await expect(row.getByText("75.00 / 100")).toBeVisible();
            await page.getByRole("link", { name: "Open evaluation history" }).click();
            await expect(page).toHaveURL(/\/judging\/history\?edition=/);
            await expect(
                page.getByRole("heading", { name: "Judging history", level: 1 }),
            ).toBeVisible();
            await expect(
                page.getByRole("heading", { name: PROJECT_TITLE, level: 3 }),
            ).toBeVisible();
            await expect(page.getByText("No team").first()).toBeVisible();
            await expect(page.getByText("Judging queue fixture.").first()).toBeVisible();
            await expect(page.getByText("Submitted", { exact: true }).first()).toBeVisible();
            await expect(page.getByText("Queue workflow evaluation.")).toBeVisible();
            await expect(page.getByText("7 / 10", { exact: false }).first()).toBeVisible();
            await expect(page.getByText("8 / 10", { exact: false }).first()).toBeVisible();
        });

        await test.step("organizer sees coverage and resolves the flag", async () => {
            const organizerContext = await newAppContext(browser);
            try {
                const organizerPage = await organizerContext.newPage();
                await signIn(organizerPage, USERS.organizer);
                await organizerPage.goto(`/judging?edition=${FIXTURE.editionId}`);
                await organizerPage.getByRole("tab", { name: "Coverage" }).click();
                await expect(
                    organizerPage.getByRole("heading", { name: "Coverage", level: 2 }),
                ).toBeVisible();
                const coverage = organizerPage.getByRole("region", { name: "Coverage" });
                await expect(
                    coverage.getByRole("columnheader", { name: "Calibration" }),
                ).toBeVisible();
                await expect(coverage.getByText("Fixture Judge").first()).toBeVisible();
                const flagRow = coverage.getByRole("row", {
                    name: new RegExp(FLAG_REASON),
                });
                await expect(flagRow).toBeVisible();
                await flagRow.getByRole("button", { name: "Resolve" }).click();
                await expectToast(organizerPage, "Flag resolved");
                await expect(
                    organizerPage.getByRole("row", { name: new RegExp(FLAG_REASON) }),
                ).toBeHidden();
                await expect(organizerPage.getByText("No open flags")).toBeVisible();

                await test.step("organizer receives the flag notification", async () => {
                    await expect
                        .poll(
                            async () =>
                                (
                                    await ownerQuery<{ count: number }>(
                                        `select count(*)::int as count
                                           from notifications
                                          where user_id = $1 and title = 'Judging flag reported'`,
                                        [FIXTURE.organizerId],
                                    )
                                )[0]?.count ?? 0,
                            { timeout: 20_000 },
                        )
                        .toBeGreaterThan(0);
                    await organizerPage.goto("/notifications");
                    await expect(
                        organizerPage.getByText("Judging flag reported").first(),
                    ).toBeVisible();
                });
            } finally {
                await organizerContext.close();
            }
        });
    });
});
