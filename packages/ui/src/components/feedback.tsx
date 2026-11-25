import type { ReactNode } from "react";
import { cn } from "../lib/cn.js";

export interface SpinnerProps {
    readonly className?: string;
    readonly label?: string;
}

export function Spinner({ className, label = "Loading" }: SpinnerProps): ReactNode {
    return (
        <span className="inline-flex items-center gap-2" role="status" aria-live="polite">
            <span
                className={cn(
                    "inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent",
                    className,
                )}
                aria-hidden="true"
            />
            <span className="sr-only">{label}</span>
        </span>
    );
}

export function Skeleton({ className }: { readonly className?: string }): ReactNode {
    return <div className={cn("animate-pulse rounded-md bg-raised", className)} aria-hidden="true" />;
}

export function LoadingBlock({
    rows = 3,
    label = "Loading content",
}: {
    readonly rows?: number;
    readonly label?: string;
}): ReactNode {
    return (
        <div className="flex flex-col gap-3" role="status" aria-live="polite">
            <span className="sr-only">{label}</span>
            {Array.from({ length: rows }, (_, index) => (
                <Skeleton
                    key={index}
                    className={index === 0 ? "h-6 w-1/3" : "h-4 w-full"}
                />
            ))}
        </div>
    );
}
