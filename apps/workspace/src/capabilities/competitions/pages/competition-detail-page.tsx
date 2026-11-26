import type { ReactNode } from "react";
import { Link, useParams } from "react-router";
import { Badge, Card, CardContent, CardHeader, CardTitle, Markdown, Timeline } from "@nethack/ui";
import type { MyParticipation } from "@nethack/contracts";
import { useActiveMembership } from "../../../application/session.js";
import { OrganizationRequired } from "../../../components/organization-required.js";
import { QueryErrorState, QueryLoading } from "../../../components/query-state.js";
import { formatDateRange, formatDateTime, isInFuture } from "../../../lib/format.js";
import { humanizeStatus, statusBadgeTone } from "../../../lib/status.js";
import { RegistrationList } from "../components/registration-list.js";
import { RegistrationPanel } from "../components/registration-panel.js";
import { useEdition, useMyParticipations } from "../hooks/use-competitions.js";

export function CompetitionDetailPage(): ReactNode {
    const { editionId } = useParams<{ editionId: string }>();
    const { membership } = useActiveMembership();
    const edition = useEdition(editionId ?? null);
    const participations = useMyParticipations();

    if (editionId === undefined) {
        return (
            <QueryErrorState
                error={new Error("No competition was selected.")}
                title="Competition"
            />
        );
    }
    if (membership === null) {
        return <OrganizationRequired />;
    }
    if (edition.isPending || participations.isPending) {
        return <QueryLoading label="Loading competition" />;
    }
    if (edition.error !== null) {
        return <QueryErrorState error={edition.error} />;
    }
    if (edition.data === null) {
        return <QueryErrorState error={new Error("The competition was not found.")} />;
    }

    const detail = edition.data;
    const isOrganizer = membership.role === "owner" || membership.role === "organizer";
    const registration: MyParticipation | null =
        participations.data?.items.find(
            (item) =>
                item.editionId === detail.id && item.organizationId === membership.organizationId,
        ) ?? null;

    const upcomingMilestones = detail.milestones
        .toSorted(
            (left, right) => new Date(left.occursAt).getTime() - new Date(right.occursAt).getTime(),
        )
        .map((milestone) => ({
            id: milestone.id,
            time: new Date(milestone.occursAt),
            title: milestone.title,
            description: milestone.description,
            status: isInFuture(milestone.occursAt)
                ? { label: "upcoming", tone: "pending" as const }
                : { label: "past", tone: "neutral" as const },
        }));

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
                <Link
                    to="/competitions"
                    className="w-fit text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                    Back to competitions
                </Link>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex max-w-2xl flex-col gap-1">
                        <h1 className="text-2xl font-extrabold tracking-tight glow-sm">{detail.name}</h1>
                        <p className="text-sm text-ink-muted">
                            {detail.seriesName} in {detail.organizationName}
                        </p>
                    </div>
                    <Badge tone={statusBadgeTone(detail.status)} size="md">
                        {humanizeStatus(detail.status)}
                    </Badge>
                </div>
                {detail.description.length === 0 ? null : (
                    <p className="max-w-3xl text-sm text-ink-muted">{detail.description}</p>
                )}
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="flex min-w-0 flex-col gap-6">
                    <RegistrationPanel edition={detail} registration={registration} />

                    <Card>
                        <CardHeader>
                            <CardTitle>Milestones</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Timeline
                                events={upcomingMilestones}
                                label="Competition milestones"
                                emptyTitle="No milestones"
                                emptyDescription="The organizers have not scheduled milestones for this edition."
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Rules</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {detail.rulesMarkdown.trim().length === 0 ? (
                                <p className="text-sm text-ink-muted">
                                    The organizers have not published rules for this edition.
                                </p>
                            ) : (
                                <Markdown source={detail.rulesMarkdown} />
                            )}
                        </CardContent>
                    </Card>

                    {isOrganizer ? (
                        <Card>
                            <CardHeader>
                                <CardTitle>Registrations</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <RegistrationList
                                    editionId={detail.id}
                                    divisions={detail.divisions}
                                />
                            </CardContent>
                        </Card>
                    ) : null}
                </div>

                <div className="flex flex-col gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Schedule</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <dl className="flex flex-col gap-3 text-sm">
                                <div className="flex flex-col gap-0.5">
                                    <dt className="text-xs text-ink-subtle">Registration</dt>
                                    <dd className="text-ink">
                                        {formatDateTime(detail.registrationOpensAt)} to{" "}
                                        {formatDateTime(detail.registrationClosesAt)}
                                    </dd>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <dt className="text-xs text-ink-subtle">Competition</dt>
                                    <dd className="text-ink">
                                        {formatDateRange(detail.startsAt, detail.endsAt)}
                                    </dd>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <dt className="text-xs text-ink-subtle">Team size</dt>
                                    <dd className="text-ink">
                                        {detail.teamMinSize} to {detail.teamMaxSize} members
                                    </dd>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <dt className="text-xs text-ink-subtle">Time zone</dt>
                                    <dd className="break-words text-ink">{detail.timezone}</dd>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <dt className="text-xs text-ink-subtle">Participants</dt>
                                    <dd className="tabular-nums text-ink">
                                        {detail.registrationCount}
                                        {detail.maxParticipants === null
                                            ? ""
                                            : ` of ${detail.maxParticipants}`}
                                    </dd>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <dt className="text-xs text-ink-subtle">Teams</dt>
                                    <dd className="tabular-nums text-ink">{detail.teamCount}</dd>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <dt className="text-xs text-ink-subtle">Submissions</dt>
                                    <dd className="tabular-nums text-ink">
                                        {detail.submissionCount}
                                    </dd>
                                </div>
                            </dl>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Divisions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {detail.divisions.length === 0 ? (
                                <p className="text-sm text-ink-muted">
                                    This edition has no divisions.
                                </p>
                            ) : (
                                <ul className="flex flex-col divide-y divide-line">
                                    {detail.divisions.map((division) => (
                                        <li
                                            key={division.id}
                                            className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0"
                                        >
                                            <span className="text-sm text-ink">
                                                {division.name}
                                            </span>
                                            {division.description.length === 0 ? null : (
                                                <span className="text-xs text-ink-muted">
                                                    {division.description}
                                                </span>
                                            )}
                                            <span className="text-xs text-ink-subtle">
                                                {division.minTeamSize === null &&
                                                division.maxTeamSize === null
                                                    ? "No division-specific team size"
                                                    : `${division.minTeamSize ?? detail.teamMinSize} to ${division.maxTeamSize ?? detail.teamMaxSize} members`}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>

                    {isOrganizer ? (
                        <Card>
                            <CardHeader>
                                <CardTitle>Organizer actions</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-2 text-sm">
                                <Link
                                    to={`/submissions?editionId=${detail.id}`}
                                    className="text-primary underline-offset-4 hover:underline"
                                >
                                    Review submissions for this edition
                                </Link>
                            </CardContent>
                        </Card>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
