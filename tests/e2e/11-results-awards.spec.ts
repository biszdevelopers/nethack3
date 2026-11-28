import { expect, test } from "@playwright/test";
import { FIXTURE, SITE_ORIGIN, USERS } from "../support/e2e/config.js";
import { chooseOption, expectToast, signIn } from "../support/e2e/app.js";
import { ownerTenantQuery } from "../support/e2e/db.js";

test.describe("results and awards", () => {
    test("publishes awarded results and prints a certificate", async ({ page }) => {
        test.setTimeout(240_000);
        const awardName = "E2E Spirit Award";

        const teamRows = await ownerTenantQuery<{ id: string }>(
            FIXTURE.organizationId,
            "select id from teams where edition_id = $1 and name = $2",
            [FIXTURE.editionId, "Fixture Author Team"],
        );
        const teamId = teamRows[0]?.id ?? "";
        expect(teamId).not.toBe("");

        await signIn(page, USERS.organizer);
        await page.goto("/awards");
        await expect(page.getByRole("heading", { name: "Awards", level: 1 })).toBeVisible();
        await chooseOption(page.getByLabel("Competition edition"), FIXTURE.editionName);

        await test.step("locked public results show the scheduled release", async () => {
            await ownerTenantQuery(
                FIXTURE.organizationId,
                "update competition_editions set results_open_at = now() + interval '2 days' where id = $1",
                [FIXTURE.editionId],
            );
            await page.goto(`${SITE_ORIGIN}/results`);
            await expect(page.getByRole("heading", { name: "Results", level: 1 })).toBeVisible();
            await expect(page.getByText("Results not published yet")).toBeVisible();
            await expect(page.getByText(/Scheduled release:/)).toBeVisible();
            await ownerTenantQuery(
                FIXTURE.organizationId,
                "update competition_editions set results_open_at = null where id = $1",
                [FIXTURE.editionId],
            );
            await page.goto("/awards");
            await chooseOption(page.getByLabel("Competition edition"), FIXTURE.editionName);
        });

        await test.step("create an award", async () => {
            const form = page
                .getByRole("button", { name: "Create award" })
                .locator("xpath=ancestor::form");
            await form.getByLabel("Award key").fill("e2e-spirit");
            await form.getByLabel("Award name").fill(awardName);
            await form
                .getByLabel("Description")
                .fill("Award created by the Playwright results journey.");
            await form.getByRole("button", { name: "Create award" }).click();
            await expectToast(page, "Award created");
            await expect(page.getByRole("row", { name: /E2E Spirit Award/ })).toBeVisible({
                timeout: 30_000,
            });
        });

        await test.step("assign the award to the judged team", async () => {
            const form = page
                .getByRole("button", { name: "Assign award" })
                .locator("xpath=ancestor::form");
            await chooseOption(form.getByLabel("Award"), awardName);
            await chooseOption(form.getByLabel("Team"), "Fixture Author Team");
            await form.getByLabel("Note").fill("Awarded by the Playwright results journey.");
            await form.getByRole("button", { name: "Assign award" }).click();
            await expectToast(page, "Award assigned");
            await expect(
                page.getByRole("row", { name: /Fixture Author Team.*E2E Spirit Award/ }),
            ).toBeVisible();
        });

        await test.step("enable public rankings for the edition", async () => {
            await ownerTenantQuery(
                FIXTURE.organizationId,
                "update competition_editions set show_ranking = true where id = $1",
                [FIXTURE.editionId],
            );
        });

        await test.step("publish the results snapshot", async () => {
            await page.getByRole("button", { name: "Publish results" }).click();
            const dialog = page.getByRole("alertdialog", { name: "Publish results" });
            await expect(dialog).toBeVisible();
            await dialog.getByRole("button", { name: "Publish results" }).click();
            await expectToast(page, "Results published");
            await expect(page.getByText("Published", { exact: true }).first()).toBeVisible();
        });

        await test.step("public results show the award and ranking", async () => {
            await page.goto(`${SITE_ORIGIN}/results`);
            await expect(page.getByRole("heading", { name: "Results", level: 1 })).toBeVisible();
            await expect(page.getByText(FIXTURE.labProjectTitle).first()).toBeVisible();
            await expect(page.getByText(awardName).first()).toBeVisible();
            await expect(
                page.getByText(/Rank #\d+|Unranked|Not enough reviews/).first(),
            ).toBeVisible();
            await expect(page.getByRole("link", { name: "Certificate" }).first()).toBeVisible();
        });

        await test.step("certificate shows the project, team, and award in print media", async () => {
            await page.goto(`${SITE_ORIGIN}/certificates/${teamId}`);
            await expect(
                page.getByRole("heading", { name: "Certificate of Achievement", level: 1 }),
            ).toBeVisible();
            await expect(page.getByText(FIXTURE.labProjectTitle).first()).toBeVisible();
            await expect(page.getByText("Fixture Author Team").first()).toBeVisible();
            await expect(page.getByText(awardName).first()).toBeVisible();

            await page.emulateMedia({ media: "print" });
            await expect(
                page.getByRole("heading", { name: "Certificate of Achievement", level: 1 }),
            ).toBeVisible();
            await expect(page.getByText(awardName).first()).toBeVisible();
            await expect(page.getByRole("banner")).toBeHidden();
            await page.emulateMedia({ media: "screen" });
        });

        await test.step("unpublish restores the edition for later journeys", async () => {
            await page.goto("/awards");
            await chooseOption(page.getByLabel("Competition edition"), FIXTURE.editionName);
            await page.getByRole("button", { name: "Unpublish results" }).click();
            const dialog = page.getByRole("alertdialog", { name: "Unpublish results" });
            await expect(dialog).toBeVisible();
            await dialog.getByRole("button", { name: "Unpublish results" }).click();
            await expectToast(page, "Results unpublished");
        });
    });
});
