import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@nethack/contracts";
import { api, setCsrfToken } from "./api.js";
import { organizationSelectionStore } from "./organization-store.js";

export const SESSION_QUERY_KEY = ["auth", "session"] as const;

export function useSession() {
    const queryClient = useQueryClient();
    const query = useQuery<Session>({
        queryKey: SESSION_QUERY_KEY,
        queryFn: async () => {
            try {
                const session = await api.auth.session();
                setCsrfToken(session.csrfToken);
                return session;
            } catch (error) {
                if (import.meta.env.DEV) {
                    console.error("Session query failed", error);
                }
                throw error;
            }
        },
        retry: false,
        staleTime: 60_000,
    });

    useEffect(() => {
        if (query.data === undefined) {
            return;
        }
        const active = query.data.memberships.filter(
            (membership) => membership.status === "active",
        );
        const selected = organizationSelectionStore.getSnapshot();
        const stillValid = active.some((membership) => membership.organizationId === selected);
        if (!stillValid) {
            organizationSelectionStore.select(active[0]?.organizationId ?? null);
        }
    }, [query.data]);

    useEffect(() => {
        const onUnauthorized = () => {
            setCsrfToken(null);
            void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
        };
        window.addEventListener("nethack:unauthorized", onUnauthorized);
        return () => window.removeEventListener("nethack:unauthorized", onUnauthorized);
    }, [queryClient]);

    return query;
}

export function useActiveMembership() {
    const session = useSession();
    const activeOrganizationId = useOrganizationId();
    const membership =
        session.data?.memberships.find(
            (candidate) =>
                candidate.organizationId === activeOrganizationId && candidate.status === "active",
        ) ?? null;
    return { session, membership };
}

function useOrganizationId(): string | null {
    const session = useSession();
    const active = session.data?.memberships.filter((membership) => membership.status === "active");
    const stored =
        typeof window === "undefined"
            ? null
            : window.localStorage.getItem("nethack-active-organization");
    if (stored !== null && active?.some((membership) => membership.organizationId === stored)) {
        return stored;
    }
    return active?.[0]?.organizationId ?? null;
}
