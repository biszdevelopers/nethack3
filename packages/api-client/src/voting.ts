import {
    ballotSchema,
    castBallotRequestSchema,
    createVotingRoundRequestSchema,
    listResponseSchema,
    voteResultSchema,
    votableSubmissionSchema,
    votingRoundSchema,
    type Ballot,
    type CastBallotRequest,
    type CreateVotingRoundRequest,
    type ListResponse,
    type VoteResult,
    type VotableSubmission,
    type VotingRound,
} from "@nethack/contracts";
import type { ApiClient } from "./client.js";

const roundListSchema = listResponseSchema(votingRoundSchema);
const resultListSchema = listResponseSchema(voteResultSchema);
const votableSubmissionListSchema = listResponseSchema(votableSubmissionSchema);

function organizationHeader(organizationId: string): Record<string, string> {
    return { "X-Nethack-Organization-Id": organizationId };
}

export class VotingApi {
    private readonly client: ApiClient;

    constructor(client: ApiClient) {
        this.client = client;
    }

    async rounds(organizationId: string, editionId: string): Promise<ListResponse<VotingRound>> {
        return this.client.request("GET", `/api/v1/competitions/${editionId}/voting-rounds`, {
            schema: roundListSchema,
            headers: organizationHeader(organizationId),
        });
    }

    async createRound(
        organizationId: string,
        editionId: string,
        input: CreateVotingRoundRequest,
    ): Promise<VotingRound> {
        return this.client.request("POST", `/api/v1/competitions/${editionId}/voting-rounds`, {
            body: createVotingRoundRequestSchema.parse(input),
            schema: votingRoundSchema,
            headers: organizationHeader(organizationId),
        });
    }

    async openRound(organizationId: string, roundId: string): Promise<VotingRound> {
        return this.client.request("POST", `/api/v1/voting-rounds/${roundId}/open`, {
            schema: votingRoundSchema,
            headers: organizationHeader(organizationId),
        });
    }

    async closeRound(organizationId: string, roundId: string): Promise<VotingRound> {
        return this.client.request("POST", `/api/v1/voting-rounds/${roundId}/close`, {
            schema: votingRoundSchema,
            headers: organizationHeader(organizationId),
        });
    }

    async publishRound(organizationId: string, roundId: string): Promise<VotingRound> {
        return this.client.request("POST", `/api/v1/voting-rounds/${roundId}/publish`, {
            schema: votingRoundSchema,
            headers: organizationHeader(organizationId),
        });
    }

    async ballot(organizationId: string, roundId: string): Promise<Ballot> {
        return this.client.request("GET", `/api/v1/voting-rounds/${roundId}/ballot`, {
            schema: ballotSchema,
            headers: organizationHeader(organizationId),
        });
    }

    async castBallot(
        organizationId: string,
        roundId: string,
        input: CastBallotRequest,
    ): Promise<Ballot> {
        return this.client.request("POST", `/api/v1/voting-rounds/${roundId}/ballot`, {
            body: castBallotRequestSchema.parse(input),
            schema: ballotSchema,
            headers: organizationHeader(organizationId),
        });
    }

    async votableSubmissions(
        organizationId: string,
        editionId: string,
    ): Promise<ListResponse<VotableSubmission>> {
        return this.client.request(
            "GET",
            `/api/v1/competitions/${editionId}/votable-submissions`,
            {
                schema: votableSubmissionListSchema,
                headers: organizationHeader(organizationId),
            },
        );
    }

    async results(organizationId: string, roundId: string): Promise<VoteResult> {
        return this.client.request("GET", `/api/v1/voting-rounds/${roundId}/results`, {
            schema: voteResultSchema,
            headers: organizationHeader(organizationId),
        });
    }

    async editionResults(
        organizationId: string,
        editionId: string,
    ): Promise<ListResponse<VoteResult>> {
        return this.client.request("GET", `/api/v1/competitions/${editionId}/results`, {
            schema: resultListSchema,
            headers: organizationHeader(organizationId),
        });
    }
}
