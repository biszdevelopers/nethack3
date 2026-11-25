import type { ReactNode } from "react";
import Link from "next/link";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState } from "@nethack/ui/static";
import { getProjects, getCompetitions } from "../../lib/public-api";

export const metadata = {
    title: "Projects",
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
        [projects, competitions] = await Promise.all([
            getProjects(competition),
            getCompetitions(),
        ]);
    } catch {
        unavailable = true;
    }

    return (
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-6 py-12">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
                <p className="max-w-2xl text-sm text-ink-muted">
                    Published work from completed and active competition editions.
                </p>
            </div>

            <form method="get" className="flex flex-wrap items-end gap-3">
                <div className="flex min-w-56 flex-col gap-1">
                    <label htmlFor="competition-filter" className="text-xs text-ink-subtle">
                        Competition
                    </label>
                    <select
                        id="competition-filter"
                        name="competition"
                        defaultValue={competition ?? ""}
                        className="h-10 rounded-md border border-line bg-app px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                        <option value="">All competitions</option>
                        {competitions.items.map((item) => (
                            <option key={item.editionId} value={item.slug}>
                                {item.name}
                            </option>
                        ))}
                    </select>
                </div>
                <Button type="submit" variant="outline">
                    Apply filter
                </Button>
            </form>

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
                        <Button asChild variant="outline">
                            <Link href="/competitions">Browse competitions</Link>
                        </Button>
                    }
                />
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {projects.items.map((project) => (
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
                                <div className="flex flex-wrap gap-1.5">
                                    {project.tags.slice(0, 4).map((tag) => (
                                        <Badge key={tag} tone="outline" size="sm">
                                            {tag}
                                        </Badge>
                                    ))}
                                </div>
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
        </div>
    );
}
