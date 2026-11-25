import type { ReactNode } from "react";
import { format } from "date-fns";
import { cn } from "../../lib/cn.js";
import { EmptyState } from "../empty-state.js";
import { StatusIndicator, type StatusTone } from "../status-indicator.js";

export interface TimelineEvent {
    readonly id: string;
    readonly time: Date | string;
    readonly title: string;
    readonly description?: ReactNode;
    readonly status?: {
        readonly label: string;
        readonly tone: StatusTone;
    };
}

export interface TimelineProps {
    readonly events: readonly TimelineEvent[];
    readonly label?: string;
    readonly className?: string;
    readonly emptyTitle?: string;
    readonly emptyDescription?: string;
}

const TONE_DOT: Record<StatusTone, string> = {
    success: "bg-primary",
    neutral: "bg-ink-subtle",
    attention: "bg-ink",
    pending: "border border-ink-subtle bg-transparent",
};

function timeParts(time: Date | string): { display: string; dateTime: string | undefined } {
    if (time instanceof Date) {
        return { display: format(time, "PP p"), dateTime: time.toISOString() };
    }
    return { display: time, dateTime: undefined };
}

export function Timeline({
    events,
    label,
    className,
    emptyTitle = "No events",
    emptyDescription = "Events will appear here when they are recorded.",
}: TimelineProps): ReactNode {
    if (events.length === 0) {
        return (
            <EmptyState
                title={emptyTitle}
                description={emptyDescription}
                className={className ?? ""}
            />
        );
    }

    return (
        <ol aria-label={label} className={cn("flex flex-col", className)}>
            {events.map((event, index) => {
                const { display, dateTime } = timeParts(event.time);
                return (
                    <li key={event.id} className="relative flex gap-3 pb-5 pl-5 last:pb-0">
                        {index === events.length - 1 ? null : (
                            <span
                                aria-hidden="true"
                                className="absolute bottom-0 left-[3px] top-4 w-px bg-line"
                            />
                        )}
                        <span
                            aria-hidden="true"
                            className={cn(
                                "absolute left-0 top-1.5 size-1.5 rounded-full",
                                event.status === undefined
                                    ? "bg-line-strong"
                                    : TONE_DOT[event.status.tone],
                            )}
                        />
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <p className="text-sm font-medium text-ink">{event.title}</p>
                                <time
                                    dateTime={dateTime}
                                    className="text-xs tabular-nums text-ink-subtle"
                                >
                                    {display}
                                </time>
                            </div>
                            {event.description === undefined ? null : (
                                <div className="text-sm text-ink-muted">{event.description}</div>
                            )}
                            {event.status === undefined ? null : (
                                <StatusIndicator
                                    tone={event.status.tone}
                                    label={event.status.label}
                                />
                            )}
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}
