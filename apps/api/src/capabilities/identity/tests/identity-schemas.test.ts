import { describe, expect, it } from "vitest";
import { callbackQuerySchema, loginQuerySchema } from "../domain/identity-schemas.js";

describe("identity request schemas", () => {
    it("accepts a login request without a return path", () => {
        expect(loginQuerySchema.parse({})).toEqual({});
    });

    it("accepts an internal return path and rejects oversized values", () => {
        expect(loginQuerySchema.parse({ returnTo: "/competitions" })).toEqual({
            returnTo: "/competitions",
        });
        expect(loginQuerySchema.safeParse({ returnTo: `/${"a".repeat(2048)}` }).success).toBe(
            false,
        );
    });

    it("accepts callback success and error payloads", () => {
        expect(callbackQuerySchema.parse({ code: "code", state: "state" })).toEqual({
            code: "code",
            state: "state",
        });
        expect(
            callbackQuerySchema.parse({ error: "access_denied", error_description: "Denied" }),
        ).toEqual({ error: "access_denied", error_description: "Denied" });
    });

    it("rejects oversized callback values", () => {
        expect(callbackQuerySchema.safeParse({ code: "a".repeat(4097) }).success).toBe(false);
        expect(callbackQuerySchema.safeParse({ state: "a".repeat(513) }).success).toBe(false);
        expect(callbackQuerySchema.safeParse({ error: "a".repeat(257) }).success).toBe(false);
        expect(callbackQuerySchema.safeParse({ error_description: "a".repeat(1025) }).success).toBe(
            false,
        );
    });
});
