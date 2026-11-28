import type { CapabilityDefinition } from "../../core/capability.js";
import { COMPETITIONS_CONTRACT, type CompetitionsContract } from "../competitions/contracts.js";
import { ORGANIZATIONS_CONTRACT, type OrganizationsContract } from "../organizations/contracts.js";
import { PROJECTS_CONTRACT, type ProjectsContract } from "../projects/contracts.js";
import { SUBMISSIONS_CONTRACT, type SubmissionsContract } from "../submissions/contracts.js";
import { TEAMS_CONTRACT, type TeamsContract } from "../teams/contracts.js";
import { JudgingService, type JudgingContracts } from "./application/judging-service.js";
import { JUDGING_CONTRACT, type JudgingContract } from "./contracts.js";
import { registerJudgingRoutes } from "./http/judging-routes.js";
import { JudgingRepository } from "./infrastructure/judging-repository.js";

export const judgingCapability: CapabilityDefinition = {
    id: "judging",
    version: "1.0.0",
    dependencies: ["submissions", "competitions", "organizations", "teams", "projects"],
    async register(context) {
        const repository = new JudgingRepository();
        const contracts: JudgingContracts = {
            submissions: context.contracts.get<SubmissionsContract>(SUBMISSIONS_CONTRACT),
            competitions: context.contracts.get<CompetitionsContract>(COMPETITIONS_CONTRACT),
            organizations: context.contracts.get<OrganizationsContract>(ORGANIZATIONS_CONTRACT),
            teams: context.contracts.get<TeamsContract>(TEAMS_CONTRACT),
            projects: context.contracts.get<ProjectsContract>(PROJECTS_CONTRACT),
        };
        const service = new JudgingService(
            context.database,
            repository,
            contracts,
            context.events,
            context.audit,
            context.clock,
        );

        const contract: JudgingContract = {
            async getAssignment(organizationId, assignmentId) {
                return service.getAssignment(organizationId, assignmentId);
            },
            async listEditionResults(organizationId, editionId) {
                return service.editionResultsForOrganization(organizationId, editionId);
            },
            async countSubmittedEvaluations(organizationId, editionId) {
                return service.countSubmittedEvaluations(organizationId, editionId);
            },
            async countOpenFlags(organizationId, editionId) {
                return service.countOpenFlags(organizationId, editionId);
            },
            async getEvaluation(organizationId, assignmentId) {
                return service.getEvaluation(organizationId, assignmentId);
            },
            async listTeamFeedback(organizationId, editionId, teamId) {
                return service.teamFeedbackForOrganization(organizationId, editionId, teamId);
            },
        };

        return {
            contracts: { [JUDGING_CONTRACT]: contract },
            registerRoutes: async (app) => {
                await registerJudgingRoutes(app, context, service);
            },
        };
    },
};
