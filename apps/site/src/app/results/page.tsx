import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Award, Star, Trophy } from "lucide-react";
import type { PublicResultEntry, PublicResults, PublicTeamAward } from "@nethack/contracts";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    EmptyState,
} from "@nethack/ui/static";
import { Reveal, StaggerReveal } from "@nethack/ui/motion";
import { getCompetitions, getAllProjects, PublicApiError } from "../../lib/public-api";
import { getPublicResults } from "../../lib/recognition-api";
import { ResultsProjectPreview } from "./project-preview";

export const metadata: Metadata = {
    title: "Results",
    description: "Published standings, awards, and peer recognition.",
};

function formatDate(value: string | null): string {
    if (value === null) {
        return "Not scheduled";
    }
    return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

function rankLabel(entry: PublicResultEntry): string {
    return entry.rank === null ? "Unranked" : `Rank #${String(entry.rank)}`;
}

function scoreLabel(entry: PublicResultEntry): string {
    const score = entry.displayScore ?? entry.averageScore;
    return score === null ? "Not scored" : `${score.toFixed(2)} / 100`;
}

function projectHref(entry: PublicResultEntry): string | null {
    return entry.projectSlug.length === 0 ? null : `/projects/${entry.projectSlug}`;
}

function certificateHref(entry: PublicResultEntry, showRanking: boolean): string | null {
    return entry.teamId !== null &&
        (entry.awards.length > 0 || (showRanking && entry.rank !== null))
        ? `/certificates/${entry.teamId}`
        : null;
}

interface TrackResults {
    readonly key: string;
    readonly label: string;
    readonly podium: readonly PublicResultEntry[];
    readonly rest: readonly PublicResultEntry[];
}

function byRank(left: PublicResultEntry, right: PublicResultEntry): number {
    return (
        (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER) ||
        left.projectTitle.localeCompare(right.projectTitle)
    );
}

function groupTracks(results: PublicResults): readonly TrackResults[] {
    const groups = new Map<string, PublicResultEntry[]>();
    for (const entry of results.judgingEntries) {
        const label = entry.divisionName ?? "Overall";
        const group = groups.get(label);
        if (group === undefined) {
            groups.set(label, [entry]);
        } else {
            group.push(entry);
        }
    }
    return [...groups.entries()]
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([label, entries], index) => {
            if (!results.showRanking) {
                // Rank order would still disclose standings; sort neutrally instead.
                return {
                    key: `track-${String(index)}`,
                    label,
                    podium: [],
                    rest: entries.toSorted((left, right) =>
                        left.projectTitle.localeCompare(right.projectTitle),
                    ),
                };
            }
            const podium = entries
                .filter((entry) => entry.rank !== null)
                .toSorted(byRank)
                .slice(0, 3);
            const podiumIds = new Set(podium.map((entry) => entry.submissionId));
            return {
                key: `track-${String(index)}`,
                label,
                podium,
                rest: entries.filter((entry) => !podiumIds.has(entry.submissionId)),
            };
        });
}

function AwardBadges({ awards }: { readonly awards: readonly PublicTeamAward[] }): ReactNode {
    if (awards.length === 0) {
        return null;
    }
    return (
        <div className="flex flex-wrap gap-1.5">
            {awards.map((award) => (
                <Badge key={award.id} variant="soft" color="primary" size="sm">
                    {award.name}
                </Badge>
            ))}
        </div>
    );
}

export default async function ResultsPage(): Promise<ReactNode> {
    let competitions: Awaited<ReturnType<typeof getCompetitions>> = {
        items: [],
        nextCursor: null,
    };
    let results: Awaited<ReturnType<typeof getPublicResults>> | null = null;
    let unavailable = false;

    try {
        competitions = await getCompetitions();
        for (const competition of competitions.items) {
            try {
                results = await getPublicResults(competition.slug);
                break;
            } catch (error) {
                if (error instanceof PublicApiError && error.message === "Not found") {
                    continue;
                }
                throw error;
            }
        }
    } catch {
        unavailable = true;
    }

    const pendingEdition = competitions.items[0] ?? null;
    const tracks = results === null ? [] : groupTracks(results);
    const previewProjects =
        results === null ? [] : await getAllProjects(results.edition.slug).catch(() => []);
    const previewProjectById = new Map(
        previewProjects.map((project) => [project.id, project] as const),
    );
    const projectSlugById =
        results === null
            ? new Map<string, string>()
            : new Map(results.judgingEntries.map((entry) => [entry.projectId, entry.projectSlug]));
    const peopleChoiceSubmissionId = results?.peopleChoice?.submissionId ?? null;
    const peopleChoiceEntry =
        results === null || peopleChoiceSubmissionId === null
            ? undefined
            : results.judgingEntries.find(
                  (entry) => entry.submissionId === peopleChoiceSubmissionId,
              );
    const peopleChoiceHref =
        peopleChoiceEntry === undefined || peopleChoiceEntry.projectSlug.length === 0
            ? null
            : `/projects/${peopleChoiceEntry.projectSlug}`;

    return (
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-10 px-4 py-10 sm:px-6 md:py-14 lg:px-8">
            <Reveal className="flex flex-col gap-3">
                <span className="text-xs text-primary">final standings</span>
                <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Results</h1>
                <p className="max-w-3xl text-base text-ink-muted">
                    Rankings, awards, and peer recognition published by the organizers.
                </p>
            </Reveal>

            {unavailable ? (
                <EmptyState
                    title="Results are unavailable"
                    description="The public API could not be reached. Try again shortly."
                />
            ) : results === null ? (
                <Reveal>
                    <Card variant="outline">
                        <CardHeader>
                            <CardTitle>Results not published yet</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3">
                            <p className="max-w-2xl text-sm text-ink-muted">
                                {pendingEdition === null
                                    ? "No competition has published results. Standings appear here only after organizers publish them."
                                    : `Standings for ${pendingEdition.name} appear here only after organizers publish them.`}
                            </p>
                            <div className="flex flex-wrap gap-3">
                                <Button asChild variant="outline" color="neutral">
                                    <Link href="/competitions">Browse competitions</Link>
                                </Button>
                                <Button asChild variant="subtle" color="neutral">
                                    <Link href="/projects">View projects</Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </Reveal>
            ) : (
                <>
                    <Reveal className="flex flex-col gap-2">
                        <h2 className="text-2xl font-bold tracking-tight">
                            {results.edition.name}
                        </h2>
                        <p className="text-sm text-ink-muted">
                            {results.edition.organizationName} ·{" "}
                            {formatDate(results.edition.startsAt)} to{" "}
                            {formatDate(results.edition.endsAt)}
                        </p>
                        <p className="text-xs text-ink-subtle">
                            Published {formatDate(results.publishedAt)}
                        </p>
                    </Reveal>

                    {results.peopleChoice === null ? null : (
                        <Reveal>
                            <Card variant="soft">
                                <CardHeader>
                                    <div className="flex items-center gap-2 text-xs text-primary">
                                        <Star className="size-3.5" aria-hidden="true" />
                                        People&apos;s Choice
                                    </div>
                                    <CardTitle className="text-xl">
                                        {peopleChoiceHref === null ? (
                                            results.peopleChoice.projectTitle
                                        ) : (
                                            <Link
                                                href={peopleChoiceHref}
                                                className="transition-colors hover:text-primary"
                                            >
                                                {results.peopleChoice.projectTitle}
                                            </Link>
                                        )}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-1">
                                    <p className="text-sm text-ink-muted">
                                        {results.peopleChoice.teamName ?? "Independent project"} ·{" "}
                                        {results.peopleChoice.averageStars.toFixed(2)} average stars
                                        from {String(results.peopleChoice.votes)} ballots
                                    </p>
                                    <p className="text-xs text-ink-subtle">
                                        {results.peopleChoice.roundName}
                                    </p>
                                </CardContent>
                            </Card>
                        </Reveal>
                    )}

                    {results.awards.length === 0 ? null : (
                        <section className="flex flex-col gap-5" aria-labelledby="awards-heading">
                            <h2 id="awards-heading" className="text-2xl font-bold tracking-tight">
                                Awards
                            </h2>
                            <StaggerReveal className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                {results.awards.map((award) => (
                                    <Card key={award.id} variant="outline">
                                        <CardHeader>
                                            <div className="flex items-center gap-2 text-xs text-primary">
                                                <Award className="size-3.5" aria-hidden="true" />
                                                {award.namespace}
                                            </div>
                                            <CardTitle>{award.name}</CardTitle>
                                            {award.description.length === 0 ? null : (
                                                <p className="text-sm text-ink-muted">
                                                    {award.description}
                                                </p>
                                            )}
                                        </CardHeader>
                                        <CardContent>
                                            {award.teams.length === 0 ? (
                                                <p className="text-sm text-ink-subtle">
                                                    No team has received this award.
                                                </p>
                                            ) : (
                                                <ul className="flex flex-col divide-y divide-line">
                                                    {award.teams.map((team) => {
                                                        const slug =
                                                            team.projectId === null
                                                                ? null
                                                                : (projectSlugById.get(
                                                                      team.projectId,
                                                                  ) ?? null);
                                                        return (
                                                            <li
                                                                key={team.teamId}
                                                                className="flex flex-wrap items-center justify-between gap-2 py-2"
                                                            >
                                                                <span className="min-w-0">
                                                                    <span className="block text-sm">
                                                                        {team.projectTitle ??
                                                                            team.teamName}
                                                                    </span>
                                                                    <span className="block text-xs text-ink-muted">
                                                                        {team.teamName}
                                                                        {team.note.length === 0
                                                                            ? ""
                                                                            : ` · ${team.note}`}
                                                                    </span>
                                                                </span>
                                                                <span className="flex flex-wrap items-center gap-3">
                                                                    {slug === null ||
                                                                    slug.length === 0 ? null : (
                                                                        <Link
                                                                            href={`/projects/${slug}`}
                                                                            className="text-sm text-primary transition-colors hover:text-primary-hover"
                                                                        >
                                                                            Project
                                                                        </Link>
                                                                    )}
                                                                    <Link
                                                                        href={`/certificates/${team.teamId}`}
                                                                        className="text-sm text-primary transition-colors hover:text-primary-hover"
                                                                    >
                                                                        Certificate
                                                                    </Link>
                                                                </span>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </StaggerReveal>
                        </section>
                    )}

                    <section className="flex flex-col gap-5" aria-labelledby="tracks-heading">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h2
                                id="tracks-heading"
                                className="flex items-center gap-2 text-2xl font-bold tracking-tight"
                            >
                                <Trophy className="size-5 text-primary" aria-hidden="true" />
                                Results by track
                            </h2>
                            <Button asChild variant="subtle" size="sm">
                                <Link href={`/projects?competition=${results.edition.slug}`}>
                                    View projects
                                    <ArrowRight className="size-3.5" aria-hidden="true" />
                                </Link>
                            </Button>
                        </div>

                        {results.showRanking ? null : (
                            <Card variant="outline">
                                <CardContent className="flex flex-col gap-1 pt-5">
                                    <p className="text-sm font-medium text-ink">
                                        Rankings are not public for this edition
                                    </p>
                                    <p className="text-sm text-ink-muted">
                                        Projects and awards are published, but the organizers have
                                        kept detailed rankings hidden.
                                    </p>
                                </CardContent>
                            </Card>
                        )}

                        {results.judgingEntries.length === 0 ? (
                            <EmptyState
                                title="No judged projects"
                                description="Judged submissions appear here when organizers publish results for them."
                            />
                        ) : (
                            <div className="flex flex-col gap-8">
                                {tracks.map((track) => (
                                    <section
                                        key={track.key}
                                        className="flex flex-col gap-4"
                                        aria-labelledby={`${track.key}-heading`}
                                    >
                                        <h3
                                            id={`${track.key}-heading`}
                                            className="text-xl font-bold tracking-tight"
                                        >
                                            {track.label}
                                        </h3>

                                        {track.podium.length === 0 ? null : (
                                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                                {track.podium.map((entry) => {
                                                    const project = projectHref(entry);
                                                    const certificate = certificateHref(
                                                        entry,
                                                        results.showRanking,
                                                    );
                                                    const preview = previewProjectById.get(
                                                        entry.projectId,
                                                    );
                                                    return (
                                                        <Card
                                                            key={entry.submissionId}
                                                            variant="outline"
                                                        >
                                                            <CardContent className="flex flex-col gap-2 pt-5">
                                                                <p className="text-xs font-medium text-primary">
                                                                    {rankLabel(entry)}
                                                                </p>
                                                                {project === null ? (
                                                                    <span className="break-words text-lg font-semibold text-ink">
                                                                        {entry.projectTitle}
                                                                    </span>
                                                                ) : (
                                                                    <Link
                                                                        href={project}
                                                                        className="break-words text-lg font-semibold text-ink transition-colors hover:text-primary"
                                                                    >
                                                                        {entry.projectTitle}
                                                                    </Link>
                                                                )}
                                                                <p className="break-words text-sm text-ink-muted">
                                                                    {entry.teamName ??
                                                                        "Independent project"}{" "}
                                                                    ·{" "}
                                                                    {entry.divisionName ??
                                                                        "Overall"}
                                                                </p>
                                                                <AwardBadges
                                                                    awards={entry.awards}
                                                                />
                                                                {results.showScores ? (
                                                                    <p className="text-sm tabular-nums text-ink">
                                                                        {scoreLabel(entry)}
                                                                    </p>
                                                                ) : null}
                                                                {certificate === null ? null : (
                                                                    <Link
                                                                        href={certificate}
                                                                        className="text-sm text-primary transition-colors hover:text-primary-hover"
                                                                    >
                                                                        Certificate
                                                                    </Link>
                                                                )}
                                                                {preview === undefined ? null : (
                                                                    <ResultsProjectPreview
                                                                        project={preview}
                                                                        certificateUrl={certificate}
                                                                    />
                                                                )}
                                                            </CardContent>
                                                        </Card>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {track.rest.length === 0 ? null : (
                                            <ul className="divide-y divide-line rounded-lg border border-line">
                                                {track.rest.map((entry) => {
                                                    const project = projectHref(entry);
                                                    const certificate = certificateHref(
                                                        entry,
                                                        results.showRanking,
                                                    );
                                                    const preview = previewProjectById.get(
                                                        entry.projectId,
                                                    );
                                                    return (
                                                        <li
                                                            key={entry.submissionId}
                                                            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                                                        >
                                                            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                                                                {results.showRanking ? (
                                                                    <span className="text-sm text-ink-subtle">
                                                                        {rankLabel(entry)}
                                                                    </span>
                                                                ) : null}
                                                                {project === null ? (
                                                                    <span className="break-words font-medium text-ink">
                                                                        {entry.projectTitle}
                                                                    </span>
                                                                ) : (
                                                                    <Link
                                                                        href={project}
                                                                        className="break-words font-medium text-ink transition-colors hover:text-primary"
                                                                    >
                                                                        {entry.projectTitle}
                                                                    </Link>
                                                                )}
                                                                <span className="break-words text-sm text-ink-muted">
                                                                    {entry.teamName ??
                                                                        "Independent project"}{" "}
                                                                    ·{" "}
                                                                    {entry.divisionName ??
                                                                        "Overall"}
                                                                </span>
                                                                <AwardBadges
                                                                    awards={entry.awards}
                                                                />
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-3">
                                                                {results.showScores ? (
                                                                    <span className="text-sm tabular-nums text-ink">
                                                                        {scoreLabel(entry)}
                                                                    </span>
                                                                ) : null}
                                                                {certificate === null ? null : (
                                                                    <Link
                                                                        href={certificate}
                                                                        className="text-sm text-primary transition-colors hover:text-primary-hover"
                                                                    >
                                                                        Certificate
                                                                    </Link>
                                                                )}
                                                                {preview === undefined ? null : (
                                                                    <ResultsProjectPreview
                                                                        project={preview}
                                                                        certificateUrl={certificate}
                                                                    />
                                                                )}
                                                            </div>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}
                                    </section>
                                ))}
                            </div>
                        )}
                    </section>

                    {results.votingRounds.length === 0 ? null : (
                        <section className="flex flex-col gap-5" aria-labelledby="voting-heading">
                            <h2 id="voting-heading" className="text-2xl font-bold tracking-tight">
                                Peer voting
                            </h2>
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                {results.votingRounds.map((round) => (
                                    <Card key={round.roundId} variant="outline">
                                        <CardHeader>
                                            <CardTitle>{round.roundName}</CardTitle>
                                            <p className="text-sm text-ink-muted">
                                                {String(round.totalBallots)} ballots
                                            </p>
                                        </CardHeader>
                                        <CardContent>
                                            {round.entries.length === 0 ? (
                                                <p className="text-sm text-ink-subtle">
                                                    No votes were recorded.
                                                </p>
                                            ) : (
                                                <ol className="flex flex-col divide-y divide-line">
                                                    {round.entries.map((entry) => (
                                                        <li
                                                            key={entry.submissionId}
                                                            className="flex items-center justify-between gap-3 py-2"
                                                        >
                                                            <span className="min-w-0">
                                                                <span className="block text-sm">
                                                                    {entry.projectTitle}
                                                                </span>
                                                                <span className="block text-xs text-ink-muted">
                                                                    {entry.teamName ??
                                                                        "Independent project"}
                                                                </span>
                                                            </span>
                                                            <span className="shrink-0 text-sm tabular-nums text-ink">
                                                                {entry.averageStars.toFixed(2)}
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ol>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </section>
                    )}
                </>
            )}
        </div>
    );
}
