import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@nethack/api-client";
import type { Ballot, CastBallotRequest, CreateVotingRoundRequest } from "@nethack/contracts";
import { api } from "../../application/api.js";
import { queryKeys } from "../shared/query-keys.js";

async function fetchBallot(organizationId: string, roundId: string): Promise<Ballot | null> {
    try {
        return await api.voting.ballot(organizationId, roundId);
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
            return null;
        }
        throw error;
    }
}

export function useVotingRounds(organizationId: string | null, editionId: string | null) {
    return useQuery({
        queryKey: queryKeys.votingRounds(editionId ?? "none"),
        queryFn: async () => {
            if (organizationId === null || editionId === null) {
                return { items: [], nextCursor: null };
            }
            return api.voting.rounds(organizationId, editionId);
        },
        enabled: organizationId !== null && editionId !== null,
    });
}

export function useBallot(organizationId: string | null, roundId: string | null, enabled: boolean) {
    return useQuery({
        queryKey: queryKeys.ballot(roundId ?? "none"),
        queryFn: async () => {
            if (organizationId === null || roundId === null) {
                return null;
            }
            return fetchBallot(organizationId, roundId);
        },
        enabled: organizationId !== null && roundId !== null && enabled,
    });
}

export function useEditionResults(organizationId: string | null, editionId: string | null) {
    return useQuery({
        queryKey: queryKeys.editionResults(editionId ?? "none"),
        queryFn: async () => {
            if (organizationId === null || editionId === null) {
                return { items: [], nextCursor: null };
            }
            return api.voting.editionResults(organizationId, editionId);
        },
        enabled: organizationId !== null && editionId !== null,
    });
}

export function useCreateRound(organizationId: string | null, editionId: string | null) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: CreateVotingRoundRequest) => {
            if (organizationId === null || editionId === null) {
                throw new Error("Select an edition first.");
            }
            return api.voting.createRound(organizationId, editionId, input);
        },
        onSuccess: async () => {
            if (editionId === null) {
                return;
            }
            await queryClient.invalidateQueries({
                queryKey: queryKeys.votingRounds(editionId),
            });
        },
    });
}

export function useRoundTransition(
    organizationId: string | null,
    editionId: string | null,
    action: "open" | "close" | "publish",
) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (roundId: string) => {
            if (organizationId === null) {
                throw new Error("Select an organization first.");
            }
            if (action === "open") {
                return api.voting.openRound(organizationId, roundId);
            }
            if (action === "close") {
                return api.voting.closeRound(organizationId, roundId);
            }
            return api.voting.publishRound(organizationId, roundId);
        },
        onSuccess: async () => {
            if (editionId === null) {
                return;
            }
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: queryKeys.votingRounds(editionId),
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.editionResults(editionId),
                }),
            ]);
        },
    });
}

export function useCastBallot(organizationId: string | null, editionId: string | null) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: { roundId: string; body: CastBallotRequest }) => {
            if (organizationId === null) {
                throw new Error("Select an organization first.");
            }
            return api.voting.castBallot(organizationId, input.roundId, input.body);
        },
        onSuccess: async (ballot, input) => {
            queryClient.setQueryData(queryKeys.ballot(input.roundId), ballot);
            await queryClient.invalidateQueries({
                queryKey: queryKeys.ballot(input.roundId),
            });
            if (editionId !== null) {
                await queryClient.invalidateQueries({
                    queryKey: queryKeys.editionResults(editionId),
                });
            }
        },
    });
}

export function useVotableSubmissions(organizationId: string | null, editionId: string | null) {
    return useQuery({
        queryKey: [...queryKeys.votingRounds(editionId ?? "none"), "votable-submissions"],
        queryFn: async () => {
            if (organizationId === null || editionId === null) {
                return { items: [], nextCursor: null };
            }
            return api.voting.votableSubmissions(organizationId, editionId);
        },
        enabled: organizationId !== null && editionId !== null,
    });
}
