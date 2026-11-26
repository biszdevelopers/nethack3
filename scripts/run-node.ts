import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Runs a JavaScript tool with a real Node.js binary. When this script is
 * launched by Bun on Windows, the bare `node` command can resolve to Bun,
 * which is incompatible with Vitest's worker pools. Bun remains the package
 * manager and application runtime; test tooling runs on Node.
 */
function resolveNodeBinary(): string {
    if (!process.versions.bun) {
        return process.execPath;
    }
    const lookup = spawnSync(process.platform === "win32" ? "where" : "which", ["node"], {
        encoding: "utf8",
    });
    const candidates = lookup.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !/bun/i.test(line));
    const candidate = candidates[0];
    if (candidate !== undefined && existsSync(candidate)) {
        return candidate;
    }
    return "node";
}

const [script, ...args] = process.argv.slice(2);
if (script === undefined) {
    console.error("Usage: bun scripts/run-node.ts <script.js> [...args]");
    process.exit(1);
}

const target = resolve(process.cwd(), script);
if (!existsSync(target)) {
    console.error(`Tool script not found: ${target}`);
    process.exit(1);
}

const result = spawnSync(resolveNodeBinary(), [target, ...args], {
    stdio: "inherit",
    env: process.env,
    cwd: process.cwd(),
});

if (result.error !== undefined) {
    console.error(result.error.message);
    process.exit(1);
}
process.exit(result.status ?? 1);
