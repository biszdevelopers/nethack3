import type { TeamStatus } from "@nethack/contracts";
import { ForbiddenError } from "../../../core/errors.js";

const INACTIVE_TEAM_STATUSES: ReadonlySet<TeamStatus> = new Set([
    "withdrawn",
    "disqualified",
    "no_show",
    "disbanded",
]);

/**
 * The voter's ballot scope. A teamless judge or organizer (or a team without a
 * division) cannot be narrowed down, so both ids stay null and the ballot lists
 * every votable submission. Participants are rejected before this point unless
 * they belong to an active team with a submitted project.
 */
export interface BallotEligibility {
    readonly teamId: string | null;
    readonly divisionId: string | null;
    readonly active: boolean;
}

export interface TeamDivision {
    readonly divisionId: string | null;
}

export interface SubmissionPlacement {
    readonly teamId: string | null;
}

export type BallotIneligibilityReason = "inactive_team" | "own_team" | "outside_division";

const REASON_MESSAGES: Record<BallotIneligibilityReason, string> = {
    inactive_team: "Your team is not active, so you cannot vote in this round.",
    own_team: "You cannot score your own team's submission.",
    outside_division: "You can only score submissions from your own division.",
};

export type ParticipantBallotIneligibility = "no_team" | "inactive_team" | "no_submission";

const PARTICIPANT_REASON_MESSAGES: Record<ParticipantBallotIneligibility, string> = {
    no_team: "Only participants with an active team can vote in this round.",
    inactive_team: "Your team is not active, so you cannot vote in this round.",
    no_submission: "Only participants whose team has a submitted project can vote in this round.",
};

export function isActiveVotingTeam(status: TeamStatus): boolean {
    return !INACTIVE_TEAM_STATUSES.has(status);
}

/**
 * Participant-only gate. A participant must belong to an active team of the
 * edition and that team must carry at least one submission in a votable status.
 * Judges and organizers never pass through here.
 */
export function participantBallotIneligibility(
    team: { readonly status: TeamStatus } | null,
    hasVotableSubmission: boolean,
): ParticipantBallotIneligibility | null {
    if (team === null) {
        return "no_team";
    }
    if (!isActiveVotingTeam(team.status)) {
        return "inactive_team";
    }
    if (!hasVotableSubmission) {
        return "no_submission";
    }
    return null;
}

export function assertParticipantBallotEligible(
    team: { readonly status: TeamStatus } | null,
    hasVotableSubmission: boolean,
): void {
    const reason = participantBallotIneligibility(team, hasVotableSubmission);
    if (reason !== null) {
        throw new ForbiddenError(PARTICIPANT_REASON_MESSAGES[reason]);
    }
}

export function toBallotEligibility(
    team: {
        readonly id: string;
        readonly divisionId: string | null;
        readonly status: TeamStatus;
    } | null,
): BallotEligibility {
    if (team === null) {
        return { teamId: null, divisionId: null, active: true };
    }
    return {
        teamId: team.id,
        divisionId: team.divisionId,
        active: isActiveVotingTeam(team.status),
    };
}

export function ineligibilityReason(
    placement: SubmissionPlacement,
    teamDivisions: ReadonlyMap<string, TeamDivision>,
    eligibility: BallotEligibility,
): BallotIneligibilityReason | null {
    if (!eligibility.active) {
        return "inactive_team";
    }
    if (placement.teamId !== null && placement.teamId === eligibility.teamId) {
        return "own_team";
    }
    if (eligibility.divisionId === null) {
        return null;
    }
    if (placement.teamId === null) {
        return "outside_division";
    }
    const division = teamDivisions.get(placement.teamId);
    if (division === undefined || division.divisionId === null) {
        return "outside_division";
    }
    return division.divisionId === eligibility.divisionId ? null : "outside_division";
}

export function isSubmissionEligible(
    placement: SubmissionPlacement,
    teamDivisions: ReadonlyMap<string, TeamDivision>,
    eligibility: BallotEligibility,
): boolean {
    return ineligibilityReason(placement, teamDivisions, eligibility) === null;
}

export function assertSelectionsEligible(
    submissionIds: readonly string[],
    placements: ReadonlyMap<string, SubmissionPlacement>,
    teamDivisions: ReadonlyMap<string, TeamDivision>,
    eligibility: BallotEligibility,
): void {
    for (const submissionId of submissionIds) {
        const placement = placements.get(submissionId);
        if (placement === undefined) {
            continue;
        }
        const reason = ineligibilityReason(placement, teamDivisions, eligibility);
        if (reason !== null) {
            throw new ForbiddenError(REASON_MESSAGES[reason]);
        }
    }
}
