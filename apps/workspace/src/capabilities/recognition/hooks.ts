import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RecognitionApi } from "@nethack/api-client";
import type {
    Award,
    AwardCatalog,
    CreateAwardRequest,
    MyResults,
    ResultsStatus,
    TeamAward,
    UpdateAwardRequest,
} from "@nethack/contracts";
import { apiClient } from "../../application/api.js";

const recognitionApi = new RecognitionApi(apiClient);

export const recognitionKeys = {
    catalog: (editionId: string) => ["recognition", editionId, "awards"] as const,
    status: (editionId: string) => ["recognition", editionId, "results-status"] as const,
    myResults: (editionId: string) => ["recognition", editionId, "my-results"] as const,
};

export function useAwardCatalog(organizationId: string | null, editionId: string | null) {
    return useQuery<AwardCatalog>({
        queryKey: recognitionKeys.catalog(editionId ?? "none"),
        queryFn: async () => {
            if (organizationId === null || editionId === null) {
                return { awards: [], teamAwards: [] };
            }
            return recognitionApi.catalog(organizationId, editionId);
        },
        enabled: organizationId !== null && editionId !== null,
    });
}

export function useCreateAward(organizationId: string | null, editionId: string | null) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: CreateAwardRequest): Promise<Award> => {
            if (organizationId === null || editionId === null) {
                throw new Error("Select a competition edition first.");
            }
            return recognitionApi.createAward(organizationId, editionId, input);
        },
        onSuccess: async () => {
            if (editionId === null) {
                return;
            }
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: recognitionKeys.catalog(editionId),
                }),
                queryClient.invalidateQueries({
                    queryKey: recognitionKeys.status(editionId),
                }),
            ]);
        },
    });
}

export function useUpdateAward(organizationId: string | null, editionId: string | null) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: {
            awardId: string;
            body: UpdateAwardRequest;
        }): Promise<Award> => {
            if (organizationId === null || editionId === null) {
                throw new Error("Select a competition edition first.");
            }
            return recognitionApi.updateAward(organizationId, editionId, input.awardId, input.body);
        },
        onSuccess: async () => {
            if (editionId === null) {
                return;
            }
            await queryClient.invalidateQueries({
                queryKey: recognitionKeys.catalog(editionId),
            });
        },
    });
}

export function useDeleteAward(organizationId: string | null, editionId: string | null) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (awardId: string): Promise<void> => {
            if (organizationId === null || editionId === null) {
                throw new Error("Select a competition edition first.");
            }
            return recognitionApi.deleteAward(organizationId, editionId, awardId);
        },
        onSuccess: async () => {
            if (editionId === null) {
                return;
            }
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: recognitionKeys.catalog(editionId),
                }),
                queryClient.invalidateQueries({
                    queryKey: recognitionKeys.status(editionId),
                }),
            ]);
        },
    });
}

export function useAssignAward(organizationId: string | null, editionId: string | null) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: {
            teamId: string;
            awardId: string;
            note: string;
        }): Promise<TeamAward> => {
            if (organizationId === null || editionId === null) {
                throw new Error("Select a competition edition first.");
            }
            return recognitionApi.assignAward(
                organizationId,
                editionId,
                input.teamId,
                input.awardId,
                input.note,
            );
        },
        onSuccess: async () => {
            if (editionId === null) {
                return;
            }
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: recognitionKeys.catalog(editionId),
                }),
                queryClient.invalidateQueries({
                    queryKey: recognitionKeys.status(editionId),
                }),
            ]);
        },
    });
}

export function useUnassignAward(organizationId: string | null, editionId: string | null) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: { teamId: string; awardId: string }): Promise<void> => {
            if (organizationId === null || editionId === null) {
                throw new Error("Select a competition edition first.");
            }
            return recognitionApi.unassignAward(
                organizationId,
                editionId,
                input.teamId,
                input.awardId,
            );
        },
        onSuccess: async () => {
            if (editionId === null) {
                return;
            }
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: recognitionKeys.catalog(editionId),
                }),
                queryClient.invalidateQueries({
                    queryKey: recognitionKeys.status(editionId),
                }),
            ]);
        },
    });
}

export function useResultsStatus(organizationId: string | null, editionId: string | null) {
    return useQuery<ResultsStatus>({
        queryKey: recognitionKeys.status(editionId ?? "none"),
        queryFn: async () => {
            if (organizationId === null || editionId === null) {
                throw new Error("Select a competition edition first.");
            }
            return recognitionApi.resultsStatus(organizationId, editionId);
        },
        enabled: organizationId !== null && editionId !== null,
    });
}

export function usePublishResults(organizationId: string | null, editionId: string | null) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (): Promise<void> => {
            if (organizationId === null || editionId === null) {
                throw new Error("Select a competition edition first.");
            }
            await recognitionApi.publishResults(organizationId, editionId);
        },
        onSuccess: async () => {
            if (editionId === null) {
                return;
            }
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: recognitionKeys.status(editionId),
                }),
                queryClient.invalidateQueries({
                    queryKey: recognitionKeys.catalog(editionId),
                }),
                queryClient.invalidateQueries({
                    queryKey: recognitionKeys.myResults(editionId),
                }),
            ]);
        },
    });
}

export function useUnpublishResults(organizationId: string | null, editionId: string | null) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (): Promise<void> => {
            if (organizationId === null || editionId === null) {
                throw new Error("Select a competition edition first.");
            }
            await recognitionApi.unpublishResults(organizationId, editionId);
        },
        onSuccess: async () => {
            if (editionId === null) {
                return;
            }
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: recognitionKeys.status(editionId),
                }),
                queryClient.invalidateQueries({
                    queryKey: recognitionKeys.myResults(editionId),
                }),
            ]);
        },
    });
}

export function useMyResults(organizationId: string | null, editionId: string | null) {
    return useQuery<MyResults>({
        queryKey: recognitionKeys.myResults(editionId ?? "none"),
        queryFn: async () => {
            if (organizationId === null || editionId === null) {
                throw new Error("Select a competition edition first.");
            }
            return recognitionApi.myResults(organizationId, editionId);
        },
        enabled: organizationId !== null && editionId !== null,
    });
}
