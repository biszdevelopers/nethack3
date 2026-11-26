import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { EmptyState } from "../empty-state.js";

export interface StatisticItem {
    readonly id?: string;
    readonly label: string;
    readonly value: ReactNode;
    readonly hint?: ReactNode;
}

export interface StatisticsProps {
    readonly items: readonly StatisticItem[];
    readonly columns?: 1 | 2 | 3 | 4;
    readonly label?: string;
    readonly className?: string;
    readonly emptyTitle?: string;
    readonly emptyDescription?: string;
}

const COLUMN_CLASS: Record<1 | 2 | 3 | 4, string> = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

export function Statistics({
    items,
    columns = 2,
    label,
    className,
    emptyTitle = "No statistics",
    emptyDescription = "Statistics will appear here when data is available.",
}: StatisticsProps): ReactNode {
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
            className={cn("grid gap-3", COLUMN_CLASS[columns], className)}
            data-slot="statistics"
        >
            {items.map((item, index) => (
                <div
                    key={item.id ?? `${item.label}-${index}`}
                    className="flex min-w-0 flex-col gap-1 rounded-md border border-line bg-panel p-4"
                >
                    <dt className="text-xs text-ink-muted">{item.label}</dt>
                    <dd className="flex flex-col gap-1">
                        <span className="text-2xl font-semibold tabular-nums text-ink">
                            {item.value}
                        </span>
                        {item.hint === undefined ? null : (
                            <span className="text-xs text-ink-subtle">{item.hint}</span>
                        )}
                    </dd>
                </div>
            ))}
        </dl>
    );
}
