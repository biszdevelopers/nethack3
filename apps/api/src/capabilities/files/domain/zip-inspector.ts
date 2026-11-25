const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const MAX_ENTRIES = 200;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 200;
const SUPPORTED_COMPRESSION_METHODS = new Set([0, 8]);
const OFFICE_ENTRY_NAMES = new Set([
    "[content_types].xml",
    "mimetype",
    "word/document.xml",
    "xl/workbook.xml",
    "ppt/presentation.xml",
]);

export type ZipInspectionResult =
    | {
          readonly ok: true;
          readonly entryCount: number;
          readonly totalUncompressedBytes: number;
      }
    | ZipFailure;

interface ZipFailure {
    readonly ok: false;
    readonly message: string;
}

/**
 * Parses the central directory without inflating any entry. Every limit is
 * checked from header metadata, so a decompression bomb is rejected before a
 * byte of compressed data is processed.
 */
export function inspectZip(buffer: Buffer): ZipInspectionResult {
    const endOfCentralDirectory = findEndOfCentralDirectory(buffer);
    if (endOfCentralDirectory === null) {
        return failure("The archive is not a valid ZIP file.");
    }

    const diskNumber = readUInt16(buffer, endOfCentralDirectory + 4);
    const centralDirectoryDisk = readUInt16(buffer, endOfCentralDirectory + 6);
    const entriesOnDisk = readUInt16(buffer, endOfCentralDirectory + 8);
    const entryCount = readUInt16(buffer, endOfCentralDirectory + 10);
    const centralDirectorySize = readUInt32(buffer, endOfCentralDirectory + 12);
    const centralDirectoryOffset = readUInt32(buffer, endOfCentralDirectory + 16);
    const commentLength = readUInt16(buffer, endOfCentralDirectory + 20);
    if (
        diskNumber === null ||
        centralDirectoryDisk === null ||
        entriesOnDisk === null ||
        entryCount === null ||
        centralDirectorySize === null ||
        centralDirectoryOffset === null ||
        commentLength === null
    ) {
        return failure("The archive is truncated.");
    }
    if (endOfCentralDirectory + 22 + commentLength !== buffer.length) {
        return failure("The archive has trailing data after the central directory.");
    }
    if (diskNumber !== 0 || centralDirectoryDisk !== 0 || entriesOnDisk !== entryCount) {
        return failure("Multi-volume ZIP archives are not supported.");
    }
    if (
        entryCount === 0xffff ||
        centralDirectorySize === 0xffffffff ||
        centralDirectoryOffset === 0xffffffff
    ) {
        return failure("ZIP64 archives are not supported.");
    }
    if (entryCount > MAX_ENTRIES) {
        return failure("The archive contains too many entries.");
    }
    if (centralDirectoryOffset + centralDirectorySize !== endOfCentralDirectory) {
        return failure("The archive central directory is inconsistent.");
    }

    let offset = centralDirectoryOffset;
    let totalUncompressedBytes = 0;

    for (let index = 0; index < entryCount; index += 1) {
        const signature = readUInt32(buffer, offset);
        const flags = readUInt16(buffer, offset + 8);
        const method = readUInt16(buffer, offset + 10);
        const crc = readUInt32(buffer, offset + 16);
        const compressedSize = readUInt32(buffer, offset + 20);
        const uncompressedSize = readUInt32(buffer, offset + 24);
        const nameLength = readUInt16(buffer, offset + 28);
        const extraLength = readUInt16(buffer, offset + 30);
        const commentBytes = readUInt16(buffer, offset + 32);
        const localOffset = readUInt32(buffer, offset + 42);
        if (
            signature === null ||
            flags === null ||
            method === null ||
            crc === null ||
            compressedSize === null ||
            uncompressedSize === null ||
            nameLength === null ||
            extraLength === null ||
            commentBytes === null ||
            localOffset === null
        ) {
            return failure("The archive central directory is truncated.");
        }
        if (signature !== CENTRAL_DIRECTORY_SIGNATURE) {
            return failure("The archive central directory entry is invalid.");
        }
        if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
            return failure("ZIP64 archives are not supported.");
        }
        const nextOffset = offset + 46 + nameLength + extraLength + commentBytes;
        if (nextOffset > endOfCentralDirectory) {
            return failure("The archive central directory entry is truncated.");
        }
        const name = decodeEntryName(buffer, offset + 46, nameLength);
        if (name === null) {
            return failure("The archive contains an invalid entry name.");
        }
        const nameProblem = validateEntryName(name);
        if (nameProblem !== null) {
            return nameProblem;
        }
        if ((flags & 0x0001) !== 0) {
            return failure("Encrypted ZIP archives are not supported.");
        }
        if (!SUPPORTED_COMPRESSION_METHODS.has(method)) {
            return failure("The archive uses an unsupported compression method.");
        }
        if (uncompressedSize > MAX_TOTAL_UNCOMPRESSED_BYTES) {
            return failure("The archive expands beyond the allowed size.");
        }
        totalUncompressedBytes += uncompressedSize;
        if (totalUncompressedBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
            return failure("The archive expands beyond the allowed size.");
        }
        if (compressedSize === 0) {
            if (uncompressedSize > 0) {
                return failure("The archive entry has an implausible compression ratio.");
            }
        } else if (uncompressedSize > compressedSize * MAX_COMPRESSION_RATIO) {
            return failure("The archive entry has an implausible compression ratio.");
        }

        const localProblem = inspectLocalHeader(buffer, {
            localOffset,
            centralDirectoryOffset,
            name,
            flags,
            method,
            crc,
            compressedSize,
            uncompressedSize,
        });
        if (localProblem !== null) {
            return localProblem;
        }

        offset = nextOffset;
    }

    if (offset !== centralDirectoryOffset + centralDirectorySize) {
        return failure("The archive central directory is inconsistent.");
    }
    return { ok: true, entryCount, totalUncompressedBytes };
}

function inspectLocalHeader(
    buffer: Buffer,
    entry: {
        localOffset: number;
        centralDirectoryOffset: number;
        name: string;
        flags: number;
        method: number;
        crc: number;
        compressedSize: number;
        uncompressedSize: number;
    },
): ZipFailure | null {
    const signature = readUInt32(buffer, entry.localOffset);
    const flags = readUInt16(buffer, entry.localOffset + 6);
    const method = readUInt16(buffer, entry.localOffset + 8);
    const crc = readUInt32(buffer, entry.localOffset + 14);
    const compressedSize = readUInt32(buffer, entry.localOffset + 18);
    const uncompressedSize = readUInt32(buffer, entry.localOffset + 22);
    const nameLength = readUInt16(buffer, entry.localOffset + 26);
    const extraLength = readUInt16(buffer, entry.localOffset + 28);
    if (
        signature === null ||
        flags === null ||
        method === null ||
        crc === null ||
        compressedSize === null ||
        uncompressedSize === null ||
        nameLength === null ||
        extraLength === null
    ) {
        return failure("The archive local header is truncated.");
    }
    if (signature !== LOCAL_FILE_HEADER_SIGNATURE) {
        return failure("The archive local header is invalid.");
    }
    if ((flags & 0x0001) !== 0) {
        return failure("Encrypted ZIP archives are not supported.");
    }
    if (method !== entry.method) {
        return failure("The archive local header is inconsistent.");
    }
    const dataOffset = entry.localOffset + 30 + nameLength + extraLength;
    if (dataOffset + entry.compressedSize > entry.centralDirectoryOffset) {
        return failure("The archive entry overlaps the central directory.");
    }
    const localName = buffer.subarray(entry.localOffset + 30, entry.localOffset + 30 + nameLength);
    if (!localName.equals(Buffer.from(entry.name, "utf8"))) {
        return failure("The archive entry name is inconsistent.");
    }

    const hasDataDescriptor = (entry.flags & 0x0008) !== 0;
    const localHasDataDescriptor = (flags & 0x0008) !== 0;
    if (hasDataDescriptor !== localHasDataDescriptor) {
        return failure("The archive data descriptor is inconsistent.");
    }
    if (!hasDataDescriptor) {
        if (
            crc !== entry.crc ||
            compressedSize !== entry.compressedSize ||
            uncompressedSize !== entry.uncompressedSize
        ) {
            return failure("The archive local header is inconsistent.");
        }
    } else if (
        crc !== 0 ||
        (compressedSize !== 0 && compressedSize !== entry.compressedSize) ||
        (uncompressedSize !== 0 && uncompressedSize !== entry.uncompressedSize)
    ) {
        return failure("The archive data descriptor is inconsistent.");
    }
    return null;
}

function validateEntryName(name: string): ZipFailure | null {
    if (name.length === 0 || name.includes("\\") || name.includes("\u0000")) {
        return failure("The archive contains an unsafe entry name.");
    }
    if (name.startsWith("/") || /^[A-Za-z]:/.test(name)) {
        return failure("The archive contains an absolute entry path.");
    }
    const segments = name.split("/");
    if (segments.some((segment) => segment === "..")) {
        return failure("The archive contains a traversal entry path.");
    }
    if (OFFICE_ENTRY_NAMES.has(name.toLowerCase())) {
        return failure("Office documents are not supported.");
    }
    return null;
}

function decodeEntryName(buffer: Buffer, offset: number, length: number): string | null {
    try {
        return new TextDecoder("utf-8", { fatal: true }).decode(
            buffer.subarray(offset, offset + length),
        );
    } catch {
        return null;
    }
}

function findEndOfCentralDirectory(buffer: Buffer): number | null {
    if (buffer.length < 22) {
        return null;
    }
    const earliest = Math.max(0, buffer.length - 22 - 0xffff);
    for (let offset = buffer.length - 22; offset >= earliest; offset -= 1) {
        if (readUInt32(buffer, offset) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
            return offset;
        }
    }
    return null;
}

function readUInt16(buffer: Buffer, offset: number): number | null {
    if (offset < 0 || offset + 2 > buffer.length) {
        return null;
    }
    return buffer.readUInt16LE(offset);
}

function readUInt32(buffer: Buffer, offset: number): number | null {
    if (offset < 0 || offset + 4 > buffer.length) {
        return null;
    }
    return buffer.readUInt32LE(offset);
}

function failure(message: string): ZipFailure {
    return { ok: false, message };
}
