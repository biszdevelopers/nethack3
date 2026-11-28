import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CAPABILITIES = join(process.cwd(), "apps/api/src/capabilities");

interface CapabilityShape {
    readonly id: string;
    readonly version: string;
    readonly dependencies: readonly string[];
    readonly register: unknown;
}

function isCapability(value: unknown): value is CapabilityShape {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const candidate = value as Record<string, unknown>;
    return (
        typeof candidate.id === "string" &&
        typeof candidate.version === "string" &&
        Array.isArray(candidate.dependencies) &&
        typeof candidate.register === "function"
    );
}

describe("capability extraction", () => {
    it("exports a self-contained capability definition from every folder", async () => {
        // Dynamic TypeScript imports of every capability exceed the default timeout on Windows.

        const entries = readdirSync(CAPABILITIES, { withFileTypes: true })
            .filter((entry) => entry.isDirectory() && entry.name !== "tests")
            .map((entry) => entry.name)
            .sort();
        expect(entries.length).toBeGreaterThanOrEqual(13);

        const ids = new Set<string>();
        for (const name of entries) {
            const module = (await import(
                `../../apps/api/src/capabilities/${name}/index.ts`
            )) as Record<string, unknown>;
            const definition = Object.entries(module).find(([exportName]) =>
                exportName.endsWith("Capability"),
            )?.[1];
            expect(isCapability(definition), `${name} must export a capability definition`).toBe(
                true,
            );
            if (!isCapability(definition)) {
                continue;
            }
            expect(definition.id, `${name} id`).toBe(name);
            expect(ids.has(definition.id), `${name} id must be unique`).toBe(false);
            ids.add(definition.id);
        }
    }, 90_000);
});
