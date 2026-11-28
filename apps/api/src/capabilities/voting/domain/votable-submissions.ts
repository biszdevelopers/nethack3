import type { SubmissionStatus, VotableSubmission } from "@nethack/contracts";
import {
    isSubmissionEligible,
    type BallotEligibility,
    type TeamDivision,
} from "./ballot-eligibility.js";
import { VotingRules } from "./voting-rules.js";

export interface VotableSubmissionSource {
    readonly id: string;
    readonly title: string;
    readonly summary: string;
    readonly status: SubmissionStatus;
    readonly teamId: string | null;
    readonly videoUrl?: string | null;
    readonly aiDisclosure?: string;
    readonly repositoryUrl?: string | null;
    readonly demoUrl?: string | null;
}

export interface VotableTeamInfo {
    readonly name: string;
    readonly divisionId: string | null;
    readonly divisionName: string | null;
}

/**
 * Discovery and cast eligibility share this mapper. A null eligibility means
 * the caller is managing the edition (an owner or organizer), who may review
 * every votable submission. A voter with no team, or whose team has no
 * division, falls back to the whole votable set minus their own team; a voter
 * whose team is withdrawn, disqualified, no_show, or disbanded gets no options.
 */
export function toVotableSubmissions(
    submissions: readonly VotableSubmissionSource[],
    teams: ReadonlyMap<string, VotableTeamInfo>,
    eligibility: BallotEligibility | null = null,
): VotableSubmission[] {
    const teamDivisions = new Map<string, TeamDivision>();
    for (const [teamId, team] of teams) {
        teamDivisions.set(teamId, { divisionId: team.divisionId });
    }
    return submissions
        .filter((submission) => VotingRules.isVotableSubmission(submission.status))
        .filter(
            (submission) =>
                eligibility === null ||
                isSubmissionEligible(submission, teamDivisions, eligibility),
        )
        .map((submission) => {
            const team = submission.teamId === null ? null : teams.get(submission.teamId);
            return {
                id: submission.id,
                projectTitle: submission.title,
                summary: submission.summary,
                teamId: submission.teamId,
                teamName: team?.name ?? null,
                divisionName: team?.divisionName ?? null,
                videoUrl: submission.videoUrl ?? null,
                aiDisclosure: submission.aiDisclosure ?? "",
                repositoryUrl: submission.repositoryUrl ?? null,
                demoUrl: submission.demoUrl ?? null,
            };
        });
}
