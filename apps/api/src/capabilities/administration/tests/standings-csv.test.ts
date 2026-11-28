import { describe, expect, it } from "vitest";
import { csvCell, standingsCsv, type StandingRow } from "../application/standings-csv.js";

function row(overrides: Partial<StandingRow> = {}): StandingRow {
    return {
        teamId: "33333333-3333-4333-8333-333333333333",
        teamName: "Team",
        status: "ready",
        pathway: "Open",
        rank: 1,
        averageScore: 87.5,
        displayScore: 87.5,
        awards: ["Best Overall"],
        projectTitle: "Project",
        demoUrl: "https://example.test/demo",
        repositoryUrl: "https://example.test/repo",
        submitted: true,
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
    it("writes the documented header and one row per team", () => {
        const csv = standingsCsv([row()]);
        const [header, line, trailing] = csv.split("\n");

        expect(header).toBe(
            "team_id,team,pathway,status,score_exact,score,rank,awards,project_name,demo_url,repo_url,submitted",
        );
        expect(line).toBe(
            "33333333-3333-4333-8333-333333333333,Team,Open,ready,87.5000,87.50,1,Best Overall,Project,https://example.test/demo,https://example.test/repo,yes",
        );
        expect(trailing).toBe("");
    });

    it("keeps display and exact scores separate and formats both", () => {
        const line = standingsCsv([
            row({ averageScore: 87.4567, displayScore: 91.2, awards: [] }),
        ]).split("\n")[1];

        expect(line).toContain(",87.4567,91.20,");
        expect(line).toContain(",1,,Project,");
    });

    it("exports the disqualified status, links, and submitted state", () => {
        const line = standingsCsv([
            row({
                status: "disqualified",
                rank: null,
                averageScore: null,
                displayScore: null,
                awards: ["Best Design"],
                demoUrl: null,
                repositoryUrl: "https://example.test/repo",
                submitted: false,
            }),
        ]).split("\n")[1];

        expect(line).toBe(
            "33333333-3333-4333-8333-333333333333,Team,Open,disqualified,,,,Best Design,Project,,https://example.test/repo,no",
        );
    });

    it("joins real award names, quoting any commas", () => {
        const line = standingsCsv([
            row({ awards: ["Best Overall", "People's Choice, Runner Up"] }),
        ]).split("\n")[1];

        expect(line).toContain('"Best Overall; People\'s Choice, Runner Up"');
    });

    it("keeps unranked and unsubmitted teams as empty cells", () => {
        const line = standingsCsv([
            row({
                teamName: "Unsubmitted Team",
                pathway: null,
                rank: null,
                averageScore: null,
                displayScore: null,
                awards: [],
                projectTitle: null,
                demoUrl: null,
                repositoryUrl: null,
                submitted: false,
            }),
        ]).split("\n")[1];

        expect(line).toBe("33333333-3333-4333-8333-333333333333,Unsubmitted Team,,ready,,,,,,,,no");
    });

    it("escapes participant-authored team, project, and award names", () => {
        const csv = standingsCsv([
            row({
                teamName: "Team\nTwo",
                projectTitle: 'A "great", project',
                awards: ["=SUM(A1)", "Judge's Pick"],
            }),
        ]);

        expect(csv).toContain('"Team\nTwo"');
        expect(csv).toContain('"A ""great"", project"');
        expect(csv).toContain("'=SUM(A1); Judge's Pick");
    });
});
