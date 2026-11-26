import type { ReactNode } from "react";
import { useController, useFormContext, type FieldPath, type FieldValues } from "react-hook-form";
import { Switch } from "@nethack/ui";

export interface FormSwitchProps<TFieldValues extends FieldValues> {
    readonly name: FieldPath<TFieldValues>;
    readonly label: string;
    readonly description?: string;
}

export function FormSwitch<TFieldValues extends FieldValues>({
    name,
    label,
    description,
}: FormSwitchProps<TFieldValues>): ReactNode {
    const { control } = useFormContext<TFieldValues>();
    const { field, fieldState } = useController({ control, name });
    return (
        <Switch
            checked={field.value === true}
            onCheckedChange={(checked) => field.onChange(checked)}
            label={label}
            {...(description === undefined ? {} : { description })}
            {...(fieldState.error?.message === undefined
                ? {}
                : { error: fieldState.error.message })}
        />
    );
}
