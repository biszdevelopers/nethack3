import type { ReactNode } from "react";
import { Link, useParams } from "react-router";
import {
    ActivityFeed,
    Alert,
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@nethack/ui";
import { useActiveMembership, useSession } from "../../../application/session.js";
import { OrganizationRequired } from "../../../components/organization-required.js";
import { QueryErrorState, QueryLoading } from "../../../components/query-state.js";
import { formatDateTime } from "../../../lib/format.js";
import { humanizeStatus } from "../../../lib/status.js";
import { useEdition } from "../../competitions/hooks/use-competitions.js";
import { useProjects } from "../../projects/hooks/use-projects.js";
import { useSubmissions } from "../../submissions/hooks/use-submissions.js";
import { TeamMembers } from "../components/team-members.js";
import { useTeam, useTeamActivity } from "../hooks/use-teams.js";
import { teamStatusLabel, teamStatusTone, teamSubmissionBlockMessage } from "../status.js";

export function TeamDetailPage(): ReactNode {
    const { teamId } = useParams<{ teamId: string }>();
    const { membership } = useActiveMembership();
    const session = useSession();
    const team = useTeam(teamId ?? null);
    const editionId = team.data?.editionId ?? null;
    const currentUserId = session.data?.user.id ?? null;
    const canViewActivity =
        currentUserId !== null &&
        team.data !== null &&
        team.data !== undefined &&
        team.data.members.some((member) => member.userId === currentUserId);
    const edition = useEdition(editionId);
    const activity = useTeamActivity(canViewActivity ? (teamId ?? null) : null);
    const projects = useProjects({});
    const submissions = useSubmissions({ editionId: editionId ?? undefined });

    if (membership === null) {
        return <OrganizationRequired />;
    }
    if (teamId === undefined) {
        return <QueryErrorState error={new Error("No team was selected.")} title="Team" />;
    }
    if (team.isPending) {
        return <QueryLoading label="Loading team" />;
    }
    if (team.error !== null) {
        return <QueryErrorState error={team.error} />;
    }
    if (team.data === null) {
        return <QueryErrorState error={new Error("The team was not found.")} />;
    }

    const detail = team.data;
    const isOrganizer = membership.role === "owner" || membership.role === "organizer";
    const userId = session.data?.user.id ?? null;
    const isTeamMember =
        userId !== null && detail.members.some((member) => member.userId === userId);
    const division =
        edition.data?.divisions.find((candidate) => candidate.id === detail.divisionId) ?? null;
    const teamProjects =
        projects.data?.items.filter((project) => project.teamId === detail.id) ?? [];
    const teamSubmission =
        submissions.data?.items.find((submission) => submission.teamId === detail.id) ?? null;
    const activityItems =
        activity.data?.items.map((entry) => ({
            id: entry.id,
            actor: entry.actorDisplayName ?? "System",
            action: entry.action.replaceAll(".", " ").replaceAll("_", " "),
            target: entry.entityType.replaceAll("_", " "),
            timestamp: new Date(entry.createdAt),
        })) ?? [];
    const submissionBlock = teamSubmissionBlockMessage(detail.status);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
                <Link
                    to="/teams"
                    className="w-fit text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                    Back to teams
                </Link>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex max-w-2xl flex-col gap-1">
                        <h1 className="text-2xl font-extrabold tracking-tight">{detail.name}</h1>
                        <p className="text-sm text-ink-muted">
                            {edition.data?.name ?? "Edition"} · Created{" "}
                            {formatDateTime(detail.createdAt)}
                        </p>
                    </div>
                    <Badge tone={teamStatusTone(detail.status)} size="md">
                        {teamStatusLabel(detail.status)}
                    </Badge>
                </div>
                {detail.description.length === 0 ? null : (
                    <p className="max-w-3xl text-sm text-ink-muted">{detail.description}</p>
                )}
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="flex min-w-0 flex-col gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Members</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <TeamMembers team={detail} userId={userId} isOrganizer={isOrganizer} />
                        </CardContent>
                    </Card>

                    {canViewActivity ? (
                        <Card>
                            <CardHeader>
                                <CardTitle>Activity</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {activity.isPending ? (
                                    <QueryLoading label="Loading activity" />
                                ) : activity.error !== null ? (
                                    <QueryErrorState error={activity.error} />
                                ) : (
                                    <ActivityFeed
                                        items={activityItems}
                                        label="Team activity"
                                        emptyTitle="No activity recorded"
                                        emptyDescription="Team changes are recorded here as they happen."
                                    />
                                )}
                            </CardContent>
                        </Card>
                    ) : null}
                </div>

                <div className="flex flex-col gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Team details</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <dl className="flex flex-col gap-3 text-sm">
                                <div className="flex flex-col gap-0.5">
                                    <dt className="text-xs text-ink-subtle">Edition</dt>
                                    <dd className="text-ink">
                                        {edition.isPending ? (
                                            "Loading"
                                        ) : edition.data === undefined || edition.data === null ? (
                                            detail.editionId
                                        ) : (
                                            <Link
                                                to={`/competitions/${edition.data.id}`}
                                                className="text-primary underline-offset-4 hover:underline"
                                            >
                                                {edition.data.name}
                                            </Link>
                                        )}
                                    </dd>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <dt className="text-xs text-ink-subtle">Division</dt>
                                    <dd className="text-ink">
                                        {division === null ? "No division" : division.name}
                                    </dd>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <dt className="text-xs text-ink-subtle">Captain</dt>
                                    <dd className="text-ink">
                                        {detail.members.find(
                                            (member) => member.userId === detail.captainUserId,
                                        )?.displayName ?? "Unknown"}
                                    </dd>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <dt className="text-xs text-ink-subtle">Team size</dt>
                                    <dd className="tabular-nums text-ink">
                                        {detail.memberCount} of {detail.maxMembers}
                                    </dd>
                                </div>
                            </dl>
                            {detail.lockedAt === null ? null : (
                                <Alert
                                    tone="warning"
                                    title="Team locked after submission"
                                    className="mt-4"
                                >
                                    The roster, division, and team details are fixed after the first
                                    submitted project. Ask an organizer to reopen the submission to
                                    make changes.
                                </Alert>
                            )}
                        </CardContent>
                    </Card>

                    {isTeamMember || isOrganizer ? (
                        <Card>
                            <CardHeader>
                                <CardTitle>Submission readiness</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3 text-sm">
                                {submissionBlock === null ? null : (
                                    <Alert tone="critical" title="Submissions blocked">
                                        {submissionBlock}
                                    </Alert>
                                )}
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-ink-muted">Project</span>
                                    <Badge
                                        tone={teamProjects.length > 0 ? "primary" : "outline"}
                                        size="sm"
                                    >
                                        {teamProjects.length > 0 ? "created" : "not created"}
                                    </Badge>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-ink-muted">Submission</span>
                                    <Badge
                                        tone={teamSubmission === null ? "outline" : "primary"}
                                        size="sm"
                                    >
                                        {teamSubmission === null
                                            ? "not started"
                                            : humanizeStatus(teamSubmission.status)}
                                    </Badge>
                                </div>
                                {teamProjects.length === 0 ? (
                                    submissionBlock === null ? (
                                        <Button asChild variant="outline" size="sm">
                                            <Link to="/projects">Create a project</Link>
                                        </Button>
                                    ) : null
                                ) : (
                                    <Button asChild variant="outline" size="sm">
                                        <Link to={`/projects/${teamProjects[0]?.id ?? ""}`}>
                                            Open team project
                                        </Link>
                                    </Button>
                                )}
                                {teamSubmission === null ? null : (
                                    <Button asChild variant="ghost" size="sm">
                                        <Link to={`/submissions/${teamSubmission.id}`}>
                                            Open submission
                                        </Link>
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
