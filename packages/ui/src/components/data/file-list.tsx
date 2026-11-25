import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { EmptyState } from "../empty-state.js";
import { StatusIndicator, type StatusTone } from "../status-indicator.js";

export interface FileListItem {
    readonly id: string;
    readonly name: string;
    readonly size: number;
    readonly type: string;
    readonly status?: {
        readonly label: string;
        readonly tone: StatusTone;
    };
    readonly actions?: ReactNode;
}

export interface FileListProps {
    readonly items: readonly FileListItem[];
    readonly label?: string;
    readonly className?: string;
    readonly emptyTitle?: string;
    readonly emptyDescription?: string;
}

const SIZE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

export function formatFileSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) {
        return "0 B";
    }
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < SIZE_UNITS.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }
    const digits = unitIndex === 0 ? 0 : 1;
    return `${value.toFixed(digits)} ${SIZE_UNITS[unitIndex] ?? "B"}`;
}

export function FileList({
    items,
    label,
    className,
    emptyTitle = "No files",
    emptyDescription = "Files will appear here once they are attached.",
}: FileListProps): ReactNode {
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
        <ul
            aria-label={label}
            className={cn("divide-y divide-line rounded-lg border border-line bg-panel", className)}
            data-slot="file-list"
        >
            {items.map((item) => (
                <li key={item.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-sm font-medium text-ink">{item.name}</span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-subtle">
                            <span>{item.type}</span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">{formatFileSize(item.size)}</span>
                        </span>
                    </div>
                    {item.status === undefined ? null : (
                        <StatusIndicator tone={item.status.tone} label={item.status.label} />
                    )}
                    {item.actions === undefined ? null : (
                        <div className="flex shrink-0 items-center gap-1">{item.actions}</div>
                    )}
                </li>
            ))}
        </ul>
    );
}
