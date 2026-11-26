import type { SubmissionStatus, VotableSubmission } from "@nethack/contracts";
import { VotingRules } from "./voting-rules.js";

export interface VotableSubmissionSource {
    readonly id: string;
    readonly title: string;
    readonly summary: string;
    readonly status: SubmissionStatus;
    readonly teamId: string | null;
}

export function toVotableSubmissions(
    submissions: readonly VotableSubmissionSource[],
    teamNames: ReadonlyMap<string, string>,
): VotableSubmission[] {
    return submissions
        .filter((submission) => VotingRules.isVotableSubmission(submission.status))
        .map((submission) => ({
            id: submission.id,
            projectTitle: submission.title,
            summary: submission.summary,
            teamId: submission.teamId,
            teamName:
                submission.teamId === null ? null : (teamNames.get(submission.teamId) ?? null),
        }));
}
