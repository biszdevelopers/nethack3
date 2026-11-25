import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { inputVariants } from "../input.js";
import { EmptyState } from "../empty-state.js";

export interface SearchNavigationItem {
    readonly id: string;
    readonly label: string;
    readonly href?: string;
    readonly description?: string;
}

export interface SearchNavigationProps {
    readonly items: readonly SearchNavigationItem[];
    readonly onSelect?: (item: SearchNavigationItem) => void;
    readonly placeholder?: string;
    readonly emptyMessage?: string;
    readonly label?: string;
    readonly className?: string;
}

export function SearchNavigation({
    items,
    onSelect,
    placeholder = "Search",
    emptyMessage = "No results",
    label = "Search",
    className,
}: SearchNavigationProps): ReactNode {
    const listId = useId();
    const [query, setQuery] = useState("");
    const linkRefs = useRef<Array<HTMLAnchorElement | null>>([]);

    const normalized = query.trim().toLocaleLowerCase();
    const filtered =
        normalized.length === 0
            ? items
            : items.filter((item) => {
                  if (item.label.toLocaleLowerCase().includes(normalized)) {
                      return true;
                  }
                  return item.description?.toLocaleLowerCase().includes(normalized) === true;
              });

    const focusLink = (index: number): void => {
        linkRefs.current[index]?.focus();
    };

    const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
        if (event.key === "ArrowDown") {
            event.preventDefault();
            focusLink(0);
            return;
        }
        if (event.key === "ArrowUp") {
            event.preventDefault();
            focusLink(filtered.length - 1);
            return;
        }
        if (event.key === "Enter") {
            event.preventDefault();
            const first = linkRefs.current[0];
            if (first !== undefined && first !== null) {
                first.click();
            }
        }
    };

    const onLinkKeyDown = (event: KeyboardEvent<HTMLAnchorElement>, index: number): void => {
        if (event.key === "ArrowDown") {
            event.preventDefault();
            focusLink((index + 1) % filtered.length);
            return;
        }
        if (event.key === "ArrowUp") {
            event.preventDefault();
            focusLink((index - 1 + filtered.length) % filtered.length);
            return;
        }
        if (event.key === "Home") {
            event.preventDefault();
            focusLink(0);
            return;
        }
        if (event.key === "End") {
            event.preventDefault();
            focusLink(filtered.length - 1);
        }
    };

    return (
        <div data-slot="search-navigation" className={cn("flex flex-col gap-2", className)}>
            <div className="relative flex items-center">
                <Search
                    className="pointer-events-none absolute left-3 size-4 text-ink-subtle"
                    aria-hidden="true"
                />
                <input
                    type="search"
                    aria-label={label}
                    aria-controls={filtered.length > 0 ? listId : undefined}
                    placeholder={placeholder}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={onInputKeyDown}
                    className={cn(inputVariants({ size: "sm" }), "pl-9")}
                />
            </div>
            {filtered.length === 0 ? (
                <EmptyState
                    title={emptyMessage}
                    description={
                        items.length === 0
                            ? "Nothing is available to search."
                            : `Nothing matches "${query.trim()}".`
                    }
                />
            ) : (
                <ul id={listId} className="flex flex-col gap-0.5">
                    {filtered.map((item, index) => (
                        <li key={item.id}>
                            <a
                                ref={(node) => {
                                    linkRefs.current[index] = node;
                                }}
                                href={item.href}
                                onClick={() => onSelect?.(item)}
                                onKeyDown={(event) => onLinkKeyDown(event, index)}
                                className={cn(
                                    "flex min-h-9 flex-col justify-center rounded-sm px-2 py-1.5 transition-colors",
                                    "text-ink-muted hover:bg-raised hover:text-ink focus-visible:bg-raised focus-visible:text-ink",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                )}
                            >
                                <span className="truncate text-sm">{item.label}</span>
                                {item.description === undefined ? null : (
                                    <span className="truncate text-xs text-ink-subtle">
                                        {item.description}
                                    </span>
                                )}
                            </a>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
