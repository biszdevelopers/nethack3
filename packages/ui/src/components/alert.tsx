import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn.js";

export const alertVariants = tv({
    base: "relative flex gap-3 rounded-lg border p-4 text-sm backdrop-blur-sm",
    variants: {
        variant: {
            solid: "",
            soft: "",
            subtle: "bg-transparent",
            outline: "bg-transparent",
        },
        tone: {
            neutral: "",
            success: "",
            warning: "",
            critical: "",
        },
    },
    compoundVariants: [
        {
            variant: "soft",
            tone: "neutral",
            class: "border-line bg-raised/60 text-ink",
        },
        {
            variant: "soft",
            tone: "success",
            class: "border-primary/30 bg-primary/10 text-ink",
        },
        {
            variant: "soft",
            tone: "warning",
            class: "border-line-strong bg-raised/80 text-ink",
        },
        {
            variant: "soft",
            tone: "critical",
            class: "border-ink/40 bg-ink/[0.06] text-ink",
        },
        {
            variant: "solid",
            tone: "success",
            class: "border-primary bg-primary text-primary-ink",
        },
        {
            variant: "solid",
            tone: "critical",
            class: "border-ink bg-ink text-app",
        },
        {
            variant: "solid",
            tone: "neutral",
            class: "border-line-strong bg-raised text-ink",
        },
        {
            variant: "solid",
            tone: "warning",
            class: "border-line-strong bg-raised text-ink",
        },
        {
            variant: "subtle",
            tone: "success",
            class: "border-transparent text-primary",
        },
        {
            variant: "subtle",
            tone: "neutral",
            class: "border-transparent text-ink-muted",
        },
        {
            variant: "subtle",
            tone: "warning",
            class: "border-transparent text-ink",
        },
        {
            variant: "subtle",
            tone: "critical",
            class: "border-transparent text-ink",
        },
        {
            variant: "outline",
            tone: "success",
            class: "border-primary/40 text-primary",
        },
        {
            variant: "outline",
            tone: "neutral",
            class: "border-line text-ink",
        },
        {
            variant: "outline",
            tone: "warning",
            class: "border-line-strong text-ink",
        },
        {
            variant: "outline",
            tone: "critical",
            class: "border-ink/60 text-ink",
        },
    ],
    defaultVariants: {
        variant: "soft",
        tone: "neutral",
    },
});

export interface AlertProps
    extends ComponentPropsWithoutRef<"div">, VariantProps<typeof alertVariants> {
    readonly title?: string;
    readonly icon?: ReactNode;
}

export const Alert = forwardRef<HTMLDivElement, AlertProps>(function Alert(
    { className, variant, tone, title, icon, children, ...rest },
    ref,
) {
    return (
        <div
            ref={ref}
            role={tone === "critical" ? "alert" : "status"}
            className={cn(alertVariants({ variant, tone }), className)}
            {...rest}
        >
            {icon === undefined ? null : (
                <div className="mt-0.5 shrink-0" aria-hidden="true">
                    {icon}
                </div>
            )}
            <div className="flex min-w-0 flex-col gap-1">
                {title === undefined ? null : <p className="font-medium">{title}</p>}
                <div className="text-current opacity-80">{children}</div>
            </div>
        </div>
    );
});
