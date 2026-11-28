import type { BulkAssignmentScope, SubmissionStatus } from "@nethack/contracts";

/** Submissions an organizer can hand to a judge without reopening the project. */
export const JUDGEABLE_SUBMISSION_STATUSES = [
    "submitted",
    "accepted",
] as const satisfies readonly SubmissionStatus[];

export interface BulkSubmissionCandidate {
    readonly id: string;
    readonly teamId: string | null;
    readonly status: SubmissionStatus;
}

export interface BulkSelectionInput {
    readonly scope: BulkAssignmentScope;
    readonly submissions: readonly BulkSubmissionCandidate[];
    readonly submissionId?: string;
    readonly divisionTeamIds?: readonly string[];
}

export interface BulkAssignmentPlan {
    readonly toAssign: readonly string[];
    /** Submissions the judge already holds an active assignment for. */
    readonly skipped: number;
}

export function isJudgeableSubmission(status: SubmissionStatus): boolean {
    return JUDGEABLE_SUBMISSION_STATUSES.some((candidate) => candidate === status);
}

/**
 * Picks the submissions a bulk assignment scope covers. Explicit submission
 * scope assigns the named submission even when its status is not judgeable yet,
 * matching the single-assignment route. Edition-wide and division scopes only
 * cover submitted or accepted work.
 */
export function selectBulkSubmissionIds(input: BulkSelectionInput): readonly string[] {
    switch (input.scope) {
        case "submission": {
            if (input.submissionId === undefined) {
                return [];
            }
            return input.submissions.some((submission) => submission.id === input.submissionId)
                ? [input.submissionId]
                : [];
        }
        case "division": {
            const teamIds = new Set(input.divisionTeamIds ?? []);
            return input.submissions
                .filter(
                    (submission) =>
                        submission.teamId !== null &&
                        teamIds.has(submission.teamId) &&
                        isJudgeableSubmission(submission.status),
                )
                .map((submission) => submission.id);
        }
        case "all":
            return input.submissions
                .filter((submission) => isJudgeableSubmission(submission.status))
                .map((submission) => submission.id);
    }
}

/**
 * Deduplicates candidate submissions and skips the ones the judge already
 * holds. Revoked assignments are absent from `activeSubmissionIds`, so a bulk
 * assignment revives them instead of silently dropping the submission.
 */
export function planBulkAssignments(
    submissionIds: readonly string[],
    activeSubmissionIds: ReadonlySet<string>,
): BulkAssignmentPlan {
    const planned = new Set<string>();
    const toAssign: string[] = [];
    let skipped = 0;
    for (const submissionId of submissionIds) {
        if (planned.has(submissionId)) {
            continue;
        }
        planned.add(submissionId);
        if (activeSubmissionIds.has(submissionId)) {
            skipped += 1;
            continue;
        }
        toAssign.push(submissionId);
    }
    return { toAssign, skipped };
}
