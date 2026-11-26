import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
    CompetitionEditionDetail,
    CreateDivisionRequest,
    CreateEditionRequest,
    CreateMilestoneRequest,
    CreateSeriesRequest,
    UpdateEditionRequest,
} from "@nethack/contracts";
import { competitionsApi } from "./competitions-api.js";
import { queryKeys } from "../shared/query-keys.js";
import { api } from "../../application/api.js";

export function useSeries(organizationId: string | null) {
    return useQuery({
        queryKey: queryKeys.series(organizationId ?? "none"),
        queryFn: async () => {
            if (organizationId === null) {
                return { items: [], nextCursor: null };
            }
            return competitionsApi.series(organizationId);
        },
        enabled: organizationId !== null,
    });
}

export function useEdition(organizationId: string | null, editionId: string | null) {
    return useQuery({
        queryKey: queryKeys.edition(editionId ?? "none"),
        queryFn: async (): Promise<CompetitionEditionDetail | null> => {
            if (organizationId === null || editionId === null) {
                return null;
            }
            return competitionsApi.edition(organizationId, editionId);
        },
        enabled: organizationId !== null && editionId !== null,
    });
}

export function useDivisions(organizationId: string | null, editionId: string | null) {
    return useQuery({
        queryKey: queryKeys.divisions(editionId ?? "none"),
        queryFn: async () => {
            if (organizationId === null || editionId === null) {
                return { items: [], nextCursor: null };
            }
            return competitionsApi.divisions(organizationId, editionId);
        },
        enabled: organizationId !== null && editionId !== null,
    });
}

export function useMilestones(organizationId: string | null, editionId: string | null) {
    return useQuery({
        queryKey: queryKeys.milestones(editionId ?? "none"),
        queryFn: async () => {
            if (organizationId === null || editionId === null) {
                return { items: [], nextCursor: null };
            }
            return competitionsApi.milestones(organizationId, editionId);
        },
        enabled: organizationId !== null && editionId !== null,
    });
}

export function useCreateSeries(organizationId: string | null) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: CreateSeriesRequest) => {
            if (organizationId === null) {
                throw new Error("Select an organization first.");
            }
            return competitionsApi.createSeries(organizationId, input);
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: queryKeys.series(organizationId ?? "none"),
            });
        },
    });
}

export function useCreateEdition(organizationId: string | null) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: { seriesId: string; body: CreateEditionRequest }) => {
            if (organizationId === null) {
                throw new Error("Select an organization first.");
            }
            return competitionsApi.createEdition(organizationId, input.seriesId, input.body);
        },
        onSuccess: async (edition) => {
            if (organizationId === null) {
                return;
            }
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: queryKeys.edition(edition.id),
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.reports(organizationId),
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.publicCompetitions(),
                }),
            ]);
        },
    });
}

export function useUpdateEdition(organizationId: string | null) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: { editionId: string; body: UpdateEditionRequest }) => {
            if (organizationId === null) {
                throw new Error("Select an organization first.");
            }
            return competitionsApi.updateEdition(organizationId, input.editionId, input.body);
        },
        onSuccess: async (edition) => {
            if (organizationId === null) {
                return;
            }
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: queryKeys.edition(edition.id),
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.reports(organizationId),
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.publicCompetitions(),
                }),
            ]);
        },
    });
}

export function usePublishEdition(organizationId: string | null) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (editionId: string) => {
            if (organizationId === null) {
                throw new Error("Select an organization first.");
            }
            return competitionsApi.publishEdition(organizationId, editionId);
        },
        onSuccess: async (edition) => {
            if (organizationId === null) {
                return;
            }
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: queryKeys.edition(edition.id),
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.reports(organizationId),
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.publicCompetitions(),
                }),
            ]);
        },
    });
}

export function useCreateDivision(organizationId: string | null) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: { editionId: string; body: CreateDivisionRequest }) => {
            if (organizationId === null) {
                throw new Error("Select an organization first.");
            }
            return competitionsApi.createDivision(organizationId, input.editionId, input.body);
        },
        onSuccess: async (_division, input) => {
            await queryClient.invalidateQueries({
                queryKey: queryKeys.divisions(input.editionId),
            });
        },
    });
}

export function useCreateMilestone(organizationId: string | null) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: { editionId: string; body: CreateMilestoneRequest }) => {
            if (organizationId === null) {
                throw new Error("Select an organization first.");
            }
            return competitionsApi.createMilestone(organizationId, input.editionId, input.body);
        },
        onSuccess: async (_milestone, input) => {
            await queryClient.invalidateQueries({
                queryKey: queryKeys.milestones(input.editionId),
            });
        },
    });
}

export function useOrganizerEditions(organizationId: string | null, enabled = true) {
    const query = useQuery({
        queryKey: queryKeys.reports(organizationId ?? "none"),
        queryFn: async () => {
            if (organizationId === null) {
                throw new Error("Select an organization first.");
            }
            return api.administration.organizationReports(organizationId);
        },
        enabled: organizationId !== null && enabled,
    });
    return {
        editions:
            query.data?.editions.map((edition) => ({
                id: edition.editionId,
                name: edition.editionName,
            })) ?? [],
        query,
    };
}

export function usePublicEditionOptions(organizationSlug: string | null, enabled = true) {
    const query = useQuery({
        queryKey: queryKeys.publicCompetitions(),
        queryFn: () => competitionsApi.publicCompetitions(),
        staleTime: 60_000,
        enabled,
    });
    const editions = (query.data?.items ?? [])
        .filter((competition) => competition.organizationSlug === organizationSlug)
        .map((competition) => ({ id: competition.editionId, name: competition.name }));
    return { editions, query };
}
