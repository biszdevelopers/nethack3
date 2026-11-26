import { ApiError } from "@nethack/api-client";

export function describeError(error: unknown): string {
    if (error instanceof ApiError) {
        if (error.status === 403) {
            return "Your organization role does not permit this action.";
        }
        if (error.status === 404) {
            return "The requested resource was not found.";
        }
        return error.message;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return "The request could not be completed.";
}

export function errorReference(error: unknown): string | null {
    if (error instanceof ApiError && error.requestId.length > 0) {
        return error.requestId;
    }
    return null;
}
