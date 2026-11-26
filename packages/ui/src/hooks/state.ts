import { useCallback, useEffect, useRef, useState } from "react";

export function useControllableState<T>(options: {
    value: T | undefined;
    defaultValue: T;
    onChange?: (value: T) => void;
}): [T, (next: T) => void] {
    const [internal, setInternal] = useState(options.defaultValue);
    const isControlled = options.value !== undefined;
    const value: T = options.value !== undefined ? options.value : internal;
    const onChangeRef = useRef(options.onChange);
    useEffect(() => {
        onChangeRef.current = options.onChange;
    }, [options.onChange]);

    const setValue = useCallback(
        (next: T) => {
            if (isControlled) {
                onChangeRef.current?.(next);
                return;
            }
            setInternal(next);
            onChangeRef.current?.(next);
        },
        [isControlled],
    );

    return [value, setValue];
}

export function useDisclosure(initialOpen = false): {
    isOpen: boolean;
    open: () => void;
    close: () => void;
    toggle: () => void;
    setOpen: (open: boolean) => void;
} {
    const [isOpen, setOpen] = useState(initialOpen);
    return {
        isOpen,
        open: () => setOpen(true),
        close: () => setOpen(false),
        toggle: () => setOpen((value) => !value),
        setOpen,
    };
}

const INPUT_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
    const parts = shortcut.toLowerCase().split("+");
    const key = parts[parts.length - 1];
    if (key === undefined) {
        return false;
    }
    const wantsMod = parts.includes("mod");
    const wantsShift = parts.includes("shift");
    const wantsAlt = parts.includes("alt");
    const modifierKey = /mac|iphone|ipad/i.test(navigator.platform) ? event.metaKey : event.ctrlKey;
    if (wantsMod !== modifierKey) {
        return false;
    }
    if (wantsShift !== event.shiftKey) {
        return false;
    }
    if (wantsAlt !== event.altKey) {
        return false;
    }
    return event.key.toLowerCase() === key;
}

export function useShortcuts(
    shortcuts: Readonly<Record<string, (event: KeyboardEvent) => void>>,
    options: { enabled?: boolean } = {},
): void {
    const enabled = options.enabled ?? true;
    const handlersRef = useRef(shortcuts);
    useEffect(() => {
        handlersRef.current = shortcuts;
    }, [shortcuts]);

    useEffect(() => {
        if (!enabled || typeof window === "undefined") {
            return;
        }
        const listener = (event: KeyboardEvent) => {
            const target = event.target;
            if (
                target instanceof HTMLElement &&
                (INPUT_TAGS.has(target.tagName) || target.isContentEditable)
            ) {
                return;
            }
            for (const [shortcut, handler] of Object.entries(handlersRef.current)) {
                if (matchesShortcut(event, shortcut)) {
                    event.preventDefault();
                    handler(event);
                }
            }
        };
        window.addEventListener("keydown", listener);
        return () => window.removeEventListener("keydown", listener);
    }, [enabled]);
}
