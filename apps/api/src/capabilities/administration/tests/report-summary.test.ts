import { describe, expect, it } from "vitest";
import type { EditionSummary } from "../../competitions/contracts.js";
import { ReportService, type ReportSources } from "../application/report-service.js";

const organizationId = "11111111-1111-4111-8111-111111111111";

function edition(index: number, startsAt: string | null): EditionSummary {
    const id = `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
    return {
        id,
        organizationId,
        seriesId: "22222222-2222-4222-8222-222222222222",
        seriesName: "Series",
        name: `Edition ${index}`,
        slug: `edition-${index}`,
        description: "",
        status: "completed",
        timezone: "UTC",
        registrationOpensAt: null,
        registrationClosesAt: null,
        startsAt,
        endsAt: null,
        teamMinSize: 1,
        teamMaxSize: 4,
        maxParticipants: null,
        rulesMarkdown: "",
        publishedAt: null,
    };
}

function sourcesFor(editions: readonly EditionSummary[]): ReportSources {
    return {
        editions: { listEditions: async () => editions },
        registrations: {
            countRegistrations: async (_organizationId, editionId) => ({
                total: 10 + editions.findIndex((candidate) => candidate.id === editionId),
                approved: 5,
            }),
        },
        teams: { countTeams: async () => 3 },
        projects: { countProjects: async () => 2 },
        submissions: { countSubmissions: async () => 4 },
        evaluations: { countSubmittedEvaluations: async () => 7 },
    };
}

describe("ReportService.summary", () => {
    it("aggregates every contract count per edition", async () => {
        const service = new ReportService(sourcesFor([edition(1, "2026-03-01T00:00:00.000Z")]));

        const summary = await service.summary(organizationId);

        expect(summary).toEqual({
            organizationId,
            editions: [
                {
                    editionId: "00000000-0000-4000-8000-000000000001",
                    editionName: "Edition 1",
                    registrations: 10,
                    approvedRegistrations: 5,
                    teams: 3,
                    projects: 2,
                    submissions: 4,
                    evaluationsSubmitted: 7,
                },
            ],
        });
    });

    it("orders editions by startsAt descending with unscheduled editions last", async () => {
        const service = new ReportService(
            sourcesFor([
                edition(1, "2026-01-01T00:00:00.000Z"),
                edition(2, null),
                edition(3, "2026-05-01T00:00:00.000Z"),
            ]),
        );

        const summary = await service.summary(organizationId);

        expect(summary.editions.map((row) => row.editionId)).toEqual([
            "00000000-0000-4000-8000-000000000003",
            "00000000-0000-4000-8000-000000000001",
            "00000000-0000-4000-8000-000000000002",
        ]);
    });

    it("bounds the report to the 50 newest editions", async () => {
        const editions = Array.from({ length: 55 }, (_value, index) =>
            edition(index + 1, new Date(Date.UTC(2026, 0, 1) + index * 86_400_000).toISOString()),
        );
        const service = new ReportService(sourcesFor(editions));

        const summary = await service.summary(organizationId);

        expect(summary.editions).toHaveLength(50);
        expect(summary.editions[0]?.editionId).toBe("00000000-0000-4000-8000-000000000055");
    });
});
