import { expect, test } from "@playwright/test";
import {
    FIXTURE,
    USERS,
} from "../support/e2e/config.js";
import {
    chooseOption,
    newAppContext,
    signIn,
} from "../support/e2e/app.js";
import { invitationTokenForEmail } from "../support/e2e/db.js";

const PIXEL_PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
);

test.describe("participant workflow", () => {
    test("registers, is approved, builds a team, invites a partner, and submits a project", async ({
        page,
        browser,
    }) => {
        test.setTimeout(300_000);
        const teamName = "E2E Team";
        const projectTitle = "E2E Participant Project";
        const updatedTitle = "E2E Participant Project Updated";

        await signIn(page, USERS.participant);

        await test.step("register for the open edition", async () => {
            await page.goto("/competitions");
            await page
                .getByRole("listitem")
                .filter({ hasText: FIXTURE.openEditionName })
                .first()
                .getByRole("link", { name: "Open edition" })
                .click();
            await expect(
                page.getByRole("heading", { name: FIXTURE.openEditionName, level: 1 }),
            ).toBeVisible();

            await page.getByRole("button", { name: "Register", exact: true }).click();
            const dialog = page.getByRole("dialog", { name: "Register for this competition" });
            await chooseOption(dialog.getByLabel("Division"), "Open");
            await dialog.getByLabel("Note to organizers").fill("E2E registration request.");
            await dialog.getByRole("button", { name: "Submit registration" }).click();
            await expect(dialog).toBeHidden();
            await expect(page.getByText("Pending", { exact: true })).toBeVisible();
        });

        await test.step("organizer approves the registration", async () => {
            const organizerContext = await newAppContext(browser);
            try {
                const organizerPage = await organizerContext.newPage();
                await signIn(organizerPage, USERS.organizer);
                await organizerPage.goto(`/competitions/${FIXTURE.openEditionId}`);
                const row = organizerPage.getByRole("row", { name: /Fixture Participant/ });
                await expect(row).toBeVisible();
                await row.getByRole("button", { name: "Approve" }).click();
                await expect(row.getByText("Approved", { exact: true })).toBeVisible();
            } finally {
                await organizerContext.close();
            }

            await page.reload();
            await expect(page.getByText("Approved", { exact: true })).toBeVisible();
        });

        await test.step("create a team", async () => {
            await page.goto("/teams");
            await page.getByRole("button", { name: "Create team" }).click();
            const dialog = page.getByRole("dialog", { name: "Create a team" });
            await dialog.getByLabel("Team name").fill(teamName);
            await dialog.getByLabel("Description").fill("End-to-end team.");
            await dialog.getByRole("button", { name: "Create team" }).click();
            await expect(dialog).toBeHidden();
            await page.waitForURL(/\/teams\/[0-9a-f-]{36}$/);
            await expect(page.getByRole("heading", { name: teamName, level: 1 })).toBeVisible();
        });

        await test.step("invite the second participant by email", async () => {
            await page.getByLabel("Invite by email").fill(USERS.judge.email);
            await page.getByRole("button", { name: "Send invitation" }).click();
            await expect(
                page.getByText(`Invitation sent to ${USERS.judge.email}.`, { exact: false }),
            ).toBeVisible();

            await expect
                .poll(async () => invitationTokenForEmail(USERS.judge.email), { timeout: 20_000 })
                .not.toBeNull();
            const token = await invitationTokenForEmail(USERS.judge.email);
            if (token === null) {
                throw new Error("The team invitation token was not published to the outbox.");
            }

            const judgeContext = await newAppContext(browser);
            try {
                const judgePage = await judgeContext.newPage();
                await signIn(judgePage, USERS.judge);
                await judgePage.goto(`/teams?token=${encodeURIComponent(token)}`);
                await expect(
                    judgePage.getByRole("heading", { name: "Team invitation" }),
                ).toBeVisible();
                await judgePage.getByRole("button", { name: "Accept invitation" }).click();
                await expect(judgePage.getByText("Invitation accepted")).toBeVisible();
                await expect(judgePage.getByText(`You joined ${teamName}.`)).toBeVisible();
            } finally {
                await judgeContext.close();
            }

            await page.reload();
            await expect(page.getByText("Fixture Judge", { exact: true }).first()).toBeVisible();
            await expect(page.getByText("2 of 4 members")).toBeVisible();
        });

        await test.step("create and edit a project", async () => {
            await page.goto("/projects");
            await page.getByRole("button", { name: "New project" }).click();
            const dialog = page.getByRole("dialog", { name: "Create a project" });
            await chooseOption(dialog.getByLabel("Edition"), FIXTURE.openEditionName);
            await chooseOption(dialog.getByLabel("Team"), teamName);
            await dialog.getByLabel("Title").fill(projectTitle);
            await dialog.getByLabel("Summary").fill("An end-to-end participant project.");
            await dialog
                .getByLabel("Description")
                .fill("## Project\n\nCreated by the Playwright participant journey.");
            await dialog.getByRole("button", { name: "Create project" }).click();
            await expect(dialog).toBeHidden();
            await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
            await expect(page.getByRole("heading", { name: projectTitle, level: 1 })).toBeVisible();

            await page.getByLabel("Title").fill(updatedTitle);
            await page.getByRole("button", { name: "Save project" }).click();
            await expect(page.getByText("Project saved")).toBeVisible();
            await expect(page.getByRole("heading", { name: updatedTitle, level: 1 })).toBeVisible();
        });

        await test.step("upload a valid PNG file", async () => {
            await page.getByLabel("Upload a file").setInputFiles({
                name: "e2e-pixel.png",
                mimeType: "image/png",
                buffer: PIXEL_PNG,
            });
            await expect(
                page.getByRole("list", { name: "Project files" }).getByText("e2e-pixel.png"),
            ).toBeVisible({ timeout: 20_000 });
        });

        await test.step("submit the project version", async () => {
            await page.goto("/submissions");
            await chooseOption(page.getByLabel("Edition"), FIXTURE.openEditionName);
            await page.getByRole("button", { name: "Start submission" }).first().click();
            const dialog = page.getByRole("dialog", { name: "Start a submission" });
            await chooseOption(dialog.getByLabel("Project"), updatedTitle);
            await dialog.getByRole("button", { name: "Start submission" }).click();
            await expect(dialog).toBeHidden();
            await page.waitForURL(/\/submissions\/[0-9a-f-]{36}$/);

            await page.getByLabel("Version title").fill("E2E Submission v1");
            await page.getByLabel("Summary").fill("First submitted version.");
            await page
                .getByLabel("Description")
                .fill("Initial end-to-end submission description.");
            await page.getByRole("checkbox", { name: "Submit this version for review" }).check();
            await page.getByRole("button", { name: "Save version" }).click();
            await expect(page.getByText("Version saved.")).toBeVisible();
            await expect(
                page.getByRole("heading", { name: "Version 1: E2E Submission v1" }),
            ).toBeVisible();
            await expect(page.getByText("Submitted", { exact: true }).first()).toBeVisible();
        });

        await test.step("sees the decision and invitation notifications", async () => {
            await expect(async () => {
                await page.goto("/notifications");
                await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
                await expect(page.getByText("Registration approved", { exact: true })).toBeVisible({
                    timeout: 2_000,
                });
                await expect(page.getByText("Team invitation accepted", { exact: true })).toBeVisible(
                    { timeout: 2_000 },
                );
            }).toPass({ timeout: 30_000 });
        });
    });
});
