import {
    applyRubricTemplateRequestSchema,
    assignmentDetailSchema,
    assignmentHistorySchema,
    bulkAssignmentResultSchema,
    conflictDeclarationRequestSchema,
    createAssignmentRequestSchema,
    createBulkAssignmentRequestSchema,
    createJudgeFlagRequestSchema,
    createRubricRequestSchema,
    copyRubricRequestSchema,
    createRubricTemplateRequestSchema,
    evaluationSchema,
    judgeAssignmentSchema,
    judgeFlagSchema,
    judgingCoverageSchema,
    judgingHistoryItemSchema,
    judgingResultSchema,
    judgingRubricSchema,
    listResponseSchema,
    rubricTemplateSchema,
    saveEvaluationRequestSchema,
    scoreCurveResponseSchema,
    scoreCurveSchema,
    teamFeedbackResponseSchema,
    updateRubricRequestSchema,
    updateRubricTemplateRequestSchema,
    type ApplyRubricTemplateRequest,
    type AssignmentDetail,
    type AssignmentHistory,
    type BulkAssignmentResult,
    type ConflictDeclarationRequest,
    type CreateAssignmentRequest,
    type CreateBulkAssignmentRequest,
    type CreateJudgeFlagRequest,
    type CreateRubricRequest,
    type CreateRubricTemplateRequest,
    type Evaluation,
    type JudgeAssignment,
    type JudgeAssignmentStatus,
    type JudgeFlag,
    type JudgingCoverage,
    type JudgingHistoryItem,
    type JudgingResult,
    type JudgingRubric,
    type ListResponse,
    type RubricTemplate,
    type SaveEvaluationRequest,
    type ScoreCurve,
    type ScoreCurveResponse,
    type TeamFeedbackResponse,
    type UpdateRubricRequest,
    type UpdateRubricTemplateRequest,
} from "@nethack/contracts";
import type { ApiClient } from "./client.js";

const rubricListSchema = listResponseSchema(judgingRubricSchema);
const assignmentListSchema = listResponseSchema(judgeAssignmentSchema);
const resultListSchema = listResponseSchema(judgingResultSchema);
const flagListSchema = listResponseSchema(judgeFlagSchema);
const historyListSchema = listResponseSchema(judgingHistoryItemSchema);
const templateListSchema = listResponseSchema(rubricTemplateSchema);

function organizationHeader(organizationId: string): Record<string, string> {
    return { "X-Nethack-Organization-Id": organizationId };
}

export class JudgingApi {
    private readonly client: ApiClient;

    constructor(client: ApiClient) {
        this.client = client;
    }

    async rubrics(
        organizationId: string,
        editionId: string,
        includeInactive = false,
    ): Promise<ListResponse<JudgingRubric>> {
        const path = `/api/v1/competitions/${editionId}/rubrics`;
        const headers = organizationHeader(organizationId);
        return includeInactive
            ? this.client.request("GET", path, {
                  query: { includeInactive: "true" },
                  schema: rubricListSchema,
                  headers,
              })
            : this.client.request("GET", path, { schema: rubricListSchema, headers });
    }

    async rubric(
        organizationId: string,
        editionId: string,
        rubricId: string,
    ): Promise<JudgingRubric> {
        return this.client.request("GET", `/api/v1/competitions/${editionId}/rubrics/${rubricId}`, {
            schema: judgingRubricSchema,
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

    async copyRubric(
        organizationId: string,
        editionId: string,
        input: { readonly sourceEditionId: string },
    ): Promise<readonly JudgingRubric[]> {
        return this.client.request("POST", `/api/v1/competitions/${editionId}/rubrics/copy`, {
            body: copyRubricRequestSchema.parse(input),
            schema: judgingRubricSchema.array(),
            headers: organizationHeader(organizationId),
        });
    }

    async updateRubric(
        organizationId: string,
        editionId: string,
        rubricId: string,
        input: UpdateRubricRequest,
    ): Promise<JudgingRubric> {
        return this.client.request(
            "PATCH",
            `/api/v1/competitions/${editionId}/rubrics/${rubricId}`,
            {
                body: updateRubricRequestSchema.parse(input),
                schema: judgingRubricSchema,
                headers: organizationHeader(organizationId),
            },
        );
    }

    async publishRubric(
        organizationId: string,
        editionId: string,
        rubricId: string,
    ): Promise<JudgingRubric> {
        return this.client.request(
            "POST",
            `/api/v1/competitions/${editionId}/rubrics/${rubricId}/publish`,
            { schema: judgingRubricSchema, headers: organizationHeader(organizationId) },
        );
    }

    async archiveRubric(
        organizationId: string,
        editionId: string,
        rubricId: string,
    ): Promise<JudgingRubric> {
        return this.client.request(
            "POST",
            `/api/v1/competitions/${editionId}/rubrics/${rubricId}/archive`,
            { schema: judgingRubricSchema, headers: organizationHeader(organizationId) },
        );
    }

    async rubricTemplates(organizationId: string): Promise<ListResponse<RubricTemplate>> {
        return this.client.request(
            "GET",
            `/api/v1/organizations/${organizationId}/rubric-templates`,
            {
                schema: templateListSchema,
                headers: organizationHeader(organizationId),
            },
        );
    }

    async createRubricTemplate(
        organizationId: string,
        input: CreateRubricTemplateRequest,
    ): Promise<RubricTemplate> {
        return this.client.request(
            "POST",
            `/api/v1/organizations/${organizationId}/rubric-templates`,
            {
                body: createRubricTemplateRequestSchema.parse(input),
                schema: rubricTemplateSchema,
                headers: organizationHeader(organizationId),
            },
        );
    }

    async updateRubricTemplate(
        organizationId: string,
        templateId: string,
        input: UpdateRubricTemplateRequest,
    ): Promise<RubricTemplate> {
        return this.client.request(
            "PUT",
            `/api/v1/organizations/${organizationId}/rubric-templates/${templateId}`,
            {
                body: updateRubricTemplateRequestSchema.parse(input),
                schema: rubricTemplateSchema,
                headers: organizationHeader(organizationId),
            },
        );
    }

    async deleteRubricTemplate(organizationId: string, templateId: string): Promise<void> {
        await this.client.request(
            "DELETE",
            `/api/v1/organizations/${organizationId}/rubric-templates/${templateId}`,
            { headers: organizationHeader(organizationId) },
        );
    }

    async applyRubricTemplate(
        organizationId: string,
        editionId: string,
        templateId: string,
        input: ApplyRubricTemplateRequest,
    ): Promise<JudgingRubric> {
        return this.client.request(
            "POST",
            `/api/v1/competitions/${editionId}/rubrics/templates/${templateId}/apply`,
            {
                body: applyRubricTemplateRequestSchema.parse(input),
                schema: judgingRubricSchema,
                headers: organizationHeader(organizationId),
            },
        );
    }

    async scoreCurve(organizationId: string, editionId: string): Promise<ScoreCurveResponse> {
        return this.client.request("GET", `/api/v1/competitions/${editionId}/score-curve`, {
            schema: scoreCurveResponseSchema,
            headers: organizationHeader(organizationId),
        });
    }

    async updateScoreCurve(
        organizationId: string,
        editionId: string,
        curve: ScoreCurve,
    ): Promise<ScoreCurveResponse> {
        return this.client.request("PATCH", `/api/v1/competitions/${editionId}/score-curve`, {
            body: scoreCurveSchema.parse(curve),
            schema: scoreCurveResponseSchema,
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

    async createBulkAssignments(
        organizationId: string,
        editionId: string,
        input: CreateBulkAssignmentRequest,
    ): Promise<BulkAssignmentResult> {
        return this.client.request("POST", `/api/v1/competitions/${editionId}/assignments/bulk`, {
            body: createBulkAssignmentRequestSchema.parse(input),
            schema: bulkAssignmentResultSchema,
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

    async voidEvaluation(organizationId: string, assignmentId: string): Promise<void> {
        await this.client.request("DELETE", `/api/v1/assignments/${assignmentId}/evaluation`, {
            headers: organizationHeader(organizationId),
        });
    }

    async history(organizationId: string, assignmentId: string): Promise<AssignmentHistory> {
        return this.client.request("GET", `/api/v1/assignments/${assignmentId}/history`, {
            schema: assignmentHistorySchema,
            headers: organizationHeader(organizationId),
        });
    }

    async judgingHistory(
        organizationId: string,
        editionId: string,
    ): Promise<ListResponse<JudgingHistoryItem>> {
        return this.client.request("GET", "/api/v1/judging/history", {
            query: { editionId },
            schema: historyListSchema,
            headers: organizationHeader(organizationId),
        });
    }

    async flagAssignment(
        organizationId: string,
        assignmentId: string,
        input: CreateJudgeFlagRequest,
    ): Promise<JudgeFlag> {
        return this.client.request("POST", `/api/v1/assignments/${assignmentId}/flag`, {
            body: createJudgeFlagRequestSchema.parse(input),
            schema: judgeFlagSchema,
            headers: organizationHeader(organizationId),
        });
    }

    async flags(organizationId: string, editionId: string): Promise<ListResponse<JudgeFlag>> {
        return this.client.request("GET", `/api/v1/competitions/${editionId}/judging-flags`, {
            schema: flagListSchema,
            headers: organizationHeader(organizationId),
        });
    }

    async resolveFlag(organizationId: string, flagId: string): Promise<JudgeFlag> {
        return this.client.request("POST", `/api/v1/judging-flags/${flagId}/resolve`, {
            schema: judgeFlagSchema,
            headers: organizationHeader(organizationId),
        });
    }

    async teamFeedback(
        organizationId: string,
        editionId: string,
        teamId: string,
    ): Promise<TeamFeedbackResponse> {
        return this.client.request(
            "GET",
            `/api/v1/competitions/${editionId}/teams/${teamId}/judging-feedback`,
            {
                schema: teamFeedbackResponseSchema,
                headers: organizationHeader(organizationId),
            },
        );
    }

    async coverage(organizationId: string, editionId: string): Promise<JudgingCoverage> {
        return this.client.request("GET", `/api/v1/competitions/${editionId}/judging-coverage`, {
            schema: judgingCoverageSchema,
            headers: organizationHeader(organizationId),
        });
    }

    async revoke(organizationId: string, assignmentId: string): Promise<void> {
        await this.client.request("POST", `/api/v1/assignments/${assignmentId}/revoke`, {
            headers: organizationHeader(organizationId),
        });
    }
}
