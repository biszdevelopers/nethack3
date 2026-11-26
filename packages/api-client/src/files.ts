import {
    listResponseSchema,
    submissionFileSchema,
    type ListResponse,
    type SubmissionFile,
} from "@nethack/contracts";
import type { ApiClient } from "./client.js";

const fileListSchema = listResponseSchema(submissionFileSchema);

export class FilesApi {
    private readonly client: ApiClient;

    constructor(client: ApiClient) {
        this.client = client;
    }

    async listProjectFiles(projectId: string): Promise<ListResponse<SubmissionFile>> {
        return this.client.request("GET", `/api/v1/projects/${projectId}/files`, {
            schema: fileListSchema,
        });
    }

    async upload(projectId: string, file: File, signal?: AbortSignal): Promise<SubmissionFile> {
        const formData = new FormData();
        formData.append("file", file);
        return this.client.upload(`/api/v1/projects/${projectId}/files`, formData, {
            schema: submissionFileSchema,
            ...(signal === undefined ? {} : { signal }),
        });
    }

    downloadUrl(fileId: string): string {
        return this.client.buildUrl(`/api/v1/files/${fileId}/download`);
    }

    async remove(fileId: string): Promise<void> {
        await this.client.request("DELETE", `/api/v1/files/${fileId}`);
    }
}
