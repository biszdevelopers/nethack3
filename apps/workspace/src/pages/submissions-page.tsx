import type { ReactNode } from "react";
import { EmptyState } from "@nethack/ui";

export function SubmissionsPage(): ReactNode {
    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold tracking-tight">Submissions</h1>
                <p className="text-sm text-ink-muted">
                    Submit a project version and track organizer review.
                </p>
            </div>
            <EmptyState
                title="No submissions yet"
                description="Submit a project when your team is ready and before the deadline."
            />
        </div>
    );
}
