import { z } from "zod";
import {
    acceptOrganizationInvitationRequestSchema,
    acceptOrganizationInvitationResultSchema,
    addOrganizationMemberRequestSchema,
    addOrganizationMemberResultSchema,
    auditLogSchema,
    auditQuerySchema,
    createOrganizationRequestSchema,
    listResponseSchema,
    organizationInvitationSchema,
    organizationMembershipSchema,
    organizationSchema,
    organizationSettingsSchema,
    updateOrganizationMemberRequestSchema,
    updateOrganizationRequestSchema,
    updateOrganizationSettingsRequestSchema,
} from "@nethack/contracts";
import type { CapabilityContext } from "../../../core/capability.js";
import { decodeCursor, parseLimit, responsePage } from "../../../http/pagination.js";
import { AuthGuard } from "../../../http/guards.js";
import type { NethackServer } from "../../../http/types.js";
import { OrganizationRules } from "../domain/organization-rules.js";
import type { OrganizationService } from "../application/organization-service.js";

const organizationParams = z.object({ organizationId: z.uuid() });
const memberParams = z.object({ organizationId: z.uuid(), userId: z.uuid() });

export async function registerOrganizationRoutes(
    app: NethackServer,
    context: CapabilityContext,
    service: OrganizationService,
): Promise<void> {
    const guard = new AuthGuard(context.config, context.auth.sessions, context.auth.bearer);

    app.get(
        "/api/v1/organizations",
        { schema: { response: { 200: listResponseSchema(organizationSchema) } } },
        async (request) => {
            const auth = await guard.require(request);
            const items = await service.list(auth);
            return { items: [...items], nextCursor: null };
        },
    );

    app.post(
        "/api/v1/organizations",
        {
            schema: {
                body: createOrganizationRequestSchema,
                response: { 201: organizationSchema },
            },
        },
        async (request, reply) => {
            const auth = await guard.require(request);
            const organization = await service.create(auth, request.body, request.ip);
            return reply.status(201).send(organization);
        },
    );

    app.get(
        "/api/v1/organizations/:organizationId",
        {
            schema: {
                params: organizationParams,
                response: { 200: organizationSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            await guard.requireOrganization(request, auth, request.params.organizationId);
            return service.get(request.params.organizationId);
        },
    );

    app.patch(
        "/api/v1/organizations/:organizationId",
        {
            schema: {
                params: organizationParams,
                body: updateOrganizationRequestSchema,
                response: { 200: organizationSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(
                request,
                auth,
                request.params.organizationId,
            );
            OrganizationRules.assertCanManage(access.role);
            return service.update(auth, request.params.organizationId, request.body, request.ip);
        },
    );

    app.get(
        "/api/v1/organizations/:organizationId/members",
        {
            schema: {
                params: organizationParams,
                response: { 200: listResponseSchema(organizationMembershipSchema) },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(
                request,
                auth,
                request.params.organizationId,
            );
            guard.requireOrganizer(access);
            const items = await service.members(request.params.organizationId);
            return { items: [...items], nextCursor: null };
        },
    );

    app.post(
        "/api/v1/organizations/:organizationId/members",
        {
            schema: {
                params: organizationParams,
                body: addOrganizationMemberRequestSchema,
                response: {
                    200: addOrganizationMemberResultSchema,
                    201: addOrganizationMemberResultSchema,
                    202: addOrganizationMemberResultSchema,
                },
            },
        },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(
                request,
                auth,
                request.params.organizationId,
            );
            OrganizationRules.assertCanManage(access.role);
            const result = await service.addMember(
                auth,
                request.params.organizationId,
                request.body,
                request.ip,
            );
            return reply.status(result.kind === "membership" ? 201 : 202).send(result);
        },
    );

    app.patch(
        "/api/v1/organizations/:organizationId/members/:userId",
        {
            schema: {
                params: memberParams,
                body: updateOrganizationMemberRequestSchema,
            },
        },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(
                request,
                auth,
                request.params.organizationId,
            );
            OrganizationRules.assertCanManage(access.role);
            await service.updateMember(
                auth,
                request.params.organizationId,
                request.params.userId,
                request.body,
                request.ip,
            );
            return reply.status(204).send();
        },
    );

    app.delete(
        "/api/v1/organizations/:organizationId/members/:userId",
        { schema: { params: memberParams } },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(
                request,
                auth,
                request.params.organizationId,
            );
            OrganizationRules.assertCanManage(access.role);
            await service.removeMember(
                auth,
                request.params.organizationId,
                request.params.userId,
                request.ip,
            );
            return reply.status(204).send();
        },
    );

    app.get(
        "/api/v1/organizations/:organizationId/invitations",
        {
            schema: {
                params: organizationParams,
                response: { 200: listResponseSchema(organizationInvitationSchema) },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(
                request,
                auth,
                request.params.organizationId,
            );
            OrganizationRules.assertCanManage(access.role);
            const items = await service.invitations(request.params.organizationId);
            return { items: [...items], nextCursor: null };
        },
    );

    app.post(
        "/api/v1/organization-invitations/accept",
        {
            schema: {
                body: acceptOrganizationInvitationRequestSchema,
                response: { 200: acceptOrganizationInvitationResultSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            return service.acceptInvitation(auth, request.body.token, request.ip);
        },
    );

    app.get(
        "/api/v1/organizations/:organizationId/settings",
        {
            schema: {
                params: organizationParams,
                response: { 200: organizationSettingsSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(
                request,
                auth,
                request.params.organizationId,
            );
            OrganizationRules.assertCanManage(access.role);
            return service.settings(request.params.organizationId);
        },
    );

    app.patch(
        "/api/v1/organizations/:organizationId/settings",
        {
            schema: {
                params: organizationParams,
                body: updateOrganizationSettingsRequestSchema,
                response: { 200: organizationSettingsSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(
                request,
                auth,
                request.params.organizationId,
            );
            OrganizationRules.assertCanManage(access.role);
            return service.updateSettings(
                auth,
                request.params.organizationId,
                request.body,
                request.ip,
            );
        },
    );

    app.get(
        "/api/v1/organizations/:organizationId/audit",
        {
            schema: {
                params: organizationParams,
                querystring: auditQuerySchema,
                response: { 200: listResponseSchema(auditLogSchema) },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(
                request,
                auth,
                request.params.organizationId,
            );
            guard.requireOrganizer(access);
            const limit = parseLimit(String(request.query.limit), 50, 100);
            const cursor = decodeCursor(request.query.cursor);
            const rows = await service.auditPage(request.params.organizationId, {
                limit: limit + 1,
                before: cursor === null ? null : new Date(cursor.createdAt),
                action: request.query.action ?? null,
                entityType: request.query.entityType ?? null,
                actorUserId: request.query.actorUserId ?? null,
            });
            return responsePage(rows, limit, (row) => ({
                createdAt: new Date(row.createdAt),
                id: row.id,
            }));
        },
    );
}
