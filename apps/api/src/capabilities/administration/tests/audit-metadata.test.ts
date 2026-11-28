import { describe, expect, it } from "vitest";
import { isSensitiveAuditKey, redactAuditMetadata } from "../application/audit-metadata.js";

describe("isSensitiveAuditKey", () => {
    it("matches credential key names regardless of case and separators", () => {
        expect(isSensitiveAuditKey("password")).toBe(true);
        expect(isSensitiveAuditKey("accessToken")).toBe(true);
        expect(isSensitiveAuditKey("refresh_token")).toBe(true);
        expect(isSensitiveAuditKey("clientSecret")).toBe(true);
        expect(isSensitiveAuditKey("Authorization")).toBe(true);
        expect(isSensitiveAuditKey("Set-Cookie")).toBe(true);
    });

    it("keeps ordinary audit fields readable", () => {
        expect(isSensitiveAuditKey("reason")).toBe(false);
        expect(isSensitiveAuditKey("status")).toBe(false);
        expect(isSensitiveAuditKey("emailSentAt")).toBe(false);
        expect(isSensitiveAuditKey("displayName")).toBe(false);
    });
});

describe("redactAuditMetadata", () => {
    it("redacts nested credentials and preserves readable fields", () => {
        const redacted = redactAuditMetadata({
            reason: "rotated integration credentials",
            before: { status: "draft", tokenHash: "abc123" },
            after: { status: "active", nested: { authorization: "Bearer x", note: "ok" } },
            cookie: "session=raw",
            passwordHash: "hash",
            safe: ["token", "kept"],
        });

        expect(redacted.reason).toBe("rotated integration credentials");
        expect(redacted.cookie).toBe("[redacted]");
        expect(redacted.passwordHash).toBe("[redacted]");
        expect(redacted.before).toEqual({ status: "draft", tokenHash: "[redacted]" });
        expect(redacted.after).toEqual({
            status: "active",
            nested: { authorization: "[redacted]", note: "ok" },
        });
        expect(redacted.safe).toEqual(["token", "kept"]);
    });

    it("redacts binary values and keeps the top-level record shape", () => {
        expect(redactAuditMetadata(new Uint8Array([1, 2, 3]))).toEqual({});
        expect(redactAuditMetadata({ file: new Uint8Array([1]) })).toEqual({
            file: "[redacted]",
        });
    });

    it("survives cyclic objects without leaking their contents", () => {
        const metadata: Record<string, unknown> = { reason: "cycle" };
        metadata.self = metadata;

        expect(redactAuditMetadata(metadata)).toEqual({
            reason: "cycle",
            self: "[redacted]",
        });
    });
});
