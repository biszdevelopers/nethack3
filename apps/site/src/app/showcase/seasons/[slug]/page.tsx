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
    FileCheck,
    GitBranch,
    Video,
} from "lucide-react";
import { slugSchema } from "@nethack/contracts";
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
import { toShowcaseProject, toShowcaseStandings } from "@/components/showcase/showcase-server";
import {
    AI_DISCLOSURE_EMPTY,
    safeExternalUrl,
    type ShowcaseProject,
} from "@/components/showcase/showcase-data";

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
    if (season.status !== "completed" && season.status !== "archived") {
        notFound();
    }

    const [projectList, results] = await Promise.all([
        getAllProjects(season.slug).catch(() => null),
        getPublicResults(season.slug).catch(() => null),
    ]);

    const projectsUnavailable = projectList === null;
    const standings = results === null ? undefined : toShowcaseStandings(results);
    const rankingsPublished = results !== null && (standings?.showRanking ?? false);
    const projects: ShowcaseProject[] =
        projectList === null
            ? []
            : projectList
                  .map((project) => toShowcaseProject(project, standings))
                  .toSorted((left, right) => {
                      if (rankingsPublished) {
                          const rankDifference =
                              (left.rank ?? Number.MAX_SAFE_INTEGER) -
                              (right.rank ?? Number.MAX_SAFE_INTEGER);
                          if (rankDifference !== 0) {
                              return rankDifference;
                          }
                      }
                      return left.title.localeCompare(right.title);
                  });

    const resultsNotice =
        projects.length === 0
            ? null
            : results === null
              ? "Results are not published for this edition yet. Project cards remain available; ranks, awards, and certificates appear after publication."
              : projects.every((project) => project.rank === null && project.awards.length === 0)
                ? "No ranks or awards were published for this edition."
                : !rankingsPublished
                  ? "The organizer has chosen not to publish rankings for this edition. Project cards remain available without ranks or a podium."
                  : null;

    const themeName =
        season.themeName === null || season.themeName.length === 0 ? null : season.themeName;
    const themeDescription =
        season.themeDescription === null || season.themeDescription.length === 0
            ? null
            : season.themeDescription;

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
                        {themeName === null && themeDescription === null ? null : (
                            <div className="max-w-3xl border-l-2 border-primary pl-4">
                                {themeName === null ? null : (
                                    <p className="text-sm font-semibold text-ink">{themeName}</p>
                                )}
                                {themeDescription === null ? null : (
                                    <p className="mt-1 text-sm leading-6 text-ink-muted">
                                        {themeDescription}
                                    </p>
                                )}
                            </div>
                        )}
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
                ) : projects.length === 0 ? (
                    <EmptyState
                        title="No published projects"
                        description="Nothing from this edition has been approved for the public showcase."
                    />
                ) : (
                    <>
                        {resultsNotice === null ? null : (
                            <p className="mb-6 border border-line bg-panel px-4 py-3 text-sm leading-6 text-ink-muted">
                                {resultsNotice}
                            </p>
                        )}
                        <StaggerReveal className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                            {projects.map((project) => {
                                const repository = safeExternalUrl(project.repositoryUrl);
                                const demo = safeExternalUrl(project.demoUrl);
                                const video = safeExternalUrl(project.videoUrl);
                                const disclosure =
                                    project.aiDisclosure.trim().length === 0
                                        ? AI_DISCLOSURE_EMPTY
                                        : project.aiDisclosure;
                                return (
                                    <Card key={project.id} variant="outline">
                                        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="break-words text-xs text-ink-subtle">
                                                    {project.teamName ?? "Independent project"}
                                                    {project.divisionName === null
                                                        ? ""
                                                        : ` · ${project.divisionName}`}
                                                </p>
                                                <CardTitle className="mt-2 break-words text-xl">
                                                    <Link
                                                        href={`/projects/${project.slug}`}
                                                        className="transition-colors hover:text-primary"
                                                    >
                                                        {project.title}
                                                    </Link>
                                                </CardTitle>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {project.showRanking && project.rank !== null ? (
                                                    <Badge variant="soft" color="primary" size="sm">
                                                        Rank #{project.rank}
                                                    </Badge>
                                                ) : null}
                                                {project.awards.map((award) => (
                                                    <Badge
                                                        key={award.id}
                                                        variant="outline"
                                                        size="sm"
                                                    >
                                                        <Award
                                                            className="size-3"
                                                            aria-hidden="true"
                                                        />
                                                        {award.name}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </CardHeader>
                                        <CardContent className="flex flex-col gap-4">
                                            <p className="text-sm leading-6 text-ink-muted">
                                                {project.summary}
                                            </p>
                                            <div className="border-t border-line pt-3">
                                                <p className="text-xs text-ink-subtle">
                                                    AI use disclosure
                                                </p>
                                                <p className="mt-1 text-sm leading-6 text-ink-muted">
                                                    {disclosure}
                                                </p>
                                            </div>
                                            {project.descriptionMarkdown.length === 0 ? null : (
                                                <div className="border-t border-line pt-3 break-words">
                                                    <Markdown
                                                        source={project.descriptionMarkdown}
                                                    />
                                                </div>
                                            )}
                                            <div className="flex flex-wrap items-center gap-3">
                                                <Link
                                                    href={`/projects/${project.slug}`}
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
                                                {video === null ? null : (
                                                    <a
                                                        href={video}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex min-h-9 items-center gap-1.5 border border-line-strong px-3 text-sm text-ink-muted transition-colors hover:bg-raised hover:text-ink"
                                                    >
                                                        <Video
                                                            className="size-3.5"
                                                            aria-hidden="true"
                                                        />
                                                        Demonstration video
                                                        <span className="sr-only">
                                                            {" "}
                                                            (opens in a new tab)
                                                        </span>
                                                    </a>
                                                )}
                                                {project.certificateUrl === null ? null : (
                                                    <Link
                                                        href={project.certificateUrl}
                                                        className="inline-flex min-h-9 items-center gap-1.5 border border-line-strong px-3 text-sm text-ink-muted transition-colors hover:bg-raised hover:text-ink"
                                                    >
                                                        <FileCheck
                                                            className="size-3.5"
                                                            aria-hidden="true"
                                                        />
                                                        Certificate
                                                    </Link>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </StaggerReveal>
                    </>
                )}
            </section>
        </div>
    );
}
