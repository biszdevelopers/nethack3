import type { CapabilityDefinition } from "../../core/capability.js";
import { COMPETITIONS_CONTRACT, type CompetitionsContract } from "../competitions/contracts.js";
import { FILES_CONTRACT, type FilesContract } from "../files/contracts.js";
import { JUDGING_CONTRACT, type JudgingContract } from "../judging/contracts.js";
import { ORGANIZATIONS_CONTRACT, type OrganizationsContract } from "../organizations/contracts.js";
import { PARTICIPANTS_CONTRACT, type ParticipantsContract } from "../participants/contracts.js";
import { PROJECTS_CONTRACT, type ProjectsContract } from "../projects/contracts.js";
import { SUBMISSIONS_CONTRACT, type SubmissionsContract } from "../submissions/contracts.js";
import { TEAMS_CONTRACT, type TeamsContract } from "../teams/contracts.js";
import { VOTING_CONTRACT, type VotingContract } from "../voting/contracts.js";
import { AdministrationService } from "./application/administration-service.js";
import { DatabaseExportService } from "./application/database-export.js";
import { DebugAiService, loadAiConfiguration } from "./application/debug-ai-service.js";
import { EditionAdministrationService } from "./application/edition-administration-service.js";
import { PreflightService } from "./application/preflight-service.js";
import { ReportService } from "./application/report-service.js";
import { registerAdministrationRoutes } from "./http/administration-routes.js";
import { registerOperatorRoutes } from "./http/operator-routes.js";
import { AccountDeletionRepository } from "./infrastructure/account-deletion-repository.js";
import { AdministrationRepository } from "./infrastructure/administration-repository.js";
import { PostgresDatabaseExportSource } from "./infrastructure/database-export-repository.js";
import { DebugAiRepository } from "./infrastructure/debug-ai-repository.js";

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
        "files",
        "judging",
        "voting",
    ],
    async register(context) {
        const repository = new AdministrationRepository();
        const databaseExport = new DatabaseExportService(
            new PostgresDatabaseExportSource(context.database),
            context.clock,
        );
        const debugAi = new DebugAiService(
            context.database,
            new DebugAiRepository(),
            context.clock,
            loadAiConfiguration(process.env),
        );
        const organizationsContract =
            context.contracts.get<OrganizationsContract>(ORGANIZATIONS_CONTRACT);
        const service = new AdministrationService(
            context.database,
            repository,
            new AccountDeletionRepository(),
            context.audit,
            context.clock,
            organizationsContract,
        );
        const editionsContract = context.contracts.get<CompetitionsContract>(COMPETITIONS_CONTRACT);
        const teamsContract = context.contracts.get<TeamsContract>(TEAMS_CONTRACT);
        const submissionsContract =
            context.contracts.get<SubmissionsContract>(SUBMISSIONS_CONTRACT);
        const judgingContract = context.contracts.get<JudgingContract>(JUDGING_CONTRACT);
        const filesContract = context.contracts.get<FilesContract>(FILES_CONTRACT);
        const reports = new ReportService({
            editions: editionsContract,
            registrations: context.contracts.get<ParticipantsContract>(PARTICIPANTS_CONTRACT),
            teams: teamsContract,
            projects: context.contracts.get<ProjectsContract>(PROJECTS_CONTRACT),
            submissions: submissionsContract,
            evaluations: judgingContract,
        });
        const editionService = new EditionAdministrationService({
            editions: editionsContract,
            teams: teamsContract,
            submissions: submissionsContract,
            judging: judgingContract,
        });
        const preflight = new PreflightService(
            {
                editions: editionsContract,
                teams: teamsContract,
                projects: context.contracts.get<ProjectsContract>(PROJECTS_CONTRACT),
                submissions: submissionsContract,
                judging: judgingContract,
                voting: context.contracts.get<VotingContract>(VOTING_CONTRACT),
                participants: context.contracts.get<ParticipantsContract>(PARTICIPANTS_CONTRACT),
            },
            context.clock,
        );

        return {
            registerRoutes: async (app) => {
                await registerAdministrationRoutes(
                    app,
                    context,
                    service,
                    reports,
                    editionService,
                    preflight,
                );
                await registerOperatorRoutes(
                    app,
                    context,
                    databaseExport,
                    debugAi,
                    filesContract,
                    repository,
                );
            },
        };
    },
};
