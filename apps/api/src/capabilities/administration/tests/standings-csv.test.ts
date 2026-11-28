import { describe, expect, it } from "vitest";
import type { JudgingResult } from "@nethack/contracts";
import { csvCell, standingsCsv } from "../application/standings-csv.js";

function result(overrides: Partial<JudgingResult> = {}): JudgingResult {
    return {
        submissionId: "11111111-1111-4111-8111-111111111111",
        projectId: "22222222-2222-4222-8222-222222222222",
        projectTitle: "Project",
        teamId: "33333333-3333-4333-8333-333333333333",
        teamName: "Team",
        assignmentCount: 3,
        submittedCount: 2,
        averageScore: 87.5,
        rank: 1,
        evaluations: [],
        ...overrides,
    };
}

describe("csvCell", () => {
    it("leaves plain values untouched", () => {
        expect(csvCell("Fixture Project")).toBe("Fixture Project");
        expect(csvCell(42)).toBe("42");
    });

    it("quotes commas, quotes, and line breaks", () => {
        expect(csvCell("Team, One")).toBe('"Team, One"');
        expect(csvCell('A "quoted" name')).toBe('"A ""quoted"" name"');
        expect(csvCell("first\nsecond")).toBe('"first\nsecond"');
    });

    it("neutralizes spreadsheet formulas", () => {
        expect(csvCell("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
        expect(csvCell("+1")).toBe("'+1");
        expect(csvCell("-1")).toBe("'-1");
        expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    });
});

describe("standingsCsv", () => {
    it("writes the documented header and one row per result", () => {
        const csv = standingsCsv([result()]);
        const [header, row, trailing] = csv.split("\n");

        expect(header).toBe("rank,project,team,average_score,submitted,assignments,awards");
        expect(row).toBe("1,Project,Team,87.50,2,3,");
        expect(trailing).toBe("");
    });

    it("keeps unranked and unscored submissions as empty cells", () => {
        const csv = standingsCsv([
            result({ rank: null, averageScore: null, teamName: null, submittedCount: 0 }),
        ]);
        const row = csv.split("\n")[1];

        expect(row).toBe(",Project,,,0,3,");
    });

    it("escapes participant-authored project and team names", () => {
        const csv = standingsCsv([
            result({ projectTitle: 'A "great", project', teamName: "Team\nTwo" }),
        ]);

        expect(csv).toContain('"A ""great"", project"');
        expect(csv).toContain('"Team\nTwo"');
    });
});
