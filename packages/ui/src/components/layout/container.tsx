import {
    forwardRef,
    type ComponentPropsWithoutRef,
    type CSSProperties,
    type KeyboardEvent,
    type ReactNode,
} from "react";
import { tv } from "tailwind-variants";
import { cn } from "../../lib/cn.js";
import { useControllableState } from "../../hooks/state.js";

// A focusable separator is the ARIA resize pattern; jsx-a11y treats hr as non-interactive.
/* oxlint-disable jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-noninteractive-element-interactions */

export const Container = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div">>(
    function Container({ className, ...rest }, ref) {
        return (
            <div
                ref={ref}
                data-slot="container"
                className={cn("mx-auto w-full max-w-[1280px] px-6", className)}
                {...rest}
            />
        );
    },
);

export const Main = forwardRef<HTMLElement, ComponentPropsWithoutRef<"main">>(function Main(
    { className, ...rest },
    ref,
) {
    return (
        <main ref={ref} data-slot="main" className={cn("min-w-0 flex-1", className)} {...rest} />
    );
});

export interface HeaderProps extends ComponentPropsWithoutRef<"header"> {
    readonly sticky?: boolean;
}

export const Header = forwardRef<HTMLElement, HeaderProps>(function Header(
    { className, sticky = false, ...rest },
    ref,
) {
    return (
        <header
            ref={ref}
            data-slot="header"
            className={cn("border-b border-line bg-app", sticky && "sticky top-0 z-30", className)}
            {...rest}
        />
    );
});

export const Footer = forwardRef<HTMLElement, ComponentPropsWithoutRef<"footer">>(function Footer(
    { className, ...rest },
    ref,
) {
    return (
        <footer
            ref={ref}
            data-slot="footer"
            className={cn("border-t border-line bg-app", className)}
            {...rest}
        />
    );
});

const SIDEBAR_WIDTH: Record<"sm" | "md" | "lg", string> = {
    sm: "w-56",
    md: "w-64",
    lg: "w-72",
};

export interface SidebarProps extends ComponentPropsWithoutRef<"aside"> {
    readonly width?: "sm" | "md" | "lg";
    readonly responsive?: boolean;
}

export const Sidebar = forwardRef<HTMLElement, SidebarProps>(function Sidebar(
    { className, width = "md", responsive = true, children, ...rest },
    ref,
) {
    return (
        <aside
            ref={ref}
            data-slot="sidebar"
            aria-label="Sidebar"
            className={cn(
                "flex shrink-0 flex-col gap-4 border-line",
                SIDEBAR_WIDTH[width],
                responsive && "max-lg:hidden",
                className,
            )}
            {...rest}
        >
            {children}
        </aside>
    );
});

function clampRatio(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export interface SplitterProps {
    readonly first: ReactNode;
    readonly second: ReactNode;
    readonly ratio?: number;
    readonly defaultRatio?: number;
    readonly onRatioChange?: (ratio: number) => void;
    readonly min?: number;
    readonly max?: number;
    readonly label?: string;
    readonly className?: string;
}

export function Splitter({
    first,
    second,
    ratio,
    defaultRatio = 50,
    onRatioChange,
    min = 20,
    max = 80,
    label = "Resize panes",
    className,
}: SplitterProps): ReactNode {
    const [value, setValue] = useControllableState<number>({
        value: ratio,
        defaultValue: clampRatio(defaultRatio, min, max),
        ...(onRatioChange === undefined ? {} : { onChange: onRatioChange }),
    });
    const current = clampRatio(value, min, max);

    const update = (next: number): void => {
        setValue(clampRatio(next, min, max));
    };

    const onKeyDown = (event: KeyboardEvent<HTMLHRElement>): void => {
        switch (event.key) {
            case "ArrowLeft":
            case "ArrowDown":
                event.preventDefault();
                update(current - 5);
                return;
            case "ArrowRight":
            case "ArrowUp":
                event.preventDefault();
                update(current + 5);
                return;
            case "Home":
                event.preventDefault();
                update(min);
                return;
            case "End":
                event.preventDefault();
                update(max);
                return;
            default:
                return;
        }
    };

    const columns = `minmax(0, ${String(current)}fr) auto minmax(0, ${String(100 - current)}fr)`;

    return (
        <div
            data-slot="splitter"
            className={cn(
                "grid grid-cols-1 gap-4 sm:grid-cols-[var(--splitter-columns)] sm:gap-0",
                className,
            )}
            style={{ "--splitter-columns": columns } as CSSProperties}
        >
            <div className="min-w-0">{first}</div>
            {/* Focusable separator is the ARIA resize pattern. */}
            <hr
                aria-orientation="vertical"
                aria-label={label}
                aria-valuemin={min}
                aria-valuemax={max}
                aria-valuenow={Math.round(current)}
                tabIndex={0}
                onKeyDown={onKeyDown}
                className="mx-2 my-0 hidden h-auto w-1 shrink-0 self-stretch rounded-sm border-0 bg-line transition-colors hover:bg-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:block"
            />
            <div className="min-w-0">{second}</div>
        </div>
    );
}

export const Section = forwardRef<HTMLElement, ComponentPropsWithoutRef<"section">>(
    function Section({ className, ...rest }, ref) {
        return (
            <section
                ref={ref}
                data-slot="section"
                className={cn("flex flex-col gap-4", className)}
                {...rest}
            />
        );
    },
);

export type GridColumns = 1 | 2 | 3 | 4;

const gridVariants = tv({
    base: "grid",
    variants: {
        cols: {
            1: "grid-cols-1",
            2: "grid-cols-1 sm:grid-cols-2",
            3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
            4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
        },
        gap: {
            sm: "gap-2",
            md: "gap-4",
            lg: "gap-6",
        },
    },
    defaultVariants: {
        cols: 2,
        gap: "md",
    },
});

export interface GridProps extends ComponentPropsWithoutRef<"div"> {
    readonly cols?: GridColumns;
    readonly gap?: "sm" | "md" | "lg";
}

export const Grid = forwardRef<HTMLDivElement, GridProps>(function Grid(
    { className, cols = 2, gap = "md", ...rest },
    ref,
) {
    return (
        <div
            ref={ref}
            data-slot="grid"
            className={cn(gridVariants({ cols, gap }), className)}
            {...rest}
        />
    );
});

const columnsVariants = tv({
    base: "grid grid-cols-1 items-start",
    variants: {
        ratio: {
            equal: "lg:grid-cols-2",
            main: "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]",
            aside: "lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]",
        },
        gap: {
            sm: "gap-2",
            md: "gap-4",
            lg: "gap-6",
        },
    },
    defaultVariants: {
        ratio: "equal",
        gap: "lg",
    },
});

export interface ColumnsProps extends ComponentPropsWithoutRef<"div"> {
    readonly ratio?: "equal" | "main" | "aside";
    readonly gap?: "sm" | "md" | "lg";
}

export const Columns = forwardRef<HTMLDivElement, ColumnsProps>(function Columns(
    { className, ratio = "equal", gap = "lg", ...rest },
    ref,
) {
    return (
        <div
            ref={ref}
            data-slot="columns"
            className={cn(columnsVariants({ ratio, gap }), className)}
            {...rest}
        />
    );
});

const stackVariants = tv({
    base: "flex",
    variants: {
        direction: {
            vertical: "flex-col",
            horizontal: "flex-row",
        },
        gap: {
            sm: "gap-2",
            md: "gap-4",
            lg: "gap-6",
        },
        wrap: {
            true: "flex-wrap",
            false: "",
        },
    },
    defaultVariants: {
        direction: "vertical",
        gap: "md",
        wrap: false,
    },
});

export interface StackProps extends ComponentPropsWithoutRef<"div"> {
    readonly direction?: "vertical" | "horizontal";
    readonly gap?: "sm" | "md" | "lg";
    readonly wrap?: boolean;
}

export const Stack = forwardRef<HTMLDivElement, StackProps>(function Stack(
    { className, direction = "vertical", gap = "md", wrap = false, ...rest },
    ref,
) {
    return (
        <div
            ref={ref}
            data-slot="stack"
            className={cn(stackVariants({ direction, gap, wrap }), className)}
            {...rest}
        />
    );
});

export interface PageHeaderProps {
    readonly title: string;
    readonly description?: string;
    readonly actions?: ReactNode;
    readonly children?: ReactNode;
    readonly className?: string;
}

export function PageHeader({
    title,
    description,
    actions,
    children,
    className,
}: PageHeaderProps): ReactNode {
    return (
        <header
            data-slot="page-header"
            className={cn("flex flex-col gap-4 border-b border-line pb-6", className)}
        >
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex max-w-2xl flex-col gap-1">
                    <h1 className="text-2xl font-semibold text-balance">{title}</h1>
                    {description === undefined ? null : (
                        <p className="text-sm text-ink-muted text-pretty">{description}</p>
                    )}
                </div>
                {actions === undefined ? null : (
                    <div className="flex flex-wrap items-center gap-2">{actions}</div>
                )}
            </div>
            {children}
        </header>
    );
}

export interface PageBodyProps extends ComponentPropsWithoutRef<"div"> {
    readonly aside?: ReactNode;
}

export function PageBody({ className, aside, children, ...rest }: PageBodyProps): ReactNode {
    return (
        <div
            data-slot="page-body"
            className={cn(
                "grid gap-8",
                aside === undefined ? undefined : "lg:grid-cols-[minmax(0,1fr)_18rem]",
                className,
            )}
            {...rest}
        >
            <div className="flex min-w-0 flex-col gap-8">{children}</div>
            {aside === undefined ? null : <PageAside>{aside}</PageAside>}
        </div>
    );
}

export const PageAside = forwardRef<HTMLElement, ComponentPropsWithoutRef<"aside">>(
    function PageAside({ className, ...rest }, ref) {
        return (
            <aside
                ref={ref}
                data-slot="page-aside"
                aria-label="Page aside"
                className={cn(
                    "flex min-w-0 flex-col gap-4 lg:sticky lg:top-20 lg:self-start",
                    className,
                )}
                {...rest}
            />
        );
    },
);
