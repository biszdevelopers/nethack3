import type { ErrorCode } from "@nethack/contracts";

export interface ErrorDetail {
    readonly field: string;
    readonly messages: readonly string[];
}

export class AppError extends Error {
    readonly code: ErrorCode;
    readonly statusCode: number;
    readonly details: Readonly<Record<string, string[]>> | undefined;
    exposeMessage: boolean;

    constructor(
        code: ErrorCode,
        statusCode: number,
        message: string,
        options?: { details?: Readonly<Record<string, string[]>>; cause?: unknown },
    ) {
        super(message, options?.cause === undefined ? undefined : { cause: options.cause });
        this.name = "AppError";
        this.code = code;
        this.statusCode = statusCode;
        this.details = options?.details;
        this.exposeMessage = true;
    }
}

export class ValidationError extends AppError {
    constructor(message = "The request is invalid.", details?: Record<string, string[]>) {
        super("validation_error", 400, message, details === undefined ? undefined : { details });
    }
}

export class AuthenticationError extends AppError {
    constructor(message = "Sign in to continue.") {
        super("authentication_required", 401, message);
    }
}

export class InvalidTokenError extends AppError {
    constructor(message = "Invalid access token.") {
        super("invalid_token", 401, message);
    }
}

export class ForbiddenError extends AppError {
    constructor(message = "You do not have permission to perform this action.") {
        super("forbidden", 403, message);
    }
}

export class NotFoundError extends AppError {
    constructor(message = "The requested resource was not found.") {
        super("not_found", 404, message);
    }
}

export class ConflictError extends AppError {
    constructor(message = "The request conflicts with the current state.") {
        super("conflict", 409, message);
    }
}

export class PayloadTooLargeError extends AppError {
    constructor(message = "The request payload is too large.") {
        super("payload_too_large", 413, message);
    }
}

export class UnsupportedMediaTypeError extends AppError {
    constructor(message = "The media type is not supported.") {
        super("unsupported_media_type", 415, message);
    }
}

export class RateLimitedError extends AppError {
    constructor(message = "Too many requests. Try again shortly.") {
        super("rate_limited", 429, message);
    }
}

export class ExternalDependencyError extends AppError {
    constructor(message = "A required external service is unavailable.", cause?: unknown) {
        super(
            "external_dependency_failure",
            502,
            message,
            cause === undefined ? undefined : { cause },
        );
    }
}

export class InternalError extends AppError {
    constructor(message = "An unexpected error occurred.", cause?: unknown) {
        super("internal_error", 500, message, cause === undefined ? undefined : { cause });
        this.exposeMessage = false;
    }
}

export function isAppError(error: unknown): error is AppError {
    return error instanceof AppError;
}
