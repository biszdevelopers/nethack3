import { describe, expect, it } from "vitest";
import {
    createEditionRequestSchema,
    publicCompetitionSchema,
    updateEditionRequestSchema,
} from "@nethack/contracts";

const MINIMAL_CREATE = {
    name: "Theme edition",
    slug: "theme-edition",
    timezone: "UTC",
};

const PUBLIC_COMPETITION = {
    editionId: "f1000000-0000-4000-8000-000000000003",
    name: "Fixture Build Weekend",
    slug: "fixture-build-weekend",
    description: "Edition used to verify public theme and visibility fields.",
    themeName: "Beneath the surface",
    themeDescription: "Build something hidden.",
    status: "published",
    organizationName: "Example Workspace",
    organizationSlug: "example-workspace",
    seriesName: "Fixture Series",
    startsAt: null,
    endsAt: null,
    registrationClosesAt: null,
    teamMinSize: 1,
    teamMaxSize: 4,
    showScores: false,
    showRanking: false,
    publishedProjectCount: 0,
};

describe("edition theme and visibility defaults", () => {
    it("defaults theme fields to null and visibility flags to false", () => {
        const parsed = createEditionRequestSchema.parse(MINIMAL_CREATE);
        expect(parsed.themeName).toBeNull();
        expect(parsed.themeDescription).toBeNull();
        expect(parsed.showScores).toBe(false);
        expect(parsed.showRanking).toBe(false);
    });

    it("keeps explicit theme values and flags on create", () => {
        const parsed = createEditionRequestSchema.parse({
            ...MINIMAL_CREATE,
            themeName: "  Beneath the surface  ",
            themeDescription: "Build something hidden.",
            showScores: true,
            showRanking: true,
        });
        expect(parsed.themeName).toBe("Beneath the surface");
        expect(parsed.themeDescription).toBe("Build something hidden.");
        expect(parsed.showScores).toBe(true);
        expect(parsed.showRanking).toBe(true);
    });

    it("clears theme fields and disables flags on update", () => {
        const parsed = updateEditionRequestSchema.parse({
            themeName: null,
            themeDescription: null,
            showScores: false,
            showRanking: false,
        });
        expect(parsed.themeName).toBeNull();
        expect(parsed.themeDescription).toBeNull();
        expect(parsed.showScores).toBe(false);
        expect(parsed.showRanking).toBe(false);
    });

    it("treats a blank theme as unrevealed", () => {
        const created = createEditionRequestSchema.parse({
            ...MINIMAL_CREATE,
            themeName: "   ",
            themeDescription: "",
        });
        expect(created.themeName).toBeNull();
        expect(created.themeDescription).toBeNull();

        const updated = updateEditionRequestSchema.parse({ themeName: " " });
        expect(updated.themeName).toBeNull();
    });

    it("omits untouched update fields so partial updates stay partial", () => {
        const parsed = updateEditionRequestSchema.parse({ name: "Renamed edition" });
        expect(parsed.themeName).toBeUndefined();
        expect(parsed.showScores).toBeUndefined();
        expect(parsed.showRanking).toBeUndefined();
    });
});

describe("public competition visibility contract", () => {
    it("accepts a theme with both visibility flags", () => {
        const parsed = publicCompetitionSchema.parse(PUBLIC_COMPETITION);
        expect(parsed.themeName).toBe("Beneath the surface");
        expect(parsed.themeDescription).toBe("Build something hidden.");
        expect(parsed.showScores).toBe(false);
        expect(parsed.showRanking).toBe(false);
    });

    it("accepts an unrevealed theme", () => {
        const parsed = publicCompetitionSchema.parse({
            ...PUBLIC_COMPETITION,
            themeName: null,
            themeDescription: null,
            showRanking: true,
        });
        expect(parsed.themeName).toBeNull();
        expect(parsed.themeDescription).toBeNull();
        expect(parsed.showRanking).toBe(true);
    });

    it("rejects a payload without the visibility flags", () => {
        const missingFlags: Record<string, unknown> = { ...PUBLIC_COMPETITION };
        delete missingFlags.showScores;
        delete missingFlags.showRanking;
        expect(publicCompetitionSchema.safeParse(missingFlags).success).toBe(false);
    });
});
