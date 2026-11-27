import { expect, test } from "@playwright/test";
import { USERS } from "../support/e2e/config.js";
import { expectToast, signIn } from "../support/e2e/app.js";

test.describe("organization onboarding", () => {
    test("creates an organization and becomes its owner", async ({ page }) => {
        test.setTimeout(120_000);
        const suffix = Date.now().toString(36);
        const name = `E2E Organization ${suffix}`;
        const slug = `e2e-org-${suffix}`;

        await signIn(page, USERS.nobody);
        await page.getByRole("button", { name: "Create organization" }).click();
        const dialog = page.getByRole("dialog", { name: "Create an organization" });
        await expect(dialog).toBeVisible();
        await dialog.getByLabel("Organization name").fill(name);
        await dialog.getByLabel("Slug").fill(slug);
        await dialog
            .getByLabel("Description")
            .fill("Organization created by the Playwright onboarding journey.");
        await dialog.getByRole("button", { name: "Create organization" }).click();
        await expectToast(page, "Organization created");
        await expect(page.getByRole("banner").getByText(name)).toBeVisible({ timeout: 20_000 });
        await expect(page.getByRole("button", { name: "Create organization" })).toBeHidden();
    });
});
