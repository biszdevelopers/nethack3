import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startHarness, type TestHarness } from "../support/app-harness.js";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789-_'\"%<>[]{}()/\\;:,.=+*&?#";

function randomString(random: () => number, length: number): string {
    let value = "";
    for (let index = 0; index < length; index += 1) {
        value += ALPHABET[Math.floor(random() * ALPHABET.length)] ?? "a";
    }
    return value;
}

function seededRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state * 1_664_525 + 1_013_904_223) >>> 0;
        return state / 0x1_0000_0000;
    };
}

describe("input fuzzing", () => {
    let harness: TestHarness;

    beforeAll(async () => {
        harness = await startHarness();
    });

    afterAll(async () => {
        await harness.closeHarness();
    });

    it("never returns 500 for malformed public identifiers or filters", async () => {
        const random = seededRandom(20261127);
        const paths = [
            "/api/v1/public/competitions/",
            "/api/v1/public/projects/",
            "/api/v1/public/organizations/",
        ];
        for (let index = 0; index < 80; index += 1) {
            const value = randomString(random, 1 + Math.floor(random() * 60));
            const path = `${paths[index % paths.length] ?? paths[0]}${encodeURIComponent(value)}`;
            const response = await harness.inject({ method: "GET", url: path });
            expect(response.statusCode, `${path} returned ${response.body}`).not.toBe(500);
        }
        for (let index = 0; index < 40; index += 1) {
            const value = randomString(random, 1 + Math.floor(random() * 80));
            const response = await harness.inject({
                method: "GET",
                url: `/api/v1/public/announcements?organization=${encodeURIComponent(value)}&limit=${String(1 + Math.floor(random() * 500))}`,
            });
            expect(response.statusCode, response.body).not.toBe(500);
        }
    });

    it("never returns 500 for malformed authenticated identifiers", async () => {
        const auth = await harness.signIn();
        const random = seededRandom(7);
        for (let index = 0; index < 40; index += 1) {
            const value = randomString(random, 1 + Math.floor(random() * 40));
            const response = await harness.authenticatedRequest(auth, {
                method: "GET",
                url: `/api/v1/submissions/${encodeURIComponent(value)}`,
                headers: { "x-nethack-organization-id": "not-a-uuid" },
            });
            expect(response.statusCode, response.body).not.toBe(500);
        }
    });
});
