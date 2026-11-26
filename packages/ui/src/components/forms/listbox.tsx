import {
    useId,
    useState,
    type ComponentPropsWithoutRef,
    type KeyboardEvent,
    type ReactNode,
} from "react";
import { Check } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { useControllableState } from "../../hooks/state.js";

export interface ListboxOption {
    readonly value: string;
    readonly label: ReactNode;
    readonly description?: string;
    readonly disabled?: boolean;
}

export interface ListboxProps extends Omit<
    ComponentPropsWithoutRef<"div">,
    "onChange" | "defaultValue" | "aria-labelledby"
> {
    readonly options: readonly ListboxOption[];
    readonly label: string;
    readonly multiple?: boolean;
    readonly value?: string[];
    readonly defaultValue?: string[];
    readonly onValueChange?: (value: string[]) => void;
    readonly description?: string;
    readonly error?: string;
    readonly emptyMessage?: string;
    readonly disabled?: boolean;
    readonly className?: string;
}

export function Listbox({
    options,
    label,
    multiple = false,
    value,
    defaultValue,
    onValueChange,
    description,
    error,
    emptyMessage = "No options available.",
    disabled = false,
    className,
    onKeyDown,
    ...rest
}: ListboxProps): ReactNode {
    const id = useId();
    const labelId = `${id}-label`;
    const descriptionId = description === undefined ? undefined : `${id}-description`;
    const errorId = error === undefined ? undefined : `${id}-error`;
    const describedBy =
        [descriptionId, errorId].filter((entry) => entry !== undefined).join(" ") || undefined;
    const [selected, setSelected] = useControllableState<string[]>({
        value,
        defaultValue: defaultValue ?? [],
        ...(onValueChange === undefined ? {} : { onChange: onValueChange }),
    });
    const [activeIndex, setActiveIndex] = useState(-1);

    const findEnabled = (start: number, direction: 1 | -1): number => {
        for (let offset = 1; offset <= options.length; offset += 1) {
            const index = (start + direction * offset + options.length) % options.length;
            const option = options[index];
            if (option !== undefined && option.disabled !== true) {
                return index;
            }
        }
        return start;
    };

    const firstEnabled = (): number => options.findIndex((option) => option.disabled !== true);
    const lastEnabled = (): number => {
        for (let index = options.length - 1; index >= 0; index -= 1) {
            const option = options[index];
            if (option !== undefined && option.disabled !== true) {
                return index;
            }
        }
        return -1;
    };

    const toggle = (option: ListboxOption): void => {
        if (option.disabled === true) {
            return;
        }
        if (!multiple) {
            setSelected(selected.includes(option.value) ? [] : [option.value]);
            return;
        }
        setSelected(
            selected.includes(option.value)
                ? selected.filter((entry) => entry !== option.value)
                : [...selected, option.value],
        );
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
        if (disabled) {
            onKeyDown?.(event);
            return;
        }
        if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((index) => findEnabled(index < 0 ? -1 : index, 1));
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) => findEnabled(index < 0 ? 0 : index, -1));
        } else if (event.key === "Home") {
            event.preventDefault();
            setActiveIndex(firstEnabled());
        } else if (event.key === "End") {
            event.preventDefault();
            setActiveIndex(lastEnabled());
        } else if (event.key === " " || event.key === "Enter") {
            const option = options[activeIndex];
            if (option !== undefined) {
                event.preventDefault();
                toggle(option);
            }
        }
        onKeyDown?.(event);
    };

    return (
        <div className={cn("flex flex-col gap-1.5", className)} data-slot="listbox">
            <span id={labelId} className="text-sm font-medium text-ink">
                {label}
            </span>
            {description === undefined ? null : (
                <p id={descriptionId} className="text-xs text-ink-muted">
                    {description}
                </p>
            )}
            <div
                role="listbox"
                tabIndex={disabled ? -1 : 0}
                aria-labelledby={labelId}
                aria-describedby={describedBy}
                aria-invalid={error === undefined ? undefined : true}
                aria-multiselectable={multiple || undefined}
                aria-disabled={disabled || undefined}
                aria-activedescendant={activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
                onKeyDown={handleKeyDown}
                className={cn(
                    "flex flex-col gap-0.5 rounded-md border border-line bg-app p-1",
                    "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30",
                    "aria-[invalid=true]:border-ink",
                    disabled ? "cursor-not-allowed opacity-50" : null,
                )}
                {...rest}
            >
                {options.length === 0 ? (
                    <div
                        role="option"
                        aria-selected={false}
                        aria-disabled="true"
                        className="px-2 py-3 text-sm text-ink-muted"
                    >
                        {emptyMessage}
                    </div>
                ) : (
                    options.map((option, index) => {
                        const isSelected = selected.includes(option.value);
                        return (
                            <div
                                key={option.value}
                                id={`${id}-option-${index}`}
                                role="option"
                                tabIndex={-1}
                                aria-selected={isSelected}
                                aria-disabled={option.disabled === true || undefined}
                                onClick={() => {
                                    if (disabled) {
                                        return;
                                    }
                                    setActiveIndex(index);
                                    toggle(option);
                                }}
                                onMouseEnter={() => {
                                    if (option.disabled !== true) {
                                        setActiveIndex(index);
                                    }
                                }}
                                className={cn(
                                    "flex cursor-pointer items-start justify-between gap-2 rounded-sm px-2 py-1.5 text-sm",
                                    isSelected ? "bg-primary-soft text-ink" : "text-ink-muted",
                                    index === activeIndex && !isSelected
                                        ? "bg-raised text-ink"
                                        : null,
                                    option.disabled === true
                                        ? "cursor-not-allowed opacity-50"
                                        : null,
                                )}
                            >
                                <span className="flex min-w-0 flex-col gap-0.5">
                                    <span>{option.label}</span>
                                    {option.description === undefined ? null : (
                                        <span className="text-xs text-ink-muted">
                                            {option.description}
                                        </span>
                                    )}
                                </span>
                                {isSelected ? (
                                    <Check
                                        className="mt-0.5 size-4 shrink-0 text-primary"
                                        aria-hidden="true"
                                    />
                                ) : null}
                            </div>
                        );
                    })
                )}
            </div>
            {error === undefined ? null : (
                <p id={errorId} className="text-xs text-ink" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}
