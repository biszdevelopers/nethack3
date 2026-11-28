import type { TeamStatus } from "@nethack/contracts";
import type { StatusBadgeTone } from "../../lib/status.js";

export const TEAM_STATUS_OPTIONS: readonly { value: TeamStatus; label: string }[] = [
    { value: "forming", label: "Forming" },
    { value: "ready", label: "Ready" },
    { value: "withdrawn", label: "Withdrawn" },
    { value: "disqualified", label: "Disqualified" },
    { value: "no_show", label: "No show" },
    { value: "disbanded", label: "Disbanded" },
];

const TEAM_STATUS_LABELS: Readonly<Record<TeamStatus, string>> = {
    forming: "Forming",
    ready: "Ready",
    withdrawn: "Withdrawn",
    disqualified: "Disqualified",
    no_show: "No show",
    disbanded: "Disbanded",
};

const INACTIVE_TEAM_STATUSES: ReadonlySet<TeamStatus> = new Set([
    "withdrawn",
    "disqualified",
    "no_show",
    "disbanded",
]);

export function teamStatusLabel(status: TeamStatus): string {
    return TEAM_STATUS_LABELS[status];
}

export function teamStatusTone(status: TeamStatus): StatusBadgeTone {
    if (status === "ready") {
        return "primary";
    }
    if (status === "forming") {
        return "neutral";
    }
    return "critical";
}

export function isInactiveTeamStatus(status: TeamStatus): boolean {
    return INACTIVE_TEAM_STATUSES.has(status);
}

export function teamSubmissionBlockMessage(status: TeamStatus): string | null {
    switch (status) {
        case "withdrawn":
            return "This team has withdrawn from the competition. Submissions cannot be created or marked ready.";
        case "disqualified":
            return "This team has been disqualified. Submissions cannot be created or marked ready.";
        case "no_show":
            return "This team did not participate. Submissions cannot be created or marked ready.";
        case "disbanded":
            return "This team has been disbanded. Submissions cannot be created or marked ready.";
        case "forming":
        case "ready":
            return null;
    }
}
