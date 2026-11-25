import { forwardRef, useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { useControllableState } from "../../hooks/state.js";
import { Button } from "../button.js";
import { Field } from "../field.js";
import { Calendar } from "./calendar.js";

export interface DatePickerProps {
    readonly label: string;
    readonly value?: Date | undefined;
    readonly defaultValue?: Date | undefined;
    readonly onValueChange?: (date: Date | undefined) => void;
    readonly placeholder?: string;
    readonly min?: Date | undefined;
    readonly max?: Date | undefined;
    readonly disabled?: boolean;
    readonly description?: string;
    readonly error?: string;
    readonly optionalLabel?: string;
    readonly className?: string;
    readonly contentClassName?: string;
}

export const DatePicker = forwardRef<HTMLButtonElement, DatePickerProps>(function DatePicker(
    {
        label,
        value,
        defaultValue,
        onValueChange,
        placeholder = "Pick a date",
        min,
        max,
        disabled = false,
        description,
        error,
        optionalLabel,
        className,
        contentClassName,
    },
    ref,
) {
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useControllableState<Date | undefined>({
        value,
        defaultValue,
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
                <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
                    <PopoverPrimitive.Trigger asChild>
                        <Button
                            ref={ref}
                            id={field.id}
                            type="button"
                            variant="outline"
                            disabled={disabled}
                            data-slot="date-picker"
                            aria-describedby={field["aria-describedby"]}
                            aria-invalid={field["aria-invalid"]}
                            iconLeft={
                                <CalendarDays
                                    className="size-4 text-ink-muted"
                                    aria-hidden="true"
                                />
                            }
                            className="w-full justify-start font-normal aria-[invalid=true]:border-ink aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-ink"
                        >
                            <span className={cn(selected === undefined ? "text-ink-subtle" : null)}>
                                {selected === undefined ? placeholder : format(selected, "PPP")}
                            </span>
                        </Button>
                    </PopoverPrimitive.Trigger>
                    <PopoverPrimitive.Portal>
                        <PopoverPrimitive.Content
                            align="start"
                            sideOffset={6}
                            className={cn(
                                "z-50 rounded-md border border-line bg-panel p-0 text-ink",
                                "focus:outline-none",
                                contentClassName,
                            )}
                        >
                            <Calendar
                                selected={selected}
                                onSelect={(date) => {
                                    setSelected(date);
                                    setOpen(false);
                                }}
                                min={min}
                                max={max}
                                defaultMonth={selected}
                            />
                        </PopoverPrimitive.Content>
                    </PopoverPrimitive.Portal>
                </PopoverPrimitive.Root>
            )}
        </Field>
    );
});
