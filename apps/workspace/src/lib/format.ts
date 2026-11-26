import { format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";

function toDate(value: string): Date | null {
    const date = parseISO(value);
    return isValid(date) ? date : null;
}

export function formatDateTime(value: string | null): string {
    if (value === null) {
        return "Not scheduled";
    }
    const date = toDate(value);
    return date === null ? "Unknown date" : format(date, "PP p");
}

export function formatDate(value: string | null): string {
    if (value === null) {
        return "Not scheduled";
    }
    const date = toDate(value);
    return date === null ? "Unknown date" : format(date, "PP");
}

export function formatDateRange(start: string | null, end: string | null): string {
    if (start === null && end === null) {
        return "No dates scheduled";
    }
    if (start === null) {
        return `Ends ${formatDate(end)}`;
    }
    if (end === null) {
        return `Starts ${formatDate(start)}`;
    }
    return `${formatDate(start)} to ${formatDate(end)}`;
}

export function isInFuture(value: string, now = new Date()): boolean {
    const date = toDate(value);
    return date !== null && date.getTime() > now.getTime();
}

export function timeUntil(value: string): string {
    const date = toDate(value);
    return date === null ? "Unknown" : formatDistanceToNowStrict(date, { addSuffix: true });
}

export function toIsoOrNull(value: string): string | null {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
        return null;
    }
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
