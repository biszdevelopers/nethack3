import { describe, expect, it } from "vitest";
import type { CompetitionEditionStatus } from "@nethack/contracts";
import { ConflictError, ValidationError } from "../../../core/errors.js";
import { CompetitionRules, type EditionSchedule } from "../domain/competition-rules.js";

const ALLOWED: readonly [CompetitionEditionStatus, CompetitionEditionStatus][] = [
    ["draft", "published"],
    ["published", "registration_open"],
    ["published", "archived"],
    ["registration_open", "registration_closed"],
    ["registration_closed", "active"],
    ["active", "judging"],
    ["active", "completed"],
    ["judging", "voting"],
    ["judging", "completed"],
    ["voting", "completed"],
    ["completed", "archived"],
];

const FORBIDDEN: readonly [CompetitionEditionStatus, CompetitionEditionStatus][] = [
    ["draft", "registration_open"],
    ["draft", "archived"],
    ["published", "active"],
    ["registration_open", "active"],
    ["registration_closed", "published"],
    ["active", "registration_open"],
    ["judging", "registration_closed"],
    ["voting", "judging"],
    ["completed", "voting"],
    ["archived", "published"],
];

function schedule(overrides: Partial<EditionSchedule> = {}): EditionSchedule {
    return {
        teamMinSize: 1,
        teamMaxSize: 4,
        registrationOpensAt: null,
        registrationClosesAt: null,
        startsAt: null,
        endsAt: null,
        ...overrides,
    };
}

describe("CompetitionRules.assertTransition", () => {
    it.each(ALLOWED)("allows %s -> %s", (from, to) => {
        expect(() => CompetitionRules.assertTransition(from, to)).not.toThrow();
    });

    it.each(FORBIDDEN)("rejects %s -> %s", (from, to) => {
        expect(() => CompetitionRules.assertTransition(from, to)).toThrow(ConflictError);
    });

    it("rejects a transition to the current status", () => {
        expect(() => CompetitionRules.assertTransition("active", "active")).toThrow(ConflictError);
    });
});

describe("CompetitionRules.assertPublishable", () => {
    it("publishes a draft", () => {
        expect(() => CompetitionRules.assertPublishable("draft")).not.toThrow();
    });

    it("rejects publishing a non-draft edition", () => {
        expect(() => CompetitionRules.assertPublishable("published")).toThrow(ConflictError);
    });
});

describe("CompetitionRules.assertEditionIsValid", () => {
    it("accepts a consistent schedule", () => {
        expect(() =>
            CompetitionRules.assertEditionIsValid(
                schedule({
                    registrationOpensAt: new Date("2026-01-01T00:00:00.000Z"),
                    registrationClosesAt: new Date("2026-02-01T00:00:00.000Z"),
                    startsAt: new Date("2026-03-01T00:00:00.000Z"),
                    endsAt: new Date("2026-04-01T00:00:00.000Z"),
                }),
            ),
        ).not.toThrow();
    });

    it("rejects minimum team size above maximum team size", () => {
        expect(() =>
            CompetitionRules.assertEditionIsValid(schedule({ teamMinSize: 5, teamMaxSize: 2 })),
        ).toThrow(ValidationError);
    });

    it("rejects registration closing before it opens", () => {
        expect(() =>
            CompetitionRules.assertEditionIsValid(
                schedule({
                    registrationOpensAt: new Date("2026-02-01T00:00:00.000Z"),
                    registrationClosesAt: new Date("2026-01-01T00:00:00.000Z"),
                }),
            ),
        ).toThrow(ValidationError);
    });

    it("rejects an end before the start", () => {
        expect(() =>
            CompetitionRules.assertEditionIsValid(
                schedule({
                    startsAt: new Date("2026-03-01T00:00:00.000Z"),
                    endsAt: new Date("2026-02-01T00:00:00.000Z"),
                }),
            ),
        ).toThrow(ValidationError);
    });
});

describe("CompetitionRules.assertDivisionTeamSizes", () => {
    it("accepts unset or ordered bounds", () => {
        expect(() => CompetitionRules.assertDivisionTeamSizes(null, null)).not.toThrow();
        expect(() => CompetitionRules.assertDivisionTeamSizes(2, 5)).not.toThrow();
        expect(() => CompetitionRules.assertDivisionTeamSizes(3, null)).not.toThrow();
    });

    it("rejects minimum team size above maximum team size", () => {
        expect(() => CompetitionRules.assertDivisionTeamSizes(5, 2)).toThrow(ValidationError);
    });
});

describe("CompetitionRules deletion rules", () => {
    it("allows deleting an unused series or division", () => {
        expect(() => CompetitionRules.assertSeriesIsDeletable(0)).not.toThrow();
        expect(() => CompetitionRules.assertDivisionIsDeletable(0, 0)).not.toThrow();
    });

    it("rejects deleting a series with editions", () => {
        expect(() => CompetitionRules.assertSeriesIsDeletable(1)).toThrow(ConflictError);
    });

    it("rejects deleting a division with registrations or teams", () => {
        expect(() => CompetitionRules.assertDivisionIsDeletable(1, 0)).toThrow(ConflictError);
        expect(() => CompetitionRules.assertDivisionIsDeletable(0, 1)).toThrow(ConflictError);
    });
});
