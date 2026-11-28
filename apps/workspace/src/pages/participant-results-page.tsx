import { useEffect, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import type { MyResults } from "@nethack/contracts";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    EmptyState,
    LoadingBlock,
    PageHeader,
} from "@nethack/ui";
import { useActiveMembership } from "../application/session.js";
import { usePublicEditionOptions } from "../capabilities/competitions/hooks.js";
import { useMyResults } from "../capabilities/recognition/hooks.js";
import { EditionSelect } from "../capabilities/shared/edition-select.js";
import { formatDateTime } from "../capabilities/shared/datetime.js";
import { RequestError } from "../capabilities/shared/states.jsx";

const SITE_ORIGIN = import.meta.env.VITE_SITE_ORIGIN ?? "";

function CertificateLink({ teamId }: { readonly teamId: string }): ReactNode {
    if (SITE_ORIGIN.length === 0) {
        return null;
    }
    return (
        <Button asChild variant="outline" size="sm">
            <a href={`${SITE_ORIGIN}/certificates/${teamId}`}>View certificate</a>
        </Button>
    );
}

function ScoreLabel({ score }: { readonly score: number | null }): ReactNode {
    return score === null ? null : (
        <span className="text-sm tabular-nums text-ink">{score.toFixed(2)} / 100</span>
    );
}

function FeedbackBlock({
    feedback,
}: {
    readonly feedback: MyResults["past"][number]["feedback"];
}): ReactNode {
    if (feedback.length === 0) {
        return null;
    }
    return (
        <div className="border-t border-line pt-3">
            <h3 className="text-sm font-medium text-ink">Anonymous judge feedback</h3>
            <ul className="mt-2 flex flex-col gap-2">
                {feedback.map((entry, index) => (
                    <li
                        key={`${entry.submittedAt ?? "feedback"}-${String(index)}`}
                        className="text-sm leading-6 text-ink-muted"
                    >
                        <p className="whitespace-pre-wrap break-words">{entry.comment}</p>
                        {entry.submittedAt === null ? null : (
                            <p className="mt-1 text-xs text-ink-subtle">
                                {formatDateTime(entry.submittedAt)}
                            </p>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}

export function ParticipantResultsPage(): ReactNode {
    const { session, membership } = useActiveMembership();
    const [searchParams, setSearchParams] = useSearchParams();

    const organizationId = membership?.organizationId ?? null;
    const organizationSlug = membership?.organizationSlug ?? null;
    const publicEditions = usePublicEditionOptions(organizationSlug, organizationId !== null);
    const editionId = searchParams.get("edition");
    const results = useMyResults(organizationId, editionId);

    useEffect(() => {
        if (editionId !== null) {
            return;
        }
        const first = publicEditions.editions[0];
        if (first === undefined) {
            return;
        }
        const params = new URLSearchParams(searchParams);
        params.set("edition", first.id);
        setSearchParams(params, { replace: true });
    }, [editionId, publicEditions.editions, searchParams, setSearchParams]);

    if (session.isPending) {
        return <LoadingBlock rows={4} label="Loading your results" />;
    }
    if (session.isError) {
        return <RequestError error={session.error} onRetry={() => void session.refetch()} />;
    }
    if (membership === null || organizationId === null) {
        return (
            <div className="flex flex-col gap-6">
                <PageHeader
                    title="Results"
                    description="Your rankings, awards, and certificates."
                />
                <EmptyState
                    title="No active organization"
                    description="Select an organization membership to view your results."
                />
            </div>
        );
    }

    const setEdition = (next: string): void => {
        const params = new URLSearchParams(searchParams);
        params.set("edition", next);
        setSearchParams(params, { replace: true });
    };

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Results"
                description="Your rank, awards, and certificates across editions."
            />

            <div className="max-w-md">
                {publicEditions.query.isPending ? (
                    <LoadingBlock rows={2} label="Loading editions" />
                ) : publicEditions.query.isError ? (
                    <RequestError
                        error={publicEditions.query.error}
                        onRetry={() => void publicEditions.query.refetch()}
                    />
                ) : publicEditions.editions.length === 0 ? (
                    <EmptyState
                        title="No competition editions"
                        description="Edition results appear here when organizers publish them."
                    />
                ) : (
                    <EditionSelect
                        editions={publicEditions.editions}
                        value={editionId ?? ""}
                        onValueChange={setEdition}
                    />
                )}
            </div>

            {editionId === null ? (
                <EmptyState
                    title="Select an edition"
                    description="Choose a competition edition to read your results."
                />
            ) : results.isPending ? (
                <LoadingBlock rows={4} label="Loading your results" />
            ) : results.isError ? (
                <RequestError error={results.error} onRetry={() => void results.refetch()} />
            ) : (
                <ResultsBody results={results.data} />
            )}
        </div>
    );
}

function ResultsBody({ results }: { readonly results: MyResults }): ReactNode {
    return (
        <div className="flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <CardTitle>Current results</CardTitle>
                        <Badge tone={results.published ? "primary" : "neutral"}>
                            {results.published ? "Published" : "Not published"}
                        </Badge>
                    </div>
                    <CardDescription>
                        {results.publishedAt === null
                            ? "Organizers have not published this edition yet."
                            : `Published ${formatDateTime(results.publishedAt)}.`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {results.current === null ? (
                        <EmptyState
                            title="No team in this edition"
                            description="You do not have a team in this edition, so there are no results to show."
                        />
                    ) : (
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-sm font-medium">
                                        {results.current.teamName}
                                    </span>
                                    <span className="text-xs text-ink-muted">
                                        {results.published
                                            ? results.current.rank === null
                                                ? "Unranked"
                                                : `Rank #${String(results.current.rank)}`
                                            : "Results are not published yet."}
                                    </span>
                                    {results.published ? (
                                        <ScoreLabel score={results.current.score} />
                                    ) : null}
                                </div>
                                {results.published &&
                                (results.current.rank !== null ||
                                    results.current.awards.length > 0) ? (
                                    <CertificateLink teamId={results.current.teamId} />
                                ) : null}
                            </div>
                            {results.current.awards.length === 0 ? null : (
                                <div className="flex flex-wrap gap-2">
                                    {results.current.awards.map((award) => (
                                        <Badge key={award.id} tone="primary" size="sm">
                                            {award.name}
                                        </Badge>
                                    ))}
                                </div>
                            )}
                            {results.published ? (
                                <FeedbackBlock feedback={results.current.feedback} />
                            ) : null}
                        </div>
                    )}
                </CardContent>
            </Card>

            <section className="flex flex-col gap-4" aria-labelledby="past-results-heading">
                <div className="flex flex-col gap-1">
                    <h2 id="past-results-heading" className="text-lg font-bold tracking-tight">
                        Past editions
                    </h2>
                    <p className="text-sm text-ink-muted">
                        Published results for editions where you had a team.
                    </p>
                </div>
                {results.past.length === 0 ? (
                    <EmptyState
                        title="No past results"
                        description="Published results from your previous teams appear here."
                    />
                ) : (
                    <div className="flex flex-col gap-3">
                        {results.past.map((entry) => (
                            <Card key={entry.editionId}>
                                <CardHeader>
                                    <CardTitle>{entry.editionName}</CardTitle>
                                    <CardDescription>
                                        {entry.teamName} · published{" "}
                                        {formatDateTime(entry.publishedAt)}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-3">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm">
                                                {entry.rank === null
                                                    ? "Unranked"
                                                    : `Rank #${String(entry.rank)}`}
                                            </span>
                                            <ScoreLabel score={entry.score} />
                                            {entry.awards.map((award) => (
                                                <Badge key={award.id} tone="primary" size="sm">
                                                    {award.name}
                                                </Badge>
                                            ))}
                                        </div>
                                        {entry.rank !== null || entry.awards.length > 0 ? (
                                            <CertificateLink teamId={entry.teamId} />
                                        ) : null}
                                    </div>
                                    <FeedbackBlock feedback={entry.feedback} />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
