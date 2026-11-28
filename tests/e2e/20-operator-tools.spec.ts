import { expect, test } from "@playwright/test";
import { FIXTURE, SITE_ORIGIN, USERS } from "../support/e2e/config.js";
import { signIn } from "../support/e2e/app.js";
import { ownerQuery } from "../support/e2e/db.js";

function siteUrl(path: string): string {
    return new URL(path, SITE_ORIGIN).toString();
}

test.describe("operator tools and public guidance", () => {
    test.beforeAll(async () => {
        await ownerQuery(
            `insert into global_administrators (user_id, reason)
             values ($1, 'E2E operator tools')
             on conflict (user_id) do nothing`,
            [FIXTURE.organizerId],
        );
    });

    test.afterAll(async () => {
        await ownerQuery("delete from global_administrators where user_id = $1", [
            FIXTURE.organizerId,
        ]);
    });

    test("global administrator downloads the export and opens debug and docs", async ({ page }) => {
        test.setTimeout(180_000);
        await signIn(page, USERS.organizer);

        await page.goto("/admin");
        await expect(page.getByRole("heading", { name: "Administration", level: 1 })).toBeVisible();

        await test.step("download the anonymized database export", async () => {
            const downloadPromise = page.waitForEvent("download");
            await page.getByRole("button", { name: "Download database export" }).click();
            const download = await downloadPromise;
            expect(download.suggestedFilename()).toMatch(
                /^nethack-export(?:-\d{4}-\d{2}-\d{2})?\.json$/,
            );
            const stream = await download.createReadStream();
            expect(stream).not.toBeNull();
            let content = "";
            for await (const chunk of stream ?? []) {
                content += String(chunk);
            }
            const archive = JSON.parse(content) as {
                formatVersion: number;
                omitted: string[];
                organizations: unknown[];
                judgeAssignments: Record<string, unknown>[];
                submissionFiles: Record<string, unknown>[];
            };

            expect(archive.formatVersion).toBe(1);
            expect(archive.omitted.join(" ")).toContain("Judge identities");
            expect(
                archive.organizations.some(
                    (organization) =>
                        (organization as { id?: string }).id === FIXTURE.organizationId,
                ),
            ).toBe(true);
            expect(
                archive.judgeAssignments.every((assignment) => !("judgeUserId" in assignment)),
            ).toBe(true);
            expect(
                archive.submissionFiles.every(
                    (file) => !("storageKey" in file) && !("content" in file),
                ),
            ).toBe(true);
        });

        await test.step("inspect debug tools and the unconfigured assistant", async () => {
            await page.goto("/developers/debug");
            await expect(
                page.getByRole("heading", { name: "Developer tools", level: 1 }),
            ).toBeVisible({ timeout: 30_000 });
            await expect(
                page.getByRole("heading", { name: "Stored files", exact: true }),
            ).toBeVisible();
            await expect(
                page.getByRole("heading", { name: "Active references", exact: true }),
            ).toBeVisible();
            await expect(
                page.getByText("AI assistant is not configured", { exact: false }),
            ).toBeVisible();
            await expect(page.getByText("Not configured", { exact: true })).toBeVisible();
        });

        await test.step("read the documentation index", async () => {
            await page.goto("/developers/docs");
            await expect(
                page.getByRole("heading", { name: "Documentation", level: 1 }),
            ).toBeVisible({ timeout: 30_000 });
            await expect(page.getByText("Engineering constitution")).toBeVisible();
            await expect(page.getByText("docs/engineering/constitution.md")).toBeVisible();
        });
    });

    test("public FAQ and rules carry the verbatim competition rules", async ({ page }) => {
        test.setTimeout(180_000);

        await page.goto(siteUrl("/faq"));
        await expect(
            page.getByRole("heading", { name: "Frequently asked questions", level: 1 }),
        ).toBeVisible({ timeout: 60_000 });
        await expect(page.getByText("Is AI allowed?")).toBeVisible();
        await expect(page.getByText("How does peer voting work?")).toBeVisible();

        await page.goto(siteUrl("/rules"));
        await expect(
            page.getByRole("heading", {
                name: "Code of Conduct and Competition Rules",
                level: 1,
            }),
        ).toBeVisible({ timeout: 60_000 });
        await expect(page.getByText("Version 1.0.", { exact: false }).first()).toBeVisible();
        await expect(
            page.getByText("The video must contain absolutely no audio.", { exact: false }).first(),
        ).toBeVisible();
        await expect(
            page.getByText("Your AI usage disclosure is complete and accurate.").first(),
        ).toBeVisible();
        await expect(
            page.getByRole("heading", {
                name: "Phase 6: General Terms and Responsibilities",
                level: 3,
            }),
        ).toBeVisible();
        await expect(page.getByText("devclub-bisz@basischina.com").first()).toBeVisible();
        await expect(
            page.getByText("May careful work take root and grow", { exact: false }).first(),
        ).toBeVisible();
    });
});
