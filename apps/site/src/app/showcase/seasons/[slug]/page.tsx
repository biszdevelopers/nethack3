import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
    ArrowLeft,
    ArrowRight,
    ArrowUpRight,
    Award,
    CalendarDays,
    ExternalLink,
    GitBranch,
} from "lucide-react";
import { slugSchema, type PublicResultEntry, type PublicTeamAward } from "@nethack/contracts";
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
import { Reveal, StaggerReveal } from "@nethack/ui/motion";
import { PublicApiError, getAllProjects, getCompetition } from "@/lib/public-api";
import { getPublicResults } from "@/lib/recognition-api";
import { toShowcaseProject } from "@/components/showcase/showcase-server";
import { safeExternalUrl, type ShowcaseProject } from "@/components/showcase/showcase-data";

interface ArchivedEntry {
    readonly project: ShowcaseProject;
    readonly rank: number | null;
    readonly awards: readonly PublicTeamAward[];
}

function formatDate(value: string | null): string {
    if (value === null) {
        return "Not scheduled";
    }
    return new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeZone: "UTC",
    }).format(new Date(value));
}

function formatStatus(status: string): string {
    return status.replaceAll("_", " ");
}

export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    if (!slugSchema.safeParse(slug).success) {
        return { title: "Season archive" };
    }
    try {
        const season = await getCompetition(slug);
        return {
            title: `${season.name} showcase archive`,
            description: season.description,
            openGraph: {
                title: season.name,
                description: season.description,
                type: "website",
            },
        };
    } catch {
        return { title: "Season archive" };
    }
}

export default async function ShowcaseSeasonPage({
    params,
}: {
    readonly params: Promise<{ slug: string }>;
}): Promise<ReactNode> {
    const { slug } = await params;
    if (!slugSchema.safeParse(slug).success) {
        notFound();
    }

    let season;
    try {
        season = await getCompetition(slug);
    } catch (error) {
        if (error instanceof PublicApiError && error.message === "Not found") {
            notFound();
        }
        throw error;
    }

    const [projectList, results] = await Promise.all([
        getAllProjects(season.slug).catch(() => null),
        getPublicResults(season.slug).catch(() => null),
    ]);

    const projectsUnavailable = projectList === null;
    let entries: ArchivedEntry[] =
        projectList === null
            ? []
            : projectList.map((project) => ({
                  project: toShowcaseProject(project),
                  rank: null,
                  awards: [],
              }));

    const ranked = new Map<string, PublicResultEntry>(
        results === null ? [] : results.judgingEntries.map((entry) => [entry.projectId, entry]),
    );

    entries = entries.map((entry) => {
        const result = ranked.get(entry.project.id);
        return {
            ...entry,
            rank: result?.rank ?? null,
            awards: result?.awards ?? [],
        };
    });

    entries.sort((left, right) => {
        const rankDifference =
            (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER);
        return rankDifference || left.project.title.localeCompare(right.project.title);
    });

    return (
        <div className="bg-app">
            <header className="border-b border-line px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
                <div className="mx-auto max-w-[1280px]">
                    <Reveal className="flex flex-col gap-4">
                        <Link
                            href="/showcase"
                            className="inline-flex w-fit min-h-10 items-center gap-2 text-sm text-primary transition-colors hover:text-primary-hover"
                        >
                            <ArrowLeft className="size-4" aria-hidden="true" />
                            All showcases
                        </Link>
                        <p className="text-xs text-primary">Season archive</p>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-ink-subtle">
                                {season.organizationName}
                            </span>
                            <span className="text-xs text-primary">/</span>
                            <span className="text-xs text-ink-subtle">{season.seriesName}</span>
                            <Badge variant="soft" color="primary" size="sm">
                                {formatStatus(season.status)}
                            </Badge>
                        </div>
                        <h1 className="break-words text-balance text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
                            {season.name}
                        </h1>
                        <p className="max-w-3xl text-base text-ink-muted">{season.description}</p>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-ink-subtle">
                            <span className="inline-flex items-center gap-1.5">
                                <CalendarDays className="size-3.5" aria-hidden="true" />
                                {formatDate(season.startsAt)} to {formatDate(season.endsAt)}
                            </span>
                            <span>
                                {season.publishedProjectCount}{" "}
                                {season.publishedProjectCount === 1
                                    ? "published project"
                                    : "published projects"}
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                            <Button asChild variant="outline" color="neutral" size="sm">
                                <Link href={`/competitions/${season.slug}`}>
                                    Open the edition
                                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                                </Link>
                            </Button>
                            <Button asChild variant="subtle" color="neutral" size="sm">
                                <Link href={`/projects?competition=${season.slug}`}>
                                    Filter all projects
                                    <ArrowRight className="size-3.5" aria-hidden="true" />
                                </Link>
                            </Button>
                        </div>
                    </Reveal>
                </div>
            </header>

            <section
                className="mx-auto w-full max-w-[1280px] px-4 py-16 sm:px-6 lg:px-8"
                aria-labelledby="season-projects-title"
            >
                <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <p className="text-xs text-primary">{season.name}</p>
                        <h2
                            id="season-projects-title"
                            className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl"
                        >
                            Published projects
                        </h2>
                    </div>
                    <p className="max-w-xl text-sm text-ink-muted">
                        Project names, descriptions, and links are preserved with their original
                        season. Ranks and awards appear once results are published.
                    </p>
                </Reveal>

                {projectsUnavailable ? (
                    <EmptyState
                        title="Projects are unavailable"
                        description="The public API could not be reached. Try again shortly."
                    />
                ) : entries.length === 0 ? (
                    <EmptyState
                        title="No published projects"
                        description="Nothing from this edition has been approved for the public showcase."
                    />
                ) : (
                    <StaggerReveal className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                        {entries.map((entry) => {
                            const repository = safeExternalUrl(entry.project.repositoryUrl);
                            const demo = safeExternalUrl(entry.project.demoUrl);
                            return (
                                <Card key={entry.project.id} variant="outline">
                                    <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="break-words text-xs text-ink-subtle">
                                                {entry.project.teamName ?? "Independent project"}
                                            </p>
                                            <CardTitle className="mt-2 break-words text-xl">
                                                <Link
                                                    href={`/projects/${entry.project.slug}`}
                                                    className="transition-colors hover:text-primary"
                                                >
                                                    {entry.project.title}
                                                </Link>
                                            </CardTitle>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {entry.rank === null ? null : (
                                                <Badge variant="soft" color="primary" size="sm">
                                                    Rank #{entry.rank}
                                                </Badge>
                                            )}
                                            {entry.awards.map((award) => (
                                                <Badge key={award.id} variant="outline" size="sm">
                                                    <Award className="size-3" aria-hidden="true" />
                                                    {award.name}
                                                </Badge>
                                            ))}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="flex flex-col gap-4">
                                        <p className="text-sm leading-6 text-ink-muted">
                                            {entry.project.summary}
                                        </p>
                                        {entry.project.descriptionMarkdown.length === 0 ? null : (
                                            <div className="border-t border-line pt-3 break-words">
                                                <Markdown
                                                    source={entry.project.descriptionMarkdown}
                                                />
                                            </div>
                                        )}
                                        <div className="flex flex-wrap items-center gap-3">
                                            <Link
                                                href={`/projects/${entry.project.slug}`}
                                                className="inline-flex min-h-9 items-center gap-1.5 border border-primary/35 px-3 text-sm text-primary transition-colors hover:bg-primary/10"
                                            >
                                                Open project
                                                <ArrowUpRight
                                                    className="size-3.5"
                                                    aria-hidden="true"
                                                />
                                            </Link>
                                            {repository === null ? null : (
                                                <a
                                                    href={repository}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex min-h-9 items-center gap-1.5 border border-line-strong px-3 text-sm text-ink-muted transition-colors hover:bg-raised hover:text-ink"
                                                >
                                                    <GitBranch
                                                        className="size-3.5"
                                                        aria-hidden="true"
                                                    />
                                                    Repository
                                                    <span className="sr-only">
                                                        {" "}
                                                        (opens in a new tab)
                                                    </span>
                                                </a>
                                            )}
                                            {demo === null ? null : (
                                                <a
                                                    href={demo}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex min-h-9 items-center gap-1.5 border border-line-strong px-3 text-sm text-ink-muted transition-colors hover:bg-raised hover:text-ink"
                                                >
                                                    <ExternalLink
                                                        className="size-3.5"
                                                        aria-hidden="true"
                                                    />
                                                    Live demo
                                                    <span className="sr-only">
                                                        {" "}
                                                        (opens in a new tab)
                                                    </span>
                                                </a>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </StaggerReveal>
                )}
            </section>
        </div>
    );
}
