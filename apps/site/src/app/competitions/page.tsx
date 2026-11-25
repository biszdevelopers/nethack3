import type { ReactNode } from "react";
import Link from "next/link";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    EmptyState,
} from "@nethack/ui/static";
import { getCompetitions } from "../../lib/public-api";

export const metadata = {
    title: "Competitions",
    description: "Browse published nethack competitions.",
};

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
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-6 py-12">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-semibold tracking-tight">Competitions</h1>
                <p className="max-w-2xl text-sm text-ink-muted">
                    Each competition edition lists its rules, schedule, divisions, and published
                    projects. Registration is handled in the workspace.
                </p>
            </div>
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
                        <Button asChild variant="outline">
                            <Link href="/">Return home</Link>
                        </Button>
                    }
                />
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {competitions.items.map((competition) => (
                        <Card key={competition.editionId}>
                            <CardHeader>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-xs text-ink-subtle">
                                        {competition.organizationName}
                                    </span>
                                    <Badge tone="neutral" size="sm">
                                        {competition.status.replaceAll("_", " ")}
                                    </Badge>
                                </div>
                                <CardTitle>{competition.name}</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-4">
                                <p className="line-clamp-3 text-sm text-ink-muted">
                                    {competition.description}
                                </p>
                                <dl className="grid grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <dt className="text-ink-subtle">Team size</dt>
                                        <dd className="text-ink">
                                            {competition.teamMinSize}–{competition.teamMaxSize}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-ink-subtle">Published projects</dt>
                                        <dd className="text-ink">
                                            {competition.publishedProjectCount}
                                        </dd>
                                    </div>
                                </dl>
                                <Link
                                    href={`/competitions/${competition.slug}`}
                                    className="text-xs text-primary underline-offset-4 hover:underline"
                                >
                                    View rules and schedule
                                </Link>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
