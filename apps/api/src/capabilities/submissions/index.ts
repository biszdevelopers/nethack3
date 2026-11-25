import type { CapabilityDefinition } from "../../core/capability.js";
import { COMPETITIONS_CONTRACT, type CompetitionsContract } from "../competitions/contracts.js";
import { FILES_CONTRACT, type FilesContract } from "../files/contracts.js";
import { ORGANIZATIONS_CONTRACT, type OrganizationsContract } from "../organizations/contracts.js";
import { PROJECTS_CONTRACT, type ProjectsContract } from "../projects/contracts.js";
import { TEAMS_CONTRACT, type TeamsContract } from "../teams/contracts.js";
import {
    SubmissionService,
    toSubmissionSummary,
    type SubmissionContracts,
} from "./application/submission-service.js";
import { SUBMISSIONS_CONTRACT, type SubmissionsContract } from "./contracts.js";
import { registerSubmissionRoutes } from "./http/submission-routes.js";
import { SubmissionRepository } from "./infrastructure/submission-repository.js";

export const submissionsCapability: CapabilityDefinition = {
    id: "submissions",
    version: "1.0.0",
    dependencies: ["projects", "teams", "files", "competitions", "participants", "organizations"],
    async register(context) {
        const repository = new SubmissionRepository();
        const contracts: SubmissionContracts = {
            projects: context.contracts.get<ProjectsContract>(PROJECTS_CONTRACT),
            teams: context.contracts.get<TeamsContract>(TEAMS_CONTRACT),
            competitions: context.contracts.get<CompetitionsContract>(COMPETITIONS_CONTRACT),
            files: context.contracts.get<FilesContract>(FILES_CONTRACT),
            organizations: context.contracts.get<OrganizationsContract>(ORGANIZATIONS_CONTRACT),
        };
        const service = new SubmissionService(
            context.database,
            repository,
            contracts,
            context.events,
            context.audit,
            context.clock,
        );

        const contract: SubmissionsContract = {
            async getSubmission(organizationId, submissionId) {
                return context.database.transaction({ organizationId }, async (session) => {
                    const row = await repository.findById(session.db, organizationId, submissionId);
                    if (row === null) {
                        return null;
                    }
                    const version =
                        row.currentVersion === 0
                            ? null
                            : await repository.findVersion(
                                  session.db,
                                  organizationId,
                                  submissionId,
                                  row.currentVersion,
                              );
                    return toSubmissionSummary(row, version);
                });
            },
            async listEditionSubmissions(organizationId, editionId) {
                const rows = await context.database.transaction(
                    { organizationId },
                    async (session) =>
                        repository.listWithCurrentVersion(session.db, organizationId, editionId),
                );
                return rows.map((row) =>
                    toSubmissionSummary(row.submission, {
                        title: row.title ?? "",
                        summary: row.summary ?? "",
                    }),
                );
            },
            async isSubmittedForProject(organizationId, projectId) {
                return context.database.transaction({ organizationId }, async (session) =>
                    repository.hasSubmittedProject(session.db, organizationId, projectId),
                );
            },
            async countSubmissions(organizationId, editionId) {
                return context.database.transaction({ organizationId }, async (session) =>
                    repository.countByEdition(session.db, organizationId, editionId),
                );
            },
        };

        return {
            contracts: { [SUBMISSIONS_CONTRACT]: contract },
            registerRoutes: async (app) => {
                await registerSubmissionRoutes(app, context, service);
            },
        };
    },
};
