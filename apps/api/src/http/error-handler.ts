import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";
import { ZodError } from "zod";
import type { ApiError, ErrorCode } from "@nethack/contracts";
import { isAppError } from "../core/errors.js";
import type { Logger } from "../core/logger.js";

export function createErrorHandler(logger: Logger) {
    return function errorHandler(
        error: FastifyError | Error,
        request: FastifyRequest,
        reply: FastifyReply,
    ): void {
        const requestId = request.id;
        const body: ApiError = {
            error: {
                code: "internal_error",
                message: "An unexpected error occurred.",
                requestId,
            },
        };

        if (isAppError(error)) {
            body.error.code = error.code;
            body.error.message = error.exposeMessage ? error.message : "An unexpected error occurred.";
            if (error.details !== undefined) {
                body.error.details = error.details;
            }
            if (error.code === "invalid_token") {
                reply.header("www-authenticate", 'Bearer error="invalid_token"');
            }
            if (error.statusCode >= 500) {
                logger.error("Request failed with an application error.", {
                    requestId,
                    code: error.code,
                    err: { message: error.message, stack: error.stack },
                });
            }
            reply.status(error.statusCode).send(body);
            return;
        }

        if (hasZodFastifySchemaValidationErrors(error)) {
            const details: Record<string, string[]> = {};
            for (const issue of error.validation) {
                const path = (issue.instancePath ?? "").replace(/^\//, "").replaceAll("/", ".");
                const key = path.length > 0 ? path : "request";
                const list = details[key] ?? [];
                list.push(issue.message ?? "Invalid value");
                details[key] = list;
            }
            body.error = {
                code: "validation_error",
                message: "The request is invalid.",
                requestId,
                details,
            };
            reply.status(400).send(body);
            return;
        }

        if (error instanceof ZodError) {
            const details: Record<string, string[]> = {};
            for (const issue of error.issues) {
                const key = issue.path.length > 0 ? issue.path.join(".") : "request";
                const list = details[key] ?? [];
                list.push(issue.message);
                details[key] = list;
            }
            reply.status(400).send({
                error: {
                    code: "validation_error",
                    message: "The request is invalid.",
                    requestId,
                    details,
                },
            } satisfies ApiError);
            return;
        }

        const fastifyError = error as FastifyError;
        const status = fastifyError.statusCode ?? 500;
        if (status === 413) {
            reply.status(413).send({
                error: {
                    code: "payload_too_large",
                    message: "The request payload is too large.",
                    requestId,
                },
            } satisfies ApiError);
            return;
        }
        if (status === 415) {
            reply.status(415).send({
                error: {
                    code: "unsupported_media_type",
                    message: "The media type is not supported.",
                    requestId,
                },
            } satisfies ApiError);
            return;
        }
        if (status === 429) {
            reply.status(429).send({
                error: {
                    code: "rate_limited",
                    message: "Too many requests. Try again shortly.",
                    requestId,
                },
            } satisfies ApiError);
            return;
        }

        const code: ErrorCode = "internal_error";
        logger.error("Unhandled request error.", {
            requestId,
            code,
            err: { message: error.message, stack: error.stack },
        });
        reply.status(500).send(body);
    };
}
