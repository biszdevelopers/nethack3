import { describe, expect, it } from "vitest";
import {
    createEditionRequestSchema,
    publicCompetitionSchema,
    updateEditionRequestSchema,
} from "@nethack/contracts";

const RELEASE_AT = "2026-12-05T18:00:00.000Z";

const MINIMAL_CREATE = {
    name: "Release edition",
    slug: "release-edition",
    timezone: "UTC",
};

describe("scheduled results release", () => {
    it("defaults the release to unscheduled", () => {
        expect(createEditionRequestSchema.parse(MINIMAL_CREATE).resultsOpenAt).toBeNull();
    });

    it("accepts an explicit release on create and clears it on update", () => {
        expect(
            createEditionRequestSchema.parse({ ...MINIMAL_CREATE, resultsOpenAt: RELEASE_AT })
                .resultsOpenAt,
        ).toBe(RELEASE_AT);
        expect(updateEditionRequestSchema.parse({ resultsOpenAt: null }).resultsOpenAt).toBeNull();
        expect(updateEditionRequestSchema.parse({ resultsOpenAt: RELEASE_AT }).resultsOpenAt).toBe(
            RELEASE_AT,
        );
    });

    it("keeps an untouched release out of a partial update", () => {
        expect(updateEditionRequestSchema.parse({ name: "Renamed" }).resultsOpenAt).toBeUndefined();
    });
});

describe("public competition release contract", () => {
    const PUBLIC_COMPETITION = {
        editionId: "f1000000-0000-4000-8000-000000000003",
        name: "Fixture Build Weekend",
        slug: "fixture-build-weekend",
        description: "Public release contract fixture.",
        themeName: null,
        themeDescription: null,
        status: "judging",
        organizationName: "Example Workspace",
        organizationSlug: "example-workspace",
        seriesName: "Fixture Series",
        startsAt: null,
        endsAt: null,
        registrationClosesAt: null,
        resultsOpenAt: RELEASE_AT,
        teamMinSize: 1,
        teamMaxSize: 4,
        showScores: false,
        showRanking: false,
        publishedProjectCount: 0,
    };

    it("exposes the scheduled release while results are locked", () => {
        expect(publicCompetitionSchema.parse(PUBLIC_COMPETITION).resultsOpenAt).toBe(RELEASE_AT);
    });

    it("requires the release field even when it is unscheduled", () => {
        const withoutRelease: Record<string, unknown> = { ...PUBLIC_COMPETITION };
        delete withoutRelease.resultsOpenAt;
        expect(publicCompetitionSchema.safeParse(withoutRelease).success).toBe(false);
        expect(
            publicCompetitionSchema.parse({ ...PUBLIC_COMPETITION, resultsOpenAt: null })
                .resultsOpenAt,
        ).toBeNull();
    });
});
