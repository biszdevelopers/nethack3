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
    Statistics,
} from "@nethack/ui";
import type { StatisticItem } from "@nethack/ui";
import { useActiveMembership } from "../application/session.js";
import { OnboardingPanel } from "../components/onboarding-panel.js";
import { QueryErrorState, QueryLoading } from "../components/query-state.js";
import { formatDateTime, timeUntil } from "../lib/format.js";
import { humanizeStatus, statusBadgeTone } from "../lib/status.js";
import {
    useMyParticipations,
    useParticipantEditions,
} from "../capabilities/competitions/hooks/use-competitions.js";
import { useMyTeams } from "../capabilities/teams/hooks/use-teams.js";
import { useNotifications } from "../capabilities/notifications/hooks/use-notifications.js";

export function DashboardPage(): ReactNode {
    const { session, membership } = useActiveMembership();
    const participations = useMyParticipations();
    const teams = useMyTeams();
    const notifications = useNotifications();
    const unreadNotifications = useNotifications({ unread: true });
    const participantEditions = useParticipantEditions(
        participations.data?.items ?? [],
        membership?.organizationId ?? null,
    );

    const user = session.data?.user ?? null;

    if (session.data === undefined) {
        return <QueryLoading label="Loading your workspace" />;
    }
    if (membership === null) {
        return (
            <div className="flex flex-col gap-6">
                <PageHeading name={user?.displayName ?? null} />
                <OnboardingPanel hasMemberships={(session.data?.memberships.length ?? 0) > 0} />
            </div>
        );
    }

    const organizationParticipations = (participations.data?.items ?? []).filter(
        (participation) =>
            participation.organizationId === membership.organizationId &&
            participation.status !== "withdrawn" &&
            participation.status !== "rejected",
    );
    const activeTeams = teams.data?.items ?? [];
    const recentNotifications = (notifications.data?.items ?? []).slice(0, 5);
    const unreadCount = unreadNotifications.data?.items.length ?? 0;

    const allDeadlines = (participantEditions.data ?? [])
        .flatMap((edition) =>
            edition.milestones
                .filter(
                    (milestone) =>
                        new Date(milestone.occursAt).getTime() > Date.now() &&
                        participationIsActive(organizationParticipations, edition.id),
                )
                .map((milestone) => ({
                    id: milestone.id,
                    title: milestone.title,
                    editionId: edition.id,
                    editionName: edition.name,
                    occursAt: milestone.occursAt,
                })),
        )
        .toSorted(
            (left, right) => new Date(left.occursAt).getTime() - new Date(right.occursAt).getTime(),
        );
    const deadlines = allDeadlines.slice(0, 5);

    const statistics: StatisticItem[] = [
        {
            id: "participations",
            label: "Participations",
            value: organizationParticipations.length,
            hint: membership.organizationName,
        },
        {
            id: "teams",
            label: "Teams",
            value: activeTeams.length,
        },
        {
            id: "deadlines",
            label: "Upcoming milestones",
            value: allDeadlines.length,
        },
        {
            id: "unread",
            label: "Unread notifications",
            value: unreadCount,
        },
    ];

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <PageHeading name={user?.displayName ?? null} />
                <Badge tone="neutral" size="md">
                    {membership.organizationName}
                </Badge>
            </div>

            <Statistics items={statistics} columns={4} label="Workspace overview" />

            {participations.error !== null ? (
                <QueryErrorState
                    error={participations.error}
                    title="Participations could not be loaded"
                />
            ) : null}
            {teams.error !== null ? (
                <QueryErrorState error={teams.error} title="Teams could not be loaded" />
            ) : null}
            {notifications.error !== null ? (
                <QueryErrorState
                    error={notifications.error}
                    title="Notifications could not be loaded"
                />
            ) : null}

            <div className="grid gap-6 lg:grid-cols-2">
                <Card hoverable>
                    <CardHeader>
                        <CardTitle>Upcoming deadlines</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        {participations.isPending || participantEditions.isPending ? (
                            <QueryLoading label="Loading deadlines" />
                        ) : participantEditions.error !== null ? (
                            <QueryErrorState error={participantEditions.error} />
                        ) : deadlines.length === 0 ? (
                            <EmptyState
                                title="No upcoming deadlines"
                                description="Milestones from competitions you are registered for appear here."
                                action={
                                    <Button asChild variant="outline" size="sm">
                                        <Link to="/competitions">Browse competitions</Link>
                                    </Button>
                                }
                            />
                        ) : (
                            <ul className="flex flex-col divide-y divide-line">
                                {deadlines.map((deadline) => (
                                    <li
                                        key={deadline.id}
                                        className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0"
                                    >
                                        <Link
                                            to={`/competitions/${deadline.editionId}`}
                                            className="text-sm font-medium text-ink underline-offset-4 hover:underline"
                                        >
                                            {deadline.title}
                                        </Link>
                                        <span className="text-xs text-ink-muted">
                                            {deadline.editionName}
                                        </span>
                                        <span className="text-xs tabular-nums text-ink-subtle">
                                            {formatDateTime(deadline.occursAt)} ·{" "}
                                            {timeUntil(deadline.occursAt)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>

                <Card hoverable>
                    <CardHeader>
                        <CardTitle>Your participations</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        {participations.isPending ? (
                            <QueryLoading label="Loading participations" />
                        ) : organizationParticipations.length === 0 ? (
                            <EmptyState
                                title="No participations"
                                description="Register for a competition to track deadlines, teams, and submissions here."
                                action={
                                    <Button asChild variant="outline" size="sm">
                                        <Link to="/competitions">Browse competitions</Link>
                                    </Button>
                                }
                            />
                        ) : (
                            <ul className="flex flex-col divide-y divide-line">
                                {organizationParticipations.map((participation) => (
                                    <li
                                        key={participation.editionId}
                                        className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
                                    >
                                        <div className="flex min-w-0 flex-col gap-0.5">
                                            <Link
                                                to={`/competitions/${participation.editionId}`}
                                                className="truncate text-sm text-ink underline-offset-4 hover:underline"
                                            >
                                                {participation.editionName}
                                            </Link>
                                            <span className="text-xs text-ink-subtle">
                                                Registered{" "}
                                                {formatDateTime(participation.registeredAt)}
                                            </span>
                                        </div>
                                        <Badge
                                            tone={statusBadgeTone(participation.status)}
                                            size="sm"
                                        >
                                            {humanizeStatus(participation.status)}
                                        </Badge>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>

                <Card hoverable>
                    <CardHeader>
                        <CardTitle>Your teams</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        {teams.isPending ? (
                            <QueryLoading label="Loading teams" />
                        ) : activeTeams.length === 0 ? (
                            <EmptyState
                                title="No team yet"
                                description="Create a team after approval or accept an invitation."
                                action={
                                    <Button asChild variant="outline" size="sm">
                                        <Link to="/teams">Open teams</Link>
                                    </Button>
                                }
                            />
                        ) : (
                            <ul className="flex flex-col divide-y divide-line">
                                {activeTeams.map((team) => (
                                    <li
                                        key={team.id}
                                        className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
                                    >
                                        <div className="flex min-w-0 flex-col gap-0.5">
                                            <Link
                                                to={`/teams/${team.id}`}
                                                className="truncate text-sm text-ink underline-offset-4 hover:underline"
                                            >
                                                {team.name}
                                            </Link>
                                            <span className="text-xs text-ink-subtle">
                                                {team.memberCount} of {team.maxMembers} members
                                            </span>
                                        </div>
                                        <Badge tone={statusBadgeTone(team.status)} size="sm">
                                            {humanizeStatus(team.status)}
                                        </Badge>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>

                <Card hoverable>
                    <CardHeader>
                        <CardTitle>Notifications</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        {notifications.isPending ? (
                            <QueryLoading label="Loading notifications" />
                        ) : recentNotifications.length === 0 ? (
                            <EmptyState
                                title="No notifications"
                                description="Decisions, invitations, and assignments appear here."
                                action={
                                    <Button asChild variant="outline" size="sm">
                                        <Link to="/notifications">Open notifications</Link>
                                    </Button>
                                }
                            />
                        ) : (
                            <>
                                <ul className="flex flex-col divide-y divide-line">
                                    {recentNotifications.map((notification) => (
                                        <li
                                            key={notification.id}
                                            className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0"
                                        >
                                            <span className="text-sm text-ink">
                                                {notification.title}
                                            </span>
                                            <span className="text-xs text-ink-subtle">
                                                {formatDateTime(notification.createdAt)} ·{" "}
                                                {timeUntil(notification.createdAt)}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                                <Link
                                    to="/notifications"
                                    className="text-sm text-primary underline-offset-4 hover:underline"
                                >
                                    Open notifications
                                </Link>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function participationIsActive(
    participations: readonly { readonly editionId: string }[],
    editionId: string,
): boolean {
    return participations.some((participation) => participation.editionId === editionId);
}

function PageHeading({ name }: { readonly name: string | null }): ReactNode {
    return (
        <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-extrabold tracking-tight glow-sm">
                {name === null ? "Overview" : `Welcome, ${name}`}
            </h1>
            <p className="text-sm text-ink-muted">
                Your participation, team, and submissions for the selected organization.
            </p>
        </div>
    );
}
