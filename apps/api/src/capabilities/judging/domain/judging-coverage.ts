import type {
    JudgeAssignmentStatus,
    JudgingCalibration,
    JudgingCoverageJudge,
} from "@nethack/contracts";

export const CALIBRATION_THRESHOLD = 10;

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
    readonly assignmentCount: number;
    readonly submittedCount: number;
    readonly editionAverageScore: number | null;
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

function average(values: readonly number[]): number | null {
    if (values.length === 0) {
        return null;
    }
    return roundScore(values.reduce((total, value) => total + value, 0) / values.length);
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
 * counted as in progress but never influence any average.
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

    const editionAverageScore = average(submittedScores);
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

    return {
        judges: summaries,
        assignmentCount,
        submittedCount: summaries.reduce((total, judge) => total + judge.submittedCount, 0),
        editionAverageScore,
    };
}
