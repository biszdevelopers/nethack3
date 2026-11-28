import { describe, expect, it } from "vitest";
import { ValidationError } from "../../../core/errors.js";
import { aggregateJudgingResults } from "../domain/judging-results.js";
import { JudgingRules } from "../domain/judging-rules.js";
import {
    assertRubricCriteria,
    assertTemplateTrack,
    buildRubricSnapshot,
    nextRubricVersion,
    resolveRubricWeights,
} from "../domain/rubric-definition.js";
import {
    applyScoreCurve,
    assertValidScoreCurve,
    DEFAULT_SCORE_CURVE_POINTS,
} from "../domain/score-curve.js";

describe("rubric weights", () => {
    it("accepts percentage weights that total 100", () => {
        expect(resolveRubricWeights([30, 25, 20, 15, 10])).toEqual([30, 25, 20, 15, 10]);
    });

    it("scales the legacy normalized scale to percentages", () => {
        expect(resolveRubricWeights([1, 2])).toEqual([33.33, 66.67]);
        expect(resolveRubricWeights([1])).toEqual([100]);
    });

    it("rejects totals that are neither percentages nor legacy", () => {
        expect(() => resolveRubricWeights([20, 30])).toThrow(ValidationError);
    });

    it("rejects non-positive weights", () => {
        expect(() => resolveRubricWeights([0, 100])).toThrow(ValidationError);
        expect(() => resolveRubricWeights([-1, 101])).toThrow(ValidationError);
    });
});

describe("criterion bounds", () => {
    it("accepts a valid integer range", () => {
        expect(() =>
            assertRubricCriteria([
                { name: "Impact", description: "", minScore: 1, maxScore: 5, weight: 100 },
            ]),
        ).not.toThrow();
    });

    it("requires template track weights to total 100", () => {
        expect(() =>
            assertTemplateTrack({
                key: "open",
                name: "Open",
                criteria: [
                    {
                        name: "Impact",
                        description: "",
                        minScore: 0,
                        maxScore: 5,
                        weight: 50,
                        position: 0,
                    },
                    {
                        name: "Craft",
                        description: "",
                        minScore: 0,
                        maxScore: 5,
                        weight: 50,
                        position: 1,
                    },
                ],
            }),
        ).not.toThrow();
        expect(() =>
            assertTemplateTrack({
                key: "open",
                name: "Open",
                criteria: [
                    {
                        name: "Impact",
                        description: "",
                        minScore: 0,
                        maxScore: 5,
                        weight: 1,
                        position: 0,
                    },
                ],
            }),
        ).toThrow(ValidationError);
    });

    it("rejects inverted, fractional, or out-of-bounds ranges", () => {
        expect(() =>
            assertRubricCriteria([
                { name: "Impact", description: "", minScore: 5, maxScore: 5, weight: 100 },
            ]),
        ).toThrow(ValidationError);
        expect(() =>
            assertRubricCriteria([
                { name: "Impact", description: "", minScore: 0, maxScore: 5.5, weight: 100 },
            ]),
        ).toThrow(ValidationError);
        expect(() =>
            assertRubricCriteria([
                { name: "Impact", description: "", minScore: 0, maxScore: 101, weight: 100 },
            ]),
        ).toThrow(ValidationError);
    });
});

describe("weighted scores with a minimum", () => {
    it("treats the minimum as zero percent", () => {
        expect(
            JudgingRules.weightedScore(
                [{ id: "criterion", minScore: 2, maxScore: 10, weight: 100 }],
                [{ criterionId: "criterion", score: 2 }],
            ),
        ).toBe(0);
    });

    it("treats the maximum as full marks", () => {
        expect(
            JudgingRules.weightedScore(
                [{ id: "criterion", minScore: 2, maxScore: 10, weight: 100 }],
                [{ criterionId: "criterion", score: 10 }],
            ),
        ).toBe(100);
    });

    it("rejects scores below the minimum", () => {
        expect(() =>
            JudgingRules.weightedScore(
                [{ id: "criterion", minScore: 2, maxScore: 10, weight: 100 }],
                [{ criterionId: "criterion", score: 1 }],
            ),
        ).toThrow(ValidationError);
    });
});

describe("rubric versions", () => {
    it("starts at one and increments", () => {
        expect(nextRubricVersion(null)).toBe(1);
        expect(nextRubricVersion(4)).toBe(5);
    });

    it("snapshots the rubric with its criteria", () => {
        const snapshot = buildRubricSnapshot({
            id: "11111111-1111-4111-8111-111111111111",
            name: "Rubric",
            version: 3,
            divisionId: "22222222-2222-4222-8222-222222222222",
            commentGuidance: {
                introduction: "Be specific.",
                guidelines: ["One guideline."],
                templates: [{ label: "Strength", body: "Strength: {{detail}}" }],
            },
            criteria: [
                {
                    id: "33333333-3333-4333-8333-333333333333",
                    name: "Impact",
                    description: "",
                    minScore: 1,
                    maxScore: 5,
                    weight: 100,
                    position: 0,
                },
            ],
        });
        expect(snapshot.version).toBe(3);
        expect(snapshot.criteria[0]?.minScore).toBe(1);
        expect(snapshot.commentGuidance.guidelines).toEqual(["One guideline."]);
    });
});

describe("score curve", () => {
    const curve = [
        { rawScore: 0, displayScore: 0 },
        { rawScore: 50, displayScore: 60 },
        { rawScore: 100, displayScore: 100 },
    ];

    it("leaves the default curve as an identity", () => {
        expect(applyScoreCurve(0)).toBe(0);
        expect(applyScoreCurve(57.5)).toBe(58);
        expect(applyScoreCurve(100)).toBe(100);
    });

    it("interpolates between points", () => {
        expect(applyScoreCurve(25, curve)).toBe(30);
        expect(applyScoreCurve(75, curve)).toBe(80);
    });

    it("clamps raw scores to the display range", () => {
        expect(applyScoreCurve(-10, curve)).toBe(0);
        expect(applyScoreCurve(140, curve)).toBe(100);
    });

    it("validates monotonic and bounded curves", () => {
        expect(() => assertValidScoreCurve(curve)).not.toThrow();
        expect(() =>
            assertValidScoreCurve([
                { rawScore: 0, displayScore: 0 },
                { rawScore: 50, displayScore: 70 },
                { rawScore: 50, displayScore: 80 },
                { rawScore: 100, displayScore: 100 },
            ]),
        ).toThrow(ValidationError);
        expect(() =>
            assertValidScoreCurve([
                { rawScore: 0, displayScore: 0 },
                { rawScore: 50, displayScore: 80 },
                { rawScore: 100, displayScore: 70 },
            ]),
        ).toThrow(ValidationError);
        expect(() =>
            assertValidScoreCurve([
                { rawScore: 10, displayScore: 0 },
                { rawScore: 100, displayScore: 100 },
            ]),
        ).toThrow(ValidationError);
        expect(() =>
            assertValidScoreCurve([
                { rawScore: 0, displayScore: 0 },
                { rawScore: 101, displayScore: 100 },
            ]),
        ).toThrow(ValidationError);
    });

    it("keeps ranking on the raw score and adds the display score", () => {
        const results = aggregateJudgingResults(
            [
                {
                    assignmentId: "a",
                    submissionId: "s",
                    projectId: "p",
                    projectTitle: "Project",
                    teamId: null,
                    teamName: null,
                    judgeUserId: "j",
                    judgeDisplayName: "Judge",
                    evaluationStatus: "submitted",
                    weightedScore: 50,
                    submittedAt: "2026-06-01T00:00:00.000Z",
                },
            ],
            curve,
        );
        expect(results[0]?.averageScore).toBe(50);
        expect(results[0]?.displayScore).toBe(60);
        expect(results[0]?.rank).toBe(1);
        expect(DEFAULT_SCORE_CURVE_POINTS).toHaveLength(2);
    });
});
