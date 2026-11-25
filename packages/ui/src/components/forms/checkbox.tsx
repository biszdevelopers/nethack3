import { forwardRef, useId, type ComponentPropsWithoutRef, type ReactNode } from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../../lib/cn.js";
import { useControllableState } from "../../hooks/state.js";
import { Label } from "../label.js";

export type CheckboxCheckedState = CheckboxPrimitive.CheckedState;

export const checkboxVariants = tv({
    base: [
        "flex shrink-0 items-center justify-center rounded-sm border border-line-strong bg-app text-primary-ink",
        "transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-app",
        "data-[state=checked]:border-primary data-[state=checked]:bg-primary",
        "data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary",
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

export interface CheckboxProps
    extends
        Omit<
            ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
            "checked" | "defaultChecked" | "onCheckedChange" | "className"
        >,
        VariantProps<typeof checkboxVariants> {
    readonly label?: ReactNode;
    readonly description?: string | undefined;
    readonly error?: string | undefined;
    readonly indeterminate?: boolean;
    readonly checked?: CheckboxCheckedState;
    readonly defaultChecked?: CheckboxCheckedState;
    readonly onCheckedChange?: (checked: CheckboxCheckedState) => void;
    readonly className?: string;
    readonly labelClassName?: string;
}

export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(function Checkbox(
    {
        label,
        description,
        error,
        indeterminate = false,
        checked,
        defaultChecked,
        onCheckedChange,
        className,
        labelClassName,
        id,
        size,
        disabled,
        "aria-describedby": ariaDescribedBy,
        ...rest
    },
    ref,
) {
    const generatedId = useId();
    const checkboxId = id ?? generatedId;
    const descriptionId = description === undefined ? undefined : `${generatedId}-description`;
    const errorId = error === undefined ? undefined : `${generatedId}-error`;
    const describedBy =
        [ariaDescribedBy, descriptionId, errorId]
            .filter((value) => value !== undefined)
            .join(" ") || undefined;
    const [state, setState] = useControllableState<CheckboxCheckedState>({
        value: indeterminate ? "indeterminate" : checked,
        defaultValue: defaultChecked ?? (indeterminate ? "indeterminate" : false),
        ...(onCheckedChange === undefined ? {} : { onChange: onCheckedChange }),
    });
    const hasText = label !== undefined || description !== undefined || error !== undefined;

    return (
        <div
            className={cn(
                "flex items-start gap-2.5",
                disabled === true ? "opacity-60" : null,
                className,
            )}
            data-slot="checkbox"
        >
            <CheckboxPrimitive.Root
                ref={ref}
                id={checkboxId}
                checked={state}
                onCheckedChange={setState}
                disabled={disabled}
                aria-describedby={describedBy}
                aria-invalid={error === undefined ? undefined : true}
                className={cn(checkboxVariants({ size }), hasText ? "mt-0.5" : null)}
                {...rest}
            >
                <CheckboxPrimitive.Indicator className="flex items-center justify-center">
                    {state === "indeterminate" ? (
                        <Minus className="size-3.5" aria-hidden="true" />
                    ) : (
                        <Check className="size-3.5" aria-hidden="true" />
                    )}
                </CheckboxPrimitive.Indicator>
            </CheckboxPrimitive.Root>
            {hasText ? (
                <div className="flex min-w-0 flex-col gap-0.5">
                    {label === undefined ? null : (
                        <Label
                            htmlFor={checkboxId}
                            className={cn("font-normal leading-5", labelClassName)}
                        >
                            {label}
                        </Label>
                    )}
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
            ) : null}
        </div>
    );
});
