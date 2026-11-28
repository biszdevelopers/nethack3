import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    publicUserProfileSchema,
    userWithProfileThemeSchema,
    type PublicUserProfile,
} from "@nethack/contracts";
import { apiClient } from "../application/api.js";

export function profileThemeKey(userId: string): readonly [string, string] {
    return ["public-profile", userId] as const;
}

async function fetchPublicProfile(userId: string): Promise<PublicUserProfile> {
    const origin = import.meta.env.VITE_API_ORIGIN ?? "http://localhost:3002";
    const response = await fetch(
        new URL(`/api/v1/public/users/${encodeURIComponent(userId)}`, origin),
        { cache: "no-store", headers: { Accept: "application/json" } },
    );
    if (!response.ok) {
        throw new Error("The public profile could not be loaded.");
    }
    return publicUserProfileSchema.parse(await response.json());
}

export function usePublicProfile(userId: string) {
    return useQuery({
        queryKey: profileThemeKey(userId),
        queryFn: () => fetchPublicProfile(userId),
        enabled: userId.length > 0,
    });
}

export function useUpdateProfileTheme(userId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (profileTheme: string | null) =>
            apiClient.request("PATCH", "/api/v1/me", {
                body: { profileTheme },
                schema: userWithProfileThemeSchema,
            }),
        onSuccess: (updated) => {
            queryClient.setQueryData<PublicUserProfile>(profileThemeKey(userId), (current) => {
                if (current === undefined) {
                    return current;
                }
                const next: PublicUserProfile = { ...current };
                if (updated.profileTheme === null) {
                    delete next.profileTheme;
                } else {
                    next.profileTheme = updated.profileTheme;
                }
                return next;
            });
        },
    });
}

export function readImageDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === "string") {
                resolve(reader.result);
            } else {
                reject(new Error("The selected image could not be read."));
            }
        };
        reader.onerror = () => reject(new Error("The selected image could not be read."));
        reader.readAsDataURL(file);
    });
}
