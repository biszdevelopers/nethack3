import type {
    CompetitionEditionStatus,
    RegistrationStatus,
    TeamStatus,
} from "@nethack/contracts";
import { ConflictError, ForbiddenError } from "../../../core/errors.js";

export interface EditionTeamPolicy {
    readonly status: CompetitionEditionStatus;
    readonly registrationOpensAt: string | null;
    readonly registrationClosesAt: string | null;
    readonly teamMinSize: number;
    readonly teamMaxSize: number;
}

export interface DivisionTeamPolicy {
    readonly minTeamSize: number | null;
    readonly maxTeamSize: number | null;
}

export interface TeamSizeLimits {
    readonly min: number;
    readonly max: number;
}

/** Team creation is allowed only while the edition is accepting registrations. */
const TEAM_CREATION_STATUSES: readonly CompetitionEditionStatus[] = [
    "published",
    "registration_open",
];

export class TeamRules {
    static assertEditionAcceptsTeams(edition: EditionTeamPolicy, now: Date): void {
        if (!TEAM_CREATION_STATUSES.includes(edition.status)) {
            throw new ConflictError("This competition is not accepting new teams.");
        }
        if (
            edition.registrationOpensAt !== null &&
            now.getTime() < new Date(edition.registrationOpensAt).getTime()
        ) {
            throw new ConflictError("Team creation has not opened yet.");
        }
        if (
            edition.registrationClosesAt !== null &&
            now.getTime() > new Date(edition.registrationClosesAt).getTime()
        ) {
            throw new ConflictError("Team creation has closed.");
        }
    }

    static requireApprovedRegistration<T extends { readonly status: RegistrationStatus }>(
        registration: T | null,
    ): T {
        if (registration === null || registration.status !== "approved") {
            throw new ForbiddenError(
                "An approved participant registration is required for this competition.",
            );
        }
        return registration;
    }

    static limits(edition: EditionTeamPolicy, division: DivisionTeamPolicy | null): TeamSizeLimits {
        return {
            min: division?.minTeamSize ?? edition.teamMinSize,
            max: division?.maxTeamSize ?? edition.teamMaxSize,
        };
    }

    static assertCapacity(memberCount: number, limits: TeamSizeLimits): void {
        if (memberCount >= limits.max) {
            throw new ConflictError("The team is full.");
        }
    }

    static assertWithinMax(memberCount: number, limits: TeamSizeLimits): void {
        if (memberCount > limits.max) {
            throw new ConflictError(
                `The team already has more members than the ${limits.max}-member limit.`,
            );
        }
    }

    static assertReady(memberCount: number, limits: TeamSizeLimits): void {
        if (memberCount < limits.min) {
            throw new ConflictError(
                `A ready team needs at least ${limits.min} member${limits.min === 1 ? "" : "s"}.`,
            );
        }
        TeamRules.assertWithinMax(memberCount, limits);
    }

    static assertActiveTeam(status: TeamStatus): void {
        if (status === "disbanded") {
            throw new ConflictError("This team has been disbanded.");
        }
    }

    static assertCaptainOnly(teamCaptainUserId: string, actorUserId: string): void {
        if (teamCaptainUserId !== actorUserId) {
            throw new ForbiddenError("Only the team captain may perform this action.");
        }
    }

    static assertCaptainOrOrganizer(
        teamCaptainUserId: string,
        actorUserId: string,
        isOrganizer: boolean,
    ): void {
        if (teamCaptainUserId !== actorUserId && !isOrganizer) {
            throw new ForbiddenError("Only the team captain or an organizer may perform this action.");
        }
    }

    static assertNotRemovingCaptain(teamCaptainUserId: string, targetUserId: string): void {
        if (teamCaptainUserId === targetUserId) {
            throw new ConflictError("Transfer captaincy before removing the captain.");
        }
    }

    static assertCanLeave(teamCaptainUserId: string, actorUserId: string): void {
        if (teamCaptainUserId === actorUserId) {
            throw new ConflictError("Transfer captaincy or disband the team before leaving.");
        }
    }
}
