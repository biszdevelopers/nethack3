import type { ReactNode } from "react";
import { Select } from "@nethack/ui";
import type { EditionOption } from "./query-keys.js";

export function EditionSelect({
    editions,
    value,
    onValueChange,
    label = "Competition edition",
    placeholder = "Select an edition",
    description,
}: {
    readonly editions: readonly EditionOption[];
    readonly value: string;
    readonly onValueChange: (value: string) => void;
    readonly label?: string;
    readonly placeholder?: string;
    readonly description?: string;
}): ReactNode {
    return (
        <Select
            label={label}
            options={editions.map((edition) => ({ value: edition.id, label: edition.name }))}
            value={value}
            onValueChange={onValueChange}
            placeholder={placeholder}
            {...(description === undefined ? {} : { description })}
        />
    );
}
