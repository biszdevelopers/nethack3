import { expect, test, type Page } from "@playwright/test";
import { API_ORIGIN, FIXTURE, USERS, WORKSPACE_ORIGIN } from "../support/e2e/config.js";
import { chooseOption, expectToast, newAppContext, signIn } from "../support/e2e/app.js";
import { ownerTenantBatch, ownerTenantQuery } from "../support/e2e/db.js";

const JUNIOR_DIVISION_ID = "f5000000-0000-4000-8000-000000000002";
const JUNIOR_DIVISION_NAME = "Junior";
const JUNIOR_TEAM_ID = "f5000000-0000-4000-8000-000000000020";
const OPEN_EXTRA_TEAM_ID = "f5000000-0000-4000-8000-000000000021";
const JUNIOR_PROJECT_ID = "f5000000-0000-4000-8000-000000000030";
const OPEN_EXTRA_PROJECT_ID = "f5000000-0000-4000-8000-000000000031";
const JUNIOR_SUBMISSION_ID = "f5000000-0000-4000-8000-000000000040";
const OPEN_EXTRA_SUBMISSION_ID = "f5000000-0000-4000-8000-000000000041";
const JUNIOR_VERSION_ID = "f5000000-0000-4000-8000-000000000050";
const OPEN_EXTRA_VERSION_ID = "f5000000-0000-4000-8000-000000000051";
const JUNIOR_PROJECT_TITLE = "Junior Track Project";
const OPEN_EXTRA_PROJECT_TITLE = "Open Extra Project";
const ROUND_NAME = "E2E Eligibility Scope";

interface VotableSubmissionBody {
    readonly items: readonly {
        readonly id: string;
        readonly projectTitle: string;
        readonly teamId: string | null;
        readonly divisionName: string | null;
    }[];
}

async function seedTracks(): Promise<void> {
    await ownerTenantBatch(FIXTURE.organizationId, [
        {
            text: `insert into divisions (id, organization_id, edition_id, name, slug, description)
                   values ($1, $2, $3, $4, 'junior',
                           'Second track used by the voting eligibility journey.')
                   on conflict do nothing`,
            values: [
                JUNIOR_DIVISION_ID,
                FIXTURE.organizationId,
                FIXTURE.editionId,
                JUNIOR_DIVISION_NAME,
            ],
        },
        {
            text: `insert into teams
                       (id, organization_id, edition_id, division_id, name, description, status,
                        captain_user_id, max_members)
                   values ($1, $2, $3, $4, 'Junior Team', 'Junior track team.', 'ready', $5, 4)
                   on conflict do nothing`,
            values: [
                JUNIOR_TEAM_ID,
                FIXTURE.organizationId,
                FIXTURE.editionId,
                JUNIOR_DIVISION_ID,
                FIXTURE.participantId,
            ],
        },
        {
            text: `insert into teams
                       (id, organization_id, edition_id, division_id, name, description, status,
                        captain_user_id, max_members)
                   values ($1, $2, $3, $4, 'Open Extra Team', 'Second open track team.', 'ready', $5, 4)
                   on conflict do nothing`,
            values: [
                OPEN_EXTRA_TEAM_ID,
                FIXTURE.organizationId,
                FIXTURE.editionId,
                FIXTURE.divisionId,
                FIXTURE.participantId,
            ],
        },
        {
            text: `insert into projects
                       (id, organization_id, edition_id, team_id, owner_user_id, title, slug, summary,
                        description_markdown, repository_url, tags, status, published_at)
                   values ($1, $2, $3, $4, $5, $6, 'junior-track-project',
                           'A project on the other track.', 'Eligibility fixture.',
                           'https://example.com/junior-track', array['eligibility'], 'published', now())
                   on conflict do nothing`,
            values: [
                JUNIOR_PROJECT_ID,
                FIXTURE.organizationId,
                FIXTURE.editionId,
                JUNIOR_TEAM_ID,
                FIXTURE.participantId,
                JUNIOR_PROJECT_TITLE,
            ],
        },
        {
            text: `insert into projects
                       (id, organization_id, edition_id, team_id, owner_user_id, title, slug, summary,
                        description_markdown, repository_url, tags, status, published_at)
                   values ($1, $2, $3, $4, $5, $6, 'open-extra-project',
                           'A second project on the voter track.', 'Eligibility fixture.',
                           'https://example.com/open-extra', array['eligibility'], 'published', now())
                   on conflict do nothing`,
            values: [
                OPEN_EXTRA_PROJECT_ID,
                FIXTURE.organizationId,
                FIXTURE.editionId,
                OPEN_EXTRA_TEAM_ID,
                FIXTURE.participantId,
                OPEN_EXTRA_PROJECT_TITLE,
            ],
        },
        {
            text: `insert into submissions
                       (id, organization_id, edition_id, project_id, team_id, status,
                        current_version, submitted_at)
                   values ($1, $2, $3, $4, $5, 'submitted', 1, now())
                   on conflict do nothing`,
            values: [
                JUNIOR_SUBMISSION_ID,
                FIXTURE.organizationId,
                FIXTURE.editionId,
                JUNIOR_PROJECT_ID,
                JUNIOR_TEAM_ID,
            ],
        },
        {
            text: `insert into submissions
                       (id, organization_id, edition_id, project_id, team_id, status,
                        current_version, submitted_at)
                   values ($1, $2, $3, $4, $5, 'submitted', 1, now())
                   on conflict do nothing`,
            values: [
                OPEN_EXTRA_SUBMISSION_ID,
                FIXTURE.organizationId,
                FIXTURE.editionId,
                OPEN_EXTRA_PROJECT_ID,
                OPEN_EXTRA_TEAM_ID,
            ],
        },
        {
            text: `insert into submission_versions
                       (id, organization_id, submission_id, version, title, summary,
                        description_markdown, repository_url, created_by_user_id)
                   values ($1, $2, $3, 1, $4, 'Junior eligibility submission.',
                           'Initial submission.', 'https://example.com/junior-track', $5)
                   on conflict do nothing`,
            values: [
                JUNIOR_VERSION_ID,
                FIXTURE.organizationId,
                JUNIOR_SUBMISSION_ID,
                JUNIOR_PROJECT_TITLE,
                FIXTURE.participantId,
            ],
        },
        {
            text: `insert into submission_versions
                       (id, organization_id, submission_id, version, title, summary,
                        description_markdown, repository_url, created_by_user_id)
                   values ($1, $2, $3, 1, $4, 'Open eligibility submission.',
                           'Initial submission.', 'https://example.com/open-extra', $5)
                   on conflict do nothing`,
            values: [
                OPEN_EXTRA_VERSION_ID,
                FIXTURE.organizationId,
                OPEN_EXTRA_SUBMISSION_ID,
                OPEN_EXTRA_PROJECT_TITLE,
                FIXTURE.participantId,
            ],
        },
    ]);
}

async function submissionIdsByTitle(): Promise<ReadonlyMap<string, string>> {
    const rows = await ownerTenantQuery<{ id: string; title: string }>(
        FIXTURE.organizationId,
        `select s.id, v.title
           from submissions s
           join submission_versions v
             on v.submission_id = s.id and v.version = s.current_version
          where s.organization_id = $1 and s.edition_id = $2`,
        [FIXTURE.organizationId, FIXTURE.editionId],
    );
    return new Map(rows.map((row) => [row.title, row.id]));
}

async function csrfToken(page: Page): Promise<string> {
    const response = await page.request.get(`${API_ORIGIN}/api/v1/auth/csrf`);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as { csrfToken: string };
    return body.csrfToken;
}

async function castBallot(
    page: Page,
    roundId: string,
    scores: readonly { readonly submissionId: string; readonly stars: number }[],
): Promise<{ readonly status: number; readonly body: unknown }> {
    const token = await csrfToken(page);
    const response = await page.request.post(
        `${API_ORIGIN}/api/v1/voting-rounds/${roundId}/ballot`,
        {
            headers: {
                "content-type": "application/json",
                "x-csrf-token": token,
                "x-nethack-organization-id": FIXTURE.organizationId,
                origin: WORKSPACE_ORIGIN,
            },
            data: { scores: [...scores] },
        },
    );
    return { status: response.status(), body: await response.json() };
}

async function createAndOpenRound(page: Page): Promise<void> {
    await page.goto("/voting");
    await chooseOption(page.getByLabel("Competition edition"), FIXTURE.editionName);
    const form = page.getByRole("button", { name: "Create round" }).locator("xpath=ancestor::form");
    await form.getByLabel("Name").fill(ROUND_NAME);
    await form.getByLabel("Description").fill("Eligibility scope journey.");
    await form.getByRole("button", { name: "Create round" }).click();
    await expectToast(page, "Voting round created");
    const row = page.getByRole("row", { name: new RegExp(ROUND_NAME) });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Open" }).click();
    await expectToast(page, "Round opened");
}

test.describe("voting eligibility", () => {
    test("a voter sees only same-track projects and cannot ballot for an own-team or out-of-track submission", async ({
        page,
        browser,
    }) => {
        test.setTimeout(300_000);
        await seedTracks();
        await signIn(page, USERS.organizer);
        await createAndOpenRound(page);

        const roundRows = await ownerTenantQuery<{ id: string }>(
            FIXTURE.organizationId,
            "select id from voting_rounds where name = $1",
            [ROUND_NAME],
        );
        const roundId = roundRows[0]?.id ?? "";
        expect(roundId).not.toBe("");
        const ids = await submissionIdsByTitle();
        const labId = ids.get(FIXTURE.labProjectTitle) ?? "";
        const ownTeamId = ids.get(FIXTURE.projectTitle) ?? "";
        const juniorId = ids.get(JUNIOR_PROJECT_TITLE) ?? "";
        const openExtraId = ids.get(OPEN_EXTRA_PROJECT_TITLE) ?? "";
        expect(labId).not.toBe("");
        expect(ownTeamId).not.toBe("");
        expect(juniorId).not.toBe("");
        expect(openExtraId).not.toBe("");

        const participantContext = await newAppContext(browser);
        try {
            const participantPage = await participantContext.newPage();
            await signIn(participantPage, USERS.participant);

            await test.step("the ballot lists same-track projects and hides own-team and other-track projects", async () => {
                await participantPage.goto(`/voting?edition=${FIXTURE.editionId}`);
                const card = participantPage
                    .getByRole("heading", { name: ROUND_NAME, level: 3 })
                    .locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]");
                await expect(card).toBeVisible();
                await expect(
                    card.getByRole("listitem").filter({ hasText: FIXTURE.labProjectTitle }),
                ).toBeVisible();
                await expect(
                    card.getByRole("listitem").filter({ hasText: OPEN_EXTRA_PROJECT_TITLE }),
                ).toBeVisible();
                await expect(card.getByText(FIXTURE.projectTitle, { exact: true })).toHaveCount(0);
                await expect(card.getByText(JUNIOR_PROJECT_TITLE, { exact: true })).toHaveCount(0);
                const openExtraRow = card
                    .getByRole("listitem")
                    .filter({ hasText: OPEN_EXTRA_PROJECT_TITLE });
                await expect(openExtraRow.getByText("Open", { exact: true })).toBeVisible();
            });

            await test.step("the discovery endpoint returns only the voter's division", async () => {
                const response = await participantPage.request.get(
                    `${API_ORIGIN}/api/v1/competitions/${FIXTURE.editionId}/votable-submissions`,
                    { headers: { "x-nethack-organization-id": FIXTURE.organizationId } },
                );
                expect(response.status()).toBe(200);
                const body = (await response.json()) as VotableSubmissionBody;
                const returnedIds = body.items.map((item) => item.id).toSorted();
                expect(returnedIds).toEqual([labId, openExtraId].toSorted());
                expect(body.items.every((item) => item.divisionName === "Open")).toBe(true);
            });

            await test.step("a crafted own-team ballot is rejected", async () => {
                const result = await castBallot(participantPage, roundId, [
                    { submissionId: ownTeamId, stars: 5 },
                    { submissionId: labId, stars: 5 },
                ]);
                expect(result.status).toBe(403);
                expect(result.body).toMatchObject({
                    error: {
                        code: "forbidden",
                        message: "You cannot score your own team's submission.",
                    },
                });
            });

            await test.step("a crafted out-of-track ballot is rejected", async () => {
                const result = await castBallot(participantPage, roundId, [
                    { submissionId: juniorId, stars: 5 },
                    { submissionId: labId, stars: 5 },
                ]);
                expect(result.status).toBe(403);
                expect(result.body).toMatchObject({
                    error: {
                        code: "forbidden",
                        message: "You can only score submissions from your own division.",
                    },
                });
            });

            await test.step("a ballot for two same-track, other-team projects is accepted", async () => {
                const result = await castBallot(participantPage, roundId, [
                    { submissionId: labId, stars: 5 },
                    { submissionId: openExtraId, stars: 5 },
                ]);
                expect(result.status).toBe(201);
            });
        } finally {
            await participantContext.close();
        }
    });
});
