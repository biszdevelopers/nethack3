import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(process.cwd());

function walk(directory: string): string[] {
    const entries: string[] = [];
    for (const name of readdirSync(directory)) {
        if (name === "node_modules" || name === "dist" || name === ".next") {
            continue;
        }
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

function productSources(): string[] {
    const files: string[] = [];
    for (const app of [
        "apps/api/src",
        "apps/site/src",
        "apps/workspace/src",
        "packages/contracts/src",
        "packages/ui/src",
        "packages/api-client/src",
    ]) {
        files.push(...walk(join(ROOT, app)));
    }
    return files.filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"));
}

describe("code standards", () => {
    it("does not suppress TypeScript errors", () => {
        const violations = productSources().filter((file) =>
            /@ts-(ignore|expect-error|nocheck)/.test(readFileSync(file, "utf8")),
        );
        expect(violations).toEqual([]);
    });

    it("does not use any or non-null assertions", () => {
        const violations: string[] = [];
        for (const file of productSources()) {
            const content = readFileSync(file, "utf8");
            if (/:\s*any\b|\bas\s+any\b|<any>/.test(content)) {
                violations.push(`${relative(ROOT, file)} uses any`);
            }
            if (/[A-Za-z0-9_)\]]!\./.test(content) || /[A-Za-z0-9_)\]]!;/.test(content)) {
                violations.push(`${relative(ROOT, file)} may use a non-null assertion`);
            }
        }
        expect(violations).toEqual([]);
    });

    it("does not use unsafe HTML, eval, or script construction", () => {
        const violations: string[] = [];
        for (const file of productSources()) {
            const content = readFileSync(file, "utf8");
            for (const pattern of [
                /dangerouslySetInnerHTML/,
                /\binnerHTML\b/,
                /\beval\s*\(/,
                /new\s+Function\s*\(/,
                /document\.write\b/,
            ]) {
                if (pattern.test(content)) {
                    violations.push(`${relative(ROOT, file)} matches ${pattern}`);
                }
            }
        }
        expect(violations).toEqual([]);
    });

    it("does not use uppercase text transforms", () => {
        const violations: string[] = [];
        for (const file of [
            ...productSources(),
            ...walk(join(ROOT, "packages/ui")).filter((path) => path.endsWith(".css")),
        ]) {
            const content = readFileSync(file, "utf8");
            if (/text-transform\s*:\s*uppercase/i.test(content)) {
                violations.push(`${relative(ROOT, file)} uses text-transform uppercase`);
            }
            if (/\buppercase\b/.test(content)) {
                violations.push(`${relative(ROOT, file)} uses the uppercase utility`);
            }
        }
        expect(violations).toEqual([]);
    });

    it("uses only Noto Sans Mono for type", () => {
        const css = readFileSync(join(ROOT, "packages/ui/styles.css"), "utf8");
        const families = [...css.matchAll(/font-family:\s*([^;]+);/g)].map(
            (match) => match[1] ?? "",
        );
        expect(families.length).toBeGreaterThan(0);
        expect(
            families.every(
                (family) =>
                    family.includes("Noto Sans Mono") || family.includes("var(--font-sans)"),
            ),
        ).toBe(true);
        const otherFonts = productSources().filter((file) => {
            const content = readFileSync(file, "utf8");
            return /font-family:\s*['"]?(?!Noto Sans Mono)/.test(content);
        });
        expect(otherFonts).toEqual([]);
    });

    it("uses only the approved color palette", () => {
        const allowed = new Set([
            "#00dc82",
            "#2ee59a",
            "#00a862",
            "#008f53",
            "#04140b",
            "#111111",
            "#1a1a1a",
            "#f1f1f1",
            "#e5e5e5",
            "#c4c4c4",
            "#fafafa",
            "#00c274",
            "#00a862",
            "#009257",
            "#062d1d",
            "#052015",
            "#e3f8ee",
            "#042415",
            "#090909",
            "#101010",
            "#161616",
            "#050505",
            "#2a2a2a",
            "#414141",
            "#3d3d3d",
            "#ffffff",
            "#fafafa",
            "#f2f2f2",
            "#e2e2e2",
            "#bdbdbd",
            "#a3a3a3",
            "#737373",
            "#525252",
            "#6b6b6b",
            "#262626",
            "#151515",
            "#000000",
        ]);
        const violations: string[] = [];
        for (const file of productSources()) {
            const content = readFileSync(file, "utf8");
            for (const match of content.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
                const value = match[0].toLowerCase();
                if (!allowed.has(value)) {
                    violations.push(`${relative(ROOT, file)} uses ${value}`);
                }
            }
        }
        expect(violations).toEqual([]);
    });

    it("keeps API communication and server-state orchestration out of tsx files", () => {
        const violations: string[] = [];
        for (const file of productSources().filter((path) => path.endsWith(".tsx"))) {
            const content = readFileSync(file, "utf8");
            for (const pattern of [
                /from\s+"@nethack\/api-client"/,
                /\bfetch\s*\(/,
                /\buseQuery\s*\(/,
                /\buseMutation\s*\(/,
                /\b(?:select|insert|update|delete)\s+from\s+/i,
            ]) {
                if (pattern.test(content)) {
                    violations.push(`${relative(ROOT, file)} matches ${pattern}`);
                }
            }
        }
        expect(violations).toEqual([]);
    });

    it("does not display the internal codename in the interface", () => {
        const violations: string[] = [];
        for (const app of ["apps/site/src", "apps/workspace/src"]) {
            for (const file of walk(join(ROOT, app))) {
                if (!file.endsWith(".ts") && !file.endsWith(".tsx")) {
                    continue;
                }
                const content = readFileSync(file, "utf8");
                if (/nethack3/i.test(content)) {
                    violations.push(relative(ROOT, file));
                }
            }
        }
        expect(violations).toEqual([]);
    });
});
