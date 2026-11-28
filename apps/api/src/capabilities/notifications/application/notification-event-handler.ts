import type { Logger } from "../../../core/logger.js";
import type { DatabaseSession } from "../../../infrastructure/database/client.js";
import type { JobQueue } from "../../../infrastructure/jobs/job-queue.js";
import { buildNotificationIntents } from "../domain/notification-intents.js";
import { NOTIFICATION_DELIVERY_JOB } from "./notification-delivery.js";

export class NotificationEventHandler {
    private readonly jobs: JobQueue;
    private readonly logger: Logger;
    private readonly workspaceOrigin: string;

    constructor(jobs: JobQueue, logger: Logger, workspaceOrigin: string) {
        this.jobs = jobs;
        this.logger = logger;
        this.workspaceOrigin = workspaceOrigin;
    }

    async handle(
        eventType: string,
        payload: Record<string, unknown>,
        session: DatabaseSession,
    ): Promise<void> {
        const intents = buildNotificationIntents(eventType, payload, this.workspaceOrigin);
        if (intents.length === 0) {
            this.logger.debug("Notification event produced no intent.", { eventType });
            return;
        }
        await Promise.all(
            intents.map((intent) =>
                this.jobs.enqueue(session, {
                    kind: NOTIFICATION_DELIVERY_JOB,
                    payload: {
                        userId: intent.userId,
                        email: intent.email,
                        organizationId: intent.organizationId,
                        kind: intent.kind,
                        title: intent.title,
                        body: intent.body,
                        linkUrl: intent.linkUrl,
                        dedupeKey: intent.dedupeKey,
                    },
                    organizationId: intent.organizationId,
                    dedupeKey: `notifications.deliver:${intent.dedupeKey}`,
                }),
            ),
        );
    }
}
