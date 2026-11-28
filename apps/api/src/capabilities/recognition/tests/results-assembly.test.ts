import { describe, expect, it } from "vitest";
import { publicResultsSchema, type JudgingResult, type VoteResult } from "@nethack/contracts";
import {
    applyReviewThreshold,
    assemblePublicResults,
    awardsForTeam,
    findTeamResult,
    type ResultAssemblyInput,
} from "../domain/results-assembly.js";

const TEAM_A = "a0000000-0000-4000-8000-000000000001";
const TEAM_B = "a0000000-0000-4000-8000-000000000002";
const TEAM_C = "a0000000-0000-4000-8000-000000000003";
const SUBMISSION_A = "b0000000-0000-4000-8000-000000000001";
const SUBMISSION_B = "b0000000-0000-4000-8000-000000000002";
const PROJECT_A = "c0000000-0000-4000-8000-000000000001";
const PROJECT_B = "c0000000-0000-4000-8000-000000000002";
const DIVISION = "d0000000-0000-4000-8000-000000000001";
const AWARD = "e0000000-0000-4000-8000-000000000001";

function judging(
    overrides: Partial<JudgingResult> &
        Pick<JudgingResult, "submissionId" | "projectId" | "projectTitle" | "teamId">,
): JudgingResult {
    return {
        teamName: null,
        assignmentCount: 3,
        submittedCount: 3,
        averageScore: null,
        rank: null,
        evaluations: [],
        ...overrides,
    };
}

function voting(overrides: Partial<VoteResult> = {}): VoteResult {
    return {
        roundId: "f0000000-0000-4000-8000-000000000001",
        roundName: "Community choice",
        publishedAt: "2026-11-01T10:00:00.000Z",
        totalBallots: 3,
        entries: [],
        ...overrides,
    };
}

function input(overrides: Partial<ResultAssemblyInput> = {}): ResultAssemblyInput {
    return {
        edition: {
            id: "f0000000-0000-4000-8000-000000000002",
            name: "Fixture edition",
            slug: "fixture-edition",
            description: "",
            status: "completed",
            seriesName: "Fixture series",
            organizationName: "Fixture organization",
            organizationSlug: "fixture-organization",
            startsAt: "2026-10-01T09:00:00.000Z",
            endsAt: "2026-10-03T18:00:00.000Z",
        },
        showScores: true,
        showRanking: true,
        judging: [],
        voting: [],
        teams: [
            { id: TEAM_A, name: "Alpha team", divisionId: DIVISION },
            { id: TEAM_B, name: "Beta team", divisionId: null },
            { id: TEAM_C, name: "Gamma team", divisionId: null },
        ],
        submissions: [
            {
                id: SUBMISSION_A,
                projectId: PROJECT_A,
                projectSlug: "alpha",
                teamId: TEAM_A,
                title: "Alpha",
            },
            {
                id: SUBMISSION_B,
                projectId: PROJECT_B,
                projectSlug: "beta",
                teamId: TEAM_B,
                title: "Beta",
            },
        ],
        divisions: [{ id: DIVISION, name: "Open" }],
        awards: [
            {
                id: AWARD,
                namespace: "best-design",
                name: "Best design",
                description: "Judged pick.",
                icon: "award",
                color: "gold",
            },
        ],
        teamAwards: [{ awardId: AWARD, teamId: TEAM_A, note: "Clear winner." }],
        publishedAt: "2026-11-27T12:00:00.000Z",
        ...overrides,
    };
}

describe("public results assembly", () => {
    it("orders ranked entries, resolves divisions, and attaches awards", () => {
        const results = assemblePublicResults(
            input({
                judging: [
                    judging({
                        submissionId: SUBMISSION_B,
                        projectId: PROJECT_B,
                        projectTitle: "Beta",
                        teamId: TEAM_B,
                        teamName: "Beta team",
                        averageScore: 80,
                        rank: 2,
                    }),
                    judging({
                        submissionId: SUBMISSION_A,
                        projectId: PROJECT_A,
                        projectTitle: "Alpha",
                        teamId: TEAM_A,
                        teamName: "Alpha team",
                        averageScore: 91.5,
                        rank: 1,
                    }),
                ],
            }),
        );

        expect(results.judgingEntries.map((entry) => entry.projectTitle)).toEqual([
            "Alpha",
            "Beta",
        ]);
        expect(results.judgingEntries[0]?.divisionName).toBe("Open");
        expect(results.judgingEntries[1]?.divisionName).toBeNull();
        expect(results.judgingEntries[0]?.awards.map((award) => award.name)).toEqual([
            "Best design",
        ]);
        expect(results.awards[0]?.teams).toEqual([
            {
                teamId: TEAM_A,
                teamName: "Alpha team",
                projectId: PROJECT_A,
                projectTitle: "Alpha",
                note: "Clear winner.",
            },
        ]);
    });

    it("copies project slugs, display scores, and visibility flags", () => {
        const results = assemblePublicResults(
            input({
                showScores: false,
                showRanking: false,
                judging: [
                    judging({
                        submissionId: SUBMISSION_A,
                        projectId: PROJECT_A,
                        projectTitle: "Alpha",
                        teamId: TEAM_A,
                        teamName: "Alpha team",
                        averageScore: 91.5,
                        displayScore: 88,
                        rank: 1,
                    }),
                ],
            }),
        );

        expect(results.showScores).toBe(false);
        expect(results.showRanking).toBe(false);
        expect(results.judgingEntries[0]).toMatchObject({
            projectSlug: "alpha",
            displayScore: 88,
        });
    });

    it("normalizes a missing display score to null", () => {
        const results = assemblePublicResults(
            input({
                judging: [
                    judging({
                        submissionId: SUBMISSION_B,
                        projectId: PROJECT_B,
                        projectTitle: "Beta",
                        teamId: TEAM_B,
                        teamName: "Beta team",
                        averageScore: 70,
                        rank: 1,
                    }),
                ],
            }),
        );

        expect(results.judgingEntries[0]?.displayScore).toBeNull();
    });

    it("parses legacy snapshots with visibility defaults and no entry slugs", () => {
        const legacy = {
            edition: input().edition,
            judgingEntries: [
                {
                    submissionId: SUBMISSION_A,
                    projectId: PROJECT_A,
                    projectTitle: "Alpha",
                    teamId: TEAM_A,
                    teamName: "Alpha team",
                    divisionName: "Open",
                    rank: 1,
                    averageScore: 91.5,
                    submittedCount: 2,
                    assignmentCount: 2,
                    awards: [],
                },
            ],
            votingRounds: [],
            peopleChoice: null,
            awards: [],
            publishedAt: "2026-11-27T12:00:00.000Z",
        };

        const parsed = publicResultsSchema.parse(legacy);

        expect(parsed.showScores).toBe(true);
        expect(parsed.showRanking).toBe(true);
        expect(parsed.judgingEntries[0]).toMatchObject({ projectSlug: "", displayScore: null });
    });

    it("enriches voting entries and picks the People's Choice winner", () => {
        const results = assemblePublicResults(
            input({
                voting: [
                    voting({
                        entries: [
                            {
                                submissionId: SUBMISSION_A,
                                projectTitle: "Alpha",
                                teamName: null,
                                rank: 2,
                                votes: 2,
                                totalStars: 8,
                                averageStars: 4,
                            },
                            {
                                submissionId: SUBMISSION_B,
                                projectTitle: "Beta",
                                teamName: null,
                                rank: 1,
                                votes: 5,
                                totalStars: 22,
                                averageStars: 4.4,
                            },
                        ],
                    }),
                ],
            }),
        );

        expect(results.votingRounds[0]?.entries[0]?.votes).toBe(5);
        expect(results.votingRounds[0]?.entries[0]?.teamName).toBe("Beta team");
        expect(results.peopleChoice?.projectTitle).toBe("Beta");
        expect(results.peopleChoice?.roundName).toBe("Community choice");
    });

    it("withholds rank and scores below three submitted evaluations", () => {
        const results = assemblePublicResults(
            input({
                judging: [
                    judging({
                        submissionId: SUBMISSION_A,
                        projectId: PROJECT_A,
                        projectTitle: "Alpha",
                        teamId: TEAM_A,
                        teamName: "Alpha team",
                        submittedCount: 2,
                        averageScore: 91.5,
                        displayScore: 88,
                        rank: 1,
                    }),
                    judging({
                        submissionId: SUBMISSION_B,
                        projectId: PROJECT_B,
                        projectTitle: "Beta",
                        teamId: TEAM_B,
                        teamName: "Beta team",
                        submittedCount: 3,
                        averageScore: 80,
                        displayScore: 79,
                        rank: 2,
                    }),
                ],
            }),
        );

        expect(
            results.judgingEntries.find((entry) => entry.projectTitle === "Alpha"),
        ).toMatchObject({
            rank: null,
            averageScore: null,
            displayScore: null,
            submittedCount: 2,
        });
        expect(results.judgingEntries.find((entry) => entry.projectTitle === "Beta")).toMatchObject(
            {
                rank: 2,
                averageScore: 80,
                displayScore: 79,
            },
        );
        expect(findTeamResult(results, TEAM_A)).toMatchObject({
            rank: null,
            submittedCount: 2,
            averageScore: null,
            displayScore: null,
        });
    });

    it("sanitizes a previously published low-review snapshot", () => {
        const results = assemblePublicResults(
            input({
                judging: [
                    judging({
                        submissionId: SUBMISSION_A,
                        projectId: PROJECT_A,
                        projectTitle: "Alpha",
                        teamId: TEAM_A,
                        teamName: "Alpha team",
                        averageScore: 91.5,
                        displayScore: 88,
                        rank: 1,
                    }),
                ],
            }),
        );
        const legacy = {
            ...results,
            judgingEntries: results.judgingEntries.map((entry) => ({
                ...entry,
                submittedCount: 1,
            })),
        };

        const sanitized = applyReviewThreshold(legacy);
        expect(sanitized.judgingEntries[0]).toMatchObject({
            rank: null,
            averageScore: null,
            displayScore: null,
        });
    });

    it("finds a team result by rank and by award only", () => {
        const results = assemblePublicResults(
            input({
                judging: [
                    judging({
                        submissionId: SUBMISSION_A,
                        projectId: PROJECT_A,
                        projectTitle: "Alpha",
                        teamId: TEAM_A,
                        teamName: "Alpha team",
                        averageScore: 91.5,
                        rank: 1,
                    }),
                ],
            }),
        );

        expect(findTeamResult(results, TEAM_A)).toMatchObject({
            teamName: "Alpha team",
            rank: 1,
            project: { id: PROJECT_A, title: "Alpha" },
        });
        expect(awardsForTeam(results, TEAM_A)).toHaveLength(1);
        expect(findTeamResult(results, TEAM_C)).toBeNull();

        const awardOnly = assemblePublicResults(
            input({
                teamAwards: [{ awardId: AWARD, teamId: TEAM_C, note: "Special mention." }],
            }),
        );
        expect(findTeamResult(awardOnly, TEAM_C)).toMatchObject({
            teamName: "Gamma team",
            rank: null,
            project: null,
        });
        expect(findTeamResult(awardOnly, TEAM_C)?.awards).toHaveLength(1);
    });
});
