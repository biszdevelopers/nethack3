import { forwardRef, type KeyboardEvent } from "react";
import { Search, X } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { useControllableState } from "../../hooks/state.js";
import { Field } from "../field.js";
import { Input, type InputProps } from "../input.js";

export interface SearchInputProps extends Omit<
    InputProps,
    "value" | "defaultValue" | "onChange" | "type" | "onSubmit"
> {
    readonly label: string;
    readonly value?: string;
    readonly defaultValue?: string;
    readonly onValueChange?: (value: string) => void;
    readonly onSubmit?: (value: string) => void;
    readonly onClear?: () => void;
    readonly description?: string;
    readonly error?: string;
    readonly optionalLabel?: string;
    readonly clearLabel?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
    {
        label,
        value,
        defaultValue,
        onValueChange,
        onSubmit,
        onClear,
        description,
        error,
        optionalLabel,
        clearLabel = "Clear search",
        className,
        disabled,
        onKeyDown,
        ...rest
    },
    ref,
) {
    const [query, setQuery] = useControllableState<string>({
        value,
        defaultValue: defaultValue ?? "",
        ...(onValueChange === undefined ? {} : { onChange: onValueChange }),
    });

    const clear = (): void => {
        setQuery("");
        onClear?.();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
        if (event.key === "Escape" && query.length > 0) {
            event.preventDefault();
            clear();
        } else if (event.key === "Enter") {
            onSubmit?.(query);
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
                <div className="relative" data-slot="search-input">
                    <Search
                        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle"
                        aria-hidden="true"
                    />
                    <Input
                        {...rest}
                        ref={ref}
                        id={field.id}
                        type="search"
                        value={query}
                        disabled={disabled}
                        aria-describedby={field["aria-describedby"]}
                        aria-invalid={field["aria-invalid"]}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={handleKeyDown}
                        className={cn(
                            "pl-9",
                            query.length > 0 ? "pr-9" : null,
                            "[&::-webkit-search-cancel-button]:appearance-none",
                        )}
                    />
                    {query.length > 0 ? (
                        <button
                            type="button"
                            aria-label={clearLabel}
                            onClick={clear}
                            disabled={disabled === true}
                            className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-ink-muted transition-colors hover:bg-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                        >
                            <X className="size-3.5" aria-hidden="true" />
                        </button>
                    ) : null}
                </div>
            )}
        </Field>
    );
});
