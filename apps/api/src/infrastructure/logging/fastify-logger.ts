import type { FastifyBaseLogger } from "fastify";
import type { Logger } from "../../core/logger.js";

export class FastifyLoggerAdapter implements Logger {
    private readonly log: FastifyBaseLogger;

    constructor(log: FastifyBaseLogger) {
        this.log = log;
    }

    fatal(message: string, context?: Record<string, unknown>): void {
        this.log.fatal(context ?? {}, message);
    }

    error(message: string, context?: Record<string, unknown>): void {
        this.log.error(context ?? {}, message);
    }

    warn(message: string, context?: Record<string, unknown>): void {
        this.log.warn(context ?? {}, message);
    }

    info(message: string, context?: Record<string, unknown>): void {
        this.log.info(context ?? {}, message);
    }

    debug(message: string, context?: Record<string, unknown>): void {
        this.log.debug(context ?? {}, message);
    }

    child(bindings: Record<string, unknown>): Logger {
        return new FastifyLoggerAdapter(this.log.child(bindings));
    }
}
