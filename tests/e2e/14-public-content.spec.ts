import { expect, test } from "@playwright/test";
import { API_ORIGIN, FIXTURE, SITE_ORIGIN, USERS } from "../support/e2e/config.js";
import { expectToast, signIn } from "../support/e2e/app.js";
import { ownerQuery } from "../support/e2e/db.js";

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

    test("organizer contact channels reach the public contact and competition pages", async ({
        page,
    }) => {
        test.setTimeout(240_000);
        await signIn(page, USERS.organizer);

        await page.goto(`/competitions/manage?edition=${FIXTURE.editionId}`);
        await expect(page.getByRole("heading", { name: "Edit edition" })).toBeVisible({
            timeout: 30_000,
        });
        const editForm = page
            .getByRole("button", { name: "Save edition" })
            .locator("xpath=ancestor::form");
        await editForm.getByLabel("Contact email").fill(USERS.organizer.email);
        await editForm
            .getByLabel("Contact URL")
            .fill("https://teams.microsoft.com/l/channel/e2e-contact");
        await page.getByRole("button", { name: "Save edition" }).click();
        await expectToast(page, "Edition saved");

        await page.goto(siteUrl("/contact"));
        await expect(page.getByRole("link", { name: USERS.organizer.email }).first()).toBeVisible({
            timeout: 60_000,
        });
        await expect(page.getByRole("link", { name: "teams.microsoft.com" }).first()).toBeVisible();

        await page.goto(siteUrl(`/competitions/${FIXTURE.editionSlug}`));
        await expect(page.getByRole("heading", { name: "Contact the organizer" })).toBeVisible({
            timeout: 60_000,
        });
        await expect(page.getByRole("link", { name: USERS.organizer.email })).toHaveAttribute(
            "href",
            `mailto:${USERS.organizer.email}`,
        );
        await expect(page.getByRole("link", { name: "teams.microsoft.com" })).toHaveAttribute(
            "href",
            "https://teams.microsoft.com/l/channel/e2e-contact",
        );
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

    test("workspace bell shows and clears unread notifications", async ({ page }) => {
        test.setTimeout(180_000);
        await ownerQuery("delete from notifications where user_id = $1", [FIXTURE.participantId]);
        await ownerQuery(
            `insert into notifications (user_id, organization_id, kind, title, body, link_url, dedupe_key)
             values ($1, $2, 'system', 'E2E bell notification', 'Seeded for the workspace bell.', '/notifications', $3)`,
            [FIXTURE.participantId, FIXTURE.organizationId, `e2e-bell-${String(Date.now())}`],
        );

        await signIn(page, USERS.participant);
        const bell = page.getByRole("link", { name: "Notifications, 1 unread" });
        await expect(bell).toBeVisible({ timeout: 30_000 });

        await bell.click();
        await expect(page.getByRole("heading", { name: "Notifications", level: 1 })).toBeVisible();
        await page.getByRole("button", { name: "Mark E2E bell notification as read" }).click();
        await expect(page.getByRole("link", { name: "Notifications, no unread" })).toBeVisible({
            timeout: 30_000,
        });
    });
});
