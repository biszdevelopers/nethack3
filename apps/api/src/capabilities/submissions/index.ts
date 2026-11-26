import type { CapabilityDefinition } from "../../core/capability.js";
import { COMPETITIONS_CONTRACT, type CompetitionsContract } from "../competitions/contracts.js";
import { FILES_CONTRACT, type FilesContract } from "../files/contracts.js";
import { ORGANIZATIONS_CONTRACT, type OrganizationsContract } from "../organizations/contracts.js";
import {
    PROJECTS_CONTRACT,
    type ProjectSummary,
    type ProjectsContract,
} from "../projects/contracts.js";
import { TEAMS_CONTRACT, type TeamsContract } from "../teams/contracts.js";
import {
    SubmissionService,
    toSubmissionSummary,
    type SubmissionContracts,
} from "./application/submission-service.js";
import { SubmissionRules } from "./domain/submission-rules.js";
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
                const loaded = await context.database.transaction(
                    { organizationId },
                    async (session) => {
                        const row = await repository.findById(
                            session.db,
                            organizationId,
                            submissionId,
                        );
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
                        return { row, version };
                    },
                );
                if (loaded === null) {
                    return null;
                }
                const needsProject =
                    loaded.version === null || loaded.version.title.trim().length === 0;
                const project = needsProject
                    ? await contracts.projects.getProject(organizationId, loaded.row.projectId)
                    : null;
                return toSubmissionSummary(loaded.row, {
                    title: SubmissionRules.displayTitle(
                        loaded.version?.title ?? null,
                        project?.title ?? null,
                    ),
                    summary: loaded.version?.summary ?? project?.summary ?? "",
                });
            },
            async listEditionSubmissions(organizationId, editionId) {
                const rows = await context.database.transaction(
                    { organizationId },
                    async (session) =>
                        repository.list(session.db, {
                            organizationId,
                            editionId,
                            projectId: null,
                            cursor: null,
                            limit: null,
                        }),
                );
                const projects = new Map<string, Promise<ProjectSummary | null>>();
                const projectOf = (projectId: string): Promise<ProjectSummary | null> => {
                    const cached = projects.get(projectId);
                    if (cached !== undefined) {
                        return cached;
                    }
                    const pending = contracts.projects.getProject(organizationId, projectId);
                    projects.set(projectId, pending);
                    return pending;
                };
                return Promise.all(
                    rows.map(async (row) => {
                        const project =
                            row.title === null ? await projectOf(row.submission.projectId) : null;
                        return toSubmissionSummary(row.submission, {
                            title: SubmissionRules.displayTitle(row.title, project?.title ?? null),
                            summary: row.summary ?? project?.summary ?? "",
                        });
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
