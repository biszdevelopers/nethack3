import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn.js";

export const alertVariants = tv({
    base: "relative flex gap-3 rounded-md border p-4 text-sm",
    variants: {
        tone: {
            neutral: "border-line bg-raised text-ink",
            success: "border-primary/40 bg-primary-soft text-ink",
            warning: "border-line-strong bg-raised text-ink",
            critical: "border-ink bg-raised text-ink",
        },
    },
    defaultVariants: {
        tone: "neutral",
    },
});

export interface AlertProps
    extends ComponentPropsWithoutRef<"div">,
        VariantProps<typeof alertVariants> {
    readonly title?: string;
    readonly icon?: ReactNode;
}

export const Alert = forwardRef<HTMLDivElement, AlertProps>(function Alert(
    { className, tone, title, icon, children, ...rest },
    ref,
) {
    return (
        <div
            ref={ref}
            role={tone === "critical" ? "alert" : "status"}
            className={cn(alertVariants({ tone }), className)}
            {...rest}
        >
            {icon === undefined ? null : <div className="mt-0.5 shrink-0">{icon}</div>}
            <div className="flex min-w-0 flex-col gap-1">
                {title === undefined ? null : <p className="font-medium">{title}</p>}
                <div className="text-ink-muted">{children}</div>
            </div>
        </div>
    );
});
