import type { ReactNode } from "react";
import Link from "next/link";
import { Button, EmptyState } from "@nethack/ui/static";
import { Reveal } from "@nethack/ui/motion";

export default function NotFound(): ReactNode {
    return (
        <div className="relative mx-auto flex w-full max-w-[800px] flex-col gap-6 overflow-hidden px-4 py-20 sm:px-6">
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-24 left-1/2 size-96 -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]"
            />
            <Reveal>
                <p className="text-center text-5xl font-extrabold tracking-tight text-primary glow">
                    404
                </p>
            </Reveal>
            <EmptyState
                title="Page not found"
                description="The page you requested does not exist, or it was published for a different audience."
                action={
                    <Button asChild>
                        <Link href="/">Return home</Link>
                    </Button>
                }
            />
        </div>
    );
}
