import type { CapabilityDefinition } from "../../core/capability.js";
import { NotFoundError } from "../../core/errors.js";
import { COMPETITIONS_CONTRACT, type CompetitionsContract } from "../competitions/contracts.js";
import { ORGANIZATIONS_CONTRACT, type OrganizationsContract } from "../organizations/contracts.js";
import { RegistrationService } from "./application/registration-service.js";
import { PARTICIPANTS_CONTRACT, type ParticipantsContract } from "./contracts.js";
import { registerParticipationRoutes } from "./http/participation-routes.js";
import { RegistrationRepository } from "./infrastructure/registration-repository.js";

export const participantsCapability: CapabilityDefinition = {
    id: "participants",
    version: "1.0.0",
    dependencies: ["competitions"],
    async register(context) {
        const repository = new RegistrationRepository();
        const competitions = context.contracts.get<CompetitionsContract>(COMPETITIONS_CONTRACT);
        const organizations = context.contracts.get<OrganizationsContract>(ORGANIZATIONS_CONTRACT);
        const service = new RegistrationService(
            context.database,
            repository,
            competitions,
            organizations,
            context.events,
            context.audit,
            context.clock,
        );

        const contract: ParticipantsContract = {
            async getRegistration(organizationId, editionId, userId) {
                return context.database.transaction({ organizationId }, async (session) => {
                    const registration = await repository.findRegistration(
                        session.db,
                        organizationId,
                        editionId,
                        userId,
                    );
                    if (registration === null) {
                        return null;
                    }
                    const participant = await repository.findParticipant(
                        session.db,
                        organizationId,
                        editionId,
                        userId,
                    );
                    return {
                        registrationId: registration.id,
                        status: registration.status,
                        divisionId: registration.divisionId,
                        participantId: participant === null ? null : participant.id,
                    };
                });
            },
            async isApprovedParticipant(organizationId, editionId, userId) {
                return context.database.transaction({ organizationId }, async (session) => {
                    const participant = await repository.findParticipant(
                        session.db,
                        organizationId,
                        editionId,
                        userId,
                    );
                    return participant !== null;
                });
            },
            async countApprovedParticipants(organizationId, editionId) {
                return context.database.transaction({ organizationId }, (session) =>
                    repository.countParticipants(session.db, organizationId, editionId),
                );
            },
            async countRegistrations(organizationId, editionId) {
                return context.database.transaction({ organizationId }, (session) =>
                    repository.countRegistrations(session.db, organizationId, editionId),
                );
            },
            async setParticipantTeam(organizationId, editionId, userId, teamId) {
                await context.database.transaction({ organizationId }, async (session) => {
                    const updated = await repository.updateParticipantTeam(
                        session,
                        organizationId,
                        editionId,
                        userId,
                        teamId,
                    );
                    if (!updated) {
                        throw new NotFoundError("The participant was not found.");
                    }
                });
            },
        };

        return {
            contracts: { [PARTICIPANTS_CONTRACT]: contract },
            registerRoutes: async (app) => {
                await registerParticipationRoutes(app, context, service);
            },
        };
    },
};
