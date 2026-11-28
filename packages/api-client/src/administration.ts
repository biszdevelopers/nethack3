import {
    administrationPreflightSchema,
    administrationTeamSchema,
    administrationUserSchema,
    auditLogSchema,
    createDebugAiSessionRequestSchema,
    debugAiExchangeSchema,
    debugAiSessionDetailSchema,
    debugAiSessionListSchema,
    debugAiSessionSchema,
    debugAiStatusSchema,
    globalAdministratorSchema,
    grantGlobalAdministratorRequestSchema,
    listResponseSchema,
    reopenAdministrationSubmissionRequestSchema,
    reportSummarySchema,
    revokeGlobalAdministratorRequestSchema,
    sendDebugAiMessageRequestSchema,
    storedFilePageSchema,
    updateAdministrationTeamRequestSchema,
    updateAdministrationUserRequestSchema,
    type AdministrationPreflight,
    type AdministrationTeam,
    type AdministrationUser,
    type AuditLog,
    type CreateDebugAiSessionRequest,
    type DebugAiExchange,
    type DebugAiSession,
    type DebugAiSessionDetail,
    type DebugAiSessionList,
    type DebugAiStatus,
    type GlobalAdministrator,
    type GrantGlobalAdministratorRequest,
    type ListResponse,
    type OrganizationRole,
    type ReopenAdministrationSubmissionRequest,
    type ReportSummary,
    type RevokeGlobalAdministratorRequest,
    type StoredFilePage,
    type TeamStatus,
} from "@nethack/contracts";
import type { ApiClient } from "./client.js";

const administratorListSchema = listResponseSchema(globalAdministratorSchema);
const auditListSchema = listResponseSchema(auditLogSchema);
const userListSchema = listResponseSchema(administrationUserSchema);
const teamListSchema = listResponseSchema(administrationTeamSchema);

export interface AuditQuery {
    readonly cursor?: string;
    readonly limit?: number;
    readonly action?: string;
    readonly entityType?: string;
    readonly actorUserId?: string;
}

export interface GlobalAuditQuery extends AuditQuery {
    readonly organizationId?: string;
}

function organizationHeader(organizationId: string): Record<string, string> {
    return { "X-Nethack-Organization-Id": organizationId };
}

export class AdministrationApi {
    private readonly client: ApiClient;

    constructor(client: ApiClient) {
        this.client = client;
    }

    async globalAdministrators(): Promise<ListResponse<GlobalAdministrator>> {
        return this.client.request("GET", "/api/v1/admin/global-administrators", {
            schema: administratorListSchema,
        });
    }

    async grant(input: GrantGlobalAdministratorRequest): Promise<GlobalAdministrator> {
        return this.client.request("POST", "/api/v1/admin/global-administrators", {
            body: grantGlobalAdministratorRequestSchema.parse(input),
            schema: globalAdministratorSchema,
        });
    }

    async revoke(userId: string, input: RevokeGlobalAdministratorRequest): Promise<void> {
        await this.client.request("DELETE", `/api/v1/admin/global-administrators/${userId}`, {
            body: revokeGlobalAdministratorRequestSchema.parse(input),
        });
    }

    async audit(organizationId: string, query: AuditQuery = {}): Promise<ListResponse<AuditLog>> {
        return this.client.request("GET", "/api/v1/admin/audit", {
            query: {
                organizationId,
                cursor: query.cursor,
                limit: query.limit,
                action: query.action,
                entityType: query.entityType,
                actorUserId: query.actorUserId,
            },
            schema: auditListSchema,
        });
    }

    async globalAudit(query: GlobalAuditQuery = {}): Promise<ListResponse<AuditLog>> {
        return this.client.request("GET", "/api/v1/admin/audit/global", {
            query: {
                organizationId: query.organizationId,
                cursor: query.cursor,
                limit: query.limit,
                action: query.action,
                entityType: query.entityType,
                actorUserId: query.actorUserId,
            },
            schema: auditListSchema,
        });
    }

    async organizationReports(organizationId: string): Promise<ReportSummary> {
        return this.client.request("GET", `/api/v1/organizations/${organizationId}/reports`, {
            schema: reportSummarySchema,
        });
    }

    async users(organizationId: string): Promise<ListResponse<AdministrationUser>> {
        return this.client.request(
            "GET",
            `/api/v1/organizations/${organizationId}/administration/users`,
            { schema: userListSchema, headers: organizationHeader(organizationId) },
        );
    }

    async updateUserRole(
        organizationId: string,
        userId: string,
        role: OrganizationRole,
    ): Promise<void> {
        await this.client.request(
            "PATCH",
            `/api/v1/organizations/${organizationId}/administration/users/${userId}`,
            {
                body: updateAdministrationUserRequestSchema.parse({ role }),
                headers: organizationHeader(organizationId),
            },
        );
    }

    async teams(
        organizationId: string,
        editionId: string,
    ): Promise<ListResponse<AdministrationTeam>> {
        return this.client.request("GET", `/api/v1/administration/editions/${editionId}/teams`, {
            schema: teamListSchema,
            headers: organizationHeader(organizationId),
        });
    }

    async updateTeamStatus(
        organizationId: string,
        editionId: string,
        teamId: string,
        status: TeamStatus,
    ): Promise<void> {
        await this.client.request(
            "PATCH",
            `/api/v1/administration/editions/${editionId}/teams/${teamId}`,
            {
                body: updateAdministrationTeamRequestSchema.parse({ status }),
                headers: organizationHeader(organizationId),
            },
        );
    }

    async deleteTeam(organizationId: string, editionId: string, teamId: string): Promise<void> {
        await this.client.request(
            "DELETE",
            `/api/v1/administration/editions/${editionId}/teams/${teamId}`,
            { headers: organizationHeader(organizationId) },
        );
    }

    async reopenSubmission(
        organizationId: string,
        editionId: string,
        submissionId: string,
        input: ReopenAdministrationSubmissionRequest,
    ): Promise<void> {
        await this.client.request(
            "POST",
            `/api/v1/administration/editions/${editionId}/submissions/${submissionId}/reopen`,
            {
                body: reopenAdministrationSubmissionRequestSchema.parse(input),
                headers: organizationHeader(organizationId),
            },
        );
    }

    async preflight(organizationId: string, editionId: string): Promise<AdministrationPreflight> {
        return this.client.request(
            "GET",
            `/api/v1/administration/editions/${editionId}/preflight`,
            { schema: administrationPreflightSchema, headers: organizationHeader(organizationId) },
        );
    }

    async debugFiles(
        kind: "files" | "references",
        query: { readonly limit?: number; readonly offset?: number } = {},
    ): Promise<StoredFilePage> {
        return this.client.request("GET", `/api/v1/admin/debug/${kind}`, {
            query: { limit: query.limit, offset: query.offset },
            schema: storedFilePageSchema,
        });
    }

    async debugAiStatus(): Promise<DebugAiStatus> {
        return this.client.request("GET", "/api/v1/admin/debug/ai/status", {
            schema: debugAiStatusSchema,
        });
    }

    async debugAiSessions(): Promise<DebugAiSessionList> {
        return this.client.request("GET", "/api/v1/admin/debug/ai/sessions", {
            schema: debugAiSessionListSchema,
        });
    }

    async createDebugAiSession(input: CreateDebugAiSessionRequest): Promise<DebugAiSession> {
        return this.client.request("POST", "/api/v1/admin/debug/ai/sessions", {
            body: createDebugAiSessionRequestSchema.parse(input),
            schema: debugAiSessionSchema,
        });
    }

    async debugAiSession(sessionId: string): Promise<DebugAiSessionDetail> {
        return this.client.request("GET", `/api/v1/admin/debug/ai/sessions/${sessionId}`, {
            schema: debugAiSessionDetailSchema,
        });
    }

    async deleteDebugAiSession(sessionId: string): Promise<void> {
        await this.client.request("DELETE", `/api/v1/admin/debug/ai/sessions/${sessionId}`);
    }

    async sendDebugAiMessage(sessionId: string, content: string): Promise<DebugAiExchange> {
        return this.client.request(
            "POST",
            `/api/v1/admin/debug/ai/sessions/${sessionId}/messages`,
            {
                body: sendDebugAiMessageRequestSchema.parse({ content }),
                schema: debugAiExchangeSchema,
            },
        );
    }

    /**
     * The database export is a large JSON attachment. It bypasses the JSON
     * request path so the browser receives a streamed Blob.
     */
    async databaseExport(): Promise<{ blob: Blob; fileName: string }> {
        const response = await fetch(this.client.buildUrl("/api/v1/admin/database/export"), {
            method: "GET",
            credentials: "include",
            headers: { Accept: "application/json" },
        });
        if (!response.ok) {
            throw new Error(`The database export could not be generated (${response.status}).`);
        }
        const disposition = response.headers.get("content-disposition") ?? "";
        const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "nethack-export.json";
        return { blob: await response.blob(), fileName };
    }

    /**
     * Standings are downloaded as a binary attachment, so this bypasses the JSON
     * request path while keeping cookie credentials and the organization header.
     */
    async standingsCsv(
        organizationId: string,
        editionId: string,
    ): Promise<{ blob: Blob; fileName: string }> {
        const response = await fetch(
            this.client.buildUrl(`/api/v1/administration/editions/${editionId}/standings.csv`),
            {
                method: "GET",
                credentials: "include",
                headers: {
                    Accept: "text/csv",
                    ...organizationHeader(organizationId),
                },
            },
        );
        if (!response.ok) {
            throw new Error(`The standings export could not be generated (${response.status}).`);
        }
        const disposition = response.headers.get("content-disposition") ?? "";
        const fileName =
            /filename="([^"]+)"/.exec(disposition)?.[1] ?? `standings-${editionId}.csv`;
        return { blob: await response.blob(), fileName };
    }
}
