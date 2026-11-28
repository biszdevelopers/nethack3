import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
    CreateDebugAiSessionRequest,
    DatabaseExportFormat,
    GrantGlobalAdministratorRequest,
    OrganizationRole,
    ReopenAdministrationSubmissionRequest,
    RevokeGlobalAdministratorRequest,
    StoredFilePage,
    TeamStatus,
} from "@nethack/contracts";
import type { AuditQuery, GlobalAuditQuery } from "@nethack/api-client";
import { api } from "../../application/api.js";
import { queryKeys } from "../shared/query-keys.js";

const administrationKeys = {
    users: (organizationId: string) => ["administration", "users", organizationId] as const,
    teams: (organizationId: string, editionId: string) =>
        ["administration", "teams", organizationId, editionId] as const,
    preflight: (organizationId: string, editionId: string) =>
        ["administration", "preflight", organizationId, editionId] as const,
    globalAudit: (filters: GlobalAuditQuery) =>
        [
            "administration",
            "global-audit",
            filters.organizationId ?? "",
            filters.action ?? "",
            filters.entityType ?? "",
            filters.actorUserId ?? "",
            filters.cursor ?? "",
        ] as const,
};

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
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: queryKeys.globalAdministrators() }),
                queryClient.invalidateQueries({ queryKey: ["administration", "users"] }),
            ]);
        },
    });
}

export function useRevokeAdministrator() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: { userId: string; body: RevokeGlobalAdministratorRequest }) =>
            api.administration.revoke(input.userId, input.body),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: queryKeys.globalAdministrators() }),
                queryClient.invalidateQueries({ queryKey: ["administration", "users"] }),
            ]);
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

export function useGlobalAdministrationAudit(filters: GlobalAuditQuery, enabled: boolean) {
    return useQuery({
        queryKey: administrationKeys.globalAudit(filters),
        queryFn: () => api.administration.globalAudit(filters),
        enabled,
    });
}

export function useAdministrationUsers(organizationId: string | null, enabled: boolean) {
    return useQuery({
        queryKey: administrationKeys.users(organizationId ?? "none"),
        queryFn: async () => {
            if (organizationId === null) {
                return { items: [], nextCursor: null };
            }
            return api.administration.users(organizationId);
        },
        enabled: organizationId !== null && enabled,
    });
}

export function useDeleteAdministrationUser() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (userId: string) => api.administration.deleteUser(userId),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["administration", "users"] }),
                queryClient.invalidateQueries({ queryKey: queryKeys.globalAdministrators() }),
                queryClient.invalidateQueries({ queryKey: ["administration", "audit"] }),
            ]);
        },
    });
}

export function useUpdateAdministrationUserRole(organizationId: string | null) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: { userId: string; role: OrganizationRole }) => {
            if (organizationId === null) {
                throw new Error("Select an organization first.");
            }
            return api.administration.updateUserRole(organizationId, input.userId, input.role);
        },
        onSuccess: async () => {
            if (organizationId === null) {
                return;
            }
            await queryClient.invalidateQueries({
                queryKey: administrationKeys.users(organizationId),
            });
        },
    });
}

export function useAdministrationTeams(
    organizationId: string | null,
    editionId: string | null,
    enabled: boolean,
) {
    return useQuery({
        queryKey: administrationKeys.teams(organizationId ?? "none", editionId ?? "none"),
        queryFn: async () => {
            if (organizationId === null || editionId === null) {
                return { items: [], nextCursor: null };
            }
            return api.administration.teams(organizationId, editionId);
        },
        enabled: organizationId !== null && editionId !== null && enabled,
    });
}

export function useUpdateAdministrationTeamStatus(
    organizationId: string | null,
    editionId: string | null,
) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: { teamId: string; status: TeamStatus; reason?: string }) => {
            if (organizationId === null || editionId === null) {
                throw new Error("Select an edition first.");
            }
            return api.administration.updateTeamStatus(
                organizationId,
                editionId,
                input.teamId,
                input.status,
                input.reason,
            );
        },
        onSuccess: async () => {
            if (organizationId === null || editionId === null) {
                return;
            }
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: administrationKeys.teams(organizationId, editionId),
                }),
                queryClient.invalidateQueries({
                    queryKey: administrationKeys.preflight(organizationId, editionId),
                }),
            ]);
        },
    });
}

export function useDeleteAdministrationTeam(
    organizationId: string | null,
    editionId: string | null,
) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (teamId: string) => {
            if (organizationId === null || editionId === null) {
                throw new Error("Select an edition first.");
            }
            return api.administration.deleteTeam(organizationId, editionId, teamId);
        },
        onSuccess: async () => {
            if (organizationId === null || editionId === null) {
                return;
            }
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: administrationKeys.teams(organizationId, editionId),
                }),
                queryClient.invalidateQueries({
                    queryKey: administrationKeys.preflight(organizationId, editionId),
                }),
            ]);
        },
    });
}

export function useReopenAdministrationSubmission(
    organizationId: string | null,
    editionId: string | null,
) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: {
            submissionId: string;
            body: ReopenAdministrationSubmissionRequest;
        }) => {
            if (organizationId === null || editionId === null) {
                throw new Error("Select an edition first.");
            }
            return api.administration.reopenSubmission(
                organizationId,
                editionId,
                input.submissionId,
                input.body,
            );
        },
        onSuccess: async () => {
            if (organizationId === null || editionId === null) {
                return;
            }
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: administrationKeys.teams(organizationId, editionId),
                }),
                queryClient.invalidateQueries({
                    queryKey: administrationKeys.preflight(organizationId, editionId),
                }),
            ]);
        },
    });
}

export function useAdministrationPreflight(
    organizationId: string | null,
    editionId: string | null,
    enabled: boolean,
) {
    return useQuery({
        queryKey: administrationKeys.preflight(organizationId ?? "none", editionId ?? "none"),
        queryFn: async () => {
            if (organizationId === null || editionId === null) {
                return null;
            }
            return api.administration.preflight(organizationId, editionId);
        },
        enabled: organizationId !== null && editionId !== null && enabled,
    });
}

const operatorKeys = {
    debugFiles: (kind: "files" | "references", offset: number) =>
        ["administration", "debug-files", kind, offset] as const,
    debugAiStatus: () => ["administration", "debug-ai", "status"] as const,
    debugAiSessions: () => ["administration", "debug-ai", "sessions"] as const,
    debugAiSession: (sessionId: string) =>
        ["administration", "debug-ai", "session", sessionId] as const,
};

export function useAdministrationDebugFiles(
    kind: "files" | "references",
    offset: number,
    enabled: boolean,
) {
    return useQuery<StoredFilePage>({
        queryKey: operatorKeys.debugFiles(kind, offset),
        queryFn: () => api.administration.debugFiles(kind, { limit: 25, offset }),
        enabled,
    });
}

export function useDebugAiStatus(enabled: boolean) {
    return useQuery({
        queryKey: operatorKeys.debugAiStatus(),
        queryFn: () => api.administration.debugAiStatus(),
        enabled,
    });
}

export function useDebugAiSessions(enabled: boolean) {
    return useQuery({
        queryKey: operatorKeys.debugAiSessions(),
        queryFn: () => api.administration.debugAiSessions(),
        enabled,
    });
}

export function useDebugAiSession(sessionId: string | null) {
    return useQuery({
        queryKey: operatorKeys.debugAiSession(sessionId ?? "none"),
        queryFn: async () => {
            if (sessionId === null) {
                return null;
            }
            return api.administration.debugAiSession(sessionId);
        },
        enabled: sessionId !== null,
    });
}

export function useCreateDebugAiSession() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: CreateDebugAiSessionRequest) =>
            api.administration.createDebugAiSession(input),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: operatorKeys.debugAiSessions() });
        },
    });
}

export function useDeleteDebugAiSession() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (sessionId: string) => api.administration.deleteDebugAiSession(sessionId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: operatorKeys.debugAiSessions() });
            await queryClient.invalidateQueries({
                queryKey: ["administration", "debug-ai", "session"],
            });
        },
    });
}

export function useSendDebugAiMessage(sessionId: string | null) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (content: string) => {
            if (sessionId === null) {
                throw new Error("Select a session first.");
            }
            return api.administration.sendDebugAiMessage(sessionId, content);
        },
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: operatorKeys.debugAiSessions() }),
                sessionId === null
                    ? Promise.resolve()
                    : queryClient.invalidateQueries({
                          queryKey: operatorKeys.debugAiSession(sessionId),
                      }),
            ]);
        },
    });
}

export async function downloadDatabaseExport(format: DatabaseExportFormat = "json"): Promise<void> {
    const { blob, fileName } = await api.administration.databaseExport(format);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export async function downloadStandingsCsv(
    organizationId: string,
    editionId: string,
): Promise<void> {
    const { blob, fileName } = await api.administration.standingsCsv(organizationId, editionId);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
