import { forwardRef, useId, type ComponentPropsWithoutRef } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "../../lib/cn.js";
import { useControllableState } from "../../hooks/state.js";

export interface SliderProps extends Omit<
    ComponentPropsWithoutRef<typeof SliderPrimitive.Root>,
    "value" | "defaultValue" | "onValueChange" | "className"
> {
    readonly value?: number[];
    readonly defaultValue?: number[];
    readonly onValueChange?: (value: number[]) => void;
    readonly label?: string;
    readonly description?: string;
    readonly error?: string;
    readonly formatValue?: (value: number[]) => string;
    readonly className?: string;
}

export const Slider = forwardRef<HTMLSpanElement, SliderProps>(function Slider(
    {
        value,
        defaultValue,
        onValueChange,
        label,
        description,
        error,
        formatValue,
        className,
        min,
        max,
        disabled,
        "aria-describedby": ariaDescribedBy,
        ...rest
    },
    ref,
) {
    const id = useId();
    const descriptionId = description === undefined ? undefined : `${id}-description`;
    const errorId = error === undefined ? undefined : `${id}-error`;
    const describedBy =
        [ariaDescribedBy, descriptionId, errorId]
            .filter((entry) => entry !== undefined)
            .join(" ") || undefined;
    const [values, setValues] = useControllableState<number[]>({
        value,
        defaultValue: defaultValue ?? [min ?? 0],
        ...(onValueChange === undefined ? {} : { onChange: onValueChange }),
    });
    const display = formatValue?.(values) ?? values.join(" – ");

    return (
        <div className={cn("flex flex-col gap-2", className)} data-slot="slider">
            {label === undefined ? null : (
                <div className="flex items-baseline justify-between gap-2">
                    <span id={`${id}-label`} className="text-sm font-medium text-ink">
                        {label}
                    </span>
                    <span className="text-xs tabular-nums text-ink-muted">{display}</span>
                </div>
            )}
            <SliderPrimitive.Root
                ref={ref}
                value={values}
                onValueChange={setValues}
                min={min}
                max={max}
                disabled={disabled}
                aria-labelledby={label === undefined ? undefined : `${id}-label`}
                aria-describedby={describedBy}
                aria-invalid={error === undefined ? undefined : true}
                className={cn(
                    "relative flex w-full touch-none select-none items-center",
                    "data-[orientation=vertical]:h-44 data-[orientation=vertical]:w-5 data-[orientation=vertical]:flex-col",
                    "data-[disabled]:opacity-50",
                )}
                {...rest}
            >
                <SliderPrimitive.Track
                    className={cn(
                        "relative h-1.5 w-full grow overflow-hidden rounded-full bg-raised",
                        "data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5",
                    )}
                >
                    <SliderPrimitive.Range className="absolute h-full bg-primary data-[orientation=vertical]:w-full" />
                </SliderPrimitive.Track>
                {values.map((_, index) => (
                    <SliderPrimitive.Thumb
                        key={index}
                        aria-label={
                            values.length > 1
                                ? `${label ?? "Value"} ${index === 0 ? "minimum" : "maximum"}`
                                : (label ?? "Value")
                        }
                        aria-describedby={describedBy}
                        className={cn(
                            "block size-4 rounded-full border border-primary bg-app",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-app",
                            "data-[disabled]:pointer-events-none",
                        )}
                    />
                ))}
            </SliderPrimitive.Root>
            {description === undefined ? null : (
                <p id={descriptionId} className="text-xs text-ink-muted">
                    {description}
                </p>
            )}
            {error === undefined ? null : (
                <p id={errorId} className="text-xs text-ink" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
});
