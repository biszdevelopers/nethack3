import type { TeamRole, TeamStatus } from "@nethack/contracts";
import type { DatabaseSession } from "../../infrastructure/database/client.js";

export interface TeamSummary {
    readonly id: string;
    readonly organizationId: string;
    readonly editionId: string;
    readonly divisionId: string | null;
    readonly name: string;
    readonly description: string;
    readonly status: TeamStatus;
    readonly statusReason: string;
    readonly lockedAt: string | null;
    readonly captainUserId: string;
    readonly memberCount: number;
    readonly maxMembers: number;
}

export interface TeamMemberSummary {
    readonly userId: string;
    readonly displayName: string;
    readonly avatarUrl: string | null;
    readonly role: TeamRole;
    readonly joinedAt: string;
}

export interface TeamWithMembers extends TeamSummary {
    readonly members: readonly TeamMemberSummary[];
}

export interface UserTeamHistory {
    readonly teamId: string;
    readonly teamName: string;
    readonly editionId: string;
    readonly editionName: string;
    readonly editionSlug: string;
    readonly joinedAt: string;
    readonly leftAt: string | null;
}

/**
 * Administration operations assume the caller has already established an
 * owner/organizer membership in the addressed organization. Implementations
 * enforce organization and edition scope but do not re-check roles.
 */
export interface TeamAdministrationActor {
    readonly userId: string;
    readonly ip: string | null;
}

export interface TeamsContract {
    getTeam(organizationId: string, teamId: string): Promise<TeamSummary | null>;
    listEditionTeams(organizationId: string, editionId: string): Promise<readonly TeamSummary[]>;
    listEditionTeamsWithMembers(
        organizationId: string,
        editionId: string,
    ): Promise<readonly TeamWithMembers[]>;
    isTeamMember(organizationId: string, teamId: string, userId: string): Promise<boolean>;
    /**
     * Whether the user is an active member of any team in the organization,
     * across every edition. Memberships that ended do not count.
     */
    hasActiveTeamMembership(organizationId: string, userId: string): Promise<boolean>;
    getTeamForUser(
        organizationId: string,
        editionId: string,
        userId: string,
    ): Promise<TeamSummary | null>;
    countTeams(organizationId: string, editionId: string): Promise<number>;
    /** Locks roster/metadata changes after the first submitted version. Idempotent. */
    lockTeam(
        organizationId: string,
        teamId: string,
        at: Date,
        session?: DatabaseSession,
    ): Promise<void>;
    /** Unlocks a team when an organizer reopens its submission. Idempotent. */
    unlockTeam(
        organizationId: string,
        teamId: string,
        at: Date,
        session?: DatabaseSession,
    ): Promise<void>;
    /**
     * Every team the user has belonged to in the organization, including
     * memberships that ended. Active memberships have `leftAt === null`.
     */
    listUserTeamHistory(
        organizationId: string,
        userId: string,
    ): Promise<readonly UserTeamHistory[]>;
    updateTeamStatus(
        actor: TeamAdministrationActor,
        organizationId: string,
        editionId: string,
        teamId: string,
        status: TeamStatus,
        reason: string,
    ): Promise<void>;
    /**
     * Deletes a team with no members. Callers must also confirm through the
     * submissions contract that the team has no submission.
     */
    deleteTeam(
        actor: TeamAdministrationActor,
        organizationId: string,
        editionId: string,
        teamId: string,
    ): Promise<void>;
}

export const TEAMS_CONTRACT = "teams.v1";
