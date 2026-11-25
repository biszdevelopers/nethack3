import type { FileStatus } from "@nethack/contracts";

export interface StoredFileSummary {
    readonly id: string;
    readonly organizationId: string;
    readonly fileName: string;
    readonly contentType: string;
    readonly byteSize: number;
    readonly checksumSha256: string;
    readonly status: FileStatus;
}

export interface FilesContract {
    getFile(organizationId: string, fileId: string): Promise<StoredFileSummary | null>;
    listProjectFiles(
        organizationId: string,
        projectId: string,
    ): Promise<readonly StoredFileSummary[]>;
    attachToSubmission(
        organizationId: string,
        fileId: string,
        submissionId: string,
        versionId: string,
    ): Promise<void>;
}

export const FILES_CONTRACT = "files.v1";
