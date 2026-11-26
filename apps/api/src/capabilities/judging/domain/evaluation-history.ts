import type { EvaluationVersion } from "@nethack/contracts";

export interface EvaluationVersionRecord {
    readonly revision: number;
    readonly status: "draft" | "submitted";
    readonly overallComment: string;
    readonly weightedScore: string | null;
    readonly scores: readonly {
        readonly criterionId: string;
        readonly score: number;
        readonly comment: string;
    }[];
    readonly submittedAt: Date | null;
    readonly createdAt: Date;
}

export function nextEvaluationRevision(latestRevision: number | null): number {
    return (latestRevision ?? 0) + 1;
}

export function toEvaluationVersion(record: EvaluationVersionRecord): EvaluationVersion {
    return {
        revision: record.revision,
        status: record.status,
        overallComment: record.overallComment,
        weightedScore: record.weightedScore === null ? null : Number(record.weightedScore),
        scores: record.scores.map((score) => ({
            criterionId: score.criterionId,
            score: score.score,
            comment: score.comment,
        })),
        submittedAt: record.submittedAt === null ? null : record.submittedAt.toISOString(),
        createdAt: record.createdAt.toISOString(),
    };
}
