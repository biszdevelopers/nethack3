import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "../../lib/cn.js";

export interface ProgressProps
    extends Omit<ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>, "value" | "max"> {
    readonly label: string;
    readonly value?: number | null;
    readonly max?: number;
    readonly valueText?: string;
    readonly showValue?: boolean;
}

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(function Progress(
    {
        className,
        label,
        value = null,
        max = 100,
        valueText,
        showValue = true,
        ...rest
    },
    ref,
) {
    const clampedValue =
        value === null || max <= 0 ? null : Math.min(Math.max(value, 0), max);
    const ratio = clampedValue === null ? null : clampedValue / max;
    const percent = ratio === null ? null : Math.round(ratio * 100);
    return (
        <div className={cn("flex w-full flex-col gap-1.5", className)}>
            <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-ink-muted">{label}</span>
                {valueText !== undefined ? (
                    <span className="shrink-0 tabular-nums text-ink">{valueText}</span>
                ) : showValue && percent !== null ? (
                    <span className="shrink-0 tabular-nums text-ink">{percent}%</span>
                ) : null}
            </div>
            <ProgressPrimitive.Root
                ref={ref}
                value={clampedValue}
                max={max}
                aria-label={label}
                aria-valuetext={valueText}
                className="relative h-2 w-full overflow-hidden rounded-sm bg-raised"
                {...rest}
            >
                <ProgressPrimitive.Indicator
                    data-slot="progress-indicator"
                    className={cn(
                        "h-full bg-primary transition-transform duration-150 motion-reduce:transition-none",
                        percent === null ? "w-1/3 animate-pulse motion-reduce:animate-none" : "w-full",
                    )}
                    style={
                        percent === null
                            ? { transform: "translateX(0)" }
                            : { transform: `translateX(-${100 - percent}%)` }
                    }
                />
            </ProgressPrimitive.Root>
        </div>
    );
});
