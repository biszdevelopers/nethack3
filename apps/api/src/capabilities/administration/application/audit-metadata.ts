const REDACTED = "[redacted]";
const SENSITIVE_KEY_PARTS = ["password", "token", "secret", "authorization", "cookie"] as const;

/**
 * Audit metadata is rendered to operators. A metadata key that could carry a
 * credential is replaced wholesale, at any depth, before the record leaves the
 * API.
 */
export function isSensitiveAuditKey(key: string): boolean {
    const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
    return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part));
}

export function redactAuditMetadata(value: unknown): Record<string, unknown> {
    const redacted = redactValue(value, new WeakSet<object>());
    return isPlainRecord(redacted) ? redacted : {};
}

function redactValue(value: unknown, seen: WeakSet<object>): unknown {
    if (value === null || typeof value !== "object") {
        return value;
    }
    if (ArrayBuffer.isView(value)) {
        return REDACTED;
    }
    if (seen.has(value)) {
        return REDACTED;
    }
    seen.add(value);
    if (Array.isArray(value)) {
        return value.map((item) => redactValue(item, seen));
    }
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
        result[key] = isSensitiveAuditKey(key) ? REDACTED : redactValue(item, seen);
    }
    return result;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
