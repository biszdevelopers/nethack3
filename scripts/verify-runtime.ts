import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const results: { name: string; status: "passed" | "failed"; detail: string }[] = [];

function run(
    command: string,
    args: string[],
    cwd: string,
    env: NodeJS.ProcessEnv = process.env,
): Promise<{ code: number; output: string }> {
    return new Promise((resolve) => {
        const child = spawn(command, args, {
            cwd,
            shell: process.platform === "win32",
            env,
            stdio: ["ignore", "pipe", "pipe"],
        });
        let output = "";
        child.stdout?.on("data", (chunk: Buffer) => {
            output += chunk.toString();
        });
        child.stderr?.on("data", (chunk: Buffer) => {
            output += chunk.toString();
        });
        child.on("exit", (code) => resolve({ code: code ?? 1, output }));
    });
}

async function record(name: string, work: () => Promise<string>): Promise<void> {
    try {
        const detail = await work();
        results.push({ name, status: "passed", detail });
        console.log(`passed  ${name}  ${detail}`);
    } catch (error) {
        results.push({
            name,
            status: "failed",
            detail: error instanceof Error ? error.message : "unknown failure",
        });
        console.log(`failed  ${name}`);
    }
}

async function waitFor(url: string, attempts = 40): Promise<void> {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
            if (response.ok) {
                return;
            }
        } catch {
            // retry
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`Timed out waiting for ${url}`);
}

async function startServer(
    command: string,
    args: string[],
    cwd: string,
    healthUrl: string,
    env: NodeJS.ProcessEnv,
): Promise<{ stop: () => Promise<void> }> {
    const child = spawn(command, args, {
        cwd,
        env,
        stdio: ["ignore", "pipe", "pipe"],
        shell: process.platform === "win32",
    });
    let output = "";
    child.stdout?.on("data", (chunk: Buffer) => {
        output += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
        output += chunk.toString();
    });
    try {
        await waitFor(healthUrl);
    } catch (error) {
        child.kill();
        throw new Error(
            `${command} ${args.join(" ")} did not become healthy: ${error instanceof Error ? error.message : "unknown"}\n${output.slice(-2000)}`,
        );
    }
    const stop = async (): Promise<void> => {
        if (child.exitCode !== null) {
            return;
        }
        if (process.platform === "win32" && child.pid !== undefined) {
            const { spawnSync } = await import("node:child_process");
            spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
                stdio: "ignore",
            });
        } else {
            child.kill("SIGTERM");
        }
        await new Promise<void>((resolve) => {
            const timer = setTimeout(() => {
                child.kill("SIGKILL");
                resolve();
            }, 5000);
            child.once("exit", () => {
                clearTimeout(timer);
                resolve();
            });
        });
    };
    return { stop };
}

function apiEnvironment(port: number): NodeJS.ProcessEnv {
    return {
        ...process.env,
        NODE_ENV: "test",
        PORT: String(port),
        HOST: "127.0.0.1",
        API_ORIGIN: `http://127.0.0.1:${port}`,
        SITE_ORIGIN: "http://127.0.0.1:3100",
        WORKSPACE_ORIGIN: "http://127.0.0.1:5173",
        LOG_LEVEL: "error",
        API_DOCS_ENABLED: "false",
        BASIS_AUTH_ALLOW_INSECURE_HTTP: "true",
        SESSION_ENCRYPTION_KEYS: Buffer.alloc(32, 3).toString("base64"),
    };
}

await record("build contracts", async () => {
    const result = await run("bun", ["run", "--cwd", "packages/contracts", "build"], root);
    if (result.code !== 0) throw new Error(result.output.slice(-1000));
    return "tsc";
});

await record("build ui", async () => {
    const result = await run("bun", ["run", "--cwd", "packages/ui", "build"], root);
    if (result.code !== 0) throw new Error(result.output.slice(-1000));
    return "tsc";
});

await record("build api", async () => {
    const result = await run("bun", ["run", "--cwd", "apps/api", "build"], root);
    if (result.code !== 0) throw new Error(result.output.slice(-1000));
    return "tsc";
});

await record("api under node", async () => {
    const server = await startServer(
        process.execPath,
        ["dist/main.js"],
        join(root, "apps/api"),
        "http://127.0.0.1:3201/health/ready",
        apiEnvironment(3201),
    );
    try {
        const response = await fetch("http://127.0.0.1:3201/health/ready");
        if (!response.ok) throw new Error(`health ${response.status}`);
        return "health 200";
    } finally {
        await server.stop();
    }
});

await record("api under bun", async () => {
    const server = await startServer(
        "bun",
        ["dist/main.js"],
        join(root, "apps/api"),
        "http://127.0.0.1:3202/health/ready",
        apiEnvironment(3202),
    );
    try {
        const response = await fetch("http://127.0.0.1:3202/health/ready");
        if (!response.ok) throw new Error(`health ${response.status}`);
        return "health 200";
    } finally {
        await server.stop();
    }
});

if (!existsSync(join(root, "apps/site/.next"))) {
    await record("build site", async () => {
        const result = await run("bun", ["run", "--cwd", "apps/site", "build"], root, {
            ...process.env,
            PUBLIC_API_ORIGIN: "http://127.0.0.1:3203",
            WORKSPACE_ORIGIN: "http://127.0.0.1:5173",
        });
        if (result.code !== 0) throw new Error(result.output.slice(-2000));
        return "next build";
    });
}

await record("site under node", async () => {
    const server = await startServer(
        process.execPath,
        ["./node_modules/next/dist/bin/next", "start", "-p", "3203"],
        join(root, "apps/site"),
        "http://127.0.0.1:3203/",
        {
            ...process.env,
            NODE_ENV: "production",
            PUBLIC_API_ORIGIN: "http://127.0.0.1:3203",
            WORKSPACE_ORIGIN: "http://127.0.0.1:5173",
        },
    );
    try {
        const response = await fetch("http://127.0.0.1:3203/");
        if (!response.ok) throw new Error(`site ${response.status}`);
        return "HTTP 200";
    } finally {
        await server.stop();
    }
});

await record("site under bun", async () => {
    const server = await startServer(
        "bun",
        ["--bun", "next", "start", "-p", "3204"],
        join(root, "apps/site"),
        "http://127.0.0.1:3204/",
        {
            ...process.env,
            NODE_ENV: "production",
            PUBLIC_API_ORIGIN: "http://127.0.0.1:3204",
            WORKSPACE_ORIGIN: "http://127.0.0.1:5173",
        },
    );
    try {
        const response = await fetch("http://127.0.0.1:3204/");
        if (!response.ok) throw new Error(`site ${response.status}`);
        return "HTTP 200";
    } finally {
        await server.stop();
    }
});

const failures = results.filter((result) => result.status === "failed");
console.log(`\n${results.length - failures.length}/${results.length} runtime checks passed.`);
if (failures.length > 0) {
    process.exitCode = 1;
}
