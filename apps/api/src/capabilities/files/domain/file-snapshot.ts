import { randomUUID } from "node:crypto";

export interface FileSnapshotSource {
    readonly projectId: string | null;
    readonly storageKey: string;
    readonly fileName: string;
    readonly contentType: string;
    readonly byteSize: number;
    readonly checksumSha256: string;
    readonly uploadedByUserId: string;
    readonly inspectedAt: Date | null;
}

export interface FileSnapshotIdentity {
    readonly organizationId: string;
    readonly submissionId: string;
    readonly versionId: string;
}

export interface FileSnapshotValues extends FileSnapshotSource, FileSnapshotIdentity {
    readonly id: string;
    readonly status: "approved";
}

/**
 * Builds an immutable per-version snapshot of a project-level file row. The
 * snapshot shares the storage object; the original row stays untouched so
 * earlier submission versions keep their file list.
 */
export function buildFileSnapshot(
    source: FileSnapshotSource,
    identity: FileSnapshotIdentity,
): FileSnapshotValues {
    return {
        id: randomUUID(),
        organizationId: identity.organizationId,
        projectId: source.projectId,
        submissionId: identity.submissionId,
        versionId: identity.versionId,
        storageKey: source.storageKey,
        fileName: source.fileName,
        contentType: source.contentType,
        byteSize: source.byteSize,
        checksumSha256: source.checksumSha256,
        uploadedByUserId: source.uploadedByUserId,
        status: "approved",
        inspectedAt: source.inspectedAt,
    };
}
