import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(process.cwd());
const API_SRC = join(ROOT, "apps", "api", "src");
const CAPABILITIES_DIR = join(API_SRC, "capabilities");

function walk(directory: string): string[] {
    const entries: string[] = [];
    for (const name of readdirSync(directory)) {
        const path = join(directory, name);
        const stats = statSync(path);
        if (stats.isDirectory()) {
            entries.push(...walk(path));
        } else {
            entries.push(path);
        }
    }
    return entries;
}

function sourceFiles(): string[] {
    return walk(API_SRC).filter((path) => path.endsWith(".ts"));
}

function capabilityNames(): string[] {
    return readdirSync(CAPABILITIES_DIR).filter((name) =>
        statSync(join(CAPABILITIES_DIR, name)).isDirectory(),
    );
}

function importedCapabilityPaths(file: string): string[] {
    const content = readFileSync(file, "utf8");
    const matches = content.matchAll(/from\s+"([^"]*capabilities\/([a-z-]+)\/[^"]*)"/g);
    const paths: string[] = [];
    for (const match of matches) {
        const target = match[2];
        if (target !== undefined) {
            paths.push(`${target}:${match[1] ?? ""}`);
        }
    }
    return paths;
}

describe("capability boundaries", () => {
    it("has no private cross-capability imports", () => {
        const violations: string[] = [];
        for (const file of sourceFiles()) {
            const relativePath = relative(API_SRC, file).replaceAll("\\", "/");
            const owner = /^capabilities\/([a-z-]+)\//.exec(relativePath)?.[1];
            if (owner === undefined) {
                continue;
            }
            for (const imported of importedCapabilityPaths(file)) {
                const [target, specifier] = imported.split(":");
                if (target === undefined || target === owner) {
                    continue;
                }
                const allowed = (specifier ?? "").endsWith("/contracts.js");
                if (!allowed) {
                    violations.push(`${relativePath} imports private ${specifier}`);
                }
            }
        }
        expect(violations).toEqual([]);
    });

    it("registers a capability definition for every capability folder", () => {
        const index = readFileSync(join(CAPABILITIES_DIR, "index.ts"), "utf8");
        const missing = capabilityNames().filter((name) => {
            const folderIndex = join(CAPABILITIES_DIR, name, "index.ts");
            try {
                const content = readFileSync(folderIndex, "utf8");
                if (!/CapabilityDefinition/.test(content)) {
                    return false;
                }
            } catch {
                return false;
            }
            return !new RegExp(`\\b${name}Capability\\b`).test(index);
        });
        expect(missing).toEqual([]);
    });

    it("declares dependencies that exist as capability folders", () => {
        const names = new Set(capabilityNames());
        const problems: string[] = [];
        for (const name of capabilityNames()) {
            const file = join(CAPABILITIES_DIR, name, "index.ts");
            let content: string;
            try {
                content = readFileSync(file, "utf8");
            } catch {
                continue;
            }
            const dependenciesMatch = /dependencies:\s*\[([^\]]*)\]/.exec(content);
            if (dependenciesMatch === null) {
                continue;
            }
            const dependencies = [...(dependenciesMatch[1] ?? "").matchAll(/"([a-z-]+)"/g)].map(
                (match) => match[1] ?? "",
            );
            for (const dependency of dependencies) {
                if (!names.has(dependency)) {
                    problems.push(`${name} depends on missing ${dependency}`);
                }
            }
        }
        expect(problems).toEqual([]);
    });

    it("keeps capabilities out of unrelated capability data", () => {
        const forbiddenTableImports = new Map<string, string[]>([
            ["teams", ["projects", "submissions", "judging", "voting", "announcements"]],
            ["projects", ["submissions", "judging", "voting"]],
            ["submissions", ["judging", "voting"]],
        ]);
        const violations: string[] = [];
        for (const file of sourceFiles()) {
            const relativePath = relative(API_SRC, file).replaceAll("\\", "/");
            const owner = /^capabilities\/([a-z-]+)\//.exec(relativePath)?.[1];
            if (owner === undefined) {
                continue;
            }
            const content = readFileSync(file, "utf8");
            for (const table of forbiddenTableImports.get(owner) ?? []) {
                if (new RegExp(`database/schema/[^"]*${table}`).test(content)) {
                    violations.push(`${relativePath} imports ${table} persistence`);
                }
            }
        }
        expect(violations).toEqual([]);
    });
});
