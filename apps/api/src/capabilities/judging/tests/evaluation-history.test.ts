import { describe, expect, it } from "vitest";
import {
    nextEvaluationRevision,
    toEvaluationVersion,
    type EvaluationVersionRecord,
} from "../domain/evaluation-history.js";

describe("nextEvaluationRevision", () => {
    it("starts at revision 1", () => {
        expect(nextEvaluationRevision(null)).toBe(1);
    });

    it("increments the previous revision", () => {
        expect(nextEvaluationRevision(1)).toBe(2);
        expect(nextEvaluationRevision(7)).toBe(8);
    });

    it("treats a zero revision as the start", () => {
        expect(nextEvaluationRevision(0)).toBe(1);
    });
});

describe("toEvaluationVersion", () => {
    const record: EvaluationVersionRecord = {
        revision: 3,
        status: "submitted",
        overallComment: "Clear and reproducible.",
        weightedScore: "83.50",
        scores: [
            {
                criterionId: "11111111-1111-4111-8111-111111111111",
                score: 8,
                comment: "Good.",
            },
            {
                criterionId: "22222222-2222-4222-8222-222222222222",
                score: 9,
                comment: "",
            },
        ],
        submittedAt: new Date("2026-06-02T09:30:00.000Z"),
        createdAt: new Date("2026-06-02T09:31:00.000Z"),
    };

    it("maps a stored snapshot to the API shape", () => {
        expect(toEvaluationVersion(record)).toEqual({
            revision: 3,
            status: "submitted",
            overallComment: "Clear and reproducible.",
            weightedScore: 83.5,
            scores: [
                {
                    criterionId: "11111111-1111-4111-8111-111111111111",
                    score: 8,
                    comment: "Good.",
                },
                {
                    criterionId: "22222222-2222-4222-8222-222222222222",
                    score: 9,
                    comment: "",
                },
            ],
            submittedAt: "2026-06-02T09:30:00.000Z",
            createdAt: "2026-06-02T09:31:00.000Z",
        });
    });

    it("keeps nullable draft fields", () => {
        const mapped = toEvaluationVersion({
            ...record,
            status: "draft",
            weightedScore: null,
            submittedAt: null,
        });
        expect(mapped.weightedScore).toBeNull();
        expect(mapped.submittedAt).toBeNull();
    });
});
