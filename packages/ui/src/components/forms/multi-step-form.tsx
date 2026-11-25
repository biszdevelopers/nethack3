import { useId, useState, type FormEvent, type ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { Button } from "../button.js";

export interface MultiStepFormStep {
    readonly id: string;
    readonly title: string;
    readonly description?: string;
    readonly content: ReactNode;
    readonly validate?: () => boolean | string | undefined;
}

export interface MultiStepFormProps {
    readonly steps: readonly MultiStepFormStep[];
    readonly defaultStep?: number;
    readonly step?: number;
    readonly onStepChange?: (index: number) => void;
    readonly onComplete?: () => void;
    readonly backLabel?: string;
    readonly nextLabel?: string;
    readonly completeLabel?: string;
    readonly className?: string;
}

export function MultiStepForm({
    steps,
    defaultStep = 0,
    step,
    onStepChange,
    onComplete,
    backLabel = "Back",
    nextLabel = "Next",
    completeLabel = "Complete",
    className,
}: MultiStepFormProps): ReactNode {
    const id = useId();
    const [internalStep, setInternalStep] = useState(defaultStep);
    const [error, setError] = useState<string | undefined>(undefined);
    const isControlled = step !== undefined;
    const rawStep = isControlled ? step : internalStep;
    const current = Math.min(Math.max(rawStep, 0), Math.max(steps.length - 1, 0));
    const active = steps[current];

    if (active === undefined) {
        return (
            <div className={cn("text-sm text-ink-muted", className)} data-slot="multi-step-form">
                No steps configured.
            </div>
        );
    }

    const goTo = (next: number): void => {
        if (!isControlled) {
            setInternalStep(next);
        }
        onStepChange?.(next);
        setError(undefined);
    };

    const validateCurrent = (): boolean => {
        const result = active.validate?.();
        if (result === false) {
            setError("Complete this step before continuing.");
            return false;
        }
        if (typeof result === "string") {
            setError(result);
            return false;
        }
        setError(undefined);
        return true;
    };

    const isLast = current === steps.length - 1;

    const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
        event.preventDefault();
        if (!validateCurrent()) {
            return;
        }
        if (isLast) {
            onComplete?.();
            return;
        }
        goTo(current + 1);
    };

    return (
        <form
            className={cn("flex flex-col gap-6", className)}
            onSubmit={handleSubmit}
            data-slot="multi-step-form"
        >
            <div className="flex flex-col gap-3">
                <ol className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Form steps">
                    {steps.map((entry, index) => {
                        const state =
                            index < current
                                ? "complete"
                                : index === current
                                  ? "current"
                                  : "upcoming";
                        return (
                            <li
                                key={entry.id}
                                aria-current={index === current ? "step" : undefined}
                                className={cn(
                                    "flex items-center gap-2 text-xs",
                                    state === "current" ? "text-ink" : "text-ink-subtle",
                                )}
                            >
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        "flex size-5 items-center justify-center rounded-full border text-[11px]",
                                        state === "current"
                                            ? "border-primary bg-primary text-primary-ink"
                                            : "border-line",
                                    )}
                                >
                                    {index + 1}
                                </span>
                                <span>{entry.title}</span>
                            </li>
                        );
                    })}
                </ol>
                <progress
                    max={steps.length}
                    value={current + 1}
                    aria-label={`Step ${current + 1} of ${steps.length}`}
                    className="h-1 w-full appearance-none overflow-hidden rounded-full [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-raised [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary"
                />
            </div>
            <div className="flex flex-col gap-1">
                <h2 className="text-base font-semibold text-ink">{active.title}</h2>
                {active.description === undefined ? null : (
                    <p className="text-sm text-ink-muted">{active.description}</p>
                )}
            </div>
            <div>{active.content}</div>
            {error === undefined ? null : (
                <p id={`${id}-error`} className="text-sm text-ink" role="alert">
                    {error}
                </p>
            )}
            <div className="flex items-center justify-between gap-2">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={() => goTo(current - 1)}
                    disabled={current === 0}
                >
                    {backLabel}
                </Button>
                <Button type="submit">{isLast ? completeLabel : nextLabel}</Button>
            </div>
        </form>
    );
}
