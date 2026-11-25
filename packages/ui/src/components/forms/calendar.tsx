import type { ReactNode } from "react";
import { DayPicker, type Matcher } from "react-day-picker";
import { cn } from "../../lib/cn.js";

const calendarClassNames = {
    root: "p-3",
    months: "relative flex flex-col gap-2",
    month: "flex flex-col gap-2",
    nav: "absolute inset-x-0 top-0 flex items-center justify-between",
    button_previous:
        "inline-flex size-7 items-center justify-center rounded-sm border border-line bg-panel text-ink-muted transition-colors hover:bg-raised hover:text-ink disabled:pointer-events-none disabled:opacity-50",
    button_next:
        "inline-flex size-7 items-center justify-center rounded-sm border border-line bg-panel text-ink-muted transition-colors hover:bg-raised hover:text-ink disabled:pointer-events-none disabled:opacity-50",
    chevron: "size-4",
    month_caption: "flex h-7 items-center justify-center",
    caption_label: "text-sm font-medium text-ink",
    dropdowns: "flex items-center gap-2",
    dropdown_root: "relative",
    dropdown: "h-8 rounded-sm border border-line bg-app px-2 text-sm text-ink",
    months_dropdown: "h-8 rounded-sm border border-line bg-app px-2 text-sm text-ink",
    years_dropdown: "h-8 rounded-sm border border-line bg-app px-2 text-sm text-ink",
    month_grid: "w-full border-collapse",
    weekdays: "",
    weekday: "p-1 text-xs font-normal text-ink-subtle",
    weeks: "",
    week: "",
    day: "p-0 text-center align-middle",
    day_button:
        "inline-flex size-9 items-center justify-center rounded-sm text-sm text-ink transition-colors hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
    selected: "[&>button]:bg-primary [&>button]:text-primary-ink [&>button]:hover:bg-primary-hover",
    today: "[&>button]:border [&>button]:border-line-strong",
    outside: "[&>button]:text-ink-subtle [&>button]:opacity-60",
    disabled: "[&>button]:cursor-not-allowed [&>button]:opacity-40",
    hidden: "invisible",
    range_start: "",
    range_middle: "",
    range_end: "",
    footer: "pt-2 text-xs text-ink-muted",
    week_number: "p-1 text-xs text-ink-subtle",
    week_number_header: "p-1 text-xs text-ink-subtle",
} as const;

export interface CalendarProps {
    readonly selected?: Date | undefined;
    readonly onSelect?: (date: Date | undefined) => void;
    readonly min?: Date | undefined;
    readonly max?: Date | undefined;
    readonly disabled?: boolean;
    readonly defaultMonth?: Date | undefined;
    readonly month?: Date | undefined;
    readonly onMonthChange?: (month: Date) => void;
    readonly showOutsideDays?: boolean;
    readonly className?: string;
}

export function Calendar({
    selected,
    onSelect,
    min,
    max,
    disabled = false,
    defaultMonth,
    month,
    onMonthChange,
    showOutsideDays = true,
    className,
}: CalendarProps): ReactNode {
    const matchers: Matcher[] = [];
    if (min !== undefined) {
        matchers.push({ before: min });
    }
    if (max !== undefined) {
        matchers.push({ after: max });
    }
    const disabledMatcher: Matcher | Matcher[] = disabled ? true : matchers;
    const initialMonth = defaultMonth ?? selected;
    const monthProps = {
        ...(initialMonth === undefined ? {} : { defaultMonth: initialMonth }),
        ...(month === undefined ? {} : { month }),
        ...(onMonthChange === undefined ? {} : { onMonthChange }),
        ...(min === undefined ? {} : { startMonth: min }),
        ...(max === undefined ? {} : { endMonth: max }),
    };

    return (
        <div data-slot="calendar" className={cn("text-ink", className)}>
            <DayPicker
                mode="single"
                selected={selected}
                onSelect={(date) => onSelect?.(date)}
                disabled={disabledMatcher}
                showOutsideDays={showOutsideDays}
                classNames={{ ...calendarClassNames }}
                {...monthProps}
            />
        </div>
    );
}
