import { describe, expect, it } from "vitest";
import { rankVoteTallies } from "../domain/voting-results.js";

const ALPHA = "3d0f2d0e-1111-4111-8111-111111111111";
const BETA = "3d0f2d0e-2222-4222-8222-222222222222";
const GAMMA = "3d0f2d0e-3333-4333-8333-333333333333";

const titles = new Map([
    [ALPHA, "Alpha"],
    [BETA, "Beta"],
    [GAMMA, "Gamma"],
]);

describe("rankVoteTallies", () => {
    it("ranks by average stars, then total stars, then title", () => {
        const entries = rankVoteTallies(
            [
                { submissionId: BETA, votes: 2, totalStars: 10 },
                { submissionId: ALPHA, votes: 2, totalStars: 10 },
                { submissionId: GAMMA, votes: 1, totalStars: 5 },
            ],
            titles,
            200,
        );

        expect(entries.map((entry) => entry.projectTitle)).toEqual(["Alpha", "Beta", "Gamma"]);
        expect(entries.map((entry) => entry.rank)).toEqual([1, 2, 3]);
        expect(entries[0]?.averageStars).toBe(5);
        expect(entries[2]?.averageStars).toBe(5);
    });

    it("prefers the higher total stars at an equal average", () => {
        const entries = rankVoteTallies(
            [
                { submissionId: ALPHA, votes: 1, totalStars: 4 },
                { submissionId: BETA, votes: 2, totalStars: 8 },
            ],
            titles,
            200,
        );

        expect(entries.map((entry) => entry.projectTitle)).toEqual(["Beta", "Alpha"]);
        expect(entries[0]?.totalStars).toBe(8);
    });

    it("rounds averages to two decimals and keeps votes for every entry", () => {
        const entries = rankVoteTallies(
            [
                { submissionId: ALPHA, votes: 3, totalStars: 10 },
                { submissionId: BETA, votes: 3, totalStars: 7 },
            ],
            titles,
            200,
        );

        expect(entries[0]?.averageStars).toBe(3.33);
        expect(entries[1]?.averageStars).toBe(2.33);
        expect(entries.map((entry) => entry.votes)).toEqual([3, 3]);
    });

    it("limits entries after ranking", () => {
        const entries = rankVoteTallies(
            [
                { submissionId: ALPHA, votes: 1, totalStars: 1 },
                { submissionId: BETA, votes: 1, totalStars: 5 },
                { submissionId: GAMMA, votes: 1, totalStars: 3 },
            ],
            titles,
            2,
        );

        expect(entries).toHaveLength(2);
        expect(entries.map((entry) => entry.projectTitle)).toEqual(["Beta", "Gamma"]);
    });
});
