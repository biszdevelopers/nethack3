import type { ReactNode } from "react";
import { EmptyState } from "@nethack/ui";

export function JudgingPage(): ReactNode {
    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold tracking-tight">Judging</h1>
                <p className="text-sm text-ink-muted">
                    Review assigned submissions, score each rubric criterion, and submit feedback.
                </p>
            </div>
            <EmptyState
                title="No judging assignments"
                description="Assignments appear after an organizer creates a rubric and assigns you to a submission."
            />
        </div>
    );
}
