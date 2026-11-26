import { expect, test } from "@playwright/test";
import { API_ORIGIN, AUTH_ORIGIN, FIXTURE, USERS } from "../support/e2e/config.js";
import { expectOrganizationSelected, setMockUser, signIn } from "../support/e2e/app.js";

test.describe("sign-in journey", () => {
    test("completes the OIDC flow and shows the session organization", async ({ page }) => {
        await signIn(page, USERS.participant);

        await expect(
            page.getByRole("heading", { name: "Welcome, Fixture Participant" }),
        ).toBeVisible();
        await expect(
            page.locator("main").getByText(FIXTURE.organizationName, { exact: true }).first(),
        ).toBeVisible();
        await expectOrganizationSelected(page, FIXTURE.organizationName);

        const sessionResponse = await page.request.get(`${API_ORIGIN}/api/v1/auth/session`);
        expect(sessionResponse.status()).toBe(200);
        const session = (await sessionResponse.json()) as {
            user: { email: string | null };
            memberships: { organizationId: string; role: string }[];
        };
        expect(session.user.email).toBe(USERS.participant.email);
        expect(session.memberships).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    organizationId: FIXTURE.organizationId,
                    role: "participant",
                }),
            ]),
        );
    });

    test("surfaces a provider cancellation on the auth error page", async ({ page }) => {
        await setMockUser(USERS.participant);
        const response = await fetch(`${AUTH_ORIGIN}/__test/error`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ mode: "access_denied" }),
        });
        expect(response.ok).toBe(true);
        try {
            await page.goto("/sign-in");
            await page.getByRole("link", { name: "Continue to sign in" }).click();
            await page.waitForURL((url) => url.pathname === "/auth/error", { timeout: 45_000 });
            await expect(
                page.getByRole("heading", { name: "Sign-in was cancelled" }),
            ).toBeVisible();
        } finally {
            await fetch(`${AUTH_ORIGIN}/__test/error`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ mode: null }),
            });
        }
    });
});
