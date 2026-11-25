import type { ReactNode } from "react";
import { EmptyState } from "@nethack/ui";

export function VotingPage(): ReactNode {
    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold tracking-tight">Voting</h1>
                <p className="text-sm text-ink-muted">
                    Cast an eligible ballot for the current voting round.
                </p>
            </div>
            <EmptyState
                title="No open voting round"
                description="Voting rounds appear here while they are open and you are eligible."
            />
        </div>
    );
}
