import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = process.cwd();
const skippedDirectories = new Set([
    ".git",
    ".data",
    ".next",
    "coverage",
    "dist",
    "node_modules",
    "playwright-report",
    "test-results",
    "artifacts",
    "basishacks-r2",
]);
const secretPatterns: readonly { readonly name: string; readonly pattern: RegExp }[] = [
    { name: "private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u },
    { name: "AWS access key", pattern: /\bAKIA[0-9A-Z]{16}\b/u },
    { name: "GitHub token", pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/u },
    { name: "Slack token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/u },
    { name: "OpenAI key", pattern: /\bsk-[A-Za-z0-9]{32,}\b/u },
    { name: "Google API key", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/u },
];

interface PackageFile {
    readonly name?: string;
    readonly version?: string;
    readonly private?: boolean;
    readonly dependencies?: Readonly<Record<string, string>>;
    readonly devDependencies?: Readonly<Record<string, string>>;
}

function trackedFiles(directory: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(directory)) {
        const path = join(directory, entry);
        const stat = statSync(path);
        if (stat.isDirectory()) {
            if (!skippedDirectories.has(entry)) {
                files.push(...trackedFiles(path));
            }
            continue;
        }
        if (
            stat.size <= 2_000_000 &&
            /\.(?:ts|tsx|js|jsx|json|md|ya?ml|toml|sql|css|html|env)$/u.test(entry)
        ) {
            files.push(path);
        }
    }
    return files;
}

function scanSecrets(files: readonly string[]): string[] {
    const findings: string[] = [];
    for (const path of files) {
        const relativePath = relative(root, path).split(sep).join("/");
        const content = readFileSync(path, "utf8");
        for (const secret of secretPatterns) {
            if (secret.pattern.test(content)) {
                findings.push(`${relativePath}: possible ${secret.name}`);
            }
        }
    }
    return findings;
}

function packageFiles(directory: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(directory)) {
        const path = join(directory, entry);
        const stat = statSync(path);
        if (stat.isDirectory()) {
            if (entry !== "node_modules" && entry !== "dist" && entry !== ".next") {
                files.push(...packageFiles(path));
            }
        } else if (entry === "package.json") {
            files.push(path);
        }
    }
    return files;
}

function buildSbom(): Record<string, unknown> {
    const components = new Map<string, Record<string, unknown>>();
    for (const path of packageFiles(root)) {
        const pkg = JSON.parse(readFileSync(path, "utf8")) as PackageFile;
        if (pkg.name === undefined || pkg.version === undefined) {
            continue;
        }
        components.set(`${pkg.name}@${pkg.version}`, {
            type: pkg.private === true ? "application" : "library",
            name: pkg.name,
            version: pkg.version,
        });
        for (const [name, version] of Object.entries(pkg.dependencies ?? {})) {
            const resolved = version.replace(/^workspace:/u, "workspace");
            components.set(`${name}@${resolved}`, {
                type: "library",
                name,
                version: resolved,
            });
        }
    }
    return {
        bomFormat: "CycloneDX",
        specVersion: "1.5",
        version: 1,
        metadata: {
            component: {
                type: "application",
                name: "nethack",
                version: process.env.npm_package_version ?? "0.1.0",
            },
        },
        components: [...components.values()].sort((left, right) =>
            JSON.stringify(left).localeCompare(JSON.stringify(right)),
        ),
    };
}

const files = trackedFiles(root);
const findings = scanSecrets(files);
const sbom = buildSbom();
const artifacts = join(root, "artifacts");
mkdirSync(artifacts, { recursive: true });
writeFileSync(join(artifacts, "sbom.cdx.json"), `${JSON.stringify(sbom, null, 2)}\n`);

if (findings.length > 0) {
    console.error("Potential secrets found:");
    for (const finding of findings) {
        console.error(`  ${finding}`);
    }
    process.exitCode = 1;
} else {
    console.log(`Secret scan passed across ${String(files.length)} text files.`);
}

const components = Array.isArray(sbom.components) ? sbom.components.length : 0;
console.log(`SBOM written to artifacts/sbom.cdx.json with ${String(components)} components.`);
execFileSync("git", ["check-ignore", "--quiet", "artifacts/sbom.cdx.json"], {
    cwd: root,
    stdio: "ignore",
});
