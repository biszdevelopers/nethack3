import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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

function filesUnder(directory: string): string[] {
    return walk(join(ROOT, directory));
}

function textFiles(directory: string): string[] {
    return filesUnder(directory).filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"));
}

describe("runtime parity", () => {
    it("does not use Bun-only runtime APIs in application code", () => {
        const violations: string[] = [];
        for (const directory of [
            "apps/api/src",
            "apps/site/src",
            "apps/workspace/src",
            "packages/contracts/src",
            "packages/ui/src",
            "packages/api-client/src",
        ]) {
            for (const file of textFiles(directory)) {
                const content = readFileSync(file, "utf8");
                if (/\bBun\.[A-Za-z]/.test(content)) {
                    violations.push(relative(ROOT, file));
                }
            }
        }
        expect(violations).toEqual([]);
    });

    it("keeps server-only modules out of browser bundles", () => {
        const forbidden = [
            /from\s+"node:/,
            /from\s+"pg"/,
            /from\s+"drizzle-orm/,
            /BASIS_AUTH_CLIENT_SECRET/,
            /BASIS_AUTH_RESOURCE_SECRET/,
            /SESSION_ENCRYPTION_KEYS/,
            /DATABASE_URL/,
        ];
        const violations: string[] = [];
        for (const directory of [
            "apps/workspace/src",
            "packages/ui/src",
            "packages/api-client/src",
        ]) {
            for (const file of textFiles(directory)) {
                const content = readFileSync(file, "utf8");
                for (const pattern of forbidden) {
                    if (pattern.test(content)) {
                        violations.push(`${relative(ROOT, file)} matches ${pattern}`);
                    }
                }
            }
        }
        expect(violations).toEqual([]);
    });

    it("does not give the public site server secrets or database access", () => {
        const violations: string[] = [];
        for (const file of textFiles("apps/site/src")) {
            const content = readFileSync(file, "utf8");
            for (const pattern of [
                /drizzle-orm/,
                /\bpg\b/,
                /DATABASE_URL/,
                /BASIS_AUTH_CLIENT_SECRET/,
                /BASIS_AUTH_RESOURCE_SECRET/,
                /SESSION_ENCRYPTION_KEYS/,
                /__Host-nethack_session/,
            ]) {
                if (pattern.test(content)) {
                    violations.push(`${relative(ROOT, file)} matches ${pattern}`);
                }
            }
        }
        expect(violations).toEqual([]);
    });

    it("does not mix routing or form frameworks across applications", () => {
        const siteFiles = textFiles("apps/site/src");
        const workspaceFiles = textFiles("apps/workspace/src");
        for (const file of siteFiles) {
            expect(readFileSync(file, "utf8")).not.toMatch(/from\s+"react-router/);
        }
        for (const file of workspaceFiles) {
            expect(readFileSync(file, "utf8")).not.toMatch(/from\s+"next\//);
        }
    });

    it("does not include competing package managers or formatters", () => {
        for (const file of [
            "pnpm-lock.yaml",
            "package-lock.json",
            "yarn.lock",
            ".eslintrc",
            ".eslintrc.json",
            ".eslintrc.js",
            ".prettierrc",
            ".prettierrc.json",
            "tslint.json",
        ]) {
            expect(existsSync(join(ROOT, file)), `${file} must not exist`).toBe(false);
        }
        const rootPackage = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
            devDependencies?: Record<string, string>;
            dependencies?: Record<string, string>;
        };
        const dependencies = {
            ...rootPackage.dependencies,
            ...rootPackage.devDependencies,
        };
        for (const forbidden of ["eslint", "prettier", "pnpm", "nx", "turbo"]) {
            expect(Object.keys(dependencies)).not.toContain(forbidden);
        }
    });

    it("does not introduce an event streaming broker", () => {
        const manifests = [
            "apps/api/package.json",
            "apps/site/package.json",
            "apps/workspace/package.json",
            "packages/ui/package.json",
            "packages/contracts/package.json",
        ];
        for (const manifest of manifests) {
            const content = readFileSync(join(ROOT, manifest), "utf8").toLowerCase();
            for (const dependency of ["kafka", "rabbitmq", "amqplib", "redis"]) {
                expect(content).not.toContain(dependency);
            }
        }
    });
});
