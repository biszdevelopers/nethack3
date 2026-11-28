import { describe, expect, it } from "vitest";
import {
    assignAwardRequestSchema,
    createAwardRequestSchema,
    updateAwardRequestSchema,
} from "@nethack/contracts";

describe("award request validation", () => {
    it("accepts a valid award and applies defaults", () => {
        const parsed = createAwardRequestSchema.parse({
            namespace: "best-design",
            name: "Best design",
        });
        expect(parsed.description).toBe("");
        expect(parsed.icon).toBe("award");
        expect(parsed.color).toBe("gold");
    });

    it("rejects invalid keys, blank names, and unknown fields", () => {
        expect(
            createAwardRequestSchema.safeParse({ namespace: "Best Design", name: "Best" }).success,
        ).toBe(false);
        expect(
            createAwardRequestSchema.safeParse({ namespace: "-leading", name: "Best" }).success,
        ).toBe(false);
        expect(createAwardRequestSchema.safeParse({ namespace: "best", name: "   " }).success).toBe(
            false,
        );
        expect(
            createAwardRequestSchema.safeParse({
                namespace: "best",
                name: "Best",
                editionId: "unexpected",
            }).success,
        ).toBe(false);
    });

    it("requires at least one field when updating", () => {
        expect(updateAwardRequestSchema.safeParse({}).success).toBe(false);
        expect(updateAwardRequestSchema.safeParse({ name: "Best design" }).success).toBe(true);
    });

    it("defaults an assignment note to empty text", () => {
        expect(assignAwardRequestSchema.parse({}).note).toBe("");
        expect(assignAwardRequestSchema.safeParse({ note: "x".repeat(501) }).success).toBe(false);
    });
});
