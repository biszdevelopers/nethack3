import { randomUUID } from "node:crypto";
import type { OrganizationRole, SubmissionFile } from "@nethack/contracts";
import type { AuthContext } from "../../../authentication/types.js";
import type { Clock } from "../../../core/clock.js";
import type { DatabaseConnection } from "../../../infrastructure/database/client.js";
import type { AuditLogger } from "../../../infrastructure/audit/audit-logger.js";
import type { FileStorage } from "../../../infrastructure/storage/file-storage.js";
import {
    AppError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    PayloadTooLargeError,
    ValidationError,
} from "../../../core/errors.js";
import type { ProjectsContract } from "../../projects/contracts.js";
import { inspectFileUpload } from "../domain/file-inspector.js";
import type { StoredFileSummary } from "../contracts.js";
import type { FileRepository, FileRow } from "../infrastructure/file-repository.js";

export interface UploadInput {
    readonly organizationId: string;
    readonly projectId: string;
    readonly userId: string;
    readonly organizationRole: OrganizationRole;
    readonly buffer: Buffer;
    readonly fileName: string;
    readonly checksumSha256: string;
    readonly maxBytes: number;
    readonly ip: string | null;
}

export interface DownloadResolution {
    readonly file: FileRow;
    readonly visibility: "private" | "public";
}

export class FileService {
    private readonly database: DatabaseConnection;
    private readonly repository: FileRepository;
    private readonly storage: FileStorage;
    private readonly audit: AuditLogger;
    private readonly clock: Clock;
    private readonly projects: ProjectsContract;

    constructor(
        database: DatabaseConnection,
        repository: FileRepository,
        storage: FileStorage,
        audit: AuditLogger,
        clock: Clock,
        projects: ProjectsContract,
    ) {
        this.database = database;
        this.repository = repository;
        this.storage = storage;
        this.audit = audit;
        this.clock = clock;
        this.projects = projects;
    }

    async authorizeUpload(
        organizationId: string,
        projectId: string,
        userId: string,
        organizationRole: OrganizationRole,
    ): Promise<void> {
        await this.assertUploadAllowed(organizationId, projectId, userId, organizationRole);
    }

    async upload(input: UploadInput): Promise<SubmissionFile> {
        if (input.buffer.length === 0) {
            throw new ValidationError("The uploaded file is empty.");
        }
        if (input.buffer.length > input.maxBytes) {
            throw new PayloadTooLargeError("The uploaded file exceeds the size limit.");
        }
        const inspection = inspectFileUpload({
            buffer: input.buffer,
            fileName: input.fileName,
        });
        if (!inspection.ok) {
            if (inspection.code === "unsupported_media_type") {
                throw new AppError("unsupported_media_type", 400, inspection.message);
            }
            throw new ValidationError(inspection.message);
        }
        await this.assertUploadAllowed(
            input.organizationId,
            input.projectId,
            input.userId,
            input.organizationRole,
        );

        const fileId = randomUUID();
        const storageKey = `${fileId.slice(0, 2)}/${fileId}.${inspection.extension}`;
        await this.storage.saveQuarantine(storageKey, input.buffer);
        try {
            await this.storage.promote(storageKey);
            const now = this.clock.now();
            const row = await this.database.transaction(
                { organizationId: input.organizationId, userId: input.userId },
                async (session) => {
                    const inserted = await this.repository.insert(session, {
                        organizationId: input.organizationId,
                        projectId: input.projectId,
                        fileName: inspection.fileName,
                        contentType: inspection.contentType,
                        byteSize: input.buffer.length,
                        checksumSha256: input.checksumSha256,
                        storageKey,
                        uploadedByUserId: input.userId,
                        createdAt: now,
                        inspectedAt: now,
                    });
                    await this.audit.record(session, {
                        organizationId: input.organizationId,
                        actorUserId: input.userId,
                        action: "file.uploaded",
                        entityType: "submission_file",
                        entityId: inserted.id,
                        metadata: {
                            projectId: input.projectId,
                            contentType: inspection.contentType,
                            byteSize: input.buffer.length,
                        },
                        ip: input.ip,
                    });
                    return inserted;
                },
            );
            return toSubmissionFile(row);
        } catch (error) {
            await this.storage.remove(storageKey);
            throw error;
        }
    }

    async list(
        auth: AuthContext,
        organizationId: string,
        organizationRole: OrganizationRole,
        projectId: string,
    ): Promise<readonly SubmissionFile[]> {
        const project = await this.projects.getProject(organizationId, projectId);
        if (project === null) {
            throw new NotFoundError("The project was not found.");
        }
        const allowed =
            isOrganizer(organizationRole) ||
            project.ownerUserId === auth.user.id ||
            (await this.projects.isProjectMember(organizationId, projectId, auth.user.id));
        if (!allowed) {
            throw new ForbiddenError("You do not have permission to view this project's files.");
        }
        const rows = await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => this.repository.listApproved(session.db, organizationId, projectId),
        );
        return rows.map(toSubmissionFile);
    }

    async resolveDownload(auth: AuthContext | null, fileId: string): Promise<DownloadResolution> {
        const publicFile = await this.repository.findApprovedPublic(this.database.db, fileId);
        if (publicFile !== null && publicFile.projectId !== null) {
            const project = await this.projects.getProject(
                publicFile.organizationId,
                publicFile.projectId,
            );
            if (project !== null && project.status === "published") {
                return { file: publicFile, visibility: "public" };
            }
        }
        if (auth === null) {
            throw new NotFoundError("The file was not found.");
        }
        for (const membership of auth.memberships) {
            if (membership.status !== "active") {
                continue;
            }
            const row = await this.database.transaction(
                { organizationId: membership.organizationId, userId: auth.user.id },
                async (session) =>
                    this.repository.findById(session.db, membership.organizationId, fileId),
            );
            if (row === null) {
                continue;
            }
            if (row.status !== "approved") {
                throw new NotFoundError("The file was not found.");
            }
            if (row.uploadedByUserId === auth.user.id || isOrganizer(membership.role)) {
                return { file: row, visibility: "private" };
            }
            if (row.projectId !== null) {
                const project = await this.projects.getProject(
                    membership.organizationId,
                    row.projectId,
                );
                if (
                    project !== null &&
                    (project.ownerUserId === auth.user.id ||
                        (await this.projects.isProjectMember(
                            membership.organizationId,
                            row.projectId,
                            auth.user.id,
                        )))
                ) {
                    return { file: row, visibility: "private" };
                }
            }
            throw new ForbiddenError("You do not have permission to download this file.");
        }
        throw new NotFoundError("The file was not found.");
    }

    async delete(auth: AuthContext, fileId: string, ip: string | null): Promise<void> {
        for (const membership of auth.memberships) {
            if (membership.status !== "active") {
                continue;
            }
            const result = await this.database.transaction(
                { organizationId: membership.organizationId, userId: auth.user.id },
                async (session) => {
                    const row = await this.repository.findById(
                        session.db,
                        membership.organizationId,
                        fileId,
                    );
                    if (row === null) {
                        return null;
                    }
                    if (row.uploadedByUserId !== auth.user.id && !isOrganizer(membership.role)) {
                        throw new ForbiddenError(
                            "Only the uploader or an organizer may delete this file.",
                        );
                    }
                    if (row.status === "deleted") {
                        return { row, removed: false };
                    }
                    const deleted = await this.repository.markDeleted(
                        session,
                        membership.organizationId,
                        fileId,
                        this.clock.now(),
                    );
                    if (!deleted) {
                        throw new NotFoundError("The file was not found.");
                    }
                    await this.audit.record(session, {
                        organizationId: membership.organizationId,
                        actorUserId: auth.user.id,
                        action: "file.deleted",
                        entityType: "submission_file",
                        entityId: fileId,
                        metadata: { fileName: row.fileName, projectId: row.projectId },
                        ip,
                    });
                    return { row, removed: true };
                },
            );
            if (result !== null) {
                if (result.removed) {
                    await this.storage.remove(result.row.storageKey);
                }
                return;
            }
        }
        throw new NotFoundError("The file was not found.");
    }

    async contractGetFile(
        organizationId: string,
        fileId: string,
    ): Promise<StoredFileSummary | null> {
        const row = await this.database.transaction({ organizationId }, async (session) =>
            this.repository.findById(session.db, organizationId, fileId),
        );
        return row === null
            ? null
            : {
                  id: row.id,
                  organizationId: row.organizationId,
                  fileName: row.fileName,
                  contentType: row.contentType,
                  byteSize: row.byteSize,
                  checksumSha256: row.checksumSha256,
                  status: row.status,
              };
    }

    async contractAttachToSubmission(
        organizationId: string,
        fileId: string,
        submissionId: string,
        versionId: string,
    ): Promise<void> {
        await this.database.transaction({ organizationId }, async (session) => {
            const row = await this.repository.findById(session.db, organizationId, fileId);
            if (row === null) {
                throw new NotFoundError("The file was not found.");
            }
            if (row.status !== "approved") {
                throw new ConflictError("Only approved files can be attached to a submission.");
            }
            try {
                const attached = await this.repository.attachToSubmission(
                    session,
                    organizationId,
                    fileId,
                    submissionId,
                    versionId,
                );
                if (!attached) {
                    throw new NotFoundError("The file was not found.");
                }
            } catch (error) {
                if (isForeignKeyViolation(error)) {
                    throw new ValidationError(
                        "The submission or version does not belong to this organization.",
                    );
                }
                throw error;
            }
        });
    }

    private async assertUploadAllowed(
        organizationId: string,
        projectId: string,
        userId: string,
        organizationRole: OrganizationRole,
    ): Promise<void> {
        const project = await this.projects.getProject(organizationId, projectId);
        if (project === null) {
            throw new NotFoundError("The project was not found.");
        }
        if (isOrganizer(organizationRole) || project.ownerUserId === userId) {
            return;
        }
        if (await this.projects.isProjectMember(organizationId, projectId, userId)) {
            return;
        }
        throw new ForbiddenError("You do not have permission to upload files to this project.");
    }
}

function toSubmissionFile(row: FileRow): SubmissionFile {
    return {
        id: row.id,
        submissionId: row.submissionId,
        projectId: row.projectId,
        fileName: row.fileName,
        contentType: row.contentType,
        byteSize: row.byteSize,
        checksumSha256: row.checksumSha256,
        status: row.status,
        rejectionReason: row.rejectionReason,
        uploadedByUserId: row.uploadedByUserId,
        createdAt: row.createdAt.toISOString(),
    };
}

function isOrganizer(role: OrganizationRole): boolean {
    return role === "owner" || role === "organizer";
}

function isForeignKeyViolation(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: unknown }).code === "23503"
    );
}
