import { expect, test, type Page } from "@playwright/test";
import { FIXTURE, SITE_ORIGIN } from "../support/e2e/config.js";

function siteUrl(path: string): string {
    return new URL(path, SITE_ORIGIN).toString();
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
    const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, "the page must not scroll horizontally").toBeLessThanOrEqual(1);
}

test.describe("showcase", () => {
    test("index links to both experiences and the season archive", async ({ page }) => {
        test.setTimeout(180_000);

        await page.goto(siteUrl("/showcase"));
        await expect(
            page.getByRole("heading", { name: "Beneath the Surface", level: 1 }),
        ).toBeVisible({ timeout: 60_000 });

        const featuredLink = page.getByRole("link", { name: /Enter the featured showcase/i });
        await expect(featuredLink).toHaveAttribute("href", "/showcase/beneath-the-surface");

        await expect(page.getByRole("heading", { name: "Signal", level: 2 })).toBeVisible();
        await expect(page.locator('a[href="/showcase/signal"]').first()).toBeVisible();

        const seasonLink = page.locator(
            `a[href="/showcase/seasons/${FIXTURE.archiveEditionSlug}"]`,
        );
        await expect(seasonLink).toBeVisible();
        await expect(seasonLink.getByText(FIXTURE.archiveEditionName)).toBeVisible();
    });

    test("signal renders its title, three featured projects, and the project archive", async ({
        page,
    }) => {
        test.setTimeout(180_000);

        await page.goto(siteUrl("/showcase/signal"));
        await expect(
            page.getByRole("heading", { name: /When there is\s+Signal/i, level: 1 }),
        ).toBeVisible({ timeout: 60_000 });

        await expect(page.getByRole("heading", { name: "Syl", level: 2 })).toBeVisible();
        await expect(
            page.getByRole("heading", {
                name: "Super Cool But Creepy Visual Recognition Robotic Head",
                level: 2,
            }),
        ).toBeVisible();
        await expect(
            page.getByRole("heading", { name: "Dysarthria Speech Classifier", level: 2 }),
        ).toBeVisible();

        await expect(page.getByRole("heading", { name: "All projects", level: 2 })).toBeVisible();
        const marquee = page.getByRole("group", { name: "All projects", exact: true });
        await expect(marquee).toBeVisible();
        await expect(marquee.getByText(/AI use:/).first()).toBeVisible();
        const card = marquee
            .getByRole("button")
            .filter({ has: page.getByText("Archived Showcase Project", { exact: true }) })
            .first();
        await expect(card).toBeVisible();
        await card.focus();
        await expect(card).toBeFocused();
        await page.keyboard.press("Enter");
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await expect(
            dialog.getByRole("heading", { name: "Archived Showcase Project" }),
        ).toBeVisible();
        await expect(dialog.getByRole("link", { name: /Open project page/i })).toBeVisible();
        await expect(dialog.getByText("AI use disclosure")).toBeVisible();
        await expect(
            dialog.getByText("No AI tools were used in this archived project."),
        ).toBeVisible();
        const videoLink = dialog.getByRole("link", { name: /Demonstration video/i });
        if ((await videoLink.count()) > 0) {
            await expect(videoLink.first()).toHaveAttribute("href", /^https?:\/\//);
        }
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await expect(card).toBeFocused();

        await expectNoHorizontalOverflow(page);
    });

    test("beneath the surface lists six winners and opens the project modal by keyboard", async ({
        page,
    }) => {
        test.setTimeout(180_000);

        await page.goto(siteUrl("/showcase/beneath-the-surface"));
        await expect(
            page.getByRole("heading", { name: "Beneath the Surface", level: 1 }),
        ).toBeVisible({ timeout: 60_000 });

        for (const name of [
            "Where the Rainbow Ends",
            "Beneath the Land",
            "Horror Forest",
            "metadata manipulation tool",
            "Unseen Layers",
            "TraceShadow",
        ]) {
            await expect(page.getByRole("heading", { name, level: 2 })).toBeVisible();
        }

        await expect(page.getByRole("img", { name: "First place" }).first()).toBeVisible();

        const trigger = page.getByRole("button", {
            name: "Open project: Where the Rainbow Ends",
        });
        await trigger.focus();
        await expect(trigger).toBeFocused();
        await page.keyboard.press("Enter");

        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole("heading", { name: "Where the Rainbow Ends" })).toBeVisible();
        await expect(dialog.getByText("Junior pathway", { exact: false })).toBeVisible();

        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await expect(trigger).toBeFocused();

        await expectNoHorizontalOverflow(page);
    });

    test("season archive resolves published projects for a known edition", async ({ page }) => {
        test.setTimeout(180_000);

        await page.goto(siteUrl(`/showcase/seasons/${FIXTURE.archiveEditionSlug}`));
        await expect(
            page.getByRole("heading", { name: FIXTURE.archiveEditionName, level: 1 }),
        ).toBeVisible({ timeout: 60_000 });
        await expect(
            page.getByRole("heading", { name: "Published projects", level: 2 }),
        ).toBeVisible();
        await expect(page.getByText("Archived Showcase Project").first()).toBeVisible();
        await expect(
            page.getByRole("link", { name: new RegExp("Archived Showcase Project") }).first(),
        ).toHaveAttribute("href", "/projects/archived-showcase-project");

        await expect(
            page.getByText(/Results are not published for this edition yet/),
        ).toBeVisible();
    });

    test("unknown season archive shows not found", async ({ page }) => {
        test.setTimeout(180_000);

        await page.goto(siteUrl("/showcase/seasons/season-that-does-not-exist"));
        await expect(page.getByText("Page not found")).toBeVisible({ timeout: 60_000 });
    });

    test("showcase pages do not overflow a mobile viewport", async ({ page }) => {
        test.setTimeout(180_000);
        await page.setViewportSize({ width: 390, height: 844 });

        for (const path of [
            "/showcase",
            "/showcase/signal",
            "/showcase/beneath-the-surface",
            `/showcase/seasons/${FIXTURE.archiveEditionSlug}`,
        ]) {
            await page.goto(siteUrl(path));
            await expect(page.locator("h1").first()).toBeVisible({ timeout: 60_000 });
            await expectNoHorizontalOverflow(page);
        }
    });
});
