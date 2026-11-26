export type StatusBadgeTone = "neutral" | "primary" | "outline" | "critical";

const SUCCESS_STATUSES = new Set([
    "approved",
    "accepted",
    "active",
    "published",
    "ready",
    "completed",
    "submitted",
]);

const WARNING_STATUSES = new Set([
    "pending",
    "waitlisted",
    "under_review",
    "changes_requested",
    "draft",
    "forming",
    "judging",
    "voting",
    "scanning",
    "quarantined",
    "registration_open",
    "registration_closed",
]);

const CRITICAL_STATUSES = new Set([
    "rejected",
    "withdrawn",
    "disqualified",
    "disbanded",
    "deleted",
    "expired",
    "revoked",
]);

export function statusBadgeTone(status: string): StatusBadgeTone {
    if (SUCCESS_STATUSES.has(status)) {
        return "primary";
    }
    if (WARNING_STATUSES.has(status)) {
        return "neutral";
    }
    if (CRITICAL_STATUSES.has(status)) {
        return "critical";
    }
    return "outline";
}

export function humanizeStatus(status: string): string {
    return status
        .replaceAll("_", " ")
        .split(" ")
        .filter((word) => word.length > 0)
        .map((word) => `${word.slice(0, 1).toLocaleUpperCase()}${word.slice(1)}`)
        .join(" ");
}
