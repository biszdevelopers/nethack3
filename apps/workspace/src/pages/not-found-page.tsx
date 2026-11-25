import type { ReactNode } from "react";
import { Link } from "react-router";
import { Button, EmptyState } from "@nethack/ui";

export function NotFoundPage(): ReactNode {
    return (
        <div className="flex min-h-dvh items-center justify-center p-6">
            <div className="w-full max-w-md">
                <EmptyState
                    title="Page not found"
                    description="The page you requested does not exist in this workspace."
                    action={
                        <Button asChild variant="outline">
                            <Link to="/">Back to overview</Link>
                        </Button>
                    }
                />
            </div>
        </div>
    );
}
