import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
    GrantGlobalAdministratorRequest,
    RevokeGlobalAdministratorRequest,
} from "@nethack/contracts";
import type { AuditQuery } from "@nethack/api-client";
import { api } from "../../application/api.js";
import { queryKeys } from "../shared/query-keys.js";

export function useGlobalAdministrators(enabled: boolean) {
    return useQuery({
        queryKey: queryKeys.globalAdministrators(),
        queryFn: () => api.administration.globalAdministrators(),
        enabled,
    });
}

export function useGrantAdministrator() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: GrantGlobalAdministratorRequest) =>
            api.administration.grant(input),
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: queryKeys.globalAdministrators(),
            });
        },
    });
}

export function useRevokeAdministrator() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: { userId: string; body: RevokeGlobalAdministratorRequest }) =>
            api.administration.revoke(input.userId, input.body),
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: queryKeys.globalAdministrators(),
            });
        },
    });
}

export function useAdministrationAudit(
    organizationId: string | null,
    filters: AuditQuery,
    enabled: boolean,
) {
    return useQuery({
        queryKey: [
            ...queryKeys.administrationAudit(organizationId ?? "none"),
            filters.action ?? "",
            filters.entityType ?? "",
            filters.actorUserId ?? "",
            filters.cursor ?? "",
        ],
        queryFn: async () => {
            if (organizationId === null) {
                throw new Error("Enter an organization identifier.");
            }
            return api.administration.audit(organizationId, filters);
        },
        enabled: enabled && organizationId !== null,
    });
}
