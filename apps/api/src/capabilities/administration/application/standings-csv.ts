import type { JudgingResult } from "@nethack/contracts";

const HEADER = [
    "rank",
    "project",
    "team",
    "average_score",
    "submitted",
    "assignments",
    "awards",
] as const;

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

export function standingsCsv(results: readonly JudgingResult[]): string {
    const rows = results.map((result) =>
        [
            result.rank,
            result.projectTitle,
            result.teamName,
            result.averageScore === null ? null : result.averageScore.toFixed(2),
            result.submittedCount,
            result.assignmentCount,
            "",
        ]
            .map(csvCell)
            .join(","),
    );
    return [HEADER.join(","), ...rows].join("\n") + "\n";
}
