import {
    useId,
    useMemo,
    useState,
    type ComponentPropsWithoutRef,
    type KeyboardEvent,
    type ReactNode,
} from "react";
import { cn } from "../../lib/cn.js";
import { useControllableState } from "../../hooks/state.js";
import { Field } from "../field.js";
import { inputVariants, type InputProps } from "../input.js";

export interface AutocompleteOption {
    readonly value: string;
    readonly label: string;
    readonly disabled?: boolean;
}

export interface AutocompleteProps extends Omit<
    ComponentPropsWithoutRef<"input">,
    "value" | "defaultValue" | "onChange" | "size" | "role" | "aria-autocomplete"
> {
    readonly options: readonly AutocompleteOption[];
    readonly label: string;
    readonly value?: string;
    readonly defaultValue?: string;
    readonly onValueChange?: (value: string) => void;
    readonly onOptionSelect?: (option: AutocompleteOption) => void;
    readonly placeholder?: string;
    readonly emptyMessage?: string;
    readonly description?: string;
    readonly error?: string;
    readonly optionalLabel?: string;
    readonly maxSuggestions?: number;
    readonly size?: InputProps["size"];
    readonly className?: string;
    readonly listClassName?: string;
}

export function Autocomplete({
    options,
    label,
    value,
    defaultValue,
    onValueChange,
    onOptionSelect,
    placeholder,
    emptyMessage = "No results.",
    description,
    error,
    optionalLabel,
    maxSuggestions = 8,
    size,
    className,
    listClassName,
    disabled,
    onKeyDown,
    onBlur,
    ...rest
}: AutocompleteProps): ReactNode {
    const listId = useId();
    const [inputValue, setInputValue] = useControllableState<string>({
        value,
        defaultValue: defaultValue ?? "",
        ...(onValueChange === undefined ? {} : { onChange: onValueChange }),
    });
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const filtered = useMemo(() => {
        const query = inputValue.trim().toLowerCase();
        const matches = options.filter((option) => option.label.toLowerCase().includes(query));
        return matches.slice(0, Math.max(1, maxSuggestions));
    }, [inputValue, maxSuggestions, options]);
    const listVisible = open;
    const resolvedActiveIndex =
        activeIndex >= 0 && activeIndex < filtered.length ? activeIndex : -1;

    const findEnabled = (start: number, direction: 1 | -1): number => {
        for (let offset = 1; offset <= filtered.length; offset += 1) {
            const index = (start + direction * offset + filtered.length) % filtered.length;
            const option = filtered[index];
            if (option !== undefined && option.disabled !== true) {
                return index;
            }
        }
        return -1;
    };

    const firstEnabled = (): number => filtered.findIndex((option) => option.disabled !== true);
    const lastEnabled = (): number => {
        for (let index = filtered.length - 1; index >= 0; index -= 1) {
            const option = filtered[index];
            if (option !== undefined && option.disabled !== true) {
                return index;
            }
        }
        return -1;
    };

    const selectOption = (option: AutocompleteOption): void => {
        if (option.disabled === true) {
            return;
        }
        setInputValue(option.label);
        onOptionSelect?.(option);
        setOpen(false);
        setActiveIndex(-1);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
        if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((index) => findEnabled(index, 1));
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((index) => findEnabled(index <= 0 ? filtered.length : index, -1));
        } else if (event.key === "Home" && open) {
            event.preventDefault();
            setActiveIndex(firstEnabled());
        } else if (event.key === "End" && open) {
            event.preventDefault();
            setActiveIndex(lastEnabled());
        } else if (event.key === "Enter" && open) {
            const option = filtered[resolvedActiveIndex];
            if (option !== undefined) {
                event.preventDefault();
                selectOption(option);
            }
        } else if (event.key === "Escape") {
            setOpen(false);
            setActiveIndex(-1);
        } else if (event.key === "Tab") {
            setOpen(false);
        }
        onKeyDown?.(event);
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
                <div className="relative" data-slot="autocomplete">
                    <input
                        {...rest}
                        id={field.id}
                        type="text"
                        role="combobox"
                        aria-autocomplete="list"
                        aria-expanded={listVisible}
                        aria-controls={listId}
                        aria-activedescendant={
                            listVisible && resolvedActiveIndex >= 0
                                ? `${listId}-option-${resolvedActiveIndex}`
                                : undefined
                        }
                        aria-describedby={field["aria-describedby"]}
                        aria-invalid={field["aria-invalid"]}
                        autoComplete="off"
                        placeholder={placeholder}
                        disabled={disabled}
                        value={inputValue}
                        onChange={(event) => {
                            setInputValue(event.target.value);
                            setOpen(true);
                            setActiveIndex(-1);
                        }}
                        onFocus={() => setOpen(true)}
                        onKeyDown={handleKeyDown}
                        onBlur={(event) => {
                            setOpen(false);
                            setActiveIndex(-1);
                            onBlur?.(event);
                        }}
                        className={inputVariants({ size })}
                    />
                    {listVisible ? (
                        <ul
                            id={listId}
                            role="listbox"
                            aria-label={label}
                            className={cn(
                                "absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-line bg-panel p-1 text-sm",
                                listClassName,
                            )}
                        >
                            {filtered.length === 0 ? (
                                <li
                                    role="presentation"
                                    aria-live="polite"
                                    className="px-2 py-3 text-sm text-ink-muted"
                                >
                                    {emptyMessage}
                                </li>
                            ) : (
                                filtered.map((option, index) => (
                                    <li
                                        key={option.value}
                                        id={`${listId}-option-${index}`}
                                        role="option"
                                        aria-selected={index === resolvedActiveIndex}
                                        aria-disabled={option.disabled === true || undefined}
                                        onMouseDown={(event) => event.preventDefault()}
                                        onMouseEnter={() => {
                                            if (option.disabled !== true) {
                                                setActiveIndex(index);
                                            }
                                        }}
                                        onClick={() => selectOption(option)}
                                        className={cn(
                                            "cursor-pointer rounded-sm px-2 py-1.5",
                                            index === resolvedActiveIndex
                                                ? "bg-raised text-ink"
                                                : "text-ink-muted",
                                            option.disabled === true
                                                ? "cursor-not-allowed opacity-50"
                                                : null,
                                        )}
                                    >
                                        {option.label}
                                    </li>
                                ))
                            )}
                        </ul>
                    ) : null}
                </div>
            )}
        </Field>
    );
}
