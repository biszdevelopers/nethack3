import { expect, test } from "@playwright/test";
import { FIXTURE, USERS } from "../support/e2e/config.js";
import { expectToast, newAppContext, signIn } from "../support/e2e/app.js";

test.describe("judge workflow", () => {
    test("opens an assignment from the judging list", async ({ page }) => {
        await signIn(page, USERS.judge);
        await page.goto("/judging");
        const row = page.getByRole("row", { name: new RegExp(FIXTURE.labProjectTitle) });
        await expect(row).toBeVisible();
        const link = row.getByRole("link", { name: "Open assignment" });
        const href = await link.getAttribute("href");
        expect(href).not.toBeNull();
        const assignmentId = (href ?? "").split("/").at(-1) ?? "";
        expect(assignmentId).not.toBe("");

        await link.click();
        await expect(page).toHaveURL(new RegExp(`/judging/assignments/${assignmentId}$`));
        await expect(
            page.getByRole("heading", { name: FIXTURE.labProjectTitle, level: 1 }),
        ).toBeVisible();
    });

    test("avoids a conflict, scores the rubric, saves a draft, and submits the evaluation", async ({
        page,
        browser,
    }) => {
        test.setTimeout(180_000);
        await signIn(page, USERS.judge);
        await page.goto(`/judging/assignments/${FIXTURE.labAssignmentId}`);
        await expect(
            page.getByRole("heading", { name: FIXTURE.labProjectTitle, level: 1 }),
        ).toBeVisible();
        await expect(page.getByText("Assigned", { exact: true }).first()).toBeVisible();

        await test.step("open the recusal flow without recusing", async () => {
            await page.getByRole("button", { name: "Recuse from this project" }).click();
            const dialog = page.getByRole("dialog", { name: "Recuse from this project" });
            await expect(dialog).toBeVisible();
            await dialog.getByRole("button", { name: "Cancel" }).click();
            await expect(dialog).toBeHidden();
            await expect(page.getByText("Conflict declared", { exact: true })).toBeHidden();
        });

        await test.step("score each criterion and save a draft", async () => {
            await page.getByRole("spinbutton", { name: "Score for Impact" }).fill("8");
            await page.getByLabel("Comment on Impact").fill("Strong reach.");
            await page.getByRole("spinbutton", { name: "Score for Craft" }).fill("9");
            await page.getByLabel("Comment on Craft").fill("Careful execution.");
            await page.getByLabel("Overall comment").fill("An 85 percent evaluation.");
            await page.getByRole("button", { name: "Save draft" }).click();
            await expectToast(page, "Draft saved");
            await expect(page.getByText("Draft", { exact: true }).first()).toBeVisible();
        });

        await test.step("submit the evaluation", async () => {
            await page.getByRole("button", { name: "Submit evaluation" }).click();
            const dialog = page.getByRole("alertdialog", { name: "Submit evaluation" });
            await expect(dialog).toBeVisible();
            await dialog.getByRole("button", { name: "Submit evaluation" }).click();
            await expectToast(page, "Evaluation submitted");
            await expect(page.getByText("Submitted", { exact: true }).first()).toBeVisible();
        });

        await test.step("shows the submitted scores and history", async () => {
            await expect(page.getByText("8 / 10")).toBeVisible();
            await expect(page.getByText("9 / 10")).toBeVisible();
            await expect(page.getByText("85%").first()).toBeVisible();
            await expect(page.getByText("Submitted", { exact: true }).first()).toBeVisible();
        });

        await test.step("organizer sees the evaluated submission in the edition results", async () => {
            const organizerContext = await newAppContext(browser);
            try {
                const organizerPage = await organizerContext.newPage();
                await signIn(organizerPage, USERS.organizer);
                await organizerPage.goto(`/judging?edition=${FIXTURE.editionId}`);
                const results = organizerPage.getByRole("region", { name: "Results" });
                await expect(results).toBeVisible();
                const row = results.getByRole("row", {
                    name: new RegExp(FIXTURE.labProjectTitle),
                });
                await expect(row).toBeVisible();
                await expect(row.getByText("85.00 / 100").first()).toBeVisible();
                await expect(row.getByText("1 of 1 submitted")).toBeVisible();
            } finally {
                await organizerContext.close();
            }
        });
    });
});
