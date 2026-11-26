import type { ReactNode } from "react";
import { useController, useFormContext, type FieldPath, type FieldValues } from "react-hook-form";
import { Select, type SelectOption } from "@nethack/ui";

export interface FormSelectProps<TFieldValues extends FieldValues> {
    readonly name: FieldPath<TFieldValues>;
    readonly label: string;
    readonly options: readonly SelectOption[];
    readonly placeholder?: string;
    readonly description?: string;
    readonly optionalLabel?: string;
}

export function FormSelect<TFieldValues extends FieldValues>({
    name,
    label,
    options,
    placeholder,
    description,
    optionalLabel,
}: FormSelectProps<TFieldValues>): ReactNode {
    const { control } = useFormContext<TFieldValues>();
    const { field, fieldState } = useController({ control, name });
    const value = typeof field.value === "string" ? field.value : "";
    return (
        <Select
            label={label}
            options={options}
            value={value}
            onValueChange={(next) => field.onChange(next)}
            {...(placeholder === undefined ? {} : { placeholder })}
            {...(description === undefined ? {} : { description })}
            {...(optionalLabel === undefined ? {} : { optionalLabel })}
            {...(fieldState.error?.message === undefined
                ? {}
                : { error: fieldState.error.message })}
        />
    );
}
