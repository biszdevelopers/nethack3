import { expect, test } from "@playwright/test";
import { API_ORIGIN, FIXTURE, SITE_ORIGIN, USERS } from "../support/e2e/config.js";
import { signIn } from "../support/e2e/app.js";

function siteUrl(path: string): string {
    return new URL(path, SITE_ORIGIN).toString();
}

test.describe("public content", () => {
    test("renders the contact and contributing pages", async ({ page }) => {
        test.setTimeout(180_000);

        await page.goto(siteUrl("/contact"));
        await expect(page.getByRole("heading", { name: "Contact", level: 1 })).toBeVisible({
            timeout: 60_000,
        });
        await expect(page.getByRole("heading", { name: "Security reports" })).toBeVisible();

        await page.goto(siteUrl("/contributing"));
        await expect(
            page.getByRole("heading", { name: "Contributing to nethack", level: 1 }),
        ).toBeVisible({ timeout: 60_000 });
        await expect(page.getByText("Code of conduct")).toBeVisible();
        await expect(page.getByText("Reporting security issues")).toBeVisible();
    });

    test("season archive resolves a published edition and shows its projects", async ({ page }) => {
        test.setTimeout(180_000);

        await page.goto(siteUrl(`/seasons/${FIXTURE.editionSlug}`));
        await expect(
            page.getByRole("heading", { name: FIXTURE.editionName, level: 1 }),
        ).toBeVisible({ timeout: 60_000 });
        await expect(
            page.getByRole("heading", { name: "Published projects", level: 2 }),
        ).toBeVisible();
        await expect(page.getByText(FIXTURE.projectTitle).first()).toBeVisible();
    });

    test("public profile returns and renders only public fields", async ({ page }) => {
        test.setTimeout(180_000);

        const response = await fetch(`${API_ORIGIN}/api/v1/public/users/${FIXTURE.participantId}`);
        expect(response.status).toBe(200);
        const payload: unknown = await response.json();
        expect(payload).toEqual({
            id: FIXTURE.participantId,
            displayName: USERS.participant.name,
            avatarUrl: null,
            createdAt: expect.any(String),
        });

        await page.goto(siteUrl(`/users/${FIXTURE.participantId}`));
        await expect(
            page.getByRole("heading", { name: USERS.participant.name, level: 1 }),
        ).toBeVisible({ timeout: 60_000 });
        await expect(page.getByText(USERS.participant.email)).toHaveCount(0);
    });

    test("unknown season and user identifiers show not found", async ({ page }) => {
        test.setTimeout(180_000);

        await page.goto(siteUrl("/seasons/edition-that-does-not-exist"));
        await expect(page.getByText("Page not found")).toBeVisible({ timeout: 60_000 });

        await page.goto(siteUrl("/users/00000000-0000-4000-8000-000000000000"));
        await expect(page.getByText("Page not found")).toBeVisible({ timeout: 60_000 });
    });

    test("workspace profile and presentation pages render", async ({ page }) => {
        test.setTimeout(180_000);
        await signIn(page, USERS.participant);

        await page.goto("/profile");
        await expect(
            page.getByRole("heading", { name: USERS.participant.name, level: 1 }),
        ).toBeVisible({ timeout: 30_000 });
        await expect(page.getByText(USERS.participant.email)).toBeVisible();
        await expect(page.getByRole("link", { name: "View public profile" })).toBeVisible();

        await page.goto("/presentation");
        await expect(
            page.getByRole("heading", { name: "Presentation stage", level: 1 }),
        ).toBeVisible({ timeout: 30_000 });
        await expect(page.getByText("Presentation logistics")).toBeVisible();
    });
});
