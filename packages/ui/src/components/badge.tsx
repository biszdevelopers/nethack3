import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn.js";

export const badgeVariants = tv({
    base: "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-xs font-medium leading-5",
    variants: {
        tone: {
            neutral: "border-line bg-raised text-ink-muted",
            primary: "border-primary/40 bg-primary-soft text-primary",
            outline: "border-line-strong bg-transparent text-ink",
            critical: "border-ink bg-ink text-app",
        },
        size: {
            sm: "px-1.5 py-0 text-[11px]",
            md: "px-2 py-0.5 text-xs",
        },
    },
    defaultVariants: {
        tone: "neutral",
        size: "md",
    },
});

export interface BadgeProps
    extends ComponentPropsWithoutRef<"span">,
        VariantProps<typeof badgeVariants> {
    readonly dot?: boolean;
    readonly icon?: ReactNode;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
    { className, tone, size, dot = false, icon, children, ...rest },
    ref,
) {
    return (
        <span ref={ref} className={cn(badgeVariants({ tone, size }), className)} {...rest}>
            {dot ? (
                <span
                    aria-hidden="true"
                    className={cn(
                        "size-1.5 rounded-full",
                        tone === "primary" ? "bg-primary" : "bg-current",
                    )}
                />
            ) : null}
            {icon}
            {children}
        </span>
    );
});
