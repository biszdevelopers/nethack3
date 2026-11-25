import type { CapabilityDefinition } from "../../core/capability.js";
import { AnnouncementService } from "./application/announcement-service.js";
import { AnnouncementRepository } from "./infrastructure/announcement-repository.js";
import { registerAnnouncementRoutes } from "./http/announcement-routes.js";
import { ANNOUNCEMENTS_CONTRACT, type AnnouncementsContract } from "./contracts.js";
import { ORGANIZATIONS_CONTRACT, type OrganizationsContract } from "../organizations/contracts.js";

export const announcementsCapability: CapabilityDefinition = {
    id: "announcements",
    version: "1.0.0",
    dependencies: ["organizations"],
    async register(context) {
        const repository = new AnnouncementRepository();
        const organizations = context.contracts.get<OrganizationsContract>(ORGANIZATIONS_CONTRACT);
        const service = new AnnouncementService(
            context.database,
            repository,
            context.events,
            context.audit,
            context.clock,
            organizations,
        );

        const contract: AnnouncementsContract = {
            listPublished: (organizationId, options) =>
                service.listPublished(organizationId, options),
        };

        return {
            contracts: { [ANNOUNCEMENTS_CONTRACT]: contract },
            registerRoutes: async (app) => {
                await registerAnnouncementRoutes(app, context, service);
            },
        };
    },
};
