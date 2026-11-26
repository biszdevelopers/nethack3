import {
    competitionEditionDetailSchema,
    competitionEditionSchema,
    competitionSeriesSchema,
    createDivisionRequestSchema,
    createEditionRequestSchema,
    createMilestoneRequestSchema,
    createSeriesRequestSchema,
    divisionSchema,
    listResponseSchema,
    milestoneSchema,
    publicCompetitionDetailSchema,
    publicCompetitionSchema,
    updateEditionRequestSchema,
    type CompetitionEdition,
    type CompetitionEditionDetail,
    type CompetitionSeries,
    type CreateDivisionRequest,
    type CreateEditionRequest,
    type CreateMilestoneRequest,
    type CreateSeriesRequest,
    type Division,
    type ListResponse,
    type Milestone,
    type PublicCompetition,
    type PublicCompetitionDetail,
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

    async publish(editionId: string): Promise<CompetitionEdition> {
        return this.client.request("POST", `/api/v1/competitions/${editionId}/publish`, {
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
