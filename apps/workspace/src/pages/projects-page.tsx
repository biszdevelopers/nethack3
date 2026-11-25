import type { ReactNode } from "react";
import { EmptyState } from "@nethack/ui";

export function ProjectsPage(): ReactNode {
    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
                <p className="text-sm text-ink-muted">
                    Describe your work, attach files, and publish a showcase entry.
                </p>
            </div>
            <EmptyState
                title="No projects yet"
                description="Create a project after joining a competition."
            />
        </div>
    );
}
