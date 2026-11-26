import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { EmptyState } from "../empty-state.js";

export interface KeyValueItem {
    readonly id?: string;
    readonly label: string;
    readonly value: ReactNode;
}

export interface KeyValueProps {
    readonly items: readonly KeyValueItem[];
    readonly columns?: 1 | 2;
    readonly label?: string;
    readonly className?: string;
    readonly emptyTitle?: string;
    readonly emptyDescription?: string;
}

const COLUMN_CLASS: Record<1 | 2, string> = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
};

export function KeyValue({
    items,
    columns = 2,
    label,
    className,
    emptyTitle = "No details",
    emptyDescription = "Details will appear here when they are available.",
}: KeyValueProps): ReactNode {
    if (items.length === 0) {
        return (
            <EmptyState
                title={emptyTitle}
                description={emptyDescription}
                className={className ?? ""}
            />
        );
    }

    return (
        <dl
            aria-label={label}
            className={cn("grid gap-x-6 gap-y-3", COLUMN_CLASS[columns], className)}
            data-slot="key-value"
        >
            {items.map((item) => (
                <div key={item.id ?? item.label} className="flex min-w-0 flex-col gap-0.5">
                    <dt className="text-xs text-ink-subtle">{item.label}</dt>
                    <dd className="break-words text-sm text-ink">{item.value}</dd>
                </div>
            ))}
        </dl>
    );
}
