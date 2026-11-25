import { forwardRef, useId, type ComponentPropsWithoutRef, type ReactNode } from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../../lib/cn.js";
import { Label } from "../label.js";

export const switchVariants = tv({
    base: [
        "peer inline-flex shrink-0 cursor-pointer items-center rounded-full border border-line-strong bg-raised",
        "transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-app",
        "data-[state=checked]:border-primary data-[state=checked]:bg-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
    ],
    variants: {
        size: {
            sm: "h-4 w-8 p-0.5",
            md: "h-5 w-9 p-0.5",
            lg: "h-6 w-11 p-0.5",
        },
    },
    defaultVariants: {
        size: "md",
    },
});

const thumbVariants = tv({
    base: "block rounded-full bg-ink transition-transform duration-150 data-[state=checked]:bg-primary-ink",
    variants: {
        size: {
            sm: "size-3 data-[state=checked]:translate-x-4",
            md: "size-4 data-[state=checked]:translate-x-4",
            lg: "size-5 data-[state=checked]:translate-x-5",
        },
    },
    defaultVariants: {
        size: "md",
    },
});

export interface SwitchProps
    extends
        Omit<ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>, "className">,
        VariantProps<typeof switchVariants> {
    readonly label?: ReactNode;
    readonly description?: string;
    readonly error?: string;
    readonly className?: string;
    readonly labelClassName?: string;
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
    {
        label,
        description,
        error,
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
    const switchId = id ?? generatedId;
    const descriptionId = description === undefined ? undefined : `${generatedId}-description`;
    const errorId = error === undefined ? undefined : `${generatedId}-error`;
    const describedBy =
        [ariaDescribedBy, descriptionId, errorId]
            .filter((value) => value !== undefined)
            .join(" ") || undefined;
    const hasText = label !== undefined || description !== undefined || error !== undefined;

    return (
        <div
            className={cn(
                "flex items-start gap-2.5",
                disabled === true ? "opacity-60" : null,
                className,
            )}
            data-slot="switch"
        >
            <SwitchPrimitive.Root
                ref={ref}
                id={switchId}
                disabled={disabled}
                aria-describedby={describedBy}
                aria-invalid={error === undefined ? undefined : true}
                className={cn(switchVariants({ size }), hasText ? "mt-0.5" : null)}
                {...rest}
            >
                <SwitchPrimitive.Thumb className={thumbVariants({ size })} />
            </SwitchPrimitive.Root>
            {hasText ? (
                <div className="flex min-w-0 flex-col gap-0.5">
                    {label === undefined ? null : (
                        <Label
                            htmlFor={switchId}
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
