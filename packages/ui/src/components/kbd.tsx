import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "../lib/cn.js";

export function Kbd({ className, children, ...rest }: ComponentPropsWithoutRef<"kbd">): ReactNode {
    return (
        <kbd
            className={cn(
                "inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-line-strong bg-raised px-1.5 font-mono text-[11px] text-ink-muted",
                className,
            )}
            {...rest}
        >
            {children}
        </kbd>
    );
}
