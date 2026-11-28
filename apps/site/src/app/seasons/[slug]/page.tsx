import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { slugSchema } from "@nethack/contracts";
import {
    ArrowLeft,
    ArrowRight,
    ArrowUpRight,
    CalendarClock,
    FolderGit2,
    Gavel,
    Users,
} from "lucide-react";
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

function statusLabel(status: string): string {
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
            title: `${season.name} · Season archive`,
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

export default async function SeasonArchivePage({
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

    return (
        <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-10 px-4 py-10 sm:px-6 md:py-14">
            <Reveal className="flex flex-col gap-4">
                <Link
                    href="/past"
                    className="inline-flex w-fit items-center gap-1.5 text-xs text-ink-muted transition-colors hover:text-primary"
                >
                    <ArrowLeft className="size-3.5" aria-hidden="true" />
                    Season archive
                </Link>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-ink-subtle">{season.organizationName}</span>
                    <span className="text-xs text-primary">/</span>
                    <span className="text-xs text-ink-subtle">{season.seriesName}</span>
                    <Badge variant="soft" color="primary" size="sm">
                        {statusLabel(season.status)}
                    </Badge>
                </div>
                <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
                    {season.name}
                </h1>
                <p className="max-w-3xl text-base text-ink-muted">{season.description}</p>
                <div className="flex flex-wrap gap-2">
                    <Button asChild>
                        <Link href={`/competitions/${season.slug}`}>
                            Open the edition
                            <ArrowUpRight className="size-4" aria-hidden="true" />
                        </Link>
                    </Button>
                    <Button asChild variant="outline" color="neutral">
                        <Link href={`/competitions/${season.slug}#rules`}>Read the rules</Link>
                    </Button>
                    <Button asChild variant="subtle" color="neutral">
                        <Link href={`/projects?competition=${season.slug}`}>
                            All projects
                            <ArrowRight className="size-3.5" aria-hidden="true" />
                        </Link>
                    </Button>
                </div>
            </Reveal>

            <Reveal
                className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-4"
                y={20}
            >
                <div className="flex flex-col gap-1 bg-app p-4">
                    <span className="inline-flex items-center gap-1.5 text-xs text-ink-subtle">
                        <CalendarClock className="size-3.5 text-primary" aria-hidden="true" />
                        Starts
                    </span>
                    <span className="text-sm">{formatDate(season.startsAt)}</span>
                </div>
                <div className="flex flex-col gap-1 bg-app p-4">
                    <span className="inline-flex items-center gap-1.5 text-xs text-ink-subtle">
                        <CalendarClock className="size-3.5 text-primary" aria-hidden="true" />
                        Ends
                    </span>
                    <span className="text-sm">{formatDate(season.endsAt)}</span>
                </div>
                <div className="flex flex-col gap-1 bg-app p-4">
                    <span className="inline-flex items-center gap-1.5 text-xs text-ink-subtle">
                        <CalendarClock className="size-3.5 text-primary" aria-hidden="true" />
                        Registration closes
                    </span>
                    <span className="text-sm">{formatDate(season.registrationClosesAt)}</span>
                </div>
                <div className="flex flex-col gap-1 bg-app p-4">
                    <span className="inline-flex items-center gap-1.5 text-xs text-ink-subtle">
                        <Users className="size-3.5 text-primary" aria-hidden="true" />
                        Team size
                    </span>
                    <span className="text-sm">
                        {season.teamMinSize}–{season.teamMaxSize} people
                    </span>
                </div>
            </Reveal>

            <section className="flex flex-col gap-5" aria-labelledby="milestones-heading">
                <Reveal className="flex flex-wrap items-end justify-between gap-3">
                    <div className="flex flex-col gap-1">
                        <h2 id="milestones-heading" className="text-2xl font-bold tracking-tight">
                            Schedule
                        </h2>
                        <p className="text-sm text-ink-muted">
                            Milestones as the organizer published them for this edition.
                        </p>
                    </div>
                    {season.divisions.length === 0 ? null : (
                        <div className="flex flex-wrap gap-1.5">
                            {season.divisions.map((division) => (
                                <Badge key={division.id} variant="outline" size="sm">
                                    {division.name}
                                </Badge>
                            ))}
                        </div>
                    )}
                </Reveal>
                {season.milestones.length === 0 ? (
                    <EmptyState
                        title="No milestones published"
                        description="This edition does not have a published schedule."
                    />
                ) : (
                    <ol className="flex flex-col divide-y divide-line rounded-lg border border-line">
                        {season.milestones.map((milestone) => (
                            <li
                                key={milestone.id}
                                className="grid gap-1 px-4 py-4 sm:grid-cols-[190px_minmax(0,1fr)] sm:items-baseline"
                            >
                                <span className="text-xs tabular-nums text-primary">
                                    {formatDate(milestone.occursAt)}
                                </span>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-sm font-medium">{milestone.title}</span>
                                    {milestone.description.length === 0 ? null : (
                                        <span className="text-sm text-ink-muted">
                                            {milestone.description}
                                        </span>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ol>
                )}
            </section>

            <Reveal
                delay={0.05}
                className="flex flex-col gap-4 rounded-lg border border-primary/25 bg-primary/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between"
            >
                <div className="flex items-start gap-3">
                    <Gavel className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <div className="flex flex-col gap-1">
                        <h2 className="text-sm font-medium">Rules for this edition</h2>
                        <p className="text-sm text-ink-muted">
                            Eligibility, submission requirements, and review criteria stay with the
                            edition record.
                        </p>
                    </div>
                </div>
                <Button asChild variant="outline" color="primary" size="sm">
                    <Link href={`/competitions/${season.slug}#rules`}>
                        Read the rules
                        <ArrowUpRight className="size-3.5" aria-hidden="true" />
                    </Link>
                </Button>
            </Reveal>

            <section className="flex flex-col gap-5" aria-labelledby="season-projects-heading">
                <Reveal className="flex flex-col gap-1">
                    <h2 id="season-projects-heading" className="text-2xl font-bold tracking-tight">
                        Published projects
                    </h2>
                    <p className="text-sm text-ink-muted">
                        Work that this edition published to the public showcase.
                    </p>
                </Reveal>
                {season.projects.length === 0 ? (
                    <EmptyState
                        title="No published projects"
                        description="Nothing from this edition has been approved for the public showcase."
                        action={
                            <Button asChild variant="outline" size="sm">
                                <Link href="/projects">
                                    <FolderGit2 className="size-3.5" aria-hidden="true" />
                                    Browse the showcase
                                </Link>
                            </Button>
                        }
                    />
                ) : (
                    <StaggerReveal className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {season.projects.map((project) => (
                            <Tilt key={project.id}>
                                <Card hoverable className="h-full bg-panel/80">
                                    <CardHeader>
                                        <span className="truncate text-xs text-ink-subtle">
                                            {project.teamName ?? season.name}
                                        </span>
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
                                            Open project
                                            <ArrowUpRight className="size-3.5" aria-hidden="true" />
                                        </Link>
                                    </CardContent>
                                </Card>
                            </Tilt>
                        ))}
                    </StaggerReveal>
                )}
            </section>
        </div>
    );
}
