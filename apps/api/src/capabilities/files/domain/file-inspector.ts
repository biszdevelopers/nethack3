import { uploadConstraints } from "@nethack/contracts";
import { inspectZip } from "./zip-inspector.js";

export type AllowedContentType = (typeof uploadConstraints.allowedContentTypes)[number];

export interface FileInspectionInput {
    readonly buffer: Buffer;
    readonly fileName: string;
    /**
     * Deliberately informational only. The detected signature is authoritative,
     * so a client cannot choose how its upload is stored or served.
     */
    readonly declaredContentType?: string;
}

export type FileInspectionResult =
    | {
          readonly ok: true;
          readonly fileName: string;
          readonly contentType: AllowedContentType;
          readonly extension: string;
      }
    | {
          readonly ok: false;
          readonly code: "validation_error" | "unsupported_media_type";
          readonly message: string;
      };

export const MAX_UPLOAD_BYTES = uploadConstraints.maxBytes;

const EXTENSION_BY_CONTENT_TYPE: Record<AllowedContentType, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "application/pdf": "pdf",
    "application/zip": "zip",
    "text/plain": "txt",
};

const ALLOWED_CONTENT_TYPES = new Set<string>(uploadConstraints.allowedContentTypes);
const UNSAFE_FILE_NAME_CHARACTERS = /["<>:|?*]/g;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

export function inspectFileUpload(input: FileInspectionInput): FileInspectionResult {
    const fileName = sanitizeFileName(input.fileName);
    if (fileName.length === 0 || fileName === "." || fileName === "..") {
        return failure("validation_error", "The file name is invalid.");
    }
    if (input.buffer.length === 0) {
        return failure("validation_error", "The file is empty.");
    }
    const contentType = detectContentType(input.buffer);
    if (contentType === null || !ALLOWED_CONTENT_TYPES.has(contentType)) {
        return failure("unsupported_media_type", "That file type is not supported.");
    }
    if (contentType === "application/zip") {
        const archive = inspectZip(input.buffer);
        if (!archive.ok) {
            return failure("validation_error", archive.message);
        }
    }
    return {
        ok: true,
        fileName,
        contentType,
        extension: EXTENSION_BY_CONTENT_TYPE[contentType],
    };
}

export function sanitizeFileName(raw: string): string {
    const base = raw.split(/[\\/]/).pop() ?? "";
    const cleaned = Array.from(base)
        .filter((character) => !isUnsafeCharacter(character.codePointAt(0) ?? 0))
        .join("")
        .replace(UNSAFE_FILE_NAME_CHARACTERS, "_")
        .trim();
    return Array.from(cleaned).slice(0, 200).join("").trim();
}

export function contentDispositionFor(fileName: string): string {
    const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
    const encoded = encodeURIComponent(fileName).replace(
        /['()*]/g,
        (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );
    return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

function detectContentType(buffer: Buffer): AllowedContentType | null {
    if (startsWith(buffer, PNG_SIGNATURE)) {
        return "image/png";
    }
    if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
        return "image/jpeg";
    }
    if (buffer.length >= 6) {
        const gif = buffer.toString("ascii", 0, 6);
        if (gif === "GIF87a" || gif === "GIF89a") {
            return "image/gif";
        }
    }
    if (
        buffer.length >= 12 &&
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP"
    ) {
        return "image/webp";
    }
    if (buffer.length >= 5 && buffer.toString("ascii", 0, 5) === "%PDF-") {
        return "application/pdf";
    }
    if (isZipSignature(buffer)) {
        return "application/zip";
    }
    if (isExecutable(buffer)) {
        return null;
    }
    if (isPlainText(buffer)) {
        return "text/plain";
    }
    return null;
}

function isZipSignature(buffer: Buffer): boolean {
    return (
        startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]) ||
        startsWith(buffer, [0x50, 0x4b, 0x05, 0x06]) ||
        startsWith(buffer, [0x50, 0x4b, 0x07, 0x08])
    );
}

function isExecutable(buffer: Buffer): boolean {
    return (
        startsWith(buffer, [0x4d, 0x5a]) ||
        startsWith(buffer, [0x7f, 0x45, 0x4c, 0x46]) ||
        startsWith(buffer, [0xfe, 0xed, 0xfa, 0xce]) ||
        startsWith(buffer, [0xfe, 0xed, 0xfa, 0xcf]) ||
        startsWith(buffer, [0xce, 0xfa, 0xed, 0xfe]) ||
        startsWith(buffer, [0xcf, 0xfa, 0xed, 0xfe]) ||
        startsWith(buffer, [0xca, 0xfe, 0xba, 0xbe]) ||
        (buffer.length >= 2 && buffer.toString("ascii", 0, 2) === "#!")
    );
}

function isPlainText(buffer: Buffer): boolean {
    if (buffer.includes(0)) {
        return false;
    }
    let text: string;
    try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
        return false;
    }
    const head = text
        .replace(/^\uFEFF/, "")
        .trimStart()
        .toLowerCase();
    if (head.startsWith("<")) {
        return false;
    }
    return true;
}

function isUnsafeCharacter(codePoint: number): boolean {
    return (
        codePoint <= 0x1f ||
        (codePoint >= 0x7f && codePoint <= 0x9f) ||
        (codePoint >= 0x202a && codePoint <= 0x202e) ||
        (codePoint >= 0x2066 && codePoint <= 0x2069)
    );
}

function startsWith(buffer: Buffer, signature: readonly number[]): boolean {
    if (buffer.length < signature.length) {
        return false;
    }
    for (let index = 0; index < signature.length; index += 1) {
        if (buffer[index] !== signature[index]) {
            return false;
        }
    }
    return true;
}

function failure(
    code: "validation_error" | "unsupported_media_type",
    message: string,
): FileInspectionResult {
    return { ok: false, code, message };
}
