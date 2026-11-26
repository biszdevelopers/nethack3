import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:http";
import { WORKER_HEALTH_PORT } from "./config.js";

/**
 * Runs the API outbox/job worker and exposes a tiny health endpoint so
 * Playwright's webServer manager can supervise it. Notifications and file
 * scanning are produced by the worker, so the E2E stack needs it alongside the
 * API process.
 */

const worker: ChildProcess = spawn(process.execPath, ["apps/api/src/worker-main.ts"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
});

let workerExited = false;
let exitCode: number | null = null;

worker.on("exit", (code) => {
    workerExited = true;
    exitCode = code;
    console.error(`[e2e-worker] worker exited with code ${String(code)}.`);
});

const server = createServer((request, response) => {
    if (request.url !== "/health") {
        response.writeHead(404, { "content-type": "application/json" });
        response.end(JSON.stringify({ status: "not_found" }));
        return;
    }
    response.writeHead(workerExited ? 503 : 200, { "content-type": "application/json" });
    response.end(
        JSON.stringify({
            status: workerExited ? "stopped" : "ok",
            exitCode,
        }),
    );
});

server.listen(WORKER_HEALTH_PORT, "127.0.0.1", () => {
    console.log(`E2E worker health listening on http://127.0.0.1:${String(WORKER_HEALTH_PORT)}.`);
});

function shutdown(): void {
    server.close();
    if (!workerExited) {
        worker.kill();
    }
    setTimeout(() => process.exit(0), 500).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("exit", () => {
    if (!workerExited) {
        worker.kill();
    }
});
