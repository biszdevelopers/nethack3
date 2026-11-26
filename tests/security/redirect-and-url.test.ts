import { describe, expect, it } from "vitest";
import { normalizeReturnTo } from "../../apps/api/src/authentication/return-to.js";
import { httpUrlSchema } from "../../packages/contracts/src/common/schemas.js";

const WORKSPACE = "https://app.nethack.example";

describe("post-login redirect allowlist", () => {
    it("keeps relative workspace paths", () => {
        expect(normalizeReturnTo("/teams/abc?tab=members", WORKSPACE)).toBe(
            "/teams/abc?tab=members",
        );
    });

    it("defaults when no return target is supplied", () => {
        expect(normalizeReturnTo(null, WORKSPACE)).toBe("/");
        expect(normalizeReturnTo("   ", WORKSPACE)).toBe("/");
    });

    it("rejects protocol-relative redirects", () => {
        expect(normalizeReturnTo("//evil.example/steal", WORKSPACE)).toBe("/");
    });

    it("rejects absolute redirects to other origins", () => {
        expect(normalizeReturnTo("https://evil.example/path", WORKSPACE)).toBe("/");
        expect(normalizeReturnTo("http://app.nethack.example/path", WORKSPACE)).toBe("/");
    });

    it("rejects backslash path confusion", () => {
        expect(normalizeReturnTo("/\\evil.example", WORKSPACE)).toBe("/");
        expect(normalizeReturnTo("/%5c%5cevil.example", WORKSPACE)).not.toContain("evil");
    });

    it("accepts absolute workspace URLs and normalizes them to paths", () => {
        expect(normalizeReturnTo(`${WORKSPACE}/competitions/fall?x=1#top`, WORKSPACE)).toBe(
            "/competitions/fall?x=1#top",
        );
    });

    it("rejects malformed input", () => {
        expect(normalizeReturnTo("not a url", WORKSPACE)).toBe("/");
    });
});

describe("external URL validation", () => {
    it("accepts http and https", () => {
        expect(httpUrlSchema.safeParse("https://example.com/repo").success).toBe(true);
        expect(httpUrlSchema.safeParse("http://example.com").success).toBe(true);
    });

    it("rejects non-web schemes", () => {
        for (const value of [
            "javascript:alert(1)",
            "data:text/html;base64,abc",
            "file:///etc/passwd",
            "ftp://example.com",
        ]) {
            expect(httpUrlSchema.safeParse(value).success, value).toBe(false);
        }
    });
});
