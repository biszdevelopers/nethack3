import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn.js";

export const badgeVariants = tv({
    base: "inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border font-medium leading-5",
    variants: {
        variant: {
            solid: "border-transparent",
            soft: "border-transparent",
            subtle: "border-transparent",
            outline: "bg-transparent",
        },
        color: {
            primary: "",
            neutral: "",
            critical: "",
        },
        size: {
            xs: "px-1.5 py-0 text-[10px]",
            sm: "px-1.5 py-0 text-[11px]",
            md: "px-2 py-0.5 text-xs",
        },
    },
    compoundVariants: [
        { variant: "solid", color: "primary", class: "bg-primary text-primary-ink" },
        { variant: "solid", color: "neutral", class: "bg-ink text-app" },
        { variant: "solid", color: "critical", class: "bg-ink text-app" },
        {
            variant: "soft",
            color: "primary",
            class: "bg-primary/10 text-primary",
        },
        { variant: "soft", color: "neutral", class: "bg-raised text-ink-muted" },
        { variant: "soft", color: "critical", class: "bg-ink/10 text-ink" },
        {
            variant: "subtle",
            color: "primary",
            class: "bg-transparent text-primary",
        },
        { variant: "subtle", color: "neutral", class: "bg-transparent text-ink-muted" },
        { variant: "subtle", color: "critical", class: "bg-transparent text-ink" },
        {
            variant: "outline",
            color: "primary",
            class: "border-primary/40 text-primary",
        },
        { variant: "outline", color: "neutral", class: "border-line-strong text-ink" },
        { variant: "outline", color: "critical", class: "border-ink/60 text-ink" },
    ],
    defaultVariants: {
        variant: "soft",
        color: "neutral",
        size: "md",
    },
});

export interface BadgeProps
    extends
        ComponentPropsWithoutRef<"span">,
        Omit<VariantProps<typeof badgeVariants>, "color" | "variant" | "size"> {
    readonly variant?: "solid" | "soft" | "subtle" | "outline";
    readonly color?: "primary" | "neutral" | "critical";
    readonly size?: "xs" | "sm" | "md";
    readonly tone?: "neutral" | "primary" | "outline" | "critical";
    readonly dot?: boolean;
    readonly icon?: ReactNode;
}

function legacyTone(tone: BadgeProps["tone"]): {
    variant: "solid" | "soft" | "subtle" | "outline";
    color: "primary" | "neutral" | "critical";
} {
    switch (tone) {
        case "primary":
            return { variant: "soft", color: "primary" };
        case "outline":
            return { variant: "outline", color: "neutral" };
        case "critical":
            return { variant: "solid", color: "critical" };
        case "neutral":
        default:
            return { variant: "subtle", color: "neutral" };
    }
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
    { className, variant, color, size = "md", tone, dot = false, icon, children, ...rest },
    ref,
) {
    const resolved = tone === undefined ? null : legacyTone(tone);
    const finalVariant = variant ?? resolved?.variant ?? "soft";
    const finalColor = color ?? resolved?.color ?? "neutral";
    return (
        <span
            ref={ref}
            className={cn(
                badgeVariants({ variant: finalVariant, color: finalColor, size }),
                className,
            )}
            {...rest}
        >
            {dot ? (
                <span
                    aria-hidden="true"
                    className={cn(
                        "size-1.5 rounded-full",
                        finalColor === "primary" ? "bg-primary" : "bg-current",
                    )}
                />
            ) : null}
            {icon}
            {children}
        </span>
    );
});
