import { z } from "zod";
import {
    administrationAuditQuerySchema,
    auditLogSchema,
    globalAdministratorSchema,
    grantGlobalAdministratorRequestSchema,
    listResponseSchema,
    reportSummarySchema,
    revokeGlobalAdministratorRequestSchema,
} from "@nethack/contracts";
import { AuthGuard } from "../../../http/guards.js";
import { decodeCursor, parseLimit, responsePage } from "../../../http/pagination.js";
import type { NethackServer } from "../../../http/types.js";
import type { CapabilityContext } from "../../../core/capability.js";
import type { AdministrationService } from "../application/administration-service.js";
import type { ReportService } from "../application/report-service.js";

const administratorParams = z.object({ userId: z.uuid() });
const organizationParams = z.object({ organizationId: z.uuid() });

export async function registerAdministrationRoutes(
    app: NethackServer,
    context: CapabilityContext,
    service: AdministrationService,
    reports: ReportService,
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
}
