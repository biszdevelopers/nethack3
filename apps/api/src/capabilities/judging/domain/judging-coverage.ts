import type {
    JudgeAssignmentStatus,
    JudgingCalibration,
    JudgingCalibrationOutlier,
    JudgingCoverageJudge,
} from "@nethack/contracts";

export const CALIBRATION_THRESHOLD = 10;
export const CALIBRATION_OUTLIER_MIN_EVALUATIONS = 3;
export const CALIBRATION_OUTLIER_DEVIATION_FACTOR = 2;
const STANDARD_DEVIATION_EPSILON = 0.01;

export interface CoverageAssignmentRow {
    readonly judgeUserId: string;
    readonly judgeDisplayName: string;
    readonly assignmentStatus: JudgeAssignmentStatus;
    readonly evaluationStatus: "draft" | "submitted" | null;
    readonly weightedScore: number | null;
}

export interface CoverageFlagRow {
    readonly reportedByUserId: string;
    readonly status: "open" | "resolved";
}

export interface CoverageSummary {
    readonly judges: readonly JudgingCoverageJudge[];
    readonly outliers: readonly JudgingCalibrationOutlier[];
    readonly assignmentCount: number;
    readonly submittedCount: number;
    readonly editionAverageScore: number | null;
    readonly standardDeviation: number;
}

interface JudgeAccumulator {
    judgeUserId: string;
    judgeDisplayName: string;
    assignmentCount: number;
    submittedCount: number;
    conflictCount: number;
    openFlagCount: number;
    submittedScores: number[];
}

function roundScore(value: number): number {
    return Math.round(value * 100) / 100;
}

function mean(values: readonly number[]): number | null {
    if (values.length === 0) {
        return null;
    }
    return values.reduce((total, value) => total + value, 0) / values.length;
}

function average(values: readonly number[]): number | null {
    const value = mean(values);
    return value === null ? null : roundScore(value);
}

function populationStandardDeviation(
    values: readonly number[],
    editionMean: number | null,
): number {
    if (values.length === 0 || editionMean === null) {
        return 0;
    }
    return Math.sqrt(
        values.reduce((total, value) => total + (value - editionMean) ** 2, 0) / values.length,
    );
}

function calibrationFor(
    judgeAverage: number | null,
    editionAverage: number | null,
): { readonly delta: number | null; readonly calibration: JudgingCalibration } {
    if (judgeAverage === null || editionAverage === null) {
        return { delta: null, calibration: "insufficient_data" };
    }
    const delta = roundScore(judgeAverage - editionAverage);
    if (delta >= CALIBRATION_THRESHOLD) {
        return { delta, calibration: "above" };
    }
    if (delta <= -CALIBRATION_THRESHOLD) {
        return { delta, calibration: "below" };
    }
    return { delta, calibration: "in_line" };
}

/**
 * Builds per-judge coverage from non-revoked assignments. Draft evaluations are
 * counted as in progress but never influence any average. A judge is flagged as
 * a calibration outlier only after CALIBRATION_OUTLIER_MIN_EVALUATIONS submitted
 * evaluations and only when the standard deviation is meaningful, so a
 * near-zero deviation cannot flag every judge against a flat edition.
 */
export function summarizeJudgeCoverage(
    rows: readonly CoverageAssignmentRow[],
    flags: readonly CoverageFlagRow[],
): CoverageSummary {
    const judges = new Map<string, JudgeAccumulator>();
    let assignmentCount = 0;
    const submittedScores: number[] = [];

    for (const row of rows) {
        if (row.assignmentStatus === "revoked") {
            continue;
        }
        const judge = judges.get(row.judgeUserId) ?? {
            judgeUserId: row.judgeUserId,
            judgeDisplayName: row.judgeDisplayName,
            assignmentCount: 0,
            submittedCount: 0,
            conflictCount: 0,
            openFlagCount: 0,
            submittedScores: [],
        };
        judge.assignmentCount += 1;
        assignmentCount += 1;
        if (row.assignmentStatus === "conflict_declared") {
            judge.conflictCount += 1;
        }
        if (row.evaluationStatus === "submitted") {
            judge.submittedCount += 1;
            if (row.weightedScore !== null) {
                judge.submittedScores.push(row.weightedScore);
                submittedScores.push(row.weightedScore);
            }
        }
        judges.set(row.judgeUserId, judge);
    }

    for (const flag of flags) {
        const judge = judges.get(flag.reportedByUserId);
        if (judge !== undefined && flag.status === "open") {
            judge.openFlagCount += 1;
        }
    }

    const editionMean = mean(submittedScores);
    const editionAverageScore = editionMean === null ? null : roundScore(editionMean);
    const exactStandardDeviation = populationStandardDeviation(submittedScores, editionMean);
    const standardDeviation = roundScore(exactStandardDeviation);
    const summaries: JudgingCoverageJudge[] = [...judges.values()]
        .map((judge) => {
            const judgeAverage = average(judge.submittedScores);
            const comparison = calibrationFor(judgeAverage, editionAverageScore);
            return {
                judgeUserId: judge.judgeUserId,
                judgeDisplayName: judge.judgeDisplayName,
                assignmentCount: judge.assignmentCount,
                submittedCount: judge.submittedCount,
                conflictCount: judge.conflictCount,
                openFlagCount: judge.openFlagCount,
                averageWeightedScore: judgeAverage,
                editionAverageScore,
                calibrationDelta: comparison.delta,
                calibration: comparison.calibration,
            };
        })
        .toSorted((left, right) => left.judgeDisplayName.localeCompare(right.judgeDisplayName));

    const outliers: JudgingCalibrationOutlier[] =
        editionMean === null || exactStandardDeviation <= STANDARD_DEVIATION_EPSILON
            ? []
            : [...judges.values()]
                  .filter(
                      (judge) =>
                          judge.submittedCount >= CALIBRATION_OUTLIER_MIN_EVALUATIONS &&
                          judge.submittedScores.length >= CALIBRATION_OUTLIER_MIN_EVALUATIONS,
                  )
                  .map((judge) => {
                      const judgeMean = mean(judge.submittedScores);
                      if (judgeMean === null) {
                          return null;
                      }
                      const delta = judgeMean - editionMean;
                      if (
                          Math.abs(delta) <=
                          exactStandardDeviation * CALIBRATION_OUTLIER_DEVIATION_FACTOR
                      ) {
                          return null;
                      }
                      return {
                          judgeUserId: judge.judgeUserId,
                          judgeDisplayName: judge.judgeDisplayName,
                          evaluationCount: judge.submittedCount,
                          averageWeightedScore: roundScore(judgeMean),
                          calibrationDelta: roundScore(delta),
                      };
                  })
                  .filter((outlier): outlier is JudgingCalibrationOutlier => outlier !== null)
                  .toSorted(
                      (left, right) =>
                          Math.abs(right.calibrationDelta) - Math.abs(left.calibrationDelta),
                  );

    return {
        judges: summaries,
        outliers,
        assignmentCount,
        submittedCount: summaries.reduce((total, judge) => total + judge.submittedCount, 0),
        editionAverageScore,
        standardDeviation,
    };
}
