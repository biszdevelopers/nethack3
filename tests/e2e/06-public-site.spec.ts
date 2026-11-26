import { expect, test, type Page } from "@playwright/test";
import { FIXTURE, SITE_ORIGIN } from "../support/e2e/config.js";

function siteUrl(path: string): string {
    return new URL(path, SITE_ORIGIN).toString();
}

function collectConsoleErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on("console", (message) => {
        if (message.type() === "error") {
            errors.push(message.text());
        }
    });
    page.on("pageerror", (error) => {
        errors.push(error.message);
    });
    return errors;
}

test.describe("public site", () => {
    test("renders published competitions and projects without console errors", async ({ page }) => {
        test.setTimeout(180_000);
        const errors = collectConsoleErrors(page);

        await page.goto(siteUrl("/"));
        await expect(
            page.getByRole("heading", { name: "Competitions", level: 2 }),
        ).toBeVisible({ timeout: 60_000 });
        await expect(page.getByText(FIXTURE.editionName).first()).toBeVisible();
        await expect(
            page.getByRole("heading", { name: "Project showcase", level: 2 }),
        ).toBeVisible();
        await expect(page.getByText(FIXTURE.projectTitle).first()).toBeVisible();

        await page.goto(siteUrl(`/competitions/${FIXTURE.editionSlug}`));
        await expect(
            page.getByRole("heading", { name: FIXTURE.editionName, level: 1 }),
        ).toBeVisible({ timeout: 60_000 });
        await expect(page.getByText(FIXTURE.projectTitle).first()).toBeVisible();

        await page.goto(siteUrl(`/projects/${FIXTURE.projectSlug}`));
        await expect(
            page.getByRole("heading", { name: FIXTURE.projectTitle, level: 1 }),
        ).toBeVisible({ timeout: 60_000 });

        expect(errors).toEqual([]);
    });

    test("opens and closes the mobile navigation", async ({ page }) => {
        test.skip(
            test.info().project.name !== "mobile-chromium",
            "The mobile navigation is only reachable on a mobile viewport.",
        );
        test.setTimeout(180_000);
        const errors = collectConsoleErrors(page);
        await page.goto(siteUrl("/"));
        await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible({
            timeout: 60_000,
        });
        await page.getByRole("button", { name: "Open navigation" }).click();
        const mobileNavigation = page.getByRole("navigation", { name: "Mobile" });
        await expect(mobileNavigation).toBeVisible();
        await expect(mobileNavigation.getByRole("link", { name: "Competitions" })).toBeVisible();
        await page.getByRole("button", { name: "Close", exact: true }).click();
        await expect(mobileNavigation).toBeHidden();
        expect(errors).toEqual([]);
    });
});
