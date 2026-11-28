import type { ReactNode } from "react";
import Link from "next/link";
import { BookOpen, ExternalLink } from "lucide-react";
import { Card, CardContent, Markdown } from "@nethack/ui/static";
import { Reveal } from "@nethack/ui/motion";
import {
    RULES_BODY_MARKDOWN,
    RULES_EFFECTIVE_DATE,
    RULES_TITLE,
    RULES_VERSION,
} from "@/content/rules";

export const metadata = {
    title: RULES_TITLE,
    description:
        "The binding competition rules for nethack: eligibility, submissions, repository and video requirements, AI-use disclosure, privacy, and appeals.",
};

export default function RulesPage(): ReactNode {
    return (
        <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-8 px-4 py-10 sm:px-6 md:py-14">
            <Reveal className="flex flex-col gap-4">
                <span className="text-xs text-primary">competition rules</span>
                <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
                    {RULES_TITLE}
                </h1>
                <p className="text-sm text-ink-muted">
                    Version {RULES_VERSION}. Effective {RULES_EFFECTIVE_DATE}.
                </p>
            </Reveal>

            <Reveal className="prose-nethack rounded-lg border border-line bg-panel/60 p-5 sm:p-8">
                <Markdown source={RULES_BODY_MARKDOWN} />
            </Reveal>

            <Reveal>
                <Card variant="soft">
                    <CardContent className="flex flex-wrap items-center gap-3 pt-5 text-sm">
                        <Link
                            href="/competitions"
                            className="inline-flex min-h-10 items-center gap-1.5 border border-line px-3 text-ink transition-colors hover:border-primary hover:text-primary"
                        >
                            Browse competitions
                            <ExternalLink className="size-3.5" aria-hidden="true" />
                        </Link>
                        <Link
                            href="/faq"
                            className="inline-flex min-h-10 items-center gap-1.5 border border-line px-3 text-ink transition-colors hover:border-primary hover:text-primary"
                        >
                            <BookOpen className="size-3.5" aria-hidden="true" />
                            Read the FAQ
                        </Link>
                    </CardContent>
                </Card>
            </Reveal>
        </div>
    );
}
