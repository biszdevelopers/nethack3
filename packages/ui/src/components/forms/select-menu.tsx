import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn.js";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../dropdown-menu.js";

export interface SelectMenuOption {
    readonly value: string;
    readonly label: string;
    readonly description?: string;
    readonly disabled?: boolean;
}

export interface SelectMenuProps {
    readonly options: readonly SelectMenuOption[];
    readonly value: string | null;
    readonly onChange: (value: string) => void;
    readonly placeholder?: string;
    readonly disabled?: boolean;
    readonly className?: string;
    readonly id?: string;
    readonly "aria-label"?: string;
}

/**
 * Nuxt UI-style select menu: a dropdown trigger that shows the current option
 * and a listbox of choices. Use Select for native form submission and
 * Combobox for searchable selection.
 */
export function SelectMenu({
    options,
    value,
    onChange,
    placeholder = "Select an option",
    disabled = false,
    className,
    id,
    "aria-label": ariaLabel,
}: SelectMenuProps): ReactNode {
    const selected = options.find((option) => option.value === value) ?? null;
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    id={id}
                    type="button"
                    disabled={disabled}
                    aria-label={ariaLabel}
                    aria-haspopup="listbox"
                    className={cn(
                        "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-line bg-app px-3 text-left text-sm text-ink",
                        "transition-colors hover:border-line-strong focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25",
                        "disabled:pointer-events-none disabled:opacity-50",
                        selected === null ? "text-ink-subtle" : "text-ink",
                        className,
                    )}
                >
                    <span className="truncate">{selected?.label ?? placeholder}</span>
                    <ChevronDown className="size-4 shrink-0 text-ink-subtle" aria-hidden="true" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-(--radix-dropdown-menu-trigger-width)">
                {options.map((option) => (
                    <DropdownMenuItem
                        key={option.value}
                        disabled={option.disabled === true}
                        onSelect={() => onChange(option.value)}
                        className="flex flex-col items-start gap-0.5"
                    >
                        <span className="flex w-full items-center gap-2">
                            <span className="flex-1">{option.label}</span>
                            {option.value === value ? (
                                <Check className="size-4 text-primary" aria-hidden="true" />
                            ) : null}
                        </span>
                        {option.description === undefined ? null : (
                            <span className="text-xs text-ink-subtle">{option.description}</span>
                        )}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export interface SelectMenuTriggerProps extends ComponentPropsWithoutRef<"button"> {
    readonly children: ReactNode;
}

export const SelectMenuTrigger = forwardRef<HTMLButtonElement, SelectMenuTriggerProps>(
    function SelectMenuTrigger({ className, children, ...rest }, ref) {
        return (
            <button
                ref={ref}
                type="button"
                className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-md border border-line bg-app px-3 text-sm text-ink",
                    "transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25",
                    className,
                )}
                {...rest}
            >
                {children}
                <ChevronDown className="size-4 text-ink-subtle" aria-hidden="true" />
            </button>
        );
    },
);
