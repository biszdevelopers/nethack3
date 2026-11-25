import {
    createContext,
    forwardRef,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useSyncExternalStore,
    type ComponentPropsWithoutRef,
    type FormEvent,
    type KeyboardEvent,
    type PointerEvent,
    type ReactNode,
} from "react";
import { Menu, PanelLeftClose, PanelLeftOpen, Search, X } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { useControllableState } from "../../hooks/state.js";
import { useIsMobile } from "../../hooks/environment.js";
import { Kbd } from "../kbd.js";
import { inputVariants } from "../input.js";

// A focusable separator is the ARIA resize pattern; jsx-a11y treats hr as non-interactive.
/* oxlint-disable jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-noninteractive-element-interactions */

const DEFAULT_SIDEBAR_WIDTH = 256;
const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 420;
const SIDEBAR_WIDTH_KEY = "nethack-dashboard-sidebar-width";

function clampWidth(value: number): number {
    return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, value));
}

class SidebarWidthStore {
    private width: number;
    private readonly listeners = new Set<() => void>();

    constructor() {
        let initial = DEFAULT_SIDEBAR_WIDTH;
        if (typeof window !== "undefined") {
            const stored = window.localStorage.getItem(SIDEBAR_WIDTH_KEY);
            if (stored !== null) {
                const parsed = Number(stored);
                if (Number.isFinite(parsed)) {
                    initial = clampWidth(parsed);
                }
            }
        }
        this.width = initial;
    }

    get = (): number => this.width;

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    set = (next: number): void => {
        const width = clampWidth(next);
        if (width === this.width) {
            return;
        }
        this.width = width;
        if (typeof window !== "undefined") {
            window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
        }
        for (const listener of this.listeners) {
            listener();
        }
    };
}

const sidebarWidthStore = new SidebarWidthStore();

function updateSidebarWidth(next: number): void {
    sidebarWidthStore.set(next);
}

function useSidebarWidth(): number {
    return useSyncExternalStore(
        sidebarWidthStore.subscribe,
        sidebarWidthStore.get,
        () => DEFAULT_SIDEBAR_WIDTH,
    );
}

interface DashboardSidebarContextValue {
    readonly collapsed: boolean;
    readonly setCollapsed: (collapsed: boolean) => void;
    readonly mobileOpen: boolean;
    readonly setMobileOpen: (open: boolean) => void;
}

const DashboardSidebarContext = createContext<DashboardSidebarContextValue | null>(null);

export function useDashboardSidebar(): DashboardSidebarContextValue {
    const context = useContext(DashboardSidebarContext);
    if (context === null) {
        throw new Error("Dashboard sidebar components must be rendered inside DashboardGroup.");
    }
    return context;
}

export interface DashboardGroupProps extends ComponentPropsWithoutRef<"div"> {
    readonly collapsed?: boolean;
    readonly defaultCollapsed?: boolean;
    readonly onCollapsedChange?: (collapsed: boolean) => void;
    readonly sidebarOpen?: boolean;
    readonly defaultSidebarOpen?: boolean;
    readonly onSidebarOpenChange?: (open: boolean) => void;
}

export function DashboardGroup({
    className,
    collapsed,
    defaultCollapsed = false,
    onCollapsedChange,
    sidebarOpen,
    defaultSidebarOpen = false,
    onSidebarOpenChange,
    children,
    ...rest
}: DashboardGroupProps): ReactNode {
    const [isCollapsed, setIsCollapsed] = useControllableState<boolean>({
        value: collapsed,
        defaultValue: defaultCollapsed,
        ...(onCollapsedChange === undefined ? {} : { onChange: onCollapsedChange }),
    });
    const [isSidebarOpen, setIsSidebarOpen] = useControllableState<boolean>({
        value: sidebarOpen,
        defaultValue: defaultSidebarOpen,
        ...(onSidebarOpenChange === undefined ? {} : { onChange: onSidebarOpenChange }),
    });
    const contextValue = useMemo(
        () => ({
            collapsed: isCollapsed,
            setCollapsed: setIsCollapsed,
            mobileOpen: isSidebarOpen,
            setMobileOpen: setIsSidebarOpen,
        }),
        [isCollapsed, setIsCollapsed, isSidebarOpen, setIsSidebarOpen],
    );
    return (
        <DashboardSidebarContext.Provider value={contextValue}>
            <div
                data-slot="dashboard-group"
                className={cn("flex min-h-dvh flex-col bg-app", className)}
                {...rest}
            >
                {children}
            </div>
        </DashboardSidebarContext.Provider>
    );
}

export const DashboardNavbar = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div">>(
    function DashboardNavbar({ className, ...rest }, ref) {
        return (
            <div
                ref={ref}
                data-slot="dashboard-navbar"
                className={cn(
                    "flex h-14 items-center gap-3 border-b border-line bg-panel px-4",
                    className,
                )}
                {...rest}
            />
        );
    },
);

export const DashboardPanel = forwardRef<HTMLElement, ComponentPropsWithoutRef<"section">>(
    function DashboardPanel({ className, ...rest }, ref) {
        return (
            <section
                ref={ref}
                data-slot="dashboard-panel"
                className={cn(
                    "flex min-h-0 flex-col rounded-lg border border-line bg-panel",
                    className,
                )}
                {...rest}
            />
        );
    },
);

export interface DashboardResizeHandleProps {
    readonly className?: string;
    readonly label?: string;
}

export function DashboardResizeHandle({
    className,
    label = "Resize sidebar",
}: DashboardResizeHandleProps): ReactNode {
    const width = useSidebarWidth();
    const drag = useRef<{ startX: number; startWidth: number } | null>(null);

    const onKeyDown = (event: KeyboardEvent<HTMLHRElement>): void => {
        switch (event.key) {
            case "ArrowLeft":
                event.preventDefault();
                updateSidebarWidth(width - 16);
                return;
            case "ArrowRight":
                event.preventDefault();
                updateSidebarWidth(width + 16);
                return;
            case "Home":
                event.preventDefault();
                updateSidebarWidth(MIN_SIDEBAR_WIDTH);
                return;
            case "End":
                event.preventDefault();
                updateSidebarWidth(MAX_SIDEBAR_WIDTH);
                return;
            default:
                return;
        }
    };

    const onPointerDown = (event: PointerEvent<HTMLHRElement>): void => {
        drag.current = { startX: event.clientX, startWidth: width };
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent<HTMLHRElement>): void => {
        const start = drag.current;
        if (start === null) {
            return;
        }
        updateSidebarWidth(start.startWidth + event.clientX - start.startX);
    };

    const endDrag = (event: PointerEvent<HTMLHRElement>): void => {
        drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    };

    return (
        <hr
            aria-orientation="vertical"
            aria-label={label}
            aria-valuemin={MIN_SIDEBAR_WIDTH}
            aria-valuemax={MAX_SIDEBAR_WIDTH}
            aria-valuenow={width}
            tabIndex={0}
            data-slot="dashboard-resize-handle"
            onKeyDown={onKeyDown}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className={cn(
                "my-0 hidden h-auto w-1 shrink-0 cursor-col-resize touch-none self-stretch border-0 bg-line transition-colors hover:bg-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:block",
                className,
            )}
        />
    );
}

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface DashboardSidebarProps extends ComponentPropsWithoutRef<"aside"> {
    readonly label?: string;
}

export function DashboardSidebar({
    className,
    label = "Sidebar",
    children,
    ...rest
}: DashboardSidebarProps): ReactNode {
    const { collapsed, mobileOpen, setMobileOpen } = useDashboardSidebar();
    const width = useSidebarWidth();
    const isMobile = useIsMobile();
    const overlay = mobileOpen && isMobile;
    const asideRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!overlay) {
            return;
        }
        const aside = asideRef.current;
        if (aside === null) {
            return;
        }
        const previous =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
        aside.focus();
        const listener = (event: globalThis.KeyboardEvent): void => {
            if (event.key === "Escape") {
                setMobileOpen(false);
                return;
            }
            if (event.key !== "Tab") {
                return;
            }
            const focusables = aside.querySelectorAll<HTMLElement>(FOCUSABLE);
            if (focusables.length === 0) {
                event.preventDefault();
                return;
            }
            const first = focusables.item(0);
            const last = focusables.item(focusables.length - 1);
            if (first === null || last === null) {
                return;
            }
            const inside = aside.contains(document.activeElement);
            if (event.shiftKey) {
                if (!inside || document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                }
                return;
            }
            if (!inside || document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };
        document.addEventListener("keydown", listener);
        const onAsideClick = (event: MouseEvent): void => {
            if (event.target instanceof Element && event.target.closest("a") !== null) {
                setMobileOpen(false);
            }
        };
        aside.addEventListener("click", onAsideClick);
        return () => {
            document.removeEventListener("keydown", listener);
            aside.removeEventListener("click", onAsideClick);
            previous?.focus();
        };
    }, [overlay, setMobileOpen]);

    return (
        <>
            {overlay ? (
                <button
                    type="button"
                    aria-hidden="true"
                    tabIndex={-1}
                    onClick={() => setMobileOpen(false)}
                    className="fixed inset-0 z-40 m-0 size-full cursor-default border-0 bg-black/60 p-0 lg:hidden"
                />
            ) : null}
            <aside
                ref={asideRef}
                id="dashboard-sidebar"
                data-slot="dashboard-sidebar"
                role={overlay ? "dialog" : undefined}
                aria-modal={overlay ? true : undefined}
                aria-label={label}
                tabIndex={overlay ? -1 : undefined}
                inert={isMobile && !mobileOpen ? true : undefined}
                className={cn(
                    "z-50 flex shrink-0 flex-col border-r border-line bg-panel",
                    "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:max-w-[85vw] max-lg:transition-transform max-lg:duration-200",
                    overlay ? "max-lg:translate-x-0" : "max-lg:-translate-x-full",
                    "lg:static lg:translate-x-0",
                    className,
                )}
                style={{ width: overlay || !collapsed ? width : 56 }}
                {...rest}
            >
                {children}
            </aside>
        </>
    );
}

export const DashboardSidebarCollapse = forwardRef<
    HTMLButtonElement,
    ComponentPropsWithoutRef<"button">
>(function DashboardSidebarCollapse({ className, onClick, ...rest }, ref) {
    const { collapsed, setCollapsed } = useDashboardSidebar();
    return (
        <button
            ref={ref}
            type="button"
            data-slot="dashboard-sidebar-collapse"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
                "inline-flex size-9 shrink-0 items-center justify-center rounded-sm text-ink-muted transition-colors hover:bg-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                className,
            )}
            onClick={(event) => {
                onClick?.(event);
                setCollapsed(!collapsed);
            }}
            {...rest}
        >
            {collapsed ? (
                <PanelLeftOpen className="size-4" aria-hidden="true" />
            ) : (
                <PanelLeftClose className="size-4" aria-hidden="true" />
            )}
        </button>
    );
});

export const DashboardSidebarToggle = forwardRef<
    HTMLButtonElement,
    ComponentPropsWithoutRef<"button">
>(function DashboardSidebarToggle({ className, onClick, ...rest }, ref) {
    const { mobileOpen, setMobileOpen } = useDashboardSidebar();
    return (
        <button
            ref={ref}
            type="button"
            data-slot="dashboard-sidebar-toggle"
            aria-label={mobileOpen ? "Close sidebar" : "Open sidebar"}
            aria-expanded={mobileOpen}
            aria-controls="dashboard-sidebar"
            className={cn(
                "inline-flex size-9 shrink-0 items-center justify-center rounded-sm text-ink-muted transition-colors hover:bg-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:hidden",
                className,
            )}
            onClick={(event) => {
                onClick?.(event);
                setMobileOpen(!mobileOpen);
            }}
            {...rest}
        >
            {mobileOpen ? (
                <X className="size-4" aria-hidden="true" />
            ) : (
                <Menu className="size-4" aria-hidden="true" />
            )}
        </button>
    );
});

export interface DashboardSearchProps {
    readonly value?: string;
    readonly onValueChange?: (value: string) => void;
    readonly onSubmit?: (value: string) => void;
    readonly placeholder?: string;
    readonly label?: string;
    readonly shortcut?: string;
    readonly className?: string;
}

export function DashboardSearch({
    value,
    onValueChange,
    onSubmit,
    placeholder = "Search",
    label = "Search",
    shortcut,
    className,
}: DashboardSearchProps): ReactNode {
    const [search, setSearch] = useControllableState<string>({
        value,
        defaultValue: "",
        ...(onValueChange === undefined ? {} : { onChange: onValueChange }),
    });

    const submit = (event: FormEvent<HTMLFormElement>): void => {
        event.preventDefault();
        onSubmit?.(search);
    };

    return (
        <search
            data-slot="dashboard-search"
            aria-label={label}
            className={cn("block w-full", className)}
        >
            <form onSubmit={submit} className="relative flex w-full items-center">
                <Search
                    className="pointer-events-none absolute left-3 size-4 text-ink-subtle"
                    aria-hidden="true"
                />
                <input
                    type="search"
                    aria-label={label}
                    placeholder={placeholder}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className={cn(
                        inputVariants({ size: "sm" }),
                        "pl-9",
                        shortcut === undefined ? "pr-3" : "pr-16",
                    )}
                />
                {shortcut === undefined ? null : (
                    <span className="pointer-events-none absolute right-2">
                        <Kbd>{shortcut}</Kbd>
                    </span>
                )}
            </form>
        </search>
    );
}

export interface DashboardSearchButtonProps extends ComponentPropsWithoutRef<"button"> {
    readonly label?: string;
    readonly shortcut?: string;
}

export const DashboardSearchButton = forwardRef<HTMLButtonElement, DashboardSearchButtonProps>(
    function DashboardSearchButton(
        { className, label = "Search", shortcut, type = "button", ...rest },
        ref,
    ) {
        return (
            <button
                ref={ref}
                type={type}
                data-slot="dashboard-search-button"
                className={cn(
                    "inline-flex h-9 w-full max-w-xs items-center gap-2 rounded-md border border-line bg-app px-3 text-left text-sm text-ink-subtle transition-colors hover:bg-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-app",
                    className,
                )}
                {...rest}
            >
                <Search className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{label}</span>
                {shortcut === undefined ? null : <Kbd className="ml-auto">{shortcut}</Kbd>}
            </button>
        );
    },
);

export const DashboardToolbar = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div">>(
    function DashboardToolbar({ className, ...rest }, ref) {
        return (
            <div
                ref={ref}
                data-slot="dashboard-toolbar"
                className={cn(
                    "flex flex-wrap items-center gap-2 border-b border-line px-4 py-2",
                    className,
                )}
                {...rest}
            />
        );
    },
);
