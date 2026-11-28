import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
    CreateTeamRequest,
    InviteTeamMemberRequest,
    UpdateTeamRequest,
} from "@nethack/contracts";
import { resources } from "../../../application/resources.js";

export const teamKeys = {
    all: ["teams"] as const,
    mine: ["teams", "mine"] as const,
    invitations: ["teams", "invitations"] as const,
    edition: (editionId: string) => ["teams", "edition", editionId] as const,
    detail: (teamId: string) => ["teams", "detail", teamId] as const,
    activity: (teamId: string) => ["teams", "activity", teamId] as const,
};

export function useMyTeams() {
    return useQuery({
        queryKey: teamKeys.mine,
        queryFn: () => resources.teams.mine(),
    });
}

export function useEditionTeams(editionId: string | null) {
    return useQuery({
        queryKey: teamKeys.edition(editionId ?? "none"),
        queryFn: async () => {
            if (editionId === null) {
                return { items: [], nextCursor: null };
            }
            return resources.teams.listForEdition(editionId);
        },
        enabled: editionId !== null,
    });
}

export function useTeam(teamId: string | null) {
    return useQuery({
        queryKey: teamKeys.detail(teamId ?? "none"),
        queryFn: async () => {
            if (teamId === null) {
                return null;
            }
            return resources.teams.get(teamId);
        },
        enabled: teamId !== null,
    });
}

export function useTeamActivity(teamId: string | null) {
    return useQuery({
        queryKey: teamKeys.activity(teamId ?? "none"),
        queryFn: async () => {
            if (teamId === null) {
                return { items: [], nextCursor: null };
            }
            return resources.teams.activity(teamId, { limit: 50 });
        },
        enabled: teamId !== null,
    });
}

export function useCreateTeam(editionId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: CreateTeamRequest) => resources.teams.create(editionId, input),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: teamKeys.all });
        },
    });
}

export function useUpdateTeam(teamId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: UpdateTeamRequest) => resources.teams.update(teamId, input),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: teamKeys.all });
        },
    });
}

export function useInviteTeamMember(teamId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: InviteTeamMemberRequest) => resources.teams.invite(teamId, input),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: teamKeys.all });
        },
    });
}

export function useMyTeamInvitations() {
    return useQuery({
        queryKey: teamKeys.invitations,
        queryFn: () => resources.teams.mineInvitations(),
    });
}

export function useAcceptTeamInvitation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (token: string) => resources.teams.acceptInvitation(token),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: teamKeys.all });
            await queryClient.invalidateQueries({ queryKey: ["competitions"] });
        },
    });
}

export function useAcceptTeamInvitationById() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (invitationId: string) => resources.teams.acceptInvitationById(invitationId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: teamKeys.all });
            await queryClient.invalidateQueries({ queryKey: ["competitions"] });
        },
    });
}

export function useDeclineTeamInvitation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (invitationId: string) => resources.teams.declineInvitation(invitationId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: teamKeys.invitations });
        },
    });
}

export function useInvitationLink(teamId: string) {
    return useMutation({
        mutationFn: (invitationId: string) => resources.teams.invitationLink(teamId, invitationId),
    });
}

export function useRevokeTeamInvitation(teamId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (invitationId: string) =>
            resources.teams.revokeInvitation(teamId, invitationId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: teamKeys.detail(teamId) });
        },
    });
}

export function useDisbandTeam(teamId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => resources.teams.disband(teamId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: teamKeys.all });
            await queryClient.invalidateQueries({ queryKey: ["competitions"] });
        },
    });
}

export function useRemoveTeamMember(teamId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (userId: string) => resources.teams.removeMember(teamId, userId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: teamKeys.all });
        },
    });
}

export function useTransferCaptain(teamId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (userId: string) => resources.teams.transferCaptain(teamId, userId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: teamKeys.all });
        },
    });
}

export function useLeaveTeam(teamId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => resources.teams.leave(teamId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: teamKeys.all });
            await queryClient.invalidateQueries({ queryKey: ["competitions"] });
        },
    });
}
