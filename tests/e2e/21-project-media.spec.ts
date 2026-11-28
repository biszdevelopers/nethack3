import { expect, test } from "@playwright/test";
import { API_ORIGIN, FIXTURE, SITE_ORIGIN } from "../support/e2e/config.js";
import { chooseOption, signIn } from "../support/e2e/app.js";
import { ownerTenantQuery } from "../support/e2e/db.js";

const VIDEO_URL = "https://example.com/e2e-demo-video";
const AI_DISCLOSURE =
    "Used a large language model to draft the README. The application code is hand-written.";
const AUTHOR = {
    subject: "fixture-author",
    email: "author@fixture.invalid",
    name: "Fixture Author",
} as const;
const AUTHOR_TEAM_ID = "f2000000-0000-4000-8000-000000000050";

function siteUrl(path: string): string {
    return new URL(path, SITE_ORIGIN).toString();
}

test.describe("project media and AI-use disclosure", () => {
    test.afterAll(async () => {
        await ownerTenantQuery(
            FIXTURE.organizationId,
            "update competition_editions set status = 'voting' where id = $1",
            [FIXTURE.editionId],
        );
    });
    test("creates, publishes, and exposes the video and AI-use disclosure", async ({ page }) => {
        test.setTimeout(240_000);
        const projectTitle = `E2E Media Project ${String(test.info().retry)}`;

        await signIn(page, AUTHOR);

        await test.step("create a project with a video and an AI-use disclosure", async () => {
            await page.goto("/projects");
            await page.getByRole("button", { name: "New project" }).click();
            const dialog = page.getByRole("dialog", { name: "Create a project" });
            await chooseOption(dialog.getByLabel("Edition"), FIXTURE.editionName);
            await chooseOption(dialog.getByLabel("Team"), "Fixture Author Team");
            await dialog.getByLabel("Title").fill(projectTitle);
            await dialog
                .getByLabel("Summary")
                .fill("A project that declares its AI use and links a demonstration video.");
            await dialog.getByLabel("Demonstration video URL").fill(VIDEO_URL);
            await dialog.getByLabel("AI-use disclosure").fill(AI_DISCLOSURE);
            await dialog.getByRole("button", { name: "Create project" }).click();
            await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);

            await expect(page.getByRole("heading", { name: projectTitle, level: 1 })).toBeVisible();
            await expect(page.locator("p", { hasText: AI_DISCLOSURE })).toBeVisible();
            await expect(page.getByRole("link", { name: VIDEO_URL })).toBeVisible();
        });

        await test.step("publish the project", async () => {
            await page.getByRole("button", { name: "Publish project" }).click();
            const dialog = page.getByRole("alertdialog", { name: "Publish project" });
            await expect(dialog).toBeVisible();
            await dialog.getByRole("button", { name: "Publish", exact: true }).click();
            await expect(dialog).toBeHidden({ timeout: 30_000 });
            await expect(page.getByText("Published", { exact: true })).toBeVisible();
        });

        const rows = await ownerTenantQuery<{ slug: string }>(
            FIXTURE.organizationId,
            "select slug from projects where title = $1",
            [projectTitle],
        );
        const slug = rows[0]?.slug;
        if (slug === undefined) {
            throw new Error("The published project was not found in the database.");
        }

        await test.step("the public payload carries the media and team fields", async () => {
            await ownerTenantQuery(
                FIXTURE.organizationId,
                "update competition_editions set status = 'judging' where id = $1",
                [FIXTURE.editionId],
            );
            const hidden = await fetch(`${API_ORIGIN}/api/v1/public/projects/${slug}`);
            expect(hidden.status).toBe(404);
            await ownerTenantQuery(
                FIXTURE.organizationId,
                "update competition_editions set status = 'voting' where id = $1",
                [FIXTURE.editionId],
            );
            const response = await fetch(`${API_ORIGIN}/api/v1/public/projects/${slug}`);
            expect(response.status).toBe(200);
            const payload = (await response.json()) as {
                videoUrl: string | null;
                aiDisclosure: string;
                teamId: string | null;
                teamStatus: string | null;
                divisionName: string | null;
            };
            expect(payload.videoUrl).toBe(VIDEO_URL);
            expect(payload.aiDisclosure).toBe(AI_DISCLOSURE);
            expect(payload.teamId).toBe(AUTHOR_TEAM_ID);
            expect(payload.teamStatus).toBe("ready");
            expect(payload.divisionName).toBe("Open");

            const listResponse = await fetch(`${API_ORIGIN}/api/v1/public/projects?limit=100`);
            expect(listResponse.status).toBe(200);
            const listPayload = (await listResponse.json()) as {
                items: readonly {
                    slug: string;
                    videoUrl: string | null;
                    aiDisclosure: string;
                    teamStatus: string | null;
                    divisionName: string | null;
                }[];
            };
            const listed = listPayload.items.find((item) => item.slug === slug);
            if (listed === undefined) {
                throw new Error("The published project was not returned by the public list.");
            }
            expect(listed.videoUrl).toBe(VIDEO_URL);
            expect(listed.aiDisclosure).toBe(AI_DISCLOSURE);
            expect(listed.teamStatus).toBe("ready");
            expect(listed.divisionName).toBe("Open");
        });

        await test.step("the public project page shows both", async () => {
            await page.goto(siteUrl(`/projects/${slug}`));
            await expect(page.getByRole("heading", { name: projectTitle, level: 1 })).toBeVisible({
                timeout: 60_000,
            });
            await expect(
                page.getByRole("heading", { name: "AI-use disclosure", level: 2 }),
            ).toBeVisible();
            await expect(page.getByText(AI_DISCLOSURE)).toBeVisible();
            const videoLink = page.getByRole("link", { name: /Demonstration video/i });
            await expect(videoLink).toHaveAttribute("href", VIDEO_URL);
            await expect(videoLink).toHaveAttribute("target", "_blank");
            await expect(videoLink).toHaveAttribute("rel", /noopener/);
        });

        await test.step("a project without a disclosure shows the real empty state", async () => {
            await page.goto(siteUrl(`/projects/${FIXTURE.projectSlug}`));
            await expect(
                page.getByRole("heading", { name: FIXTURE.projectTitle, level: 1 }),
            ).toBeVisible({ timeout: 60_000 });
            await expect(
                page.getByText("This team did not provide an AI-use disclosure."),
            ).toBeVisible();
            await expect(page.getByRole("link", { name: /Demonstration video/i })).toHaveCount(0);
        });
    });
});
