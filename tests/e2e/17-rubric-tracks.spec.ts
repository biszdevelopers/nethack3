import { expect, test } from "@playwright/test";
import { FIXTURE, USERS } from "../support/e2e/config.js";
import { chooseOption, expectToast, newAppContext, signIn } from "../support/e2e/app.js";
import { ownerTenantBatch } from "../support/e2e/db.js";

const PROJECT_ID = "f6000000-0000-4000-8000-000000000060";
const SUBMISSION_ID = "f6000000-0000-4000-8000-000000000070";
const PROJECT_TITLE = "Rubric Parity Project";
const RUN = Date.now().toString(36).slice(-6);
const RUBRIC_NAME = `E2E Division Rubric ${RUN}`;
const TEMPLATE_NAME = `E2E Template ${RUN}`;
const APPLIED_NAME = `${TEMPLATE_NAME} — Open`;
const GUIDANCE = "Focus on evidence and one next step.";
const TEMPLATE_BODY =
    "Strength: {{describe a specific decision}}\nNext step: {{suggest one action}}";

test.describe("rubric tracks, templates, versions, and the score curve", () => {
    test.beforeAll(async () => {
        await ownerTenantBatch(FIXTURE.organizationId, [
            {
                text: `insert into projects
                       (id, organization_id, edition_id, owner_user_id, title, slug, summary,
                        description_markdown, tags, status, published_at)
                       values ($1, $2, $3, $4, $5, $6,
                               'A fixture project for rubric parity.',
                               'Rubric parity fixture.', array['judging'], 'published', now())
                       on conflict (id) do nothing`,
                values: [
                    PROJECT_ID,
                    FIXTURE.organizationId,
                    FIXTURE.editionId,
                    FIXTURE.organizerId,
                    PROJECT_TITLE,
                    `rubric-parity-project-${RUN}`,
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
        ]);
    });

    test("creates a division rubric, publishes versions, applies a template, and curves a judge score", async ({
        page,
        browser,
    }) => {
        test.setTimeout(360_000);
        await signIn(page, USERS.organizer);

        await test.step("creates a division-scoped rubric with a minimum and guidance", async () => {
            await page.goto(`/judging/rubrics?edition=${FIXTURE.editionId}`);
            await expect(
                page.getByRole("heading", { name: "Judging rubrics", level: 1 }),
            ).toBeVisible();
            await expect(page.getByRole("heading", { name: "Version history" })).toBeVisible();
            await page.getByRole("button", { name: "New rubric" }).click();
            await page.getByLabel("Name", { exact: true }).fill(RUBRIC_NAME);
            await chooseOption(page.getByLabel("Division"), "Open");
            await page.getByLabel("Criterion 1 name").fill("Impact");
            await page.locator("#rubric-description").fill("Reach of the work.");
            await page.getByLabel("Minimum").fill("1");
            await page.getByLabel("Maximum").fill("10");
            await page.getByLabel("Weight").fill("100");
            await page.getByLabel("Introduction").fill(GUIDANCE);
            await page.getByRole("button", { name: "Add template" }).click();
            await page.getByLabel("Template label").fill("Strength + next step");
            await page.getByLabel("Template body").fill(TEMPLATE_BODY);
            await page.getByRole("button", { name: "Create rubric" }).click();
            await expectToast(page, "Rubric created");
            await expect(page.getByRole("row", { name: new RegExp(RUBRIC_NAME) })).toBeVisible();
        });

        await test.step("saves a new immutable version", async () => {
            await page.locator("#rubric-description").fill("Reach and craft.");
            await page.getByRole("button", { name: "Save new version" }).click();
            await expectToast(page, "Rubric version 2 is active");
            await expect(
                page.getByRole("row", { name: new RegExp(`${RUBRIC_NAME}.*v2`) }),
            ).toBeVisible();
        });

        await test.step("saves and applies a reusable template", async () => {
            await page.getByLabel("Template name").fill(TEMPLATE_NAME);
            await page.getByLabel("Template description").fill("Reusable rubric starting point.");
            await page.getByRole("button", { name: "Save as new template" }).click();
            await expectToast(page, "Template saved");
            const templateItem = page
                .getByRole("listitem")
                .filter({ hasText: TEMPLATE_NAME })
                .first();
            await expect(templateItem).toBeVisible();
            await templateItem.getByRole("button", { name: "Apply Open to edition" }).click();
            await expectToast(page, "Template applied as a new rubric version");
            await expect(
                page.getByRole("row", { name: new RegExp(`${APPLIED_NAME}.*v1`) }),
            ).toBeVisible();
        });

        await test.step("edits the display score curve", async () => {
            await page.getByRole("button", { name: "Add point" }).click();
            await page.getByLabel("Raw score 2").fill("50");
            await page.getByLabel("Display score 2").fill("60");
            await page.getByRole("button", { name: "Save curve" }).click();
            await expectToast(page, "Score curve saved");
        });

        await test.step("assigns the judge against the applied rubric", async () => {
            await page.goto(`/judging?edition=${FIXTURE.editionId}`);
            await expect(
                page.getByRole("heading", { name: "Assignment management", level: 2 }),
            ).toBeVisible();
            await chooseOption(
                page.getByLabel("Submission"),
                `${PROJECT_TITLE} · No team (Submitted)`,
            );
            await chooseOption(
                page.getByRole("combobox", { name: "Rubric" }),
                `${APPLIED_NAME} (1 criteria)`,
            );
            await page.getByLabel("Judge email").fill(USERS.judge.email);
            await page.getByRole("button", { name: "Create assignment" }).click();
            await expectToast(page, "Assignment created");
        });

        const judgeContext = await newAppContext(browser);
        try {
            const judgePage = await judgeContext.newPage();
            await signIn(judgePage, USERS.judge);
            await judgePage.goto("/judging");
            const row = judgePage.getByRole("row", { name: new RegExp(PROJECT_TITLE) });
            await expect(row).toBeVisible();
            await row.getByRole("link", { name: "Open assignment" }).click();

            await test.step("the judge sees the pinned rubric guidance", async () => {
                await expect(
                    judgePage.getByRole("heading", { name: PROJECT_TITLE, level: 1 }),
                ).toBeVisible();
                await expect(judgePage.getByText(APPLIED_NAME)).toBeVisible();
                await expect(judgePage.getByText(GUIDANCE)).toBeVisible();
                await expect(
                    judgePage.getByRole("button", { name: "Strength + next step" }),
                ).toBeVisible();
            });

            await test.step("the template fills the overall comment", async () => {
                await judgePage.getByRole("button", { name: "Strength + next step" }).click();
                await expect(judgePage.getByLabel("Overall comment")).toHaveValue(
                    new RegExp("Strength:"),
                );
                await judgePage.getByLabel("Overall comment").fill("Clear and useful feedback.");
            });

            await test.step("the curve adjusts the displayed score but not the raw score", async () => {
                await judgePage.getByRole("spinbutton", { name: "Score for Impact" }).fill("5");
                await judgePage.getByLabel("Comment on Impact").fill("Solid evidence.");
                await judgePage.getByRole("button", { name: "Save draft" }).click();
                await expectToast(judgePage, "Draft saved");
                await expect(judgePage.getByText("44.44 / 100")).toBeVisible();
                await expect(judgePage.getByText("Display 53 / 100")).toBeVisible();
            });
        } finally {
            await judgeContext.close();
        }
    });
});
