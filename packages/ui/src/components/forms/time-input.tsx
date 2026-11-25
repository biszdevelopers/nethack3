import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { useControllableState } from "../../hooks/state.js";
import { Field } from "../field.js";
import { Input, type InputProps } from "../input.js";

export interface TimeInputProps extends Omit<
    ComponentPropsWithoutRef<"input">,
    "value" | "defaultValue" | "onChange" | "type" | "min" | "max" | "size"
> {
    readonly label: string;
    readonly value?: string;
    readonly defaultValue?: string;
    readonly onValueChange?: (value: string) => void;
    readonly min?: string;
    readonly max?: string;
    readonly description?: string;
    readonly error?: string;
    readonly optionalLabel?: string;
    readonly size?: InputProps["size"];
    readonly className?: string;
}

export const TimeInput = forwardRef<HTMLInputElement, TimeInputProps>(function TimeInput(
    {
        label,
        value,
        defaultValue,
        onValueChange,
        min,
        max,
        description,
        error,
        optionalLabel,
        size,
        className,
        onKeyDown,
        ...rest
    },
    ref,
) {
    const [time, setTime] = useControllableState<string>({
        value,
        defaultValue: defaultValue ?? "",
        ...(onValueChange === undefined ? {} : { onChange: onValueChange }),
    });

    return (
        <Field
            label={label}
            {...(description === undefined ? {} : { description })}
            {...(error === undefined ? {} : { error })}
            {...(optionalLabel === undefined ? {} : { optionalLabel })}
            {...(className === undefined ? {} : { className })}
        >
            {(field) => (
                <Input
                    {...rest}
                    ref={ref}
                    id={field.id}
                    type="time"
                    value={time}
                    min={min}
                    max={max}
                    data-slot="time-input"
                    aria-describedby={field["aria-describedby"]}
                    aria-invalid={field["aria-invalid"]}
                    onChange={(event) => setTime(event.target.value)}
                    onKeyDown={onKeyDown}
                    size={size}
                />
            )}
        </Field>
    );
});
