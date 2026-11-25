import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { Slot } from "@radix-ui/react-slot";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn.js";
import { Spinner } from "./feedback.js";

export const buttonVariants = tv({
    base: [
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium",
        "transition-colors duration-150 select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-app",
        "disabled:pointer-events-none disabled:opacity-50",
        "aria-disabled:pointer-events-none aria-disabled:opacity-50",
    ],
    variants: {
        variant: {
            solid: "bg-primary text-primary-ink hover:bg-primary-hover",
            outline: "border border-line-strong bg-transparent text-ink hover:bg-raised",
            soft: "bg-primary-soft text-primary hover:bg-primary/15",
            ghost: "bg-transparent text-ink-muted hover:bg-raised hover:text-ink",
            link: "bg-transparent text-primary underline-offset-4 hover:underline",
        },
        size: {
            sm: "h-9 px-3 text-xs",
            md: "h-10 px-4 text-sm",
            lg: "h-11 px-5 text-sm",
            icon: "h-10 w-10 p-0",
        },
        block: {
            true: "w-full",
            false: "",
        },
    },
    defaultVariants: {
        variant: "solid",
        size: "md",
        block: false,
    },
});

export interface ButtonProps
    extends ComponentPropsWithoutRef<"button">,
        VariantProps<typeof buttonVariants> {
    readonly asChild?: boolean;
    readonly loading?: boolean;
    readonly iconLeft?: ReactNode;
    readonly iconRight?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    {
        className,
        variant,
        size,
        block,
        asChild = false,
        loading = false,
        disabled,
        iconLeft,
        iconRight,
        children,
        ...rest
    },
    ref,
) {
    const classes = cn(buttonVariants({ variant, size, block }), className);
    if (asChild) {
        return (
            <Slot ref={ref} className={classes} {...rest}>
                {children}
            </Slot>
        );
    }
    return (
        <button
            ref={ref}
            className={classes}
            disabled={disabled === true || loading}
            aria-busy={loading || undefined}
            {...rest}
        >
            {loading ? <Spinner className="size-4" /> : iconLeft}
            {children}
            {iconRight}
        </button>
    );
});
