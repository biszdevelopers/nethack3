import { describe, expect, it } from "vitest";
import {
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
});
