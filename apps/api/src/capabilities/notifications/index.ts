import type { CapabilityDefinition } from "../../core/capability.js";
import { domainEvents } from "../../core/domain-event.js";
import {
    NotificationDeliveryService,
    NOTIFICATION_DELIVERY_JOB,
} from "./application/notification-delivery.js";
import { NotificationEventHandler } from "./application/notification-event-handler.js";
import { NotificationService } from "./application/notification-service.js";
import { registerNotificationRoutes } from "./http/notification-routes.js";
import { NotificationRepository } from "./infrastructure/notification-repository.js";

const SUBSCRIBED_EVENTS: readonly string[] = [
    domainEvents.membershipGranted,
    domainEvents.registrationDecided,
    domainEvents.teamCreated,
    domainEvents.teamInvitationCreated,
    domainEvents.teamInvitationAccepted,
    domainEvents.submissionReviewed,
    domainEvents.judgeAssigned,
    domainEvents.votingOpened,
    domainEvents.announcementPublished,
];

export const notificationsCapability: CapabilityDefinition = {
    id: "notifications",
    version: "1.0.0",
    dependencies: ["identity"],
    async register(context) {
        const repository = new NotificationRepository();
        const service = new NotificationService(context.database, repository, context.clock);
        const eventHandler = new NotificationEventHandler(
            context.jobs,
            context.logger,
            context.config.origins.workspace,
        );
        const delivery = new NotificationDeliveryService(
            repository,
            context.config,
            context.mailer,
            context.clock,
        );

        return {
            registerRoutes: async (app) => {
                await registerNotificationRoutes(app, context, service);
            },
            events: SUBSCRIBED_EVENTS.map((eventType) => ({
                eventType,
                handle: (payload, session) => eventHandler.handle(eventType, payload, session),
            })),
            jobs: [
                {
                    kind: NOTIFICATION_DELIVERY_JOB,
                    handle: (payload, session) => delivery.deliver(payload, session),
                },
            ],
        };
    },
};
