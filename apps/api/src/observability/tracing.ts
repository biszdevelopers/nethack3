import { SpanStatusCode, trace, type Span } from "@opentelemetry/api";
import type { AppConfig } from "../core/configuration.js";
import type { Logger } from "../core/logger.js";

interface TracingSdk {
    start(): void;
    shutdown(): Promise<void>;
}

let sdk: TracingSdk | null = null;

export const tracer = trace.getTracer("nethack-api");

export async function startTracing(config: AppConfig, logger: Logger): Promise<void> {
    if (config.otelEndpoint === null) {
        return;
    }
    try {
        const [{ NodeSDK }, { OTLPTraceExporter }] = await Promise.all([
            import("@opentelemetry/sdk-node"),
            import("@opentelemetry/exporter-trace-otlp-http"),
        ]);
        const exporter = new OTLPTraceExporter({
            url: new URL("/v1/traces", config.otelEndpoint).toString(),
        });
        const nodeSdk = new NodeSDK({
            serviceName: "nethack-api",
            traceExporter: exporter,
        });
        nodeSdk.start();
        sdk = nodeSdk;
        logger.info("OpenTelemetry tracing started.", { endpoint: config.otelEndpoint });
    } catch (error) {
        logger.error("OpenTelemetry tracing could not be started.", {
            error: error instanceof Error ? error.message : "unknown",
        });
    }
}

export async function stopTracing(): Promise<void> {
    if (sdk !== null) {
        await sdk.shutdown();
        sdk = null;
    }
}

const requestSpans = new WeakMap<object, Span>();

export function beginRequestSpan(request: object, method: string, path: string): void {
    const span = tracer.startSpan(`${method} ${path}`, {
        attributes: {
            "http.request.method": method,
            "url.path": path,
        },
    });
    requestSpans.set(request, span);
}

export function endRequestSpan(
    request: object,
    method: string,
    statusCode: number,
    route: string | undefined,
): void {
    const span = requestSpans.get(request);
    if (span === undefined) {
        return;
    }
    span.setAttribute("http.response.status_code", statusCode);
    if (route !== undefined && route.length > 0) {
        span.updateName(`${method} ${route}`);
        span.setAttribute("http.route", route);
    }
    if (statusCode >= 500) {
        span.setStatus({ code: SpanStatusCode.ERROR });
    }
    span.end();
    requestSpans.delete(request);
}
