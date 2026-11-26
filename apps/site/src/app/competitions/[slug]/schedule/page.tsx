import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { EmptyState } from "@nethack/ui/static";
import { Reveal, StaggerReveal } from "@nethack/ui/motion";
import { PublicApiError, getCompetition } from "../../../../lib/public-api";

function formatDate(value: string): string {
    return new Intl.DateTimeFormat("en", {
        dateStyle: "full",
        timeStyle: "short",
    }).format(new Date(value));
}

export default async function CompetitionSchedulePage({
    params,
}: {
    readonly params: Promise<{ slug: string }>;
}): Promise<ReactNode> {
    const { slug } = await params;
    let competition;
    try {
        competition = await getCompetition(slug);
    } catch (error) {
        if (error instanceof PublicApiError && error.message === "Not found") {
            notFound();
        }
        throw error;
    }

    return (
        <div className="mx-auto flex w-full max-w-[900px] flex-col gap-8 px-4 py-10 sm:px-6 md:py-14">
            <Reveal className="flex flex-col gap-3">
                <Link
                    href={`/competitions/${competition.slug}`}
                    className="inline-flex items-center gap-1 text-xs text-ink-muted transition-colors hover:text-primary"
                >
                    <ArrowLeft className="size-3.5" aria-hidden="true" />
                    Back to {competition.name}
                </Link>
                <span className="inline-flex items-center gap-1.5 text-xs text-primary">
                    <CalendarClock className="size-3.5" aria-hidden="true" />
                    schedule
                </span>
                <h1 className="text-3xl font-extrabold tracking-tight glow sm:text-4xl">
                    {competition.name} schedule
                </h1>
                <p className="text-sm text-ink-muted">
                    Milestones published by the organizer for this edition.
                </p>
            </Reveal>
            {competition.milestones.length === 0 ? (
                <EmptyState
                    title="No schedule published"
                    description="The organizer has not published milestones for this edition yet."
                />
            ) : (
                <StaggerReveal className="flex flex-col gap-3">
                    {competition.milestones.map((milestone) => (
                        <div
                            key={milestone.id}
                            className="rounded-lg border border-line bg-panel/60 p-5 transition-colors hover:border-line-strong"
                        >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs text-primary">
                                    {formatDate(milestone.occursAt)}
                                </span>
                                <span className="text-xs text-ink-subtle">
                                    {milestone.kind.replaceAll("_", " ")}
                                </span>
                            </div>
                            <h2 className="mt-1 text-base font-medium">{milestone.title}</h2>
                            {milestone.description.length === 0 ? null : (
                                <p className="mt-1 text-sm text-ink-muted">
                                    {milestone.description}
                                </p>
                            )}
                        </div>
                    ))}
                </StaggerReveal>
            )}
        </div>
    );
}
