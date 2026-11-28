import { expect, test } from "@playwright/test";
import { FIXTURE, SITE_ORIGIN, USERS } from "../support/e2e/config.js";
import { signIn } from "../support/e2e/app.js";
import { ownerQuery, ownerTenantQuery } from "../support/e2e/db.js";

const DELETE_USER_ID = "f9000000-0000-4000-8000-000000000001";
const AUDIT_LOG_ID = "f9000000-0000-4000-8000-000000000002";
const DELETE_USER_EMAIL = "delete-me@fixture.invalid";

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
        await ownerQuery(
            `insert into users (id, display_name, email)
             values ($1, 'Fixture Delete Target', $2)
             on conflict (id) do update set display_name = excluded.display_name`,
            [DELETE_USER_ID, DELETE_USER_EMAIL],
        );
        await ownerTenantQuery(
            FIXTURE.organizationId,
            `insert into organization_memberships (organization_id, user_id, role, status)
             values ($1, $2, 'participant', 'active')
             on conflict (organization_id, user_id) do nothing`,
            [FIXTURE.organizationId, DELETE_USER_ID],
        );
        await ownerTenantQuery(
            FIXTURE.organizationId,
            `insert into audit_logs (id, organization_id, actor_user_id, action, entity_type, metadata)
             values ($1, $2, null, 'e2e.audit.detail', 'user', $3::jsonb)
             on conflict (id) do nothing`,
            [
                AUDIT_LOG_ID,
                FIXTURE.organizationId,
                JSON.stringify({
                    reason: "E2E audit reason",
                    before: { status: "draft" },
                    after: { status: "ready" },
                }),
            ],
        );
    });

    test.afterAll(async () => {
        await ownerQuery("delete from audit_logs where id = $1", [AUDIT_LOG_ID]);
        await ownerQuery("delete from users where id = $1", [DELETE_USER_ID]);
        await ownerTenantQuery(
            FIXTURE.organizationId,
            "delete from organization_memberships where user_id = $1",
            [DELETE_USER_ID],
        );
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

        await test.step("download the CSV export and check headers and redaction", async () => {
            const downloadPromise = page.waitForEvent("download");
            await page.getByRole("button", { name: "Download CSV export" }).click();
            const download = await downloadPromise;
            expect(download.suggestedFilename()).toMatch(
                /^nethack-export(?:-\d{4}-\d{2}-\d{2})?\.csv$/,
            );
            const stream = await download.createReadStream();
            expect(stream).not.toBeNull();
            let content = "";
            for await (const chunk of stream ?? []) {
                content += String(chunk);
            }
            expect(content.length).toBeGreaterThan(0);
            expect(content).toContain("id,name");
            expect(content).not.toContain("must-not-leak");
        });

        await test.step("read the audit diff metadata", async () => {
            await page.getByLabel("Organization identifier").fill(FIXTURE.organizationId);
            await page.getByRole("button", { name: "Apply filters" }).click();
            await expect(page.getByText("e2e.audit.detail")).toBeVisible();
            await expect(page.getByText("Reason: E2E audit reason")).toBeVisible();
            await expect(page.getByText("draft", { exact: true }).first()).toBeVisible();
            await expect(page.getByText("ready", { exact: true }).first()).toBeVisible();
            await expect(page.getByText("Raw metadata").first()).toBeVisible();
        });

        await test.step("delete a user account", async () => {
            await page.goto("/admin/users");
            await expect(page.getByRole("heading", { name: "Users", level: 1 })).toBeVisible();
            const row = page.getByRole("row", { name: new RegExp(DELETE_USER_EMAIL) });
            await expect(row).toBeVisible();
            await row
                .getByRole("button", {
                    name: "Delete account for Fixture Delete Target",
                })
                .click();

            const dialog = page.getByRole("alertdialog");
            await expect(dialog.getByRole("heading", { name: "Delete account" })).toBeVisible();
            await dialog.getByRole("button", { name: "Delete account" }).click();
            await expect(page.getByText("Account deleted", { exact: true })).toBeVisible();
            await expect(
                page.getByRole("row", { name: new RegExp(DELETE_USER_EMAIL) }),
            ).toHaveCount(0);

            const remaining = await ownerQuery<{ count: string }>(
                "select count(*)::text as count from users where id = $1",
                [DELETE_USER_ID],
            );
            expect(remaining[0]?.count).toBe("0");
        });

        await test.step("operator sees the organizer preflight warnings", async () => {
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
