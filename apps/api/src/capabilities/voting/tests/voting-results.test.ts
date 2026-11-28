import { describe, expect, it } from "vitest";
import type { SubmissionStatus, TeamStatus } from "@nethack/contracts";
import {
    isCountableSubmission,
    rankVoteTallies,
    tallyVoteUnits,
    votingUnitId,
    type BallotRowInput,
    type VoterTeamMembership,
} from "../domain/voting-results.js";

const ALPHA = "3d0f2d0e-1111-4111-8111-111111111111";
const BETA = "3d0f2d0e-2222-4222-8222-222222222222";
const GAMMA = "3d0f2d0e-3333-4333-8333-333333333333";
const TEAM_ONE = "4d0f2d0e-1111-4111-8111-111111111111";
const TEAM_TWO = "4d0f2d0e-2222-4222-8222-222222222222";

const titles = new Map([
    [ALPHA, "Alpha"],
    [BETA, "Beta"],
    [GAMMA, "Gamma"],
]);

function ballot(userId: string, scores: Record<string, number>): BallotRowInput {
    return {
        userId,
        scores: Object.entries(scores).map(([submissionId, stars]) => ({ submissionId, stars })),
    };
}

function membership(teamId: string, status: TeamStatus): VoterTeamMembership {
    return { teamId, status };
}

describe("isCountableSubmission", () => {
    it("accepts votable submissions from active or absent teams", () => {
        expect(isCountableSubmission({ status: "submitted", teamStatus: "ready" })).toBe(true);
        expect(isCountableSubmission({ status: "accepted", teamStatus: "forming" })).toBe(true);
        expect(isCountableSubmission({ status: "under_review", teamStatus: null })).toBe(true);
    });

    it("rejects inactive submission statuses and inactive teams", () => {
        const statuses: readonly SubmissionStatus[] = ["draft", "withdrawn", "rejected"];
        for (const status of statuses) {
            expect(isCountableSubmission({ status, teamStatus: "ready" })).toBe(false);
        }
        for (const status of ["withdrawn", "disqualified", "no_show", "disbanded"] as const) {
            expect(isCountableSubmission({ status: "submitted", teamStatus: status })).toBe(false);
        }
    });
});

describe("votingUnitId", () => {
    it("uses the team id for a team voter and the user id for a teamless voter", () => {
        expect(votingUnitId("user-1", TEAM_ONE)).toBe(`team:${TEAM_ONE}`);
        expect(votingUnitId("user-1", null)).toBe("user:user-1");
    });
});

describe("tallyVoteUnits", () => {
    it("averages each voting unit equally so a large team cannot outweigh a small one", () => {
        const result = tallyVoteUnits(
            [
                ballot("u1", { [ALPHA]: 5 }),
                ballot("u2", { [ALPHA]: 5 }),
                ballot("u3", { [ALPHA]: 5 }),
                ballot("u4", { [ALPHA]: 1 }),
            ],
            new Map([
                ["u1", membership(TEAM_ONE, "ready")],
                ["u2", membership(TEAM_ONE, "ready")],
                ["u3", membership(TEAM_ONE, "ready")],
                ["u4", membership(TEAM_TWO, "ready")],
            ]),
            new Set([ALPHA]),
        );

        expect(result.totalBallots).toBe(4);
        expect(result.tallies).toEqual([
            {
                submissionId: ALPHA,
                votes: 4,
                totalStars: 16,
                averageStars: 3,
            },
        ]);
    });

    it("treats every teamless judge or organizer as its own unit", () => {
        const result = tallyVoteUnits(
            [ballot("u1", { [ALPHA]: 5 }), ballot("u2", { [ALPHA]: 1 })],
            new Map(),
            new Set([ALPHA]),
        );

        expect(result.tallies[0]?.averageStars).toBe(3);
        expect(result.tallies[0]?.votes).toBe(2);
        expect(result.tallies[0]?.totalStars).toBe(6);
    });

    it("drops a teamless participant from turnout and totals", () => {
        const result = tallyVoteUnits(
            [ballot("judge", { [ALPHA]: 5 }), ballot("participant", { [ALPHA]: 1 })],
            new Map(),
            new Set([ALPHA]),
            new Map(),
            new Set(["participant"]),
        );

        expect(result.totalBallots).toBe(1);
        expect(result.tallies).toEqual([
            {
                submissionId: ALPHA,
                votes: 1,
                totalStars: 5,
                averageStars: 5,
            },
        ]);
    });

    it("drops ballots from inactive voter teams out of turnout and totals", () => {
        const result = tallyVoteUnits(
            [
                ballot("u1", { [ALPHA]: 4 }),
                ballot("u2", { [ALPHA]: 5 }),
                ballot("u3", { [ALPHA]: 5 }),
            ],
            new Map([
                ["u1", membership(TEAM_ONE, "ready")],
                ["u2", membership(TEAM_TWO, "withdrawn")],
                ["u3", membership(TEAM_TWO, "disqualified")],
            ]),
            new Set([ALPHA]),
        );

        expect(result.totalBallots).toBe(1);
        expect(result.tallies).toEqual([
            {
                submissionId: ALPHA,
                votes: 1,
                totalStars: 4,
                averageStars: 4,
            },
        ]);
    });

    it("uses the stored voter team to exclude a ballot after the voter left", () => {
        const stored = { ...ballot("u1", { [ALPHA]: 4 }), voterTeamId: TEAM_ONE };
        const result = tallyVoteUnits(
            [stored, ballot("u2", { [ALPHA]: 2 })],
            new Map(),
            new Set([ALPHA]),
            new Map([[TEAM_ONE, membership(TEAM_ONE, "disbanded")]]),
        );

        expect(result.totalBallots).toBe(1);
        expect(result.tallies[0]).toMatchObject({ votes: 1, totalStars: 2, averageStars: 2 });
    });

    it("ignores votes for submissions that are no longer votable", () => {
        const result = tallyVoteUnits(
            [ballot("u1", { [ALPHA]: 4, [BETA]: 2 }), ballot("u2", { [ALPHA]: 2 })],
            new Map([
                ["u1", membership(TEAM_ONE, "ready")],
                ["u2", membership(TEAM_ONE, "ready")],
            ]),
            new Set([ALPHA]),
        );

        expect(result.totalBallots).toBe(2);
        expect(result.tallies.map((tally) => tally.submissionId)).toEqual([ALPHA]);
        expect(result.tallies[0]).toMatchObject({ votes: 2, totalStars: 6, averageStars: 3 });
    });

    it("keeps one unit's ballots together when its members scored the same submission", () => {
        const result = tallyVoteUnits(
            [
                ballot("u1", { [ALPHA]: 5 }),
                ballot("u2", { [ALPHA]: 1 }),
                ballot("u3", { [ALPHA]: 3 }),
            ],
            new Map([
                ["u1", membership(TEAM_ONE, "ready")],
                ["u2", membership(TEAM_ONE, "ready")],
                ["u3", membership(TEAM_TWO, "ready")],
            ]),
            new Set([ALPHA]),
        );

        expect(result.tallies[0]).toMatchObject({
            votes: 3,
            totalStars: 9,
            averageStars: 3,
        });
    });
});

describe("rankVoteTallies", () => {
    it("ranks by unit-weighted average, then total stars, then title", () => {
        const entries = rankVoteTallies(
            [
                { submissionId: BETA, votes: 2, totalStars: 10, averageStars: 5 },
                { submissionId: ALPHA, votes: 2, totalStars: 10, averageStars: 5 },
                { submissionId: GAMMA, votes: 1, totalStars: 5, averageStars: 4 },
            ],
            titles,
            200,
        );

        expect(entries.map((entry) => entry.projectTitle)).toEqual(["Alpha", "Beta", "Gamma"]);
        expect(entries.map((entry) => entry.rank)).toEqual([1, 2, 3]);
    });

    it("prefers the higher total stars at an equal average", () => {
        const entries = rankVoteTallies(
            [
                { submissionId: ALPHA, votes: 1, totalStars: 4, averageStars: 4 },
                { submissionId: BETA, votes: 2, totalStars: 8, averageStars: 4 },
            ],
            titles,
            200,
        );

        expect(entries.map((entry) => entry.projectTitle)).toEqual(["Beta", "Alpha"]);
    });

    it("limits entries after ranking", () => {
        const entries = rankVoteTallies(
            [
                { submissionId: ALPHA, votes: 1, totalStars: 1, averageStars: 1 },
                { submissionId: BETA, votes: 1, totalStars: 5, averageStars: 5 },
                { submissionId: GAMMA, votes: 1, totalStars: 3, averageStars: 3 },
            ],
            titles,
            2,
        );

        expect(entries).toHaveLength(2);
        expect(entries.map((entry) => entry.projectTitle)).toEqual(["Beta", "Gamma"]);
    });
});
