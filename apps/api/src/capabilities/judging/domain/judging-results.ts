import type { JudgingResult } from "@nethack/contracts";

export interface JudgingResultRow {
    readonly assignmentId: string;
    readonly submissionId: string;
    readonly projectId: string;
    readonly projectTitle: string;
    readonly teamId: string | null;
    readonly teamName: string | null;
    readonly judgeUserId: string;
    readonly judgeDisplayName: string;
    readonly evaluationStatus: "draft" | "submitted" | null;
    readonly weightedScore: number | null;
    readonly submittedAt: string | null;
}

/**
 * Ranks submissions by the mean weighted score of submitted evaluations.
 * Draft evaluations are shown for progress but never influence the average.
 */
export function aggregateJudgingResults(
    rows: readonly JudgingResultRow[],
): readonly JudgingResult[] {
    const grouped = new Map<string, JudgingResultRow[]>();
    for (const row of rows) {
        const group = grouped.get(row.submissionId) ?? [];
        group.push(row);
        grouped.set(row.submissionId, group);
    }

    const results: JudgingResult[] = [];
    for (const group of grouped.values()) {
        const first = group[0];
        if (first === undefined) {
            continue;
        }
        const submitted = group.filter(
            (row) => row.evaluationStatus === "submitted" && row.weightedScore !== null,
        );
        const averageScore =
            submitted.length === 0
                ? null
                : Math.round(
                      (submitted.reduce((total, row) => total + (row.weightedScore ?? 0), 0) /
                          submitted.length) *
                          100,
                  ) / 100;
        results.push({
            submissionId: first.submissionId,
            projectId: first.projectId,
            projectTitle: first.projectTitle,
            teamId: first.teamId,
            teamName: first.teamName,
            assignmentCount: group.length,
            submittedCount: submitted.length,
            averageScore,
            rank: null,
            evaluations: group.map((row) => ({
                assignmentId: row.assignmentId,
                judgeUserId: row.judgeUserId,
                judgeDisplayName: row.judgeDisplayName,
                status: row.evaluationStatus,
                weightedScore: row.weightedScore,
                submittedAt: row.submittedAt,
            })),
        });
    }

    results.sort((left, right) => {
        if (left.averageScore === null && right.averageScore === null) {
            return left.projectTitle.localeCompare(right.projectTitle);
        }
        if (left.averageScore === null) {
            return 1;
        }
        if (right.averageScore === null) {
            return -1;
        }
        return (
            right.averageScore - left.averageScore ||
            left.projectTitle.localeCompare(right.projectTitle)
        );
    });

    let previousScore: number | null = null;
    let previousRank = 0;
    return results.map((result, index) => {
        if (result.averageScore === null) {
            return result;
        }
        const rank =
            previousScore !== null && result.averageScore === previousScore
                ? previousRank
                : index + 1;
        previousScore = result.averageScore;
        previousRank = rank;
        return { ...result, rank };
    });
}
