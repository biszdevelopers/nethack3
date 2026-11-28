import {
    competitionEditionDetailSchema,
    competitionEditionSchema,
    competitionSeriesSchema,
    createDivisionRequestSchema,
    createEditionRequestSchema,
    createMilestoneRequestSchema,
    createSeriesRequestSchema,
    divisionSchema,
    editionLifecycleRequestSchema,
    listResponseSchema,
    milestoneSchema,
    organizerEditionSchema,
    publicCompetitionSchema,
    updateEditionApprovalRequestSchema,
    updateEditionRequestSchema,
    type CompetitionEdition,
    type CompetitionEditionDetail,
    type CompetitionSeries,
    type CreateDivisionRequest,
    type CreateEditionRequest,
    type CreateMilestoneRequest,
    type CreateSeriesRequest,
    type Division,
    type EditionLifecycleRequest,
    type ListResponse,
    type Milestone,
    type OrganizerEdition,
    type PublicCompetition,
    type UpdateEditionApprovalRequest,
    type UpdateEditionRequest,
} from "@nethack/contracts";
import { apiClient } from "../../application/api.js";

const seriesListSchema = listResponseSchema(competitionSeriesSchema);
const divisionListSchema = listResponseSchema(divisionSchema);
const milestoneListSchema = listResponseSchema(milestoneSchema);
const organizerEditionListSchema = listResponseSchema(organizerEditionSchema);
const publicCompetitionListSchema = listResponseSchema(publicCompetitionSchema);

function organizationHeader(organizationId: string): Record<string, string> {
    return { "X-Nethack-Organization-Id": organizationId };
}

export const competitionsApi = {
    async series(organizationId: string): Promise<ListResponse<CompetitionSeries>> {
        return apiClient.request("GET", `/api/v1/organizations/${organizationId}/competitions`, {
            schema: seriesListSchema,
            headers: organizationHeader(organizationId),
        });
    },

    async createSeries(
        organizationId: string,
        input: CreateSeriesRequest,
    ): Promise<CompetitionSeries> {
        return apiClient.request("POST", `/api/v1/organizations/${organizationId}/competitions`, {
            body: createSeriesRequestSchema.parse(input),
            schema: competitionSeriesSchema,
            headers: organizationHeader(organizationId),
        });
    },

    async createEdition(
        organizationId: string,
        seriesId: string,
        input: CreateEditionRequest,
    ): Promise<CompetitionEdition> {
        return apiClient.request(
            "POST",
            `/api/v1/organizations/${organizationId}/competitions/${seriesId}/editions`,
            {
                body: createEditionRequestSchema.parse(input),
                schema: competitionEditionSchema,
                headers: organizationHeader(organizationId),
            },
        );
    },

    async listEditions(
        organizationId: string,
        seriesId: string | null,
    ): Promise<ListResponse<OrganizerEdition>> {
        return apiClient.request("GET", `/api/v1/organizations/${organizationId}/editions`, {
            query: { seriesId: seriesId ?? undefined, limit: 100 },
            schema: organizerEditionListSchema,
            headers: organizationHeader(organizationId),
        });
    },

    async edition(organizationId: string, editionId: string): Promise<CompetitionEditionDetail> {
        return apiClient.request("GET", `/api/v1/competitions/${editionId}`, {
            schema: competitionEditionDetailSchema,
            headers: organizationHeader(organizationId),
        });
    },

    async updateEdition(
        organizationId: string,
        editionId: string,
        input: UpdateEditionRequest,
    ): Promise<CompetitionEdition> {
        return apiClient.request("PATCH", `/api/v1/competitions/${editionId}`, {
            body: updateEditionRequestSchema.parse(input),
            schema: competitionEditionSchema,
            headers: organizationHeader(organizationId),
        });
    },

    async setEditionApproval(
        organizationId: string,
        editionId: string,
        input: UpdateEditionApprovalRequest,
    ): Promise<CompetitionEdition> {
        return apiClient.request("PATCH", `/api/v1/competitions/${editionId}/approval`, {
            body: updateEditionApprovalRequestSchema.parse(input),
            schema: competitionEditionSchema,
            headers: organizationHeader(organizationId),
        });
    },

    async publishEdition(organizationId: string, editionId: string): Promise<CompetitionEdition> {
        return apiClient.request("POST", `/api/v1/competitions/${editionId}/publish`, {
            schema: competitionEditionSchema,
            headers: organizationHeader(organizationId),
        });
    },

    async lifecycleEdition(
        organizationId: string,
        editionId: string,
        input: EditionLifecycleRequest,
    ): Promise<CompetitionEdition> {
        return apiClient.request("POST", `/api/v1/competitions/${editionId}/lifecycle`, {
            body: editionLifecycleRequestSchema.parse(input),
            schema: competitionEditionSchema,
            headers: organizationHeader(organizationId),
        });
    },

    async divisions(organizationId: string, editionId: string): Promise<ListResponse<Division>> {
        return apiClient.request("GET", `/api/v1/competitions/${editionId}/divisions`, {
            schema: divisionListSchema,
            headers: organizationHeader(organizationId),
        });
    },

    async createDivision(
        organizationId: string,
        editionId: string,
        input: CreateDivisionRequest,
    ): Promise<Division> {
        return apiClient.request("POST", `/api/v1/competitions/${editionId}/divisions`, {
            body: createDivisionRequestSchema.parse(input),
            schema: divisionSchema,
            headers: organizationHeader(organizationId),
        });
    },

    async milestones(organizationId: string, editionId: string): Promise<ListResponse<Milestone>> {
        return apiClient.request("GET", `/api/v1/competitions/${editionId}/milestones`, {
            schema: milestoneListSchema,
            headers: organizationHeader(organizationId),
        });
    },

    async createMilestone(
        organizationId: string,
        editionId: string,
        input: CreateMilestoneRequest,
    ): Promise<Milestone> {
        return apiClient.request("POST", `/api/v1/competitions/${editionId}/milestones`, {
            body: createMilestoneRequestSchema.parse(input),
            schema: milestoneSchema,
            headers: organizationHeader(organizationId),
        });
    },

    async publicCompetitions(): Promise<ListResponse<PublicCompetition>> {
        return apiClient.request("GET", "/api/v1/public/competitions", {
            query: { limit: 50 },
            schema: publicCompetitionListSchema,
        });
    },
};
