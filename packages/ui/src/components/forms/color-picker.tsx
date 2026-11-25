import { forwardRef, useEffect, useState } from "react";
import { cn } from "../../lib/cn.js";
import { useControllableState } from "../../hooks/state.js";
import { Field } from "../field.js";
import { Input } from "../input.js";

const DEFAULT_COLOR = "#00dc82";

function normalizeHex(input: string): string | undefined {
    const raw = input.trim().replace(/^#/, "");
    if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) {
        return undefined;
    }
    const expanded =
        raw.length === 3
            ? raw
                  .split("")
                  .map((char) => char + char)
                  .join("")
            : raw;
    return `#${expanded.toLowerCase()}`;
}

export interface ColorPickerProps {
    readonly label: string;
    readonly value?: string;
    readonly defaultValue?: string;
    readonly onValueChange?: (value: string) => void;
    readonly description?: string;
    readonly error?: string;
    readonly optionalLabel?: string;
    readonly disabled?: boolean;
    readonly className?: string;
}

export const ColorPicker = forwardRef<HTMLInputElement, ColorPickerProps>(function ColorPicker(
    {
        label,
        value,
        defaultValue,
        onValueChange,
        description,
        error,
        optionalLabel,
        disabled,
        className,
    },
    ref,
) {
    const [color, setColor] = useControllableState<string>({
        value,
        defaultValue: defaultValue ?? DEFAULT_COLOR,
        ...(onValueChange === undefined ? {} : { onChange: onValueChange }),
    });
    const [text, setText] = useState(color);
    const [invalid, setInvalid] = useState(false);

    useEffect(() => {
        if (value !== undefined) {
            setText(normalizeHex(value) ?? value);
        }
    }, [value]);

    const applyText = (next: string): void => {
        setText(next);
        const normalized = normalizeHex(next);
        if (normalized === undefined) {
            setInvalid(true);
            return;
        }
        setInvalid(false);
        setColor(normalized);
    };

    const message = invalid ? "Enter a hex color such as #00dc82." : error;

    return (
        <Field
            label={label}
            {...(description === undefined ? {} : { description })}
            {...(message === undefined ? {} : { error: message })}
            {...(optionalLabel === undefined ? {} : { optionalLabel })}
            {...(className === undefined ? {} : { className })}
        >
            {(field) => (
                <div className="flex items-center gap-2" data-slot="color-picker">
                    <input
                        ref={ref}
                        type="color"
                        value={normalizeHex(color) ?? DEFAULT_COLOR}
                        disabled={disabled}
                        aria-label={`${label} color`}
                        onChange={(event) => {
                            const normalized = normalizeHex(event.target.value) ?? DEFAULT_COLOR;
                            setText(normalized);
                            setInvalid(false);
                            setColor(normalized);
                        }}
                        className={cn(
                            "h-10 w-12 shrink-0 cursor-pointer rounded-md border border-line bg-app p-1",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                            "disabled:cursor-not-allowed disabled:opacity-50",
                        )}
                    />
                    <Input
                        id={field.id}
                        type="text"
                        value={text}
                        disabled={disabled}
                        spellCheck={false}
                        autoComplete="off"
                        aria-describedby={field["aria-describedby"]}
                        aria-invalid={field["aria-invalid"]}
                        onChange={(event) => applyText(event.target.value)}
                        onBlur={() => {
                            if (normalizeHex(text) === undefined) {
                                setText(color);
                                setInvalid(false);
                            }
                        }}
                        className="font-mono"
                    />
                </div>
            )}
        </Field>
    );
});
