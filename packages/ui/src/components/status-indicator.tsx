import type { ReactNode } from "react";
import { cn } from "../lib/cn.js";

export type StatusTone = "success" | "neutral" | "attention" | "pending";

const TONE_CLASS: Record<StatusTone, string> = {
    success: "bg-primary",
    neutral: "bg-ink-subtle",
    attention: "bg-ink",
    pending: "border border-ink-subtle bg-transparent",
};

export function StatusIndicator({
    tone,
    label,
    className,
}: {
    readonly tone: StatusTone;
    readonly label: string;
    readonly className?: string;
}): ReactNode {
    return (
        <span className={cn("inline-flex items-center gap-2 text-xs text-ink-muted", className)}>
            <span className={cn("size-1.5 rounded-full", TONE_CLASS[tone])} aria-hidden="true" />
            <span>{label}</span>
        </span>
    );
}
