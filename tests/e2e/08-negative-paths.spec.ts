import { expect, test } from "@playwright/test";
import { API_ORIGIN, FIXTURE, USERS } from "../support/e2e/config.js";
import { expectOrganizationSelected, signIn } from "../support/e2e/app.js";
import { ownerTenantQuery } from "../support/e2e/db.js";

test.describe("negative access paths", () => {
    test("shows an empty state for a user without an organization", async ({ page }) => {
        await signIn(page, USERS.nobody);
        await expect(page.getByRole("heading", { name: "Welcome, Fixture Nobody" })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Welcome to nethack" })).toBeVisible();
        await expect(page.getByText("No organization selected")).toBeVisible();
        await expect(page.getByRole("link", { name: "Open notifications" })).toBeVisible();

        await page.goto("/competitions");
        await expect(page.getByText("No active organization", { exact: true })).toBeVisible();
        await page.goto("/projects");
        await expect(page.getByText("No active organization", { exact: true })).toBeVisible();
    });

    test("declines a team invitation from the inbox", async ({ page }) => {
        await signIn(page, USERS.applicant);
        await page.goto("/teams");
        await expect(page.getByText("1 pending team invitation", { exact: true })).toBeVisible();
        await page.getByRole("link", { name: "Review invitations" }).click();
        await expect(page.getByRole("heading", { name: "Invitations", level: 1 })).toBeVisible();

        const invitation = page
            .getByRole("listitem")
            .filter({ hasText: FIXTURE.disposableTeamName })
            .first();
        await expect(invitation).toBeVisible();
        await invitation.getByRole("button", { name: "Decline" }).click();
        await expect(page.getByText("No pending invitations")).toBeVisible();
    });

    test("revokes an invitation and disbands a team", async ({ page }) => {
        test.setTimeout(180_000);
        await signIn(page, USERS.teamAdmin);
        await page.goto(`/teams/${FIXTURE.disposableTeamId}`);
        await expect(
            page.getByRole("heading", { name: FIXTURE.disposableTeamName, level: 1 }),
        ).toBeVisible();

        await page.getByLabel("Invite by email").fill(USERS.nobody.email);
        await page.getByRole("button", { name: "Send invitation" }).click();
        await expect(
            page.getByText(`Invitation sent to ${USERS.nobody.email}.`, { exact: false }),
        ).toBeVisible();
        await expect(page.getByLabel("Invitation link")).toHaveValue(/\/invitations\?token=/);

        const invitation = page
            .getByRole("listitem")
            .filter({ hasText: USERS.nobody.email })
            .first();
        await expect(invitation.getByRole("button", { name: "Copy link" })).toBeVisible();
        await invitation.getByRole("button", { name: "Revoke" }).click();
        await expect(
            page.getByRole("listitem").filter({ hasText: USERS.nobody.email }),
        ).toHaveCount(0);

        await page.getByRole("button", { name: "Disband team" }).click();
        const dialog = page.getByRole("alertdialog", { name: "Disband team" });
        await expect(dialog).toBeVisible();
        await dialog.getByRole("button", { name: "Disband team" }).click();
        await page.waitForURL(/\/teams$/);

        await page.goto(`/teams/${FIXTURE.disposableTeamId}`);
        await expect(page.getByText("Disbanded", { exact: true }).first()).toBeVisible();
        await expect(page.getByText("0 of 4 members")).toBeVisible();
    });

    test("refuses to disband a team with a submission", async ({ page }) => {
        await ownerTenantQuery(
            FIXTURE.organizationId,
            "update teams set status = 'ready', status_reason = '' where id = $1",
            [FIXTURE.teamId],
        );
        await signIn(page, USERS.participant);
        await page.goto(`/teams/${FIXTURE.teamId}`);
        await page.getByRole("button", { name: "Disband team" }).click();
        const dialog = page.getByRole("alertdialog", { name: "Disband team" });
        await expect(dialog).toBeVisible();
        await dialog.getByRole("button", { name: "Disband team" }).click();
        await expect(
            page.getByText("A team with a submission cannot be disbanded.", { exact: true }),
        ).toBeVisible();
        await dialog.getByRole("button", { name: "Cancel" }).click();
    });

    test("does not expose ranked judging results to participants", async ({ page }) => {
        await signIn(page, USERS.participant);
        const response = await page.request.get(
            `${API_ORIGIN}/api/v1/competitions/${FIXTURE.editionId}/judging-results`,
            { headers: { "x-nethack-organization-id": FIXTURE.organizationId } },
        );
        expect(response.status()).toBe(403);
    });

    test("does not expose another organization's data", async ({ page }) => {
        await signIn(page, USERS.outsider);
        await expectOrganizationSelected(page, FIXTURE.otherOrganizationName);
        await expect(
            page.getByRole("heading", { name: "Welcome, Fixture Outsider" }),
        ).toBeVisible();

        await page.goto("/projects");
        await expect(page.getByText(FIXTURE.otherProjectTitle)).toBeVisible();
        await expect(page.getByText(FIXTURE.projectTitle)).toBeHidden();

        await page.evaluate(
            (organizationId) =>
                window.localStorage.setItem("nethack-active-organization", organizationId),
            FIXTURE.organizationId,
        );
        await page.reload();
        await expect(page.getByText(FIXTURE.projectTitle)).toBeHidden();
        await expectOrganizationSelected(page, FIXTURE.otherOrganizationName);

        const crossOrganization = await page.request.get(`${API_ORIGIN}/api/v1/projects`, {
            headers: { "x-nethack-organization-id": FIXTURE.organizationId },
        });
        expect(crossOrganization.status()).toBe(403);
    });
});
