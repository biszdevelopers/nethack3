import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const useNodeForServer = process.argv.includes("--node");
const children: ChildProcess[] = [];
let shuttingDown = false;

function run(command: string, args: string[], cwd: string): ChildProcess {
    return spawn(command, args, {
        cwd,
        stdio: "inherit",
        shell: process.platform === "win32",
        env: process.env,
    });
}

function runToCompletion(command: string, args: string[], cwd: string): void {
    const child = spawn(command, args, {
        cwd,
        stdio: "inherit",
        shell: process.platform === "win32",
        env: process.env,
    });
    if (child.status !== null && child.status !== 0) {
        process.exit(child.status);
    }
}

function ensureSharedPackages(): void {
    const contracts = join(root, "packages", "contracts", "dist", "index.js");
    const ui = join(root, "packages", "ui", "dist", "index.js");
    if (!existsSync(contracts)) {
        runToCompletion("bun", ["run", "--cwd", "packages/contracts", "build"], root);
    }
    if (!existsSync(ui)) {
        runToCompletion("bun", ["run", "--cwd", "packages/ui", "build"], root);
    }
}

function startChild(command: string, args: string[], cwd: string): void {
    const child = run(command, args, cwd);
    children.push(child);
    child.on("exit", (code) => {
        if (!shuttingDown && code !== 0 && code !== null) {
            shutdown(code);
        }
    });
}

function shutdown(code = 0): void {
    if (shuttingDown) {
        return;
    }
    shuttingDown = true;
    for (const child of children) {
        if (child.exitCode === null) {
            child.kill("SIGTERM");
        }
    }
    setTimeout(() => {
        for (const child of children) {
            if (child.exitCode === null) {
                child.kill("SIGKILL");
            }
        }
        process.exit(code);
    }, 3000).unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

ensureSharedPackages();

if (useNodeForServer) {
    runToCompletion("bun", ["run", "--cwd", "apps/api", "build"], root);
    startChild(process.execPath, ["dist/main.js"], join(root, "apps/api"));
    startChild("node", ["./node_modules/next/dist/bin/next", "dev"], join(root, "apps/site"));
} else {
    startChild("bun", ["run", "dev"], join(root, "apps/api"));
    startChild("bun", ["--bun", "next", "dev"], join(root, "apps/site"));
}

startChild("bun", ["run", "dev"], join(root, "apps/workspace"));
