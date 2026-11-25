import { describe, expect, it } from "vitest";
import {
    contentDispositionFor,
    inspectFileUpload,
    sanitizeFileName,
    type FileInspectionResult,
} from "../domain/file-inspector.js";

interface ZipEntrySpec {
    readonly name: string;
    readonly data?: Buffer;
    readonly flags?: number;
    readonly localFlags?: number;
    readonly method?: number;
    readonly compressedSize?: number;
    readonly uncompressedSize?: number;
}

function buildZip(entries: readonly ZipEntrySpec[]): Buffer {
    const localParts: Buffer[] = [];
    const centralParts: Buffer[] = [];
    let offset = 0;

    for (const entry of entries) {
        const name = Buffer.from(entry.name, "utf8");
        const data = entry.data ?? Buffer.alloc(0);
        const flags = entry.flags ?? 0;
        const method = entry.method ?? 0;
        const compressedSize = entry.compressedSize ?? data.length;
        const uncompressedSize = entry.uncompressedSize ?? data.length;
        const descriptor = (flags & 0x0008) !== 0;

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(entry.localFlags ?? flags, 6);
        local.writeUInt16LE(method, 8);
        local.writeUInt16LE(0, 10);
        local.writeUInt16LE(0, 12);
        local.writeUInt32LE(descriptor ? 0 : 0, 14);
        local.writeUInt32LE(descriptor ? 0 : compressedSize, 18);
        local.writeUInt32LE(descriptor ? 0 : uncompressedSize, 22);
        local.writeUInt16LE(name.length, 26);
        local.writeUInt16LE(0, 28);
        localParts.push(local, name, data);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(flags, 8);
        central.writeUInt16LE(method, 10);
        central.writeUInt16LE(0, 12);
        central.writeUInt16LE(0, 14);
        central.writeUInt32LE(0, 16);
        central.writeUInt32LE(compressedSize, 20);
        central.writeUInt32LE(uncompressedSize, 24);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt16LE(0, 30);
        central.writeUInt16LE(0, 32);
        central.writeUInt16LE(0, 34);
        central.writeUInt16LE(0, 36);
        central.writeUInt32LE(0, 38);
        central.writeUInt32LE(offset, 42);
        centralParts.push(central, name);

        offset += 30 + name.length + data.length;
    }

    const centralDirectory = Buffer.concat(centralParts);
    const endOfCentralDirectory = Buffer.alloc(22);
    endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
    endOfCentralDirectory.writeUInt16LE(0, 4);
    endOfCentralDirectory.writeUInt16LE(0, 6);
    endOfCentralDirectory.writeUInt16LE(entries.length, 8);
    endOfCentralDirectory.writeUInt16LE(entries.length, 10);
    endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
    endOfCentralDirectory.writeUInt32LE(offset, 16);
    endOfCentralDirectory.writeUInt16LE(0, 20);
    return Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory]);
}

function acceptedType(result: FileInspectionResult): string | null {
    return result.ok ? result.contentType : null;
}

function rejectionCode(result: FileInspectionResult): string | null {
    return result.ok ? null : result.code;
}

function inspect(buffer: Buffer, fileName = "upload.bin"): FileInspectionResult {
    return inspectFileUpload({ buffer, fileName });
}

describe("file signature detection", () => {
    it("accepts a PNG", () => {
        const png = Buffer.concat([
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
            Buffer.from("image-data"),
        ]);
        expect(acceptedType(inspect(png, "logo.png"))).toBe("image/png");
    });

    it("accepts a JPEG", () => {
        const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
        expect(acceptedType(inspect(jpeg, "photo.jpg"))).toBe("image/jpeg");
    });

    it("accepts a GIF", () => {
        expect(acceptedType(inspect(Buffer.from("GIF89a-data"), "loop.gif"))).toBe("image/gif");
    });

    it("accepts a WebP", () => {
        const webp = Buffer.concat([
            Buffer.from("RIFF"),
            Buffer.from([0x1a, 0x00, 0x00, 0x00]),
            Buffer.from("WEBPVP8 "),
            Buffer.from("data"),
        ]);
        expect(acceptedType(inspect(webp, "picture.webp"))).toBe("image/webp");
    });

    it("accepts a PDF", () => {
        expect(acceptedType(inspect(Buffer.from("%PDF-1.7\n1 0 obj\n"), "rules.pdf"))).toBe(
            "application/pdf",
        );
    });

    it("accepts plain text", () => {
        expect(acceptedType(inspect(Buffer.from("Hello, world!\n"), "notes.txt"))).toBe(
            "text/plain",
        );
    });

    it("accepts a ZIP archive with safe entries", () => {
        const zip = buildZip([
            { name: "src/index.ts", data: Buffer.from("export const value = 1;\n") },
            { name: "README.txt", data: Buffer.from("hello\n") },
        ]);
        expect(acceptedType(inspect(zip, "source.zip"))).toBe("application/zip");
    });

    it("rejects SVG", () => {
        const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>');
        expect(rejectionCode(inspect(svg, "logo.svg"))).toBe("unsupported_media_type");
    });

    it("rejects HTML", () => {
        const html = Buffer.from("<!doctype html><html><body>hi</body></html>");
        expect(rejectionCode(inspect(html, "page.html"))).toBe("unsupported_media_type");
    });

    it("rejects a Windows executable", () => {
        const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
        expect(rejectionCode(inspect(exe, "setup.exe"))).toBe("unsupported_media_type");
    });

    it("rejects an ELF executable", () => {
        const elf = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);
        expect(rejectionCode(inspect(elf, "binary"))).toBe("unsupported_media_type");
    });

    it("rejects an executable script", () => {
        expect(rejectionCode(inspect(Buffer.from("#!/bin/sh\nrm -rf /\n"), "run.sh"))).toBe(
            "unsupported_media_type",
        );
    });

    it("rejects an empty file", () => {
        expect(rejectionCode(inspect(Buffer.alloc(0), "empty.txt"))).toBe("validation_error");
    });
});

describe("ZIP inspection", () => {
    it("rejects parent directory traversal", () => {
        const zip = buildZip([{ name: "../../evil.txt", data: Buffer.from("x") }]);
        expect(rejectionCode(inspect(zip, "archive.zip"))).toBe("validation_error");
    });

    it("rejects absolute entry names", () => {
        const zip = buildZip([{ name: "/etc/passwd", data: Buffer.from("x") }]);
        expect(rejectionCode(inspect(zip, "archive.zip"))).toBe("validation_error");
    });

    it("rejects Windows path separators", () => {
        const zip = buildZip([{ name: "folder\\evil.txt", data: Buffer.from("x") }]);
        expect(rejectionCode(inspect(zip, "archive.zip"))).toBe("validation_error");
    });

    it("rejects encrypted entries", () => {
        const zip = buildZip([{ name: "secret.txt", data: Buffer.from("x"), flags: 0x0001 }]);
        expect(rejectionCode(inspect(zip, "archive.zip"))).toBe("validation_error");
    });

    it("rejects more than 200 entries", () => {
        const entries: ZipEntrySpec[] = [];
        for (let index = 0; index < 201; index += 1) {
            entries.push({ name: `file-${index}.txt`, data: Buffer.alloc(0) });
        }
        expect(rejectionCode(inspect(buildZip(entries), "archive.zip"))).toBe("validation_error");
    });

    it("accepts exactly 200 entries", () => {
        const entries: ZipEntrySpec[] = [];
        for (let index = 0; index < 200; index += 1) {
            entries.push({ name: `file-${index}.txt`, data: Buffer.alloc(0) });
        }
        expect(acceptedType(inspect(buildZip(entries), "archive.zip"))).toBe("application/zip");
    });

    it("rejects a decompression bomb ratio", () => {
        const zip = buildZip([
            {
                name: "bomb.txt",
                data: Buffer.alloc(1024),
                compressedSize: 1024,
                uncompressedSize: 10 * 1024 * 1024,
            },
        ]);
        expect(rejectionCode(inspect(zip, "archive.zip"))).toBe("validation_error");
    });

    it("rejects an entry that expands beyond the total limit", () => {
        const zip = buildZip([
            {
                name: "huge.txt",
                data: Buffer.alloc(1024),
                compressedSize: 1024,
                uncompressedSize: 201 * 1024 * 1024,
            },
        ]);
        expect(rejectionCode(inspect(zip, "archive.zip"))).toBe("validation_error");
    });

    it("rejects Office documents packaged as ZIP", () => {
        const zip = buildZip([
            { name: "[Content_Types].xml", data: Buffer.from("<Types/>") },
            { name: "word/document.xml", data: Buffer.from("<document/>") },
        ]);
        expect(rejectionCode(inspect(zip, "report.docx"))).toBe("validation_error");
    });

    it("rejects inconsistent data descriptors", () => {
        const zip = buildZip([
            {
                name: "file.txt",
                data: Buffer.from("x"),
                flags: 0,
                localFlags: 0x0008,
            },
        ]);
        expect(rejectionCode(inspect(zip, "archive.zip"))).toBe("validation_error");
    });

    it("rejects a truncated archive", () => {
        const zip = buildZip([{ name: "file.txt", data: Buffer.from("x") }]);
        expect(rejectionCode(inspect(zip.subarray(0, zip.length - 4), "archive.zip"))).toBe(
            "validation_error",
        );
    });
});

describe("file names", () => {
    it("strips path components", () => {
        expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
        expect(sanitizeFileName("C:\\Users\\name\\report.pdf")).toBe("report.pdf");
    });

    it("strips control characters and unsafe symbols", () => {
        expect(sanitizeFileName("evil\u0000\u001f:name?.txt")).toBe("evil_name_.txt");
    });

    it("limits names to 200 characters", () => {
        expect(sanitizeFileName(`${"a".repeat(300)}.txt`).length).toBe(200);
    });

    it("rejects empty names", () => {
        expect(rejectionCode(inspect(Buffer.from("hello"), "   "))).toBe("validation_error");
        expect(rejectionCode(inspect(Buffer.from("hello"), ".."))).toBe("validation_error");
    });

    it("builds an attachment content disposition", () => {
        const header = contentDispositionFor("report final.pdf");
        expect(header.startsWith("attachment; ")).toBe(true);
        expect(header).toContain('filename="report final.pdf"');
        expect(header).toContain("filename*=UTF-8''report%20final.pdf");
    });
});
