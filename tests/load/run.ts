import { spawn } from "node:child_process";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3002";
const script = "tests/load/api.js";

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
