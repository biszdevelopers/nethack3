import type { CapabilityDefinition } from "../../core/capability.js";
import { COMPETITIONS_CONTRACT, type CompetitionsContract } from "../competitions/contracts.js";
import { PARTICIPANTS_CONTRACT, type ParticipantsContract } from "../participants/contracts.js";
import { ORGANIZATIONS_CONTRACT, type OrganizationsContract } from "../organizations/contracts.js";
import { TeamService, toTeam } from "./application/team-service.js";
import { TeamRepository } from "./infrastructure/team-repository.js";
import { registerTeamRoutes } from "./http/team-routes.js";
import { TEAMS_CONTRACT, type TeamsContract, type TeamSummary } from "./contracts.js";

export const teamsCapability: CapabilityDefinition = {
    id: "teams",
    version: "1.0.0",
    dependencies: ["competitions", "participants"],
    async register(context) {
        const repository = new TeamRepository();
        const competitions = context.contracts.get<CompetitionsContract>(COMPETITIONS_CONTRACT);
        const participants = context.contracts.get<ParticipantsContract>(PARTICIPANTS_CONTRACT);
        const organizations = context.contracts.get<OrganizationsContract>(ORGANIZATIONS_CONTRACT);
        const service = new TeamService(
            context.database,
            repository,
            context.events,
            context.audit,
            context.clock,
            competitions,
            participants,
            organizations,
        );

        const contract: TeamsContract = {
            async getTeam(organizationId, teamId) {
                return context.database.transaction({ organizationId }, async (session) => {
                    const team = await repository.findById(session.db, organizationId, teamId);
                    if (team === null) {
                        return null;
                    }
                    const memberCount = await repository.countMembers(session.db, teamId);
                    return toSummary(toTeam(team, memberCount));
                });
            },
            async isTeamMember(organizationId, teamId, userId) {
                return context.database.transaction({ organizationId }, async (session) => {
                    const member = await repository.findMember(session.db, teamId, userId);
                    return member !== null;
                });
            },
            async getTeamForUser(organizationId, editionId, userId) {
                return context.database.transaction({ organizationId }, async (session) => {
                    const team = await repository.findByUserInEdition(
                        session.db,
                        organizationId,
                        editionId,
                        userId,
                    );
                    if (team === null) {
                        return null;
                    }
                    const memberCount = await repository.countMembers(session.db, team.id);
                    return toSummary(toTeam(team, memberCount));
                });
            },
            async countTeams(organizationId, editionId) {
                return context.database.transaction({ organizationId }, async (session) =>
                    repository.countByEdition(session.db, organizationId, editionId),
                );
            },
        };

        return {
            contracts: { [TEAMS_CONTRACT]: contract },
            registerRoutes: async (app) => {
                await registerTeamRoutes(app, context, service);
            },
        };
    },
};

function toSummary(team: ReturnType<typeof toTeam>): TeamSummary {
    return {
        id: team.id,
        organizationId: team.organizationId,
        editionId: team.editionId,
        divisionId: team.divisionId,
        name: team.name,
        description: team.description,
        status: team.status,
        captainUserId: team.captainUserId,
        memberCount: team.memberCount,
        maxMembers: team.maxMembers,
    };
}
