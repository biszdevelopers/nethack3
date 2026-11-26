import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

export type ToastTone = "neutral" | "success" | "critical";

export interface ToastInput {
    readonly title: string;
    readonly description?: string;
    readonly tone?: ToastTone;
    readonly durationMs?: number;
}

export interface ToastRecord extends ToastInput {
    readonly id: string;
}

class ToastStore {
    private items: ToastRecord[] = [];
    private readonly listeners = new Set<() => void>();
    private nextId = 1;

    getSnapshot = (): readonly ToastRecord[] => this.items;

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };

    show(input: ToastInput): string {
        const id = String(this.nextId++);
        this.items = [...this.items, { ...input, id }];
        this.emit();
        return id;
    }

    dismiss(id: string): void {
        this.items = this.items.filter((item) => item.id !== id);
        this.emit();
    }

    clear(): void {
        this.items = [];
        this.emit();
    }

    private emit(): void {
        for (const listener of this.listeners) {
            listener();
        }
    }
}

export const toastStore = new ToastStore();
const EMPTY_TOASTS: readonly ToastRecord[] = [];
const EMPTY_OVERLAYS: readonly OverlayEntry[] = [];

export function useToast(): {
    toasts: readonly ToastRecord[];
    toast: (input: ToastInput) => string;
    dismiss: (id: string) => void;
} {
    const toasts = useSyncExternalStore(
        toastStore.subscribe,
        toastStore.getSnapshot,
        () => EMPTY_TOASTS,
    );
    return {
        toasts,
        toast: (input) => toastStore.show(input),
        dismiss: (id) => toastStore.dismiss(id),
    };
}

export interface OverlayOptions {
    readonly label: string;
    readonly description?: string;
    readonly dismissible?: boolean;
}

interface OverlayEntry extends OverlayOptions {
    readonly id: string;
    readonly content: ReactNode;
}

class OverlayStore {
    private entries: OverlayEntry[] = [];
    private readonly listeners = new Set<() => void>();
    private nextId = 1;

    getSnapshot = (): readonly OverlayEntry[] => this.entries;

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };

    open(content: ReactNode, options: OverlayOptions): string {
        const id = String(this.nextId++);
        this.entries = [...this.entries, { ...options, id, content }];
        this.emit();
        return id;
    }

    close(id: string): void {
        this.entries = this.entries.filter((entry) => entry.id !== id);
        this.emit();
    }

    closeTop(): void {
        this.entries = this.entries.slice(0, -1);
        this.emit();
    }

    closeAll(): void {
        this.entries = [];
        this.emit();
    }

    private emit(): void {
        for (const listener of this.listeners) {
            listener();
        }
    }
}

export const overlayStore = new OverlayStore();

export function useOverlay(): {
    overlays: readonly { id: string; label: string; description?: string; dismissible: boolean }[];
    open: (content: ReactNode, options: OverlayOptions) => string;
    close: (id: string) => void;
    closeAll: () => void;
} {
    const entries = useSyncExternalStore(
        overlayStore.subscribe,
        overlayStore.getSnapshot,
        () => EMPTY_OVERLAYS,
    );
    return {
        overlays: entries.map((entry) => ({
            id: entry.id,
            label: entry.label,
            ...(entry.description === undefined ? {} : { description: entry.description }),
            dismissible: entry.dismissible !== false,
        })),
        open: (content, options) => overlayStore.open(content, options),
        close: (id) => overlayStore.close(id),
        closeAll: () => overlayStore.closeAll(),
    };
}

export function getOverlayEntries(): readonly OverlayEntry[] {
    return overlayStore.getSnapshot();
}

class CommandPaletteStore {
    private openState = false;
    private readonly listeners = new Set<() => void>();

    getSnapshot = (): boolean => this.openState;

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };

    set(open: boolean): void {
        this.openState = open;
        for (const listener of this.listeners) {
            listener();
        }
    }
}

export const commandPaletteStore = new CommandPaletteStore();

export function useCommandPaletteState(): {
    open: boolean;
    setOpen: (open: boolean) => void;
    toggle: () => void;
} {
    const open = useSyncExternalStore(
        commandPaletteStore.subscribe,
        commandPaletteStore.getSnapshot,
        () => false,
    );
    return {
        open,
        setOpen: (value) => commandPaletteStore.set(value),
        toggle: () => commandPaletteStore.set(!open),
    };
}
