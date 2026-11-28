import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle, Markdown } from "@nethack/ui/static";
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
                <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                    {competition.name} rules
                </h1>
                <p className="text-sm text-ink-muted">
                    Eligibility, submission requirements, and review rules for this edition.
                </p>
            </Reveal>
            {competition.rulesMarkdown.trim().length === 0 ? (
                <Reveal className="flex flex-col gap-4">
                    <Card variant="soft">
                        <CardHeader>
                            <div className="flex flex-wrap items-center gap-2">
                                <CardTitle>Baseline rules apply</CardTitle>
                                <Badge variant="outline" color="neutral" size="sm">
                                    edition rules not published
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4 text-sm leading-7 text-ink-muted">
                            <p>
                                The organizer has not published edition-specific rules yet. Until
                                they do, the platform-wide competition rules apply to this edition.
                                Check this page again before submitting in case the organizer
                                publishes additional requirements.
                            </p>
                            <ul className="flex flex-col gap-2">
                                <li>
                                    <span className="font-medium text-ink">Eligibility:</span>{" "}
                                    register with an active organization account and follow the
                                    registration decision for this edition.
                                </li>
                                <li>
                                    <span className="font-medium text-ink">Teams:</span> respect the
                                    team size shown on the competition page and keep one team per
                                    participant within this edition.
                                </li>
                                <li>
                                    <span className="font-medium text-ink">Submission:</span>{" "}
                                    provide a public source repository, a README, an accessible
                                    project, a demonstration video, and a complete AI-use
                                    disclosure.
                                </li>
                                <li>
                                    <span className="font-medium text-ink">Conduct:</span> no
                                    malware, unauthorized access, plagiarism, or harassment. Report
                                    security concerns privately to the organizer.
                                </li>
                            </ul>
                            <p>
                                Read the{" "}
                                <Link
                                    href="/rules"
                                    className="text-primary underline-offset-4 hover:underline"
                                >
                                    complete competition rules
                                </Link>{" "}
                                for the binding baseline, including video, licensing, judging,
                                voting, results, and data-handling requirements.
                            </p>
                        </CardContent>
                    </Card>
                </Reveal>
            ) : (
                <Reveal className="prose-nethack rounded-lg border border-line bg-panel/60 p-6">
                    <Markdown source={competition.rulesMarkdown} />
                </Reveal>
            )}
        </div>
    );
}
