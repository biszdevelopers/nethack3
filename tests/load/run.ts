import { spawn } from "node:child_process";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3002";
const script = "tests/load/api.js";

async function warmUp(): Promise<void> {
    const paths = ["/health/ready", "/api/v1/public/competitions", "/api/v1/public/projects"];
    for (let round = 0; round < 5; round += 1) {
        await Promise.all(
            paths.map(async (path) => {
                const response = await fetch(`${baseUrl}${path}`);
                if (!response.ok) {
                    throw new Error(`Warm-up request ${path} returned ${response.status}.`);
                }
                await response.arrayBuffer();
            }),
        );
    }
}

async function run(): Promise<void> {
    try {
        await warmUp();
    } catch (error) {
        console.error(
            `The API is not ready for load testing: ${error instanceof Error ? error.message : "unknown failure"}`,
        );
        process.exit(1);
    }

    const child = spawn("k6", ["run", "-e", `BASE_URL=${baseUrl}`, script], {
        stdio: "inherit",
        shell: process.platform === "win32",
    });

    child.on("exit", (code) => {
        if (code === 0) {
            process.exit(0);
        }
        console.error(
            "k6 is not installed or the load test failed. Install k6 from https://k6.io/docs/get-started/installation/ and run this script against a running API.",
        );
        process.exit(code ?? 1);
    });
}

await run();
