import {
    createSubmissionRequestSchema,
    createSubmissionVersionRequestSchema,
    listResponseSchema,
    reviewSubmissionRequestSchema,
    submissionDetailSchema,
    submissionSchema,
    submissionVersionSchema,
    type CreateSubmissionRequest,
    type CreateSubmissionVersionRequest,
    type ListResponse,
    type ReviewSubmissionRequest,
    type Submission,
    type SubmissionDetail,
    type SubmissionVersion,
} from "@nethack/contracts";
import type { ApiClient } from "./client.js";

export interface SubmissionListQuery {
    readonly editionId?: string;
    readonly projectId?: string;
    readonly mine?: boolean;
    readonly cursor?: string;
    readonly limit?: number;
}

export interface SubmissionPageQuery {
    readonly cursor?: string;
    readonly limit?: number;
}

const submissionListSchema = listResponseSchema(submissionSchema);
const submissionVersionListSchema = listResponseSchema(submissionVersionSchema);

export class SubmissionsApi {
    private readonly client: ApiClient;

    constructor(client: ApiClient) {
        this.client = client;
    }

    async list(query: SubmissionListQuery = {}): Promise<ListResponse<Submission>> {
        return this.client.request("GET", "/api/v1/submissions", {
            query: {
                editionId: query.editionId,
                projectId: query.projectId,
                mine: query.mine,
                cursor: query.cursor,
                limit: query.limit,
            },
            schema: submissionListSchema,
        });
    }

    async create(input: CreateSubmissionRequest): Promise<Submission> {
        return this.client.request("POST", "/api/v1/submissions", {
            body: createSubmissionRequestSchema.parse(input),
            schema: submissionSchema,
        });
    }

    async get(submissionId: string): Promise<SubmissionDetail> {
        return this.client.request("GET", `/api/v1/submissions/${submissionId}`, {
            schema: submissionDetailSchema,
        });
    }

    async versions(submissionId: string): Promise<ListResponse<SubmissionVersion>> {
        return this.client.request("GET", `/api/v1/submissions/${submissionId}/versions`, {
            schema: submissionVersionListSchema,
        });
    }

    async createVersion(
        submissionId: string,
        input: CreateSubmissionVersionRequest,
    ): Promise<SubmissionDetail> {
        return this.client.request("POST", `/api/v1/submissions/${submissionId}/versions`, {
            body: createSubmissionVersionRequestSchema.parse(input),
            schema: submissionDetailSchema,
        });
    }

    async review(submissionId: string, input: ReviewSubmissionRequest): Promise<SubmissionDetail> {
        return this.client.request("POST", `/api/v1/submissions/${submissionId}/review`, {
            body: reviewSubmissionRequestSchema.parse(input),
            schema: submissionDetailSchema,
        });
    }

    async listForEdition(
        editionId: string,
        query: SubmissionPageQuery = {},
    ): Promise<ListResponse<Submission>> {
        return this.client.request("GET", `/api/v1/competitions/${editionId}/submissions`, {
            query: { cursor: query.cursor, limit: query.limit },
            schema: submissionListSchema,
        });
    }

    async withdraw(submissionId: string): Promise<SubmissionDetail> {
        return this.client.request("POST", `/api/v1/submissions/${submissionId}/withdraw`, {
            schema: submissionDetailSchema,
        });
    }
}
