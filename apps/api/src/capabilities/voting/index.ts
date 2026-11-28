import type { CapabilityDefinition } from "../../core/capability.js";
import { COMPETITIONS_CONTRACT, type CompetitionsContract } from "../competitions/contracts.js";
import { ORGANIZATIONS_CONTRACT, type OrganizationsContract } from "../organizations/contracts.js";
import { PARTICIPANTS_CONTRACT, type ParticipantsContract } from "../participants/contracts.js";
import { PROJECTS_CONTRACT, type ProjectsContract } from "../projects/contracts.js";
import { SUBMISSIONS_CONTRACT, type SubmissionsContract } from "../submissions/contracts.js";
import { TEAMS_CONTRACT, type TeamsContract } from "../teams/contracts.js";
import { VotingService } from "./application/voting-service.js";
import { VOTING_CONTRACT, type VotingContract } from "./contracts.js";
import { registerVotingRoutes } from "./http/voting-routes.js";
import { VotingRepository } from "./infrastructure/voting-repository.js";

export const votingCapability: CapabilityDefinition = {
    id: "voting",
    version: "1.0.0",
    dependencies: [
        "organizations",
        "competitions",
        "participants",
        "submissions",
        "teams",
        "projects",
    ],
    async register(context) {
        const repository = new VotingRepository();
        const competitions = context.contracts.get<CompetitionsContract>(COMPETITIONS_CONTRACT);
        const submissions = context.contracts.get<SubmissionsContract>(SUBMISSIONS_CONTRACT);
        const participants = context.contracts.get<ParticipantsContract>(PARTICIPANTS_CONTRACT);
        const organizations = context.contracts.get<OrganizationsContract>(ORGANIZATIONS_CONTRACT);
        const teams = context.contracts.get<TeamsContract>(TEAMS_CONTRACT);
        const projects = context.contracts.get<ProjectsContract>(PROJECTS_CONTRACT);
        const service = new VotingService(
            context.database,
            repository,
            competitions,
            submissions,
            participants,
            organizations,
            teams,
            projects,
            context.events,
            context.audit,
            context.clock,
        );

        const contract: VotingContract = {
            listRounds: (organizationId, editionId) =>
                service.listRounds(organizationId, editionId),
            getPublishedResults: (organizationId, editionId) =>
                service.publishedResults(organizationId, editionId),
            closeOpenRoundsForResults: (session, organizationId, editionId, actorUserId) =>
                service.closeOpenRoundsForResults(session, organizationId, editionId, actorUserId),
            removeSubmissionVotes: (organizationId, submissionId) =>
                service.removeSubmissionVotes(organizationId, submissionId),
        };

        return {
            contracts: { [VOTING_CONTRACT]: contract },
            registerRoutes: async (app) => {
                await registerVotingRoutes(app, context, service);
            },
        };
    },
};
