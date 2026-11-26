import type { ReactNode } from "react";
import { cn } from "../lib/cn.js";

export interface EmptyStateProps {
    readonly title: string;
    readonly description: string;
    readonly action?: ReactNode;
    readonly icon?: ReactNode;
    readonly className?: string;
}

export function EmptyState({
    title,
    description,
    action,
    icon,
    className,
}: EmptyStateProps): ReactNode {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line px-6 py-12 text-center",
                className,
            )}
        >
            {icon === undefined ? null : (
                <div className="text-ink-subtle" aria-hidden="true">
                    {icon}
                </div>
            )}
            <div className="flex max-w-md flex-col gap-1">
                <h3 className="text-base font-medium text-ink">{title}</h3>
                <p className="text-sm text-ink-muted">{description}</p>
            </div>
            {action}
        </div>
    );
}
