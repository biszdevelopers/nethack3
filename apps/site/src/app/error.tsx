"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { Button, EmptyState } from "@nethack/ui/static";
import { Reveal } from "@nethack/ui/motion";

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
        <div className="relative mx-auto flex w-full max-w-[800px] flex-col gap-6 overflow-hidden px-4 py-20 sm:px-6">
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-24 left-1/2 size-96 -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]"
            />
            <Reveal>
                <p className="text-center text-2xl font-extrabold tracking-tight text-primary glow-sm">
                    something went wrong
                </p>
            </Reveal>
            <EmptyState
                title="This page could not be loaded"
                description="The request failed before the page finished rendering. Try again; if it continues, come back later."
                action={
                    <Button variant="outline" color="neutral" onClick={reset}>
                        Try again
                    </Button>
                }
            />
        </div>
    );
}
