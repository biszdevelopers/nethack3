import { forwardRef, type ComponentPropsWithoutRef } from "react";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../../lib/cn.js";

export const toggleVariants = tv({
    base: [
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-app",
        "disabled:pointer-events-none disabled:opacity-50",
    ],
    variants: {
        variant: {
            outline:
                "border border-line-strong bg-transparent text-ink-muted hover:bg-raised hover:text-ink data-[state=on]:bg-raised data-[state=on]:text-ink",
            solid: "bg-raised text-ink-muted hover:text-ink data-[state=on]:bg-primary data-[state=on]:text-primary-ink",
        },
        size: {
            sm: "h-9 px-3 text-xs",
            md: "h-10 px-4 text-sm",
            lg: "h-11 px-5 text-sm",
        },
    },
    defaultVariants: {
        variant: "outline",
        size: "md",
    },
});

export interface ToggleProps
    extends ComponentPropsWithoutRef<typeof TogglePrimitive.Root>,
        VariantProps<typeof toggleVariants> {}

export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(function Toggle(
    { className, variant, size, ...rest },
    ref,
) {
    return (
        <TogglePrimitive.Root
            ref={ref}
            className={cn(toggleVariants({ variant, size }), className)}
            {...rest}
        />
    );
});
