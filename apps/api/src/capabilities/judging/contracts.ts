import type { Evaluation, JudgeAssignment, JudgingResult } from "@nethack/contracts";

export interface JudgingSummary {
    readonly assignmentId: string;
    readonly submissionId: string;
    readonly judgeUserId: string;
    readonly status: JudgeAssignment["status"];
    readonly hasSubmittedEvaluation: boolean;
}

export interface JudgingContract {
    getAssignment(organizationId: string, assignmentId: string): Promise<JudgingSummary | null>;
    listEditionResults(
        organizationId: string,
        editionId: string,
    ): Promise<readonly JudgingResult[]>;
    countSubmittedEvaluations(organizationId: string, editionId: string): Promise<number>;
    countOpenFlags(organizationId: string, editionId: string): Promise<number>;
    getEvaluation(organizationId: string, assignmentId: string): Promise<Evaluation | null>;
}

export const JUDGING_CONTRACT = "judging.v1";
