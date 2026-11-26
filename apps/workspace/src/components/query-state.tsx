import type { ReactNode } from "react";
import { Alert, LoadingBlock } from "@nethack/ui";
import { errorMessage, errorRequestId } from "../lib/errors.js";

export function QueryErrorState({
    error,
    title = "Could not load this view",
}: {
    readonly error: unknown;
    readonly title?: string;
}): ReactNode {
    const requestId = errorRequestId(error);
    return (
        <Alert tone="critical" title={title}>
            <p>{errorMessage(error)}</p>
            {requestId === null ? null : (
                <p className="text-xs text-ink-subtle">Request {requestId}</p>
            )}
        </Alert>
    );
}

export function QueryLoading({
    label = "Loading content",
}: {
    readonly label?: string;
}): ReactNode {
    return <LoadingBlock rows={4} label={label} />;
}
