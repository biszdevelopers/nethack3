import { describe, expect, it } from "vitest";
import { aggregateJudgingResults, type JudgingResultRow } from "../domain/judging-results.js";

function row(
    overrides: Partial<JudgingResultRow> &
        Pick<
            JudgingResultRow,
            | "assignmentId"
            | "submissionId"
            | "projectId"
            | "projectTitle"
            | "judgeUserId"
            | "judgeDisplayName"
        >,
): JudgingResultRow {
    return {
        teamId: null,
        teamName: null,
        evaluationStatus: null,
        weightedScore: null,
        submittedAt: null,
        ...overrides,
    };
}

describe("judging results", () => {
    it("averages submitted evaluations, excludes drafts, and ranks ties equally", () => {
        const results = aggregateJudgingResults([
            row({
                assignmentId: "a1",
                submissionId: "s1",
                projectId: "p1",
                projectTitle: "Alpha",
                judgeUserId: "j1",
                judgeDisplayName: "Judge One",
                evaluationStatus: "submitted",
                weightedScore: 90,
                submittedAt: "2026-11-27T10:00:00.000Z",
            }),
            row({
                assignmentId: "a2",
                submissionId: "s1",
                projectId: "p1",
                projectTitle: "Alpha",
                judgeUserId: "j2",
                judgeDisplayName: "Judge Two",
                evaluationStatus: "submitted",
                weightedScore: 80,
                submittedAt: "2026-11-27T11:00:00.000Z",
            }),
            row({
                assignmentId: "a3",
                submissionId: "s2",
                projectId: "p2",
                projectTitle: "Beta",
                judgeUserId: "j1",
                judgeDisplayName: "Judge One",
                evaluationStatus: "submitted",
                weightedScore: 85,
                submittedAt: "2026-11-27T12:00:00.000Z",
            }),
            row({
                assignmentId: "a4",
                submissionId: "s2",
                projectId: "p2",
                projectTitle: "Beta",
                judgeUserId: "j2",
                judgeDisplayName: "Judge Two",
                evaluationStatus: "draft",
                weightedScore: 10,
            }),
            row({
                assignmentId: "a5",
                submissionId: "s3",
                projectId: "p3",
                projectTitle: "Gamma",
                judgeUserId: "j1",
                judgeDisplayName: "Judge One",
            }),
        ]);

        expect(
            results.map((result) => [result.projectTitle, result.averageScore, result.rank]),
        ).toEqual([
            ["Alpha", 85, 1],
            ["Beta", 85, 1],
            ["Gamma", null, null],
        ]);
        expect(results[1]?.submittedCount).toBe(1);
        expect(results[1]?.assignmentCount).toBe(2);
        expect(results[2]?.submittedCount).toBe(0);
    });
});
