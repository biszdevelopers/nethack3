import { describe, expect, it } from "vitest";
import type { JudgeAssignmentStatus, OrganizationRole } from "@nethack/contracts";
import { ConflictError, ValidationError } from "../../../core/errors.js";
import { JudgingRules, type ScorableCriterion } from "../domain/judging-rules.js";

const criteria: readonly ScorableCriterion[] = [
    { id: "11111111-1111-4111-8111-111111111111", maxScore: 10, weight: 1 },
    { id: "22222222-2222-4222-8222-222222222222", maxScore: 20, weight: 2 },
];

const fullMarks = [
    { criterionId: criteria[0]?.id ?? "", score: 10 },
    { criterionId: criteria[1]?.id ?? "", score: 20 },
];

describe("JudgingRules.weightedScore", () => {
    it("returns 100 for full marks", () => {
        expect(JudgingRules.weightedScore(criteria, fullMarks)).toBe(100);
    });

    it("returns 0 for zero marks", () => {
        expect(
            JudgingRules.weightedScore(criteria, [
                { criterionId: criteria[0]?.id ?? "", score: 0 },
                { criterionId: criteria[1]?.id ?? "", score: 0 },
            ]),
        ).toBe(0);
    });

    it("weights criteria by their configured weight", () => {
        expect(
            JudgingRules.weightedScore(criteria, [
                { criterionId: criteria[0]?.id ?? "", score: 10 },
                { criterionId: criteria[1]?.id ?? "", score: 10 },
            ]),
        ).toBe(66.67);
    });

    it("respects different maximum scores", () => {
        expect(
            JudgingRules.weightedScore(
                [{ id: "criterion", maxScore: 5, weight: 10 }],
                [{ criterionId: "criterion", score: 2 }],
            ),
        ).toBe(40);
    });

    it("rounds to two decimal places", () => {
        expect(
            JudgingRules.weightedScore(
                [{ id: "criterion", maxScore: 3, weight: 1 }],
                [{ criterionId: "criterion", score: 1 }],
            ),
        ).toBe(33.33);
    });

    it("rejects an incomplete scorecard", () => {
        expect(() =>
            JudgingRules.weightedScore(criteria, [
                { criterionId: criteria[0]?.id ?? "", score: 5 },
            ]),
        ).toThrow(ValidationError);
    });

    it("rejects duplicate criterion scores", () => {
        expect(() =>
            JudgingRules.weightedScore(criteria, [
                ...fullMarks,
                { criterionId: criteria[0]?.id ?? "", score: 5 },
            ]),
        ).toThrow(ValidationError);
    });

    it("rejects scores outside the rubric", () => {
        expect(() =>
            JudgingRules.weightedScore(criteria, [
                ...fullMarks,
                { criterionId: "33333333-3333-4333-8333-333333333333", score: 1 },
            ]),
        ).toThrow(ValidationError);
    });

    it("rejects negative scores", () => {
        expect(() =>
            JudgingRules.weightedScore(criteria, [
                { criterionId: criteria[0]?.id ?? "", score: -1 },
                { criterionId: criteria[1]?.id ?? "", score: 20 },
            ]),
        ).toThrow(ValidationError);
    });

    it("rejects scores above the criterion maximum", () => {
        expect(() =>
            JudgingRules.weightedScore(criteria, [
                { criterionId: criteria[0]?.id ?? "", score: 11 },
                { criterionId: criteria[1]?.id ?? "", score: 20 },
            ]),
        ).toThrow(ValidationError);
    });

    it("rejects fractional scores", () => {
        expect(() =>
            JudgingRules.weightedScore(criteria, [
                { criterionId: criteria[0]?.id ?? "", score: 5.5 },
                { criterionId: criteria[1]?.id ?? "", score: 20 },
            ]),
        ).toThrow(ValidationError);
    });

    it("rejects an empty rubric", () => {
        expect(() => JudgingRules.weightedScore([], [])).toThrow(ValidationError);
    });

    it("rejects non-positive total weight", () => {
        expect(() =>
            JudgingRules.weightedScore(
                [
                    { id: "a", maxScore: 10, weight: 0 },
                    { id: "b", maxScore: 10, weight: 0 },
                ],
                [
                    { criterionId: "a", score: 5 },
                    { criterionId: "b", score: 5 },
                ],
            ),
        ).toThrow(ValidationError);
    });
});

describe("JudgingRules.assertBeforeDeadline", () => {
    const now = new Date("2026-06-01T12:00:00.000Z");

    it("allows an assignment without a deadline", () => {
        expect(() => JudgingRules.assertBeforeDeadline(null, now)).not.toThrow();
    });

    it("allows work before the deadline", () => {
        expect(() =>
            JudgingRules.assertBeforeDeadline(new Date("2026-06-01T12:00:01.000Z"), now),
        ).not.toThrow();
    });

    it("rejects work after the deadline", () => {
        expect(() =>
            JudgingRules.assertBeforeDeadline(new Date("2026-06-01T11:59:59.000Z"), now),
        ).toThrow(ConflictError);
    });
});

describe("JudgingRules assignment states", () => {
    const evaluable: readonly JudgeAssignmentStatus[] = ["assigned", "in_progress"];
    const blocked: readonly JudgeAssignmentStatus[] = ["submitted", "conflict_declared", "revoked"];

    it.each(evaluable)("allows evaluation from %s", (status) => {
        expect(() => JudgingRules.assertCanEvaluate(status)).not.toThrow();
    });

    it.each(blocked)("blocks evaluation from %s", (status) => {
        expect(() => JudgingRules.assertCanEvaluate(status)).toThrow(ConflictError);
    });

    it.each(evaluable)("allows a conflict declaration from %s", (status) => {
        expect(() => JudgingRules.assertCanDeclareConflict(status)).not.toThrow();
    });

    it.each(blocked)("blocks a conflict declaration from %s", (status) => {
        expect(() => JudgingRules.assertCanDeclareConflict(status)).toThrow(ConflictError);
    });
});

describe("JudgingRules eligibility", () => {
    const eligible: readonly OrganizationRole[] = ["owner", "organizer", "judge"];

    it.each(eligible)("accepts an active %s", (role) => {
        expect(() => JudgingRules.assertJudgeEligible(role, "active")).not.toThrow();
    });

    it("rejects a participant", () => {
        expect(() => JudgingRules.assertJudgeEligible("participant", "active")).toThrow(
            ValidationError,
        );
    });

    it("rejects a suspended judge", () => {
        expect(() => JudgingRules.assertJudgeEligible("judge", "suspended")).toThrow(
            ValidationError,
        );
    });

    it("identifies organizer roles", () => {
        expect(JudgingRules.isOrganizer("owner")).toBe(true);
        expect(JudgingRules.isOrganizer("organizer")).toBe(true);
        expect(JudgingRules.isOrganizer("judge")).toBe(false);
        expect(JudgingRules.isOrganizer("participant")).toBe(false);
    });
});
