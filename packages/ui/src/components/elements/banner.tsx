import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/cn.js";

export type BannerTone = "neutral" | "success" | "critical";

const TONE_CLASS: Record<BannerTone, string> = {
    neutral: "border-line bg-raised",
    success: "border-primary/40 bg-primary-soft",
    critical: "border-ink bg-raised",
};

export interface BannerProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
    readonly tone?: BannerTone;
    readonly title?: ReactNode;
    readonly icon?: ReactNode;
    readonly action?: ReactNode;
    readonly onDismiss?: () => void;
    readonly dismissLabel?: string;
}

export function Banner({
    className,
    tone = "neutral",
    title,
    icon,
    action,
    onDismiss,
    dismissLabel = "Dismiss",
    children,
    ...rest
}: BannerProps): ReactNode {
    return (
        <div
            role={tone === "critical" ? "alert" : "status"}
            className={cn(
                "flex flex-wrap items-start gap-3 rounded-md border p-4 text-sm text-ink",
                TONE_CLASS[tone],
                className,
            )}
            {...rest}
        >
            {icon === undefined ? null : (
                <span className="mt-0.5 shrink-0" aria-hidden="true">
                    {icon}
                </span>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                {title === undefined ? null : <p className="font-medium">{title}</p>}
                {children === undefined ? null : (
                    <div className="text-ink-muted">{children}</div>
                )}
            </div>
            {action === undefined ? null : <div className="shrink-0">{action}</div>}
            {onDismiss === undefined ? null : (
                <button
                    type="button"
                    onClick={onDismiss}
                    aria-label={dismissLabel}
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-sm text-ink-muted transition-colors hover:bg-panel hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-app"
                >
                    <X className="size-4" aria-hidden="true" />
                </button>
            )}
        </div>
    );
}
