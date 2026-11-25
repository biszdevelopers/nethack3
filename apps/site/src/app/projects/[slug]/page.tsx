import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, CardContent, CardHeader, CardTitle, Markdown } from "@nethack/ui/static";
import { PublicApiError, getProject } from "../../../lib/public-api";

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
        project.repositoryUrl === null
            ? null
            : { label: "Repository", href: project.repositoryUrl },
        project.demoUrl === null ? null : { label: "Live demo", href: project.demoUrl },
    ].filter((entry): entry is { label: string; href: string } => entry !== null);

    return (
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-10 px-6 py-12">
            <div className="flex flex-col gap-4">
                <Link href="/projects" className="text-xs text-ink-muted hover:text-ink">
                    ← All projects
                </Link>
                <span className="text-xs text-ink-subtle">
                    {project.organizationName} · {project.competitionName}
                </span>
                <h1 className="text-balance text-3xl font-semibold tracking-tight">
                    {project.title}
                </h1>
                <p className="max-w-3xl text-sm text-ink-muted">{project.summary}</p>
                <div className="flex flex-wrap gap-1.5">
                    {project.tags.map((tag) => (
                        <Badge key={tag} tone="outline" size="sm">
                            {tag}
                        </Badge>
                    ))}
                </div>
                {links.length > 0 ? (
                    <div className="flex flex-wrap gap-4">
                        {links.map((link) => (
                            <a
                                key={link.label}
                                href={link.href}
                                target="_blank"
                                rel="noopener noreferrer nofollow"
                                className="text-xs text-primary underline-offset-4 hover:underline"
                            >
                                {link.label}
                            </a>
                        ))}
                    </div>
                ) : null}
            </div>

            <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
                <section className="flex flex-col gap-4" aria-labelledby="about-project">
                    <h2 id="about-project" className="text-lg font-semibold">
                        About the project
                    </h2>
                    <Markdown source={project.descriptionMarkdown} />
                </section>
                <div className="flex flex-col gap-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Team</CardTitle>
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
                    <Card>
                        <CardHeader>
                            <CardTitle>Publication</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-ink-muted">
                            {project.publishedAt === null
                                ? "Not published"
                                : new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
                                      new Date(project.publishedAt),
                                  )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
