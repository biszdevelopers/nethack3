import { ApiError } from "@nethack/api-client";

export function errorMessage(
    error: unknown,
    fallback = "The request could not be completed.",
): string {
    if (error instanceof ApiError) {
        return error.message;
    }
    if (error instanceof Error && error.message.length > 0) {
        return error.message;
    }
    return fallback;
}

export function errorRequestId(error: unknown): string | null {
    return error instanceof ApiError && error.requestId.length > 0 ? error.requestId : null;
}
