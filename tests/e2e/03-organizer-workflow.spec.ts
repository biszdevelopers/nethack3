import { expect, test } from "@playwright/test";
import { FIXTURE, USERS } from "../support/e2e/config.js";
import { chooseOption, expectToast, signIn } from "../support/e2e/app.js";

function localDateTime(daysFromNow: number): string {
    const date = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
    const pad = (value: number): string => String(value).padStart(2, "0");
    return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

test.describe("organizer workflow", () => {
    test("creates an edition, schedules it, approves a registration, and assigns a judge", async ({
        page,
    }) => {
        test.setTimeout(240_000);
        const seriesName = "E2E Series";
        const editionName = "E2E Organizer Edition";

        await signIn(page, USERS.organizer);
        await page.goto("/competitions/manage");
        await expect(
            page.getByRole("heading", { name: "Competition management", level: 1 }),
        ).toBeVisible();

        await test.step("create a series", async () => {
            const form = page.getByRole("button", { name: "Create series" }).locator("xpath=ancestor::form");
            await form.getByLabel("Name").fill(seriesName);
            await form.getByLabel("Slug").fill("e2e-series");
            await form.getByLabel("Description").fill("Series created by the E2E organizer journey.");
            await form.getByRole("button", { name: "Create series" }).click();
            await expectToast(page, "Competition series created");
        });

        let editionId = "";
        await test.step("create and publish an edition", async () => {
            const form = page.getByRole("button", { name: "Create edition" }).locator("xpath=ancestor::form");
            await chooseOption(form.getByLabel("Series"), seriesName);
            await form.getByLabel("Edition name").fill(editionName);
            await form.getByLabel("Slug").fill("e2e-organizer-edition");
            await form.getByLabel("Description").fill("Edition created by the E2E organizer journey.");
            await form.getByLabel("Registration opens").fill(localDateTime(-1));
            await form.getByLabel("Registration closes").fill(localDateTime(10));
            await form.getByLabel("Starts").fill(localDateTime(14));
            await form.getByLabel("Ends").fill(localDateTime(16));
            await form.getByRole("button", { name: "Create edition" }).click();
            await expectToast(page, "Edition created");
            await page.waitForURL(/[?&]edition=[0-9a-f-]{36}/);
            const params = new URL(page.url()).searchParams;
            editionId = params.get("edition") ?? "";
            expect(editionId).not.toBe("");
            await expect(page.getByRole("heading", { name: editionName, level: 2 })).toBeVisible();

            await page.getByRole("button", { name: "Publish edition" }).click();
            await expectToast(page, "Edition published");
        });

        await test.step("open registration, add a division, and schedule a milestone", async () => {
            const editForm = page.getByRole("button", { name: "Save edition" }).locator("xpath=ancestor::form");
            await chooseOption(editForm.getByLabel("Status"), "Registration open");
            await editForm.getByRole("button", { name: "Save edition" }).click();
            await expectToast(page, "Edition saved");

            const divisionForm = page
                .getByRole("button", { name: "Create division" })
                .locator("xpath=ancestor::form");
            await divisionForm.getByLabel("Name").fill("Open");
            await divisionForm.getByLabel("Slug").fill("open");
            await divisionForm.getByLabel("Description").fill("E2E open division.");
            await divisionForm.getByRole("button", { name: "Create division" }).click();
            await expectToast(page, "Division created");

            const milestoneForm = page
                .getByRole("button", { name: "Create milestone" })
                .locator("xpath=ancestor::form");
            await milestoneForm.getByLabel("Title").fill("Submission deadline");
            await milestoneForm.getByLabel("Occurs at").fill(localDateTime(12));
            await milestoneForm.getByRole("button", { name: "Create milestone" }).click();
            await expectToast(page, "Milestone created");
        });

        await test.step("approve a pending registration", async () => {
            await page.goto(`/competitions/${FIXTURE.openEditionId}`);
            const row = page.getByRole("row", { name: /Fixture Applicant/ });
            await expect(row).toBeVisible();
            await row.getByRole("button", { name: "Approve" }).click();
            await expect(row.getByText("Approved", { exact: true })).toBeVisible();
        });

        await test.step("assign the fixture judge to the seeded submission", async () => {
            await page.goto(`/judging?edition=${FIXTURE.editionId}`);
            const assignmentForm = page
                .getByRole("button", { name: "Create assignment" })
                .locator("xpath=ancestor::form");
            await chooseOption(
                assignmentForm.getByLabel("Submission"),
                new RegExp(FIXTURE.projectTitle),
            );
            await chooseOption(
                assignmentForm.getByLabel("Rubric"),
                "E2E Organizer Rubric (2 criteria)",
            );
            await assignmentForm.getByLabel("Judge email").fill(USERS.judge.email);
            await assignmentForm.getByLabel("Assignment note").fill("E2E judging assignment.");
            await assignmentForm.getByRole("button", { name: "Create assignment" }).click();
            await expectToast(page, "Assignment created");
            const row = page.getByRole("row", { name: /Fixture Project.*Fixture Judge/ });
            await expect(row).toBeVisible();
        });
    });

    test("offers rubric creation in the judging workspace", async ({ page }) => {
        await signIn(page, USERS.organizer);
        await page.goto(`/judging?edition=${FIXTURE.editionId}`);
        await expect(page.getByRole("button", { name: /create rubric/i })).toBeVisible({
            timeout: 5_000,
        });
    });

    test("offers submission review from the submission page", async ({ page }) => {
        await signIn(page, USERS.organizer);
        await page.goto(`/submissions/${FIXTURE.submissionId}`);
        await expect(page.getByRole("heading", { name: FIXTURE.projectTitle, level: 1 })).toBeVisible();
        await expect(page.getByRole("button", { name: /review submission/i })).toBeVisible({
            timeout: 5_000,
        });
    });

    test("offers announcement publishing to organizers", async ({ page }) => {
        await signIn(page, USERS.organizer);
        await page.goto("/organization");
        await expect(page.getByRole("tab", { name: /announcements/i })).toBeVisible({
            timeout: 5_000,
        });
    });
});
