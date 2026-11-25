import type {
    Notification,
    NotificationPreferences,
    UpdateNotificationPreferencesRequest,
} from "@nethack/contracts";
import type { Clock } from "../../../core/clock.js";
import { NotFoundError } from "../../../core/errors.js";
import type { DatabaseConnection } from "../../../infrastructure/database/client.js";
import type { NotificationRepository } from "../infrastructure/notification-repository.js";

const DEFAULT_PREFERENCES: NotificationPreferences = {
    emailEnabled: true,
    inAppEnabled: true,
};

export class NotificationService {
    private readonly database: DatabaseConnection;
    private readonly repository: NotificationRepository;
    private readonly clock: Clock;

    constructor(database: DatabaseConnection, repository: NotificationRepository, clock: Clock) {
        this.database = database;
        this.repository = repository;
        this.clock = clock;
    }

    async list(
        userId: string,
        options: { limit: number; before: { createdAt: Date; id: string } | null; unread: boolean },
    ): Promise<readonly Notification[]> {
        const rows = await this.repository.listForUser(this.database.db, userId, options);
        return rows.map(toNotification);
    }

    async markRead(userId: string, notificationId: string): Promise<Notification> {
        const row = await this.database.transaction({ userId }, async (session) => {
            const existing = await this.repository.findForUser(session.db, userId, notificationId);
            if (existing === null) {
                throw new NotFoundError("The notification was not found.");
            }
            if (existing.readAt !== null) {
                return existing;
            }
            const updated = await this.repository.markRead(
                session,
                userId,
                notificationId,
                this.clock.now(),
            );
            if (updated !== null) {
                return updated;
            }
            const refreshed = await this.repository.findForUser(session.db, userId, notificationId);
            if (refreshed === null) {
                throw new NotFoundError("The notification was not found.");
            }
            return refreshed;
        });
        return toNotification(row);
    }

    async markAllRead(userId: string): Promise<void> {
        await this.database.transaction({ userId }, async (session) => {
            await this.repository.markAllRead(session, userId, this.clock.now());
        });
    }

    async preferences(userId: string): Promise<NotificationPreferences> {
        const row = await this.repository.preferences(this.database.db, userId);
        return row === null
            ? DEFAULT_PREFERENCES
            : { emailEnabled: row.emailEnabled, inAppEnabled: row.inAppEnabled };
    }

    async updatePreferences(
        userId: string,
        input: UpdateNotificationPreferencesRequest,
    ): Promise<NotificationPreferences> {
        const row = await this.database.transaction({ userId }, async (session) =>
            this.repository.upsertPreferences(
                session,
                userId,
                { emailEnabled: input.emailEnabled, inAppEnabled: input.inAppEnabled },
                this.clock.now(),
            ),
        );
        return { emailEnabled: row.emailEnabled, inAppEnabled: row.inAppEnabled };
    }
}

function toNotification(row: {
    id: string;
    organizationId: string | null;
    kind: Notification["kind"];
    title: string;
    body: string;
    linkUrl: string | null;
    readAt: Date | null;
    createdAt: Date;
}): Notification {
    return {
        id: row.id,
        organizationId: row.organizationId,
        kind: row.kind,
        title: row.title,
        body: row.body,
        linkUrl: row.linkUrl,
        readAt: row.readAt === null ? null : row.readAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
    };
}
