import { forwardRef, useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../../lib/cn.js";
import { useControllableState } from "../../hooks/state.js";
import { Field } from "../field.js";

const pinVariants = tv({
    base: [
        "rounded-md border border-line bg-app text-center text-sm text-ink",
        "transition-colors duration-150",
        "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-[invalid=true]:border-ink",
    ],
    variants: {
        size: {
            sm: "h-9 w-9 text-xs",
            md: "h-10 w-10 text-sm",
            lg: "h-11 w-11 text-sm",
        },
    },
    defaultVariants: {
        size: "md",
    },
});

export interface PinInputProps extends VariantProps<typeof pinVariants> {
    readonly label: string;
    readonly length?: number;
    readonly value?: string;
    readonly defaultValue?: string;
    readonly onValueChange?: (value: string) => void;
    readonly description?: string;
    readonly error?: string;
    readonly disabled?: boolean;
    readonly autoFocus?: boolean;
    readonly className?: string;
}

export const PinInput = forwardRef<HTMLFieldSetElement, PinInputProps>(function PinInput(
    {
        label,
        length = 6,
        value,
        defaultValue,
        onValueChange,
        description,
        error,
        disabled = false,
        autoFocus = false,
        size,
        className,
    },
    ref,
) {
    const inputs = useRef<Array<HTMLInputElement | null>>([]);
    const [pin, setPin] = useControllableState<string>({
        value,
        defaultValue: defaultValue ?? "",
        ...(onValueChange === undefined ? {} : { onChange: onValueChange }),
    });
    const digits = Array.from({ length }, (_, index) => pin[index] ?? "");

    useEffect(() => {
        if (autoFocus) {
            inputs.current[0]?.focus();
        }
    }, [autoFocus]);

    const focusInput = (index: number): void => {
        const target = inputs.current[Math.min(Math.max(index, 0), length - 1)];
        target?.focus();
        target?.select();
    };

    const setAt = (index: number, nextDigest: string): void => {
        const chars = Array.from({ length }, (_, position) => pin[position] ?? "");
        chars[index] = nextDigest;
        setPin(chars.join(""));
    };

    const distribute = (start: number, raw: string): void => {
        const incoming = raw.replace(/\D/g, "");
        if (incoming.length === 0) {
            setAt(start, "");
            return;
        }
        const chars = Array.from({ length }, (_, position) => pin[position] ?? "");
        for (let offset = 0; offset < incoming.length && start + offset < length; offset += 1) {
            chars[start + offset] = incoming[offset] ?? "";
        }
        setPin(chars.join(""));
        focusInput(Math.min(start + incoming.length, length - 1));
    };

    const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>): void => {
        if (event.key === "Backspace") {
            event.preventDefault();
            if (digits[index] !== "") {
                setAt(index, "");
            } else if (index > 0) {
                setAt(index - 1, "");
                focusInput(index - 1);
            }
        } else if (event.key === "Delete") {
            event.preventDefault();
            setAt(index, "");
        } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            focusInput(index - 1);
        } else if (event.key === "ArrowRight") {
            event.preventDefault();
            focusInput(index + 1);
        } else if (event.key === "Home") {
            event.preventDefault();
            focusInput(0);
        } else if (event.key === "End") {
            event.preventDefault();
            focusInput(length - 1);
        }
    };

    const handlePaste = (index: number, event: ClipboardEvent<HTMLInputElement>): void => {
        event.preventDefault();
        distribute(index, event.clipboardData.getData("text"));
    };

    return (
        <div className={cn("flex flex-col gap-1.5", className)} data-slot="pin-input">
            <Field
                label={label}
                {...(description === undefined ? {} : { description })}
                {...(error === undefined ? {} : { error })}
            >
                {(field) => (
                    <fieldset
                        ref={ref}
                        aria-label={label}
                        aria-describedby={field["aria-describedby"]}
                        className="m-0 flex flex-wrap gap-2 border-0 p-0"
                    >
                        {digits.map((digit, index) => (
                            <input
                                key={index}
                                ref={(element) => {
                                    inputs.current[index] = element;
                                }}
                                id={index === 0 ? field.id : undefined}
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={1}
                                autoComplete={index === 0 ? "one-time-code" : "off"}
                                disabled={disabled}
                                value={digit}
                                aria-label={`Digit ${index + 1} of ${length}`}
                                aria-invalid={field["aria-invalid"]}
                                onChange={(event) => {
                                    distribute(index, event.target.value);
                                }}
                                onKeyDown={(event) => handleKeyDown(index, event)}
                                onPaste={(event) => handlePaste(index, event)}
                                onFocus={(event) => event.target.select()}
                                className={pinVariants({ size })}
                            />
                        ))}
                    </fieldset>
                )}
            </Field>
        </div>
    );
});

export type PinInputSize = VariantProps<typeof pinVariants>["size"];
