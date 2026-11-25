import type { ReactNode } from "react";
import { EmptyState } from "@nethack/ui";

export function OrganizationPage(): ReactNode {
    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold tracking-tight">Organization</h1>
                <p className="text-sm text-ink-muted">
                    Members, roles, competition settings, and the audit log.
                </p>
            </div>
            <EmptyState
                title="Organization administration"
                description="Select an organization to manage its members and settings."
            />
        </div>
    );
}
