import { useId, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { Button } from "../button.js";
import { Input } from "../input.js";
import { Label } from "../label.js";

export interface SearchSelectOption {
    readonly value: string;
    readonly label: string;
}

export interface SearchSelectFilter {
    readonly id: string;
    readonly label: string;
    readonly type: "select";
    readonly options: readonly SearchSelectOption[];
}

export interface SearchToggleFilter {
    readonly id: string;
    readonly label: string;
    readonly type: "toggle";
}

export type SearchFilter = SearchSelectFilter | SearchToggleFilter;

export interface AdvancedSearchValue {
    readonly query: string;
    readonly filters: Readonly<Record<string, string | boolean | undefined>>;
}

export interface AdvancedSearchProps {
    readonly value: AdvancedSearchValue;
    readonly onChange: (value: AdvancedSearchValue) => void;
    readonly filters: readonly SearchFilter[];
    readonly label?: string;
    readonly placeholder?: string;
    readonly className?: string;
}

export function AdvancedSearch({
    value,
    onChange,
    filters,
    label = "Search",
    placeholder = "Search",
    className,
}: AdvancedSearchProps): ReactNode {
    const inputId = useId();

    const setFilter = (id: string, next: string | boolean | undefined): void => {
        const updated = { ...value.filters };
        if (next === undefined || next === "" || next === false) {
            delete updated[id];
        } else {
            updated[id] = next;
        }
        onChange({ query: value.query, filters: updated });
    };

    const clearAll = (): void => {
        onChange({ query: "", filters: {} });
    };

    const chips: Array<{ key: string; label: string; remove: () => void }> = [];
    for (const filter of filters) {
        const current = value.filters[filter.id];
        if (filter.type === "toggle" && current === true) {
            chips.push({
                key: filter.id,
                label: filter.label,
                remove: () => setFilter(filter.id, false),
            });
        } else if (filter.type === "select" && typeof current === "string" && current.length > 0) {
            const option = filter.options.find((candidate) => candidate.value === current);
            chips.push({
                key: filter.id,
                label: `${filter.label}: ${option?.label ?? current}`,
                remove: () => setFilter(filter.id, undefined),
            });
        }
    }

    const renderFilter = (filter: SearchFilter): ReactNode => {
        if (filter.type === "toggle") {
            const active = value.filters[filter.id] === true;
            return (
                <Button
                    key={filter.id}
                    type="button"
                    variant={active ? "soft" : "outline"}
                    size="sm"
                    aria-pressed={active}
                    onClick={() => setFilter(filter.id, !active)}
                >
                    {filter.label}
                </Button>
            );
        }
        const current = value.filters[filter.id];
        const selected = typeof current === "string" ? current : "";
        return (
            <label key={filter.id} className="flex min-w-40 flex-col gap-1 text-xs text-ink-muted">
                <span>{filter.label}</span>
                <select
                    value={selected}
                    onChange={(event) => setFilter(filter.id, event.currentTarget.value)}
                    className="h-9 rounded-md border border-line bg-app px-2 text-sm text-ink focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                    <option value="">Any</option>
                    {filter.options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </label>
        );
    };

    return (
        <section
            aria-label={label}
            data-slot="advanced-search"
            className={cn("flex flex-col gap-2", className)}
        >
            <div className="flex flex-col gap-1">
                <Label htmlFor={inputId}>{label}</Label>
                <div className="relative">
                    <Search
                        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle"
                        aria-hidden="true"
                    />
                    <Input
                        id={inputId}
                        type="search"
                        value={value.query}
                        placeholder={placeholder}
                        onChange={(event) =>
                            onChange({ query: event.currentTarget.value, filters: value.filters })
                        }
                        className="pl-8"
                    />
                </div>
            </div>
            {filters.length === 0 ? null : (
                <div className="flex flex-wrap items-end gap-2">{filters.map(renderFilter)}</div>
            )}
            {chips.length === 0 && value.query.length === 0 ? null : (
                <div className="flex flex-wrap items-center gap-2">
                    <ul aria-label="Active filters" className="flex flex-wrap gap-1">
                        {chips.map((chip) => (
                            <li key={chip.key}>
                                <span className="inline-flex items-center gap-1 rounded-sm border border-line-strong bg-raised py-0.5 pl-2 pr-1 text-xs text-ink">
                                    {chip.label}
                                    <button
                                        type="button"
                                        aria-label={`Remove ${chip.label} filter`}
                                        onClick={chip.remove}
                                        className="rounded-sm p-0.5 text-ink-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                    >
                                        <X className="size-3" aria-hidden="true" />
                                    </button>
                                </span>
                            </li>
                        ))}
                    </ul>
                    <Button variant="ghost" size="sm" onClick={clearAll}>
                        Clear all
                    </Button>
                </div>
            )}
        </section>
    );
}
