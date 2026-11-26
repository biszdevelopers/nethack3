import {
    acceptTeamInvitationRequestSchema,
    auditLogSchema,
    createTeamRequestSchema,
    inviteTeamMemberRequestSchema,
    listResponseSchema,
    teamDetailSchema,
    teamInvitationAcceptanceSchema,
    teamInvitationSchema,
    teamSchema,
    transferTeamCaptainRequestSchema,
    updateTeamRequestSchema,
    type AuditLog,
    type CreateTeamRequest,
    type InviteTeamMemberRequest,
    type ListResponse,
    type Team,
    type TeamDetail,
    type TeamInvitation,
    type TeamInvitationAcceptance,
    type UpdateTeamRequest,
} from "@nethack/contracts";
import type { ApiClient } from "./client.js";

export interface TeamActivityQuery {
    readonly cursor?: string;
    readonly limit?: number;
}

const teamListSchema = listResponseSchema(teamSchema);
const activityListSchema = listResponseSchema(auditLogSchema);

export class TeamsApi {
    private readonly client: ApiClient;

    constructor(client: ApiClient) {
        this.client = client;
    }

    async listForEdition(editionId: string): Promise<ListResponse<Team>> {
        return this.client.request("GET", `/api/v1/competitions/${editionId}/teams`, {
            schema: teamListSchema,
        });
    }

    async create(editionId: string, input: CreateTeamRequest): Promise<Team> {
        return this.client.request("POST", `/api/v1/competitions/${editionId}/teams`, {
            body: createTeamRequestSchema.parse(input),
            schema: teamSchema,
        });
    }

    async get(teamId: string): Promise<TeamDetail> {
        return this.client.request("GET", `/api/v1/teams/${teamId}`, {
            schema: teamDetailSchema,
        });
    }

    async update(teamId: string, input: UpdateTeamRequest): Promise<TeamDetail> {
        return this.client.request("PATCH", `/api/v1/teams/${teamId}`, {
            body: updateTeamRequestSchema.parse(input),
            schema: teamDetailSchema,
        });
    }

    async invite(teamId: string, input: InviteTeamMemberRequest): Promise<TeamInvitation> {
        return this.client.request("POST", `/api/v1/teams/${teamId}/invitations`, {
            body: inviteTeamMemberRequestSchema.parse(input),
            schema: teamInvitationSchema,
        });
    }

    async acceptInvitation(token: string): Promise<TeamInvitationAcceptance> {
        return this.client.request("POST", "/api/v1/team-invitations/accept", {
            body: acceptTeamInvitationRequestSchema.parse({ token }),
            schema: teamInvitationAcceptanceSchema,
        });
    }

    async removeMember(teamId: string, userId: string): Promise<void> {
        await this.client.request("DELETE", `/api/v1/teams/${teamId}/members/${userId}`);
    }

    async transferCaptain(teamId: string, userId: string): Promise<void> {
        await this.client.request("POST", `/api/v1/teams/${teamId}/captain`, {
            body: transferTeamCaptainRequestSchema.parse({ userId }),
        });
    }

    async leave(teamId: string): Promise<void> {
        await this.client.request("POST", `/api/v1/teams/${teamId}/leave`);
    }

    async mine(): Promise<ListResponse<Team>> {
        return this.client.request("GET", "/api/v1/me/teams", { schema: teamListSchema });
    }

    async activity(teamId: string, query: TeamActivityQuery = {}): Promise<ListResponse<AuditLog>> {
        return this.client.request("GET", `/api/v1/teams/${teamId}/activity`, {
            query: { cursor: query.cursor, limit: query.limit },
            schema: activityListSchema,
        });
    }
}
