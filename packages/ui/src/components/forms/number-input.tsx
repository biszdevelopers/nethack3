import {
    forwardRef,
    useEffect,
    useState,
    type ComponentPropsWithoutRef,
    type KeyboardEvent,
} from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { Field } from "../field.js";
import { inputVariants, type InputProps } from "../input.js";

export interface NumberInputProps extends Omit<
    ComponentPropsWithoutRef<"input">,
    "value" | "defaultValue" | "onChange" | "type" | "size" | "min" | "max" | "step"
> {
    readonly label: string;
    readonly value?: number | null;
    readonly defaultValue?: number | null;
    readonly onValueChange?: (value: number | null) => void;
    readonly min?: number;
    readonly max?: number;
    readonly step?: number;
    readonly description?: string;
    readonly error?: string;
    readonly optionalLabel?: string;
    readonly size?: InputProps["size"];
    readonly className?: string;
}

function toText(value: number | null | undefined): string {
    return value === null || value === undefined ? "" : String(value);
}

function roundToStep(value: number, step: number): number {
    const decimals = (String(step).split(".")[1] ?? "").length;
    return Number(value.toFixed(Math.min(decimals, 10)));
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
    {
        label,
        value,
        defaultValue,
        onValueChange,
        min,
        max,
        step = 1,
        description,
        error,
        optionalLabel,
        size,
        className,
        disabled,
        id: _id,
        onBlur,
        onKeyDown,
        ...rest
    },
    ref,
) {
    const [text, setText] = useState(() => toText(value === undefined ? defaultValue : value));
    const isControlled = value !== undefined;

    useEffect(() => {
        if (isControlled) {
            setText(toText(value));
        }
    }, [isControlled, value]);

    const clamp = (next: number): number => {
        let result = next;
        if (min !== undefined) {
            result = Math.max(min, result);
        }
        if (max !== undefined) {
            result = Math.min(max, result);
        }
        return result;
    };

    const parsed = text.trim() === "" ? null : Number(text);
    const current = parsed !== null && Number.isFinite(parsed) ? parsed : null;

    const apply = (next: number | null): void => {
        setText(toText(next));
        onValueChange?.(next);
    };

    const stepBy = (direction: 1 | -1): void => {
        const base = current ?? min ?? 0;
        apply(clamp(roundToStep(base + direction * step, step)));
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
        if (event.key === "ArrowUp") {
            event.preventDefault();
            stepBy(1);
        } else if (event.key === "ArrowDown") {
            event.preventDefault();
            stepBy(-1);
        }
        onKeyDown?.(event);
    };

    return (
        <Field
            label={label}
            {...(description === undefined ? {} : { description })}
            {...(error === undefined ? {} : { error })}
            {...(optionalLabel === undefined ? {} : { optionalLabel })}
            {...(className === undefined ? {} : { className })}
        >
            {(field) => (
                <div className="relative" data-slot="number-input">
                    <input
                        {...rest}
                        ref={ref}
                        id={field.id}
                        type="text"
                        inputMode="decimal"
                        role="spinbutton"
                        value={text}
                        disabled={disabled}
                        aria-describedby={field["aria-describedby"]}
                        aria-invalid={field["aria-invalid"]}
                        aria-valuenow={current ?? undefined}
                        aria-valuemin={min}
                        aria-valuemax={max}
                        onChange={(event) => {
                            const next = event.target.value;
                            setText(next);
                            if (next.trim() === "") {
                                onValueChange?.(null);
                                return;
                            }
                            const number = Number(next);
                            if (Number.isFinite(number)) {
                                onValueChange?.(number);
                            }
                        }}
                        onBlur={(event) => {
                            if (text.trim() === "") {
                                apply(null);
                            } else if (current === null) {
                                apply(null);
                            } else {
                                const next = clamp(current);
                                if (next !== current) {
                                    apply(next);
                                } else {
                                    setText(String(next));
                                }
                            }
                            onBlur?.(event);
                        }}
                        onKeyDown={handleKeyDown}
                        className={cn(inputVariants({ size }), "pr-10 tabular-nums")}
                    />
                    <div className="absolute inset-y-0 right-0 flex w-8 flex-col border-l border-line">
                        <button
                            type="button"
                            tabIndex={-1}
                            aria-label={`Increase ${label}`}
                            disabled={
                                disabled === true ||
                                (max !== undefined && (current ?? min ?? 0) >= max)
                            }
                            onClick={() => stepBy(1)}
                            className="flex h-1/2 items-center justify-center rounded-tr-md text-ink-muted transition-colors hover:bg-raised hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <ChevronUp className="size-3.5" aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            tabIndex={-1}
                            aria-label={`Decrease ${label}`}
                            disabled={
                                disabled === true || (min !== undefined && (current ?? min) <= min)
                            }
                            onClick={() => stepBy(-1)}
                            className="flex h-1/2 items-center justify-center rounded-br-md border-t border-line text-ink-muted transition-colors hover:bg-raised hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <ChevronDown className="size-3.5" aria-hidden="true" />
                        </button>
                    </div>
                </div>
            )}
        </Field>
    );
});
