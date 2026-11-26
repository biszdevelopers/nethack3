import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import {
    jsonSchemaTransform,
    serializerCompiler,
    validatorCompiler,
    type ZodTypeProvider,
} from "fastify-type-provider-zod";
import type { ApiError, Health } from "@nethack/contracts";
import type { AuthenticationServices } from "../authentication/services.js";
import type { CapabilityRegistry } from "../core/capability-registry.js";
import type { Clock } from "../core/clock.js";
import type { AppConfig } from "../core/configuration.js";
import type { Logger } from "../core/logger.js";
import type { DatabaseConnection } from "../infrastructure/database/client.js";
import { FastifyLoggerAdapter } from "../infrastructure/logging/fastify-logger.js";
import { createErrorHandler } from "./error-handler.js";
import { AuthGuard } from "./guards.js";
import type { NethackServer } from "./types.js";
import { beginRequestSpan, endRequestSpan } from "../observability/tracing.js";

export interface BaseServer {
    readonly app: NethackServer;
    readonly logger: Logger;
}

export interface ServerServices {
    readonly config: AppConfig;
    readonly logger: Logger;
    readonly clock: Clock;
    readonly database: DatabaseConnection;
    readonly auth: AuthenticationServices;
}

export function createBaseServer(config: AppConfig): BaseServer {
    const app = Fastify({
        logger: {
            level: config.logLevel,
            redact: {
                paths: [
                    "req.headers.cookie",
                    "req.headers.authorization",
                    "req.headers['x-csrf-token']",
                    "res.headers['set-cookie']",
                    "*.accessToken",
                    "*.refreshToken",
                    "*.clientSecret",
                    "*.resourceSecret",
                ],
                censor: "[redacted]",
            },
        },
        trustProxy: config.trustProxy,
        bodyLimit: config.maxRequestBytes,
        genReqId: () => randomUUID(),
        disableRequestLogging: false,
        keepAliveTimeout: 72_000,
    }).withTypeProvider<ZodTypeProvider>();

    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    app.server.requestTimeout = 30_000;
    app.server.headersTimeout = 35_000;

    const logger = new FastifyLoggerAdapter(app.log);
    return { app, logger };
}

export async function configureServer(
    app: NethackServer,
    services: ServerServices,
    registry: CapabilityRegistry,
): Promise<void> {
    const { config, logger, database, auth } = services;

    await app.register(helmet, {
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'none'"],
                baseUri: ["'none'"],
                frameAncestors: ["'none'"],
                formAction: ["'none'"],
            },
        },
        crossOriginResourcePolicy: { policy: "same-site" },
        crossOriginOpenerPolicy: { policy: "same-origin" },
        referrerPolicy: { policy: "no-referrer" },
        ...(config.isProduction ? {} : { hsts: false }),
    });

    await app.register(cors, {
        origin: (origin, callback) => {
            if (origin === undefined) {
                callback(null, false);
                return;
            }
            const allowed = [config.origins.workspace, config.origins.site, config.origins.api];
            callback(null, allowed.includes(origin));
        },
        credentials: true,
        methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: [
            "content-type",
            "authorization",
            "x-csrf-token",
            "x-nethack-organization-id",
            "idempotency-key",
            "x-request-id",
        ],
        exposedHeaders: ["x-request-id", "retry-after"],
        maxAge: 600,
    });

    await app.register(cookie);
    await app.register(rateLimit, {
        max: config.rateLimit.max,
        timeWindow: config.rateLimit.windowMs,
        hook: "onRequest",
        keyGenerator: (request) => request.ip,
        allowList: [],
        errorResponseBuilder: (request, context) => ({
            error: {
                code: "rate_limited",
                message: "Too many requests. Try again shortly.",
                requestId: request.id,
            },
            retryAfter: context.after,
        }),
    });
    await app.register(multipart, {
        limits: {
            fileSize: config.storage.maxUploadBytes,
            files: 1,
            fields: 10,
            fieldSize: 16 * 1024,
        },
        attachFieldsToBody: false,
    });

    app.addContentTypeParser(
        "application/x-www-form-urlencoded",
        { parseAs: "string", bodyLimit: 16 * 1024 },
        (_request, body, done) => {
            try {
                done(null, new URLSearchParams(body as string));
            } catch (error) {
                done(error as Error, undefined);
            }
        },
    );

    await app.register(swagger, {
        openapi: {
            openapi: "3.1.0",
            info: {
                title: "nethack API",
                version: "1.0.0",
                description:
                    "Authoritative API for nethack. Authentication uses the application session cookie or a Basis Auth access token.",
            },
            servers: [{ url: config.origins.api, description: "Configured API origin" }],
            components: {
                securitySchemes: {
                    sessionCookie: {
                        type: "apiKey",
                        in: "cookie",
                        name: config.session.cookieName,
                    },
                    bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
                },
            },
        },
        transform: jsonSchemaTransform,
    });

    app.setErrorHandler(createErrorHandler(logger));

    app.setNotFoundHandler((request, reply) => {
        reply.status(404).send({
            error: {
                code: "not_found",
                message: "The requested resource was not found.",
                requestId: request.id,
            },
        } satisfies ApiError);
    });

    app.addHook("onRequest", async (request) => {
        request.authContext = null;
        request.startedAt = Date.now();
        beginRequestSpan(request, request.method, request.url.split("?")[0] ?? request.url);
    });

    app.addHook("onResponse", async (request, reply) => {
        endRequestSpan(request, request.method, reply.statusCode, request.routeOptions.url);
    });

    app.addHook("preHandler", async (request) => {
        if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") {
            return;
        }
        if (request.url.startsWith("/api/v1/auth/backchannel")) {
            return;
        }
        const guard = new AuthGuard(config, auth.sessions, auth.bearer);
        const context = await guard.resolve(request);
        if (context !== null && context.method === "session") {
            guard.assertOriginAndCsrf(request, context);
        }
    });

    app.addHook("onSend", async (request, reply, payload) => {
        reply.header("x-request-id", request.id);
        reply.header("x-content-type-options", "nosniff");
        if (!reply.hasHeader("cache-control")) {
            reply.header("cache-control", "private, no-store");
        }
        return payload;
    });

    app.get("/health", async (_request, reply) => {
        const health: Health = {
            status: "ok",
            version: "1.0.0",
            uptimeSeconds: Math.floor(process.uptime()),
            checks: [],
        };
        reply.header("cache-control", "no-store");
        return health;
    });

    app.get("/health/ready", async (_request, reply) => {
        try {
            await database.healthCheck();
            const health: Health = {
                status: "ok",
                version: "1.0.0",
                uptimeSeconds: Math.floor(process.uptime()),
                checks: [{ name: "database", status: "ok" }],
            };
            reply.header("cache-control", "no-store");
            return health;
        } catch {
            const health: Health = {
                status: "unavailable",
                version: "1.0.0",
                uptimeSeconds: Math.floor(process.uptime()),
                checks: [{ name: "database", status: "unavailable" }],
            };
            reply.status(503).header("cache-control", "no-store");
            return health;
        }
    });

    await registry.registerRoutes(app);

    app.get(
        "/api/v1/openapi.json",
        {
            schema: {
                hide: true,
            },
        },
        async (_request, reply) => {
            reply.header("cache-control", "public, max-age=300");
            return app.swagger();
        },
    );

    if (config.docsEnabled) {
        await app.register(swaggerUi, {
            routePrefix: "/api/docs",
            uiConfig: { deepLinking: true },
        });
    }
}
