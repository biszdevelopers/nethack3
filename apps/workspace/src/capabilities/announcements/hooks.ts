import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateAnnouncementRequest } from "@nethack/contracts";
import { resources } from "../../application/resources.js";

export const announcementKeys = {
    all: ["announcements"] as const,
    list: (organizationId: string) => ["announcements", "list", organizationId] as const,
};

export function useAnnouncements(organizationId: string | null) {
    return useQuery({
        queryKey: announcementKeys.list(organizationId ?? "none"),
        queryFn: async () => {
            if (organizationId === null) {
                return { items: [], nextCursor: null };
            }
            return resources.announcements.list(organizationId, { limit: 100 });
        },
        enabled: organizationId !== null,
    });
}

export function useCreateAnnouncement(organizationId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: CreateAnnouncementRequest) =>
            resources.announcements.create(organizationId, input),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: announcementKeys.all });
        },
    });
}

export function usePublishAnnouncement() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (announcementId: string) => resources.announcements.publish(announcementId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: announcementKeys.all });
            await queryClient.invalidateQueries({ queryKey: ["public-announcements"] });
        },
    });
}
