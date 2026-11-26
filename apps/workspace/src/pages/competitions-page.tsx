import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState } from "@nethack/ui";
import type { CompetitionSeries, MyParticipation, PublicCompetition } from "@nethack/contracts";
import { useActiveMembership } from "../application/session.js";
import { OrganizationRequired } from "../components/organization-required.js";
import { QueryErrorState, QueryLoading } from "../components/query-state.js";
import { formatDateRange, formatDateTime } from "../lib/format.js";
import { humanizeStatus, statusBadgeTone } from "../lib/status.js";
import { NewEditionDialog } from "../capabilities/competitions/components/new-edition-dialog.js";
import { NewSeriesDialog } from "../capabilities/competitions/components/new-series-dialog.js";
import {
    useCompetitionSeries,
    useMyParticipations,
    usePublicCompetitions,
} from "../capabilities/competitions/hooks/use-competitions.js";

interface EditionEntry {
    readonly id: string;
    readonly name: string;
    readonly status: string | null;
    readonly publicEntry: PublicCompetition | null;
    readonly participation: MyParticipation | null;
}

function toEditionEntries(
    publicItems: readonly PublicCompetition[],
    participations: readonly MyParticipation[],
    organizationSlug: string,
    organizationId: string,
): EditionEntry[] {
    const entries = new Map<string, EditionEntry>();
    for (const item of publicItems) {
        if (item.organizationSlug !== organizationSlug) {
            continue;
        }
        entries.set(item.editionId, {
            id: item.editionId,
            name: item.name,
            status: item.status,
            publicEntry: item,
            participation: null,
        });
    }
    for (const participation of participations) {
        if (participation.organizationId !== organizationId) {
            continue;
        }
        const existing = entries.get(participation.editionId);
        if (existing === undefined) {
            entries.set(participation.editionId, {
                id: participation.editionId,
                name: participation.editionName,
                status: null,
                publicEntry: null,
                participation,
            });
        } else {
            entries.set(participation.editionId, { ...existing, participation });
        }
    }
    return [...entries.values()];
}

export function CompetitionsPage(): ReactNode {
    const { membership } = useActiveMembership();
    const navigate = useNavigate();
    const [seriesDialogOpen, setSeriesDialogOpen] = useState(false);
    const [editionSeries, setEditionSeries] = useState<CompetitionSeries | null>(null);
    const organizationId = membership?.organizationId ?? null;
    const series = useCompetitionSeries(organizationId);
    const publicCompetitions = usePublicCompetitions(membership !== null);
    const participations = useMyParticipations();

    if (membership === null || organizationId === null) {
        return (
            <div className="flex flex-col gap-6">
                <PageHeading />
                <OrganizationRequired />
            </div>
        );
    }

    const isOrganizer = membership.role === "owner" || membership.role === "organizer";
    const editions = toEditionEntries(
        publicCompetitions.data?.items ?? [],
        participations.data?.items ?? [],
        membership.organizationSlug,
        organizationId,
    );

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <PageHeading />
                {isOrganizer ? (
                    <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline" color="neutral">
                            <Link to="/competitions/manage">Manage competition</Link>
                        </Button>
                        <Button onClick={() => setSeriesDialogOpen(true)}>New series</Button>
                    </div>
                ) : null}
            </div>

            <section className="flex flex-col gap-3" aria-label="Editions">
                <div className="flex flex-col gap-1">
                    <h2 className="text-lg font-bold tracking-tight">Editions</h2>
                    <p className="text-sm text-ink-muted">
                        Published editions and the editions you are registered for.
                    </p>
                </div>
                {publicCompetitions.isPending || participations.isPending ? (
                    <QueryLoading label="Loading editions" />
                ) : publicCompetitions.error !== null ? (
                    <QueryErrorState error={publicCompetitions.error} />
                ) : editions.length === 0 ? (
                    <EmptyState
                        title="No editions listed"
                        description={
                            isOrganizer
                                ? "Create a series, then add an edition to open registration."
                                : "Editions appear here once an organizer publishes one."
                        }
                        action={
                            isOrganizer ? (
                                <Button variant="outline" onClick={() => setSeriesDialogOpen(true)}>
                                    New series
                                </Button>
                            ) : undefined
                        }
                    />
                ) : (
                    <ul className="grid gap-4 md:grid-cols-2">
                        {editions.map((edition) => (
                            <li key={edition.id}>
                                <Card hoverable className="flex h-full flex-col">
                                    <CardHeader>
                                        <div className="flex items-start justify-between gap-3">
                                            <CardTitle>{edition.name}</CardTitle>
                                            <div className="flex flex-wrap justify-end gap-2">
                                                {edition.status === null ? null : (
                                                    <Badge
                                                        tone={statusBadgeTone(edition.status)}
                                                        size="sm"
                                                    >
                                                        {humanizeStatus(edition.status)}
                                                    </Badge>
                                                )}
                                                {edition.participation === null ? null : (
                                                    <Badge
                                                        tone={statusBadgeTone(
                                                            edition.participation.status,
                                                        )}
                                                        size="sm"
                                                    >
                                                        {humanizeStatus(
                                                            edition.participation.status,
                                                        )}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        {edition.publicEntry === null ? null : (
                                            <p className="text-xs text-ink-subtle">
                                                {edition.publicEntry.seriesName}
                                            </p>
                                        )}
                                    </CardHeader>
                                    <CardContent className="flex flex-1 flex-col gap-3">
                                        {edition.publicEntry === null ? (
                                            <p className="text-sm text-ink-muted">
                                                {edition.participation === null
                                                    ? "Registration details are managed by the organizers."
                                                    : "You are registered for this edition."}
                                            </p>
                                        ) : (
                                            <>
                                                <p className="text-sm text-ink-muted">
                                                    {edition.publicEntry.description}
                                                </p>
                                                <dl className="flex flex-col gap-1 text-xs text-ink-subtle">
                                                    <div className="flex justify-between gap-3">
                                                        <dt>Dates</dt>
                                                        <dd className="text-right text-ink-muted">
                                                            {formatDateRange(
                                                                edition.publicEntry.startsAt,
                                                                edition.publicEntry.endsAt,
                                                            )}
                                                        </dd>
                                                    </div>
                                                    <div className="flex justify-between gap-3">
                                                        <dt>Registration closes</dt>
                                                        <dd className="text-right text-ink-muted">
                                                            {formatDateTime(
                                                                edition.publicEntry
                                                                    .registrationClosesAt,
                                                            )}
                                                        </dd>
                                                    </div>
                                                    <div className="flex justify-between gap-3">
                                                        <dt>Team size</dt>
                                                        <dd className="text-right text-ink-muted">
                                                            {edition.publicEntry.teamMinSize} to{" "}
                                                            {edition.publicEntry.teamMaxSize}{" "}
                                                            members
                                                        </dd>
                                                    </div>
                                                    <div className="flex justify-between gap-3">
                                                        <dt>Published projects</dt>
                                                        <dd className="text-right tabular-nums text-ink-muted">
                                                            {
                                                                edition.publicEntry
                                                                    .publishedProjectCount
                                                            }
                                                        </dd>
                                                    </div>
                                                </dl>
                                            </>
                                        )}
                                        <div className="mt-auto flex flex-wrap items-center gap-2">
                                            <Button asChild variant="outline" size="sm">
                                                <Link to={`/competitions/${edition.id}`}>
                                                    Open edition
                                                </Link>
                                            </Button>
                                            {isOrganizer && edition.publicEntry === null ? (
                                                <span className="text-xs text-ink-subtle">
                                                    Not publicly listed yet.
                                                </span>
                                            ) : null}
                                        </div>
                                    </CardContent>
                                </Card>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="flex flex-col gap-3" aria-label="Series">
                <div className="flex flex-col gap-1">
                    <h2 className="text-lg font-bold tracking-tight">Series</h2>
                    <p className="text-sm text-ink-muted">
                        Competition series owned by {membership.organizationName}.
                    </p>
                </div>
                {series.isPending ? (
                    <QueryLoading label="Loading series" />
                ) : series.error !== null ? (
                    <QueryErrorState error={series.error} />
                ) : series.data.items.length === 0 ? (
                    <EmptyState
                        title="No competition series"
                        description={
                            isOrganizer
                                ? "A series is the container for editions. Create one to schedule the first edition."
                                : "An organizer has not created a competition series yet."
                        }
                    />
                ) : (
                    <ul className="flex flex-col gap-3">
                        {series.data.items.map((item) => (
                            <li key={item.id}>
                                <Card hoverable>
                                    <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="flex min-w-0 flex-col gap-1">
                                            <span className="text-sm font-medium text-ink">
                                                {item.name}
                                            </span>
                                            <span className="text-xs text-ink-subtle">
                                                {item.slug}
                                            </span>
                                            {item.description.length === 0 ? null : (
                                                <span className="text-sm text-ink-muted">
                                                    {item.description}
                                                </span>
                                            )}
                                        </div>
                                        {isOrganizer ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setEditionSeries(item)}
                                            >
                                                New edition
                                            </Button>
                                        ) : null}
                                    </CardContent>
                                </Card>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <NewSeriesDialog
                organizationId={organizationId}
                open={seriesDialogOpen}
                onOpenChange={setSeriesDialogOpen}
            />
            <NewEditionDialog
                organizationId={organizationId}
                series={editionSeries}
                open={editionSeries !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setEditionSeries(null);
                    }
                }}
                onCreated={(editionId) => {
                    navigate(`/competitions/${editionId}`);
                }}
            />
        </div>
    );
}

function PageHeading(): ReactNode {
    return (
        <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-extrabold tracking-tight glow-sm">Competitions</h1>
            <p className="text-sm text-ink-muted">
                Series, editions, divisions, and schedules for this organization.
            </p>
        </div>
    );
}
