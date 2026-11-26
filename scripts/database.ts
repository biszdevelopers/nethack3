import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const action = process.argv[2] ?? "status";
const dataDirectory = join(process.cwd(), ".data", "pg");
const logFile = join(process.cwd(), ".data", "pg.log");
const pgBin =
    process.env.PG_BIN ??
    (process.platform === "win32"
        ? "C:\\Program Files\\PostgreSQL\\18\\bin"
        : "/usr/lib/postgresql/18/bin");

function pgCtl(...args: string[]): void {
    const result = spawnSync(join(pgBin, "pg_ctl"), args, { stdio: "inherit" });
    process.exitCode = result.status ?? 1;
}

if (!existsSync(dataDirectory)) {
    console.error(
        `No local PostgreSQL cluster at ${dataDirectory}. Create one with initdb before using this script.`,
    );
    process.exit(1);
}

switch (action) {
    case "start":
        pgCtl("-D", dataDirectory, "-l", logFile, "start");
        break;
    case "stop":
        pgCtl("-D", dataDirectory, "stop", "-m", "fast");
        break;
    case "restart":
        pgCtl("-D", dataDirectory, "-l", logFile, "restart");
        break;
    case "status":
        pgCtl("-D", dataDirectory, "status");
        break;
    default:
        console.error("Usage: bun run scripts/database.ts <start|stop|restart|status>");
        process.exitCode = 1;
}
