import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { Slot } from "@radix-ui/react-slot";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn.js";
import { Spinner } from "./feedback.js";

export const buttonVariants = tv({
    base: [
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium",
        "transition-[color,background-color,border-color,box-shadow,transform] duration-200 select-none",
        "active:scale-[0.985]",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25",
        "disabled:pointer-events-none disabled:opacity-60",
        "aria-disabled:pointer-events-none aria-disabled:opacity-60",
    ],
    variants: {
        variant: {
            solid: "",
            outline: "border",
            soft: "",
            subtle: "",
            ghost: "bg-transparent",
            link: "h-auto bg-transparent p-0 underline-offset-4 hover:underline",
        },
        color: {
            primary: "",
            neutral: "",
            critical: "",
        },
        size: {
            xs: "h-8 px-2.5 text-xs",
            sm: "h-9 px-3 text-xs",
            md: "h-10 px-4 text-sm",
            lg: "h-11 px-5 text-sm",
            xl: "h-12 px-6 text-base",
            icon: "size-10 p-0",
        },
        block: {
            true: "w-full",
            false: "",
        },
    },
    compoundVariants: [
        {
            variant: "solid",
            color: "primary",
            class: "bg-primary text-primary-ink hover:bg-primary-hover",
        },
        {
            variant: "solid",
            color: "neutral",
            class: "bg-ink text-app hover:bg-ink/90",
        },
        {
            variant: "solid",
            color: "critical",
            class: "bg-ink text-app hover:bg-ink/85",
        },
        {
            variant: "outline",
            color: "primary",
            class: "border-primary/35 bg-transparent text-primary hover:bg-primary/10",
        },
        {
            variant: "outline",
            color: "neutral",
            class: "border-line-strong bg-transparent text-ink hover:bg-raised",
        },
        {
            variant: "outline",
            color: "critical",
            class: "border-ink/60 bg-transparent text-ink hover:bg-raised",
        },
        {
            variant: "soft",
            color: "primary",
            class: "bg-primary/10 text-primary hover:bg-primary/15",
        },
        {
            variant: "soft",
            color: "neutral",
            class: "bg-raised text-ink hover:bg-raised/80",
        },
        {
            variant: "soft",
            color: "critical",
            class: "bg-ink/10 text-ink hover:bg-ink/15",
        },
        {
            variant: "subtle",
            color: "primary",
            class: "bg-transparent text-primary hover:bg-primary/10",
        },
        {
            variant: "subtle",
            color: "neutral",
            class: "bg-transparent text-ink-muted hover:bg-raised hover:text-ink",
        },
        {
            variant: "subtle",
            color: "critical",
            class: "bg-transparent text-ink hover:bg-raised",
        },
        {
            variant: "ghost",
            color: "primary",
            class: "text-primary hover:bg-primary/10",
        },
        {
            variant: "ghost",
            color: "neutral",
            class: "text-ink-muted hover:bg-raised hover:text-ink",
        },
        {
            variant: "ghost",
            color: "critical",
            class: "text-ink hover:bg-raised",
        },
        {
            variant: "link",
            color: "primary",
            class: "text-primary hover:text-primary-hover",
        },
        {
            variant: "link",
            color: "neutral",
            class: "text-ink-muted hover:text-ink",
        },
        {
            variant: "link",
            color: "critical",
            class: "text-ink hover:text-ink-muted",
        },
    ],
    defaultVariants: {
        variant: "solid",
        color: "primary",
        size: "md",
        block: false,
    },
});

export interface ButtonProps
    extends
        ComponentPropsWithoutRef<"button">,
        Omit<VariantProps<typeof buttonVariants>, "color" | "variant" | "size"> {
    readonly asChild?: boolean;
    readonly loading?: boolean;
    readonly iconLeft?: ReactNode;
    readonly iconRight?: ReactNode;
    readonly variant?: "solid" | "outline" | "soft" | "subtle" | "ghost" | "link";
    readonly color?: "primary" | "neutral" | "critical";
    readonly size?: "xs" | "sm" | "md" | "lg" | "xl" | "icon";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    {
        className,
        variant = "solid",
        color = "primary",
        size = "md",
        block = false,
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
    const classes = cn(buttonVariants({ variant, color, size, block }), className);
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
