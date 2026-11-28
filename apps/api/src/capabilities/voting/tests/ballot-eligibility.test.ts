import { describe, expect, it } from "vitest";
import type { TeamStatus } from "@nethack/contracts";
import { ForbiddenError } from "../../../core/errors.js";
import {
    assertSelectionsEligible,
    ineligibilityReason,
    isActiveVotingTeam,
    isSubmissionEligible,
    toBallotEligibility,
    type BallotEligibility,
    type SubmissionPlacement,
    type TeamDivision,
} from "../domain/ballot-eligibility.js";

const TEAM_ID = "3d0f2d0e-1111-4111-8111-111111111111";
const DIVISION_ID = "5e0f2d0e-1111-4111-8111-111111111111";

const TEAM_DIVISIONS = new Map<string, TeamDivision>([
    [TEAM_ID, { divisionId: DIVISION_ID }],
    ["3d0f2d0e-2222-4222-8222-222222222222", { divisionId: DIVISION_ID }],
    ["3d0f2d0e-3333-4333-8333-333333333333", { divisionId: null }],
]);

function team(status: TeamStatus, divisionId: string | null = DIVISION_ID) {
    return { id: TEAM_ID, divisionId, status };
}

describe("toBallotEligibility", () => {
    it("keeps a teamless voter unrestricted", () => {
        expect(toBallotEligibility(null)).toEqual({
            teamId: null,
            divisionId: null,
            active: true,
        });
    });

    it("carries the team and division of an active voter", () => {
        expect(toBallotEligibility(team("ready"))).toEqual({
            teamId: TEAM_ID,
            divisionId: DIVISION_ID,
            active: true,
        });
        expect(toBallotEligibility(team("forming"))).toEqual({
            teamId: TEAM_ID,
            divisionId: DIVISION_ID,
            active: true,
        });
    });

    it("marks withdrawn, disqualified, no-show, and disbanded teams inactive", () => {
        for (const status of ["withdrawn", "disqualified", "no_show", "disbanded"] as const) {
            expect(isActiveVotingTeam(status)).toBe(false);
            expect(toBallotEligibility(team(status)).active).toBe(false);
        }
    });
});

describe("submission eligibility", () => {
    const viewer: BallotEligibility = {
        teamId: TEAM_ID,
        divisionId: DIVISION_ID,
        active: true,
    };

    it("accepts another team in the same division", () => {
        const placement: SubmissionPlacement = {
            teamId: "3d0f2d0e-2222-4222-8222-222222222222",
        };
        expect(ineligibilityReason(placement, TEAM_DIVISIONS, viewer)).toBeNull();
        expect(isSubmissionEligible(placement, TEAM_DIVISIONS, viewer)).toBe(true);
    });

    it("rejects the voter's own team", () => {
        expect(ineligibilityReason({ teamId: TEAM_ID }, TEAM_DIVISIONS, viewer)).toBe("own_team");
    });

    it("rejects a team in another division or without one", () => {
        expect(
            ineligibilityReason(
                { teamId: "3d0f2d0e-3333-4333-8333-333333333333" },
                TEAM_DIVISIONS,
                viewer,
            ),
        ).toBe("outside_division");
        expect(ineligibilityReason({ teamId: null }, TEAM_DIVISIONS, viewer)).toBe(
            "outside_division",
        );
        expect(
            ineligibilityReason(
                { teamId: "3d0f2d0e-9999-4999-8999-999999999999" },
                TEAM_DIVISIONS,
                viewer,
            ),
        ).toBe("outside_division");
    });

    it("rejects every selection while the voter's team is inactive", () => {
        const inactive: BallotEligibility = { ...viewer, active: false };
        expect(
            ineligibilityReason(
                { teamId: "3d0f2d0e-2222-4222-8222-222222222222" },
                TEAM_DIVISIONS,
                inactive,
            ),
        ).toBe("inactive_team");
    });

    it("keeps every other team when the voter's team has no division", () => {
        const noDivision: BallotEligibility = { ...viewer, divisionId: null };
        expect(
            ineligibilityReason(
                { teamId: "3d0f2d0e-3333-4333-8333-333333333333" },
                TEAM_DIVISIONS,
                noDivision,
            ),
        ).toBeNull();
        expect(ineligibilityReason({ teamId: TEAM_ID }, TEAM_DIVISIONS, noDivision)).toBe(
            "own_team",
        );
    });
});

describe("assertSelectionsEligible", () => {
    const viewer: BallotEligibility = {
        teamId: TEAM_ID,
        divisionId: DIVISION_ID,
        active: true,
    };
    const SAME_DIVISION_ID = "3d0f2d0e-2222-4222-8222-222222222222";
    const OTHER_DIVISION_ID = "3d0f2d0e-3333-4333-8333-333333333333";
    const placements = new Map<string, SubmissionPlacement>([
        ["own", { teamId: TEAM_ID }],
        ["same", { teamId: SAME_DIVISION_ID }],
        ["other", { teamId: OTHER_DIVISION_ID }],
    ]);

    it("accepts a ballot made only of same-division, other-team submissions", () => {
        expect(() =>
            assertSelectionsEligible(["same"], placements, TEAM_DIVISIONS, viewer),
        ).not.toThrow();
    });

    it("rejects a ballot that scores the voter's own team", () => {
        expect(() =>
            assertSelectionsEligible(["own", "same"], placements, TEAM_DIVISIONS, viewer),
        ).toThrow(ForbiddenError);
        expect(() =>
            assertSelectionsEligible(["own", "same"], placements, TEAM_DIVISIONS, viewer),
        ).toThrow("own team");
    });

    it("rejects a ballot that scores an out-of-division submission", () => {
        expect(() =>
            assertSelectionsEligible(["same", "other"], placements, TEAM_DIVISIONS, viewer),
        ).toThrow("own division");
    });

    it("rejects every ballot while the voter's team is inactive", () => {
        expect(() =>
            assertSelectionsEligible(["same"], placements, TEAM_DIVISIONS, {
                ...viewer,
                active: false,
            }),
        ).toThrow("team is not active");
    });
});
