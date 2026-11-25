import { describe, expect, it } from "vitest";
import { ConflictError } from "../../../core/errors.js";
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
