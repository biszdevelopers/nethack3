import { PROFILE_THEME_MAX_BYTES, profileThemeSchema } from "@nethack/contracts";
import { ValidationError } from "../../../core/errors.js";

const DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

/**
 * Re-validates an uploaded theme on the server. The client-declared MIME type
 * must match the file signature, and the decoded image must fit the 1 MB cap.
 * SVG is not accepted because it can carry script content.
 */
export function normalizeProfileTheme(input: string): string {
    const match = DATA_URL_PATTERN.exec(input);
    if (match === null) {
        throw new ValidationError("Profile theme images must be PNG, JPEG, or WebP data URLs.");
    }
    const mimeType = match[1] ?? "";
    const encoded = match[2] ?? "";
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.length === 0) {
        throw new ValidationError("The profile theme image is empty.");
    }
    if (bytes.length > PROFILE_THEME_MAX_BYTES) {
        throw new ValidationError("Profile theme images must be 1 MB or smaller.");
    }
    if (!matchesSignature(mimeType, bytes)) {
        throw new ValidationError("The profile theme image data does not match its file type.");
    }
    return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

/** Returns the stored theme only when it is a safe raster data URL. */
export function publicProfileTheme(theme: string | null): string | null {
    if (theme === null) {
        return null;
    }
    return profileThemeSchema.safeParse(theme).success ? theme : null;
}

function matchesSignature(mimeType: string, bytes: Buffer): boolean {
    switch (mimeType) {
        case "image/png":
            return (
                bytes.length >= 8 &&
                bytes[0] === 0x89 &&
                bytes[1] === 0x50 &&
                bytes[2] === 0x4e &&
                bytes[3] === 0x47 &&
                bytes[4] === 0x0d &&
                bytes[5] === 0x0a &&
                bytes[6] === 0x1a &&
                bytes[7] === 0x0a
            );
        case "image/jpeg":
            return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
        case "image/webp":
            return (
                bytes.length >= 12 &&
                bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
                bytes.subarray(8, 12).toString("ascii") === "WEBP"
            );
        default:
            return false;
    }
}
