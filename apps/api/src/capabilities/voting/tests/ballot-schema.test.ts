import { describe, expect, it } from "vitest";
import { ballotSchema, castBallotRequestSchema } from "@nethack/contracts";

const ONE = "3d0f2d0e-1111-4111-8111-111111111111";
const TWO = "3d0f2d0e-2222-4222-8222-222222222222";
const THREE = "3d0f2d0e-3333-4333-8333-333333333333";

function parse(scores: readonly { submissionId: string; stars: number }[]): boolean {
    return castBallotRequestSchema.safeParse({ scores }).success;
}

describe("castBallotRequestSchema", () => {
    it("accepts scores that total exactly ten", () => {
        expect(
            parse([
                { submissionId: ONE, stars: 5 },
                { submissionId: TWO, stars: 5 },
            ]),
        ).toBe(true);
        expect(
            parse([
                { submissionId: ONE, stars: 4 },
                { submissionId: TWO, stars: 3 },
                { submissionId: THREE, stars: 3 },
            ]),
        ).toBe(true);
    });

    it("rejects under- and over-allocation", () => {
        expect(
            parse([
                { submissionId: ONE, stars: 5 },
                { submissionId: TWO, stars: 4 },
            ]),
        ).toBe(false);
        expect(
            parse([
                { submissionId: ONE, stars: 4 },
                { submissionId: TWO, stars: 4 },
                { submissionId: THREE, stars: 3 },
            ]),
        ).toBe(false);
    });

    it("rejects duplicate submission ids", () => {
        expect(
            parse([
                { submissionId: ONE, stars: 5 },
                { submissionId: ONE, stars: 5 },
            ]),
        ).toBe(false);
    });

    it("rejects zero, above five, and non-integer stars", () => {
        for (const stars of [0, 6, 2.5]) {
            expect(parse([{ submissionId: ONE, stars }])).toBe(false);
        }
    });

    it("rejects an empty score list", () => {
        expect(parse([])).toBe(false);
    });
});

describe("ballotSchema", () => {
    it("accepts a ballot response with scores", () => {
        const parsed = ballotSchema.safeParse({
            roundId: ONE,
            userId: TWO,
            scores: [{ submissionId: THREE, stars: 5 }],
            submittedAt: "2026-06-15T12:00:00.000Z",
        });
        expect(parsed.success).toBe(true);
    });
});
