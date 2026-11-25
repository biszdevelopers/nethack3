import type { ReactNode } from "react";
import Link from "next/link";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    EmptyState,
} from "@nethack/ui/static";
import { getCompetitions, getProjects } from "../lib/public-api";

export const metadata = {
    title: "nethack",
};

export default async function HomePage(): Promise<ReactNode> {
    const workspaceOrigin = process.env.WORKSPACE_ORIGIN ?? "http://localhost:5173";
    let competitions: Awaited<ReturnType<typeof getCompetitions>> = {
        items: [],
        nextCursor: null,
    };
    let projects: Awaited<ReturnType<typeof getProjects>> = { items: [], nextCursor: null };
    let unavailable = false;
    try {
        [competitions, projects] = await Promise.all([getCompetitions(), getProjects()]);
    } catch {
        unavailable = true;
    }

    return (
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-20 px-6 py-16">
            <section className="flex max-w-3xl flex-col gap-5">
                <Badge tone="primary" dot>
                    hackathon platform
                </Badge>
                <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
                    Competitions run on nethack, from first registration to published results.
                </h1>
                <p className="max-w-2xl text-pretty text-base text-ink-muted">
                    nethack gives organizers one place to run a competition and gives
                    participants one place to register, form teams, submit projects, and follow
                    decisions. Eligibility, deadlines, judging, and voting are enforced by the
                    platform.
                </p>
                <div className="flex flex-wrap gap-3">
                    <Button asChild size="lg">
                        <Link href="/competitions">Browse competitions</Link>
                    </Button>
                    <Button asChild size="lg" variant="outline">
                        <a href={`${workspaceOrigin}/sign-in`}>Open workspace</a>
                    </Button>
                </div>
            </section>

            <section className="flex flex-col gap-5" aria-labelledby="competitions-heading">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="flex flex-col gap-1">
                        <h2 id="competitions-heading" className="text-xl font-semibold tracking-tight">
                            Competitions
                        </h2>
                        <p className="text-sm text-ink-muted">
                            Published editions with open or upcoming registration.
                        </p>
                    </div>
                    <Link
                        href="/competitions"
                        className="text-xs text-primary underline-offset-4 hover:underline"
                    >
                        View all competitions
                    </Link>
                </div>
                {unavailable ? (
                    <EmptyState
                        title="Competition directory is unavailable"
                        description="The public directory could not be reached. Try again shortly."
                    />
                ) : competitions.items.length === 0 ? (
                    <EmptyState
                        title="No competitions published yet"
                        description="When an organizer publishes a competition edition, it will appear here with its dates and rules."
                    />
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {competitions.items.slice(0, 6).map((competition) => (
                            <Card key={competition.editionId}>
                                <CardHeader>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="truncate text-xs text-ink-subtle">
                                            {competition.organizationName}
                                        </span>
                                        <Badge tone="neutral" size="sm">
                                            {competition.status.replaceAll("_", " ")}
                                        </Badge>
                                    </div>
                                    <CardTitle>{competition.name}</CardTitle>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-3">
                                    <p className="line-clamp-3 text-sm text-ink-muted">
                                        {competition.description}
                                    </p>
                                    <Link
                                        href={`/competitions/${competition.slug}`}
                                        className="text-xs text-primary underline-offset-4 hover:underline"
                                    >
                                        View competition
                                    </Link>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </section>

            <section className="flex flex-col gap-5" aria-labelledby="projects-heading">
                <div className="flex flex-col gap-1">
                    <h2 id="projects-heading" className="text-xl font-semibold tracking-tight">
                        Published projects
                    </h2>
                    <p className="text-sm text-ink-muted">
                        Work that teams chose to publish after organizer review.
                    </p>
                </div>
                {unavailable ? (
                    <EmptyState
                        title="Project showcase is unavailable"
                        description="The public directory could not be reached. Try again shortly."
                    />
                ) : projects.items.length === 0 ? (
                    <EmptyState
                        title="No projects published yet"
                        description="Published projects appear here after organizers approve showcase entries."
                    />
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {projects.items.slice(0, 6).map((project) => (
                            <Card key={project.id}>
                                <CardHeader>
                                    <span className="truncate text-xs text-ink-subtle">
                                        {project.competitionName}
                                    </span>
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

            <section className="grid gap-4 md:grid-cols-3" aria-label="How nethack works">
                <div className="flex flex-col gap-2 border-t border-line pt-4">
                    <span className="text-xs text-ink-subtle">1</span>
                    <h3 className="text-sm font-medium">Register for a competition</h3>
                    <p className="text-sm text-ink-muted">
                        Sign in with your organization account, choose an open edition, and wait
                        for organizer approval.
                    </p>
                </div>
                <div className="flex flex-col gap-2 border-t border-line pt-4">
                    <span className="text-xs text-ink-subtle">2</span>
                    <h3 className="text-sm font-medium">Form a team and build</h3>
                    <p className="text-sm text-ink-muted">
                        Invite approved participants, create the project record, and attach the
                        files your submission requires.
                    </p>
                </div>
                <div className="flex flex-col gap-2 border-t border-line pt-4">
                    <span className="text-xs text-ink-subtle">3</span>
                    <h3 className="text-sm font-medium">Submit and follow results</h3>
                    <p className="text-sm text-ink-muted">
                        Submit before the deadline, track organizer review, and see judging and
                        voting results when they are published.
                    </p>
                </div>
            </section>
        </div>
    );
}
