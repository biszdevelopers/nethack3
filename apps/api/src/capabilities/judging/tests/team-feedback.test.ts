import { describe, expect, it } from "vitest";
import { anonymousTeamFeedback, TEAM_FEEDBACK_MIN_REVIEWERS } from "../domain/team-feedback.js";

function row(index: number) {
    return {
        comment: `Specific feedback number ${String(index)}.`,
        weightedScore: 70 + index,
        submittedAt: `2026-11-2${String(index)}T10:00:00.000Z`,
    };
}

describe("anonymous team feedback", () => {
    it("withholds written feedback until three evaluations are submitted", () => {
        expect(TEAM_FEEDBACK_MIN_REVIEWERS).toBe(3);
        expect(anonymousTeamFeedback([])).toEqual([]);
        expect(anonymousTeamFeedback([row(0)])).toEqual([]);
        expect(anonymousTeamFeedback([row(0), row(1)])).toEqual([]);
    });

    it("releases only comment, weighted score, and submitted time", () => {
        const rows = [
            { ...row(0), judgeUserId: "judge-one", judgeDisplayName: "Judge One" },
            { ...row(1), judgeUserId: "judge-two", judgeDisplayName: "Judge Two" },
            { ...row(2), judgeUserId: "judge-three", judgeDisplayName: "Judge Three" },
        ];
        const feedback = anonymousTeamFeedback(rows);
        expect(feedback).toEqual([
            {
                comment: rows[0]?.comment,
                weightedScore: rows[0]?.weightedScore,
                submittedAt: rows[0]?.submittedAt,
            },
            {
                comment: rows[1]?.comment,
                weightedScore: rows[1]?.weightedScore,
                submittedAt: rows[1]?.submittedAt,
            },
            {
                comment: rows[2]?.comment,
                weightedScore: rows[2]?.weightedScore,
                submittedAt: rows[2]?.submittedAt,
            },
        ]);
        for (const entry of feedback) {
            expect(Object.keys(entry).toSorted()).toEqual([
                "comment",
                "submittedAt",
                "weightedScore",
            ]);
        }
    });
});
