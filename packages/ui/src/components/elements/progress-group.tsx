import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { Progress } from "./progress.js";

export interface ProgressGroupItem {
    readonly label: string;
    readonly value?: number | null;
    readonly max?: number;
    readonly valueText?: string;
}

export interface ProgressGroupProps {
    readonly label: string;
    readonly items: readonly ProgressGroupItem[];
    readonly summary?: ReactNode;
    readonly showValues?: boolean;
    readonly className?: string;
}

export function ProgressGroup({
    label,
    items,
    summary,
    showValues = true,
    className,
}: ProgressGroupProps): ReactNode {
    return (
        <div
            role="group"
            aria-label={label}
            className={cn("flex flex-col gap-3", className)}
        >
            {items.map((item, index) => (
                <Progress
                    key={`${index}-${item.label}`}
                    label={item.label}
                    value={item.value ?? null}
                    showValue={showValues}
                    {...(item.max === undefined ? {} : { max: item.max })}
                    {...(item.valueText === undefined ? {} : { valueText: item.valueText })}
                />
            ))}
            {summary === undefined ? null : (
                <div className="border-t border-line pt-2 text-xs text-ink-muted">{summary}</div>
            )}
        </div>
    );
}
