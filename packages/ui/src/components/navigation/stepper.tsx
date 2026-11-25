import { type ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "../../lib/cn.js";

export interface StepperStep {
    readonly id: string;
    readonly title: string;
    readonly description?: string;
}

export interface StepperProps {
    readonly steps: readonly StepperStep[];
    readonly current: number;
    readonly onStepChange?: (index: number) => void;
    readonly label?: string;
    readonly className?: string;
}

export function Stepper({
    steps,
    current,
    onStepChange,
    label = "Steps",
    className,
}: StepperProps): ReactNode {
    if (steps.length === 0) {
        return null;
    }
    const bounded = Math.min(Math.max(current, 0), steps.length - 1);
    return (
        <nav data-slot="stepper" aria-label={label} className={cn("w-full", className)}>
            <ol className="flex flex-col gap-1">
                {steps.map((step, index) => {
                    const isCompleted = index < bounded;
                    const isCurrent = index === bounded;
                    return (
                        <li key={step.id} className="flex items-start gap-3">
                            <button
                                type="button"
                                aria-current={isCurrent ? "step" : undefined}
                                disabled={onStepChange === undefined}
                                onClick={() => onStepChange?.(index)}
                                className={cn(
                                    "flex min-h-9 w-full items-start gap-3 rounded-sm p-1 text-left",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                    "disabled:cursor-default",
                                )}
                            >
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                                        isCompleted && "border-primary bg-primary text-primary-ink",
                                        isCurrent && "border-primary text-primary",
                                        !isCompleted && !isCurrent && "border-line text-ink-subtle",
                                    )}
                                >
                                    {isCompleted ? (
                                        <Check className="size-3.5" />
                                    ) : (
                                        String(index + 1)
                                    )}
                                </span>
                                <span className="flex min-w-0 flex-col gap-0.5">
                                    <span
                                        className={cn(
                                            "text-sm font-medium",
                                            isCurrent || isCompleted
                                                ? "text-ink"
                                                : "text-ink-muted",
                                        )}
                                    >
                                        {step.title}
                                        {isCompleted ? (
                                            <span className="sr-only"> (completed)</span>
                                        ) : null}
                                    </span>
                                    {step.description === undefined ? null : (
                                        <span className="text-xs text-ink-muted">
                                            {step.description}
                                        </span>
                                    )}
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
