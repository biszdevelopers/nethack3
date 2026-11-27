import type { ReactNode } from "react";
import Link from "next/link";
import { Button, EmptyState } from "@nethack/ui/static";
import { Reveal } from "@nethack/ui/motion";

export default function NotFound(): ReactNode {
    return (
        <div className="mx-auto flex w-full max-w-[800px] flex-col gap-6 px-4 py-20 sm:px-6">
            <Reveal>
                <p className="text-center text-5xl font-extrabold tracking-tight text-primary">
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
