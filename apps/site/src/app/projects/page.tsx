import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, FolderGit2, GitBranch, Sparkles } from "lucide-react";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    EmptyState,
} from "@nethack/ui/static";
import { Reveal, StaggerReveal, Tilt } from "@nethack/ui/motion";
import { getCompetitions, getProjects } from "../../lib/public-api";

export const metadata = {
    title: "Showcase",
    description: "Browse published nethack projects.",
};

export default async function ProjectsPage({
    searchParams,
}: {
    readonly searchParams: Promise<{ competition?: string }>;
}): Promise<ReactNode> {
    const { competition } = await searchParams;
    let projects: Awaited<ReturnType<typeof getProjects>> = { items: [], nextCursor: null };
    let competitions: Awaited<ReturnType<typeof getCompetitions>> = {
        items: [],
        nextCursor: null,
    };
    let unavailable = false;
    try {
        [projects, competitions] = await Promise.all([getProjects(competition), getCompetitions()]);
    } catch {
        unavailable = true;
    }

    return (
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-4 py-10 sm:px-6 md:py-14 lg:px-8">
            <Reveal className="flex flex-col gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs text-primary">
                    <Sparkles className="size-3.5" aria-hidden="true" />
                    showcase
                </span>
                <h1 className="text-3xl font-extrabold tracking-tight glow sm:text-4xl">
                    Published projects
                </h1>
                <p className="max-w-3xl text-base text-ink-muted">
                    Work that teams chose to publish after organizer review. Every project is tied
                    to a real competition edition and team.
                </p>
            </Reveal>

            <Reveal>
                <form
                    method="get"
                    className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-panel/60 p-4"
                >
                    <div className="flex min-w-56 flex-col gap-1.5">
                        <label htmlFor="competition-filter" className="text-xs text-ink-subtle">
                            Competition
                        </label>
                        <select
                            id="competition-filter"
                            name="competition"
                            defaultValue={competition ?? ""}
                            className="h-10 rounded-md border border-line bg-app px-3 text-sm text-ink transition-colors hover:border-line-strong focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25"
                        >
                            <option value="">All competitions</option>
                            {competitions.items.map((item) => (
                                <option key={item.editionId} value={item.slug}>
                                    {item.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <Button type="submit" variant="outline" color="neutral">
                        Apply filter
                    </Button>
                </form>
            </Reveal>

            {unavailable ? (
                <EmptyState
                    title="The project directory is unavailable"
                    description="The public API could not be reached. Try again shortly."
                />
            ) : projects.items.length === 0 ? (
                <EmptyState
                    title="No published projects"
                    description="Projects appear here after organizers approve them for the public showcase."
                    action={
                        <Button asChild variant="outline" color="neutral">
                            <Link href="/competitions">Browse competitions</Link>
                        </Button>
                    }
                />
            ) : (
                <StaggerReveal className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {projects.items.map((project) => (
                        <Tilt key={project.id}>
                            <Card hoverable className="h-full bg-panel/80">
                                <CardHeader>
                                    <div className="flex items-center gap-2 text-xs text-ink-subtle">
                                        <FolderGit2
                                            className="size-3.5 text-primary"
                                            aria-hidden="true"
                                        />
                                        <span className="truncate">{project.competitionName}</span>
                                    </div>
                                    <CardTitle className="text-lg">{project.title}</CardTitle>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-3">
                                    <p className="line-clamp-3 text-sm text-ink-muted">
                                        {project.summary}
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {project.tags.slice(0, 4).map((tag) => (
                                            <Badge key={tag} variant="outline" size="sm">
                                                {tag}
                                            </Badge>
                                        ))}
                                    </div>
                                    <div className="flex items-center justify-between gap-2 pt-1">
                                        <span className="inline-flex items-center gap-1 text-xs text-ink-subtle">
                                            <GitBranch className="size-3" aria-hidden="true" />
                                            {project.teamName ?? "Independent project"}
                                        </span>
                                        <Link
                                            href={`/projects/${project.slug}`}
                                            className="inline-flex items-center gap-1 text-sm text-primary transition-colors hover:text-primary-hover"
                                        >
                                            Open
                                            <ArrowRight className="size-3.5" aria-hidden="true" />
                                        </Link>
                                    </div>
                                </CardContent>
                            </Card>
                        </Tilt>
                    ))}
                </StaggerReveal>
            )}
        </div>
    );
}
