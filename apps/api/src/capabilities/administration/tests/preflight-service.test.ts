import { describe, expect, it } from "vitest";
import type { JudgingResult, VotingRound } from "@nethack/contracts";
import type { EditionSummary } from "../../competitions/contracts.js";
import { NotFoundError } from "../../../core/errors.js";
import { PreflightService, type PreflightSources } from "../application/preflight-service.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const editionId = "22222222-2222-4222-8222-222222222222";

function edition(): EditionSummary {
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
    };
}

function result(assignmentCount: number, submittedCount: number): JudgingResult {
    return {
        submissionId: "44444444-4444-4444-8444-444444444444",
        projectId: "55555555-5555-4555-8555-555555555555",
        projectTitle: "Project",
        teamId: null,
        teamName: null,
        assignmentCount,
        submittedCount,
        averageScore: null,
        rank: null,
        evaluations: [],
    };
}

function round(status: VotingRound["status"]): VotingRound {
    return {
        id: "66666666-6666-4666-8666-666666666666",
        organizationId,
        editionId,
        name: "Round",
        description: "",
        status,
        eligibleRoles: ["participant"],
        maxSelections: 10,
        maxVotesPerUser: 0,
        opensAt: null,
        closesAt: null,
        publishedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
    };
}

function sources(options: {
    readonly results?: readonly JudgingResult[];
    readonly rounds?: readonly VotingRound[];
    readonly teams?: number;
    readonly openFlags?: number;
}): PreflightSources {
    return {
        editions: { getEdition: async () => edition() },
        teams: { countTeams: async () => options.teams ?? 4 },
        projects: { countProjects: async () => 6 },
        submissions: { countSubmissions: async () => 3 },
        judging: {
            listEditionResults: async () => options.results ?? [result(3, 2), result(1, 0)],
            countOpenFlags: async () => options.openFlags ?? 0,
        },
        voting: { listRounds: async () => options.rounds ?? [] },
    };
}

describe("PreflightService.forEdition", () => {
    it("aggregates contract counts and readiness", async () => {
        const preflight = await new PreflightService(sources({ openFlags: 2 })).forEdition(
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
            readiness: {
                hasTeams: true,
                hasSubmissions: true,
                hasAssignments: true,
                hasSubmittedEvaluations: true,
            },
        });
    });

    it("reports missing readiness when the edition has no data", async () => {
        const preflight = await new PreflightService(sources({ results: [], teams: 0 })).forEdition(
            organizationId,
            editionId,
        );

        expect(preflight.readiness).toEqual({
            hasTeams: false,
            hasSubmissions: true,
            hasAssignments: false,
            hasSubmittedEvaluations: false,
        });
    });

    it("reports published results only for a published voting round", async () => {
        const published = await new PreflightService(
            sources({ rounds: [round("closed"), round("published")] }),
        ).forEdition(organizationId, editionId);
        const unpublished = await new PreflightService(
            sources({ rounds: [round("closed"), round("open")] }),
        ).forEdition(organizationId, editionId);

        expect(published.publishedResults).toBe(true);
        expect(unpublished.publishedResults).toBe(false);
    });

    it("rejects an edition outside the organization", async () => {
        const missing: PreflightSources = {
            ...sources({}),
            editions: { getEdition: async () => null },
        };

        await expect(
            new PreflightService(missing).forEdition(organizationId, editionId),
        ).rejects.toBeInstanceOf(NotFoundError);
    });
});
