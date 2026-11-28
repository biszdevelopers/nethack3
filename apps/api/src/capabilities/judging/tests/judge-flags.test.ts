import { describe, expect, it } from "vitest";
import type { JudgeAssignmentStatus, JudgeFlagStatus } from "@nethack/contracts";
import { ConflictError } from "../../../core/errors.js";
import { JudgeFlagRules } from "../domain/judge-flags.js";

describe("JudgeFlagRules.assertCanFlag", () => {
    const allowed: readonly JudgeAssignmentStatus[] = ["assigned", "in_progress", "submitted"];
    const blocked: readonly JudgeAssignmentStatus[] = ["conflict_declared", "revoked"];

    it.each(allowed)("allows a flag from %s", (status) => {
        expect(() => JudgeFlagRules.assertCanFlag(status)).not.toThrow();
    });

    it.each(blocked)("blocks a flag from %s", (status) => {
        expect(() => JudgeFlagRules.assertCanFlag(status)).toThrow(ConflictError);
    });
});

describe("JudgeFlagRules.resolution", () => {
    it("resolves an open flag", () => {
        expect(JudgeFlagRules.resolution("open")).toBe("resolved");
    });

    it("keeps a resolved flag resolved", () => {
        const status: JudgeFlagStatus = "resolved";
        expect(JudgeFlagRules.resolution(status)).toBeNull();
    });
});
