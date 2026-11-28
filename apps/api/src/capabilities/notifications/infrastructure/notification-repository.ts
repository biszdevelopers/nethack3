import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import type { NotificationKind } from "@nethack/contracts";
import type { DatabaseExecutor, DatabaseSession } from "../../../infrastructure/database/client.js";
import {
    notificationPreferences,
    notifications,
} from "../../../infrastructure/database/schema/index.js";

export interface NotificationRecord {
    readonly id: string;
    readonly userId: string;
    readonly organizationId: string | null;
    readonly kind: NotificationKind;
    readonly title: string;
    readonly body: string;
    readonly linkUrl: string | null;
    readonly readAt: Date | null;
    readonly dedupeKey: string | null;
    readonly emailSentAt: Date | null;
    readonly createdAt: Date;
}

export interface NotificationPreferenceRecord {
    readonly userId: string;
    readonly emailEnabled: boolean;
    readonly inAppEnabled: boolean;
    readonly updatedAt: Date;
}

export interface NotificationDeliveryRecord {
    readonly id: string;
    readonly emailSentAt: Date | null;
}

export class NotificationRepository {
    async listForUser(
        db: DatabaseExecutor,
        userId: string,
        options: {
            limit: number;
            before: { createdAt: Date; id: string } | null;
            unread: boolean;
        },
    ): Promise<readonly NotificationRecord[]> {
        const conditions = [eq(notifications.userId, userId)];
        if (options.unread) {
            conditions.push(isNull(notifications.readAt));
        }
        if (options.before !== null) {
            const cursorCondition = or(
                lt(notifications.createdAt, options.before.createdAt),
                and(
                    eq(notifications.createdAt, options.before.createdAt),
                    lt(notifications.id, options.before.id),
                ),
            );
            if (cursorCondition !== undefined) {
                conditions.push(cursorCondition);
            }
        }
        return db
            .select()
            .from(notifications)
            .where(and(...conditions))
            .orderBy(desc(notifications.createdAt), desc(notifications.id))
            .limit(options.limit);
    }

    async findForUser(
        db: DatabaseExecutor,
        userId: string,
        notificationId: string,
    ): Promise<NotificationRecord | null> {
        const rows = await db
            .select()
            .from(notifications)
            .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
            .limit(1);
        return rows[0] ?? null;
    }

    async countUnreadForUser(db: DatabaseExecutor, userId: string): Promise<number> {
        const rows = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(notifications)
            .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
        return rows[0]?.count ?? 0;
    }

    async markRead(
        session: DatabaseSession,
        userId: string,
        notificationId: string,
        readAt: Date,
    ): Promise<NotificationRecord | null> {
        const rows = await session.db
            .update(notifications)
            .set({ readAt })
            .where(
                and(
                    eq(notifications.id, notificationId),
                    eq(notifications.userId, userId),
                    isNull(notifications.readAt),
                ),
            )
            .returning();
        return rows[0] ?? null;
    }

    async markAllRead(session: DatabaseSession, userId: string, readAt: Date): Promise<number> {
        const rows = await session.db
            .update(notifications)
            .set({ readAt })
            .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
            .returning({ id: notifications.id });
        return rows.length;
    }

    async preferences(
        db: DatabaseExecutor,
        userId: string,
    ): Promise<NotificationPreferenceRecord | null> {
        const rows = await db
            .select()
            .from(notificationPreferences)
            .where(eq(notificationPreferences.userId, userId))
            .limit(1);
        return rows[0] ?? null;
    }

    async upsertPreferences(
        session: DatabaseSession,
        userId: string,
        values: { emailEnabled: boolean; inAppEnabled: boolean },
        updatedAt: Date,
    ): Promise<NotificationPreferenceRecord> {
        const [row] = await session.db
            .insert(notificationPreferences)
            .values({ userId, ...values, updatedAt })
            .onConflictDoUpdate({
                target: notificationPreferences.userId,
                set: { ...values, updatedAt },
            })
            .returning();
        if (row === undefined) {
            throw new Error("The notification preferences could not be saved.");
        }
        return row;
    }

    async insertIfAbsent(
        session: DatabaseSession,
        values: {
            userId: string;
            organizationId: string | null;
            kind: NotificationKind;
            title: string;
            body: string;
            linkUrl: string | null;
            dedupeKey: string;
        },
    ): Promise<NotificationDeliveryRecord | null> {
        const rows = await session.db
            .insert(notifications)
            .values(values)
            .onConflictDoNothing()
            .returning({ id: notifications.id, emailSentAt: notifications.emailSentAt });
        return rows[0] ?? null;
    }

    async findByDedupeKey(
        db: DatabaseExecutor,
        dedupeKey: string,
    ): Promise<NotificationDeliveryRecord | null> {
        const rows = await db
            .select({ id: notifications.id, emailSentAt: notifications.emailSentAt })
            .from(notifications)
            .where(eq(notifications.dedupeKey, dedupeKey))
            .limit(1);
        return rows[0] ?? null;
    }

    async markEmailSent(
        session: DatabaseSession,
        notificationId: string,
        sentAt: Date,
    ): Promise<void> {
        await session.db
            .update(notifications)
            .set({ emailSentAt: sentAt })
            .where(eq(notifications.id, notificationId));
    }
}
