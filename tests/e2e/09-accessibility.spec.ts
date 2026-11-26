import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { SITE_ORIGIN, USERS } from "../support/e2e/config.js";
import { signIn } from "../support/e2e/app.js";

const PUBLIC_PAGES = [
    "/",
    "/competitions",
    "/projects",
    "/announcements",
    "/about",
    "/faq",
    "/past",
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
});
