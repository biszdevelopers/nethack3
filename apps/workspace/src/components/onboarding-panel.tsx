import type { ReactNode } from "react";
import { Link } from "react-router";
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    EmptyState,
} from "@nethack/ui";

export function OnboardingPanel({
    hasMemberships,
}: {
    readonly hasMemberships: boolean;
}): ReactNode {
    if (hasMemberships) {
        return (
            <EmptyState
                title="Choose an organization"
                description="Your account belongs to an organization. Select it in the sidebar to open your competitions, teams, and submissions."
                action={
                    <Button asChild variant="outline">
                        <Link to="/organization">Review organization access</Link>
                    </Button>
                }
            />
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Welcome to nethack</CardTitle>
                <CardDescription>
                    Your account is active. A few steps connect it to a competition.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <ol className="flex flex-col gap-3 text-sm text-ink-muted">
                    <li className="flex gap-3">
                        <span className="font-semibold text-primary">01</span>
                        <span>
                            Ask an organizer to invite your account to their organization. The
                            invitation appears in Notifications.
                        </span>
                    </li>
                    <li className="flex gap-3">
                        <span className="font-semibold text-primary">02</span>
                        <span>
                            Accept the invitation and select the organization in the sidebar.
                        </span>
                    </li>
                    <li className="flex gap-3">
                        <span className="font-semibold text-primary">03</span>
                        <span>
                            Register for an open competition from Competitions, then create or join
                            a team.
                        </span>
                    </li>
                </ol>
                <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline">
                        <Link to="/notifications">Open notifications</Link>
                    </Button>
                    <Button asChild variant="ghost">
                        <Link to="/settings">Review account settings</Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
