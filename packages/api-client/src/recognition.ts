import {
    assignAwardRequestSchema,
    awardCatalogSchema,
    awardSchema,
    createAwardRequestSchema,
    myResultsSchema,
    publicCertificateSchema,
    publicResultsSchema,
    resultsStatusSchema,
    teamAwardSchema,
    updateAwardRequestSchema,
    type Award,
    type AwardCatalog,
    type CreateAwardRequest,
    type MyResults,
    type PublicCertificate,
    type PublicResults,
    type ResultsStatus,
    type TeamAward,
    type UpdateAwardRequest,
} from "@nethack/contracts";
import type { ApiClient } from "./client.js";

function organizationHeader(organizationId: string): Record<string, string> {
    return { "X-Nethack-Organization-Id": organizationId };
}

export class RecognitionApi {
    private readonly client: ApiClient;

    constructor(client: ApiClient) {
        this.client = client;
    }

    async catalog(organizationId: string, editionId: string): Promise<AwardCatalog> {
        return this.client.request("GET", `/api/v1/competitions/${editionId}/awards`, {
            schema: awardCatalogSchema,
            headers: organizationHeader(organizationId),
        });
    }

    async createAward(
        organizationId: string,
        editionId: string,
        input: CreateAwardRequest,
    ): Promise<Award> {
        return this.client.request("POST", `/api/v1/competitions/${editionId}/awards`, {
            body: createAwardRequestSchema.parse(input),
            schema: awardSchema,
            headers: organizationHeader(organizationId),
        });
    }

    async updateAward(
        organizationId: string,
        editionId: string,
        awardId: string,
        input: UpdateAwardRequest,
    ): Promise<Award> {
        return this.client.request("PATCH", `/api/v1/competitions/${editionId}/awards/${awardId}`, {
            body: updateAwardRequestSchema.parse(input),
            schema: awardSchema,
            headers: organizationHeader(organizationId),
        });
    }

    async deleteAward(organizationId: string, editionId: string, awardId: string): Promise<void> {
        await this.client.request("DELETE", `/api/v1/competitions/${editionId}/awards/${awardId}`, {
            headers: organizationHeader(organizationId),
        });
    }

    async assignAward(
        organizationId: string,
        editionId: string,
        teamId: string,
        awardId: string,
        note: string,
    ): Promise<TeamAward> {
        return this.client.request(
            "POST",
            `/api/v1/competitions/${editionId}/teams/${teamId}/awards/${awardId}`,
            {
                body: assignAwardRequestSchema.parse({ note }),
                schema: teamAwardSchema,
                headers: organizationHeader(organizationId),
            },
        );
    }

    async unassignAward(
        organizationId: string,
        editionId: string,
        teamId: string,
        awardId: string,
    ): Promise<void> {
        await this.client.request(
            "DELETE",
            `/api/v1/competitions/${editionId}/teams/${teamId}/awards/${awardId}`,
            { headers: organizationHeader(organizationId) },
        );
    }

    async resultsStatus(organizationId: string, editionId: string): Promise<ResultsStatus> {
        return this.client.request("GET", `/api/v1/competitions/${editionId}/results-status`, {
            schema: resultsStatusSchema,
            headers: organizationHeader(organizationId),
        });
    }

    async publishResults(organizationId: string, editionId: string): Promise<PublicResults> {
        return this.client.request("POST", `/api/v1/competitions/${editionId}/results/publish`, {
            schema: publicResultsSchema,
            headers: organizationHeader(organizationId),
        });
    }

    async unpublishResults(organizationId: string, editionId: string): Promise<void> {
        await this.client.request("DELETE", `/api/v1/competitions/${editionId}/results/publish`, {
            headers: organizationHeader(organizationId),
        });
    }

    async myResults(organizationId: string, editionId: string): Promise<MyResults> {
        return this.client.request("GET", `/api/v1/competitions/${editionId}/my-results`, {
            schema: myResultsSchema,
            headers: organizationHeader(organizationId),
        });
    }

    async publicResults(slug: string): Promise<PublicResults> {
        return this.client.request(
            "GET",
            `/api/v1/public/competitions/${encodeURIComponent(slug)}/results`,
            { schema: publicResultsSchema },
        );
    }

    async publicCertificate(teamId: string): Promise<PublicCertificate> {
        return this.client.request(
            "GET",
            `/api/v1/public/certificates/${encodeURIComponent(teamId)}`,
            { schema: publicCertificateSchema },
        );
    }
}
