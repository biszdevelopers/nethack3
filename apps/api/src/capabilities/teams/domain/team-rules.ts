import type {
    CompetitionEditionStatus,
    OrganizationRole,
    RegistrationStatus,
    TeamStatus,
} from "@nethack/contracts";
import { ConflictError, ForbiddenError, ValidationError } from "../../../core/errors.js";

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

type InactiveTeamStatus = "withdrawn" | "disqualified" | "no_show" | "disbanded";

const INACTIVE_TEAM_STATUSES: ReadonlySet<TeamStatus> = new Set([
    "withdrawn",
    "disqualified",
    "no_show",
    "disbanded",
]);

/**
 * Terminal statuses cannot be left, so a disqualified or withdrawn team keeps
 * its historical outcome instead of being silently reactivated.
 */
export const TEAM_STATUS_TRANSITIONS: Readonly<Record<TeamStatus, readonly TeamStatus[]>> = {
    forming: ["ready", "withdrawn", "disqualified", "no_show", "disbanded"],
    ready: ["forming", "withdrawn", "disqualified", "no_show", "disbanded"],
    withdrawn: [],
    disqualified: [],
    no_show: [],
    disbanded: [],
};

const INACTIVE_MESSAGES: Readonly<Record<InactiveTeamStatus, string>> = {
    withdrawn: "This team has withdrawn from the competition.",
    disqualified: "This team has been disqualified.",
    no_show: "This team did not participate.",
    disbanded: "This team has been disbanded.",
};

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

    /**
     * Judges and organizers may administer teams but cannot compete on one.
     * Only the participant role may create or join a team.
     */
    static assertParticipantRole(role: OrganizationRole | null): void {
        if (role !== null && role !== "participant") {
            throw new ConflictError(
                "Judges and organizers cannot join or create a team in the same organization.",
            );
        }
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

    /**
     * Pending invitations reserve capacity: accepting them must not overflow the
     * roster, so members plus unexpired pending invitations must leave a seat.
     */
    static assertInviteCapacity(
        memberCount: number,
        pendingInvitationCount: number,
        limits: TeamSizeLimits,
    ): void {
        if (memberCount + pendingInvitationCount >= limits.max) {
            throw new ConflictError(
                "The team is full once pending invitations are counted. Revoke an invitation or wait for it to expire.",
            );
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
        if (isInactiveTeamStatus(status)) {
            throw new ConflictError(INACTIVE_MESSAGES[status]);
        }
    }

    static assertNotLocked(lockedAt: Date | null): void {
        if (lockedAt !== null) {
            throw new ConflictError(
                "The team is locked after its project was submitted. Ask an organizer to reopen the submission.",
            );
        }
    }

    static assertStatusTransition(from: TeamStatus, to: TeamStatus): void {
        if (from === to) {
            return;
        }
        if (!TEAM_STATUS_TRANSITIONS[from].includes(to)) {
            throw new ConflictError(
                `A ${statusLabel(from)} team cannot move to ${statusLabel(to)}.`,
            );
        }
    }

    /**
     * Terminal statuses need an explanation that is shown next to the status
     * and kept on the team row; active statuses clear the previous reason.
     */
    static statusReason(status: TeamStatus, reason: string | undefined): string {
        if (!isInactiveTeamStatus(status)) {
            return "";
        }
        const trimmed = (reason ?? "").trim();
        if (trimmed.length < 5 || trimmed.length > 500) {
            throw new ValidationError(
                "A reason of 5 to 500 characters is required when a team is withdrawn, disqualified, marked as a no-show, or disbanded.",
                { reason: ["Enter a reason of 5 to 500 characters."] },
            );
        }
        return trimmed;
    }

    static assertCanDelete(memberCount: number): void {
        if (memberCount > 0) {
            throw new ConflictError("Only a team without members can be deleted.");
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
            throw new ForbiddenError(
                "Only the team captain or an organizer may perform this action.",
            );
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

    /** A solo captain leaves by disbanding; a larger team needs a new captain first. */
    static assertCaptainMayLeave(memberCount: number): void {
        if (memberCount > 1) {
            throw new ConflictError(
                "Transfer captaincy to another member before leaving the team.",
            );
        }
    }

    static assertCanDisband(hasSubmission: boolean): void {
        if (hasSubmission) {
            throw new ConflictError("A team with a submission cannot be disbanded.");
        }
    }

    static assertInvitationMatchesEmail(invitationEmail: string, userEmail: string): void {
        if (invitationEmail.toLowerCase() !== userEmail.toLowerCase()) {
            throw new ForbiddenError("This invitation was issued to a different email address.");
        }
    }

    static assertInvitationPending(status: string, expiresAt: Date, now: Date): void {
        if (status === "pending" && expiresAt <= now) {
            throw new ConflictError("The invitation has expired.");
        }
        if (status !== "pending") {
            throw new ConflictError("The invitation is no longer pending.");
        }
    }
}

function isInactiveTeamStatus(status: TeamStatus): status is InactiveTeamStatus {
    return INACTIVE_TEAM_STATUSES.has(status);
}

function statusLabel(status: TeamStatus): string {
    return status.replaceAll("_", " ");
}
