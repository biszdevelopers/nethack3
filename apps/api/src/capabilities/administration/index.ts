import type { CapabilityDefinition } from "../../core/capability.js";
import { COMPETITIONS_CONTRACT, type CompetitionsContract } from "../competitions/contracts.js";
import { JUDGING_CONTRACT, type JudgingContract } from "../judging/contracts.js";
import { PARTICIPANTS_CONTRACT, type ParticipantsContract } from "../participants/contracts.js";
import { PROJECTS_CONTRACT, type ProjectsContract } from "../projects/contracts.js";
import { SUBMISSIONS_CONTRACT, type SubmissionsContract } from "../submissions/contracts.js";
import { TEAMS_CONTRACT, type TeamsContract } from "../teams/contracts.js";
import { AdministrationService } from "./application/administration-service.js";
import { ReportService } from "./application/report-service.js";
import { registerAdministrationRoutes } from "./http/administration-routes.js";
import { AdministrationRepository } from "./infrastructure/administration-repository.js";

export const administrationCapability: CapabilityDefinition = {
    id: "administration",
    version: "1.0.0",
    dependencies: [
        "identity",
        "organizations",
        "competitions",
        "participants",
        "teams",
        "projects",
        "submissions",
        "judging",
    ],
    async register(context) {
        const repository = new AdministrationRepository();
        const service = new AdministrationService(
            context.database,
            repository,
            context.audit,
            context.clock,
        );
        const reports = new ReportService({
            editions: context.contracts.get<CompetitionsContract>(COMPETITIONS_CONTRACT),
            registrations: context.contracts.get<ParticipantsContract>(PARTICIPANTS_CONTRACT),
            teams: context.contracts.get<TeamsContract>(TEAMS_CONTRACT),
            projects: context.contracts.get<ProjectsContract>(PROJECTS_CONTRACT),
            submissions: context.contracts.get<SubmissionsContract>(SUBMISSIONS_CONTRACT),
            evaluations: context.contracts.get<JudgingContract>(JUDGING_CONTRACT),
        });

        return {
            registerRoutes: async (app) => {
                await registerAdministrationRoutes(app, context, service, reports);
            },
        };
    },
};
