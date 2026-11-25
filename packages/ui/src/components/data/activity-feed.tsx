import { useId, type ReactNode } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { cn } from "../../lib/cn.js";
import { EmptyState } from "../empty-state.js";

export interface ActivityFeedItem {
    readonly id: string;
    readonly actor: string;
    readonly action: string;
    readonly target?: ReactNode;
    readonly timestamp: Date;
}

export interface ActivityFeedProps {
    readonly items: readonly ActivityFeedItem[];
    readonly label?: string;
    readonly className?: string;
    readonly emptyTitle?: string;
    readonly emptyDescription?: string;
}

interface DayGroup {
    readonly key: string;
    readonly date: Date;
    readonly items: ActivityFeedItem[];
}

function groupByDay(items: readonly ActivityFeedItem[]): DayGroup[] {
    const sorted = [...items].sort(
        (left, right) => right.timestamp.getTime() - left.timestamp.getTime(),
    );
    const groups: DayGroup[] = [];
    for (const item of sorted) {
        const key = format(item.timestamp, "yyyy-MM-dd");
        const current = groups[groups.length - 1];
        if (current !== undefined && current.key === key) {
            current.items.push(item);
        } else {
            groups.push({ key, date: item.timestamp, items: [item] });
        }
    }
    return groups;
}

function dayLabel(date: Date): string {
    if (isToday(date)) {
        return "Today";
    }
    if (isYesterday(date)) {
        return "Yesterday";
    }
    return format(date, "PPP");
}

export function ActivityFeed({
    items,
    label,
    className,
    emptyTitle = "No activity",
    emptyDescription = "Activity will appear here when actions are recorded.",
}: ActivityFeedProps): ReactNode {
    const headingId = useId();

    if (items.length === 0) {
        return (
            <EmptyState
                title={emptyTitle}
                description={emptyDescription}
                className={className ?? ""}
            />
        );
    }

    const groups = groupByDay(items);

    return (
        <section
            aria-label={label}
            className={cn("flex flex-col gap-5", className)}
            data-slot="activity-feed"
        >
            {groups.map((group) => (
                <section
                    key={group.key}
                    aria-labelledby={`${headingId}-${group.key}`}
                    className="flex flex-col gap-2"
                >
                    <h3
                        id={`${headingId}-${group.key}`}
                        className="text-xs font-medium text-ink-subtle"
                    >
                        {dayLabel(group.date)}
                    </h3>
                    <ol className="flex flex-col gap-3">
                        {group.items.map((item) => (
                            <li key={item.id} className="flex items-start gap-2 text-sm">
                                <span
                                    aria-hidden="true"
                                    className="mt-2 size-1.5 shrink-0 rounded-full bg-line-strong"
                                />
                                <p className="min-w-0 flex-1 text-ink-muted">
                                    <span className="font-medium text-ink">{item.actor}</span>{" "}
                                    {item.action}
                                    {item.target === undefined ? null : (
                                        <>
                                            {" "}
                                            <span className="text-ink">{item.target}</span>
                                        </>
                                    )}
                                </p>
                                <time
                                    dateTime={item.timestamp.toISOString()}
                                    className="shrink-0 text-xs tabular-nums text-ink-subtle"
                                >
                                    {format(item.timestamp, "HH:mm")}
                                </time>
                            </li>
                        ))}
                    </ol>
                </section>
            ))}
        </section>
    );
}
