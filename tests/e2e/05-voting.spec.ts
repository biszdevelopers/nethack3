import { expect, test, type Page } from "@playwright/test";
import { API_ORIGIN, FIXTURE, USERS, WORKSPACE_ORIGIN } from "../support/e2e/config.js";
import { chooseOption, expectToast, newAppContext, signIn } from "../support/e2e/app.js";
import { ownerTenantQuery } from "../support/e2e/db.js";

async function createAndOpenRound(
    page: Page,
    name: string,
    includeOrganizers: boolean,
): Promise<void> {
    await page.goto("/voting");
    await chooseOption(page.getByLabel("Competition edition"), FIXTURE.editionName);
    const form = page.getByRole("button", { name: "Create round" }).locator("xpath=ancestor::form");
    await form.getByLabel("Name").fill(name);
    await form.getByLabel("Description").fill("Round created by the Playwright voting journey.");
    await form.getByRole("spinbutton", { name: "Per-voter cap" }).fill("2");
    if (includeOrganizers) {
        await form.getByRole("checkbox", { name: "Organizers" }).check();
    }
    await form.getByRole("button", { name: "Create round" }).click();
    await expectToast(page, "Voting round created");

    const row = page.getByRole("row", { name: new RegExp(name) });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Open" }).click();
    await expectToast(page, "Round opened");
    await expect(row.getByText("Open", { exact: true })).toBeVisible();
}

async function addStars(page: Page, projectTitle: string, times: number): Promise<void> {
    const button = page.getByRole("button", {
        name: `Add a star to ${projectTitle}`,
        exact: true,
    });
    for (let index = 0; index < times; index += 1) {
        await button.click();
    }
}

test.describe("voting", () => {
    test("hides unpublished results, records a star ballot, replaces a recast, and publishes results", async ({
        page,
        browser,
    }) => {
        test.setTimeout(300_000);
        const roundName = "E2E Community Vote";
        await signIn(page, USERS.organizer);
        await createAndOpenRound(page, roundName, true);

        const roundRows = await ownerTenantQuery<{ id: string }>(
            FIXTURE.organizationId,
            "select id from voting_rounds where name = $1",
            [roundName],
        );
        const roundId = roundRows[0]?.id ?? "";
        expect(roundId).not.toBe("");
        const submissionRows = await ownerTenantQuery<{ id: string; title: string }>(
            FIXTURE.organizationId,
            `select s.id, v.title
               from submissions s
               join submission_versions v
                 on v.submission_id = s.id and v.version = s.current_version
              where s.organization_id = $1 and s.edition_id = $2`,
            [FIXTURE.organizationId, FIXTURE.editionId],
        );
        const fixtureSubmissionId =
            submissionRows.find((row) => row.title === FIXTURE.projectTitle)?.id ?? "";
        const labSubmissionId =
            submissionRows.find((row) => row.title === FIXTURE.labProjectTitle)?.id ?? "";
        expect(fixtureSubmissionId).not.toBe("");
        expect(labSubmissionId).not.toBe("");

        await test.step("organizer casts a star ballot", async () => {
            await addStars(page, FIXTURE.projectTitle, 5);
            await addStars(page, FIXTURE.labProjectTitle, 5);
            await expect(page.getByText(/10 of 10 stars assigned/)).toBeVisible();
            await page
                .getByLabel("Reasoning")
                .fill("Both projects shipped; the fixture project had the clearer demo.");
            await page.getByRole("button", { name: "Cast ballot" }).click();
            await expectToast(page, "Ballot submitted");
            await expect(page.getByText(/You submitted a ballot/)).toBeVisible();
        });

        await test.step("a recast replaces the previous ballot", async () => {
            const csrfResponse = await page.request.get(`${API_ORIGIN}/api/v1/auth/csrf`);
            expect(csrfResponse.status()).toBe(200);
            const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };
            const recast = await page.request.post(
                `${API_ORIGIN}/api/v1/voting-rounds/${roundId}/ballot`,
                {
                    headers: {
                        "content-type": "application/json",
                        "x-csrf-token": csrfToken,
                        "x-nethack-organization-id": FIXTURE.organizationId,
                        origin: WORKSPACE_ORIGIN,
                    },
                    data: {
                        scores: [
                            { submissionId: fixtureSubmissionId, stars: 5 },
                            { submissionId: labSubmissionId, stars: 5 },
                        ],
                        reasoning: "Recast after reviewing the lab notes.",
                    },
                },
            );
            expect(recast.status()).toBe(201);
            const body = (await recast.json()) as {
                scores: readonly { submissionId: string; stars: number }[];
            };
            expect(body.scores).toHaveLength(2);
        });

        const participantContext = await newAppContext(browser);
        try {
            const participantPage = await participantContext.newPage();
            await signIn(participantPage, USERS.participant);
            await participantPage.goto(`/voting?edition=${FIXTURE.editionId}`);

            await test.step("results stay hidden before publication", async () => {
                await expect(
                    participantPage.getByRole("heading", { name: "Results", level: 2 }),
                ).toBeVisible();
                await expect(
                    participantPage.getByText("No voting results", { exact: true }),
                ).toBeVisible();
            });

            await test.step("organizer closes and publishes the round", async () => {
                const row = page.getByRole("row", { name: new RegExp(roundName) });
                await row.getByRole("button", { name: "Close" }).click();
                await expectToast(page, "Round closed");
                await row.getByRole("button", { name: "Publish" }).click();
                const dialog = page.getByRole("alertdialog", { name: "Publish results" });
                await expect(dialog).toBeVisible();
                await dialog.getByRole("button", { name: "Publish results" }).click();
                await expectToast(page, "Results published");
            });

            await test.step("organizer sees ballot reasoning in the results audit", async () => {
                await expect(
                    page.getByRole("heading", { name: "Organizer ballot audit" }),
                ).toBeVisible();
                await expect(page.getByText("Recast after reviewing the lab notes.")).toBeVisible();
            });

            await test.step("participant reads the published star results", async () => {
                await participantPage.reload();
                await expect(
                    participantPage.getByRole("heading", { name: roundName }),
                ).toBeVisible();
                await expect(participantPage.getByText(FIXTURE.projectTitle)).toBeVisible();
                await expect(participantPage.getByText(FIXTURE.labProjectTitle)).toBeVisible();
                await expect(participantPage.getByText("1 ballots")).toBeVisible();
                await expect(
                    participantPage.getByText("People's choice", { exact: true }),
                ).toBeVisible();
                await expect(
                    participantPage.getByRole("columnheader", { name: "Average stars" }),
                ).toBeVisible();
                await expect(
                    participantPage.getByRole("heading", { name: "Organizer ballot audit" }),
                ).toHaveCount(0);
            });
        } finally {
            await participantContext.close();
        }
    });

    test("shows an eligible participant only same-division projects from other teams", async ({
        page,
        browser,
    }) => {
        test.setTimeout(240_000);
        const roundName = "E2E Participant Ballot";
        await signIn(page, USERS.organizer);
        await createAndOpenRound(page, roundName, false);

        const participantContext = await newAppContext(browser);
        try {
            const participantPage = await participantContext.newPage();
            await signIn(participantPage, USERS.participant);
            await participantPage.goto(`/voting?edition=${FIXTURE.editionId}`);
            await expect(participantPage.getByRole("heading", { name: roundName })).toBeVisible();
            const labCard = participantPage
                .getByRole("listitem")
                .filter({ hasText: FIXTURE.labProjectTitle });
            await expect(labCard).toBeVisible();
            await expect(labCard.getByText("Open", { exact: true })).toBeVisible();
            await expect(
                participantPage.getByRole("button", {
                    name: `Add a star to ${FIXTURE.labProjectTitle}`,
                    exact: true,
                }),
            ).toBeVisible();
            await expect(
                participantPage.getByRole("button", {
                    name: `Add a star to ${FIXTURE.projectTitle}`,
                    exact: true,
                }),
            ).toHaveCount(0);
            await expect(
                participantPage.getByRole("button", { name: "Cast ballot" }).first(),
            ).toBeVisible();
        } finally {
            await participantContext.close();
        }
    });
});
