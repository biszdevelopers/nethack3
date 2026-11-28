import { expect, test, type Page } from "@playwright/test";
import { API_ORIGIN, FIXTURE, USERS, WORKSPACE_ORIGIN } from "../support/e2e/config.js";
import { chooseOption, expectToast, newAppContext, signIn } from "../support/e2e/app.js";
import { ownerTenantQuery } from "../support/e2e/db.js";

interface BallotScore {
    readonly submissionId: string;
    readonly stars: number;
}

interface VoteResultBody {
    readonly totalBallots: number;
    readonly entries: readonly {
        readonly submissionId: string;
        readonly projectTitle: string;
        readonly rank: number;
        readonly votes: number;
        readonly totalStars: number;
        readonly averageStars: number;
    }[];
}

async function csrfToken(page: Page): Promise<string> {
    const response = await page.request.get(`${API_ORIGIN}/api/v1/auth/csrf`);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as { csrfToken: string };
    return body.csrfToken;
}

async function createAndOpenRound(page: Page, name: string): Promise<string> {
    await page.goto("/voting");
    await chooseOption(page.getByLabel("Competition edition"), FIXTURE.editionName);
    const form = page.getByRole("button", { name: "Create round" }).locator("xpath=ancestor::form");
    await form.getByLabel("Name").fill(name);
    await form.getByLabel("Description").fill("Star voting rules created by the Playwright suite.");
    await form.getByRole("spinbutton", { name: "Per-voter cap" }).fill("2");
    await form.getByRole("checkbox", { name: "Organizers" }).check();
    await form.getByRole("button", { name: "Create round" }).click();
    await expectToast(page, "Voting round created");

    const rows = await ownerTenantQuery<{ id: string }>(
        FIXTURE.organizationId,
        "select id from voting_rounds where name = $1",
        [name],
    );
    const roundId = rows[0]?.id ?? "";
    expect(roundId).not.toBe("");

    const row = page.getByRole("row", { name: new RegExp(name) });
    await row.getByRole("button", { name: "Open" }).click();
    await expectToast(page, "Round opened");
    return roundId;
}

async function castBallotWithCsrf(
    page: Page,
    roundId: string,
    scores: readonly BallotScore[],
    reasoning?: string,
): Promise<number> {
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
            data: {
                scores: [...scores],
                ...(reasoning === undefined ? {} : { reasoning }),
            },
        },
    );
    return response.status();
}

async function roundTransition(
    page: Page,
    roundId: string,
    action: "close" | "publish",
): Promise<number> {
    const token = await csrfToken(page);
    const response = await page.request.post(
        `${API_ORIGIN}/api/v1/voting-rounds/${roundId}/${action}`,
        {
            headers: {
                "content-type": "application/json",
                "x-csrf-token": token,
                "x-nethack-organization-id": FIXTURE.organizationId,
                origin: WORKSPACE_ORIGIN,
            },
        },
    );
    if (response.status() >= 500) {
        console.error(`Voting ${action} failed: ${await response.text()}`);
    }
    return response.status();
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

test.describe("star voting", () => {
    test("enforces exact ten stars, five per project, and no duplicates", async ({ page }) => {
        test.setTimeout(240_000);
        await signIn(page, USERS.organizer);
        const roundId = await createAndOpenRound(page, "E2E Star Rules");
        const ids = await submissionIdsByTitle();
        const fixtureId = ids.get(FIXTURE.projectTitle) ?? "";
        const labId = ids.get(FIXTURE.labProjectTitle) ?? "";
        expect(fixtureId).not.toBe("");
        expect(labId).not.toBe("");

        await test.step("a ballot that under-allocates is rejected", async () => {
            const status = await castBallotWithCsrf(page, roundId, [
                { submissionId: fixtureId, stars: 5 },
                { submissionId: labId, stars: 4 },
            ]);
            expect(status).toBe(400);
        });

        await test.step("a project above five stars is rejected", async () => {
            const status = await castBallotWithCsrf(page, roundId, [
                { submissionId: fixtureId, stars: 6 },
                { submissionId: labId, stars: 4 },
            ]);
            expect(status).toBe(400);
        });

        await test.step("duplicate project ids are rejected", async () => {
            const status = await castBallotWithCsrf(page, roundId, [
                { submissionId: fixtureId, stars: 5 },
                { submissionId: fixtureId, stars: 5 },
            ]);
            expect(status).toBe(400);
        });

        await test.step("zero-star entries are rejected", async () => {
            const status = await castBallotWithCsrf(page, roundId, [
                { submissionId: fixtureId, stars: 0 },
                { submissionId: labId, stars: 5 },
            ]);
            expect(status).toBe(400);
        });

        await test.step("a ballot totalling exactly ten is accepted and can be recast", async () => {
            const scores = [
                { submissionId: fixtureId, stars: 5 },
                { submissionId: labId, stars: 5 },
            ];
            expect(await castBallotWithCsrf(page, roundId, scores, "Balanced demo scores.")).toBe(
                201,
            );
            expect(await castBallotWithCsrf(page, roundId, scores, "Updated after the demo.")).toBe(
                201,
            );

            const current = await page.request.get(
                `${API_ORIGIN}/api/v1/voting-rounds/${roundId}/ballot`,
                { headers: { "x-nethack-organization-id": FIXTURE.organizationId } },
            );
            expect(current.status()).toBe(200);
            const ballot = (await current.json()) as {
                scores: readonly BallotScore[];
                reasoning: string;
            };
            expect(ballot.scores).toHaveLength(2);
            expect(ballot.scores.reduce((sum, score) => sum + score.stars, 0)).toBe(10);
            expect(ballot.reasoning).toBe("Updated after the demo.");
        });

        await test.step("reasoning above the bound is rejected", async () => {
            const status = await castBallotWithCsrf(
                page,
                roundId,
                [
                    { submissionId: fixtureId, stars: 5 },
                    { submissionId: labId, stars: 5 },
                ],
                "x".repeat(2001),
            );
            expect(status).toBe(400);
        });
    });

    test("publishes ranked star results with a People's Choice leader", async ({
        page,
        browser,
    }) => {
        test.setTimeout(300_000);
        await signIn(page, USERS.organizer);
        const roundId = await createAndOpenRound(page, "E2E Star Results");
        const ids = await submissionIdsByTitle();
        const fixtureId = ids.get(FIXTURE.projectTitle) ?? "";
        const labId = ids.get(FIXTURE.labProjectTitle) ?? "";
        expect(fixtureId).not.toBe("");
        expect(labId).not.toBe("");

        const scores = [
            { submissionId: fixtureId, stars: 5 },
            { submissionId: labId, stars: 5 },
        ];
        expect(await castBallotWithCsrf(page, roundId, scores)).toBe(201);

        const participantContext = await newAppContext(browser);
        try {
            const participantPage = await participantContext.newPage();
            await signIn(participantPage, USERS.participant);

            await test.step("the participant casts a second star ballot", async () => {
                expect(await castBallotWithCsrf(participantPage, roundId, scores)).toBe(201);
            });

            await test.step("results stay hidden before publication", async () => {
                const hidden = await participantPage.request.get(
                    `${API_ORIGIN}/api/v1/voting-rounds/${roundId}/results`,
                    { headers: { "x-nethack-organization-id": FIXTURE.organizationId } },
                );
                expect(hidden.status()).toBe(403);
            });

            await test.step("the organizer closes and publishes the round", async () => {
                expect(await roundTransition(page, roundId, "close")).toBe(200);
                expect(await roundTransition(page, roundId, "publish")).toBe(200);
            });

            await test.step("results aggregate stars, averages, and ranks", async () => {
                const response = await participantPage.request.get(
                    `${API_ORIGIN}/api/v1/voting-rounds/${roundId}/results`,
                    { headers: { "x-nethack-organization-id": FIXTURE.organizationId } },
                );
                expect(response.status()).toBe(200);
                const result = (await response.json()) as VoteResultBody;
                expect(result.totalBallots).toBe(2);
                expect(result.entries).toHaveLength(2);
                expect(result.entries.map((entry) => entry.rank)).toEqual([1, 2]);
                for (const entry of result.entries) {
                    expect(entry.votes).toBe(2);
                    expect(entry.totalStars).toBe(10);
                    expect(entry.averageStars).toBe(5);
                }
                const leader = result.entries[0];
                expect(leader?.projectTitle).toBe(FIXTURE.projectTitle);
                expect(result.entries[1]?.projectTitle).toBe(FIXTURE.labProjectTitle);
            });
        } finally {
            await participantContext.close();
        }
    });
});
