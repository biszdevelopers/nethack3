import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Award, CalendarDays, Trophy, Users } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle, Markdown } from "@nethack/ui/static";
import { Reveal } from "@nethack/ui/motion";
import { PublicApiError, getProject } from "../../../lib/public-api";
import { getPublicResults } from "../../../lib/recognition-api";
import { safeExternalUrl } from "../project-links";

export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    try {
        const project = await getProject(slug);
        return {
            title: project.title,
            description: project.summary,
            openGraph: {
                title: project.title,
                description: project.summary,
                type: "article",
            },
        };
    } catch {
        return { title: "Project" };
    }
}

export default async function ProjectDetailPage({
    params,
}: {
    readonly params: Promise<{ slug: string }>;
}): Promise<ReactNode> {
    const { slug } = await params;
    let project;
    try {
        project = await getProject(slug);
    } catch (error) {
        if (error instanceof PublicApiError && error.message === "Not found") {
            notFound();
        }
        throw error;
    }

    const links = [
        { label: "Repository", href: safeExternalUrl(project.repositoryUrl) },
        { label: "Live demo", href: safeExternalUrl(project.demoUrl) },
        { label: "Demonstration video", href: safeExternalUrl(project.videoUrl) },
    ].filter((entry): entry is { label: string; href: string } => entry.href !== null);

    const results = await getPublicResults(project.competitionSlug).catch(() => null);
    const resultEntry =
        results === null
            ? null
            : (results.judgingEntries.find((entry) => entry.projectId === project.id) ?? null);
    const certificate =
        project.teamId !== null &&
        resultEntry !== null &&
        (resultEntry.awards.length > 0 ||
            (results?.showRanking === true && resultEntry.rank !== null))
            ? `/certificates/${project.teamId}`
            : null;

    return (
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-10 px-4 py-10 sm:px-6 md:py-14 lg:px-8">
            <Reveal className="relative flex flex-col gap-4">
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-20 left-1/3 size-80 rounded-full bg-primary/10 blur-[110px]"
                />
                <Link
                    href="/projects"
                    className="text-xs text-ink-muted transition-colors hover:text-primary"
                >
                    ← All projects
                </Link>
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
                    <span>{project.organizationName}</span>
                    <span className="text-primary">/</span>
                    <span>{project.competitionName}</span>
                    {project.divisionName === null ? null : (
                        <>
                            <span className="text-primary">/</span>
                            <span>{project.divisionName}</span>
                        </>
                    )}
                    {project.teamStatus === null || project.teamStatus === "ready" ? null : (
                        <Badge variant="outline" color="neutral" size="sm">
                            {project.teamStatus.replaceAll("_", " ")}
                        </Badge>
                    )}
                </div>
                <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
                    {project.title}
                </h1>
                <p className="max-w-3xl text-base text-ink-muted">{project.summary}</p>
                <div className="flex flex-wrap gap-1.5">
                    {project.tags.map((tag) => (
                        <Badge key={tag} variant="outline" size="sm">
                            {tag}
                        </Badge>
                    ))}
                </div>
                {links.length > 0 ? (
                    <div className="flex flex-wrap gap-3">
                        {links.map((link) => (
                            <a
                                key={link.label}
                                href={link.href}
                                target="_blank"
                                rel="noopener noreferrer nofollow"
                                className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/[0.06] px-3 py-1.5 text-sm text-primary transition-colors hover:bg-primary/10"
                            >
                                {link.label}
                                <ArrowUpRight className="size-3.5" aria-hidden="true" />
                            </a>
                        ))}
                    </div>
                ) : null}
            </Reveal>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <div className="flex flex-col gap-8">
                    <Reveal className="flex flex-col gap-4" y={20}>
                        <h2 className="text-2xl font-bold tracking-tight">About the project</h2>
                        <div className="prose-nethack">
                            <Markdown source={project.descriptionMarkdown} />
                        </div>
                    </Reveal>

                    <Reveal className="flex flex-col gap-3" y={20}>
                        <h2 className="text-2xl font-bold tracking-tight">AI-use disclosure</h2>
                        {project.aiDisclosure.trim().length === 0 ? (
                            <p className="text-sm text-ink-muted">
                                This team did not provide an AI-use disclosure.
                            </p>
                        ) : (
                            <p className="whitespace-pre-line break-words text-sm text-ink-muted">
                                {project.aiDisclosure}
                            </p>
                        )}
                    </Reveal>
                </div>

                <div className="flex flex-col gap-4">
                    {results === null ? null : (
                        <Reveal>
                            <Card variant="soft">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <Trophy
                                            className="size-4 text-primary"
                                            aria-hidden="true"
                                        />
                                        Results
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-2">
                                    {resultEntry === null ? (
                                        <p className="text-sm text-ink-muted">
                                            No published judging entry.
                                        </p>
                                    ) : (
                                        <>
                                            <p className="text-sm text-ink">
                                                {results.showRanking
                                                    ? resultEntry.rank === null
                                                        ? "Unranked"
                                                        : `Rank #${String(resultEntry.rank)}`
                                                    : "Rankings are not public for this edition."}
                                            </p>
                                            {resultEntry.awards.length === 0 ? null : (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {resultEntry.awards.map((award) => (
                                                        <Badge
                                                            key={award.id}
                                                            variant="soft"
                                                            color="primary"
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
                                            )}
                                        </>
                                    )}
                                    {certificate === null ? null : (
                                        <Link
                                            href={certificate}
                                            className="text-sm text-primary transition-colors hover:text-primary-hover"
                                        >
                                            View certificate
                                        </Link>
                                    )}
                                </CardContent>
                            </Card>
                        </Reveal>
                    )}
                    <Reveal>
                        <Card variant="soft">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Users className="size-4 text-primary" aria-hidden="true" />
                                    Team
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                {project.teamName === null ? (
                                    <p className="text-sm text-ink-subtle">No team listed.</p>
                                ) : (
                                    <p className="text-sm">{project.teamName}</p>
                                )}
                                {project.members.length === 0 ? null : (
                                    <ul className="flex flex-col gap-1 text-sm text-ink-muted">
                                        {project.members.map((member, index) => (
                                            <li key={`${member.displayName}-${index}`}>
                                                {member.displayName}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </CardContent>
                        </Card>
                    </Reveal>
                    <Reveal delay={0.08}>
                        <Card variant="soft">
                            <CardContent className="flex items-center gap-2 pt-5 text-sm text-ink-muted">
                                <CalendarDays className="size-4 text-primary" aria-hidden="true" />
                                {project.publishedAt === null
                                    ? "Not published"
                                    : new Intl.DateTimeFormat("en", {
                                          dateStyle: "long",
                                      }).format(new Date(project.publishedAt))}
                            </CardContent>
                        </Card>
                    </Reveal>
                </div>
            </div>
        </div>
    );
}
