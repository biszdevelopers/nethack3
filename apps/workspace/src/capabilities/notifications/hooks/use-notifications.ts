import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UpdateNotificationPreferencesRequest } from "@nethack/contracts";
import { resources } from "../../../application/resources.js";

export const notificationKeys = {
    all: ["notifications"] as const,
    list: (unread: boolean) => ["notifications", "list", unread ? "unread" : "all"] as const,
    unreadCount: ["notifications", "unread-count"] as const,
    preferences: ["notifications", "preferences"] as const,
};

export function useNotificationUnreadCount() {
    return useQuery({
        queryKey: notificationKeys.unreadCount,
        queryFn: () => resources.notifications.unreadCount(),
        staleTime: 30_000,
        refetchInterval: 60_000,
    });
}

export function useNotifications(options: { readonly unread?: boolean } = {}) {
    const unread = options.unread === true;
    return useQuery({
        queryKey: notificationKeys.list(unread),
        queryFn: () =>
            resources.notifications.list({
                ...(unread ? { unread: true } : {}),
                limit: 100,
            }),
    });
}

export function useNotificationPreferences() {
    return useQuery({
        queryKey: notificationKeys.preferences,
        queryFn: () => resources.notifications.preferences(),
    });
}

export function useMarkNotificationRead() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (notificationId: string) => resources.notifications.markRead(notificationId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: notificationKeys.all });
        },
    });
}

export function useMarkAllNotificationsRead() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => resources.notifications.markAllRead(),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: notificationKeys.all });
        },
    });
}

export function useUpdateNotificationPreferences() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: UpdateNotificationPreferencesRequest) =>
            resources.notifications.updatePreferences(input),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: notificationKeys.preferences });
        },
    });
}
