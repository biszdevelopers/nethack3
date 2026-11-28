import {
    listResponseSchema,
    notificationPreferencesSchema,
    notificationSchema,
    notificationUnreadCountSchema,
    updateNotificationPreferencesRequestSchema,
    type ListResponse,
    type Notification,
    type NotificationPreferences,
    type UpdateNotificationPreferencesRequest,
} from "@nethack/contracts";
import type { ApiClient } from "./client.js";

export interface NotificationListQuery {
    readonly unread?: boolean;
    readonly cursor?: string;
    readonly limit?: number;
}

const notificationListSchema = listResponseSchema(notificationSchema);

export class NotificationsApi {
    private readonly client: ApiClient;

    constructor(client: ApiClient) {
        this.client = client;
    }

    async list(query: NotificationListQuery = {}): Promise<ListResponse<Notification>> {
        return this.client.request("GET", "/api/v1/notifications", {
            query: { unread: query.unread, cursor: query.cursor, limit: query.limit },
            schema: notificationListSchema,
        });
    }

    async markRead(notificationId: string): Promise<Notification> {
        return this.client.request("POST", `/api/v1/notifications/${notificationId}/read`, {
            schema: notificationSchema,
        });
    }

    async markAllRead(): Promise<void> {
        await this.client.request("POST", "/api/v1/notifications/read-all");
    }

    async unreadCount(): Promise<number> {
        const result = await this.client.request("GET", "/api/v1/notifications/unread-count", {
            schema: notificationUnreadCountSchema,
        });
        return result.count;
    }

    async preferences(): Promise<NotificationPreferences> {
        return this.client.request("GET", "/api/v1/notifications/preferences", {
            schema: notificationPreferencesSchema,
        });
    }

    async updatePreferences(
        input: UpdateNotificationPreferencesRequest,
    ): Promise<NotificationPreferences> {
        return this.client.request("PATCH", "/api/v1/notifications/preferences", {
            body: updateNotificationPreferencesRequestSchema.parse(input),
            schema: notificationPreferencesSchema,
        });
    }
}
