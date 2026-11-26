import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../../lib/cn.js";
import { Field } from "../field.js";

export const selectTriggerVariants = tv({
    base: [
        "flex w-full min-w-0 items-center justify-between gap-2 rounded-md border border-line bg-app px-3 text-left text-ink",
        "[&>span]:truncate",
        "transition-colors duration-150",
        "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-[invalid=true]:border-ink aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-ink",
        "[&_[data-placeholder]]:text-ink-subtle",
    ],
    variants: {
        size: {
            sm: "h-9 text-xs",
            md: "h-10 text-sm",
            lg: "h-11 text-sm",
        },
    },
    defaultVariants: {
        size: "md",
    },
});

export interface SelectOption {
    readonly value: string;
    readonly label: ReactNode;
    readonly disabled?: boolean;
}

export interface SelectGroup {
    readonly label: string;
    readonly options: readonly SelectOption[];
}

export interface SelectProps
    extends
        Omit<
            ComponentPropsWithoutRef<typeof SelectPrimitive.Root>,
            "value" | "defaultValue" | "onValueChange" | "className"
        >,
        VariantProps<typeof selectTriggerVariants> {
    readonly options?: readonly SelectOption[];
    readonly groups?: readonly SelectGroup[];
    readonly label: string;
    readonly placeholder?: string;
    readonly description?: string;
    readonly error?: string;
    readonly optionalLabel?: string;
    readonly value?: string;
    readonly defaultValue?: string;
    readonly onValueChange?: (value: string) => void;
    readonly className?: string;
    readonly contentClassName?: string;
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
    {
        options,
        groups,
        label,
        placeholder = "Select an option",
        description,
        error,
        optionalLabel,
        value,
        defaultValue,
        onValueChange,
        className,
        contentClassName,
        size,
        ...rest
    },
    ref,
) {
    return (
        <Field
            label={label}
            {...(description === undefined ? {} : { description })}
            {...(error === undefined ? {} : { error })}
            {...(optionalLabel === undefined ? {} : { optionalLabel })}
            {...(className === undefined ? {} : { className })}
        >
            {(field) => (
                <SelectPrimitive.Root
                    value={value}
                    defaultValue={defaultValue}
                    onValueChange={onValueChange}
                    {...rest}
                >
                    <SelectPrimitive.Trigger
                        ref={ref}
                        id={field.id}
                        aria-describedby={field["aria-describedby"]}
                        aria-invalid={field["aria-invalid"]}
                        className={selectTriggerVariants({ size })}
                        data-slot="select-trigger"
                    >
                        <SelectPrimitive.Value placeholder={placeholder} />
                        <SelectPrimitive.Icon asChild>
                            <ChevronDown
                                className="size-4 shrink-0 text-ink-muted"
                                aria-hidden="true"
                            />
                        </SelectPrimitive.Icon>
                    </SelectPrimitive.Trigger>
                    <SelectPrimitive.Portal>
                        <SelectPrimitive.Content
                            position="popper"
                            sideOffset={6}
                            className={cn(
                                "z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-line bg-panel text-ink animate-[ui-pop-in_160ms_cubic-bezier(0.16,1,0.3,1)]",
                                contentClassName,
                            )}
                        >
                            <SelectPrimitive.Viewport className="max-h-72 overflow-y-auto p-1">
                                {groups?.map((group) => (
                                    <SelectPrimitive.Group key={group.label}>
                                        <SelectPrimitive.Label className="px-2 py-1.5 text-xs text-ink-subtle">
                                            {group.label}
                                        </SelectPrimitive.Label>
                                        {group.options.map((option) => (
                                            <SelectItem key={option.value} option={option} />
                                        ))}
                                    </SelectPrimitive.Group>
                                ))}
                                {options?.map((option) => (
                                    <SelectItem key={option.value} option={option} />
                                ))}
                            </SelectPrimitive.Viewport>
                        </SelectPrimitive.Content>
                    </SelectPrimitive.Portal>
                </SelectPrimitive.Root>
            )}
        </Field>
    );
});

function SelectItem({ option }: { readonly option: SelectOption }): ReactNode {
    return (
        <SelectPrimitive.Item
            value={option.value}
            disabled={option.disabled === true}
            className={cn(
                "relative flex min-h-9 cursor-pointer select-none items-center gap-2 rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none",
                "focus:bg-raised focus:text-ink",
                "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
            )}
        >
            <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
            <SelectPrimitive.ItemIndicator className="absolute right-2 inline-flex items-center">
                <Check className="size-4 text-primary" aria-hidden="true" />
            </SelectPrimitive.ItemIndicator>
        </SelectPrimitive.Item>
    );
}
