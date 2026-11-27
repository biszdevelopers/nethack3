import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const root = process.cwd();
const url = process.argv[2] ?? "http://127.0.0.1:3100/";
const artifacts = join(root, "artifacts");
mkdirSync(artifacts, { recursive: true });

interface LighthouseCategory {
    readonly score?: number;
}

interface LighthouseReport {
    readonly categories?: Readonly<Record<string, LighthouseCategory>>;
    readonly audits?: Readonly<Record<string, { readonly displayValue?: string }>>;
}

function findChrome(): string | null {
    const configured = process.env.CHROME_PATH;
    if (configured !== undefined && configured.trim() !== "" && existsSync(configured)) {
        return configured;
    }
    const roots = [
        join(process.env.USERPROFILE ?? homedir(), "AppData", "Local", "ms-playwright"),
        join(homedir(), ".cache", "ms-playwright"),
        join(homedir(), "Library", "Caches", "ms-playwright"),
    ];
    const candidates: string[] = [];
    for (const rootDirectory of roots) {
        if (!existsSync(rootDirectory)) {
            continue;
        }
        for (const entry of readdirSync(rootDirectory)) {
            if (!entry.startsWith("chromium-")) {
                continue;
            }
            const directory = join(rootDirectory, entry);
            candidates.push(
                join(directory, "chrome-win64", "chrome.exe"),
                join(directory, "chrome-win", "chrome.exe"),
                join(directory, "chrome-linux", "chrome"),
                join(directory, "chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium"),
            );
        }
    }
    return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function runLighthouse(formFactor: "mobile" | "desktop", chrome: string): LighthouseReport {
    const output = join(artifacts, `lighthouse-${formFactor}.json`);
    const args = [
        join(root, "node_modules/lighthouse/cli/index.js"),
        url,
        `--chrome-path=${chrome}`,
        "--chrome-flags=--headless=new --no-sandbox",
        "--only-categories=performance,accessibility,best-practices,seo",
        "--output=json",
        `--output-path=${output}`,
        "--quiet",
        ...(formFactor === "desktop" ? ["--preset=desktop"] : []),
    ];
    const result = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit" });
    if (result.status !== 0) {
        throw new Error(`Lighthouse ${formFactor} run exited with ${String(result.status)}.`);
    }
    return JSON.parse(readFileSync(output, "utf8")) as LighthouseReport;
}

const chrome = findChrome();
if (chrome === null) {
    console.error("No Chromium executable found. Set CHROME_PATH or install Playwright Chromium.");
    process.exit(1);
}

const thresholds = {
    performance: 95,
    accessibility: 100,
    "best-practices": 95,
    seo: 95,
} as const;

let failed = false;
for (const formFactor of ["mobile", "desktop"] as const) {
    const report = runLighthouse(formFactor, chrome);
    const categories = report.categories ?? {};
    for (const [category, minimum] of Object.entries(thresholds)) {
        const score = Math.round((categories[category]?.score ?? 0) * 100);
        const passed = score >= minimum;
        failed ||= !passed;
        console.log(
            `${passed ? "passed" : "failed"}  ${formFactor} ${category}: ${String(score)} (minimum ${String(minimum)})`,
        );
    }
    const audits = report.audits ?? {};
    console.log(
        `        LCP ${audits["largest-contentful-paint"]?.displayValue ?? "?"}, CLS ${audits["cumulative-layout-shift"]?.displayValue ?? "?"}, TBT ${audits["total-blocking-time"]?.displayValue ?? "?"}, TTFB ${audits["server-response-time"]?.displayValue ?? "?"}`,
    );
}

if (failed) {
    process.exitCode = 1;
}
