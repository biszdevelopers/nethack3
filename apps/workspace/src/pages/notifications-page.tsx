import type { ReactNode } from "react";
import { EmptyState } from "@nethack/ui";

export function NotificationsPage(): ReactNode {
    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
                <p className="text-sm text-ink-muted">
                    Decisions, invitations, assignments, and announcements.
                </p>
            </div>
            <EmptyState
                title="No notifications"
                description="New activity relevant to you will appear here."
            />
        </div>
    );
}
