import { expect, test } from "@playwright/test";
import { API_ORIGIN, USERS } from "../support/e2e/config.js";
import { signIn, signOutThroughMenu } from "../support/e2e/app.js";

test.describe("logout", () => {
    test("signs out, invalidates the session, and protects private routes", async ({ page }) => {
        await signIn(page, USERS.participant);
        await expect(
            page.getByRole("heading", { name: "Welcome, Fixture Participant" }),
        ).toBeVisible();

        await signOutThroughMenu(page);

        const sessionResponse = await page.request.get(`${API_ORIGIN}/api/v1/auth/session`);
        expect(sessionResponse.status()).toBe(401);

        await page.goto("/projects");
        await page.waitForURL(/\/sign-in$/);
        await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    });
});
