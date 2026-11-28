import { expect, test } from "@playwright/test";
import { API_ORIGIN, FIXTURE, SITE_ORIGIN, USERS } from "../support/e2e/config.js";
import { chooseOption, expectToast, signIn, signOutThroughMenu } from "../support/e2e/app.js";
import { ownerTenantQuery } from "../support/e2e/db.js";

const THEME_PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lK3y9QAAAABJRU5ErkJggg==",
    "base64",
);

interface PublicProfilePayload {
    readonly id: string;
    readonly displayName: string;
    readonly avatarUrl: string | null;
    readonly profileTheme?: string;
    readonly createdAt: string;
    readonly email?: unknown;
    readonly locale?: unknown;
}

async function fetchPublicProfile(): Promise<PublicProfilePayload> {
    const response = await fetch(`${API_ORIGIN}/api/v1/public/users/${FIXTURE.participantId}`);
    expect(response.status).toBe(200);
    return (await response.json()) as PublicProfilePayload;
}

test.describe("team status and profile theme parity", () => {
    test.afterAll(async () => {
        await ownerTenantQuery(
            FIXTURE.organizationId,
            "update teams set status = 'ready', status_reason = '' where id = $1",
            [FIXTURE.teamId],
        );
    });

    test("admin terminal status shows the participant a badge and blocked submissions", async ({
        page,
    }) => {
        test.setTimeout(180_000);
        await ownerTenantQuery(
            FIXTURE.organizationId,
            "update teams set status = 'ready', status_reason = '' where id = $1",
            [FIXTURE.teamId],
        );
        await signIn(page, USERS.organizer);

        await page.goto("/admin/teams");
        await expect(page.getByRole("heading", { name: "Teams", level: 1 })).toBeVisible();
        await chooseOption(page.getByLabel("Competition edition"), FIXTURE.editionName);

        const row = page.getByRole("row", { name: /Fixture Team/ });
        await expect(row).toBeVisible();
        const status = row.getByLabel("Status for Fixture Team");
        await expect(status).toHaveValue("ready");

        await status.selectOption("withdrawn");
        const dialog = page.getByRole("dialog", { name: "Change team status" });
        await expect(dialog).toBeVisible();
        await dialog.getByRole("button", { name: "Apply status" }).click();
        await expect(dialog.getByText("Enter a reason of at least 5 characters.")).toBeVisible();
        await dialog.getByRole("button", { name: "Cancel" }).click();
        await expect(dialog).toHaveCount(0);
        await expect(status).toHaveValue("ready");

        const reason = "The team withdrew from the fixture event.";
        await status.selectOption("withdrawn");
        await expect(dialog).toBeVisible();
        await dialog.getByLabel("Reason").fill(reason);
        await dialog.getByRole("button", { name: "Apply status" }).click();
        await expectToast(page, "Team status updated");
        await expect(dialog).toHaveCount(0);
        await expect(status).toHaveValue("withdrawn");
        await expect(row.getByText(reason)).toBeVisible();

        await signOutThroughMenu(page);
        await signIn(page, USERS.participant);

        await page.goto(`/teams/${FIXTURE.teamId}`);
        await expect(page.getByText("Withdrawn", { exact: true }).first()).toBeVisible();
        await expect(page.getByText("Submissions blocked")).toBeVisible();
        await expect(
            page.getByText(
                "This team has withdrawn from the competition. Submissions cannot be created or marked ready.",
            ),
        ).toBeVisible();
        await expect(page.getByRole("button", { name: "Edit team" })).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Disband team" })).toHaveCount(0);
    });

    test("profile theme upload reaches the public profile and removal clears it", async ({
        page,
    }) => {
        test.setTimeout(180_000);
        await signIn(page, USERS.participant);

        const before = await fetchPublicProfile();
        expect(before).not.toHaveProperty("email");
        expect(before).not.toHaveProperty("locale");

        await page.goto("/profile");
        await expect(
            page.getByRole("heading", { name: USERS.participant.name, level: 1 }),
        ).toBeVisible({ timeout: 30_000 });

        await page.getByLabel("Profile theme image").setInputFiles({
            name: "theme.png",
            mimeType: "image/png",
            buffer: THEME_PNG,
        });
        await expect(page.getByAltText("Profile theme preview")).toBeVisible();
        await page.getByRole("button", { name: "Save theme" }).click();
        await expectToast(page, "Profile theme updated");

        const saved = await fetchPublicProfile();
        expect(saved.profileTheme).toMatch(/^data:image\/png;base64,/);
        expect(saved).not.toHaveProperty("email");
        expect(saved).not.toHaveProperty("locale");
        expect(saved).not.toHaveProperty("status");

        await page.goto(new URL(`/users/${FIXTURE.participantId}`, SITE_ORIGIN).toString());
        await expect(page.getByTestId("profile-theme")).toBeVisible({ timeout: 60_000 });
        await expect(page.getByText(/^Joined /)).toBeVisible();
        await expect(page.getByText(USERS.participant.email)).toHaveCount(0);

        await page.goto("/profile");
        await expect(page.getByAltText("Profile theme preview")).toBeVisible({
            timeout: 30_000,
        });
        await page.getByRole("button", { name: "Remove theme" }).click();
        await expectToast(page, "Profile theme removed");

        const removed = await fetchPublicProfile();
        expect(removed).not.toHaveProperty("profileTheme");
        expect(removed).not.toHaveProperty("email");

        await page.goto(new URL(`/users/${FIXTURE.participantId}`, SITE_ORIGIN).toString());
        await expect(page.getByTestId("profile-theme")).toHaveCount(0, { timeout: 60_000 });
    });
});
