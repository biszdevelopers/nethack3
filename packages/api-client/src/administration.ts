import {
    auditLogSchema,
    globalAdministratorSchema,
    grantGlobalAdministratorRequestSchema,
    listResponseSchema,
    reportSummarySchema,
    revokeGlobalAdministratorRequestSchema,
    type AuditLog,
    type GlobalAdministrator,
    type GrantGlobalAdministratorRequest,
    type ListResponse,
    type ReportSummary,
    type RevokeGlobalAdministratorRequest,
} from "@nethack/contracts";
import type { ApiClient } from "./client.js";

const administratorListSchema = listResponseSchema(globalAdministratorSchema);
const auditListSchema = listResponseSchema(auditLogSchema);

export interface AuditQuery {
    readonly cursor?: string;
    readonly limit?: number;
    readonly action?: string;
    readonly entityType?: string;
    readonly actorUserId?: string;
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

    async organizationReports(organizationId: string): Promise<ReportSummary> {
        return this.client.request("GET", `/api/v1/organizations/${organizationId}/reports`, {
            schema: reportSummarySchema,
        });
    }
}
