import type { ReactNode } from "react";
import { EmptyState } from "@nethack/ui";

export function CompetitionsPage(): ReactNode {
    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold tracking-tight">Competitions</h1>
                <p className="text-sm text-ink-muted">
                    Series, editions, divisions, and schedules for this organization.
                </p>
            </div>
            <EmptyState
                title="No competitions listed"
                description="Competitions appear here after an organizer creates a series and edition."
            />
        </div>
    );
}
