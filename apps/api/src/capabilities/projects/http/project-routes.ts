import { z } from "zod";
import {
    addProjectMemberRequestSchema,
    createProjectRequestSchema,
    cursorSchema,
    idSchema,
    limitSchema,
    listResponseSchema,
    projectDetailSchema,
    projectMemberSchema,
    projectSchema,
    publicProjectSchema,
    slugSchema,
    updateProjectRequestSchema,
} from "@nethack/contracts";
import type { CapabilityContext } from "../../../core/capability.js";
import { AuthGuard } from "../../../http/guards.js";
import { decodeCursor, responsePage, setPublicCache } from "../../../http/pagination.js";
import type { NethackServer } from "../../../http/types.js";
import type { ProjectService } from "../application/project-service.js";

const projectParams = z.object({ projectId: idSchema });
const publicProjectParams = z.object({ slug: slugSchema });

const listQuerySchema = z.object({
    editionId: idSchema.optional(),
    teamId: idSchema.optional(),
    mine: z.enum(["true", "false"]).optional(),
    cursor: cursorSchema.optional(),
    limit: limitSchema.optional(),
});

const publicListQuerySchema = z.object({
    competition: slugSchema.optional(),
    cursor: cursorSchema.optional(),
    limit: limitSchema.optional(),
});

export async function registerProjectRoutes(
    app: NethackServer,
    context: CapabilityContext,
    service: ProjectService,
): Promise<void> {
    const guard = new AuthGuard(context.config, context.auth.sessions, context.auth.bearer);

    app.get(
        "/api/v1/projects",
        {
            schema: {
                querystring: listQuerySchema,
                response: { 200: listResponseSchema(projectSchema) },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            const cursor = decodeCursor(request.query.cursor);
            const limit = request.query.limit ?? 20;
            const items = await service.list(auth, access.organizationId, access.role, {
                editionId: request.query.editionId ?? null,
                teamId: request.query.teamId ?? null,
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
        "/api/v1/projects",
        {
            schema: {
                body: createProjectRequestSchema,
                response: { 201: projectSchema },
            },
        },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            const project = await service.create(
                auth,
                access.organizationId,
                access.role,
                request.body,
                request.ip,
            );
            return reply.status(201).send(project);
        },
    );

    app.get(
        "/api/v1/projects/:projectId",
        {
            schema: {
                params: projectParams,
                response: { 200: projectDetailSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            return service.detail(
                auth,
                access.organizationId,
                access.role,
                request.params.projectId,
            );
        },
    );

    app.patch(
        "/api/v1/projects/:projectId",
        {
            schema: {
                params: projectParams,
                body: updateProjectRequestSchema,
                response: { 200: projectSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            return service.update(
                auth,
                access.organizationId,
                access.role,
                request.params.projectId,
                request.body,
                request.ip,
            );
        },
    );

    app.post(
        "/api/v1/projects/:projectId/publish",
        {
            schema: {
                params: projectParams,
                response: { 200: projectSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            return service.publish(
                auth,
                access.organizationId,
                access.role,
                request.params.projectId,
                request.ip,
            );
        },
    );

    app.get(
        "/api/v1/projects/:projectId/members",
        {
            schema: {
                params: projectParams,
                response: { 200: listResponseSchema(projectMemberSchema) },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            const items = await service.members(
                auth,
                access.organizationId,
                access.role,
                request.params.projectId,
            );
            return { items: [...items], nextCursor: null };
        },
    );

    app.post(
        "/api/v1/projects/:projectId/members",
        {
            schema: {
                params: projectParams,
                body: addProjectMemberRequestSchema,
                response: { 201: projectMemberSchema },
            },
        },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            const member = await service.addMember(
                auth,
                access.organizationId,
                access.role,
                request.params.projectId,
                request.body.email,
                request.ip,
            );
            return reply.status(201).send(member);
        },
    );

    app.get(
        "/api/v1/public/projects",
        {
            schema: {
                querystring: publicListQuerySchema,
                response: { 200: listResponseSchema(publicProjectSchema) },
            },
        },
        async (request, reply) => {
            const cursor = decodeCursor(request.query.cursor);
            const limit = request.query.limit ?? 20;
            const entries = await service.listPublic(
                request.query.competition ?? null,
                cursor === null ? null : { createdAt: new Date(cursor.createdAt), id: cursor.id },
                limit + 1,
            );
            const page = responsePage(entries, limit, (entry) => ({
                createdAt: entry.createdAt,
                id: entry.id,
            }));
            setPublicCache(reply);
            return {
                items: page.items.map((entry) => entry.project),
                nextCursor: page.nextCursor,
            };
        },
    );

    app.get(
        "/api/v1/public/projects/:slug",
        {
            schema: {
                params: publicProjectParams,
                response: { 200: publicProjectSchema },
            },
        },
        async (request, reply) => {
            const project = await service.getPublic(request.params.slug);
            setPublicCache(reply);
            return project;
        },
    );
}
