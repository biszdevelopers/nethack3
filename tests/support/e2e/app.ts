import { expect, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import {
    AUTH_ORIGIN,
    DESKTOP_VIEWPORT,
    USERS,
    WORKSPACE_ORIGIN,
    type MockUser,
} from "./config.js";

export async function setMockUser(user: MockUser): Promise<void> {
    const response = await fetch(`${AUTH_ORIGIN}/__test/user`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(user),
        signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
        throw new Error(`Could not configure the mock identity provider (${response.status}).`);
    }
}

export async function signIn(page: Page, user: MockUser = USERS.participant): Promise<void> {
    await setMockUser(user);
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await page.getByRole("link", { name: "Continue to sign in" }).click();
    await page.waitForURL(
        (url) => url.origin === WORKSPACE_ORIGIN && url.pathname !== "/sign-in",
        { timeout: 45_000 },
    );
    await expect(page.getByRole("heading", { name: /^Welcome, / })).toBeVisible({
        timeout: 30_000,
    });
}

export async function newAppContext(browser: Browser): Promise<BrowserContext> {
    return browser.newContext({
        baseURL: WORKSPACE_ORIGIN,
        viewport: DESKTOP_VIEWPORT,
        reducedMotion: "reduce",
        locale: "en-US",
    });
}

export async function signOutThroughMenu(page: Page): Promise<void> {
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible({ timeout: 45_000 });
}

export async function chooseOption(trigger: Locator, optionName: string | RegExp): Promise<void> {
    await trigger.click();
    await trigger.page().getByRole("option", { name: optionName }).click();
}

export async function openEditionFromList(page: Page, editionName: string): Promise<void> {
    const card = page.getByRole("listitem").filter({ hasText: editionName }).first();
    await expect(card).toBeVisible();
    await card.getByRole("link", { name: "Open edition" }).click();
    await expect(page.getByRole("heading", { name: editionName, level: 1 })).toBeVisible();
}

export async function expectOrganizationSelected(
    page: Page,
    organizationName: string,
): Promise<void> {
    await expect(page.getByLabel("Organization").locator("option:checked")).toHaveText(
        organizationName,
    );
}

export async function expectToast(page: Page, title: string): Promise<void> {
    await expect(
        page.locator('[data-slot="toast"]').filter({ hasText: title }).first(),
    ).toBeVisible();
}
