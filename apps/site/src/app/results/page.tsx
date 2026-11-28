import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Award, Star, Trophy } from "lucide-react";
import type { PublicResultEntry } from "@nethack/contracts";
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
import { getCompetitions, PublicApiError } from "../../lib/public-api";
import { getPublicResults } from "../../lib/recognition-api";

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
                                        {results.peopleChoice.projectTitle}
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
                                                    {award.teams.map((team) => (
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
                                                            <Link
                                                                href={`/certificates/${team.teamId}`}
                                                                className="text-sm text-primary transition-colors hover:text-primary-hover"
                                                            >
                                                                Certificate
                                                            </Link>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </StaggerReveal>
                        </section>
                    )}

                    <section className="flex flex-col gap-5" aria-labelledby="rankings-heading">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h2
                                id="rankings-heading"
                                className="flex items-center gap-2 text-2xl font-bold tracking-tight"
                            >
                                <Trophy className="size-5 text-primary" aria-hidden="true" />
                                Rankings
                            </h2>
                            <Button asChild variant="subtle" size="sm">
                                <Link href={`/projects?competition=${results.edition.slug}`}>
                                    View projects
                                    <ArrowRight className="size-3.5" aria-hidden="true" />
                                </Link>
                            </Button>
                        </div>
                        {results.judgingEntries.length === 0 ? (
                            <EmptyState
                                title="No ranked submissions"
                                description="Judging results appear here when judges have submitted evaluations."
                            />
                        ) : (
                            <StaggerReveal className="flex flex-col gap-3">
                                {results.judgingEntries.map((entry) => (
                                    <Card key={entry.submissionId} variant="outline">
                                        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-5">
                                            <div className="flex min-w-0 items-start gap-4">
                                                <span className="shrink-0 text-sm font-semibold tabular-nums text-primary">
                                                    {entry.rank === null
                                                        ? "—"
                                                        : `#${String(entry.rank)}`}
                                                </span>
                                                <div className="min-w-0">
                                                    <p className="break-words font-medium text-ink">
                                                        {entry.projectTitle}
                                                    </p>
                                                    <p className="break-words text-sm text-ink-muted">
                                                        {entry.teamName ?? "Independent project"}
                                                        {entry.divisionName === null
                                                            ? ""
                                                            : ` · ${entry.divisionName}`}
                                                    </p>
                                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                                        {entry.awards.map((award) => (
                                                            <Badge
                                                                key={award.id}
                                                                variant="soft"
                                                                color="primary"
                                                                size="sm"
                                                            >
                                                                {award.name}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-start gap-1 sm:items-end">
                                                <span className="text-xs text-ink-subtle">
                                                    {rankLabel(entry)}
                                                </span>
                                                <span className="text-sm tabular-nums text-ink">
                                                    {entry.averageScore === null
                                                        ? "Not scored"
                                                        : `${entry.averageScore.toFixed(2)} / 100`}
                                                </span>
                                                {entry.teamId !== null &&
                                                (entry.rank !== null || entry.awards.length > 0) ? (
                                                    <Link
                                                        href={`/certificates/${entry.teamId}`}
                                                        className="text-sm text-primary transition-colors hover:text-primary-hover"
                                                    >
                                                        Certificate
                                                    </Link>
                                                ) : null}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </StaggerReveal>
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
