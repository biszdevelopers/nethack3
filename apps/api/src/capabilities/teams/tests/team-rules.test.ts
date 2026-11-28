import { describe, expect, it } from "vitest";
import { ConflictError, ForbiddenError } from "../../../core/errors.js";
import { TeamRules, type EditionTeamPolicy, type TeamSizeLimits } from "../domain/team-rules.js";

const openEdition: EditionTeamPolicy = {
    status: "registration_open",
    registrationOpensAt: null,
    registrationClosesAt: null,
    teamMinSize: 2,
    teamMaxSize: 4,
};

const limits: TeamSizeLimits = { min: 2, max: 4 };

describe("TeamRules.limits", () => {
    it("uses edition limits without a division", () => {
        expect(TeamRules.limits(openEdition, null)).toEqual({ min: 2, max: 4 });
    });

    it("lets division limits override edition limits", () => {
        expect(TeamRules.limits(openEdition, { minTeamSize: 3, maxTeamSize: 8 })).toEqual({
            min: 3,
            max: 8,
        });
    });

    it("falls back per field when a division limit is absent", () => {
        expect(TeamRules.limits(openEdition, { minTeamSize: null, maxTeamSize: 6 })).toEqual({
            min: 2,
            max: 6,
        });
        expect(TeamRules.limits(openEdition, { minTeamSize: 5, maxTeamSize: null })).toEqual({
            min: 5,
            max: 4,
        });
    });
});

describe("TeamRules capacity", () => {
    it("rejects an invitation when the team is full", () => {
        expect(() => TeamRules.assertCapacity(4, limits)).toThrow(ConflictError);
    });

    it("allows an invitation below capacity", () => {
        expect(() => TeamRules.assertCapacity(3, limits)).not.toThrow();
    });
});

describe("TeamRules readiness", () => {
    it("requires the minimum team size", () => {
        expect(() => TeamRules.assertReady(1, limits)).toThrow(ConflictError);
    });

    it("rejects readiness above the maximum team size", () => {
        expect(() => TeamRules.assertReady(5, limits)).toThrow(ConflictError);
    });

    it("accepts readiness at both limits", () => {
        expect(() => TeamRules.assertReady(2, limits)).not.toThrow();
        expect(() => TeamRules.assertReady(4, limits)).not.toThrow();
    });
});

describe("TeamRules edition eligibility", () => {
    it("allows published and open editions", () => {
        expect(() =>
            TeamRules.assertEditionAcceptsTeams(openEdition, new Date("2026-01-01T00:00:00Z")),
        ).not.toThrow();
        expect(() =>
            TeamRules.assertEditionAcceptsTeams(
                { ...openEdition, status: "published" },
                new Date("2026-01-01T00:00:00Z"),
            ),
        ).not.toThrow();
    });

    it("rejects editions that are not accepting teams", () => {
        expect(() =>
            TeamRules.assertEditionAcceptsTeams(
                { ...openEdition, status: "registration_closed" },
                new Date("2026-01-01T00:00:00Z"),
            ),
        ).toThrow(ConflictError);
    });

    it("enforces the registration window", () => {
        const windowed: EditionTeamPolicy = {
            ...openEdition,
            registrationOpensAt: "2026-01-10T00:00:00.000Z",
            registrationClosesAt: "2026-01-20T00:00:00.000Z",
        };
        expect(() =>
            TeamRules.assertEditionAcceptsTeams(windowed, new Date("2026-01-01T00:00:00Z")),
        ).toThrow(ConflictError);
        expect(() =>
            TeamRules.assertEditionAcceptsTeams(windowed, new Date("2026-01-25T00:00:00Z")),
        ).toThrow(ConflictError);
        expect(() =>
            TeamRules.assertEditionAcceptsTeams(windowed, new Date("2026-01-15T00:00:00Z")),
        ).not.toThrow();
    });
});

describe("TeamRules registration eligibility", () => {
    it("requires an approved registration", () => {
        expect(() => TeamRules.requireApprovedRegistration(null)).toThrow(ForbiddenError);
        expect(() => TeamRules.requireApprovedRegistration({ status: "pending" })).toThrow(
            ForbiddenError,
        );
        expect(() => TeamRules.requireApprovedRegistration({ status: "waitlisted" })).toThrow(
            ForbiddenError,
        );
    });

    it("returns the approved registration", () => {
        const registration = { status: "approved" as const };
        expect(TeamRules.requireApprovedRegistration(registration)).toBe(registration);
    });
});

describe("TeamRules deletion", () => {
    it("allows deleting a team without members", () => {
        expect(() => TeamRules.assertCanDelete(0)).not.toThrow();
    });

    it("refuses to delete a team with members", () => {
        expect(() => TeamRules.assertCanDelete(1)).toThrow(ConflictError);
    });
});

describe("TeamRules captain rules", () => {
    const captainUserId = "captain";
    const memberUserId = "member";

    it("allows only the captain to invite", () => {
        expect(() => TeamRules.assertCaptainOnly(captainUserId, captainUserId)).not.toThrow();
        expect(() => TeamRules.assertCaptainOnly(captainUserId, memberUserId)).toThrow(
            ForbiddenError,
        );
    });

    it("allows the captain or an organizer to manage the team", () => {
        expect(() =>
            TeamRules.assertCaptainOrOrganizer(captainUserId, captainUserId, false),
        ).not.toThrow();
        expect(() =>
            TeamRules.assertCaptainOrOrganizer(captainUserId, memberUserId, true),
        ).not.toThrow();
        expect(() =>
            TeamRules.assertCaptainOrOrganizer(captainUserId, memberUserId, false),
        ).toThrow(ForbiddenError);
    });

    it("refuses to remove or leave without transferring captaincy", () => {
        expect(() => TeamRules.assertNotRemovingCaptain(captainUserId, captainUserId)).toThrow(
            ConflictError,
        );
        expect(() => TeamRules.assertNotRemovingCaptain(captainUserId, memberUserId)).not.toThrow();
        expect(() => TeamRules.assertCanLeave(captainUserId, captainUserId)).toThrow(ConflictError);
        expect(() => TeamRules.assertCanLeave(captainUserId, memberUserId)).not.toThrow();
    });

    it("refuses mutations on an inactive team", () => {
        expect(() => TeamRules.assertActiveTeam("disbanded")).toThrow(ConflictError);
        expect(() => TeamRules.assertActiveTeam("withdrawn")).toThrow(ConflictError);
        expect(() => TeamRules.assertActiveTeam("disqualified")).toThrow(ConflictError);
        expect(() => TeamRules.assertActiveTeam("no_show")).toThrow(ConflictError);
        expect(() => TeamRules.assertActiveTeam("forming")).not.toThrow();
        expect(() => TeamRules.assertActiveTeam("ready")).not.toThrow();
    });
});

describe("TeamRules status transitions", () => {
    it("allows active teams to become ready or terminal", () => {
        for (const status of [
            "ready",
            "withdrawn",
            "disqualified",
            "no_show",
            "disbanded",
        ] as const) {
            expect(() => TeamRules.assertStatusTransition("forming", status)).not.toThrow();
            expect(() => TeamRules.assertStatusTransition("ready", status)).not.toThrow();
        }
        expect(() => TeamRules.assertStatusTransition("ready", "forming")).not.toThrow();
    });

    it("allows re-applying the current status", () => {
        for (const status of [
            "forming",
            "ready",
            "withdrawn",
            "disqualified",
            "no_show",
            "disbanded",
        ] as const) {
            expect(() => TeamRules.assertStatusTransition(status, status)).not.toThrow();
        }
    });

    it("keeps terminal statuses closed", () => {
        for (const status of ["withdrawn", "disqualified", "no_show", "disbanded"] as const) {
            expect(() => TeamRules.assertStatusTransition(status, "forming")).toThrow(
                ConflictError,
            );
            expect(() => TeamRules.assertStatusTransition(status, "ready")).toThrow(ConflictError);
        }
    });
});
