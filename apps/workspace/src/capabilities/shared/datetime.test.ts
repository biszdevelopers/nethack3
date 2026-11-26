import { describe, expect, it } from "vitest";
import { isoToLocalInput, localInputToIso } from "./datetime.js";

describe("datetime input conversion", () => {
    it("converts an empty value to null", () => {
        expect(localInputToIso("")).toBeNull();
        expect(localInputToIso("   ")).toBeNull();
    });

    it("rejects an unparseable value", () => {
        expect(localInputToIso("not-a-date")).toBeNull();
    });

    it("round-trips a local datetime input", () => {
        const value = "2026-01-15T10:30";
        const iso = localInputToIso(value);
        expect(iso).not.toBeNull();
        expect(isoToLocalInput(iso)).toBe(value);
    });

    it("returns an empty string for missing values", () => {
        expect(isoToLocalInput(null)).toBe("");
        expect(isoToLocalInput("not-a-date")).toBe("");
    });
});
