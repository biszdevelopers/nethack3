import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EmptyState, Markdown } from "@nethack/ui/static";
import { Reveal } from "@nethack/ui/motion";
import { PublicApiError, getCompetition } from "../../../../lib/public-api";

export default async function CompetitionRulesPage({
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
                <span className="text-xs text-primary">rules</span>
                <h1 className="text-3xl font-extrabold tracking-tight glow sm:text-4xl">
                    {competition.name} rules
                </h1>
                <p className="text-sm text-ink-muted">
                    Eligibility, submission requirements, and review rules for this edition.
                </p>
            </Reveal>
            {competition.rulesMarkdown.trim().length === 0 ? (
                <EmptyState
                    title="Rules not published"
                    description="The organizer has not published rules for this edition yet."
                />
            ) : (
                <Reveal className="prose-nethack rounded-lg border border-line bg-panel/60 p-6">
                    <Markdown source={competition.rulesMarkdown} />
                </Reveal>
            )}
        </div>
    );
}
