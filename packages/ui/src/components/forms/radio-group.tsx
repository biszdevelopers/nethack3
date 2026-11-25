import { forwardRef, useId, type ComponentPropsWithoutRef, type ReactNode } from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../../lib/cn.js";

export const radioGroupItemVariants = tv({
    base: [
        "flex size-4 shrink-0 items-center justify-center rounded-full border border-line-strong bg-app",
        "transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-app",
        "data-[state=checked]:border-primary data-[state=checked]:bg-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
    ],
    variants: {
        size: {
            sm: "size-4",
            md: "size-5",
            lg: "size-6",
        },
    },
    defaultVariants: {
        size: "md",
    },
});

export interface RadioGroupOption {
    readonly value: string;
    readonly label: ReactNode;
    readonly description?: string;
    readonly disabled?: boolean;
}

export interface RadioGroupProps
    extends
        Omit<
            ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>,
            "className" | "aria-describedby" | "aria-invalid" | "aria-labelledby"
        >,
        VariantProps<typeof radioGroupItemVariants> {
    readonly options: readonly RadioGroupOption[];
    readonly label: string;
    readonly description?: string;
    readonly error?: string;
    readonly className?: string;
    readonly orientation?: "horizontal" | "vertical";
}

export const RadioGroup = forwardRef<HTMLDivElement, RadioGroupProps>(function RadioGroup(
    {
        options,
        label,
        description,
        error,
        className,
        orientation = "vertical",
        size,
        disabled,
        ...rest
    },
    ref,
) {
    const id = useId();
    const labelId = `${id}-label`;
    const descriptionId = description === undefined ? undefined : `${id}-description`;
    const errorId = error === undefined ? undefined : `${id}-error`;
    const describedBy =
        [descriptionId, errorId].filter((entry) => entry !== undefined).join(" ") || undefined;

    return (
        <div className={cn("flex flex-col gap-1.5", className)} data-slot="radio-group">
            <span id={labelId} className="text-sm font-medium text-ink">
                {label}
            </span>
            {description === undefined ? null : (
                <p id={descriptionId} className="text-xs text-ink-muted">
                    {description}
                </p>
            )}
            <RadioGroupPrimitive.Root
                ref={ref}
                aria-labelledby={labelId}
                aria-describedby={describedBy}
                aria-invalid={error === undefined ? undefined : true}
                aria-required={rest.required}
                orientation={orientation}
                disabled={disabled}
                className={cn(
                    "flex gap-2",
                    orientation === "vertical" ? "flex-col" : "flex-row flex-wrap",
                )}
                {...rest}
            >
                {options.map((option) => {
                    const optionId = `${id}-${option.value}`;
                    const optionDescriptionId = `${optionId}-description`;
                    return (
                        <div key={option.value} className="flex flex-col gap-1">
                            <div className="flex items-start gap-2.5">
                                <RadioGroupPrimitive.Item
                                    id={optionId}
                                    value={option.value}
                                    disabled={disabled === true || option.disabled === true}
                                    aria-describedby={
                                        option.description === undefined
                                            ? undefined
                                            : optionDescriptionId
                                    }
                                    className={cn(radioGroupItemVariants({ size }), "mt-0.5")}
                                >
                                    <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
                                        <span className="size-2 rounded-full bg-primary-ink" />
                                    </RadioGroupPrimitive.Indicator>
                                </RadioGroupPrimitive.Item>
                                <label htmlFor={optionId} className="text-sm leading-5 text-ink">
                                    {option.label}
                                </label>
                            </div>
                            {option.description === undefined ? null : (
                                <p id={optionDescriptionId} className="pl-7 text-xs text-ink-muted">
                                    {option.description}
                                </p>
                            )}
                        </div>
                    );
                })}
            </RadioGroupPrimitive.Root>
            {error === undefined ? null : (
                <p id={errorId} className="text-xs text-ink" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
});
