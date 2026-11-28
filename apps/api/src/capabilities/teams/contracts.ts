import type { TeamRole, TeamStatus } from "@nethack/contracts";

export interface TeamSummary {
    readonly id: string;
    readonly organizationId: string;
    readonly editionId: string;
    readonly divisionId: string | null;
    readonly name: string;
    readonly description: string;
    readonly status: TeamStatus;
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
    getTeamForUser(
        organizationId: string,
        editionId: string,
        userId: string,
    ): Promise<TeamSummary | null>;
    countTeams(organizationId: string, editionId: string): Promise<number>;
    updateTeamStatus(
        actor: TeamAdministrationActor,
        organizationId: string,
        editionId: string,
        teamId: string,
        status: TeamStatus,
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
