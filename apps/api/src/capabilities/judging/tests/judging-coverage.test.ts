import { describe, expect, it } from "vitest";
import {
    CALIBRATION_OUTLIER_MIN_EVALUATIONS,
    CALIBRATION_THRESHOLD,
    summarizeJudgeCoverage,
    type CoverageAssignmentRow,
} from "../domain/judging-coverage.js";

function row(
    overrides: Partial<CoverageAssignmentRow> &
        Pick<CoverageAssignmentRow, "judgeUserId" | "judgeDisplayName">,
): CoverageAssignmentRow {
    return {
        assignmentStatus: "assigned",
        evaluationStatus: null,
        weightedScore: null,
        ...overrides,
    };
}

describe("summarizeJudgeCoverage", () => {
    const rows: readonly CoverageAssignmentRow[] = [
        row({
            judgeUserId: "j1",
            judgeDisplayName: "Ada",
            assignmentStatus: "submitted",
            evaluationStatus: "submitted",
            weightedScore: 95,
        }),
        row({
            judgeUserId: "j1",
            judgeDisplayName: "Ada",
            assignmentStatus: "submitted",
            evaluationStatus: "submitted",
            weightedScore: 85,
        }),
        row({
            judgeUserId: "j1",
            judgeDisplayName: "Ada",
            assignmentStatus: "conflict_declared",
        }),
        row({
            judgeUserId: "j2",
            judgeDisplayName: "Grace",
            assignmentStatus: "submitted",
            evaluationStatus: "submitted",
            weightedScore: 50,
        }),
        row({
            judgeUserId: "j2",
            judgeDisplayName: "Grace",
            assignmentStatus: "in_progress",
            evaluationStatus: "draft",
            weightedScore: 100,
        }),
        row({
            judgeUserId: "j3",
            judgeDisplayName: "Linus",
            assignmentStatus: "in_progress",
            evaluationStatus: "draft",
            weightedScore: null,
        }),
        row({
            judgeUserId: "j4",
            judgeDisplayName: "Revoked",
            assignmentStatus: "revoked",
            evaluationStatus: "submitted",
            weightedScore: 1000,
        }),
    ];

    const summary = summarizeJudgeCoverage(rows, [
        { reportedByUserId: "j1", status: "open" },
        { reportedByUserId: "j2", status: "resolved" },
    ]);

    it("counts non-revoked assignments and submitted evaluations", () => {
        expect(summary.assignmentCount).toBe(6);
        expect(summary.submittedCount).toBe(3);
        expect(summary.judges).toHaveLength(3);
        expect(summary.judges.map((judge) => judge.judgeDisplayName)).toEqual([
            "Ada",
            "Grace",
            "Linus",
        ]);
    });

    it("computes per-judge averages and the edition average from submitted scores only", () => {
        expect(summary.editionAverageScore).toBe(76.67);
        expect(summary.judges[0]?.averageWeightedScore).toBe(90);
        expect(summary.judges[1]?.averageWeightedScore).toBe(50);
        expect(summary.judges[2]?.averageWeightedScore).toBeNull();
    });

    it("reports the edition standard deviation", () => {
        expect(summary.standardDeviation).toBe(19.29);
    });

    it("does not flag judges below the minimum evaluation count", () => {
        expect(summary.outliers).toEqual([]);
    });

    it("counts recusals and open flags per judge", () => {
        expect(summary.judges[0]?.conflictCount).toBe(1);
        expect(summary.judges[0]?.openFlagCount).toBe(1);
        expect(summary.judges[1]?.openFlagCount).toBe(0);
        expect(summary.judges[2]?.openFlagCount).toBe(0);
    });

    it("classifies calibration against the edition average", () => {
        expect(summary.judges[0]?.calibrationDelta).toBe(13.33);
        expect(summary.judges[0]?.calibration).toBe("above");
        expect(summary.judges[1]?.calibration).toBe("below");
        expect(summary.judges[2]?.calibration).toBe("insufficient_data");
        expect(summary.judges[2]?.calibrationDelta).toBeNull();
    });

    it("treats a delta inside the threshold as in line", () => {
        const inside = summarizeJudgeCoverage(
            [
                row({
                    judgeUserId: "a",
                    judgeDisplayName: "A",
                    assignmentStatus: "submitted",
                    evaluationStatus: "submitted",
                    weightedScore: 80,
                }),
                row({
                    judgeUserId: "b",
                    judgeDisplayName: "B",
                    assignmentStatus: "submitted",
                    evaluationStatus: "submitted",
                    weightedScore: 75,
                }),
            ],
            [],
        );
        expect(inside.editionAverageScore).toBe(77.5);
        expect(inside.judges[0]?.calibrationDelta).toBe(2.5);
        expect(inside.judges[0]?.calibration).toBe("in_line");
        expect(CALIBRATION_THRESHOLD).toBe(10);
    });

    it("flags a judge with at least three evaluations more than two deviations out", () => {
        const outlierRows: CoverageAssignmentRow[] = [
            ...Array.from({ length: 3 }, () =>
                row({
                    judgeUserId: "high",
                    judgeDisplayName: "High Judge",
                    assignmentStatus: "submitted",
                    evaluationStatus: "submitted",
                    weightedScore: 100,
                }),
            ),
            ...Array.from({ length: 21 }, () =>
                row({
                    judgeUserId: "filler",
                    judgeDisplayName: "Filler Judge",
                    assignmentStatus: "submitted",
                    evaluationStatus: "submitted",
                    weightedScore: 50,
                }),
            ),
        ];

        const outlierSummary = summarizeJudgeCoverage(outlierRows, []);

        expect(outlierSummary.editionAverageScore).toBe(56.25);
        expect(outlierSummary.standardDeviation).toBe(16.54);
        expect(outlierSummary.outliers).toEqual([
            {
                judgeUserId: "high",
                judgeDisplayName: "High Judge",
                evaluationCount: 3,
                averageWeightedScore: 100,
                calibrationDelta: 43.75,
            },
        ]);
    });

    it("requires three submitted evaluations before flagging an outlier", () => {
        const gatedRows: CoverageAssignmentRow[] = [
            ...Array.from({ length: 3 }, () =>
                row({
                    judgeUserId: "three",
                    judgeDisplayName: "Three Evaluations",
                    assignmentStatus: "submitted",
                    evaluationStatus: "submitted",
                    weightedScore: 100,
                }),
            ),
            ...Array.from({ length: 2 }, () =>
                row({
                    judgeUserId: "two",
                    judgeDisplayName: "Two Evaluations",
                    assignmentStatus: "submitted",
                    evaluationStatus: "submitted",
                    weightedScore: 100,
                }),
            ),
            ...Array.from({ length: 21 }, () =>
                row({
                    judgeUserId: "filler",
                    judgeDisplayName: "Filler Judge",
                    assignmentStatus: "submitted",
                    evaluationStatus: "submitted",
                    weightedScore: 50,
                }),
            ),
        ];

        const gatedSummary = summarizeJudgeCoverage(gatedRows, []);

        expect(gatedSummary.outliers.map((outlier) => outlier.judgeUserId)).toEqual(["three"]);
        expect(CALIBRATION_OUTLIER_MIN_EVALUATIONS).toBe(3);
    });

    it("never flags outliers when the edition scores have no spread", () => {
        const flatRows: CoverageAssignmentRow[] = [
            ...Array.from({ length: 3 }, () =>
                row({
                    judgeUserId: "a",
                    judgeDisplayName: "A",
                    assignmentStatus: "submitted",
                    evaluationStatus: "submitted",
                    weightedScore: 80,
                }),
            ),
            ...Array.from({ length: 3 }, () =>
                row({
                    judgeUserId: "b",
                    judgeDisplayName: "B",
                    assignmentStatus: "submitted",
                    evaluationStatus: "submitted",
                    weightedScore: 80,
                }),
            ),
        ];

        const flatSummary = summarizeJudgeCoverage(flatRows, []);

        expect(flatSummary.standardDeviation).toBe(0);
        expect(flatSummary.outliers).toEqual([]);
    });

    it("never flags outliers when the standard deviation is near zero", () => {
        const nearFlatRows: CoverageAssignmentRow[] = [
            ...Array.from({ length: 3 }, () =>
                row({
                    judgeUserId: "high",
                    judgeDisplayName: "High Judge",
                    assignmentStatus: "submitted",
                    evaluationStatus: "submitted",
                    weightedScore: 80.02,
                }),
            ),
            ...Array.from({ length: 3 }, () =>
                row({
                    judgeUserId: "low",
                    judgeDisplayName: "Low Judge",
                    assignmentStatus: "submitted",
                    evaluationStatus: "submitted",
                    weightedScore: 80,
                }),
            ),
        ];

        const nearFlatSummary = summarizeJudgeCoverage(nearFlatRows, []);

        expect(nearFlatSummary.standardDeviation).toBe(0.01);
        expect(nearFlatSummary.outliers).toEqual([]);
    });
});
