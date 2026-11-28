import { describe, expect, it } from "vitest";
import type { CompetitionEditionStatus } from "@nethack/contracts";
import { ConflictError } from "../../../core/errors.js";
import { JudgingRules } from "../domain/judging-rules.js";

describe("JudgingRules.assertEditionWritable", () => {
    const writable: readonly CompetitionEditionStatus[] = [
        "draft",
        "published",
        "registration_open",
        "registration_closed",
        "active",
        "judging",
        "voting",
    ];
    const frozen: readonly CompetitionEditionStatus[] = ["completed", "archived"];

    it.each(writable)("allows evaluation while the edition is %s", (status) => {
        expect(() => JudgingRules.assertEditionWritable(status)).not.toThrow();
    });

    it.each(frozen)("rejects evaluation while the edition is %s", (status) => {
        expect(() => JudgingRules.assertEditionWritable(status)).toThrow(ConflictError);
    });
});
