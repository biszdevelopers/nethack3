import { expect, test, type Locator } from "@playwright/test";
import { API_ORIGIN, FIXTURE, SITE_ORIGIN, USERS } from "../support/e2e/config.js";
import { expectToast, signIn } from "../support/e2e/app.js";

function siteUrl(path: string): string {
    return new URL(path, SITE_ORIGIN).toString();
}

async function enableSwitch(form: Locator, name: string): Promise<void> {
    const toggle = form.getByRole("switch", { name });
    if (!(await toggle.isChecked())) {
        await toggle.click();
    }
    await expect(toggle).toBeChecked();
}

const THEME_NAME = "Beneath the surface";
const THEME_DESCRIPTION = "Build something that hides more than it shows.";

test.describe("edition theme and results visibility", () => {
    test("organizer publishes a theme and the public pages render it", async ({ page }) => {
        test.setTimeout(240_000);

        await signIn(page, USERS.organizer);
        await page.goto(`/competitions/manage?edition=${FIXTURE.editionId}`);

        const form = page
            .getByRole("button", { name: "Save edition" })
            .locator("xpath=ancestor::form");
        await expect(form.getByLabel("Theme name")).toBeVisible({ timeout: 30_000 });
        await form.getByLabel("Theme name").fill(THEME_NAME);
        await form.getByLabel("Theme description").fill(THEME_DESCRIPTION);

        await enableSwitch(form, "Show scores publicly");
        await enableSwitch(form, "Show rankings publicly");

        await form.getByRole("button", { name: "Save edition" }).click();
        await expectToast(page, "Edition saved");

        await test.step("the public payload exposes the theme and visibility flags", async () => {
            const response = await fetch(
                `${API_ORIGIN}/api/v1/public/competitions/${FIXTURE.editionSlug}`,
            );
            expect(response.status).toBe(200);
            const competition: unknown = await response.json();
            expect(competition).toMatchObject({
                themeName: THEME_NAME,
                themeDescription: THEME_DESCRIPTION,
                showScores: true,
                showRanking: true,
            });
        });

        await test.step("the home page shows the published theme", async () => {
            await page.goto(siteUrl("/"));
            await expect(page.getByRole("heading", { name: "Theme", level: 2 })).toBeVisible({
                timeout: 60_000,
            });
            await expect(page.getByText(THEME_NAME).first()).toBeVisible();
            await expect(page.getByText(THEME_DESCRIPTION).first()).toBeVisible();
        });

        await test.step("the competition detail page shows the theme", async () => {
            await page.goto(siteUrl(`/competitions/${FIXTURE.editionSlug}`));
            await expect(
                page.getByRole("heading", { name: FIXTURE.editionName, level: 1 }),
            ).toBeVisible({ timeout: 60_000 });
            await expect(page.getByText(THEME_NAME).first()).toBeVisible();
            await expect(page.getByText(THEME_DESCRIPTION).first()).toBeVisible();
        });

        await test.step("disabling rankings updates the public flag", async () => {
            await page.goto(`/competitions/manage?edition=${FIXTURE.editionId}`);
            const editForm = page
                .getByRole("button", { name: "Save edition" })
                .locator("xpath=ancestor::form");
            const ranking = editForm.getByRole("switch", { name: "Show rankings publicly" });
            await expect(ranking).toBeVisible({ timeout: 30_000 });
            await expect(ranking).toBeChecked();
            await ranking.click();
            await expect(ranking).not.toBeChecked();
            await editForm.getByRole("button", { name: "Save edition" }).click();
            await expectToast(page, "Edition saved");

            const response = await fetch(
                `${API_ORIGIN}/api/v1/public/competitions/${FIXTURE.editionSlug}`,
            );
            expect(response.status).toBe(200);
            const competition: unknown = await response.json();
            expect(competition).toMatchObject({ showRanking: false, showScores: true });

            const scores = editForm.getByRole("switch", { name: "Show scores publicly" });
            await scores.click();
            await expect(scores).not.toBeChecked();
            await editForm.getByRole("button", { name: "Save edition" }).click();
            await expectToast(page, "Edition saved");
        });
    });
});
