import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight, CalendarClock, GitBranch, Users } from "lucide-react";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    EmptyState,
    Markdown,
} from "@nethack/ui/static";
import { Reveal, StaggerReveal, Tilt } from "@nethack/ui/motion";
import { PublicApiError, getCompetition, getCompetitionRubric } from "../../../lib/public-api";

function formatDate(value: string | null): string {
    if (value === null) {
        return "Not scheduled";
    }
    return new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));
}

export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    try {
        const competition = await getCompetition(slug);
        return {
            title: competition.name,
            description: competition.description,
            openGraph: {
                title: competition.name,
                description: competition.description,
                type: "website",
            },
        };
    } catch {
        return { title: "Competition" };
    }
}

export default async function CompetitionDetailPage({
    params,
}: {
    readonly params: Promise<{ slug: string }>;
}): Promise<ReactNode> {
    const { slug } = await params;
    let competition;
    try {
        competition = await getCompetition(slug);
    } catch (error) {
        if (error instanceof PublicApiError && error.message === "Not found") {
            notFound();
        }
        throw error;
    }

    const workspaceOrigin = process.env.WORKSPACE_ORIGIN ?? "http://localhost:5173";
    const rubrics = await getCompetitionRubric(competition.editionId).catch(() => []);

    return (
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-12 px-4 py-10 sm:px-6 md:py-14 lg:px-8">
            <Reveal className="flex flex-col gap-4">
                <Link
                    href="/competitions"
                    className="text-xs text-ink-muted transition-colors hover:text-primary"
                >
                    ← All competitions
                </Link>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-ink-subtle">{competition.organizationName}</span>
                    <Badge variant="soft" color="primary" size="sm">
                        {competition.status.replaceAll("_", " ")}
                    </Badge>
                </div>
                <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
                    {competition.name}
                </h1>
                <p className="max-w-3xl text-base text-ink-muted">{competition.description}</p>
                <div className="flex flex-wrap gap-3">
                    <Button asChild>
                        <a href={`${workspaceOrigin}/competitions/${competition.slug}`}>
                            Open in workspace
                            <ArrowUpRight className="size-4" aria-hidden="true" />
                        </a>
                    </Button>
                    <Button asChild variant="outline" color="neutral">
                        <Link href={`/competitions/${competition.slug}/rules`}>Rules</Link>
                    </Button>
                    <Button asChild variant="outline" color="neutral">
                        <Link href={`/competitions/${competition.slug}/schedule`}>Schedule</Link>
                    </Button>
                    <Button asChild variant="outline" color="neutral">
                        <a href="/calendar.ics">Add to calendar</a>
                    </Button>
                    <Button asChild variant="subtle" color="neutral">
                        <Link href={`/projects?competition=${competition.slug}`}>
                            View projects
                            <ArrowRight className="size-4" aria-hidden="true" />
                        </Link>
                    </Button>
                </div>
            </Reveal>

            {competition.themeName === null ? null : (
                <Reveal
                    delay={0.05}
                    className="flex flex-col gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] p-5"
                >
                    <span className="text-xs text-ink-subtle">Theme</span>
                    <p className="text-xl font-bold tracking-tight text-primary">
                        {competition.themeName}
                    </p>
                    {competition.themeDescription === null ? null : (
                        <p className="max-w-3xl whitespace-pre-wrap text-sm text-ink-muted">
                            {competition.themeDescription}
                        </p>
                    )}
                </Reveal>
            )}

            {rubrics.length === 0 ? null : (
                <Reveal delay={0.05} className="flex flex-col gap-4">
                    <h2 className="text-2xl font-bold tracking-tight">Judging rubric</h2>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {rubrics.map((rubric) => (
                            <Card key={`${rubric.id}-${String(rubric.version)}`}>
                                <CardHeader>
                                    <CardTitle className="text-base">
                                        {rubric.divisionName ?? "Overall"} · {rubric.name}
                                    </CardTitle>
                                    {rubric.description.length === 0 ? null : (
                                        <p className="text-sm text-ink-muted">
                                            {rubric.description}
                                        </p>
                                    )}
                                </CardHeader>
                                <CardContent className="flex flex-col gap-2">
                                    {rubric.criteria.map((criterion) => (
                                        <div
                                            key={criterion.name}
                                            className="flex flex-col gap-0.5 border-t border-line pt-2 first:border-t-0 first:pt-0"
                                        >
                                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                                                <span className="text-sm font-medium text-ink">
                                                    {criterion.name}
                                                </span>
                                                <span className="text-xs tabular-nums text-ink-subtle">
                                                    {criterion.weight}% · max{" "}
                                                    {String(criterion.maxScore)}
                                                </span>
                                            </div>
                                            {criterion.description.length === 0 ? null : (
                                                <p className="text-sm text-ink-muted">
                                                    {criterion.description}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </Reveal>
            )}

            <StaggerReveal className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card variant="soft">
                    <CardContent className="flex flex-col gap-1 pt-5">
                        <span className="inline-flex items-center gap-1.5 text-xs text-ink-subtle">
                            <CalendarClock className="size-3.5 text-primary" aria-hidden="true" />
                            Starts
                        </span>
                        <span className="text-sm">{formatDate(competition.startsAt)}</span>
                    </CardContent>
                </Card>
                <Card variant="soft">
                    <CardContent className="flex flex-col gap-1 pt-5">
                        <span className="inline-flex items-center gap-1.5 text-xs text-ink-subtle">
                            <CalendarClock className="size-3.5 text-primary" aria-hidden="true" />
                            Ends
                        </span>
                        <span className="text-sm">{formatDate(competition.endsAt)}</span>
                    </CardContent>
                </Card>
                <Card variant="soft">
                    <CardContent className="flex flex-col gap-1 pt-5">
                        <span className="inline-flex items-center gap-1.5 text-xs text-ink-subtle">
                            <CalendarClock className="size-3.5 text-primary" aria-hidden="true" />
                            Registration closes
                        </span>
                        <span className="text-sm">
                            {formatDate(competition.registrationClosesAt)}
                        </span>
                    </CardContent>
                </Card>
                <Card variant="soft">
                    <CardContent className="flex flex-col gap-1 pt-5">
                        <span className="inline-flex items-center gap-1.5 text-xs text-ink-subtle">
                            <Users className="size-3.5 text-primary" aria-hidden="true" />
                            Team size
                        </span>
                        <span className="text-sm">
                            {competition.teamMinSize}–{competition.teamMaxSize} people
                        </span>
                    </CardContent>
                </Card>
            </StaggerReveal>

            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <Reveal className="flex flex-col gap-4" y={20}>
                    <h2 id="rules" className="text-2xl font-bold tracking-tight">
                        Rules
                    </h2>
                    {competition.rulesMarkdown.trim().length === 0 ? (
                        <EmptyState
                            title="Rules not published"
                            description="The organizer has not published rules for this edition yet."
                        />
                    ) : (
                        <div className="prose-nethack">
                            <Markdown source={competition.rulesMarkdown} />
                        </div>
                    )}
                </Reveal>

                <div className="flex flex-col gap-4">
                    <Reveal>
                        <Card>
                            <CardHeader>
                                <CardTitle>Schedule</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {competition.milestones.length === 0 ? (
                                    <p className="text-sm text-ink-subtle">
                                        No milestones have been published.
                                    </p>
                                ) : (
                                    <ol className="flex flex-col gap-4">
                                        {competition.milestones.map((milestone) => (
                                            <li
                                                key={milestone.id}
                                                className="relative border-l border-line pl-4"
                                            >
                                                <span
                                                    aria-hidden="true"
                                                    className="absolute -left-[5px] top-1.5 size-2.5 rounded-full border border-primary bg-app"
                                                />
                                                <span className="text-xs text-primary">
                                                    {formatDate(milestone.occursAt)}
                                                </span>
                                                <p className="text-sm">{milestone.title}</p>
                                                {milestone.description.length === 0 ? null : (
                                                    <p className="text-xs text-ink-muted">
                                                        {milestone.description}
                                                    </p>
                                                )}
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </CardContent>
                        </Card>
                    </Reveal>

                    <Reveal delay={0.08}>
                        <Card>
                            <CardHeader>
                                <CardTitle>Divisions</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {competition.divisions.length === 0 ? (
                                    <p className="text-sm text-ink-subtle">No divisions.</p>
                                ) : (
                                    <ul className="flex flex-col gap-2">
                                        {competition.divisions.map((division) => (
                                            <li key={division.id} className="flex flex-col gap-0.5">
                                                <span className="text-sm">{division.name}</span>
                                                {division.description.length === 0 ? null : (
                                                    <span className="text-xs text-ink-muted">
                                                        {division.description}
                                                    </span>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </CardContent>
                        </Card>
                    </Reveal>
                </div>
            </div>

            <section className="flex flex-col gap-5" aria-labelledby="projects-heading">
                <Reveal className="flex flex-wrap items-center justify-between gap-3">
                    <h2 id="projects-heading" className="text-2xl font-bold tracking-tight">
                        Published projects
                    </h2>
                    <Button asChild variant="subtle" size="sm">
                        <Link href={`/projects?competition=${competition.slug}`}>
                            View all
                            <ArrowRight className="size-3.5" aria-hidden="true" />
                        </Link>
                    </Button>
                </Reveal>
                {competition.projects.length === 0 ? (
                    <EmptyState
                        title="No published projects"
                        description="Projects appear here after teams publish their work and organizers approve the showcase."
                    />
                ) : (
                    <StaggerReveal className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {competition.projects.map((project) => (
                            <Tilt key={project.id}>
                                <Card hoverable className="h-full bg-panel/80">
                                    <CardHeader>
                                        <CardTitle className="text-lg">{project.title}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="flex flex-col gap-3">
                                        <p className="line-clamp-3 text-sm text-ink-muted">
                                            {project.summary}
                                        </p>
                                        <Link
                                            href={`/projects/${project.slug}`}
                                            className="inline-flex items-center gap-1 text-sm text-primary transition-colors hover:text-primary-hover"
                                        >
                                            View project
                                            <ArrowUpRight className="size-3.5" aria-hidden="true" />
                                        </Link>
                                    </CardContent>
                                </Card>
                            </Tilt>
                        ))}
                    </StaggerReveal>
                )}
            </section>

            <Reveal className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/25 bg-primary/[0.06] p-6">
                <div className="flex items-center gap-3">
                    <GitBranch className="size-5 text-primary" aria-hidden="true" />
                    <p className="text-sm text-ink-muted">
                        Ready to take part? Registration, teams, and submissions live in the
                        workspace.
                    </p>
                </div>
                <Button asChild>
                    <a href={`${workspaceOrigin}/sign-in`}>
                        Sign in to nethack
                        <ArrowUpRight className="size-4" aria-hidden="true" />
                    </a>
                </Button>
            </Reveal>
        </div>
    );
}
