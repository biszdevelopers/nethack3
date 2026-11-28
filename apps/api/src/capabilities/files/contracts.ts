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

export interface StoredFileMetadata {
    readonly id: string;
    readonly organizationId: string;
    readonly projectId: string | null;
    readonly submissionId: string | null;
    readonly versionId: string | null;
    readonly fileName: string;
    readonly contentType: string;
    readonly byteSize: number;
    readonly checksumSha256: string;
    readonly status: FileStatus;
    readonly createdAt: string;
}

export interface StoredFileQuery {
    readonly limit: number;
    readonly offset: number;
    /** Restrict the page to files linked to a submission or version. */
    readonly linkedOnly: boolean;
}

export interface StoredFilePage {
    readonly items: readonly StoredFileMetadata[];
    readonly total: number;
    readonly limit: number;
    readonly offset: number;
}

export interface FilesContract {
    getFile(organizationId: string, fileId: string): Promise<StoredFileSummary | null>;
    listProjectFiles(
        organizationId: string,
        projectId: string,
    ): Promise<readonly StoredFileSummary[]>;
    /**
     * Read-only metadata for the global administrator file browser. The caller
     * supplies the organizations to scan; storage keys and contents never leave
     * this capability.
     */
    listStoredFiles(
        organizationIds: readonly string[],
        query: StoredFileQuery,
    ): Promise<StoredFilePage>;
    attachToSubmission(
        organizationId: string,
        fileId: string,
        submissionId: string,
        versionId: string,
    ): Promise<void>;
}

export const FILES_CONTRACT = "files.v1";
