import { loadLocalEnvironment } from "./bootstrap.js";
import { loadConfiguration } from "./core/configuration.js";
import { NethackRuntime } from "./core/runtime.js";
import { startTracing, stopTracing } from "./observability/tracing.js";

loadLocalEnvironment();

const config = loadConfiguration();
const runtime = new NethackRuntime({ config });
await startTracing(config, runtime.logger);

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) {
        return;
    }
    shuttingDown = true;
    runtime.logger.info("Shutting down.", { signal });
    const force = setTimeout(() => {
        runtime.logger.error("Forced shutdown after timeout.");
        process.exit(1);
    }, 15_000);
    force.unref();
    try {
        await runtime.close();
        await stopTracing();
        clearTimeout(force);
        process.exit(0);
    } catch (error) {
        runtime.logger.error("Shutdown failed.", {
            error: error instanceof Error ? error.message : "unknown",
        });
        process.exit(1);
    }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => {
    runtime.logger.error("Unhandled promise rejection.", {
        error: reason instanceof Error ? reason.message : String(reason),
    });
});
process.on("uncaughtException", (error) => {
    runtime.logger.fatal("Uncaught exception.", { error: error.message, stack: error.stack });
    void shutdown("uncaughtException");
});

await runtime.listen();
runtime.logger.info("API listening.", {
    origin: config.origins.api,
    port: config.port,
    capabilities: runtime.registry.list().map((entry) => entry.definition.id),
});
