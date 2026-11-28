import { TEAM_FEEDBACK_MINIMUM_EVALUATIONS } from "@nethack/contracts";
import type {
    Evaluation,
    JudgeAssignment,
    JudgingResult,
    TeamFeedbackEntry,
} from "@nethack/contracts";

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
    /**
     * Anonymous submitted feedback for a team. Returns an empty list until at
     * least three submitted evaluations exist for the team's submissions.
     */
    listTeamFeedback(
        organizationId: string,
        editionId: string,
        teamId: string,
    ): Promise<readonly TeamFeedbackEntry[]>;
}

export const JUDGING_CONTRACT = "judging.v1";

/** Submitted evaluations a team needs before its feedback becomes visible. */
export { TEAM_FEEDBACK_MINIMUM_EVALUATIONS };
