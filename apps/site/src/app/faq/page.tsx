import type { ReactNode } from "react";
import { HelpCircle } from "lucide-react";
import { AnimatedDisclosure, Reveal } from "@nethack/ui/motion";

export const metadata = {
    title: "FAQ",
    description: "Common questions about nethack accounts, registration, teams, and submissions.",
};

const QUESTIONS = [
    {
        question: "How do I sign in?",
        answer:
            "Use the workspace sign-in. nethack delegates authentication to Basis Auth, which uses your organization account. nethack then creates its own application session so your identity provider credentials never reach the browser application.",
    },
    {
        question: "Why can I not register for a competition?",
        answer:
            "Registration is controlled by the edition dates and status, your organization membership, and any capacity limit. If the organizer requires approval, your registration stays pending until it is decided.",
    },
    {
        question: "Can I be in more than one team?",
        answer:
            "Within a single competition edition, each participant can belong to one team. You can participate in different editions or organizations with separate registrations.",
    },
    {
        question: "When can I edit a submission?",
        answer:
            "Submission rules belong to the organizer. Before the deadline you can create a new version when the edition permits revisions. After the deadline the API rejects new versions unless the organizer reopens the submission window.",
    },
    {
        question: "Who can see my project?",
        answer:
            "Only your team and organization organizers see a draft project. A project becomes visible on the public site after it is published and the organizing team enables its public showcase.",
    },
    {
        question: "How is judging kept fair?",
        answer:
            "Judges receive specific assignments and score against a published rubric. Judges can declare a conflict of interest, which prevents them from evaluating that submission. Assignments and submitted evaluations are audited.",
    },
    {
        question: "How does voting prevent duplicate ballots?",
        answer:
            "Ballots are tied to one voting round and one user in the database. The API and database constraints reject a second ballot or duplicate selections within a ballot.",
    },
    {
        question: "What happens to my data if I sign out?",
        answer:
            "Signing out revokes your application session and asks the identity provider to revoke its tokens. Server-side tokens are encrypted at rest and are never sent to the browser.",
    },
] as const;

export default function FaqPage(): ReactNode {
    return (
        <div className="mx-auto flex w-full max-w-[900px] flex-col gap-8 px-4 py-10 sm:px-6 md:py-14">
            <Reveal className="flex flex-col gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs text-primary">
                    <HelpCircle className="size-3.5" aria-hidden="true" />
                    help
                </span>
                <h1 className="text-3xl font-extrabold tracking-tight glow sm:text-4xl">
                    Frequently asked questions
                </h1>
                <p className="text-base text-ink-muted">
                    Operational answers about accounts, registration, teams, submissions, review,
                    and voting.
                </p>
            </Reveal>

            <div className="flex flex-col gap-2">
                {QUESTIONS.map((item, index) => (
                    <Reveal key={item.question} delay={index * 0.03}>
                        <AnimatedDisclosure title={item.question}>
                            <p className="text-sm leading-7 text-ink-muted">{item.answer}</p>
                        </AnimatedDisclosure>
                    </Reveal>
                ))}
            </div>
        </div>
    );
}
