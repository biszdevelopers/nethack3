import type { ReactNode } from "react";
import { Link } from "react-router";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    EmptyState,
} from "@nethack/ui";
import { useActiveMembership, useSession } from "../application/session.js";

export function DashboardPage(): ReactNode {
    const session = useSession();
    const { membership } = useActiveMembership();
    const user = session.data?.user;
    const memberships = session.data?.memberships ?? [];

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold tracking-tight">
                    {user === undefined ? "Overview" : `Welcome, ${user.displayName}`}
                </h1>
                <p className="text-sm text-ink-muted">
                    Your participation, team, and submissions for the selected organization.
                </p>
            </div>

            {membership === null ? (
                <EmptyState
                    title="No active organization"
                    description="Join or create an organization to see competitions, teams, and submissions."
                    action={
                        <Button asChild variant="outline">
                            <Link to="/organization">Organization settings</Link>
                        </Button>
                    }
                />
            ) : (
                <>
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card>
                            <CardHeader>
                                <CardTitle>Organization</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                <span className="text-sm">{membership.organizationName}</span>
                                <Badge tone="primary" size="sm">
                                    {membership.role}
                                </Badge>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Upcoming work</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-ink-muted">
                                    Deadlines from your registered competitions appear here.
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Notifications</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                <p className="text-sm text-ink-muted">
                                    Judging assignments and organizer decisions appear in your
                                    notification inbox.
                                </p>
                                <Link
                                    to="/notifications"
                                    className="text-xs text-primary underline-offset-4 hover:underline"
                                >
                                    Open notifications
                                </Link>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Your organizations</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="flex flex-col divide-y divide-line">
                                {memberships.map((item) => (
                                    <li
                                        key={item.organizationId}
                                        className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                                    >
                                        <span className="truncate text-sm">
                                            {item.organizationName}
                                        </span>
                                        <div className="flex gap-2">
                                            <Badge tone="neutral" size="sm">
                                                {item.role}
                                            </Badge>
                                            <Badge
                                                tone={
                                                    item.status === "active" ? "primary" : "outline"
                                                }
                                                size="sm"
                                            >
                                                {item.status}
                                            </Badge>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
