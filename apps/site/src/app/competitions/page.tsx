import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, FolderGit2, Users } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState } from "@nethack/ui/static";
import { CountUp, Reveal, StaggerReveal, Tilt } from "@nethack/ui/motion";
import { getCompetitions } from "../../lib/public-api";

export const metadata = {
    title: "Competitions",
    description: "Browse published nethack competitions.",
};

function formatDate(value: string | null): string {
    if (value === null) {
        return "Not scheduled";
    }
    return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

export default async function CompetitionsPage(): Promise<ReactNode> {
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

    return (
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-4 py-10 sm:px-6 md:py-14 lg:px-8">
            <Reveal className="flex flex-col gap-3">
                <span className="text-xs text-primary">directory</span>
                <h1 className="text-3xl font-extrabold tracking-tight glow sm:text-4xl">
                    Competitions
                </h1>
                <p className="max-w-3xl text-base text-ink-muted">
                    Each edition lists its rules, schedule, divisions, and published projects.
                    Registration and team management happen in the workspace.
                </p>
            </Reveal>

            {unavailable ? (
                <EmptyState
                    title="The competition directory is unavailable"
                    description="The public API could not be reached. Try again shortly."
                />
            ) : competitions.items.length === 0 ? (
                <EmptyState
                    title="No competitions published yet"
                    description="Organizers publish competitions here when registration opens."
                    action={
                        <Button asChild variant="outline" color="neutral">
                            <Link href="/">Return home</Link>
                        </Button>
                    }
                />
            ) : (
                <StaggerReveal className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {competitions.items.map((competition) => (
                        <Tilt key={competition.editionId}>
                            <Card hoverable className="h-full bg-panel/80">
                                <CardHeader>
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="text-xs text-ink-subtle">
                                            {competition.organizationName}
                                        </span>
                                        <Badge variant="soft" color="primary" size="sm">
                                            {competition.status.replaceAll("_", " ")}
                                        </Badge>
                                    </div>
                                    <CardTitle className="text-xl">{competition.name}</CardTitle>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-4">
                                    <p className="line-clamp-3 text-sm text-ink-muted">
                                        {competition.description}
                                    </p>
                                    <dl className="grid grid-cols-2 gap-3 text-xs">
                                        <div className="flex items-start gap-2">
                                            <Users className="mt-0.5 size-3.5 text-primary" aria-hidden="true" />
                                            <div className="flex flex-col gap-0.5">
                                                <dt className="text-ink-subtle">Team size</dt>
                                                <dd className="text-ink">
                                                    {competition.teamMinSize}–{competition.teamMaxSize}
                                                </dd>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <CalendarClock className="mt-0.5 size-3.5 text-primary" aria-hidden="true" />
                                            <div className="flex flex-col gap-0.5">
                                                <dt className="text-ink-subtle">Registration closes</dt>
                                                <dd className="text-ink">
                                                    {formatDate(competition.registrationClosesAt)}
                                                </dd>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <FolderGit2 className="mt-0.5 size-3.5 text-primary" aria-hidden="true" />
                                            <div className="flex flex-col gap-0.5">
                                                <dt className="text-ink-subtle">Published projects</dt>
                                                <dd className="text-ink">
                                                    <CountUp value={competition.publishedProjectCount} />
                                                </dd>
                                            </div>
                                        </div>
                                    </dl>
                                    <Link
                                        href={`/competitions/${competition.slug}`}
                                        className="inline-flex items-center gap-1 text-sm text-primary transition-colors hover:text-primary-hover"
                                    >
                                        View rules and schedule
                                        <ArrowRight className="size-3.5" aria-hidden="true" />
                                    </Link>
                                </CardContent>
                            </Card>
                        </Tilt>
                    ))}
                </StaggerReveal>
            )}
        </div>
    );
}
