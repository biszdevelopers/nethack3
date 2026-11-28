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
    publicCompetitionDetailSchema,
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
    type PublicCompetitionDetail,
    type UpdateEditionApprovalRequest,
    type UpdateEditionRequest,
} from "@nethack/contracts";
import type { ApiClient } from "./client.js";

export interface PageQuery {
    readonly cursor?: string;
    readonly limit?: number;
}

export interface PublicCompetitionQuery extends PageQuery {}

const seriesListSchema = listResponseSchema(competitionSeriesSchema);
const divisionListSchema = listResponseSchema(divisionSchema);
const milestoneListSchema = listResponseSchema(milestoneSchema);
const organizerEditionListSchema = listResponseSchema(organizerEditionSchema);
const publicCompetitionListSchema = listResponseSchema(publicCompetitionSchema);

export class CompetitionsApi {
    private readonly client: ApiClient;

    constructor(client: ApiClient) {
        this.client = client;
    }

    async listSeries(organizationId: string): Promise<ListResponse<CompetitionSeries>> {
        return this.client.request("GET", `/api/v1/organizations/${organizationId}/competitions`, {
            schema: seriesListSchema,
        });
    }

    async createSeries(
        organizationId: string,
        input: CreateSeriesRequest,
    ): Promise<CompetitionSeries> {
        return this.client.request("POST", `/api/v1/organizations/${organizationId}/competitions`, {
            body: createSeriesRequestSchema.parse(input),
            schema: competitionSeriesSchema,
        });
    }

    async createEdition(
        organizationId: string,
        seriesId: string,
        input: CreateEditionRequest,
    ): Promise<CompetitionEdition> {
        return this.client.request(
            "POST",
            `/api/v1/organizations/${organizationId}/competitions/${seriesId}/editions`,
            {
                body: createEditionRequestSchema.parse(input),
                schema: competitionEditionSchema,
            },
        );
    }

    async listEditions(
        organizationId: string,
        query: { readonly seriesId?: string; readonly limit?: number } = {},
    ): Promise<ListResponse<OrganizerEdition>> {
        return this.client.request("GET", `/api/v1/organizations/${organizationId}/editions`, {
            query: { seriesId: query.seriesId, limit: query.limit ?? 100 },
            schema: organizerEditionListSchema,
        });
    }

    async get(editionId: string): Promise<CompetitionEditionDetail> {
        return this.client.request("GET", `/api/v1/competitions/${editionId}`, {
            schema: competitionEditionDetailSchema,
        });
    }

    async update(editionId: string, input: UpdateEditionRequest): Promise<CompetitionEdition> {
        return this.client.request("PATCH", `/api/v1/competitions/${editionId}`, {
            body: updateEditionRequestSchema.parse(input),
            schema: competitionEditionSchema,
        });
    }

    async setApproval(
        editionId: string,
        input: UpdateEditionApprovalRequest,
    ): Promise<CompetitionEdition> {
        return this.client.request("PATCH", `/api/v1/competitions/${editionId}/approval`, {
            body: updateEditionApprovalRequestSchema.parse(input),
            schema: competitionEditionSchema,
        });
    }

    async publish(editionId: string): Promise<CompetitionEdition> {
        return this.client.request("POST", `/api/v1/competitions/${editionId}/publish`, {
            schema: competitionEditionSchema,
        });
    }

    async lifecycle(
        editionId: string,
        input: EditionLifecycleRequest,
    ): Promise<CompetitionEdition> {
        return this.client.request("POST", `/api/v1/competitions/${editionId}/lifecycle`, {
            body: editionLifecycleRequestSchema.parse(input),
            schema: competitionEditionSchema,
        });
    }

    async divisions(editionId: string): Promise<ListResponse<Division>> {
        return this.client.request("GET", `/api/v1/competitions/${editionId}/divisions`, {
            schema: divisionListSchema,
        });
    }

    async createDivision(editionId: string, input: CreateDivisionRequest): Promise<Division> {
        return this.client.request("POST", `/api/v1/competitions/${editionId}/divisions`, {
            body: createDivisionRequestSchema.parse(input),
            schema: divisionSchema,
        });
    }

    async milestones(editionId: string): Promise<ListResponse<Milestone>> {
        return this.client.request("GET", `/api/v1/competitions/${editionId}/milestones`, {
            schema: milestoneListSchema,
        });
    }

    async createMilestone(editionId: string, input: CreateMilestoneRequest): Promise<Milestone> {
        return this.client.request("POST", `/api/v1/competitions/${editionId}/milestones`, {
            body: createMilestoneRequestSchema.parse(input),
            schema: milestoneSchema,
        });
    }

    async publicList(query: PublicCompetitionQuery = {}): Promise<ListResponse<PublicCompetition>> {
        return this.client.request("GET", "/api/v1/public/competitions", {
            query: { cursor: query.cursor, limit: query.limit },
            schema: publicCompetitionListSchema,
        });
    }

    async publicDetail(slug: string): Promise<PublicCompetitionDetail> {
        return this.client.request("GET", `/api/v1/public/competitions/${slug}`, {
            schema: publicCompetitionDetailSchema,
        });
    }
}
