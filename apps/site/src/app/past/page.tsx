import type { ReactNode } from "react";
import Link from "next/link";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState } from "@nethack/ui/static";
import { Reveal, StaggerReveal } from "@nethack/ui/motion";
import { getCompetitions } from "../../lib/public-api";

export const metadata = {
    title: "Past competitions",
    description: "Completed nethack competition editions.",
};

const PAST_STATUSES = new Set(["completed", "archived"]);

export default async function PastCompetitionsPage(): Promise<ReactNode> {
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
    const past = competitions.items.filter((competition) => PAST_STATUSES.has(competition.status));

    return (
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-4 py-10 sm:px-6 md:py-14 lg:px-8">
            <Reveal className="flex flex-col gap-3">
                <span className="text-xs text-primary">archive</span>
                <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                    Past competitions
                </h1>
                <p className="max-w-2xl text-base text-ink-muted">
                    Completed and archived editions. Published projects remain available in the
                    showcase.
                </p>
            </Reveal>
            {unavailable ? (
                <EmptyState
                    title="The archive is unavailable"
                    description="The public API could not be reached. Try again shortly."
                />
            ) : past.length === 0 ? (
                <EmptyState
                    title="No completed competitions"
                    description="Editions appear here after an organizer marks them completed or archived."
                />
            ) : (
                <StaggerReveal className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {past.map((competition) => (
                        <Card key={competition.editionId} hoverable className="bg-panel/80">
                            <CardHeader>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="truncate text-xs text-ink-subtle">
                                        {competition.organizationName}
                                    </span>
                                    <Badge variant="outline" size="sm">
                                        {competition.status}
                                    </Badge>
                                </div>
                                <CardTitle className="text-lg">{competition.name}</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3">
                                <p className="line-clamp-2 text-sm text-ink-muted">
                                    {competition.description}
                                </p>
                                {competition.themeName === null ? null : (
                                    <p className="text-sm text-ink">
                                        <span className="text-ink-subtle">Theme · </span>
                                        {competition.themeName}
                                    </p>
                                )}
                                <div className="flex gap-4 text-sm">
                                    <Link
                                        href={`/competitions/${competition.slug}`}
                                        className="text-primary transition-colors hover:text-primary-hover"
                                    >
                                        Overview
                                    </Link>
                                    <Link
                                        href={`/projects?competition=${competition.slug}`}
                                        className="text-ink-muted transition-colors hover:text-primary"
                                    >
                                        Projects
                                    </Link>
                                    <Link
                                        href={`/seasons/${competition.slug}`}
                                        className="text-ink-muted transition-colors hover:text-primary"
                                    >
                                        Season archive
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </StaggerReveal>
            )}
        </div>
    );
}
