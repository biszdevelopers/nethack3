import type { CapabilityDefinition } from "../../core/capability.js";
import { COMPETITIONS_CONTRACT, type CompetitionsContract } from "../competitions/contracts.js";
import { ORGANIZATIONS_CONTRACT, type OrganizationsContract } from "../organizations/contracts.js";
import { PARTICIPANTS_CONTRACT, type ParticipantsContract } from "../participants/contracts.js";
import { TEAMS_CONTRACT, type TeamsContract } from "../teams/contracts.js";
import {
    ProjectService,
    toProjectSummary,
    type ProjectContracts,
} from "./application/project-service.js";
import { PROJECTS_CONTRACT, type ProjectsContract } from "./contracts.js";
import { registerProjectRoutes } from "./http/project-routes.js";
import { ProjectRepository } from "./infrastructure/project-repository.js";

export const projectsCapability: CapabilityDefinition = {
    id: "projects",
    version: "1.0.0",
    dependencies: ["organizations", "competitions", "participants", "teams"],
    async register(context) {
        const repository = new ProjectRepository();
        const contracts: ProjectContracts = {
            competitions: context.contracts.get<CompetitionsContract>(COMPETITIONS_CONTRACT),
            organizations: context.contracts.get<OrganizationsContract>(ORGANIZATIONS_CONTRACT),
            participants: context.contracts.get<ParticipantsContract>(PARTICIPANTS_CONTRACT),
            teams: context.contracts.get<TeamsContract>(TEAMS_CONTRACT),
        };
        const service = new ProjectService(
            context.database,
            repository,
            contracts,
            context.events,
            context.audit,
            context.clock,
        );

        const contract: ProjectsContract = {
            async getProject(organizationId, projectId) {
                const row = await context.database.transaction(
                    { organizationId },
                    async (session) => repository.findById(session.db, organizationId, projectId),
                );
                return row === null ? null : toProjectSummary(row);
            },
            async isProjectMember(organizationId, projectId, userId) {
                return context.database.transaction({ organizationId, userId }, async (session) =>
                    repository.isMemberOrOwner(session.db, organizationId, projectId, userId),
                );
            },
            async listTeamProjects(organizationId, teamId) {
                const rows = await context.database.transaction(
                    { organizationId },
                    async (session) =>
                        repository.listTeamProjects(session.db, organizationId, teamId),
                );
                return rows.map(toProjectSummary);
            },
            async countProjects(organizationId, editionId) {
                return context.database.transaction({ organizationId }, async (session) =>
                    repository.countByEdition(session.db, organizationId, editionId),
                );
            },
        };

        return {
            contracts: { [PROJECTS_CONTRACT]: contract },
            registerRoutes: async (app) => {
                await registerProjectRoutes(app, context, service);
            },
        };
    },
};
