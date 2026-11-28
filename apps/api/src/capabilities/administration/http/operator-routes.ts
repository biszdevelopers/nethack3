import { Readable } from "node:stream";
import { z } from "zod";
import {
    createDebugAiSessionRequestSchema,
    databaseExportQuerySchema,
    debugAiExchangeSchema,
    debugAiSessionDetailSchema,
    debugAiSessionListSchema,
    debugAiSessionSchema,
    debugAiStatusSchema,
    sendDebugAiMessageRequestSchema,
    storedFilePageSchema,
    storedFileQuerySchema,
} from "@nethack/contracts";
import { AuthGuard } from "../../../http/guards.js";
import type { NethackServer } from "../../../http/types.js";
import type { CapabilityContext } from "../../../core/capability.js";
import type { FilesContract } from "../../files/contracts.js";
import type { DatabaseExportService } from "../application/database-export.js";
import type { DebugAiService } from "../application/debug-ai-service.js";
import type { AdministrationRepository } from "../infrastructure/administration-repository.js";

const sessionParams = z.object({ sessionId: z.uuid() });

export async function registerOperatorRoutes(
    app: NethackServer,
    context: CapabilityContext,
    databaseExport: DatabaseExportService,
    debugAi: DebugAiService,
    files: FilesContract,
    repository: AdministrationRepository,
): Promise<void> {
    const guard = new AuthGuard(context.config, context.auth.sessions, context.auth.bearer);

    app.get(
        "/api/v1/admin/database/export",
        { schema: { querystring: databaseExportQuerySchema } },
        async (request, reply) => {
            const auth = await guard.require(request);
            guard.requireGlobalAdministrator(auth);
            const format = request.query.format;
            const date = context.clock.now().toISOString().slice(0, 10);
            return reply
                .type(
                    format === "csv"
                        ? "text/csv; charset=utf-8"
                        : "application/json; charset=utf-8",
                )
                .header(
                    "content-disposition",
                    `attachment; filename="nethack-export-${date}.${format}"`,
                )
                .header("cache-control", "private, no-store")
                .send(
                    Readable.from(
                        format === "csv" ? databaseExport.streamCsv() : databaseExport.stream(),
                        { encoding: "utf8" },
                    ),
                );
        },
    );

    app.get(
        "/api/v1/admin/debug/files",
        {
            schema: {
                querystring: storedFileQuerySchema,
                response: { 200: storedFilePageSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            guard.requireGlobalAdministrator(auth);
            const organizationIds = await repository.listOrganizationIds(context.database.db);
            const page = await files.listStoredFiles(organizationIds, {
                limit: request.query.limit,
                offset: request.query.offset,
                linkedOnly: false,
            });
            return { ...page, items: [...page.items] };
        },
    );

    app.get(
        "/api/v1/admin/debug/references",
        {
            schema: {
                querystring: storedFileQuerySchema,
                response: { 200: storedFilePageSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            guard.requireGlobalAdministrator(auth);
            const organizationIds = await repository.listOrganizationIds(context.database.db);
            const page = await files.listStoredFiles(organizationIds, {
                limit: request.query.limit,
                offset: request.query.offset,
                linkedOnly: true,
            });
            return { ...page, items: [...page.items] };
        },
    );

    app.get(
        "/api/v1/admin/debug/ai/status",
        { schema: { response: { 200: debugAiStatusSchema } } },
        async (request) => {
            const auth = await guard.require(request);
            guard.requireGlobalAdministrator(auth);
            return debugAi.status();
        },
    );

    app.get(
        "/api/v1/admin/debug/ai/sessions",
        { schema: { response: { 200: debugAiSessionListSchema } } },
        async (request) => {
            const auth = await guard.require(request);
            guard.requireGlobalAdministrator(auth);
            return {
                items: [...(await debugAi.listSessions(auth))],
                configured: debugAi.status().configured,
            };
        },
    );

    app.post(
        "/api/v1/admin/debug/ai/sessions",
        {
            schema: {
                body: createDebugAiSessionRequestSchema,
                response: { 201: debugAiSessionSchema },
            },
        },
        async (request, reply) => {
            const auth = await guard.require(request);
            guard.requireGlobalAdministrator(auth);
            const session = await debugAi.createSession(auth, request.body);
            return reply.status(201).send(session);
        },
    );

    app.get(
        "/api/v1/admin/debug/ai/sessions/:sessionId",
        {
            schema: {
                params: sessionParams,
                response: { 200: debugAiSessionDetailSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            guard.requireGlobalAdministrator(auth);
            return debugAi.getSession(auth, request.params.sessionId);
        },
    );

    app.delete(
        "/api/v1/admin/debug/ai/sessions/:sessionId",
        { schema: { params: sessionParams } },
        async (request, reply) => {
            const auth = await guard.require(request);
            guard.requireGlobalAdministrator(auth);
            await debugAi.deleteSession(auth, request.params.sessionId);
            return reply.status(204).send();
        },
    );

    app.post(
        "/api/v1/admin/debug/ai/sessions/:sessionId/messages",
        {
            schema: {
                params: sessionParams,
                body: sendDebugAiMessageRequestSchema,
                response: { 200: debugAiExchangeSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            guard.requireGlobalAdministrator(auth);
            return debugAi.sendMessage(auth, request.params.sessionId, request.body.content);
        },
    );
}
