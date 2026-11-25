import { z } from "zod";
import {
    createSubmissionRequestSchema,
    createSubmissionVersionRequestSchema,
    cursorSchema,
    idSchema,
    limitSchema,
    listResponseSchema,
    pageQuerySchema,
    reviewSubmissionRequestSchema,
    submissionDetailSchema,
    submissionSchema,
    submissionVersionSchema,
    type Submission,
    type SubmissionDetail,
} from "@nethack/contracts";
import type { CapabilityContext } from "../../../core/capability.js";
import { AuthGuard } from "../../../http/guards.js";
import { IdempotencyService } from "../../../http/idempotency.js";
import { decodeCursor, responsePage } from "../../../http/pagination.js";
import type { NethackServer } from "../../../http/types.js";
import type { SubmissionService } from "../application/submission-service.js";

const submissionParams = z.object({ submissionId: idSchema });
const editionParams = z.object({ editionId: idSchema });

const listQuerySchema = z.object({
    editionId: idSchema.optional(),
    projectId: idSchema.optional(),
    mine: z.enum(["true", "false"]).optional(),
    cursor: cursorSchema.optional(),
    limit: limitSchema.optional(),
});

export async function registerSubmissionRoutes(
    app: NethackServer,
    context: CapabilityContext,
    service: SubmissionService,
): Promise<void> {
    const guard = new AuthGuard(context.config, context.auth.sessions, context.auth.bearer);
    const idempotency = new IdempotencyService(context.database, context.clock);

    app.get(
        "/api/v1/submissions",
        {
            schema: {
                querystring: listQuerySchema,
                response: { 200: listResponseSchema(submissionSchema) },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            const cursor = decodeCursor(request.query.cursor);
            const limit = request.query.limit ?? 20;
            const items = await service.list(auth, access.organizationId, access.role, {
                editionId: request.query.editionId ?? null,
                projectId: request.query.projectId ?? null,
                mine: request.query.mine === "true",
                cursor:
                    cursor === null
                        ? null
                        : { createdAt: new Date(cursor.createdAt), id: cursor.id },
                limit: limit + 1,
            });
            return responsePage(items, limit, (item) => ({
                createdAt: new Date(item.createdAt),
                id: item.id,
            }));
        },
    );

    app.post(
        "/api/v1/submissions",
        {
            schema: {
                body: createSubmissionRequestSchema,
                response: { 201: submissionSchema },
            },
        },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            const result = await idempotency.execute<Submission>(
                request,
                auth,
                "submissions.create",
                async () => ({
                    status: 201,
                    body: await service.create(
                        auth,
                        access.organizationId,
                        access.role,
                        request.body,
                        request.ip,
                    ),
                }),
            );
            return reply.status(201).send(result.body);
        },
    );

    app.get(
        "/api/v1/submissions/:submissionId",
        {
            schema: {
                params: submissionParams,
                response: { 200: submissionDetailSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            return service.detail(
                auth,
                access.organizationId,
                access.role,
                request.params.submissionId,
            );
        },
    );

    app.post(
        "/api/v1/submissions/:submissionId/versions",
        {
            schema: {
                params: submissionParams,
                body: createSubmissionVersionRequestSchema,
                response: { 200: submissionDetailSchema },
            },
        },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            const result = await idempotency.execute<SubmissionDetail>(
                request,
                auth,
                "submissions.version",
                async () => ({
                    status: 200,
                    body: await service.createVersion(
                        auth,
                        access.organizationId,
                        access.role,
                        request.params.submissionId,
                        request.body,
                        request.ip,
                    ),
                }),
            );
            return reply.status(200).send(result.body);
        },
    );

    app.get(
        "/api/v1/submissions/:submissionId/versions",
        {
            schema: {
                params: submissionParams,
                response: { 200: listResponseSchema(submissionVersionSchema) },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            const items = await service.versions(
                auth,
                access.organizationId,
                access.role,
                request.params.submissionId,
            );
            return { items: [...items], nextCursor: null };
        },
    );

    app.post(
        "/api/v1/submissions/:submissionId/withdraw",
        {
            schema: {
                params: submissionParams,
                response: { 200: submissionDetailSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            return service.withdraw(
                auth,
                access.organizationId,
                access.role,
                request.params.submissionId,
                request.ip,
            );
        },
    );

    app.post(
        "/api/v1/submissions/:submissionId/review",
        {
            schema: {
                params: submissionParams,
                body: reviewSubmissionRequestSchema,
                response: { 200: submissionDetailSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            return service.review(
                auth,
                access.organizationId,
                request.params.submissionId,
                request.body,
                request.ip,
            );
        },
    );

    app.get(
        "/api/v1/competitions/:editionId/submissions",
        {
            schema: {
                params: editionParams,
                querystring: pageQuerySchema,
                response: { 200: listResponseSchema(submissionSchema) },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            const cursor = decodeCursor(request.query.cursor);
            const limit = request.query.limit ?? 20;
            const items = await service.listEdition(
                access.organizationId,
                request.params.editionId,
                cursor === null ? null : { createdAt: new Date(cursor.createdAt), id: cursor.id },
                limit + 1,
            );
            return responsePage(items, limit, (item) => ({
                createdAt: new Date(item.createdAt),
                id: item.id,
            }));
        },
    );
}
