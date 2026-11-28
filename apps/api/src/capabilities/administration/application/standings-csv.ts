import type { TeamStatus } from "@nethack/contracts";

const HEADER = [
    "team_id",
    "team",
    "pathway",
    "status",
    "score_exact",
    "score",
    "rank",
    "awards",
    "project_name",
    "demo_url",
    "repo_url",
    "submitted",
] as const;

/** One team's row in the organizer standings export. */
export interface StandingRow {
    readonly teamId: string;
    readonly teamName: string;
    readonly status: TeamStatus;
    readonly pathway: string | null;
    readonly rank: number | null;
    readonly averageScore: number | null;
    readonly displayScore: number | null;
    readonly awards: readonly string[];
    readonly projectTitle: string | null;
    readonly demoUrl: string | null;
    readonly repositoryUrl: string | null;
    readonly submitted: boolean;
}

/**
 * Serialize one CSV cell and neutralize spreadsheet formulas. Project and team
 * names are participant-authored, so a leading `=`, `+`, `-`, or `@` must never
 * be interpreted by a spreadsheet application.
 */
export function csvCell(value: unknown): string {
    if (value === null || value === undefined) {
        return "";
    }
    const raw = String(value);
    const hasFormulaPrefix = /^[\s\p{Cc}]*[=+\-@]/u.test(raw);
    const startsWithSpreadsheetControl = /^[\t\r]/.test(raw);
    const safe = hasFormulaPrefix || startsWithSpreadsheetControl ? `'${raw}` : raw;
    return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function standingsCsv(rows: readonly StandingRow[]): string {
    const lines = rows.map((row) =>
        [
            row.teamId,
            row.teamName,
            row.pathway,
            row.status,
            score(row.averageScore, 4),
            score(row.displayScore ?? row.averageScore, 2),
            row.rank,
            row.awards.join("; "),
            row.projectTitle,
            row.demoUrl,
            row.repositoryUrl,
            row.submitted ? "yes" : "no",
        ]
            .map(csvCell)
            .join(","),
    );
    return [HEADER.join(","), ...lines].join("\n") + "\n";
}

function score(value: number | null, digits: number): string | null {
    return value === null ? null : value.toFixed(digits);
}
