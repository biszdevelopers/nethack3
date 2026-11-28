import { expect, test } from "@playwright/test";
import { FIXTURE, USERS } from "../support/e2e/config.js";
import { chooseOption, expectToast, signIn } from "../support/e2e/app.js";
import { ownerTenantQuery } from "../support/e2e/db.js";

test.describe("administration operations", () => {
    test.afterAll(async () => {
        await ownerTenantQuery(
            FIXTURE.organizationId,
            "update organization_memberships set role = 'participant' where organization_id = $1 and user_id = $2",
            [FIXTURE.organizationId, FIXTURE.participantId],
        );
        await ownerTenantQuery(
            FIXTURE.organizationId,
            "update organization_memberships set role = 'judge' where organization_id = $1 and user_id = $2",
            [FIXTURE.organizationId, FIXTURE.judgeId],
        );
    });

    test("organizer manages users, teams, standings, and preflight", async ({ page }) => {
        test.setTimeout(180_000);
        await signIn(page, USERS.organizer);

        await page.goto("/admin");
        await expect(page.getByRole("heading", { name: "Administration", level: 1 })).toBeVisible();

        await test.step("refuse a competing participant and promote a teamless judge", async () => {
            await page.getByRole("link", { name: "Users" }).click();
            await expect(page.getByRole("heading", { name: "Users", level: 1 })).toBeVisible();
            const participantRow = page.getByRole("row", { name: /Fixture Participant/ });
            await expect(participantRow).toBeVisible();
            await expect(page.getByRole("button", { name: /Delete account for/ })).toHaveCount(0);

            await participantRow.getByLabel("Role for Fixture Participant").selectOption("judge");
            await expectToast(page, "Could not update the role");
            await expect(
                page
                    .locator('[data-slot="toast"]')
                    .filter({ hasText: "Could not update the role" })
                    .first(),
            ).toContainText(/cannot also be a judge or organizer/i);
            await expect(participantRow.getByLabel("Role for Fixture Participant")).toHaveValue(
                "participant",
            );

            const judgeRow = page.getByRole("row", { name: /Fixture Judge/ });
            await judgeRow.getByLabel("Role for Fixture Judge").selectOption("organizer");
            await expectToast(page, "Member role updated");
            await expect(judgeRow.getByLabel("Role for Fixture Judge")).toHaveValue("organizer");

            await judgeRow.getByLabel("Role for Fixture Judge").selectOption("judge");
            await expectToast(page, "Member role updated");
            await expect(judgeRow.getByLabel("Role for Fixture Judge")).toHaveValue("judge");
        });

        await test.step("inspect edition teams", async () => {
            await page.goto("/admin/teams");
            await expect(page.getByRole("heading", { name: "Teams", level: 1 })).toBeVisible();
            await chooseOption(page.getByLabel("Competition edition"), FIXTURE.editionName);
            const row = page.getByRole("row", { name: /Fixture Team/ });
            await expect(row).toBeVisible();
            await expect(row.getByLabel("Status for Fixture Team")).toHaveValue("ready");
            await expect(row.getByText("Fixture Participant (captain)")).toBeVisible();

            await Promise.all(
                ["Team", "Track", "Status", "Score", "Rank", "Project", "Submitted"].map((column) =>
                    expect(
                        page.getByRole("columnheader", { name: column, exact: true }),
                    ).toBeVisible(),
                ),
            );
            await expect(row.getByText("Open", { exact: true })).toBeVisible();
            await expect(row.getByText(FIXTURE.projectTitle)).toBeVisible();
            await expect(row.getByText("Not submitted")).toHaveCount(0);
        });

        await test.step("read preflight counts and download the standings CSV", async () => {
            await page.goto("/admin/standings");
            await expect(page.getByRole("heading", { name: "Standings", level: 1 })).toBeVisible();
            await chooseOption(page.getByLabel("Competition edition"), FIXTURE.editionName);

            await expect(page.getByRole("heading", { name: "Preflight" })).toBeVisible();
            const statistics = page.locator('[data-slot="statistics"]');
            await expect(statistics.getByText("Teams", { exact: true })).toBeVisible();
            await expect(statistics.getByText("Projects", { exact: true })).toBeVisible();
            await expect(statistics.getByText("Submissions", { exact: true })).toBeVisible();
            await expect(statistics.getByText("Assignments", { exact: true })).toBeVisible();
            await expect(
                statistics.getByText("Submitted evaluations", { exact: true }),
            ).toBeVisible();

            const downloadPromise = page.waitForEvent("download");
            await page.getByRole("button", { name: "Download CSV" }).click();
            const download = await downloadPromise;
            expect(download.suggestedFilename()).toBe(`standings-${FIXTURE.editionId}.csv`);
            const stream = await download.createReadStream();
            let content = "";
            for await (const chunk of stream) {
                content += String(chunk);
            }
            expect(content.split("\n")[0]).toBe(
                "team_id,team,pathway,status,score_exact,score,rank,awards,project_name,demo_url,repo_url,submitted",
            );
            expect(content).toContain("Fixture Team");
            expect(content).toContain("Open,ready");
            expect(content).toContain("Fixture Project");
            expect(content).toContain("https://example.com/fixture");
            expect(content).toContain(",yes");
        });
        await test.step("review preflight warnings on the competition admin page", async () => {
            await page.goto(`/competitions/manage?edition=${FIXTURE.editionId}`);
            await expect(
                page.getByRole("heading", { name: "Competition management", level: 1 }),
            ).toBeVisible({ timeout: 30_000 });
            await expect(
                page.getByRole("heading", { name: "Preflight warnings", level: 3 }),
            ).toBeVisible({ timeout: 30_000 });
            await expect(
                page.getByText("Milestone “Registration closes” occurs before the edition starts."),
            ).toBeVisible();
            await expect(page.getByText(/teams below the 3-evaluation minimum/)).toBeVisible();
            await expect(page.getByText(/Fixture Project/).first()).toBeVisible();
        });
    });

    test("participant cannot open administration pages", async ({ page }) => {
        await signIn(page, USERS.participant);
        await page.goto("/admin/users");
        await expect(page.getByText("Organizer access required")).toBeVisible();
    });
});
