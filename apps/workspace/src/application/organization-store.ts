import { useSyncExternalStore } from "react";

const STORAGE_KEY = "nethack-active-organization";

class OrganizationSelectionStore {
    private value: string | null;
    private readonly listeners = new Set<() => void>();

    constructor() {
        this.value =
            typeof window === "undefined" ? null : window.localStorage.getItem(STORAGE_KEY);
    }

    getSnapshot = (): string | null => this.value;

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };

    select(organizationId: string | null): void {
        this.value = organizationId;
        if (typeof window !== "undefined") {
            if (organizationId === null) {
                window.localStorage.removeItem(STORAGE_KEY);
            } else {
                window.localStorage.setItem(STORAGE_KEY, organizationId);
            }
        }
        for (const listener of this.listeners) {
            listener();
        }
    }
}

export const organizationSelectionStore = new OrganizationSelectionStore();

export function useActiveOrganizationId(): string | null {
    return useSyncExternalStore(
        organizationSelectionStore.subscribe,
        organizationSelectionStore.getSnapshot,
        () => null,
    );
}
