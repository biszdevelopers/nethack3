import {
    assignmentDetailSchema,
    assignmentHistorySchema,
    conflictDeclarationRequestSchema,
    createAssignmentRequestSchema,
    createRubricRequestSchema,
    evaluationSchema,
    judgeAssignmentSchema,
    judgingResultSchema,
    judgingRubricSchema,
    listResponseSchema,
    saveEvaluationRequestSchema,
    type AssignmentDetail,
    type AssignmentHistory,
    type ConflictDeclarationRequest,
    type CreateAssignmentRequest,
    type CreateRubricRequest,
    type Evaluation,
    type JudgeAssignment,
    type JudgeAssignmentStatus,
    type JudgingResult,
    type JudgingRubric,
    type ListResponse,
    type SaveEvaluationRequest,
} from "@nethack/contracts";
import type { ApiClient } from "./client.js";

const rubricListSchema = listResponseSchema(judgingRubricSchema);
const assignmentListSchema = listResponseSchema(judgeAssignmentSchema);
const resultListSchema = listResponseSchema(judgingResultSchema);

function organizationHeader(organizationId: string): Record<string, string> {
    return { "X-Nethack-Organization-Id": organizationId };
}

export class JudgingApi {
    private readonly client: ApiClient;

    constructor(client: ApiClient) {
        this.client = client;
    }

    async rubrics(organizationId: string, editionId: string): Promise<ListResponse<JudgingRubric>> {
        return this.client.request("GET", `/api/v1/competitions/${editionId}/rubrics`, {
            schema: rubricListSchema,
            headers: organizationHeader(organizationId),
        });
    }

    async createRubric(
        organizationId: string,
        editionId: string,
        input: CreateRubricRequest,
    ): Promise<JudgingRubric> {
        return this.client.request("POST", `/api/v1/competitions/${editionId}/rubrics`, {
            body: createRubricRequestSchema.parse(input),
            schema: judgingRubricSchema,
            headers: organizationHeader(organizationId),
        });
    }

    async assignments(
        organizationId: string,
        editionId: string,
    ): Promise<ListResponse<JudgeAssignment>> {
        return this.client.request("GET", `/api/v1/competitions/${editionId}/assignments`, {
            schema: assignmentListSchema,
            headers: organizationHeader(organizationId),
        });
    }

    async results(organizationId: string, editionId: string): Promise<ListResponse<JudgingResult>> {
        return this.client.request("GET", `/api/v1/competitions/${editionId}/judging-results`, {
            schema: resultListSchema,
            headers: organizationHeader(organizationId),
        });
    }

    async createAssignment(
        organizationId: string,
        editionId: string,
        input: CreateAssignmentRequest,
    ): Promise<JudgeAssignment> {
        return this.client.request("POST", `/api/v1/competitions/${editionId}/assignments`, {
            body: createAssignmentRequestSchema.parse(input),
            schema: judgeAssignmentSchema,
            headers: organizationHeader(organizationId),
        });
    }

    async myAssignments(
        organizationId: string,
        status?: JudgeAssignmentStatus,
    ): Promise<ListResponse<JudgeAssignment>> {
        return this.client.request("GET", "/api/v1/judging/assignments", {
            query: { status },
            schema: assignmentListSchema,
            headers: organizationHeader(organizationId),
        });
    }

    async assignment(organizationId: string, assignmentId: string): Promise<AssignmentDetail> {
        return this.client.request("GET", `/api/v1/assignments/${assignmentId}`, {
            schema: assignmentDetailSchema,
            headers: organizationHeader(organizationId),
        });
    }

    async declareConflict(
        organizationId: string,
        assignmentId: string,
        input: ConflictDeclarationRequest,
    ): Promise<void> {
        await this.client.request("POST", `/api/v1/assignments/${assignmentId}/conflict`, {
            body: conflictDeclarationRequestSchema.parse(input),
            headers: organizationHeader(organizationId),
        });
    }

    async saveEvaluation(
        organizationId: string,
        assignmentId: string,
        input: SaveEvaluationRequest,
    ): Promise<Evaluation> {
        return this.client.request("PUT", `/api/v1/assignments/${assignmentId}/evaluation`, {
            body: saveEvaluationRequestSchema.parse(input),
            schema: evaluationSchema,
            headers: organizationHeader(organizationId),
        });
    }

    async submitEvaluation(organizationId: string, assignmentId: string): Promise<Evaluation> {
        return this.client.request(
            "POST",
            `/api/v1/assignments/${assignmentId}/evaluation/submit`,
            { schema: evaluationSchema, headers: organizationHeader(organizationId) },
        );
    }

    async history(organizationId: string, assignmentId: string): Promise<AssignmentHistory> {
        return this.client.request("GET", `/api/v1/assignments/${assignmentId}/history`, {
            schema: assignmentHistorySchema,
            headers: organizationHeader(organizationId),
        });
    }

    async revoke(organizationId: string, assignmentId: string): Promise<void> {
        await this.client.request("POST", `/api/v1/assignments/${assignmentId}/revoke`, {
            headers: organizationHeader(organizationId),
        });
    }
}
