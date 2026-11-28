import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
    CompetitionEditionDetail,
    CreateDivisionRequest,
    CreateEditionRequest,
    CreateMilestoneRequest,
    CreateSeriesRequest,
    DecideRegistrationRequest,
    MyParticipation,
    RegisterForCompetitionRequest,
} from "@nethack/contracts";
import { resources } from "../../../application/resources.js";

export const competitionKeys = {
    all: ["competitions"] as const,
    series: (organizationId: string) => ["competitions", "series", organizationId] as const,
    publicList: ["competitions", "public"] as const,
    detail: (editionId: string) => ["competitions", "detail", editionId] as const,
    registrations: (editionId: string) => ["competitions", "registrations", editionId] as const,
    participations: ["competitions", "participations"] as const,
    participantEditions: (key: string) => ["competitions", "participant-editions", key] as const,
};

export function useCompetitionSeries(organizationId: string | null) {
    return useQuery({
        queryKey: competitionKeys.series(organizationId ?? "none"),
        queryFn: async () => {
            if (organizationId === null) {
                return { items: [], nextCursor: null };
            }
            return resources.competitions.listSeries(organizationId);
        },
        enabled: organizationId !== null,
    });
}

export function useOrganizationEditions(
    organizationId: string | null,
    seriesId: string | null,
    enabled = true,
) {
    return useQuery({
        queryKey: [
            "competitions",
            "organizer-editions",
            organizationId ?? "none",
            seriesId ?? "all",
        ] as const,
        queryFn: async () => {
            if (organizationId === null) {
                return { items: [], nextCursor: null };
            }
            return resources.competitions.listEditions(
                organizationId,
                seriesId === null ? {} : { seriesId },
            );
        },
        enabled: organizationId !== null && enabled,
    });
}

export function usePublicCompetitions(enabled = true) {
    return useQuery({
        queryKey: competitionKeys.publicList,
        queryFn: () => resources.competitions.publicList({ limit: 100 }),
        enabled,
    });
}

export function useMyParticipations() {
    return useQuery({
        queryKey: competitionKeys.participations,
        queryFn: () => resources.participants.mine(),
    });
}

export function useEdition(editionId: string | null) {
    return useQuery({
        queryKey: competitionKeys.detail(editionId ?? "none"),
        queryFn: async (): Promise<CompetitionEditionDetail | null> => {
            if (editionId === null) {
                return null;
            }
            return resources.competitions.get(editionId);
        },
        enabled: editionId !== null,
    });
}

export function useEditionRegistrations(editionId: string, enabled: boolean) {
    return useQuery({
        queryKey: competitionKeys.registrations(editionId),
        queryFn: () => resources.participants.listRegistrations(editionId),
        enabled,
    });
}

export function useParticipantEditions(
    participations: readonly MyParticipation[],
    organizationId: string | null,
) {
    const ids =
        organizationId === null
            ? []
            : participations
                  .filter((participation) => participation.organizationId === organizationId)
                  .map((participation) => participation.editionId);
    const key = [...new Set(ids)].sort().join(",");
    return useQuery({
        queryKey: competitionKeys.participantEditions(key),
        queryFn: async () => {
            const editionIds = key.length === 0 ? [] : key.split(",");
            return Promise.all(editionIds.map((id) => resources.competitions.get(id)));
        },
        enabled: key.length > 0,
    });
}

export function useCreateSeries(organizationId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: CreateSeriesRequest) =>
            resources.competitions.createSeries(organizationId, input),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: competitionKeys.all });
        },
    });
}

export function useCreateEdition(organizationId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: { seriesId: string; request: CreateEditionRequest }) =>
            resources.competitions.createEdition(organizationId, input.seriesId, input.request),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: competitionKeys.all }),
                queryClient.invalidateQueries({ queryKey: ["competitions", "organizer-editions"] }),
            ]);
        },
    });
}

export function useCreateDivision(editionId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: CreateDivisionRequest) =>
            resources.competitions.createDivision(editionId, input),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: competitionKeys.all });
        },
    });
}

export function useCreateMilestone(editionId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: CreateMilestoneRequest) =>
            resources.competitions.createMilestone(editionId, input),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: competitionKeys.all });
        },
    });
}

export function useRegisterForCompetition(editionId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: RegisterForCompetitionRequest) =>
            resources.participants.register(editionId, input),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: competitionKeys.all });
        },
    });
}

export function useWithdrawRegistration(editionId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => resources.participants.withdraw(editionId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: competitionKeys.all });
        },
    });
}

export function useDecideRegistration(editionId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: { registrationId: string; request: DecideRegistrationRequest }) =>
            resources.participants.decide(editionId, input.registrationId, input.request),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: competitionKeys.all });
        },
    });
}
