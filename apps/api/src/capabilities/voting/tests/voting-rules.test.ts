import { describe, expect, it } from "vitest";
import type { VotingRoundStatus } from "@nethack/contracts";
import { ConflictError, ForbiddenError, ValidationError } from "../../../core/errors.js";
import { normalizeEligibleRoles, VotingRules, type VotingWindow } from "../domain/voting-rules.js";

const NOW = new Date("2026-06-15T12:00:00.000Z");

function window(overrides: Partial<VotingWindow> = {}): VotingWindow {
    return {
        status: "open",
        opensAt: null,
        closesAt: null,
        ...overrides,
    };
}

describe("VotingRules.round transitions", () => {
    it("allows draft to open, open to closed, and closed to published", () => {
        expect(() => VotingRules.assertTransition("draft", "open")).not.toThrow();
        expect(() => VotingRules.assertTransition("open", "closed")).not.toThrow();
        expect(() => VotingRules.assertTransition("closed", "published")).not.toThrow();
    });

    it("rejects skipping, reversing, and repeating a status", () => {
        const invalid: readonly [VotingRoundStatus, VotingRoundStatus][] = [
            ["draft", "closed"],
            ["draft", "published"],
            ["open", "published"],
            ["published", "open"],
            ["closed", "open"],
            ["open", "open"],
        ];
        for (const [from, to] of invalid) {
            expect(() => VotingRules.assertTransition(from, to)).toThrow(ConflictError);
        }
    });
});

describe("VotingRules.assertSchedule", () => {
    it("accepts an unbounded or ordered window", () => {
        expect(() => VotingRules.assertSchedule(null, null)).not.toThrow();
        expect(() =>
            VotingRules.assertSchedule(
                new Date("2026-06-01T00:00:00.000Z"),
                new Date("2026-06-30T00:00:00.000Z"),
            ),
        ).not.toThrow();
    });

    it("rejects a close that precedes or equals the open", () => {
        expect(() =>
            VotingRules.assertSchedule(
                new Date("2026-06-30T00:00:00.000Z"),
                new Date("2026-06-01T00:00:00.000Z"),
            ),
        ).toThrow(ValidationError);
        expect(() =>
            VotingRules.assertSchedule(
                new Date("2026-06-15T12:00:00.000Z"),
                new Date("2026-06-15T12:00:00.000Z"),
            ),
        ).toThrow(ValidationError);
    });
});

describe("VotingRules.assertOpenable", () => {
    it("opens a draft round with a valid schedule", () => {
        expect(() => VotingRules.assertOpenable(window({ status: "draft" }), NOW)).not.toThrow();
    });

    it("rejects opening a round that is not draft", () => {
        expect(() => VotingRules.assertOpenable(window({ status: "closed" }), NOW)).toThrow(
            ConflictError,
        );
    });

    it("rejects opening with an already-ended window", () => {
        expect(() =>
            VotingRules.assertOpenable(
                window({
                    status: "draft",
                    closesAt: new Date("2026-06-01T00:00:00.000Z"),
                }),
                NOW,
            ),
        ).toThrow(ConflictError);
    });

    it("rejects opening with an inverted schedule", () => {
        expect(() =>
            VotingRules.assertOpenable(
                window({
                    status: "draft",
                    opensAt: new Date("2026-06-30T00:00:00.000Z"),
                    closesAt: new Date("2026-06-01T00:00:00.000Z"),
                }),
                NOW,
            ),
        ).toThrow(ValidationError);
    });
});

describe("VotingRules.assertBallotWindow", () => {
    it("accepts an open round inside the window", () => {
        expect(() =>
            VotingRules.assertBallotWindow(
                window({
                    opensAt: new Date("2026-06-01T00:00:00.000Z"),
                    closesAt: new Date("2026-06-30T00:00:00.000Z"),
                }),
                NOW,
            ),
        ).not.toThrow();
    });

    it("rejects voting outside the open status", () => {
        expect(() => VotingRules.assertBallotWindow(window({ status: "closed" }), NOW)).toThrow(
            ConflictError,
        );
        expect(() => VotingRules.assertBallotWindow(window({ status: "published" }), NOW)).toThrow(
            ConflictError,
        );
    });

    it("rejects voting before the window opens", () => {
        expect(() =>
            VotingRules.assertBallotWindow(
                window({ opensAt: new Date("2026-07-01T00:00:00.000Z") }),
                NOW,
            ),
        ).toThrow(ConflictError);
    });

    it("rejects voting after the window closes", () => {
        expect(() =>
            VotingRules.assertBallotWindow(
                window({ closesAt: new Date("2026-06-01T00:00:00.000Z") }),
                NOW,
            ),
        ).toThrow(ConflictError);
    });
});

describe("VotingRules.assertSelections", () => {
    const one = "3d0f2d0e-1111-4111-8111-111111111111";
    const two = "3d0f2d0e-2222-4222-8222-222222222222";
    const three = "3d0f2d0e-3333-4333-8333-333333333333";

    it("accepts a unique selection within the limit", () => {
        expect(() => VotingRules.assertSelections([one], 1)).not.toThrow();
        expect(() => VotingRules.assertSelections([one, two, three], 3)).not.toThrow();
    });

    it("rejects an empty selection", () => {
        expect(() => VotingRules.assertSelections([], 1)).toThrow(ValidationError);
    });

    it("rejects duplicate submissions", () => {
        expect(() => VotingRules.assertSelections([one, one], 2)).toThrow(ValidationError);
    });

    it("rejects more selections than the round allows", () => {
        expect(() => VotingRules.assertSelections([one, two], 1)).toThrow(ValidationError);
    });
});

describe("VotingRules eligibility", () => {
    it("treats an owner as an organizer", () => {
        expect(VotingRules.effectiveRole("owner")).toBe("organizer");
        expect(VotingRules.effectiveRole("participant")).toBe("participant");
        expect(() => VotingRules.assertRoleEligible("owner", ["organizer"])).not.toThrow();
        expect(() => VotingRules.assertRoleEligible("owner", ["participant"])).toThrow(
            ForbiddenError,
        );
    });

    it("requires the caller role to be listed", () => {
        expect(() => VotingRules.assertRoleEligible("judge", ["judge"])).not.toThrow();
        expect(() => VotingRules.assertRoleEligible("participant", ["judge"])).toThrow(
            ForbiddenError,
        );
        expect(() => VotingRules.assertRoleEligible("organizer", ["organizer"])).not.toThrow();
    });

    it("requires participant approval only for the participant role", () => {
        expect(() => VotingRules.assertApprovedParticipant(true)).not.toThrow();
        expect(() => VotingRules.assertApprovedParticipant(false)).toThrow(ForbiddenError);
    });

    it("drops unknown and duplicate stored roles", () => {
        expect(normalizeEligibleRoles(["participant", "participant", "judge", "owner"])).toEqual([
            "participant",
            "judge",
        ]);
    });
});

describe("VotingRules.assertCanViewResults", () => {
    it("lets owners and organizers view any round", () => {
        for (const status of ["draft", "open", "closed", "published"] as const) {
            expect(() => VotingRules.assertCanViewResults(status, "owner")).not.toThrow();
            expect(() => VotingRules.assertCanViewResults(status, "organizer")).not.toThrow();
        }
    });

    it("lets other members view only published rounds", () => {
        expect(() => VotingRules.assertCanViewResults("published", "participant")).not.toThrow();
        expect(() => VotingRules.assertCanViewResults("published", "judge")).not.toThrow();
        expect(() => VotingRules.assertCanViewResults("closed", "participant")).toThrow(
            ForbiddenError,
        );
        expect(() => VotingRules.assertCanViewResults("draft", "judge")).toThrow(ForbiddenError);
    });
});

describe("VotingRules.isVotableSubmission", () => {
    it("accepts submitted, under review, changes requested, and accepted", () => {
        for (const status of [
            "submitted",
            "under_review",
            "changes_requested",
            "accepted",
        ] as const) {
            expect(VotingRules.isVotableSubmission(status)).toBe(true);
        }
    });

    it("rejects draft, rejected, disqualified, and withdrawn", () => {
        for (const status of ["draft", "rejected", "disqualified", "withdrawn"] as const) {
            expect(VotingRules.isVotableSubmission(status)).toBe(false);
        }
    });
});
