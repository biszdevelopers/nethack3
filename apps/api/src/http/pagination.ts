import { z } from "zod";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ValidationError } from "../core/errors.js";

const cursorPayloadSchema = z.object({
    createdAt: z.iso.datetime({ offset: true }),
    id: z.uuid(),
});

export interface CursorPayload {
    readonly createdAt: string;
    readonly id: string;
}

export function encodeCursor(createdAt: Date, id: string): string {
    return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id }), "utf8").toString(
        "base64url",
    );
}

export function decodeCursor(cursor: string | undefined): CursorPayload | null {
    if (cursor === undefined) {
        return null;
    }
    try {
        const parsed = cursorPayloadSchema.parse(
            JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")),
        );
        return parsed;
    } catch {
        throw new ValidationError("The pagination cursor is invalid.");
    }
}

export function responsePage<T>(
    items: readonly T[],
    limit: number,
    cursorOf: (item: T) => { createdAt: Date; id: string },
): { items: T[]; nextCursor: string | null } {
    const hasMore = items.length > limit;
    const visible = hasMore ? items.slice(0, limit) : [...items];
    const last = visible[visible.length - 1];
    return {
        items: visible,
        nextCursor:
            hasMore && last !== undefined
                ? encodeCursor(cursorOf(last).createdAt, cursorOf(last).id)
                : null,
    };
}

export function parseLimit(raw: string | undefined, fallback = 20, max = 100): number {
    if (raw === undefined) {
        return fallback;
    }
    const value = Number.parseInt(raw, 10);
    if (!Number.isFinite(value) || value < 1 || value > max) {
        throw new ValidationError(`The limit must be between 1 and ${max}.`);
    }
    return value;
}

export function setPrivateNoStore(reply: FastifyReply): void {
    reply.header("cache-control", "private, no-store");
}

export function setPublicCache(reply: FastifyReply, seconds = 60): void {
    reply.header("cache-control", `public, max-age=${seconds}, stale-while-revalidate=300`);
}

export function clientIp(request: FastifyRequest): string {
    return request.ip;
}
