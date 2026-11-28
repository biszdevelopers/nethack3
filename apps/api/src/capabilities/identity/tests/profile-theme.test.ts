import { describe, expect, it } from "vitest";
import { PROFILE_THEME_MAX_BYTES } from "@nethack/contracts";
import { ValidationError } from "../../../core/errors.js";
import { normalizeProfileTheme, publicProfileTheme } from "../domain/profile-theme.js";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const WEBP_SIGNATURE = Buffer.concat([
    Buffer.from("RIFF", "ascii"),
    Buffer.from([0x20, 0x00, 0x00, 0x00]),
    Buffer.from("WEBP", "ascii"),
]);

function dataUrl(mimeType: string, bytes: Buffer): string {
    return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

describe("profile theme validation", () => {
    it("accepts PNG, JPEG, and WebP images", () => {
        expect(normalizeProfileTheme(dataUrl("image/png", PNG_SIGNATURE))).toBe(
            dataUrl("image/png", PNG_SIGNATURE),
        );
        expect(normalizeProfileTheme(dataUrl("image/jpeg", JPEG_SIGNATURE))).toBe(
            dataUrl("image/jpeg", JPEG_SIGNATURE),
        );
        expect(normalizeProfileTheme(dataUrl("image/webp", WEBP_SIGNATURE))).toBe(
            dataUrl("image/webp", WEBP_SIGNATURE),
        );
    });

    it("rejects SVG data URLs", () => {
        const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
        expect(() => normalizeProfileTheme(dataUrl("image/svg+xml", svg))).toThrow(ValidationError);
        expect(() => normalizeProfileTheme(dataUrl("image/png", svg))).toThrow(ValidationError);
    });

    it("rejects a file whose data does not match its declared type", () => {
        expect(() => normalizeProfileTheme(dataUrl("image/jpeg", PNG_SIGNATURE))).toThrow(
            ValidationError,
        );
        expect(() => normalizeProfileTheme(dataUrl("image/png", WEBP_SIGNATURE))).toThrow(
            ValidationError,
        );
    });

    it("rejects images over the 1 MB limit", () => {
        const oversized = Buffer.alloc(PROFILE_THEME_MAX_BYTES + 1);
        PNG_SIGNATURE.copy(oversized);
        expect(() => normalizeProfileTheme(dataUrl("image/png", oversized))).toThrow(
            ValidationError,
        );
    });

    it("rejects malformed and empty payloads", () => {
        expect(() => normalizeProfileTheme("https://example.com/theme.png")).toThrow(
            ValidationError,
        );
        expect(() => normalizeProfileTheme("data:image/png;base64,")).toThrow(ValidationError);
        expect(() => normalizeProfileTheme("data:image/png;base64,!!!")).toThrow(ValidationError);
    });
});

describe("public profile theme", () => {
    it("returns a stored safe data URL", () => {
        expect(publicProfileTheme(dataUrl("image/png", PNG_SIGNATURE))).toBe(
            dataUrl("image/png", PNG_SIGNATURE),
        );
    });

    it("drops values that are not safe raster data URLs", () => {
        expect(publicProfileTheme(null)).toBeNull();
        expect(publicProfileTheme("https://example.com/theme.png")).toBeNull();
        expect(publicProfileTheme("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=")).toBeNull();
    });
});
