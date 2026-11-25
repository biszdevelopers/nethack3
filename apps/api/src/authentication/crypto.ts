import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { SessionEncryptionKey } from "../core/configuration.js";
import { InternalError, InvalidTokenError } from "../core/errors.js";

const AAD = Buffer.from("nethack-session-secret", "utf8");

export function randomToken(bytes = 32): string {
    return randomBytes(bytes).toString("base64url");
}

export function sha256Hex(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

export function hmacHex(key: Buffer, value: string): string {
    return createHmac("sha256", key).update(value, "utf8").digest("hex");
}

export function deriveCsrfToken(sessionToken: string, key: Buffer): string {
    return createHmac("sha256", key).update(`nethack-csrf:${sessionToken}`, "utf8").digest("base64url");
}

export function hashesEqual(left: string, right: string): boolean {
    const a = Buffer.from(left, "utf8");
    const b = Buffer.from(right, "utf8");
    if (a.length !== b.length) {
        return false;
    }
    return timingSafeEqual(a, b);
}

export interface EncryptedSecret {
    readonly ciphertext: string;
    readonly keyVersion: number;
}

export function encryptSecret(
    plaintext: string,
    keys: readonly SessionEncryptionKey[],
): EncryptedSecret {
    const current = keys[0];
    if (current === undefined) {
        throw new InternalError("No session encryption key is configured.");
    }
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", current.key, iv);
    cipher.setAAD(AAD);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
        ciphertext: `v${current.version}.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`,
        keyVersion: current.version,
    };
}

export function decryptSecret(
    ciphertext: string,
    keys: readonly SessionEncryptionKey[],
): string {
    const [versionPart, ivPart, tagPart, dataPart] = ciphertext.split(".");
    if (versionPart === undefined || ivPart === undefined || tagPart === undefined || dataPart === undefined) {
        throw new InternalError("Stored secret has an invalid format.");
    }
    const version = Number.parseInt(versionPart.replace(/^v/, ""), 10);
    const key = keys.find((candidate) => candidate.version === version) ?? keys[0];
    if (key === undefined) {
        throw new InternalError("The encryption key for a stored secret is unavailable.");
    }
    try {
        const decipher = createDecipheriv("aes-256-gcm", key.key, Buffer.from(ivPart, "base64url"));
        decipher.setAAD(AAD);
        decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
        return Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]).toString("utf8");
    } catch (error) {
        throw new InternalError("A stored secret could not be decrypted.", error);
    }
}

export function hashIp(ip: string, key: Buffer): string {
    const digest = createHmac("sha256", key).update(ip, "utf8").digest("hex");
    return digest.slice(0, 32);
}

export function assertBearerTokenFormat(token: string): void {
    if (!/^[A-Za-z0-9._~+/-]+=*$/.test(token) || token.length < 32 || token.length > 8192) {
        throw new InvalidTokenError();
    }
}
