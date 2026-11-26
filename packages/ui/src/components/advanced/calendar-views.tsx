import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
    addDays,
    addMonths,
    addWeeks,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    isBefore,
    isSameDay,
    isSameMonth,
    startOfDay,
    startOfMonth,
    startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { EmptyState } from "../empty-state.js";

export type CalendarViewMode = "month" | "week" | "agenda";

export interface CalendarEvent {
    readonly id: string;
    readonly title: string;
    readonly start: Date;
    readonly end?: Date;
}

export interface CalendarViewsProps {
    readonly date: Date;
    readonly onDateChange: (date: Date) => void;
    readonly focusedDate: Date;
    readonly onFocusedDateChange: (date: Date) => void;
    readonly events: readonly CalendarEvent[];
    readonly view?: CalendarViewMode;
    readonly defaultView?: CalendarViewMode;
    readonly onViewChange?: (view: CalendarViewMode) => void;
    readonly onEventSelect?: (event: CalendarEvent) => void;
    readonly label?: string;
    readonly className?: string;
}

const VIEW_LABELS: Record<CalendarViewMode, string> = {
    month: "Month",
    week: "Week",
    agenda: "Agenda",
};

const VIEW_MODES: readonly CalendarViewMode[] = ["month", "week", "agenda"];

const VIEW_STEPS: Record<CalendarViewMode, (date: Date, amount: number) => Date> = {
    month: addMonths,
    week: addWeeks,
    agenda: addWeeks,
};

function eventsForDay(events: readonly CalendarEvent[], day: Date): CalendarEvent[] {
    return events
        .filter((event) => isSameDay(event.start, day))
        .toSorted((left, right) => left.start.getTime() - right.start.getTime());
}

function chunkWeeks(days: readonly Date[]): Date[][] {
    const weeks: Date[][] = [];
    for (let index = 0; index < days.length; index += 7) {
        weeks.push(days.slice(index, index + 7));
    }
    return weeks;
}

interface MonthViewProps {
    readonly date: Date;
    readonly focusedDate: Date;
    readonly events: readonly CalendarEvent[];
    readonly onDateChange: (date: Date) => void;
    readonly onFocusedDateChange: (date: Date) => void;
}

function MonthView({
    date,
    focusedDate,
    events,
    onDateChange,
    onFocusedDateChange,
}: MonthViewProps): ReactNode {
    const dayRefs = useRef(new Map<string, HTMLButtonElement>());
    const focusRequested = useRef(false);
    const gridStart = startOfWeek(startOfMonth(date));
    const gridEnd = endOfWeek(endOfMonth(date));
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
    const weeks = chunkWeeks(days);
    const weekdayLabels = Array.from({ length: 7 }, (_, index) =>
        format(addDays(gridStart, index), "EEE"),
    );

    useEffect(() => {
        if (!focusRequested.current) {
            return;
        }
        focusRequested.current = false;
        dayRefs.current.get(format(focusedDate, "yyyy-MM-dd"))?.focus();
    }, [focusedDate]);

    const moveFocus = (next: Date): void => {
        focusRequested.current = true;
        onFocusedDateChange(next);
        if (!isSameMonth(next, date)) {
            onDateChange(next);
        }
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, day: Date): void => {
        let next: Date | null = null;
        switch (event.key) {
            case "ArrowLeft":
                next = addDays(day, -1);
                break;
            case "ArrowRight":
                next = addDays(day, 1);
                break;
            case "ArrowUp":
                next = addDays(day, -7);
                break;
            case "ArrowDown":
                next = addDays(day, 7);
                break;
            case "Home":
                next = startOfWeek(day);
                break;
            case "End":
                next = endOfWeek(day);
                break;
            case "PageUp":
                next = addMonths(day, -1);
                break;
            case "PageDown":
                next = addMonths(day, 1);
                break;
            case "Enter":
                onDateChange(day);
                return;
            case " ":
                event.preventDefault();
                onDateChange(day);
                return;
            default:
                return;
        }
        event.preventDefault();
        moveFocus(next);
    };

    return (
        <table className="w-full table-fixed border-collapse" data-slot="calendar-month">
            <caption className="sr-only">{format(date, "MMMM yyyy")}</caption>
            <thead>
                <tr>
                    {weekdayLabels.map((weekday) => (
                        <th
                            key={weekday}
                            scope="col"
                            className="border-b border-line pb-2 text-left text-xs font-medium text-ink-subtle"
                        >
                            {weekday}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {weeks.map((week) => {
                    const firstDay = week[0];
                    return (
                        <tr key={firstDay === undefined ? "week" : format(firstDay, "yyyy-MM-dd")}>
                            {week.map((day) => {
                                const key = format(day, "yyyy-MM-dd");
                                const dayEvents = eventsForDay(events, day);
                                const isSelected = isSameDay(day, date);
                                const isFocused = isSameDay(day, focusedDate);
                                const inMonth = isSameMonth(day, date);
                                return (
                                    <td key={key} className="p-0.5 align-top">
                                        <button
                                            type="button"
                                            ref={(element) => {
                                                if (element === null) {
                                                    dayRefs.current.delete(key);
                                                } else {
                                                    dayRefs.current.set(key, element);
                                                }
                                            }}
                                            tabIndex={isFocused ? 0 : -1}
                                            aria-pressed={isSelected}
                                            aria-label={format(day, "PPPP")}
                                            onClick={() => {
                                                onFocusedDateChange(day);
                                                onDateChange(day);
                                            }}
                                            onKeyDown={(event) => handleKeyDown(event, day)}
                                            className={cn(
                                                "flex min-h-20 w-full flex-col gap-1 rounded-sm border p-1.5 text-left transition-colors",
                                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                                inMonth
                                                    ? "border-line bg-app text-ink hover:bg-raised"
                                                    : "border-transparent bg-transparent text-ink-subtle",
                                                isSelected && "border-primary bg-primary-soft",
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    "text-xs tabular-nums",
                                                    isSelected ? "font-medium text-primary" : "",
                                                )}
                                            >
                                                {format(day, "d")}
                                            </span>
                                            {dayEvents.slice(0, 3).map((event) => (
                                                <span
                                                    key={event.id}
                                                    className="truncate text-[11px] text-ink-muted"
                                                >
                                                    {event.title}
                                                </span>
                                            ))}
                                            {dayEvents.length > 3 ? (
                                                <span className="text-[11px] text-ink-subtle">
                                                    +{dayEvents.length - 3} more
                                                </span>
                                            ) : null}
                                        </button>
                                    </td>
                                );
                            })}
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

interface WeekViewProps {
    readonly date: Date;
    readonly events: readonly CalendarEvent[];
    readonly onDateChange: (date: Date) => void;
    readonly onEventSelect?: (event: CalendarEvent) => void;
}

function WeekView({ date, events, onDateChange, onEventSelect }: WeekViewProps): ReactNode {
    const weekStart = startOfWeek(date);
    const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
    return (
        <section
            aria-label={`Week of ${format(weekStart, "PPP")}`}
            className="grid grid-cols-1 gap-2 sm:grid-cols-7"
            data-slot="calendar-week"
        >
            {days.map((day) => {
                const dayEvents = eventsForDay(events, day);
                const isSelected = isSameDay(day, date);
                return (
                    <section
                        key={day.toISOString()}
                        aria-label={format(day, "PPPP")}
                        className={cn(
                            "flex min-h-32 flex-col gap-2 rounded-md border p-2",
                            isSelected ? "border-primary bg-primary-soft" : "border-line bg-panel",
                        )}
                    >
                        <button
                            type="button"
                            onClick={() => onDateChange(day)}
                            aria-pressed={isSelected}
                            className="flex items-baseline justify-between gap-1 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                            <span className="text-xs text-ink-muted">{format(day, "EEE")}</span>
                            <span className="text-sm font-medium tabular-nums text-ink">
                                {format(day, "d")}
                            </span>
                        </button>
                        {dayEvents.length === 0 ? (
                            <p className="text-[11px] text-ink-subtle">No events</p>
                        ) : (
                            <ul className="flex flex-col gap-1">
                                {dayEvents.map((event) => (
                                    <li key={event.id}>
                                        {onEventSelect === undefined ? (
                                            <span className="block rounded-sm bg-raised px-1.5 py-1 text-[11px] text-ink">
                                                {format(event.start, "HH:mm")} {event.title}
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => onEventSelect(event)}
                                                aria-label={`${format(event.start, "PPPP p")}: ${event.title}`}
                                                className="w-full truncate rounded-sm bg-raised px-1.5 py-1 text-left text-[11px] text-ink transition-colors hover:bg-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                            >
                                                {format(event.start, "HH:mm")} {event.title}
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                );
            })}
        </section>
    );
}

interface AgendaViewProps {
    readonly date: Date;
    readonly events: readonly CalendarEvent[];
    readonly onEventSelect?: (event: CalendarEvent) => void;
}

function AgendaView({ date, events, onEventSelect }: AgendaViewProps): ReactNode {
    const from = startOfDay(date);
    const upcoming = events
        .filter((event) => !isBefore(event.start, from))
        .toSorted((left, right) => left.start.getTime() - right.start.getTime());
    if (upcoming.length === 0) {
        return (
            <EmptyState
                title="No upcoming events"
                description={`Events scheduled on or after ${format(date, "PPP")} will appear here.`}
            />
        );
    }
    const groups = new Map<string, CalendarEvent[]>();
    for (const event of upcoming) {
        const key = format(event.start, "yyyy-MM-dd");
        const existing = groups.get(key);
        if (existing === undefined) {
            groups.set(key, [event]);
        } else {
            existing.push(event);
        }
    }
    return (
        <div className="flex flex-col gap-4" data-slot="calendar-agenda">
            {Array.from(groups, ([key, groupEvents]) => {
                const first = groupEvents[0];
                return (
                    <section
                        key={key}
                        aria-label={first === undefined ? key : format(first.start, "PPPP")}
                    >
                        <h3 className="mb-2 text-xs font-medium text-ink-subtle">
                            {first === undefined ? key : format(first.start, "PPPP")}
                        </h3>
                        <ul className="divide-y divide-line rounded-md border border-line">
                            {groupEvents.map((event) => (
                                <li key={event.id}>
                                    {onEventSelect === undefined ? (
                                        <div className="flex items-baseline gap-3 px-3 py-2">
                                            <time
                                                dateTime={event.start.toISOString()}
                                                className="shrink-0 text-xs tabular-nums text-ink-subtle"
                                            >
                                                {format(event.start, "HH:mm")}
                                            </time>
                                            <span className="text-sm text-ink">{event.title}</span>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => onEventSelect(event)}
                                            className="flex w-full items-baseline gap-3 rounded-sm px-3 py-2 text-left transition-colors hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                        >
                                            <time
                                                dateTime={event.start.toISOString()}
                                                className="shrink-0 text-xs tabular-nums text-ink-subtle"
                                            >
                                                {format(event.start, "HH:mm")}
                                            </time>
                                            <span className="text-sm text-ink">{event.title}</span>
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </section>
                );
            })}
        </div>
    );
}

export function CalendarViews({
    date,
    onDateChange,
    focusedDate,
    onFocusedDateChange,
    events,
    view,
    defaultView = "month",
    onViewChange,
    onEventSelect,
    label = "Calendar",
    className,
}: CalendarViewsProps): ReactNode {
    const [internalView, setInternalView] = useState<CalendarViewMode>(defaultView);
    const activeView = view ?? internalView;

    const changeView = (next: CalendarViewMode): void => {
        if (view === undefined) {
            setInternalView(next);
        }
        onViewChange?.(next);
    };

    const changeDate = (next: Date): void => {
        onDateChange(next);
        onFocusedDateChange(next);
    };

    const navigate = (direction: -1 | 1): void => {
        changeDate(VIEW_STEPS[activeView](date, direction));
    };

    const heading =
        activeView === "month"
            ? format(date, "MMMM yyyy")
            : activeView === "week"
              ? `${format(startOfWeek(date), "MMM d")} – ${format(endOfWeek(date), "MMM d")}`
              : `From ${format(date, "PPP")}`;

    return (
        <section
            aria-label={label}
            className={cn("flex flex-col gap-3", className)}
            data-slot="calendar-views"
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        aria-label={`Previous ${VIEW_LABELS[activeView].toLowerCase()}`}
                        onClick={() => navigate(-1)}
                        className="inline-flex size-8 items-center justify-center rounded-sm text-ink-muted transition-colors hover:bg-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                        <ChevronLeft className="size-4" aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        aria-label={`Next ${VIEW_LABELS[activeView].toLowerCase()}`}
                        onClick={() => navigate(1)}
                        className="inline-flex size-8 items-center justify-center rounded-sm text-ink-muted transition-colors hover:bg-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                        <ChevronRight className="size-4" aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        onClick={() => changeDate(new Date())}
                        className="rounded-sm px-2 py-1 text-xs text-ink-muted transition-colors hover:bg-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                        Today
                    </button>
                    <h2 className="ml-2 text-sm font-medium text-ink">{heading}</h2>
                </div>
                <fieldset className="m-0 flex gap-1 border-0 p-0">
                    <legend className="sr-only">Calendar view</legend>
                    {VIEW_MODES.map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            aria-pressed={activeView === mode}
                            onClick={() => changeView(mode)}
                            className={cn(
                                "rounded-sm px-2 py-1 text-xs transition-colors",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                activeView === mode
                                    ? "bg-raised text-ink"
                                    : "text-ink-muted hover:bg-raised hover:text-ink",
                            )}
                        >
                            {VIEW_LABELS[mode]}
                        </button>
                    ))}
                </fieldset>
            </div>
            {activeView === "month" ? (
                <MonthView
                    date={date}
                    focusedDate={focusedDate}
                    events={events}
                    onDateChange={onDateChange}
                    onFocusedDateChange={onFocusedDateChange}
                />
            ) : activeView === "week" ? (
                <WeekView
                    date={date}
                    events={events}
                    onDateChange={onDateChange}
                    {...(onEventSelect === undefined ? {} : { onEventSelect })}
                />
            ) : (
                <AgendaView
                    date={date}
                    events={events}
                    {...(onEventSelect === undefined ? {} : { onEventSelect })}
                />
            )}
        </section>
    );
}
