import { z } from "zod";
import type { FastifyRequest } from "fastify";
import {
    acceptTeamInvitationRequestSchema,
    auditLogSchema,
    createTeamRequestSchema,
    inviteTeamMemberRequestSchema,
    listResponseSchema,
    pageQuerySchema,
    teamDetailSchema,
    teamInvitationAcceptanceSchema,
    teamInvitationSchema,
    teamSchema,
    transferTeamCaptainRequestSchema,
    updateTeamRequestSchema,
} from "@nethack/contracts";
import type { CapabilityContext } from "../../../core/capability.js";
import { ValidationError } from "../../../core/errors.js";
import { decodeCursor, parseLimit, responsePage } from "../../../http/pagination.js";
import { AuthGuard } from "../../../http/guards.js";
import type { NethackServer } from "../../../http/types.js";
import type { TeamService } from "../application/team-service.js";

const editionParams = z.object({ editionId: z.uuid() });
const teamParams = z.object({ teamId: z.uuid() });
const teamMemberParams = z.object({ teamId: z.uuid(), userId: z.uuid() });
const uuidSchema = z.uuid();

function organizationContext(request: FastifyRequest): string {
    const value = request.headers["x-nethack-organization-id"];
    if (typeof value !== "string" || !uuidSchema.safeParse(value).success) {
        throw new ValidationError("An organization context is required.");
    }
    return value;
}

export async function registerTeamRoutes(
    app: NethackServer,
    context: CapabilityContext,
    service: TeamService,
): Promise<void> {
    const guard = new AuthGuard(context.config, context.auth.sessions, context.auth.bearer);

    app.get(
        "/api/v1/competitions/:editionId/teams",
        {
            schema: {
                params: editionParams,
                response: { 200: listResponseSchema(teamSchema) },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            const items = await service.list(access.organizationId, request.params.editionId);
            return { items: [...items], nextCursor: null };
        },
    );

    app.post(
        "/api/v1/competitions/:editionId/teams",
        {
            schema: {
                params: editionParams,
                body: createTeamRequestSchema,
                response: { 201: teamSchema },
            },
        },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            if (request.body.editionId !== request.params.editionId) {
                throw new ValidationError("The edition in the body must match the route.");
            }
            const team = await service.create(
                auth,
                access.organizationId,
                request.body,
                request.ip,
            );
            return reply.status(201).send(team);
        },
    );

    app.get(
        "/api/v1/teams/:teamId",
        {
            schema: {
                params: teamParams,
                response: { 200: teamDetailSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            return service.detail(auth, access.organizationId, request.params.teamId, access.role);
        },
    );

    app.patch(
        "/api/v1/teams/:teamId",
        {
            schema: {
                params: teamParams,
                body: updateTeamRequestSchema,
                response: { 200: teamDetailSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            return service.update(
                auth,
                access.organizationId,
                request.params.teamId,
                access.role,
                request.body,
                request.ip,
            );
        },
    );

    app.post(
        "/api/v1/teams/:teamId/invitations",
        {
            schema: {
                params: teamParams,
                body: inviteTeamMemberRequestSchema,
                response: { 201: teamInvitationSchema },
            },
        },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            const invitation = await service.invite(
                auth,
                access.organizationId,
                request.params.teamId,
                request.body,
                request.ip,
            );
            return reply.status(201).send(invitation);
        },
    );

    app.post(
        "/api/v1/team-invitations/accept",
        {
            schema: {
                body: acceptTeamInvitationRequestSchema,
                response: { 200: teamInvitationAcceptanceSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const organizationId = organizationContext(request);
            return service.acceptInvitation(auth, organizationId, request.body.token, request.ip);
        },
    );

    app.delete(
        "/api/v1/teams/:teamId/members/:userId",
        { schema: { params: teamMemberParams } },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            await service.removeMember(
                auth,
                access.organizationId,
                request.params.teamId,
                request.params.userId,
                access.role,
                request.ip,
            );
            return reply.status(204).send();
        },
    );

    app.post(
        "/api/v1/teams/:teamId/captain",
        {
            schema: {
                params: teamParams,
                body: transferTeamCaptainRequestSchema,
            },
        },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            await service.transferCaptain(
                auth,
                access.organizationId,
                request.params.teamId,
                request.body.userId,
                access.role,
                request.ip,
            );
            return reply.status(204).send();
        },
    );

    app.post(
        "/api/v1/teams/:teamId/leave",
        { schema: { params: teamParams } },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            await service.leave(auth, access.organizationId, request.params.teamId, request.ip);
            return reply.status(204).send();
        },
    );

    app.get(
        "/api/v1/me/teams",
        {
            schema: {
                response: { 200: listResponseSchema(teamSchema) },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            const items = await service.listMine(access.organizationId, auth.user.id);
            return { items: [...items], nextCursor: null };
        },
    );

    app.get(
        "/api/v1/teams/:teamId/activity",
        {
            schema: {
                params: teamParams,
                querystring: pageQuerySchema,
                response: { 200: listResponseSchema(auditLogSchema) },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            const limit = parseLimit(String(request.query.limit), 50, 100);
            const cursor = decodeCursor(request.query.cursor);
            const rows = await service.activity(
                access.organizationId,
                request.params.teamId,
                auth.user.id,
                {
                    limit: limit + 1,
                    before: cursor === null ? null : new Date(cursor.createdAt),
                },
            );
            return responsePage(rows, limit, (row) => ({
                createdAt: new Date(row.createdAt),
                id: row.id,
            }));
        },
    );
}
