import type { ReactNode } from "react";
import Link from "next/link";
import { Button, EmptyState } from "@nethack/ui/static";

export default function NotFound(): ReactNode {
    return (
        <div className="mx-auto flex w-full max-w-[800px] flex-col gap-6 px-6 py-16">
            <EmptyState
                title="Page not found"
                description="The page you requested does not exist, or it was published for a different audience."
                action={
                    <Button asChild variant="outline">
                        <Link href="/">Return home</Link>
                    </Button>
                }
            />
        </div>
    );
}
