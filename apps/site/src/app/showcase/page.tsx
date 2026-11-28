import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, FolderGit2 } from "lucide-react";
import { Badge, Button, EmptyState } from "@nethack/ui/static";
import { Reveal, StaggerReveal } from "@nethack/ui/motion";
import { getCompetitions } from "@/lib/public-api";
import styles from "@/components/showcase/showcase-index.module.css";

export const metadata: Metadata = {
    title: "Showcase",
    description:
        "Explore the winning projects, curated showcases, and season archives from nethack.",
};

function formatMonth(value: string | null): string {
    if (value === null) {
        return "Date not published";
    }
    return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(
        new Date(value),
    );
}

function formatStatus(status: string): string {
    return status.replaceAll("_", " ");
}

export default async function ShowcaseIndexPage(): Promise<ReactNode> {
    let competitions: Awaited<ReturnType<typeof getCompetitions>> = {
        items: [],
        nextCursor: null,
    };
    let unavailable = false;
    try {
        competitions = await getCompetitions();
    } catch {
        unavailable = true;
    }

    const archivedSeasons = competitions.items
        .filter(
            (competition) =>
                competition.status === "completed" || competition.status === "archived",
        )
        .sort((left, right) => {
            const leftDate = left.endsAt ?? left.startsAt ?? "";
            const rightDate = right.endsAt ?? right.startsAt ?? "";
            return rightDate.localeCompare(leftDate);
        });

    return (
        <div className="bg-app">
            <section className={styles.hero} aria-labelledby="featured-showcase-title">
                <div className="relative z-10 mx-auto flex min-h-[82svh] w-full max-w-[1280px] flex-col justify-end px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
                    <Reveal className="max-w-4xl">
                        <h1
                            id="featured-showcase-title"
                            className={`${styles.title} mt-6 text-ink`}
                        >
                            Beneath <span className={styles.titleAccent}>the Surface</span>
                        </h1>
                        <p className="mt-8 max-w-2xl text-base leading-7 text-ink-muted sm:text-lg">
                            Descend through six project worlds shaped by hidden systems, unseen
                            layers, and signals waiting below the surface.
                        </p>
                        <Button asChild size="xl" className="mt-9">
                            <Link href="/showcase/beneath-the-surface">
                                Enter the featured showcase
                                <ArrowUpRight className="size-4" aria-hidden="true" />
                            </Link>
                        </Button>
                    </Reveal>
                </div>
            </section>

            <section
                className="border-t border-line bg-panel px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
                aria-labelledby="previous-season-title"
            >
                <div className="mx-auto max-w-[1280px]">
                    <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-5">
                        <div>
                            <p className="text-xs text-primary">Previous season</p>
                            <h2
                                id="previous-season-title"
                                className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl"
                            >
                                From the archive
                            </h2>
                        </div>
                        <p className="max-w-md text-sm leading-6 text-ink-muted sm:text-base">
                            Revisit the projects that broke through the noise and made themselves
                            heard.
                        </p>
                    </Reveal>

                    <Reveal y={20}>
                        <Link href="/showcase/signal" className={styles.signalCard}>
                            <Image
                                src="/showcase/signal/title.webp"
                                alt=""
                                fill
                                sizes="(min-width: 1280px) 1280px, 100vw"
                                className={styles.signalImage}
                            />
                            <div className={styles.signalOverlay} aria-hidden="true" />
                            <div className="relative z-10 flex min-h-[30rem] flex-col justify-between p-6 sm:min-h-[36rem] sm:p-10 lg:p-14">
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-xs text-white/65">February 2026</span>
                                    <ArrowUpRight
                                        className={`${styles.signalArrow} size-7`}
                                        aria-hidden="true"
                                    />
                                </div>
                                <div>
                                    <p className="mb-3 text-lg text-white/70">When there is</p>
                                    <h2 className={styles.signalTitle}>Signal</h2>
                                    <p className="mt-6 max-w-xl text-sm leading-6 text-white/70 sm:text-base">
                                        Explore the previous season&apos;s winners and the complete
                                        project archive in its original interactive showcase.
                                    </p>
                                </div>
                            </div>
                        </Link>
                    </Reveal>
                </div>
            </section>

            <section
                className="border-t border-line px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
                aria-labelledby="season-archive-title"
            >
                <div className="mx-auto max-w-[1280px]">
                    <Reveal className="mb-10 max-w-2xl">
                        <p className="text-xs text-primary">Project archive</p>
                        <h2
                            id="season-archive-title"
                            className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl"
                        >
                            Every past round, in one place
                        </h2>
                        <p className="mt-4 text-sm leading-6 text-ink-muted sm:text-base">
                            Browse submitted projects and descriptions from previous seasons.
                        </p>
                    </Reveal>

                    {unavailable ? (
                        <EmptyState
                            title="Season archives are unavailable"
                            description="The public API could not be reached. Try again shortly."
                        />
                    ) : archivedSeasons.length === 0 ? (
                        <EmptyState
                            title="No archived seasons yet"
                            description="Past season archives appear here once published projects are available."
                        />
                    ) : (
                        <StaggerReveal className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {archivedSeasons.map((season) => (
                                <Link
                                    key={season.editionId}
                                    href={`/showcase/seasons/${season.slug}`}
                                    className="group flex min-h-56 min-w-0 flex-col justify-between border border-line bg-panel/60 p-6 transition-colors hover:border-primary hover:bg-panel focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25"
                                >
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-xs text-primary">
                                                {formatStatus(season.status)}
                                            </span>
                                            <Badge variant="outline" size="sm">
                                                {season.publishedProjectCount}{" "}
                                                {season.publishedProjectCount === 1
                                                    ? "project"
                                                    : "projects"}
                                            </Badge>
                                        </div>
                                        <h3 className="mt-3 break-words text-2xl font-semibold tracking-tight text-ink">
                                            {season.name}
                                        </h3>
                                        {season.themeName === null ||
                                        season.themeName.length === 0 ? null : (
                                            <p className="mt-1 break-words text-sm font-medium text-primary">
                                                {season.themeName}
                                            </p>
                                        )}
                                        <p className="mt-2 break-words text-sm text-ink-muted">
                                            {season.description}
                                        </p>
                                    </div>
                                    <span className="mt-8 inline-flex flex-wrap items-center gap-2 text-sm text-primary">
                                        <FolderGit2 className="size-4" aria-hidden="true" />
                                        Open project archive
                                        <ArrowUpRight
                                            className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                                            aria-hidden="true"
                                        />
                                    </span>
                                    <span className="mt-3 inline-flex items-center gap-1.5 text-xs text-ink-subtle">
                                        <CalendarDays className="size-3.5" aria-hidden="true" />
                                        {formatMonth(season.endsAt)}
                                    </span>
                                </Link>
                            ))}
                        </StaggerReveal>
                    )}
                </div>
            </section>
        </div>
    );
}
