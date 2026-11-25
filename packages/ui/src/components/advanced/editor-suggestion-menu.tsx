import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "../../lib/cn.js";

export interface EditorSuggestion {
    readonly id: string;
    readonly label: string;
    readonly description?: string;
}

export interface EditorSuggestionMenuProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly anchor: ReactNode;
    readonly suggestions: readonly EditorSuggestion[];
    readonly onSelect: (suggestion: EditorSuggestion) => void;
    readonly label?: string;
    readonly emptyLabel?: string;
}

export function EditorSuggestionMenu({
    open,
    onOpenChange,
    anchor,
    suggestions,
    onSelect,
    label = "Suggestions",
    emptyLabel = "No suggestions",
}: EditorSuggestionMenuProps): ReactNode {
    const itemRefs = useRef(new Map<number, HTMLButtonElement>());
    const [activeIndex, setActiveIndex] = useState(0);
    const boundedIndex =
        suggestions.length === 0 ? 0 : Math.min(activeIndex, suggestions.length - 1);

    const selectAt = (index: number): void => {
        const suggestion = suggestions[index];
        if (suggestion === undefined) {
            return;
        }
        onSelect(suggestion);
        onOpenChange(false);
    };

    const focusItem = (index: number): void => {
        setActiveIndex(index);
        itemRefs.current.get(index)?.focus();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
        if (suggestions.length === 0) {
            return;
        }
        if (event.key === "ArrowDown") {
            event.preventDefault();
            focusItem((boundedIndex + 1) % suggestions.length);
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            focusItem((boundedIndex - 1 + suggestions.length) % suggestions.length);
        } else if (event.key === "Home") {
            event.preventDefault();
            focusItem(0);
        } else if (event.key === "End") {
            event.preventDefault();
            focusItem(suggestions.length - 1);
        } else if (event.key === "Escape") {
            event.preventDefault();
            onOpenChange(false);
        }
    };

    return (
        <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <PopoverPrimitive.Anchor asChild>{anchor}</PopoverPrimitive.Anchor>
            <PopoverPrimitive.Portal>
                <PopoverPrimitive.Content
                    side="bottom"
                    align="start"
                    sideOffset={4}
                    aria-label={label}
                    className="z-50 w-64 rounded-md border border-line bg-panel p-1 focus:outline-none"
                    onOpenAutoFocus={(event) => {
                        if (suggestions.length === 0) {
                            return;
                        }
                        event.preventDefault();
                        setActiveIndex(0);
                        itemRefs.current.get(0)?.focus();
                    }}
                >
                    <ul aria-label={label} className="max-h-64 overflow-y-auto">
                        {suggestions.length === 0 ? (
                            <li className="px-2 py-3 text-xs text-ink-subtle">{emptyLabel}</li>
                        ) : (
                            suggestions.map((suggestion, index) => (
                                <li key={suggestion.id}>
                                    <button
                                        type="button"
                                        ref={(element) => {
                                            if (element === null) {
                                                itemRefs.current.delete(index);
                                            } else {
                                                itemRefs.current.set(index, element);
                                            }
                                        }}
                                        tabIndex={index === boundedIndex ? 0 : -1}
                                        onClick={() => selectAt(index)}
                                        onKeyDown={handleKeyDown}
                                        className={cn(
                                            "flex w-full flex-col gap-0.5 rounded-sm px-2 py-1.5 text-left",
                                            "transition-colors hover:bg-raised focus-visible:bg-raised focus-visible:outline-none",
                                            index === boundedIndex ? "bg-raised" : "",
                                        )}
                                    >
                                        <span className="text-sm text-ink">{suggestion.label}</span>
                                        {suggestion.description === undefined ? null : (
                                            <span className="text-xs text-ink-subtle">
                                                {suggestion.description}
                                            </span>
                                        )}
                                    </button>
                                </li>
                            ))
                        )}
                    </ul>
                </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
    );
}
