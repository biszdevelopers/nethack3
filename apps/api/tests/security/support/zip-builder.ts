export interface ZipEntryInput {
    readonly name: string;
    readonly data?: Buffer;
}

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const STORED_METHOD = 0;
const VERSION = 20;

function checksum(data: Buffer): number {
    let crc = 0xffffffff;
    for (const byte of data) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit += 1) {
            crc = (crc & 1) === 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}

export function buildZip(entries: readonly ZipEntryInput[]): Buffer {
    const localParts: Buffer[] = [];
    const centralParts: Buffer[] = [];
    let localOffset = 0;

    for (const entry of entries) {
        const name = Buffer.from(entry.name, "utf8");
        const data = entry.data ?? Buffer.alloc(0);
        const crc = checksum(data);

        const local = Buffer.alloc(30);
        local.writeUInt32LE(LOCAL_FILE_HEADER_SIGNATURE, 0);
        local.writeUInt16LE(VERSION, 4);
        local.writeUInt16LE(0, 6);
        local.writeUInt16LE(STORED_METHOD, 8);
        local.writeUInt16LE(0, 10);
        local.writeUInt16LE(0, 12);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(data.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(name.length, 26);
        local.writeUInt16LE(0, 28);
        localParts.push(local, name, data);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(CENTRAL_DIRECTORY_SIGNATURE, 0);
        central.writeUInt16LE(VERSION, 4);
        central.writeUInt16LE(VERSION, 6);
        central.writeUInt16LE(0, 8);
        central.writeUInt16LE(STORED_METHOD, 10);
        central.writeUInt16LE(0, 12);
        central.writeUInt16LE(0, 14);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(data.length, 20);
        central.writeUInt32LE(data.length, 24);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt16LE(0, 30);
        central.writeUInt16LE(0, 32);
        central.writeUInt16LE(0, 34);
        central.writeUInt16LE(0, 36);
        central.writeUInt32LE(0, 38);
        central.writeUInt32LE(localOffset, 42);
        centralParts.push(central, name);

        localOffset += 30 + name.length + data.length;
    }

    const centralDirectory = Buffer.concat(centralParts);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(END_OF_CENTRAL_DIRECTORY_SIGNATURE, 0);
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralDirectory.length, 12);
    end.writeUInt32LE(localOffset, 16);
    end.writeUInt16LE(0, 20);

    return Buffer.concat([...localParts, centralDirectory, end]);
}
