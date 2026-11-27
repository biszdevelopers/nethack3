import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
    AddOrganizationMemberRequest,
    CreateOrganizationRequest,
    UpdateOrganizationMemberRequest,
    UpdateOrganizationSettingsRequest,
} from "@nethack/contracts";
import { api } from "../../application/api.js";
import { organizationSelectionStore } from "../../application/organization-store.js";
import { SESSION_QUERY_KEY } from "../../application/session.js";
import { queryKeys } from "../shared/query-keys.js";

export function useCreateOrganization() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: CreateOrganizationRequest) => api.organizations.create(input),
        onSuccess: async (organization) => {
            organizationSelectionStore.select(organization.id);
            await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
        },
    });
}

export interface AuditFilters {
    readonly action?: string;
    readonly entityType?: string;
    readonly cursor?: string;
}

export function useOrganizationMembers(organizationId: string | null, enabled = true) {
    return useQuery({
        queryKey: queryKeys.members(organizationId ?? "none"),
        queryFn: async () => {
            if (organizationId === null) {
                return { items: [], nextCursor: null };
            }
            return api.organizations.members(organizationId);
        },
        enabled: organizationId !== null && enabled,
    });
}

export function useOrganizationInvitations(organizationId: string | null, enabled = true) {
    return useQuery({
        queryKey: queryKeys.invitations(organizationId ?? "none"),
        queryFn: async () => {
            if (organizationId === null) {
                return { items: [], nextCursor: null };
            }
            return api.organizations.invitations(organizationId);
        },
        enabled: organizationId !== null && enabled,
    });
}

export function useOrganizationSettings(organizationId: string | null, enabled = true) {
    return useQuery({
        queryKey: queryKeys.settings(organizationId ?? "none"),
        queryFn: async () => {
            if (organizationId === null) {
                return null;
            }
            return api.organizations.settings(organizationId);
        },
        enabled: organizationId !== null && enabled,
    });
}

export function useOrganizationAudit(
    organizationId: string | null,
    filters: AuditFilters,
    enabled = true,
) {
    return useQuery({
        queryKey: [
            ...queryKeys.audit(organizationId ?? "none"),
            filters.action ?? "",
            filters.entityType ?? "",
            filters.cursor ?? "",
        ],
        queryFn: async () => {
            if (organizationId === null) {
                return { items: [], nextCursor: null };
            }
            return api.organizations.audit(organizationId, {
                limit: 20,
                ...(filters.action === undefined || filters.action.length === 0
                    ? {}
                    : { action: filters.action }),
                ...(filters.entityType === undefined || filters.entityType.length === 0
                    ? {}
                    : { entityType: filters.entityType }),
                ...(filters.cursor === undefined || filters.cursor.length === 0
                    ? {}
                    : { cursor: filters.cursor }),
            });
        },
        enabled: organizationId !== null && enabled,
    });
}

export function useOrganizationReports(organizationId: string | null, enabled = true) {
    return useQuery({
        queryKey: queryKeys.reports(organizationId ?? "none"),
        queryFn: async () => {
            if (organizationId === null) {
                throw new Error("Select an organization first.");
            }
            return api.administration.organizationReports(organizationId);
        },
        enabled: organizationId !== null && enabled,
    });
}

export function useAddMember(organizationId: string | null) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: AddOrganizationMemberRequest) => {
            if (organizationId === null) {
                throw new Error("Select an organization first.");
            }
            return api.organizations.addMember(organizationId, input);
        },
        onSuccess: async () => {
            if (organizationId === null) {
                return;
            }
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: queryKeys.members(organizationId),
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.invitations(organizationId),
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.audit(organizationId),
                }),
            ]);
        },
    });
}

export function useUpdateMember(organizationId: string | null) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: { userId: string; body: UpdateOrganizationMemberRequest }) => {
            if (organizationId === null) {
                throw new Error("Select an organization first.");
            }
            return api.organizations.updateMember(organizationId, input.userId, input.body);
        },
        onSuccess: async () => {
            if (organizationId === null) {
                return;
            }
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: queryKeys.members(organizationId),
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.audit(organizationId),
                }),
            ]);
        },
    });
}

export function useRemoveMember(organizationId: string | null) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (userId: string) => {
            if (organizationId === null) {
                throw new Error("Select an organization first.");
            }
            return api.organizations.removeMember(organizationId, userId);
        },
        onSuccess: async () => {
            if (organizationId === null) {
                return;
            }
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: queryKeys.members(organizationId),
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.audit(organizationId),
                }),
            ]);
        },
    });
}

export function useUpdateSettings(organizationId: string | null) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: UpdateOrganizationSettingsRequest) => {
            if (organizationId === null) {
                throw new Error("Select an organization first.");
            }
            return api.organizations.updateSettings(organizationId, input);
        },
        onSuccess: async () => {
            if (organizationId === null) {
                return;
            }
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: queryKeys.settings(organizationId),
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.audit(organizationId),
                }),
            ]);
        },
    });
}
