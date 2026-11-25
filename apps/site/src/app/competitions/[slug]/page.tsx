import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Markdown } from "@nethack/ui/static";
import { PublicApiError, getCompetition } from "../../../lib/public-api";

function formatDate(value: string | null): string {
    if (value === null) {
        return "Not scheduled";
    }
    return new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));
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

    return (
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-10 px-6 py-12">
            <div className="flex flex-col gap-4">
                <Link href="/competitions" className="text-xs text-ink-muted hover:text-ink">
                    ← All competitions
                </Link>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-ink-subtle">{competition.organizationName}</span>
                    <Badge tone="neutral" size="sm">
                        {competition.status.replaceAll("_", " ")}
                    </Badge>
                </div>
                <h1 className="text-balance text-3xl font-semibold tracking-tight">
                    {competition.name}
                </h1>
                <p className="max-w-3xl text-sm text-ink-muted">{competition.description}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Starts</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">{formatDate(competition.startsAt)}</CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Ends</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">{formatDate(competition.endsAt)}</CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Registration closes</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">
                        {formatDate(competition.registrationClosesAt)}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Team size</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">
                        {competition.teamMinSize}–{competition.teamMaxSize} people
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
                <section className="flex flex-col gap-4" aria-labelledby="rules-heading">
                    <h2 id="rules-heading" className="text-lg font-semibold">
                        Rules
                    </h2>
                    {competition.rulesMarkdown.trim().length === 0 ? (
                        <EmptyState
                            title="Rules not published"
                            description="The organizer has not published rules for this edition yet."
                        />
                    ) : (
                        <Markdown source={competition.rulesMarkdown} />
                    )}
                </section>

                <div className="flex flex-col gap-4">
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
                                <ol className="flex flex-col gap-3">
                                    {competition.milestones.map((milestone) => (
                                        <li key={milestone.id} className="flex flex-col gap-1">
                                            <span className="text-xs text-ink-subtle">
                                                {formatDate(milestone.occursAt)}
                                            </span>
                                            <span className="text-sm">{milestone.title}</span>
                                            {milestone.description.length === 0 ? null : (
                                                <span className="text-xs text-ink-muted">
                                                    {milestone.description}
                                                </span>
                                            )}
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </CardContent>
                    </Card>

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
                                        <li key={division.id} className="flex flex-col gap-1">
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
                </div>
            </div>

            <section className="flex flex-col gap-4" aria-labelledby="projects-heading">
                <div className="flex items-center justify-between gap-3">
                    <h2 id="projects-heading" className="text-lg font-semibold">
                        Published projects
                    </h2>
                    <Button asChild variant="ghost" size="sm">
                        <Link href={`/projects?competition=${competition.slug}`}>View all</Link>
                    </Button>
                </div>
                {competition.projects.length === 0 ? (
                    <EmptyState
                        title="No published projects"
                        description="Projects appear here after teams publish their work and organizers approve the showcase."
                    />
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {competition.projects.map((project) => (
                            <Card key={project.id}>
                                <CardHeader>
                                    <CardTitle>{project.title}</CardTitle>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-3">
                                    <p className="line-clamp-3 text-sm text-ink-muted">
                                        {project.summary}
                                    </p>
                                    <Link
                                        href={`/projects/${project.slug}`}
                                        className="text-xs text-primary underline-offset-4 hover:underline"
                                    >
                                        View project
                                    </Link>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
