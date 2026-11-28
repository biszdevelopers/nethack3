import type { TeamStatus } from "@nethack/contracts";
import { ForbiddenError } from "../../../core/errors.js";

const INACTIVE_TEAM_STATUSES: ReadonlySet<TeamStatus> = new Set([
    "withdrawn",
    "disqualified",
    "no_show",
    "disbanded",
]);

/**
 * The voter's ballot scope. A voter without a team (or whose team has no
 * division) cannot be narrowed down, so both ids stay null and the ballot lists
 * every votable submission except the voter's own team when one is known.
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

export function isActiveVotingTeam(status: TeamStatus): boolean {
    return !INACTIVE_TEAM_STATUSES.has(status);
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
