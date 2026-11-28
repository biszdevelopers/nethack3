import { expect, test } from "@playwright/test";
import { API_ORIGIN, FIXTURE, USERS, WORKSPACE_ORIGIN } from "../support/e2e/config.js";
import { chooseOption, newAppContext, signIn } from "../support/e2e/app.js";

const REPOSITORY_URL = "https://github.com/example/e2e-integrity-project";
const DEMO_URL = "https://example.com/e2e-integrity-demo";
const VIDEO_URL = "https://example.com/e2e-integrity-video";
const AI_DISCLOSURE = "No AI tools or models were used in this project.";

test.describe("submission integrity", () => {
    test("blocks versions without project evidence, then locks the project after submission", async ({
        page,
        browser,
    }) => {
        test.setTimeout(240_000);
        const projectTitle = `E2E Integrity Project ${String(test.info().retry)}`;

        await signIn(page, USERS.judge);

        await test.step("create a project that is missing submission evidence", async () => {
            await page.goto("/projects");
            await page.getByRole("button", { name: "New project" }).click();
            const dialog = page.getByRole("dialog", { name: "Create a project" });
            await chooseOption(dialog.getByLabel("Edition"), FIXTURE.openEditionName);
            await dialog.getByLabel("Title").fill(projectTitle);
            await dialog
                .getByLabel("Summary")
                .fill("A project created without repository, demo, video, or AI-use evidence.");
            await dialog.getByRole("button", { name: "Create project" }).click();
            await expect(dialog).toBeHidden();
            await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
            await expect(page.getByRole("heading", { name: projectTitle, level: 1 })).toBeVisible();
            await expect(page.getByText("Required before submission.").first()).toBeVisible();
        });

        const projectId = page.url().split("/").at(-1) ?? "";
        expect(projectId).not.toBe("");

        await test.step("the checklist blocks starting a submission", async () => {
            await page.goto("/submissions");
            await page.getByRole("button", { name: "Start submission" }).first().click();
            const dialog = page.getByRole("dialog", { name: "Start a submission" });
            await chooseOption(dialog.getByLabel("Project"), projectTitle);
            const checklist = dialog.getByRole("list", { name: "Submission requirements" });
            await expect(checklist.getByText("Missing")).toHaveCount(4);
            await expect(dialog.getByRole("button", { name: "Start submission" })).toBeDisabled();
            await expect(
                dialog.getByRole("link", { name: "Edit project to add the missing requirements" }),
            ).toBeVisible();
            await expect(
                dialog.getByText("Add the missing project fields before starting a submission."),
            ).toBeVisible();
        });

        await test.step("add the required evidence on the project", async () => {
            await page.goto(`/projects/${projectId}`);
            await page.getByLabel("Repository URL").fill(REPOSITORY_URL);
            await page.getByLabel("Demo URL").fill(DEMO_URL);
            await page.getByLabel("Demonstration video URL").fill(VIDEO_URL);
            await page.getByLabel("AI-use disclosure").fill(AI_DISCLOSURE);
            await page.getByRole("button", { name: "Save project" }).click();
            await expect(page.getByText("Project saved")).toBeVisible();
        });

        await test.step("the completed checklist allows a version", async () => {
            await page.goto("/submissions");
            await page.getByRole("button", { name: "Start submission" }).first().click();
            const dialog = page.getByRole("dialog", { name: "Start a submission" });
            await chooseOption(dialog.getByLabel("Project"), projectTitle);
            const checklist = dialog.getByRole("list", { name: "Submission requirements" });
            await expect(checklist.getByText("Provided")).toHaveCount(4);
            await expect(dialog.getByRole("button", { name: "Start submission" })).toBeEnabled();
            await dialog.getByRole("button", { name: "Start submission" }).click();
            await expect(dialog).toBeHidden();
            await page.waitForURL(/\/submissions\/[0-9a-f-]{36}$/);
        });

        const submissionId = page.url().split("/").at(-1) ?? "";
        expect(submissionId).not.toBe("");

        await test.step("the rules acknowledgement is required before saving a version", async () => {
            await page.getByLabel("Version title").fill("E2E Integrity v1");
            await page.getByLabel("Summary").fill("First submitted integrity version.");
            await page.getByRole("checkbox", { name: "Submit this version for review" }).check();
            await page.getByRole("button", { name: "Save version" }).click();
            await expect(
                page.getByText("Acknowledge the submission rules to continue."),
            ).toBeVisible();
            await expect(page.getByText("Version saved.")).toBeHidden();

            await page
                .getByRole("checkbox", { name: "I acknowledge the submission rules" })
                .check();
            await page.getByRole("button", { name: "Save version" }).click();
            await expect(page.getByText("Version saved.")).toBeVisible();
            await expect(
                page.getByRole("heading", { name: "Version 1: E2E Integrity v1" }),
            ).toBeVisible();
            await expect(page.getByText("Submitted", { exact: true }).first()).toBeVisible();
        });

        await test.step("the project is locked and its edit form is hidden", async () => {
            await page.goto(`/projects/${projectId}`);
            await expect(page.getByRole("heading", { name: projectTitle, level: 1 })).toBeVisible();
            await expect(page.getByText("Project locked after submission")).toBeVisible();
            await expect(page.getByRole("button", { name: "Save project" })).toHaveCount(0);
            await expect(page.getByRole("heading", { name: "Edit project", level: 3 })).toHaveCount(
                0,
            );
        });

        await test.step("the API rejects a project update after the lock", async () => {
            const csrfResponse = await page.request.get(`${API_ORIGIN}/api/v1/auth/csrf`);
            expect(csrfResponse.status()).toBe(200);
            const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };
            const response = await page.request.patch(
                `${API_ORIGIN}/api/v1/projects/${projectId}`,
                {
                    headers: {
                        "content-type": "application/json",
                        "x-csrf-token": csrfToken,
                        "x-nethack-organization-id": FIXTURE.organizationId,
                        origin: WORKSPACE_ORIGIN,
                    },
                    data: { title: "E2E Integrity Project Renamed" },
                },
            );
            expect(response.status()).toBe(409);
            const body = (await response.json()) as { error: { message: string } };
            expect(body.error.message).toContain("locked");
        });

        await test.step("an organizer reopen unlocks the project for editing", async () => {
            const organizerContext = await newAppContext(browser);
            try {
                const organizerPage = await organizerContext.newPage();
                await signIn(organizerPage, USERS.organizer);
                const csrfResponse = await organizerPage.request.get(
                    `${API_ORIGIN}/api/v1/auth/csrf`,
                );
                expect(csrfResponse.status()).toBe(200);
                const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };
                const reopened = await organizerPage.request.post(
                    `${API_ORIGIN}/api/v1/administration/editions/${FIXTURE.openEditionId}/submissions/${submissionId}/reopen`,
                    {
                        headers: {
                            "content-type": "application/json",
                            "x-csrf-token": csrfToken,
                            "x-nethack-organization-id": FIXTURE.organizationId,
                            origin: WORKSPACE_ORIGIN,
                        },
                        data: { status: "draft" },
                    },
                );
                expect(reopened.status()).toBe(204);
            } finally {
                await organizerContext.close();
            }

            await page.goto(`/projects/${projectId}`);
            await expect(
                page.getByRole("heading", { name: "Edit project", level: 3 }),
            ).toBeVisible();
            await expect(page.getByText("Project locked after submission")).toHaveCount(0);
            await page.getByLabel("Repository URL").fill(`${REPOSITORY_URL}-reopened`);
            await page.getByRole("button", { name: "Save project" }).click();
            await expect(page.getByText("Project saved")).toBeVisible();
        });
    });
});
