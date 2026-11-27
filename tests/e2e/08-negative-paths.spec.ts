import { expect, test } from "@playwright/test";
import { API_ORIGIN, FIXTURE, USERS } from "../support/e2e/config.js";
import { expectOrganizationSelected, signIn } from "../support/e2e/app.js";

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
