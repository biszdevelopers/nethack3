import { z } from "zod";
import {
    announcementSchema,
    createAnnouncementRequestSchema,
    cursorSchema,
    limitSchema,
    listResponseSchema,
    publicAnnouncementSchema,
    updateAnnouncementRequestSchema,
} from "@nethack/contracts";
import type { CapabilityContext } from "../../../core/capability.js";
import { AuthGuard } from "../../../http/guards.js";
import { decodeCursor, responsePage, setPublicCache } from "../../../http/pagination.js";
import type { NethackServer } from "../../../http/types.js";
import { assertHasChanges, canViewDrafts } from "../domain/announcement-rules.js";
import { publicAnnouncementQuerySchema } from "../domain/public-announcement.js";
import type { AnnouncementService } from "../application/announcement-service.js";

const organizationParams = z.object({ organizationId: z.uuid() });
const announcementParams = z.object({ announcementId: z.uuid() });

const listQuerySchema = z.object({
    cursor: cursorSchema.optional(),
    limit: limitSchema.optional(),
});

export async function registerAnnouncementRoutes(
    app: NethackServer,
    context: CapabilityContext,
    service: AnnouncementService,
): Promise<void> {
    const guard = new AuthGuard(context.config, context.auth.sessions, context.auth.bearer);

    app.get(
        "/api/v1/organizations/:organizationId/announcements",
        {
            schema: {
                params: organizationParams,
                querystring: listQuerySchema,
                response: { 200: listResponseSchema(announcementSchema) },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(
                request,
                auth,
                request.params.organizationId,
            );
            const limit = request.query.limit ?? 20;
            const cursor = decodeCursor(request.query.cursor);
            const items = await service.list(auth, request.params.organizationId, {
                limit: limit + 1,
                before:
                    cursor === null
                        ? null
                        : { createdAt: new Date(cursor.createdAt), id: cursor.id },
                includeDrafts: canViewDrafts(access.role),
            });
            return responsePage(items, limit, (item) => ({
                createdAt: new Date(item.createdAt),
                id: item.id,
            }));
        },
    );

    app.post(
        "/api/v1/organizations/:organizationId/announcements",
        {
            schema: {
                params: organizationParams,
                body: createAnnouncementRequestSchema,
                response: { 201: announcementSchema },
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
            const announcement = await service.create(
                auth,
                request.params.organizationId,
                request.body,
                request.ip,
            );
            return reply.status(201).send(announcement);
        },
    );

    app.post(
        "/api/v1/announcements/:announcementId/publish",
        {
            schema: {
                params: announcementParams,
                response: { 200: announcementSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            return service.publish(
                auth,
                access.organizationId,
                request.params.announcementId,
                request.ip,
            );
        },
    );

    app.patch(
        "/api/v1/announcements/:announcementId",
        {
            schema: {
                params: announcementParams,
                body: updateAnnouncementRequestSchema,
                response: { 200: announcementSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            guard.requireOrganizer(access);
            assertHasChanges(request.body);
            return service.update(
                auth,
                access.organizationId,
                request.params.announcementId,
                request.body,
                request.ip,
            );
        },
    );

    app.get(
        "/api/v1/public/announcements",
        {
            schema: {
                querystring: publicAnnouncementQuerySchema,
                response: { 200: listResponseSchema(publicAnnouncementSchema) },
            },
        },
        async (request, reply) => {
            setPublicCache(reply);
            const limit = request.query.limit ?? 20;
            const cursor = decodeCursor(request.query.cursor);
            const items = await service.listPublic(request.query.organization ?? null, {
                limit: limit + 1,
                before:
                    cursor === null
                        ? null
                        : { createdAt: new Date(cursor.createdAt), id: cursor.id },
            });
            return responsePage(items, limit, (item) => ({
                createdAt: new Date(item.publishedAt ?? 0),
                id: item.id,
            }));
        },
    );
}
