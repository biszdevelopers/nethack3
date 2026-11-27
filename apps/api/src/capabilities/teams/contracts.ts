import type { TeamStatus } from "@nethack/contracts";

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

export interface TeamsContract {
    getTeam(organizationId: string, teamId: string): Promise<TeamSummary | null>;
    listEditionTeams(organizationId: string, editionId: string): Promise<readonly TeamSummary[]>;
    isTeamMember(organizationId: string, teamId: string, userId: string): Promise<boolean>;
    getTeamForUser(
        organizationId: string,
        editionId: string,
        userId: string,
    ): Promise<TeamSummary | null>;
    countTeams(organizationId: string, editionId: string): Promise<number>;
}

export const TEAMS_CONTRACT = "teams.v1";
