import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../../lib/cn.js";

export interface BreadcrumbItem {
    readonly label: string;
    readonly href?: string;
}

export interface BreadcrumbProps extends ComponentPropsWithoutRef<"nav"> {
    readonly items: readonly BreadcrumbItem[];
}

export const Breadcrumb = forwardRef<HTMLElement, BreadcrumbProps>(function Breadcrumb(
    { items, className, "aria-label": ariaLabel, ...rest },
    ref,
) {
    if (items.length === 0) {
        return null;
    }
    return (
        <nav
            ref={ref}
            data-slot="breadcrumb"
            aria-label={ariaLabel ?? "Breadcrumb"}
            className={cn("text-sm", className)}
            {...rest}
        >
            <ol className="flex flex-wrap items-center gap-1.5 text-ink-muted">
                {items.map((item, index) => {
                    const isLast = index === items.length - 1;
                    return (
                        <li
                            key={`${item.label}-${String(index)}`}
                            className="flex items-center gap-1.5"
                        >
                            {index > 0 ? (
                                <ChevronRight
                                    className="size-3.5 text-ink-subtle"
                                    aria-hidden="true"
                                />
                            ) : null}
                            {item.href !== undefined && !isLast ? (
                                <a
                                    href={item.href}
                                    className="inline-flex min-h-9 items-center rounded-sm underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                >
                                    {item.label}
                                </a>
                            ) : (
                                <span
                                    aria-current={isLast ? "page" : undefined}
                                    className={isLast ? "text-ink" : undefined}
                                >
                                    {item.label}
                                </span>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
});
