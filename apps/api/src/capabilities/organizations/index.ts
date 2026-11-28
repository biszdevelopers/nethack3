import type { CapabilityDefinition } from "../../core/capability.js";
import { TEAMS_CONTRACT, type TeamsContract } from "../teams/contracts.js";
import { OrganizationService } from "./application/organization-service.js";
import { OrganizationRepository } from "./infrastructure/organization-repository.js";
import { registerOrganizationRoutes } from "./http/organization-routes.js";
import { ORGANIZATIONS_CONTRACT, type OrganizationsContract } from "./contracts.js";

export const organizationsCapability: CapabilityDefinition = {
    id: "organizations",
    version: "1.0.0",
    dependencies: ["identity"],
    async register(context) {
        const repository = new OrganizationRepository();
        const service = new OrganizationService(
            context.database,
            repository,
            context.events,
            context.audit,
            context.clock,
            () => context.contracts.get<TeamsContract>(TEAMS_CONTRACT),
        );

        const contract: OrganizationsContract = {
            async getSummary(organizationId) {
                const organization = await repository.findById(context.database.db, organizationId);
                return organization === null
                    ? null
                    : {
                          id: organization.id,
                          name: organization.name,
                          slug: organization.slug,
                          description: organization.description,
                          websiteUrl: organization.websiteUrl,
                      };
            },
            async getSummaryBySlug(slug) {
                const organization = await repository.findBySlug(context.database.db, slug);
                return organization === null
                    ? null
                    : {
                          id: organization.id,
                          name: organization.name,
                          slug: organization.slug,
                          description: organization.description,
                          websiteUrl: organization.websiteUrl,
                      };
            },
            async isPublicShowcaseEnabled(organizationId) {
                try {
                    return await context.database.transaction(
                        { organizationId },
                        async (session) => {
                            const settings = await repository.settings(session.db, organizationId);
                            return settings.publicShowcaseEnabled;
                        },
                    );
                } catch {
                    return false;
                }
            },
            async getMembershipRole(organizationId, userId) {
                const membership = await repository.membership(
                    context.database.db,
                    organizationId,
                    userId,
                );
                return membership !== null && membership.status === "active"
                    ? membership.role
                    : null;
            },
            async listMembershipsWithUsers(organizationId) {
                return service.listMembershipsWithUsers(organizationId);
            },
            async updateMemberRole(actor, organizationId, userId, role) {
                return service.updateMemberRole(actor, organizationId, userId, role);
            },
        };

        return {
            contracts: { [ORGANIZATIONS_CONTRACT]: contract },
            registerRoutes: async (app) => {
                await registerOrganizationRoutes(app, context, service);
            },
        };
    },
};
