import {
    acceptOrganizationInvitationRequestSchema,
    acceptOrganizationInvitationResultSchema,
    addOrganizationMemberRequestSchema,
    addOrganizationMemberResultSchema,
    auditLogSchema,
    createOrganizationRequestSchema,
    listResponseSchema,
    organizationInvitationSchema,
    organizationMembershipSchema,
    organizationSchema,
    organizationSettingsSchema,
    updateOrganizationMemberRequestSchema,
    updateOrganizationRequestSchema,
    updateOrganizationSettingsRequestSchema,
    type AcceptOrganizationInvitationResult,
    type AddOrganizationMemberRequest,
    type AddOrganizationMemberResult,
    type AuditLog,
    type CreateOrganizationRequest,
    type ListResponse,
    type Organization,
    type OrganizationInvitation,
    type OrganizationMembership,
    type OrganizationSettings,
    type UpdateOrganizationMemberRequest,
    type UpdateOrganizationRequest,
    type UpdateOrganizationSettingsRequest,
} from "@nethack/contracts";
import type { ApiClient } from "./client.js";

const organizationListSchema = listResponseSchema(organizationSchema);
const membershipListSchema = listResponseSchema(organizationMembershipSchema);
const invitationListSchema = listResponseSchema(organizationInvitationSchema);
const auditListSchema = listResponseSchema(auditLogSchema);

export class OrganizationsApi {
    private readonly client: ApiClient;

    constructor(client: ApiClient) {
        this.client = client;
    }

    async list(): Promise<ListResponse<Organization>> {
        return this.client.request("GET", "/api/v1/organizations", {
            schema: organizationListSchema,
        });
    }

    async create(input: CreateOrganizationRequest): Promise<Organization> {
        return this.client.request("POST", "/api/v1/organizations", {
            body: createOrganizationRequestSchema.parse(input),
            schema: organizationSchema,
        });
    }

    async get(organizationId: string): Promise<Organization> {
        return this.client.request("GET", `/api/v1/organizations/${organizationId}`, {
            schema: organizationSchema,
        });
    }

    async update(organizationId: string, input: UpdateOrganizationRequest): Promise<Organization> {
        return this.client.request("PATCH", `/api/v1/organizations/${organizationId}`, {
            body: updateOrganizationRequestSchema.parse(input),
            schema: organizationSchema,
        });
    }

    async members(organizationId: string): Promise<ListResponse<OrganizationMembership>> {
        return this.client.request("GET", `/api/v1/organizations/${organizationId}/members`, {
            schema: membershipListSchema,
        });
    }

    async addMember(
        organizationId: string,
        input: AddOrganizationMemberRequest,
    ): Promise<AddOrganizationMemberResult> {
        return this.client.request("POST", `/api/v1/organizations/${organizationId}/members`, {
            body: addOrganizationMemberRequestSchema.parse(input),
            schema: addOrganizationMemberResultSchema,
        });
    }

    async updateMember(
        organizationId: string,
        userId: string,
        input: UpdateOrganizationMemberRequest,
    ): Promise<void> {
        await this.client.request(
            "PATCH",
            `/api/v1/organizations/${organizationId}/members/${userId}`,
            { body: updateOrganizationMemberRequestSchema.parse(input) },
        );
    }

    async removeMember(organizationId: string, userId: string): Promise<void> {
        await this.client.request(
            "DELETE",
            `/api/v1/organizations/${organizationId}/members/${userId}`,
        );
    }

    async invitations(organizationId: string): Promise<ListResponse<OrganizationInvitation>> {
        return this.client.request(
            "GET",
            `/api/v1/organizations/${organizationId}/invitations`,
            { schema: invitationListSchema },
        );
    }

    async acceptInvitation(token: string): Promise<AcceptOrganizationInvitationResult> {
        return this.client.request("POST", "/api/v1/organization-invitations/accept", {
            body: acceptOrganizationInvitationRequestSchema.parse({ token }),
            schema: acceptOrganizationInvitationResultSchema,
        });
    }

    async settings(organizationId: string): Promise<OrganizationSettings> {
        return this.client.request("GET", `/api/v1/organizations/${organizationId}/settings`, {
            schema: organizationSettingsSchema,
        });
    }

    async updateSettings(
        organizationId: string,
        input: UpdateOrganizationSettingsRequest,
    ): Promise<OrganizationSettings> {
        return this.client.request("PATCH", `/api/v1/organizations/${organizationId}/settings`, {
            body: updateOrganizationSettingsRequestSchema.parse(input),
            schema: organizationSettingsSchema,
        });
    }

    async audit(
        organizationId: string,
        query: { cursor?: string; limit?: number; action?: string; entityType?: string } = {},
    ): Promise<ListResponse<AuditLog>> {
        return this.client.request("GET", `/api/v1/organizations/${organizationId}/audit`, {
            query: {
                cursor: query.cursor,
                limit: query.limit,
                action: query.action,
                entityType: query.entityType,
            },
            schema: auditListSchema,
        });
    }
}
