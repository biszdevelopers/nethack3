import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const API_SOURCE = join(process.cwd(), "apps/api/src");
const ALLOWED_FETCH = new Set(["authentication/basis-auth-client.ts"]);

function sourceFiles(directory: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(directory)) {
        const path = join(directory, entry);
        const stat = statSync(path);
        if (stat.isDirectory()) {
            files.push(...sourceFiles(path));
        } else if (entry.endsWith(".ts")) {
            files.push(path);
        }
    }
    return files;
}

describe("outbound request boundary", () => {
    it("only allows the configured OIDC client to call fetch", () => {
        const offenders: string[] = [];
        for (const path of sourceFiles(API_SOURCE)) {
            const relativePath = relative(API_SOURCE, path).split(sep).join("/");
            if (ALLOWED_FETCH.has(relativePath)) {
                continue;
            }
            const content = readFileSync(path, "utf8");
            if (/\bfetch\s*\(/u.test(content)) {
                offenders.push(relativePath);
            }
        }
        expect(offenders).toEqual([]);
    });

    it("uses the configured issuer for OIDC discovery", () => {
        const content = readFileSync(
            join(API_SOURCE, "authentication/basis-auth-client.ts"),
            "utf8",
        );
        expect(content).toContain("new URL(this.config.issuer)");
        expect(content).toContain("allowInsecureRequests");
    });
});
