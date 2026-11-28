export interface AuditFieldChange {
    readonly field: string;
    readonly before: string;
    readonly after: string;
}

export interface AuditField {
    readonly label: string;
    readonly value: string;
}

export interface AuditDetail {
    readonly reason: string | null;
    readonly changes: readonly AuditFieldChange[];
    readonly fields: readonly AuditField[];
    readonly raw: string;
}

const RESERVED_KEYS = new Set(["reason", "before", "after"]);
const EMPTY = "Not set";

/**
 * Turns stored audit metadata into a readable change summary. Records written
 * with `before`/`after` objects are diffed field by field; other records show
 * their fields directly, and the raw JSON stays available for unknown shapes.
 */
export function describeAuditMetadata(metadata: Record<string, unknown>): AuditDetail {
    const reason = typeof metadata.reason === "string" ? metadata.reason : null;
    const hasBefore = Object.hasOwn(metadata, "before");
    const hasAfter = Object.hasOwn(metadata, "after");

    const changes = hasBefore || hasAfter ? diffChanges(metadata.before, metadata.after) : [];
    const fields =
        changes.length > 0 || hasBefore || hasAfter
            ? []
            : Object.entries(metadata)
                  .filter(([key]) => !RESERVED_KEYS.has(key))
                  .map(([key, value]) => ({ label: key, value: formatValue(value) }));

    return {
        reason,
        changes,
        fields,
        raw: JSON.stringify(metadata, null, 2),
    };
}

function diffChanges(before: unknown, after: unknown): readonly AuditFieldChange[] {
    const beforeObject = asRecord(before);
    const afterObject = asRecord(after);
    if (beforeObject === null || afterObject === null) {
        return [
            {
                field: "value",
                before: formatValue(before),
                after: formatValue(after),
            },
        ];
    }
    const keys = new Set([...Object.keys(beforeObject), ...Object.keys(afterObject)]);
    return [...keys]
        .filter((key) => formatValue(beforeObject[key]) !== formatValue(afterObject[key]))
        .map((key) => ({
            field: key,
            before: formatValue(beforeObject[key]),
            after: formatValue(afterObject[key]),
        }));
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function formatValue(value: unknown): string {
    if (value === null || value === undefined) {
        return EMPTY;
    }
    if (typeof value === "string") {
        return value.length === 0 ? EMPTY : value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    try {
        return JSON.stringify(value) ?? EMPTY;
    } catch {
        return String(value);
    }
}
