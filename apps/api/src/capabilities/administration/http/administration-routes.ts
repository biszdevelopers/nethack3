import { z } from "zod";
import {
    administrationAuditQuerySchema,
    administrationPreflightSchema,
    administrationTeamSchema,
    administrationUserSchema,
    auditLogSchema,
    globalAdministrationAuditQuerySchema,
    globalAdministratorSchema,
    grantGlobalAdministratorRequestSchema,
    listResponseSchema,
    reopenAdministrationSubmissionRequestSchema,
    reportSummarySchema,
    revokeGlobalAdministratorRequestSchema,
    updateAdministrationTeamRequestSchema,
    updateAdministrationUserRequestSchema,
} from "@nethack/contracts";
import { AuthGuard } from "../../../http/guards.js";
import { decodeCursor, parseLimit, responsePage } from "../../../http/pagination.js";
import type { NethackServer } from "../../../http/types.js";
import type { CapabilityContext } from "../../../core/capability.js";
import type { AdministrationService } from "../application/administration-service.js";
import type { EditionAdministrationService } from "../application/edition-administration-service.js";
import type { PreflightService } from "../application/preflight-service.js";
import type { ReportService } from "../application/report-service.js";

const administratorParams = z.object({ userId: z.uuid() });
const userParams = z.object({ userId: z.uuid() });
const organizationParams = z.object({ organizationId: z.uuid() });
const organizationUserParams = z.object({ organizationId: z.uuid(), userId: z.uuid() });
const editionParams = z.object({ editionId: z.uuid() });
const editionTeamParams = z.object({ editionId: z.uuid(), teamId: z.uuid() });
const editionSubmissionParams = z.object({
    editionId: z.uuid(),
    submissionId: z.uuid(),
});

export async function registerAdministrationRoutes(
    app: NethackServer,
    context: CapabilityContext,
    service: AdministrationService,
    reports: ReportService,
    editions: EditionAdministrationService,
    preflight: PreflightService,
): Promise<void> {
    const guard = new AuthGuard(context.config, context.auth.sessions, context.auth.bearer);

    app.get(
        "/api/v1/admin/global-administrators",
        { schema: { response: { 200: listResponseSchema(globalAdministratorSchema) } } },
        async (request) => {
            const auth = await guard.require(request);
            guard.requireGlobalAdministrator(auth);
            const items = await service.listGlobalAdministrators();
            return { items: [...items], nextCursor: null };
        },
    );

    app.post(
        "/api/v1/admin/global-administrators",
        {
            schema: {
                body: grantGlobalAdministratorRequestSchema,
                response: { 201: globalAdministratorSchema },
            },
        },
        async (request, reply) => {
            const auth = await guard.require(request);
            guard.requireGlobalAdministrator(auth);
            const granted = await service.grant(auth, request.body, request.ip);
            return reply.status(201).send(granted);
        },
    );

    app.delete(
        "/api/v1/admin/global-administrators/:userId",
        {
            schema: {
                params: administratorParams,
                body: revokeGlobalAdministratorRequestSchema,
            },
        },
        async (request, reply) => {
            const auth = await guard.require(request);
            guard.requireGlobalAdministrator(auth);
            await service.revoke(auth, request.params.userId, request.body, request.ip);
            return reply.status(204).send();
        },
    );

    app.delete(
        "/api/v1/admin/users/:userId",
        { schema: { params: userParams } },
        async (request, reply) => {
            const auth = await guard.require(request);
            guard.requireGlobalAdministrator(auth);
            await service.deleteUserAccount(auth, request.params.userId, request.ip);
            return reply.status(204).send();
        },
    );

    app.get(
        "/api/v1/admin/audit",
        {
            schema: {
                querystring: administrationAuditQuerySchema,
                response: { 200: listResponseSchema(auditLogSchema) },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            guard.requireGlobalAdministrator(auth);
            const limit = parseLimit(String(request.query.limit), 50, 100);
            const cursor = decodeCursor(request.query.cursor);
            const rows = await service.auditPage({
                organizationId: request.query.organizationId,
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

    app.get(
        "/api/v1/admin/audit/global",
        {
            schema: {
                querystring: globalAdministrationAuditQuerySchema,
                response: { 200: listResponseSchema(auditLogSchema) },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            guard.requireGlobalAdministrator(auth);
            const limit = parseLimit(String(request.query.limit), 50, 100);
            const cursor = decodeCursor(request.query.cursor);
            const rows = await service.globalAuditPage({
                organizationId: request.query.organizationId ?? null,
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

    app.get(
        "/api/v1/organizations/:organizationId/reports",
        {
            schema: {
                params: organizationParams,
                response: { 200: reportSummarySchema },
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
            return reports.summary(request.params.organizationId);
        },
    );

    app.get(
        "/api/v1/organizations/:organizationId/administration/users",
        {
            schema: {
                params: organizationParams,
                response: { 200: listResponseSchema(administrationUserSchema) },
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
            const items = await service.listOrganizationUsers(request.params.organizationId);
            return { items: [...items], nextCursor: null };
        },
    );

    app.patch(
        "/api/v1/organizations/:organizationId/administration/users/:userId",
        {
            schema: {
                params: organizationUserParams,
                body: updateAdministrationUserRequestSchema,
            },
        },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(
                request,
                auth,
                request.params.organizationId,
            );
            guard.requireOrganizer(access);
            await service.updateOrganizationUserRole(
                auth,
                request.params.organizationId,
                request.params.userId,
                request.body.role,
                request.ip,
            );
            return reply.status(204).send();
        },
    );

    app.get(
        "/api/v1/administration/editions/:editionId/teams",
        {
            schema: {
                params: editionParams,
                response: { 200: listResponseSchema(administrationTeamSchema) },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            const items = await editions.listTeams(access.organizationId, request.params.editionId);
            return { items: [...items], nextCursor: null };
        },
    );

    app.patch(
        "/api/v1/administration/editions/:editionId/teams/:teamId",
        {
            schema: {
                params: editionTeamParams,
                body: updateAdministrationTeamRequestSchema,
            },
        },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            await editions.updateTeamStatus(
                auth,
                access.organizationId,
                request.params.editionId,
                request.params.teamId,
                request.body.status,
                request.body.reason ?? "",
                request.ip,
            );
            return reply.status(204).send();
        },
    );

    app.delete(
        "/api/v1/administration/editions/:editionId/teams/:teamId",
        { schema: { params: editionTeamParams } },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            await editions.deleteTeam(
                auth,
                access.organizationId,
                request.params.editionId,
                request.params.teamId,
                request.ip,
            );
            return reply.status(204).send();
        },
    );

    app.post(
        "/api/v1/administration/editions/:editionId/submissions/:submissionId/reopen",
        {
            schema: {
                params: editionSubmissionParams,
                body: reopenAdministrationSubmissionRequestSchema,
            },
        },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            await editions.reopenSubmission(
                auth,
                access.organizationId,
                request.params.editionId,
                request.params.submissionId,
                request.body,
                request.ip,
            );
            return reply.status(204).send();
        },
    );

    app.get(
        "/api/v1/administration/editions/:editionId/preflight",
        {
            schema: {
                params: editionParams,
                response: { 200: administrationPreflightSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            return preflight.forEdition(access.organizationId, request.params.editionId);
        },
    );

    app.get(
        "/api/v1/administration/editions/:editionId/standings.csv",
        { schema: { params: editionParams } },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            const csv = await editions.standingsCsv(
                access.organizationId,
                request.params.editionId,
            );
            return reply
                .type("text/csv; charset=utf-8")
                .header(
                    "content-disposition",
                    `attachment; filename="standings-${request.params.editionId}.csv"`,
                )
                .header("cache-control", "private, no-store")
                .send(csv);
        },
    );
}
