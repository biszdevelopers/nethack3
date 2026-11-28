import { describe, expect, it } from "vitest";
import { ConflictError } from "../../../core/errors.js";
import { isOrganizerRole } from "../../../http/guards.js";
import { AdministrationRules } from "../domain/administration-rules.js";

describe("AdministrationRules.assertCanRevoke", () => {
    it("refuses to revoke the last global administrator", () => {
        expect(() => AdministrationRules.assertCanRevoke(1)).toThrow(ConflictError);
    });

    it("refuses when no administrator remains", () => {
        expect(() => AdministrationRules.assertCanRevoke(0)).toThrow(ConflictError);
    });

    it("allows revocation while another administrator remains", () => {
        expect(() => AdministrationRules.assertCanRevoke(2)).not.toThrow();
    });
});

describe("organization role guards", () => {
    it("permits owners and organizers", () => {
        expect(isOrganizerRole("owner")).toBe(true);
        expect(isOrganizerRole("organizer")).toBe(true);
    });

    it("rejects judges and participants", () => {
        expect(isOrganizerRole("judge")).toBe(false);
        expect(isOrganizerRole("participant")).toBe(false);
    });
});

describe("AdministrationRules submission guards", () => {
    it("refuses to reopen after a submitted evaluation", () => {
        expect(() => AdministrationRules.assertNoSubmittedEvaluations(1)).toThrow(ConflictError);
        expect(() => AdministrationRules.assertNoSubmittedEvaluations(0)).not.toThrow();
    });
});
