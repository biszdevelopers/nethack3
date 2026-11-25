import { forwardRef, useId, useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { useControllableState } from "../../hooks/state.js";
import { Button } from "../button.js";
import { Field } from "../field.js";
import { Spinner } from "../feedback.js";

export interface ComboboxOption {
    readonly value: string;
    readonly label: string;
    readonly keywords?: string[];
    readonly disabled?: boolean;
}

export interface ComboboxProps {
    readonly options: readonly ComboboxOption[];
    readonly label: string;
    readonly placeholder?: string;
    readonly searchPlaceholder?: string;
    readonly emptyMessage?: string;
    readonly description?: string;
    readonly error?: string;
    readonly optionalLabel?: string;
    readonly value?: string;
    readonly defaultValue?: string;
    readonly onValueChange?: (value: string) => void;
    readonly disabled?: boolean;
    readonly loading?: boolean;
    readonly size?: "sm" | "md" | "lg";
    readonly className?: string;
    readonly contentClassName?: string;
}

export const Combobox = forwardRef<HTMLButtonElement, ComboboxProps>(function Combobox(
    {
        options,
        label,
        placeholder = "Select an option",
        searchPlaceholder = "Search",
        emptyMessage = "No results.",
        description,
        error,
        optionalLabel,
        value,
        defaultValue,
        onValueChange,
        disabled = false,
        loading = false,
        size = "md",
        className,
        contentClassName,
    },
    ref,
) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const listId = useId();
    const [selected, setSelected] = useControllableState<string>({
        value,
        defaultValue: defaultValue ?? "",
        ...(onValueChange === undefined ? {} : { onChange: onValueChange }),
    });
    const selectedOption = options.find((option) => option.value === selected);
    const triggerLabel = selectedOption?.label ?? (selected.length > 0 ? selected : undefined);

    const handleOpenChange = (next: boolean): void => {
        setOpen(next);
        if (!next) {
            setSearch("");
        }
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
                <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
                    <PopoverPrimitive.Trigger asChild>
                        <Button
                            ref={ref}
                            id={field.id}
                            type="button"
                            variant="outline"
                            size={size}
                            role="combobox"
                            aria-haspopup="listbox"
                            aria-expanded={open}
                            aria-controls={listId}
                            aria-describedby={field["aria-describedby"]}
                            aria-invalid={field["aria-invalid"]}
                            disabled={disabled}
                            data-slot="combobox"
                            iconRight={
                                <ChevronsUpDown
                                    className="size-4 text-ink-muted"
                                    aria-hidden="true"
                                />
                            }
                            className="w-full justify-between font-normal aria-[invalid=true]:border-ink aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-ink"
                        >
                            <span
                                className={cn(
                                    "truncate",
                                    triggerLabel === undefined ? "text-ink-subtle" : null,
                                )}
                            >
                                {triggerLabel ?? placeholder}
                            </span>
                        </Button>
                    </PopoverPrimitive.Trigger>
                    <PopoverPrimitive.Portal>
                        <PopoverPrimitive.Content
                            align="start"
                            sideOffset={6}
                            className={cn(
                                "z-50 w-[var(--radix-popover-trigger-width)] min-w-48 rounded-md border border-line bg-panel text-ink",
                                "focus:outline-none",
                                contentClassName,
                            )}
                        >
                            <Command label={label} className="flex flex-col">
                                <div className="flex items-center gap-2 border-b border-line px-3">
                                    <Search className="size-4 text-ink-subtle" aria-hidden="true" />
                                    <Command.Input
                                        value={search}
                                        onValueChange={setSearch}
                                        placeholder={searchPlaceholder}
                                        className="h-10 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-subtle"
                                    />
                                </div>
                                <Command.List id={listId} className="max-h-64 overflow-y-auto p-1">
                                    {loading ? (
                                        <Command.Loading className="flex items-center gap-2 px-2 py-6 text-sm text-ink-muted">
                                            <Spinner className="size-4" label="Searching" />
                                            Searching
                                        </Command.Loading>
                                    ) : null}
                                    <Command.Empty className="px-2 py-6 text-center text-sm text-ink-muted">
                                        {emptyMessage}
                                    </Command.Empty>
                                    {options.map((option) => (
                                        <Command.Item
                                            key={option.value}
                                            value={option.value}
                                            keywords={[...(option.keywords ?? []), option.label]}
                                            disabled={option.disabled === true}
                                            onSelect={() => {
                                                setSelected(option.value);
                                                handleOpenChange(false);
                                            }}
                                            className={cn(
                                                "flex cursor-pointer items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm outline-none",
                                                "data-[selected=true]:bg-raised data-[selected=true]:text-ink",
                                                "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
                                            )}
                                        >
                                            <span className="truncate">{option.label}</span>
                                            {option.value === selected ? (
                                                <Check
                                                    className="size-4 shrink-0 text-primary"
                                                    aria-hidden="true"
                                                />
                                            ) : null}
                                        </Command.Item>
                                    ))}
                                </Command.List>
                            </Command>
                        </PopoverPrimitive.Content>
                    </PopoverPrimitive.Portal>
                </PopoverPrimitive.Root>
            )}
        </Field>
    );
});
