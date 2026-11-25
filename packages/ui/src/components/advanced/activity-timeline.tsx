import type { ReactNode } from "react";
import { Timeline, type TimelineEvent } from "../data/timeline.js";

export type SubmissionActivityType = "submission" | "review" | "judging" | "decision" | "comment";

export interface SubmissionActivityEvent {
    readonly id: string;
    readonly type: SubmissionActivityType;
    readonly title: string;
    readonly description?: string;
    readonly timestamp: Date;
    readonly actor?: string;
}

export interface ActivityTimelineProps {
    readonly events: readonly SubmissionActivityEvent[];
    readonly label?: string;
    readonly className?: string;
}

const TYPE_LABELS: Record<SubmissionActivityType, string> = {
    submission: "Submission",
    review: "Review",
    judging: "Judging",
    decision: "Decision",
    comment: "Comment",
};

export function ActivityTimeline({
    events,
    label = "Submission activity",
    className,
}: ActivityTimelineProps): ReactNode {
    const timelineEvents: TimelineEvent[] = events.map((event) => {
        const descriptionParts = [event.actor, event.description].filter(
            (part): part is string => part !== undefined,
        );
        return {
            id: event.id,
            time: event.timestamp,
            title: event.title,
            status: { label: TYPE_LABELS[event.type], tone: "neutral" },
            ...(descriptionParts.length === 0 ? {} : { description: descriptionParts.join(" · ") }),
        };
    });

    return (
        <Timeline
            events={timelineEvents}
            label={label}
            className={className ?? ""}
            emptyTitle="No submission activity"
            emptyDescription="Submission and judging events will appear here."
        />
    );
}
