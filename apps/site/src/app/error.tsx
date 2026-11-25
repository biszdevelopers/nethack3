"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { Button, EmptyState } from "@nethack/ui/static";

export default function GlobalError({
    error,
    reset,
}: {
    readonly error: Error & { digest?: string };
    readonly reset: () => void;
}): ReactNode {
    useEffect(() => {
        console.error("Public site error", { digest: error.digest });
    }, [error.digest]);

    return (
        <div className="mx-auto flex w-full max-w-[800px] flex-col gap-6 px-6 py-16">
            <EmptyState
                title="This page could not be loaded"
                description="The request failed before the page finished rendering. Try again; if it continues, come back later."
                action={
                    <Button variant="outline" onClick={reset}>
                        Try again
                    </Button>
                }
            />
        </div>
    );
}
