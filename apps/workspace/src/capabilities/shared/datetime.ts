export function localInputToIso(value: string): string | null {
    if (value.trim().length === 0) {
        return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return date.toISOString();
}

function pad(part: number): string {
    return String(part).padStart(2, "0");
}

export function isoToLocalInput(value: string | null): string {
    if (value === null) {
        return "";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "";
    }
    return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
        date.getHours(),
    )}:${pad(date.getMinutes())}`;
}

export function formatDateTime(value: string | null): string {
    if (value === null) {
        return "Not scheduled";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "Not scheduled";
    }
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

export function formatDate(value: string | null): string {
    if (value === null) {
        return "Not scheduled";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "Not scheduled";
    }
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}
