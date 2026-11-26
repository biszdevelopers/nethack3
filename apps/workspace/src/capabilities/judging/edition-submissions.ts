import {
    listResponseSchema,
    submissionSchema,
    type ListResponse,
    type Submission,
} from "@nethack/contracts";
import { apiClient } from "../../application/api.js";

const submissionListSchema = listResponseSchema(submissionSchema);

export function listEditionSubmissions(
    organizationId: string,
    editionId: string,
): Promise<ListResponse<Submission>> {
    return apiClient.request("GET", `/api/v1/competitions/${editionId}/submissions`, {
        query: { limit: 100 },
        schema: submissionListSchema,
        headers: { "X-Nethack-Organization-Id": organizationId },
    });
}
