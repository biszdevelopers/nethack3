import type { ReactNode } from "react";
import { Alert, Button } from "@nethack/ui";
import { describeError, errorReference } from "./errors.js";

export function RequestError({
    error,
    onRetry,
    title = "Could not load this section",
}: {
    readonly error: unknown;
    readonly onRetry?: () => void;
    readonly title?: string;
}): ReactNode {
    const reference = errorReference(error);
    return (
        <Alert tone="critical" title={title}>
            <div className="flex flex-col gap-3">
                <p>{describeError(error)}</p>
                {reference === null ? null : (
                    <p className="text-xs text-ink-subtle">Request reference: {reference}</p>
                )}
                {onRetry === undefined ? null : (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="self-start"
                        onClick={onRetry}
                    >
                        Try again
                    </Button>
                )}
            </div>
        </Alert>
    );
}
