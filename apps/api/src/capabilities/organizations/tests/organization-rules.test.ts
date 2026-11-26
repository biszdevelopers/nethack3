import { describe, expect, it } from "vitest";
import { ConflictError, ForbiddenError } from "../../../core/errors.js";
import { OrganizationRules } from "../domain/organization-rules.js";

describe("OrganizationRules", () => {
    it("ranks roles from participant to owner", () => {
        expect(OrganizationRules.atLeast("owner", "organizer")).toBe(true);
        expect(OrganizationRules.atLeast("organizer", "judge")).toBe(true);
        expect(OrganizationRules.atLeast("judge", "participant")).toBe(true);
        expect(OrganizationRules.atLeast("participant", "judge")).toBe(false);
    });

    it("only allows owners to manage the organization", () => {
        expect(() => OrganizationRules.assertCanManage("owner")).not.toThrow();
        for (const role of ["organizer", "judge", "participant"] as const) {
            expect(() => OrganizationRules.assertCanManage(role)).toThrow(ForbiddenError);
        }
    });

    it("prevents removing or demoting the last owner", () => {
        expect(() => OrganizationRules.assertRoleChangeIsSafe("owner", "organizer", 1)).toThrow(
            ConflictError,
        );
        expect(() =>
            OrganizationRules.assertRoleChangeIsSafe("owner", "organizer", 2),
        ).not.toThrow();
        expect(() => OrganizationRules.assertRemovalIsSafe("owner", 1)).toThrow(ConflictError);
        expect(() => OrganizationRules.assertRemovalIsSafe("owner", 2)).not.toThrow();
        expect(() => OrganizationRules.assertRemovalIsSafe("participant", 1)).not.toThrow();
    });
});
