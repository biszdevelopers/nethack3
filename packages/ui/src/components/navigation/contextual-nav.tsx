import { type ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export interface ContextualNavItem {
    readonly id: string;
    readonly label: string;
    readonly href?: string;
    readonly active?: boolean;
    readonly onSelect?: () => void;
}

export interface ContextualNavigationProps {
    readonly items: readonly ContextualNavItem[];
    readonly title?: string;
    readonly label?: string;
    readonly className?: string;
}

export function ContextualNavigation({
    items,
    title,
    label,
    className,
}: ContextualNavigationProps): ReactNode {
    return (
        <nav
            data-slot="contextual-navigation"
            aria-label={label ?? title ?? "Secondary"}
            className={cn("flex flex-col gap-2", className)}
        >
            {title === undefined ? null : (
                <p className="px-2 text-xs font-medium text-ink-subtle">{title}</p>
            )}
            {items.length === 0 ? (
                <p className="px-2 text-sm text-ink-subtle">No links.</p>
            ) : (
                <ul className="flex flex-col gap-0.5">
                    {items.map((item) => {
                        const itemClass = cn(
                            "flex min-h-9 w-full items-center rounded-sm px-2 py-1.5 text-sm transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                            item.active === true
                                ? "bg-raised font-medium text-ink"
                                : "text-ink-muted hover:bg-raised hover:text-ink",
                        );
                        return (
                            <li key={item.id}>
                                {item.href === undefined ? (
                                    <button
                                        type="button"
                                        aria-current={item.active === true ? "page" : undefined}
                                        onClick={item.onSelect}
                                        className={cn(itemClass, "text-left")}
                                    >
                                        {item.label}
                                    </button>
                                ) : (
                                    <a
                                        href={item.href}
                                        aria-current={item.active === true ? "page" : undefined}
                                        onClick={item.onSelect}
                                        className={itemClass}
                                    >
                                        {item.label}
                                    </a>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </nav>
    );
}
