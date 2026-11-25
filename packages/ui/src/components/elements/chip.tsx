import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/cn.js";

export interface ChipProps extends ComponentPropsWithoutRef<"span"> {
    readonly icon?: ReactNode;
    readonly onRemove?: () => void;
    readonly removeLabel?: string;
}

export function Chip({
    className,
    icon,
    onRemove,
    removeLabel = "Remove",
    children,
    ...rest
}: ChipProps): ReactNode {
    return (
        <span
            className={cn(
                "inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-sm border border-line bg-raised px-2 text-xs text-ink",
                className,
            )}
            {...rest}
        >
            {icon === undefined ? null : (
                <span className="shrink-0 text-ink-muted" aria-hidden="true">
                    {icon}
                </span>
            )}
            <span className="truncate">{children}</span>
            {onRemove === undefined ? null : (
                <button
                    type="button"
                    onClick={onRemove}
                    aria-label={removeLabel}
                    className="relative -mr-1 inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-ink-muted transition-colors after:absolute after:-inset-1.5 after:content-[''] hover:bg-panel hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                    <X className="size-3" aria-hidden="true" />
                </button>
            )}
        </span>
    );
}
