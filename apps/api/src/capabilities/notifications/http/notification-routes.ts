import { z } from "zod";
import {
    cursorSchema,
    limitSchema,
    listResponseSchema,
    notificationPreferencesSchema,
    notificationSchema,
    notificationUnreadCountSchema,
    updateNotificationPreferencesRequestSchema,
} from "@nethack/contracts";
import type { CapabilityContext } from "../../../core/capability.js";
import { AuthGuard } from "../../../http/guards.js";
import { decodeCursor, responsePage } from "../../../http/pagination.js";
import type { NethackServer } from "../../../http/types.js";
import type { NotificationService } from "../application/notification-service.js";

const notificationParams = z.object({ notificationId: z.uuid() });

const listQuerySchema = z.object({
    unread: z.enum(["true", "false"]).optional(),
    cursor: cursorSchema.optional(),
    limit: limitSchema.optional(),
});

export async function registerNotificationRoutes(
    app: NethackServer,
    context: CapabilityContext,
    service: NotificationService,
): Promise<void> {
    const guard = new AuthGuard(context.config, context.auth.sessions, context.auth.bearer);

    app.get(
        "/api/v1/notifications",
        {
            schema: {
                querystring: listQuerySchema,
                response: { 200: listResponseSchema(notificationSchema) },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const limit = request.query.limit ?? 20;
            const cursor = decodeCursor(request.query.cursor);
            const items = await service.list(auth.user.id, {
                limit: limit + 1,
                before:
                    cursor === null
                        ? null
                        : { createdAt: new Date(cursor.createdAt), id: cursor.id },
                unread: request.query.unread === "true",
            });
            return responsePage(items, limit, (item) => ({
                createdAt: new Date(item.createdAt),
                id: item.id,
            }));
        },
    );

    app.post(
        "/api/v1/notifications/:notificationId/read",
        {
            schema: {
                params: notificationParams,
                response: { 200: notificationSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            return service.markRead(auth.user.id, request.params.notificationId);
        },
    );

    app.post("/api/v1/notifications/read-all", { schema: {} }, async (request, reply) => {
        const auth = await guard.require(request);
        await service.markAllRead(auth.user.id);
        return reply.status(204).send();
    });

    app.get(
        "/api/v1/notifications/unread-count",
        { schema: { response: { 200: notificationUnreadCountSchema } } },
        async (request) => {
            const auth = await guard.require(request);
            return { count: await service.unreadCount(auth.user.id) };
        },
    );

    app.get(
        "/api/v1/notifications/preferences",
        { schema: { response: { 200: notificationPreferencesSchema } } },
        async (request) => {
            const auth = await guard.require(request);
            return service.preferences(auth.user.id);
        },
    );

    app.patch(
        "/api/v1/notifications/preferences",
        {
            schema: {
                body: updateNotificationPreferencesRequestSchema,
                response: { 200: notificationPreferencesSchema },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            return service.updatePreferences(auth.user.id, request.body);
        },
    );
}
