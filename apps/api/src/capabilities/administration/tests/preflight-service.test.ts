import { describe, expect, it } from "vitest";
import type { JudgingResult, Milestone, VotingRound } from "@nethack/contracts";
import type { EditionSummary } from "../../competitions/contracts.js";
import type { SubmissionSummary } from "../../submissions/contracts.js";
import type { TeamSummary } from "../../teams/contracts.js";
import { FixedClock } from "../../../core/clock.js";
import { NotFoundError } from "../../../core/errors.js";
import { PreflightService, type PreflightSources } from "../application/preflight-service.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const editionId = "22222222-2222-4222-8222-222222222222";
const now = new Date("2026-03-01T00:00:00.000Z");
const clock = new FixedClock(now);

function edition(overrides: Partial<EditionSummary> = {}): EditionSummary {
    return {
        id: editionId,
        organizationId,
        seriesId: "33333333-3333-4333-8333-333333333333",
        seriesName: "Series",
        name: "Edition",
        slug: "edition",
        description: "",
        status: "judging",
        timezone: "UTC",
        registrationOpensAt: null,
        registrationClosesAt: null,
        startsAt: null,
        endsAt: null,
        teamMinSize: 1,
        teamMaxSize: 4,
        maxParticipants: null,
        rulesMarkdown: "",
        publishedAt: null,
        themeName: null,
        themeDescription: null,
        showScores: false,
        showRanking: false,
        ...overrides,
    };
}

function submission(
    id: string,
    teamId: string | null,
    status: SubmissionSummary["status"] = "submitted",
): SubmissionSummary {
    return {
        id,
        organizationId,
        editionId,
        projectId: `project-${id}`,
        projectSlug: `project-${id}`,
        teamId,
        status,
        currentVersion: 1,
        submittedAt: now.toISOString(),
        title: `Project ${id}`,
        summary: "",
    };
}

function team(id: string, name: string): TeamSummary {
    return {
        id,
        organizationId,
        editionId,
        divisionId: null,
        name,
        description: "",
        status: "ready",
        statusReason: "",
        lockedAt: null,
        captainUserId: "user",
        memberCount: 1,
        maxMembers: 4,
    };
}

function result(
    submissionId: string,
    assignmentCount: number,
    submittedCount: number,
): JudgingResult {
    return {
        submissionId,
        projectId: `project-${submissionId}`,
        projectTitle: `Project ${submissionId}`,
        teamId: null,
        teamName: null,
        assignmentCount,
        submittedCount,
        averageScore: null,
        rank: null,
        evaluations: [],
    };
}

function round(overrides: Partial<VotingRound> = {}): VotingRound {
    return {
        id: "66666666-6666-4666-8666-666666666666",
        organizationId,
        editionId,
        name: "Round",
        description: "",
        status: "open",
        eligibleRoles: ["participant"],
        maxSelections: 10,
        maxVotesPerUser: 0,
        opensAt: null,
        closesAt: null,
        publishedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        ...overrides,
    };
}

function milestone(title: string, occursAt: string): Milestone {
    return {
        id: `milestone-${title}`,
        organizationId,
        editionId,
        title,
        description: "",
        kind: "other",
        occursAt,
        createdAt: now.toISOString(),
    };
}

function sources(options: {
    readonly edition?: EditionSummary | null;
    readonly results?: readonly JudgingResult[];
    readonly rounds?: readonly VotingRound[];
    readonly teams?: number;
    readonly teamList?: readonly TeamSummary[];
    readonly submissions?: readonly SubmissionSummary[];
    readonly openFlags?: number;
    readonly milestones?: readonly Milestone[];
    readonly approvedParticipants?: number;
}): PreflightSources {
    return {
        editions: {
            getEdition: async () => (options.edition === undefined ? edition() : options.edition),
            listMilestones: async () => options.milestones ?? [],
        },
        teams: {
            countTeams: async () => options.teams ?? 4,
            listEditionTeams: async () => options.teamList ?? [team("team-1", "Team One")],
        },
        projects: { countProjects: async () => 6 },
        submissions: {
            countSubmissions: async () =>
                options.submissions === undefined ? 3 : options.submissions.length,
            listEditionSubmissions: async () => options.submissions ?? [],
        },
        judging: {
            listEditionResults: async () =>
                options.results ?? [result("a", 3, 2), result("b", 1, 0)],
            countOpenFlags: async () => options.openFlags ?? 0,
        },
        voting: { listRounds: async () => options.rounds ?? [] },
        participants: { countApprovedParticipants: async () => options.approvedParticipants ?? 0 },
    };
}

describe("PreflightService.forEdition", () => {
    it("aggregates contract counts and readiness", async () => {
        const preflight = await new PreflightService(sources({ openFlags: 2 }), clock).forEdition(
            organizationId,
            editionId,
        );

        expect(preflight).toEqual({
            editionId,
            teams: 4,
            projects: 6,
            submissions: 3,
            assignments: 4,
            submittedEvaluations: 2,
            openFlags: 2,
            publishedResults: false,
            teamsBelowMinimumEvaluations: 0,
            belowMinimumTeams: [],
            scheduleWarnings: [],
            voteCapWarnings: [],
            readiness: {
                hasTeams: true,
                hasSubmissions: true,
                hasAssignments: true,
                hasSubmittedEvaluations: true,
            },
        });
    });

    it("reports missing readiness when the edition has no data", async () => {
        const preflight = await new PreflightService(
            sources({ results: [], teams: 0, submissions: [] }),
            clock,
        ).forEdition(organizationId, editionId);

        expect(preflight.readiness).toEqual({
            hasTeams: false,
            hasSubmissions: false,
            hasAssignments: false,
            hasSubmittedEvaluations: false,
        });
    });

    it("reports published results only for a published voting round", async () => {
        const published = await new PreflightService(
            sources({ rounds: [round({ status: "closed" }), round({ status: "published" })] }),
            clock,
        ).forEdition(organizationId, editionId);
        const unpublished = await new PreflightService(
            sources({ rounds: [round({ status: "closed" }), round({ status: "open" })] }),
            clock,
        ).forEdition(organizationId, editionId);

        expect(published.publishedResults).toBe(true);
        expect(unpublished.publishedResults).toBe(false);
    });

    it("rejects an edition outside the organization", async () => {
        const missing: PreflightSources = {
            ...sources({}),
            editions: {
                getEdition: async () => null,
                listMilestones: async () => [],
            },
        };

        await expect(
            new PreflightService(missing, clock).forEdition(organizationId, editionId),
        ).rejects.toBeInstanceOf(NotFoundError);
    });
});

describe("PreflightService team feedback coverage", () => {
    it("lists teams with fewer than three submitted evaluations", async () => {
        const preflight = await new PreflightService(
            sources({
                teamList: [team("t1", "Team One"), team("t2", "Team Two")],
                submissions: [
                    submission("a", "t1"),
                    submission("b", "t2"),
                    submission("c", "t1", "accepted"),
                ],
                results: [result("a", 2, 1), result("b", 2, 2), result("c", 0, 0)],
            }),
            clock,
        ).forEdition(organizationId, editionId);

        expect(preflight.teamsBelowMinimumEvaluations).toBe(2);
        expect(preflight.belowMinimumTeams).toEqual([
            {
                teamId: "t1",
                teamName: "Team One",
                projectTitle: "Project a, Project c",
                submittedEvaluations: 1,
            },
            {
                teamId: "t2",
                teamName: "Team Two",
                projectTitle: "Project b",
                submittedEvaluations: 2,
            },
        ]);
    });

    it("treats a teamless submission as its own row", async () => {
        const preflight = await new PreflightService(
            sources({
                submissions: [submission("solo", null)],
                results: [],
            }),
            clock,
        ).forEdition(organizationId, editionId);

        expect(preflight.belowMinimumTeams).toEqual([
            {
                teamId: null,
                teamName: null,
                projectTitle: "Project solo",
                submittedEvaluations: 0,
            },
        ]);
    });

    it("ignores draft and withdrawn submissions", async () => {
        const preflight = await new PreflightService(
            sources({
                submissions: [
                    submission("draft", "t1", "draft"),
                    submission("gone", "t2", "withdrawn"),
                ],
            }),
            clock,
        ).forEdition(organizationId, editionId);

        expect(preflight.teamsBelowMinimumEvaluations).toBe(0);
        expect(preflight.belowMinimumTeams).toEqual([]);
    });
});

describe("PreflightService schedule warnings", () => {
    it("flags an edition that ends before it starts", async () => {
        const preflight = await new PreflightService(
            sources({
                edition: edition({
                    startsAt: "2026-04-10T00:00:00.000Z",
                    endsAt: "2026-04-01T00:00:00.000Z",
                }),
            }),
            clock,
        ).forEdition(organizationId, editionId);

        expect(preflight.scheduleWarnings).toEqual(["The edition ends before it starts."]);
    });

    it("flags registration closing after the edition starts", async () => {
        const preflight = await new PreflightService(
            sources({
                edition: edition({
                    registrationClosesAt: "2026-04-02T00:00:00.000Z",
                    startsAt: "2026-04-01T00:00:00.000Z",
                }),
            }),
            clock,
        ).forEdition(organizationId, editionId);

        expect(preflight.scheduleWarnings).toEqual([
            "Registration closes after the edition starts.",
        ]);
    });

    it("flags milestones outside the edition window", async () => {
        const preflight = await new PreflightService(
            sources({
                edition: edition({
                    startsAt: "2026-04-01T00:00:00.000Z",
                    endsAt: "2026-04-30T00:00:00.000Z",
                }),
                milestones: [
                    milestone("Kickoff", "2026-03-01T00:00:00.000Z"),
                    milestone("Finals", "2026-05-02T00:00:00.000Z"),
                    milestone("Demo day", "2026-04-20T00:00:00.000Z"),
                ],
            }),
            clock,
        ).forEdition(organizationId, editionId);

        expect(preflight.scheduleWarnings).toEqual([
            "Milestone “Kickoff” occurs before the edition starts.",
            "Milestone “Finals” occurs after the edition ends.",
        ]);
    });

    it("skips schedule checks without an edition window", async () => {
        const preflight = await new PreflightService(
            sources({ milestones: [milestone("Any time", "2030-01-01T00:00:00.000Z")] }),
            clock,
        ).forEdition(organizationId, editionId);

        expect(preflight.scheduleWarnings).toEqual([]);
    });
});

describe("PreflightService vote cap warnings", () => {
    it("warns when the selection cap exceeds eligible submissions", async () => {
        const preflight = await new PreflightService(
            sources({
                submissions: [submission("a", "t1"), submission("b", "t2", "draft")],
                rounds: [round({ name: "Community vote", maxSelections: 5 })],
            }),
            clock,
        ).forEdition(organizationId, editionId);

        expect(preflight.voteCapWarnings).toEqual([
            "Round “Community vote” allows 5 selections but the edition has 1 eligible submission.",
        ]);
    });

    it("warns when the per-voter cap cannot cover the selection limit", async () => {
        const preflight = await new PreflightService(
            sources({
                submissions: [
                    submission("a", "t1"),
                    submission("b", "t2"),
                    submission("c", "t3"),
                    submission("d", "t4"),
                    submission("e", "t5"),
                ],
                rounds: [round({ name: "Peer vote", maxSelections: 5, maxVotesPerUser: 2 })],
                approvedParticipants: 2,
            }),
            clock,
        ).forEdition(organizationId, editionId);

        expect(preflight.voteCapWarnings).toEqual([
            "Round “Peer vote” caps each of 2 eligible voters at 2 selections, so at most 4 votes can cover a 5 selection limit.",
        ]);
    });

    it("only evaluates open and upcoming rounds", async () => {
        const preflight = await new PreflightService(
            sources({
                submissions: [submission("a", "t1")],
                rounds: [
                    round({ name: "Closed", status: "closed", maxSelections: 5 }),
                    round({
                        name: "Past draft",
                        status: "draft",
                        maxSelections: 5,
                        opensAt: "2026-02-01T00:00:00.000Z",
                    }),
                    round({
                        name: "Upcoming",
                        status: "draft",
                        maxSelections: 5,
                        opensAt: "2026-04-01T00:00:00.000Z",
                    }),
                ],
            }),
            clock,
        ).forEdition(organizationId, editionId);

        expect(preflight.voteCapWarnings).toEqual([
            "Round “Upcoming” allows 5 selections but the edition has 1 eligible submission.",
        ]);
    });

    it("skips voter capacity when roles outside participants are eligible", async () => {
        const preflight = await new PreflightService(
            sources({
                submissions: [submission("a", "t1"), submission("b", "t2")],
                rounds: [
                    round({
                        name: "Open to all",
                        eligibleRoles: ["participant", "judge"],
                        maxSelections: 2,
                        maxVotesPerUser: 1,
                    }),
                ],
                approvedParticipants: 1,
            }),
            clock,
        ).forEdition(organizationId, editionId);

        expect(preflight.voteCapWarnings).toEqual([]);
    });
});
