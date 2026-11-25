import { useEffect, useState, useSyncExternalStore } from "react";

type Listener = () => void;

class LocalStore {
    private readonly key: string;
    private readonly fallback: string;
    private readonly listeners = new Set<Listener>();
    private value: string;

    constructor(key: string, fallback: string) {
        this.key = key;
        this.fallback = fallback;
        this.value = fallback;
        if (typeof window !== "undefined") {
            const stored = window.localStorage.getItem(key);
            if (stored !== null) {
                this.value = stored;
            }
        }
    }

    get = (): string => this.value;

    set = (next: string): void => {
        this.value = next;
        if (typeof window !== "undefined") {
            window.localStorage.setItem(this.key, next);
        }
        for (const listener of this.listeners) {
            listener();
        }
    };

    subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };

    reset = (): void => {
        this.set(this.fallback);
    };
}

export type ColorMode = "dark" | "light";

export const colorModeStore = new LocalStore("nethack-color-mode", "dark");
export const localeStore = new LocalStore("nethack-locale", "en");

export function useColorMode(): {
    colorMode: ColorMode;
    setColorMode: (mode: ColorMode) => void;
    toggleColorMode: () => void;
} {
    const value = useSyncExternalStore(
        colorModeStore.subscribe,
        colorModeStore.get,
        () => "dark",
    );
    const colorMode: ColorMode = value === "light" ? "light" : "dark";

    useEffect(() => {
        if (typeof document === "undefined") {
            return;
        }
        document.documentElement.dataset.theme = colorMode;
    }, [colorMode]);

    return {
        colorMode,
        setColorMode: (mode) => colorModeStore.set(mode),
        toggleColorMode: () => colorModeStore.set(colorMode === "dark" ? "light" : "dark"),
    };
}

export function useLocale(): { locale: string; setLocale: (locale: string) => void } {
    const locale = useSyncExternalStore(localeStore.subscribe, localeStore.get, () => "en");
    useEffect(() => {
        if (typeof document !== "undefined") {
            document.documentElement.lang = locale;
        }
    }, [locale]);
    return { locale, setLocale: (next) => localeStore.set(next) };
}

export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
            return;
        }
        const media = window.matchMedia(query);
        setMatches(media.matches);
        const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
        media.addEventListener("change", listener);
        return () => media.removeEventListener("change", listener);
    }, [query]);

    return matches;
}

export function useIsMobile(): boolean {
    return !useMediaQuery("(min-width: 768px)");
}

export function useDebouncedValue<T>(value: T, delayMs = 250): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(timer);
    }, [value, delayMs]);
    return debounced;
}
