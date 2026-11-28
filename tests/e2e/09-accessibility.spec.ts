import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { FIXTURE, SITE_ORIGIN, USERS } from "../support/e2e/config.js";
import { signIn } from "../support/e2e/app.js";

const PUBLIC_PAGES = [
    "/",
    "/competitions",
    "/projects",
    "/announcements",
    "/about",
    "/faq",
    "/past",
    "/results",
    "/contact",
    "/contributing",
    `/seasons/${FIXTURE.editionSlug}`,
] as const;

function siteUrl(path: string): string {
    return new URL(path, SITE_ORIGIN).toString();
}

async function expectNoSeriousViolations(page: Page, context: string): Promise<void> {
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(blocking, `${context}: ${blocking.map((entry) => entry.id).join(", ")}`).toEqual([]);
}

test.describe("accessibility and visual layout", () => {
    for (const path of PUBLIC_PAGES) {
        test(`public page ${path} has no serious accessibility violations`, async ({ page }) => {
            test.setTimeout(180_000);
            await page.goto(siteUrl(path));
            await expect(page.locator("main")).toBeVisible({ timeout: 60_000 });
            await expectNoSeriousViolations(page, `public ${path}`);
        });
    }

    test("public pages do not overflow a mobile viewport", async ({ page }) => {
        test.setTimeout(240_000);
        await page.setViewportSize({ width: 412, height: 915 });
        for (const path of PUBLIC_PAGES) {
            await page.goto(siteUrl(path));
            await expect(page.locator("main")).toBeVisible({ timeout: 60_000 });
            const overflow = await page.evaluate(
                () => document.documentElement.scrollWidth - window.innerWidth,
            );
            expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
        }
    });

    test("workspace overview has no serious accessibility violations", async ({ page }) => {
        test.setTimeout(180_000);
        await signIn(page, USERS.participant);
        await expect(page.getByRole("navigation", { name: "Workspace" })).toBeVisible();
        await expectNoSeriousViolations(page, "workspace overview");
    });

    test("workspace command palette navigates with the keyboard", async ({ page }) => {
        test.setTimeout(180_000);
        await signIn(page, USERS.participant);
        await page.keyboard.press("Control+k");
        const palette = page.getByRole("dialog", { name: "Command palette" });
        await expect(palette).toBeVisible();
        await palette.getByText("Competitions", { exact: true }).click();
        await expect(page).toHaveURL(/\/competitions$/);
    });

    test("workspace loading state matches the visual baseline", async ({ page }) => {
        test.setTimeout(180_000);
        await signIn(page, USERS.participant);
        await page.route("**/api/v1/**", async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 1_500));
            await route.continue();
        });
        await page.goto("/teams");
        await expect(page.getByText("Loading your teams")).toBeVisible({ timeout: 10_000 });
        await expect(page).toHaveScreenshot("workspace-loading.png", {
            animations: "disabled",
            caret: "hide",
            maxDiffPixelRatio: 0.03,
        });
        await page.unroute("**/api/v1/**");
    });

    test("component laboratory has no serious accessibility violations", async ({ page }) => {
        test.setTimeout(180_000);
        await signIn(page, USERS.participant);
        await page.goto("/lab");
        await expect(page.getByRole("heading", { name: "Component laboratory" })).toBeVisible({
            timeout: 30_000,
        });
        await expectNoSeriousViolations(page, "component laboratory");
        await expect(page).toHaveScreenshot("component-lab-dark.png", {
            animations: "disabled",
            caret: "hide",
            maxDiffPixelRatio: 0.03,
        });
        await page.getByRole("button", { name: "Switch to light mode" }).click();
        await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
        await expect(page).toHaveScreenshot("component-lab-light.png", {
            animations: "disabled",
            caret: "hide",
            maxDiffPixelRatio: 0.03,
        });
    });

    test("public home matches the visual baseline", async ({ page }) => {
        test.setTimeout(180_000);
        await page.goto(siteUrl("/"));
        await expect(
            page.getByRole("heading", { name: "Welcome to nethack", level: 1 }),
        ).toBeVisible({ timeout: 60_000 });
        await expect(page).toHaveScreenshot("public-home.png", {
            animations: "disabled",
            caret: "hide",
            maxDiffPixelRatio: 0.03,
            mask: [page.locator('[data-gsap="parallax"]')],
        });
    });

    test("public home light theme matches the visual baseline", async ({ page }) => {
        test.setTimeout(180_000);
        await page.goto(siteUrl("/"));
        await page.getByRole("button", { name: "Switch to light mode" }).click();
        await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
        await expect(page).toHaveScreenshot("public-home-light.png", {
            animations: "disabled",
            caret: "hide",
            maxDiffPixelRatio: 0.03,
            mask: [page.locator('[data-gsap="parallax"]')],
        });
    });

    test("public mobile home matches the visual baseline", async ({ page }) => {
        test.setTimeout(180_000);
        await page.setViewportSize({ width: 412, height: 915 });
        await page.goto(siteUrl("/"));
        await expect(
            page.getByRole("heading", { name: "Welcome to nethack", level: 1 }),
        ).toBeVisible({ timeout: 60_000 });
        await expect(page).toHaveScreenshot("public-home-mobile.png", {
            animations: "disabled",
            caret: "hide",
            maxDiffPixelRatio: 0.03,
            mask: [page.locator('[data-gsap="parallax"]')],
        });
    });

    test("public tablet home matches the visual baseline", async ({ page }) => {
        test.setTimeout(180_000);
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.goto(siteUrl("/"));
        await expect(
            page.getByRole("heading", { name: "Welcome to nethack", level: 1 }),
        ).toBeVisible({ timeout: 60_000 });
        await expect(page).toHaveScreenshot("public-home-tablet.png", {
            animations: "disabled",
            caret: "hide",
            maxDiffPixelRatio: 0.03,
            mask: [page.locator('[data-gsap="parallax"]')],
        });
    });

    test("empty archive state matches the visual baseline", async ({ page }) => {
        test.setTimeout(180_000);
        await page.goto(siteUrl("/past"));
        await expect(page.getByRole("heading", { name: "No completed competitions" })).toBeVisible({
            timeout: 60_000,
        });
        await expect(page).toHaveScreenshot("public-past-empty.png", {
            animations: "disabled",
            caret: "hide",
            maxDiffPixelRatio: 0.03,
        });
    });

    test("not-found page matches the visual baseline", async ({ page }) => {
        test.setTimeout(180_000);
        await page.goto(siteUrl("/this-page-does-not-exist"));
        await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible({
            timeout: 60_000,
        });
        await expect(page).toHaveScreenshot("public-not-found.png", {
            animations: "disabled",
            caret: "hide",
            maxDiffPixelRatio: 0.03,
        });
    });
});
