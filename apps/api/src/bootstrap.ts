import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Loads a local .env file when present without overriding injected environment
 * variables. Deployments provide configuration directly; this is a development
 * convenience that behaves identically under Node.js and Bun (Bun 1.3 does not
 * implement process.loadEnvFile).
 */
export function loadLocalEnvironment(): void {
    const candidates = [
        resolve(process.cwd(), ".env"),
        resolve(process.cwd(), "../../.env"),
        resolve(process.cwd(), "../../../.env"),
    ];
    for (const candidate of candidates) {
        if (!existsSync(candidate)) {
            continue;
        }
        for (const [key, value] of parseEnvironmentFile(readFileSync(candidate, "utf8"))) {
            if (process.env[key] === undefined) {
                process.env[key] = value;
            }
        }
        return;
    }
}

export function parseEnvironmentFile(content: string): Map<string, string> {
    const values = new Map<string, string>();
    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (line.length === 0 || line.startsWith("#")) {
            continue;
        }
        const normalized = line.startsWith("export ") ? line.slice(7).trim() : line;
        const separator = normalized.indexOf("=");
        if (separator <= 0) {
            continue;
        }
        const key = normalized.slice(0, separator).trim();
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
            continue;
        }
        let value = normalized.slice(separator + 1).trim();
        if (
            value.length >= 2 &&
            ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'")))
        ) {
            value = value.slice(1, -1);
        }
        values.set(key, value);
    }
    return values;
}
