import { z } from "zod";
import {
    assignmentDetailSchema,
    assignmentHistorySchema,
    conflictDeclarationRequestSchema,
    createAssignmentRequestSchema,
    createJudgeFlagRequestSchema,
    createRubricRequestSchema,
    evaluationSchema,
    judgeAssignmentSchema,
    judgeAssignmentStatusSchema,
    judgeFlagSchema,
    judgingCoverageSchema,
    judgingHistoryItemSchema,
    judgingResultSchema,
    judgingRubricSchema,
    listResponseSchema,
    saveEvaluationRequestSchema,
} from "@nethack/contracts";
import type { CapabilityContext } from "../../../core/capability.js";
import { AuthGuard } from "../../../http/guards.js";
import type { NethackServer } from "../../../http/types.js";
import type { JudgingService } from "../application/judging-service.js";

const editionParams = z.object({ editionId: z.uuid() });
const assignmentParams = z.object({ assignmentId: z.uuid() });
const flagParams = z.object({ flagId: z.uuid() });
const assignmentQuerySchema = z.object({ status: judgeAssignmentStatusSchema.optional() });
const historyQuerySchema = z.object({ editionId: z.uuid() });

export async function registerJudgingRoutes(
    app: NethackServer,
    context: CapabilityContext,
    service: JudgingService,
): Promise<void> {
    const guard = new AuthGuard(context.config, context.auth.sessions, context.auth.bearer);

    app.get(
        "/api/v1/competitions/:editionId/rubrics",
        {
            schema: {
                params: editionParams,
                response: { 200: listResponseSchema(judgingRubricSchema) },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            const items = await service.listRubrics(
                auth,
                access.organizationId,
                request.params.editionId,
            );
            return { items: [...items], nextCursor: null };
        },
    );

    app.post(
        "/api/v1/competitions/:editionId/rubrics",
        {
            schema: {
                params: editionParams,
                body: createRubricRequestSchema,
                response: { 201: judgingRubricSchema },
            },
        },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            const rubric = await service.createRubric(
                auth,
                access.organizationId,
                request.params.editionId,
                request.body,
                request.ip,
            );
            return reply.status(201).send(rubric);
        },
    );

    app.get(
        "/api/v1/competitions/:editionId/assignments",
        {
            schema: {
                params: editionParams,
                response: { 200: listResponseSchema(judgeAssignmentSchema) },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            const items = await service.listEditionAssignments(
                auth,
                access.organizationId,
                request.params.editionId,
            );
            return { items: [...items], nextCursor: null };
        },
    );

    app.get(
        "/api/v1/competitions/:editionId/judging-results",
        {
            schema: {
                params: editionParams,
                response: { 200: listResponseSchema(judgingResultSchema) },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            const items = await service.editionResults(
                auth,
                access.organizationId,
                request.params.editionId,
            );
            return { items: [...items], nextCursor: null };
        },
    );

    app.get(
        "/api/v1/competitions/:editionId/judging-coverage",
        {
            schema: {
                params: editionParams,
                response: { 200: judgingCoverageSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            return service.judgingCoverage(auth, access.organizationId, request.params.editionId);
        },
    );

    app.get(
        "/api/v1/competitions/:editionId/judging-flags",
        {
            schema: {
                params: editionParams,
                response: { 200: listResponseSchema(judgeFlagSchema) },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            const items = await service.listEditionFlags(
                auth,
                access.organizationId,
                request.params.editionId,
            );
            return { items: [...items], nextCursor: null };
        },
    );

    app.post(
        "/api/v1/judging-flags/:flagId/resolve",
        {
            schema: {
                params: flagParams,
                response: { 200: judgeFlagSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            return service.resolveFlag(
                auth,
                access.organizationId,
                request.params.flagId,
                request.ip,
            );
        },
    );

    app.post(
        "/api/v1/competitions/:editionId/assignments",
        {
            schema: {
                params: editionParams,
                body: createAssignmentRequestSchema,
                response: { 201: judgeAssignmentSchema },
            },
        },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            const assignment = await service.createAssignment(
                auth,
                access.organizationId,
                request.params.editionId,
                request.body,
                request.ip,
            );
            return reply.status(201).send(assignment);
        },
    );

    app.get(
        "/api/v1/judging/assignments",
        {
            schema: {
                querystring: assignmentQuerySchema,
                response: { 200: listResponseSchema(judgeAssignmentSchema) },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            const items = await service.listMyAssignments(
                auth,
                access.organizationId,
                request.query.status ?? null,
            );
            return { items: [...items], nextCursor: null };
        },
    );

    app.get(
        "/api/v1/judging/history",
        {
            schema: {
                querystring: historyQuerySchema,
                response: { 200: listResponseSchema(judgingHistoryItemSchema) },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            const items = await service.judgingHistory(
                auth,
                access.organizationId,
                request.query.editionId,
            );
            return { items: [...items], nextCursor: null };
        },
    );

    app.get(
        "/api/v1/assignments/:assignmentId",
        {
            schema: {
                params: assignmentParams,
                response: { 200: assignmentDetailSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            return service.assignmentDetail(
                auth,
                access.organizationId,
                request.params.assignmentId,
            );
        },
    );

    app.post(
        "/api/v1/assignments/:assignmentId/conflict",
        {
            schema: {
                params: assignmentParams,
                body: conflictDeclarationRequestSchema,
            },
        },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            await service.declareConflict(
                auth,
                access.organizationId,
                request.params.assignmentId,
                request.body.note,
                request.ip,
            );
            return reply.status(204).send();
        },
    );

    app.post(
        "/api/v1/assignments/:assignmentId/flag",
        {
            schema: {
                params: assignmentParams,
                body: createJudgeFlagRequestSchema,
                response: { 201: judgeFlagSchema },
            },
        },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            const flag = await service.reportFlag(
                auth,
                access.organizationId,
                request.params.assignmentId,
                request.body.reason,
                request.ip,
            );
            return reply.status(201).send(flag);
        },
    );

    app.put(
        "/api/v1/assignments/:assignmentId/evaluation",
        {
            schema: {
                params: assignmentParams,
                body: saveEvaluationRequestSchema,
                response: { 200: evaluationSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            return service.saveEvaluation(
                auth,
                access.organizationId,
                request.params.assignmentId,
                request.body,
            );
        },
    );

    app.post(
        "/api/v1/assignments/:assignmentId/evaluation/submit",
        {
            schema: {
                params: assignmentParams,
                response: { 200: evaluationSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            return service.submitEvaluation(
                auth,
                access.organizationId,
                request.params.assignmentId,
                request.ip,
            );
        },
    );

    app.get(
        "/api/v1/assignments/:assignmentId/history",
        {
            schema: {
                params: assignmentParams,
                response: { 200: assignmentHistorySchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            return service.evaluationHistory(
                auth,
                access.organizationId,
                request.params.assignmentId,
            );
        },
    );

    app.post(
        "/api/v1/assignments/:assignmentId/revoke",
        {
            schema: { params: assignmentParams },
        },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            await service.revokeAssignment(
                auth,
                access.organizationId,
                request.params.assignmentId,
                request.ip,
            );
            return reply.status(204).send();
        },
    );
}
