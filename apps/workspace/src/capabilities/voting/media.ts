export function safeExternalUrl(value: string | null): string | null {
    if (value === null) {
        return null;
    }
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
    } catch {
        return null;
    }
}
