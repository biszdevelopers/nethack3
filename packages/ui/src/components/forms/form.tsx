import type { ComponentPropsWithoutRef, ReactNode } from "react";
import {
    Controller,
    FormProvider,
    useFormContext,
    type ControllerRenderProps,
    type FieldPath,
    type FieldValues,
    type UseFormReturn,
} from "react-hook-form";
import { Field } from "../field.js";

export interface FormProps<
    TFieldValues extends FieldValues = FieldValues,
> extends ComponentPropsWithoutRef<"form"> {
    readonly form: UseFormReturn<TFieldValues>;
}

export function Form<TFieldValues extends FieldValues>({
    form,
    children,
    ...rest
}: FormProps<TFieldValues>): ReactNode {
    return (
        <FormProvider {...form}>
            <form data-slot="form" {...rest}>
                {children}
            </form>
        </FormProvider>
    );
}

export type FormFieldRenderProps<
    TFieldValues extends FieldValues,
    TName extends FieldPath<TFieldValues>,
> = ControllerRenderProps<TFieldValues, TName> & {
    readonly id: string;
    readonly "aria-describedby": string | undefined;
    readonly "aria-invalid": boolean | undefined;
};

export interface FormFieldProps<
    TFieldValues extends FieldValues,
    TName extends FieldPath<TFieldValues>,
> {
    readonly name: TName;
    readonly label: string;
    readonly description?: string;
    readonly required?: boolean;
    readonly optionalLabel?: string;
    readonly className?: string;
    readonly children: (props: FormFieldRenderProps<TFieldValues, TName>) => ReactNode;
}

export function FormField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
    name,
    label,
    description,
    required,
    optionalLabel,
    className,
    children,
}: FormFieldProps<TFieldValues, TName>): ReactNode {
    const { control } = useFormContext<TFieldValues>();

    return (
        <Controller
            control={control}
            name={name}
            render={({ field, fieldState }) => {
                const message = fieldState.error?.message;
                return (
                    <Field
                        label={label}
                        {...(description === undefined ? {} : { description })}
                        {...(message === undefined ? {} : { error: message })}
                        {...(required === undefined ? {} : { required })}
                        {...(optionalLabel === undefined ? {} : { optionalLabel })}
                        {...(className === undefined ? {} : { className })}
                    >
                        {(accessibility) => children({ ...field, ...accessibility })}
                    </Field>
                );
            }}
        />
    );
}
