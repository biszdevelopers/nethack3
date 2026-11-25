import { z } from "zod";
import { notificationKindSchema } from "@nethack/contracts";
import type { AppConfig } from "../../../core/configuration.js";
import type { Clock } from "../../../core/clock.js";
import { InternalError } from "../../../core/errors.js";
import type { DatabaseSession } from "../../../infrastructure/database/client.js";
import type { Mailer } from "../../../infrastructure/email/mailer.js";
import { buildNotificationEmail } from "../domain/notification-email.js";
import type { NotificationRepository } from "../infrastructure/notification-repository.js";

export const NOTIFICATION_DELIVERY_JOB = "notifications.deliver";

const deliveryPayloadSchema = z.object({
    userId: z.uuid().nullable(),
    email: z.email().max(254).nullable(),
    organizationId: z.uuid().nullable(),
    kind: notificationKindSchema,
    title: z.string().trim().min(1).max(300),
    body: z.string().max(5000),
    linkUrl: z.string().max(2048).nullable(),
    dedupeKey: z.string().min(1).max(512),
});

export class NotificationDeliveryService {
    private readonly repository: NotificationRepository;
    private readonly config: AppConfig;
    private readonly mailer: Mailer;
    private readonly clock: Clock;

    constructor(
        repository: NotificationRepository,
        config: AppConfig,
        mailer: Mailer,
        clock: Clock,
    ) {
        this.repository = repository;
        this.config = config;
        this.mailer = mailer;
        this.clock = clock;
    }

    async deliver(payload: Record<string, unknown>, session: DatabaseSession): Promise<void> {
        const parsed = deliveryPayloadSchema.safeParse(payload);
        if (!parsed.success) {
            throw new InternalError("The notification delivery payload is invalid.");
        }
        const { userId, email, organizationId, kind, title, body, linkUrl, dedupeKey } =
            parsed.data;
        const preferences =
            userId === null ? null : await this.repository.preferences(session.db, userId);
        const inAppEnabled = preferences?.inAppEnabled ?? true;
        const emailEnabled = preferences?.emailEnabled ?? true;

        if (!inAppEnabled && (email === null || !emailEnabled || this.config.smtpUrl === null)) {
            return;
        }

        let notificationId: string | null = null;
        if (userId !== null && inAppEnabled) {
            const inserted = await this.repository.insertIfAbsent(session, {
                userId,
                organizationId,
                kind,
                title,
                body,
                linkUrl,
                dedupeKey,
            });
            if (inserted !== null) {
                notificationId = inserted.id;
            } else {
                const existing = await this.repository.findByDedupeKey(session.db, dedupeKey);
                if (existing === null || existing.emailSentAt !== null) {
                    return;
                }
                notificationId = existing.id;
            }
        }

        if (email === null || !emailEnabled || this.config.smtpUrl === null) {
            return;
        }
        const message = buildNotificationEmail({ title, body, linkUrl });
        await this.mailer.send({ to: email, subject: message.subject, text: message.text });
        if (notificationId !== null) {
            await this.repository.markEmailSent(session, notificationId, this.clock.now());
        }
    }
}
