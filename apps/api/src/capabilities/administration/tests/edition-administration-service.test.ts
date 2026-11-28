import { describe, expect, it, vi } from "vitest";
import type { JudgingResult, PublicResults, SubmissionStatus } from "@nethack/contracts";
import type { AuthContext } from "../../../authentication/types.js";
import type { DivisionSummary, EditionSummary } from "../../competitions/contracts.js";
import type { ProjectSummary } from "../../projects/contracts.js";
import type { SubmissionSummary } from "../../submissions/contracts.js";
import type { TeamWithMembers } from "../../teams/contracts.js";
import { ConflictError } from "../../../core/errors.js";
import {
    EditionAdministrationService,
    type EditionAdministrationSources,
} from "../application/edition-administration-service.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const editionId = "22222222-2222-4222-8222-222222222222";
const teamId = "33333333-3333-4333-8333-333333333333";
const submissionId = "44444444-4444-4444-8444-444444444444";
const userId = "55555555-5555-4555-8555-555555555555";

function auth(): AuthContext {
    return {
        method: "session",
        sessionId: null,
        sessionTokenHash: null,
        csrfToken: null,
        csrfHash: null,
        user: {
            id: userId,
            displayName: "Organizer",
            email: "organizer@example.test",
            avatarUrl: null,
            locale: "en",
            status: "active",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
        memberships: [],
        globalAdministrator: false,
        permissions: [],
        expiresAt: new Date("2026-02-01T00:00:00.000Z"),
    };
}

function edition(): EditionSummary {
    return {
        id: editionId,
        organizationId,
        seriesId: "66666666-6666-4666-8666-666666666666",
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
    };
}

function division(): DivisionSummary {
    return {
        id: "66666666-6666-4666-8666-666666666667",
        organizationId,
        editionId,
        name: "Open",
        slug: "open",
        description: "",
        minTeamSize: null,
        maxTeamSize: null,
    };
}

function team(): TeamWithMembers {
    return {
        id: teamId,
        organizationId,
        editionId,
        divisionId: division().id,
        name: "Fixture Team",
        description: "",
        status: "ready",
        statusReason: "",
        captainUserId: userId,
        memberCount: 1,
        maxMembers: 4,
        members: [
            {
                userId,
                displayName: "Fixture Organizer",
                avatarUrl: null,
                role: "captain",
                joinedAt: "2026-01-01T00:00:00.000Z",
            },
        ],
    };
}

function submission(
    status: SubmissionStatus,
    overrides: Partial<SubmissionSummary> = {},
): SubmissionSummary {
    return {
        id: submissionId,
        organizationId,
        editionId,
        projectId: "77777777-7777-4777-8777-777777777777",
        projectSlug: "fixture-project",
        teamId,
        status,
        currentVersion: 1,
        submittedAt: "2026-01-02T00:00:00.000Z",
        title: "Fixture Project",
        summary: "",
        ...overrides,
    };
}

function result(submittedCount: number, overrides: Partial<JudgingResult> = {}): JudgingResult {
    return {
        submissionId,
        projectId: "77777777-7777-4777-8777-777777777777",
        projectTitle: "Fixture Project",
        teamId,
        teamName: "Fixture Team",
        assignmentCount: 2,
        submittedCount,
        averageScore: null,
        rank: null,
        evaluations: [],
        ...overrides,
    };
}

function project(overrides: Partial<ProjectSummary> = {}): ProjectSummary {
    return {
        id: "77777777-7777-4777-8777-777777777777",
        organizationId,
        editionId,
        teamId,
        ownerUserId: userId,
        title: "Fixture Project",
        slug: "fixture-project",
        summary: "",
        descriptionMarkdown: "",
        repositoryUrl: "https://example.test/repo",
        demoUrl: "https://example.test/demo",
        videoUrl: null,
        aiDisclosure: "",
        tags: [],
        status: "published",
        publishedAt: "2026-01-02T00:00:00.000Z",
        lockedAt: null,
        ...overrides,
    };
}

function publishedResults(overrides: Partial<PublicResults> = {}): PublicResults {
    return {
        edition: {
            id: editionId,
            name: "Edition",
            slug: "edition",
            description: "",
            status: "judging",
            seriesName: "Series",
            organizationName: "Organization",
            organizationSlug: "organization",
            startsAt: null,
            endsAt: null,
        },
        showScores: true,
        showRanking: true,
        judgingEntries: [],
        votingRounds: [],
        peopleChoice: null,
        awards: [
            {
                id: "99999999-9999-4999-8999-999999999999",
                namespace: "best-overall",
                name: "Best Overall",
                description: "",
                icon: "award",
                color: "#00DC82",
                teams: [
                    {
                        teamId,
                        teamName: "Fixture Team",
                        projectId: null,
                        projectTitle: null,
                        note: "",
                    },
                ],
            },
        ],
        publishedAt: "2026-01-03T00:00:00.000Z",
        ...overrides,
    };
}

function sources(options: {
    readonly team?: TeamWithMembers;
    readonly submissions?: readonly SubmissionSummary[];
    readonly results?: readonly JudgingResult[];
    readonly teamSubmissions?: number;
    readonly published?: PublicResults | null;
    readonly project?: ProjectSummary;
}): {
    readonly sources: EditionAdministrationSources;
    readonly updateTeamStatus: ReturnType<typeof vi.fn>;
    readonly deleteTeam: ReturnType<typeof vi.fn>;
    readonly reopenSubmission: ReturnType<typeof vi.fn>;
} {
    const updateTeamStatus = vi.fn(async () => undefined);
    const deleteTeam = vi.fn(async () => undefined);
    const reopenSubmission = vi.fn(async () => undefined);
    return {
        sources: {
            editions: {
                getEdition: async () => edition(),
                listDivisions: async () => [division()],
            },
            teams: {
                listEditionTeams: async () => [options.team ?? team()],
                listEditionTeamsWithMembers: async () => [options.team ?? team()],
                updateTeamStatus,
                deleteTeam,
            },
            submissions: {
                getSubmission: async () => options.submissions?.[0] ?? submission("submitted"),
                listEditionSubmissions: async () =>
                    options.submissions ?? [submission("submitted")],
                countTeamSubmissions: async () => options.teamSubmissions ?? 0,
                reopenSubmission,
            },
            judging: {
                listEditionResults: async () => options.results ?? [result(0)],
            },
            projects: {
                getProject: async () => options.project ?? project(),
            },
            recognition: {
                getPublishedResults: async () => options.published ?? null,
                listTeamAwardNames: async () =>
                    (options.published?.awards ?? []).flatMap((award) =>
                        award.teams.map((team) => ({ teamId: team.teamId, name: award.name })),
                    ),
            },
        },
        updateTeamStatus,
        deleteTeam,
        reopenSubmission,
    };
}

describe("EditionAdministrationService", () => {
    it("composes teams, members, divisions, submissions, and results from contracts", async () => {
        const { sources: contractSources } = sources({
            results: [result(2, { averageScore: 80, displayScore: 88, rank: 1 })],
        });
        const teams = await new EditionAdministrationService(contractSources).listTeams(
            organizationId,
            editionId,
        );

        expect(teams).toHaveLength(1);
        expect(teams[0]?.members[0]?.displayName).toBe("Fixture Organizer");
        expect(teams[0]?.submissions[0]?.projectTitle).toBe("Fixture Project");
        expect(teams[0]?.statusReason).toBe("");
        expect(teams[0]?.divisionName).toBe("Open");
        expect(teams[0]?.projectTitle).toBe("Fixture Project");
        expect(teams[0]?.submittedAt).toBe("2026-01-02T00:00:00.000Z");
        expect(teams[0]?.score).toBe(88);
        expect(teams[0]?.rank).toBe(1);
    });

    it("uses the latest submission and falls back to the average score", async () => {
        const newerId = "88888888-8888-4888-8888-888888888888";
        const { sources: contractSources } = sources({
            submissions: [
                submission("submitted", {
                    title: "Older Project",
                    submittedAt: "2026-01-01T00:00:00.000Z",
                }),
                submission("submitted", {
                    id: newerId,
                    title: "Newer Project",
                    submittedAt: "2026-01-05T00:00:00.000Z",
                    currentVersion: 2,
                }),
            ],
            results: [result(2, { averageScore: 73.5 })],
        });

        const teams = await new EditionAdministrationService(contractSources).listTeams(
            organizationId,
            editionId,
        );

        expect(teams[0]?.projectTitle).toBe("Newer Project");
        expect(teams[0]?.submittedAt).toBe("2026-01-05T00:00:00.000Z");
        expect(teams[0]?.score).toBe(73.5);
        expect(teams[0]?.rank).toBeNull();
    });

    it("reports null project and result fields when the team has neither", async () => {
        const { sources: contractSources } = sources({ submissions: [], results: [] });

        const teams = await new EditionAdministrationService(contractSources).listTeams(
            organizationId,
            editionId,
        );

        expect(teams[0]?.projectTitle).toBeNull();
        expect(teams[0]?.submittedAt).toBeNull();
        expect(teams[0]?.score).toBeNull();
        expect(teams[0]?.rank).toBeNull();
    });

    it("maps standings rows with status, pathway, exact and display scores, links, and awards", async () => {
        const { sources: contractSources } = sources({
            team: { ...team(), status: "disqualified" },
            results: [
                result(3, {
                    averageScore: 87.4567,
                    displayScore: 91.2,
                    rank: 1,
                }),
            ],
            published: publishedResults(),
        });

        const rows = await new EditionAdministrationService(contractSources).listStandings(
            organizationId,
            editionId,
        );

        expect(rows).toHaveLength(1);
        expect(rows[0]).toEqual({
            teamId,
            teamName: "Fixture Team",
            status: "disqualified",
            pathway: "Open",
            rank: 1,
            averageScore: 87.4567,
            displayScore: 91.2,
            awards: ["Best Overall"],
            projectTitle: "Fixture Project",
            demoUrl: "https://example.test/demo",
            repositoryUrl: "https://example.test/repo",
            submitted: true,
        });
    });

    it("falls back to the latest submission and leaves awards empty without published results", async () => {
        const { sources: contractSources } = sources({
            submissions: [
                submission("draft", {
                    id: "88888888-8888-4888-8888-888888888888",
                    title: "Draft Project",
                    submittedAt: null,
                }),
            ],
            results: [],
            published: null,
        });

        const rows = await new EditionAdministrationService(contractSources).listStandings(
            organizationId,
            editionId,
        );

        expect(rows[0]?.projectTitle).toBe("Draft Project");
        expect(rows[0]?.awards).toEqual([]);
        expect(rows[0]?.submitted).toBe(false);
        expect(rows[0]?.rank).toBeNull();
        expect(rows[0]?.averageScore).toBeNull();
        expect(rows[0]?.displayScore).toBeNull();
    });

    it("orders ranked teams before unranked teams", async () => {
        const secondTeamId = "88888888-8888-4888-8888-888888888888";
        const { sources: contractSources } = sources({
            results: [
                result(3, { teamId: secondTeamId, teamName: "Second Team", rank: 2 }),
                result(3, { teamId, teamName: "Fixture Team", rank: 1 }),
            ],
        });
        const standings = new EditionAdministrationService({
            ...contractSources,
            teams: {
                ...contractSources.teams,
                listEditionTeams: async () => [
                    {
                        ...team(),
                        id: secondTeamId,
                        divisionId: null,
                        name: "Second Team",
                    },
                    team(),
                ],
            },
        });
        const rows = await standings.listStandings(organizationId, editionId);

        expect(rows.map((row) => row.teamName)).toEqual(["Fixture Team", "Second Team"]);
    });

    it("delegates team status changes with the acting user and reason", async () => {
        const { sources: contractSources, updateTeamStatus } = sources({});
        await new EditionAdministrationService(contractSources).updateTeamStatus(
            auth(),
            organizationId,
            editionId,
            teamId,
            "disbanded",
            "The team left the competition.",
            "127.0.0.1",
        );

        expect(updateTeamStatus).toHaveBeenCalledWith(
            { userId, ip: "127.0.0.1" },
            organizationId,
            editionId,
            teamId,
            "disbanded",
            "The team left the competition.",
        );
    });

    it("blocks team deletion while a submission exists", async () => {
        const { sources: contractSources, deleteTeam } = sources({ teamSubmissions: 1 });

        await expect(
            new EditionAdministrationService(contractSources).deleteTeam(
                auth(),
                organizationId,
                editionId,
                teamId,
                null,
            ),
        ).rejects.toBeInstanceOf(ConflictError);
        expect(deleteTeam).not.toHaveBeenCalled();
    });

    it("deletes an empty team through the teams contract", async () => {
        const { sources: contractSources, deleteTeam } = sources({ teamSubmissions: 0 });
        await new EditionAdministrationService(contractSources).deleteTeam(
            auth(),
            organizationId,
            editionId,
            teamId,
            null,
        );

        expect(deleteTeam).toHaveBeenCalledWith(
            { userId, ip: null },
            organizationId,
            editionId,
            teamId,
        );
    });

    it("blocks reopening after a submitted evaluation", async () => {
        const { sources: contractSources, reopenSubmission } = sources({
            results: [result(1)],
        });

        await expect(
            new EditionAdministrationService(contractSources).reopenSubmission(
                auth(),
                organizationId,
                editionId,
                submissionId,
                { status: "draft" },
                null,
            ),
        ).rejects.toBeInstanceOf(ConflictError);
        expect(reopenSubmission).not.toHaveBeenCalled();
    });

    it("reopens a submission through the submissions contract", async () => {
        const { sources: contractSources, reopenSubmission } = sources({
            results: [result(0)],
        });

        await new EditionAdministrationService(contractSources).reopenSubmission(
            auth(),
            organizationId,
            editionId,
            submissionId,
            { status: "changes_requested" },
            null,
        );

        expect(reopenSubmission).toHaveBeenCalledWith(
            { userId, ip: null },
            organizationId,
            submissionId,
            "changes_requested",
        );
    });
});
