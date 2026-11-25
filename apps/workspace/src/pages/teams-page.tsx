import type { ReactNode } from "react";
import { EmptyState } from "@nethack/ui";

export function TeamsPage(): ReactNode {
    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold tracking-tight">Teams</h1>
                <p className="text-sm text-ink-muted">
                    Form a team, invite participants, and prepare your submission together.
                </p>
            </div>
            <EmptyState
                title="No team yet"
                description="Create a team after your competition registration is approved."
            />
        </div>
    );
}
