import type { ReactNode } from "react";

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
            "Judges receive specific assignments and score against a published rubric. Judges can declare a conflict of interest, which prevents them from evaluating that submission. All assignments and submitted evaluations are audited.",
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
        <div className="mx-auto flex w-full max-w-[800px] flex-col gap-8 px-6 py-12">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-semibold tracking-tight">Frequently asked questions</h1>
                <p className="text-sm text-ink-muted">
                    Operational answers about accounts, registration, teams, submissions, review,
                    and voting.
                </p>
            </div>
            <dl className="flex flex-col divide-y divide-line">
                {QUESTIONS.map((item) => (
                    <div key={item.question} className="flex flex-col gap-2 py-5 first:pt-0">
                        <dt className="text-sm font-medium">{item.question}</dt>
                        <dd className="text-sm text-ink-muted">{item.answer}</dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}
