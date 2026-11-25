import { useId, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { useControllableState } from "../../hooks/state.js";
import { Checkbox } from "./checkbox.js";

export interface CheckboxGroupOption {
    readonly value: string;
    readonly label: ReactNode;
    readonly description?: string;
    readonly disabled?: boolean;
}

export interface CheckboxGroupProps extends Omit<
    ComponentPropsWithoutRef<"fieldset">,
    "onChange" | "value"
> {
    readonly options: readonly CheckboxGroupOption[];
    readonly label: string;
    readonly value?: string[];
    readonly defaultValue?: string[];
    readonly onValueChange?: (value: string[]) => void;
    readonly description?: string;
    readonly error?: string;
    readonly orientation?: "vertical" | "horizontal";
}

export function CheckboxGroup({
    options,
    label,
    value,
    defaultValue,
    onValueChange,
    description,
    error,
    orientation = "vertical",
    className,
    name,
    disabled,
    ...rest
}: CheckboxGroupProps): ReactNode {
    const id = useId();
    const descriptionId = description === undefined ? undefined : `${id}-description`;
    const errorId = error === undefined ? undefined : `${id}-error`;
    const describedBy =
        [descriptionId, errorId].filter((entry) => entry !== undefined).join(" ") || undefined;
    const [selected, setSelected] = useControllableState<string[]>({
        value,
        defaultValue: defaultValue ?? [],
        ...(onValueChange === undefined ? {} : { onChange: onValueChange }),
    });

    return (
        <fieldset
            aria-describedby={describedBy}
            aria-invalid={error === undefined ? undefined : true}
            className={cn("m-0 flex min-w-0 flex-col gap-2 border-0 p-0", className)}
            disabled={disabled}
            name={name}
            data-slot="checkbox-group"
            {...rest}
        >
            <legend className="mb-2 p-0 text-sm font-medium text-ink">{label}</legend>
            {description === undefined ? null : (
                <p id={descriptionId} className="-mt-1 text-xs text-ink-muted">
                    {description}
                </p>
            )}
            <div
                className={cn(
                    "flex gap-3",
                    orientation === "vertical" ? "flex-col" : "flex-row flex-wrap",
                )}
            >
                {options.map((option) => (
                    <Checkbox
                        key={option.value}
                        name={name}
                        value={option.value}
                        label={option.label}
                        description={option.description}
                        disabled={disabled === true || option.disabled === true}
                        checked={selected.includes(option.value)}
                        onCheckedChange={(checked) => {
                            setSelected(
                                checked === true
                                    ? [...selected, option.value]
                                    : selected.filter((entry) => entry !== option.value),
                            );
                        }}
                    />
                ))}
            </div>
            {error === undefined ? null : (
                <p id={errorId} className="text-xs text-ink" role="alert">
                    {error}
                </p>
            )}
        </fieldset>
    );
}
