import { TEAM_FEEDBACK_MINIMUM_EVALUATIONS, type TeamFeedbackEntry } from "@nethack/contracts";

/**
 * Written feedback is only released once at least three submitted evaluations
 * exist for a team, so no single judge can be identified from a one-person review.
 */
export const TEAM_FEEDBACK_MIN_REVIEWERS = TEAM_FEEDBACK_MINIMUM_EVALUATIONS;

export interface SubmittedTeamFeedbackRow {
    readonly comment: string;
    readonly weightedScore: number | null;
    readonly submittedAt: string;
}

export function anonymousTeamFeedback(
    rows: readonly SubmittedTeamFeedbackRow[],
): readonly TeamFeedbackEntry[] {
    if (rows.length < TEAM_FEEDBACK_MIN_REVIEWERS) {
        return [];
    }
    return rows.map((row) => ({
        comment: row.comment,
        weightedScore: row.weightedScore,
        submittedAt: row.submittedAt,
    }));
}
