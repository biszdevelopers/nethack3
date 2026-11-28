import type { CapabilityDefinition } from "../../core/capability.js";
import { PROJECTS_CONTRACT, type ProjectsContract } from "../projects/contracts.js";
import { FileService } from "./application/file-service.js";
import { FILES_CONTRACT, type FilesContract } from "./contracts.js";
import { registerFileRoutes } from "./http/file-routes.js";
import { FileRepository } from "./infrastructure/file-repository.js";

export const filesCapability: CapabilityDefinition = {
    id: "files",
    version: "1.0.0",
    dependencies: ["projects"],
    async register(context) {
        const repository = new FileRepository();
        const service = new FileService(
            context.database,
            repository,
            context.storage,
            context.audit,
            context.clock,
            context.contracts.get<ProjectsContract>(PROJECTS_CONTRACT),
        );

        const contract: FilesContract = {
            async getFile(organizationId, fileId) {
                return service.contractGetFile(organizationId, fileId);
            },
            async listProjectFiles(organizationId, projectId) {
                const rows = await context.database.transaction(
                    { organizationId },
                    async (session) =>
                        repository.listApproved(session.db, organizationId, projectId),
                );
                return rows.map((row) => ({
                    id: row.id,
                    organizationId: row.organizationId,
                    fileName: row.fileName,
                    contentType: row.contentType,
                    byteSize: row.byteSize,
                    checksumSha256: row.checksumSha256,
                    status: row.status,
                }));
            },
            async listStoredFiles(organizationIds, query) {
                return service.contractListStoredFiles(organizationIds, query);
            },
            async attachToSubmission(organizationId, fileId, submissionId, versionId) {
                await service.contractAttachToSubmission(
                    organizationId,
                    fileId,
                    submissionId,
                    versionId,
                );
            },
        };

        return {
            contracts: { [FILES_CONTRACT]: contract },
            registerRoutes: async (app) => {
                await registerFileRoutes(app, context, service);
            },
        };
    },
};
