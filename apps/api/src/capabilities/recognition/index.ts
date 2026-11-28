import type { CapabilityDefinition } from "../../core/capability.js";
import { COMPETITIONS_CONTRACT, type CompetitionsContract } from "../competitions/contracts.js";
import { JUDGING_CONTRACT, type JudgingContract } from "../judging/contracts.js";
import { ORGANIZATIONS_CONTRACT, type OrganizationsContract } from "../organizations/contracts.js";
import { SUBMISSIONS_CONTRACT, type SubmissionsContract } from "../submissions/contracts.js";
import { TEAMS_CONTRACT, type TeamsContract } from "../teams/contracts.js";
import { VOTING_CONTRACT, type VotingContract } from "../voting/contracts.js";
import { RecognitionService } from "./application/recognition-service.js";
import { RECOGNITION_CONTRACT, type RecognitionContract } from "./contracts.js";
import { registerRecognitionRoutes } from "./http/recognition-routes.js";
import { RecognitionRepository } from "./infrastructure/recognition-repository.js";

export const recognitionCapability: CapabilityDefinition = {
    id: "recognition",
    version: "1.0.0",
    dependencies: ["organizations", "competitions", "teams", "submissions", "judging", "voting"],
    async register(context) {
        const repository = new RecognitionRepository();
        const service = new RecognitionService(
            context.database,
            repository,
            context.contracts.get<CompetitionsContract>(COMPETITIONS_CONTRACT),
            context.contracts.get<TeamsContract>(TEAMS_CONTRACT),
            context.contracts.get<SubmissionsContract>(SUBMISSIONS_CONTRACT),
            context.contracts.get<JudgingContract>(JUDGING_CONTRACT),
            context.contracts.get<VotingContract>(VOTING_CONTRACT),
            context.contracts.get<OrganizationsContract>(ORGANIZATIONS_CONTRACT),
            context.audit,
            context.clock,
        );

        const contract: RecognitionContract = {
            getPublishedResults: (organizationId, editionId) =>
                service.published(organizationId, editionId),
        };

        return {
            contracts: { [RECOGNITION_CONTRACT]: contract },
            registerRoutes: async (app) => {
                await registerRecognitionRoutes(app, context, service);
            },
        };
    },
};
