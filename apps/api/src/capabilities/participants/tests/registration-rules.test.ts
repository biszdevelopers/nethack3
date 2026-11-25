import { describe, expect, it } from "vitest";
import { ConflictError } from "../../../core/errors.js";
import { RegistrationRules, type RegistrationWindow } from "../domain/registration-rules.js";

const NOW = new Date("2026-06-15T12:00:00.000Z");

function window(overrides: Partial<RegistrationWindow> = {}): RegistrationWindow {
    return {
        status: "registration_open",
        registrationOpensAt: null,
        registrationClosesAt: null,
        ...overrides,
    };
}

describe("RegistrationRules.assertRegistrationOpen", () => {
    it("accepts registration while the status is open and dates are unbounded", () => {
        expect(() => RegistrationRules.assertRegistrationOpen(window(), NOW)).not.toThrow();
    });

    it("accepts registration inside the configured window", () => {
        expect(() =>
            RegistrationRules.assertRegistrationOpen(
                window({
                    registrationOpensAt: new Date("2026-06-01T00:00:00.000Z"),
                    registrationClosesAt: new Date("2026-06-30T00:00:00.000Z"),
                }),
                NOW,
            ),
        ).not.toThrow();
    });

    it("rejects registration before it opens", () => {
        expect(() =>
            RegistrationRules.assertRegistrationOpen(
                window({ registrationOpensAt: new Date("2026-07-01T00:00:00.000Z") }),
                NOW,
            ),
        ).toThrow(ConflictError);
    });

    it("rejects registration after it closes", () => {
        expect(() =>
            RegistrationRules.assertRegistrationOpen(
                window({ registrationClosesAt: new Date("2026-06-01T00:00:00.000Z") }),
                NOW,
            ),
        ).toThrow(ConflictError);
    });

    it("rejects registration when the edition status does not allow it", () => {
        expect(() =>
            RegistrationRules.assertRegistrationOpen(window({ status: "published" }), NOW),
        ).toThrow(ConflictError);
    });
});

describe("RegistrationRules.initialStatus", () => {
    it("creates a pending registration when capacity is available", () => {
        expect(RegistrationRules.initialStatus(10, 9)).toBe("pending");
        expect(RegistrationRules.initialStatus(null, 500)).toBe("pending");
    });

    it("creates a waitlisted registration when capacity is reached", () => {
        expect(RegistrationRules.initialStatus(10, 10)).toBe("waitlisted");
        expect(RegistrationRules.initialStatus(1, 1)).toBe("waitlisted");
    });
});

describe("RegistrationRules.assertCanDecide", () => {
    it("decides pending and waitlisted registrations", () => {
        expect(() => RegistrationRules.assertCanDecide("pending", "approved")).not.toThrow();
        expect(() => RegistrationRules.assertCanDecide("waitlisted", "rejected")).not.toThrow();
    });

    it("rejects deciding an approved registration twice", () => {
        expect(() => RegistrationRules.assertCanDecide("approved", "approved")).toThrow(
            ConflictError,
        );
        expect(() => RegistrationRules.assertCanDecide("approved", "rejected")).toThrow(
            ConflictError,
        );
    });

    it("rejects deciding a withdrawn registration", () => {
        expect(() => RegistrationRules.assertCanDecide("withdrawn", "approved")).toThrow(
            ConflictError,
        );
    });

    it("rejects deciding waitlisted as waitlisted again", () => {
        expect(() => RegistrationRules.assertCanDecide("waitlisted", "waitlisted")).toThrow(
            ConflictError,
        );
    });
});

describe("RegistrationRules.assertCapacity", () => {
    it("allows approval below the limit", () => {
        expect(() => RegistrationRules.assertCapacity(10, 9)).not.toThrow();
        expect(() => RegistrationRules.assertCapacity(null, 1000)).not.toThrow();
    });

    it("rejects approval at the limit", () => {
        expect(() => RegistrationRules.assertCapacity(10, 10)).toThrow(ConflictError);
    });
});

describe("RegistrationRules withdraw rules", () => {
    it("withdraws pending, approved, and waitlisted registrations", () => {
        for (const status of ["pending", "approved", "waitlisted"] as const) {
            expect(() => RegistrationRules.assertWithdrawable(status)).not.toThrow();
        }
    });

    it("rejects withdrawing decided registrations", () => {
        expect(() => RegistrationRules.assertWithdrawable("rejected")).toThrow(ConflictError);
        expect(() => RegistrationRules.assertWithdrawable("withdrawn")).toThrow(ConflictError);
    });

    it("rejects withdrawal while attached to a team", () => {
        expect(() =>
            RegistrationRules.assertNoTeam("3d0f2d0e-1111-4111-8111-111111111111"),
        ).toThrow(ConflictError);
        expect(() => RegistrationRules.assertNoTeam(null)).not.toThrow();
    });
});
