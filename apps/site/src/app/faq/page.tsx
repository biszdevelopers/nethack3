import type { ReactNode } from "react";
import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { AnimatedDisclosure, Reveal } from "@nethack/ui/motion";

export const metadata = {
    title: "FAQ",
    description:
        "Answers about eligibility, teams, submissions, repositories, demonstration videos, AI disclosure, judging, voting, results, licensing, and conduct.",
};

const QUESTIONS = [
    {
        question: "Who can participate?",
        answer: "Each competition publishes its own eligibility rules. Sign in with your organization account, open the competition, and check the edition rules before registering. A registration may be approved automatically or may wait for an organizer decision, depending on the edition.",
    },
    {
        question: "How large can a team be?",
        answer: "Team size is set by the competition edition and is shown on the competition page. Within one edition, a participant can belong to only one team. You can create a team, accept an invitation from a classmate, or join through the workspace team flow.",
    },
    {
        question: "What must a submission include?",
        answer: "At minimum, a submission needs a public source repository, a README, a working project link or download, a demonstration video, and a complete AI-use disclosure. The edition rules may add requirements, so read them before the deadline.",
    },
    {
        question: "Which repository platforms are accepted?",
        answer: "Use a platform where the complete source can be browsed and cloned without signing in or paying. GitHub, GitLab, Codeberg, and Gitee are common choices. A compiled executable or a compressed archive is not a substitute for the source repository, and the repository must stay available through evaluation.",
    },
    {
        question: "What should the README contain?",
        answer: "Explain what the project does, how to access or run it, which languages and frameworks it uses, and where to watch the demonstration video. State any account, hardware, or platform limitation that a judge needs to know before evaluating the project.",
    },
    {
        question: "What are the demonstration video requirements?",
        answer: "The edition rules set the exact requirements. A common baseline is a two-to-three minute video with no audio and no personal identification, hosted on an approved platform through a link that works without requesting access. Do not upload the video to a Git-based repository. If the project is a downloadable executable, show its SHA-256 checksum in the video.",
    },
    {
        question: "Is AI allowed?",
        answer: "Yes, when it is disclosed. Name the tools you used and the specific parts they helped produce, such as code, documentation, artwork, or tests. A statement that AI was used without specifics is not enough. Undisclosed or excessive AI use can trigger a verification conversation with the judges.",
    },
    {
        question: "How are projects judged?",
        answer: "Judges score submissions against the published rubric. Assignments are recorded, judges declare conflicts of interest, and submitted evaluations are audited. The quality and completeness of the project matter more than meeting the minimum submission checklist.",
    },
    {
        question: "How does peer voting work?",
        answer: "When an edition opens a voting round, eligible participants receive a fixed number of stars to distribute across projects. A ballot is tied to one participant and one round, and duplicate selections are rejected. Voting never replaces judge scoring.",
    },
    {
        question: "When are results published?",
        answer: "Scores, ranks, and awards stay hidden until the organizer publishes results for the edition. After publication, the results page and team certificates use the frozen published snapshot, not live draft data.",
    },
    {
        question: "What license should the project use?",
        answer: "Include a LICENSE file with an OSI-approved open-source license when possible. If the repository has no valid license, the edition rules state which default terms apply. The organizers may also receive a limited license to showcase submitted work; the edition rules describe that permission.",
    },
    {
        question: "What happens if we miss a deadline?",
        answer: "Deadlines use the time zone shown on the competition page. Late submissions are not accepted, except for a documented platform failure that organizers can verify from server logs. A local computer or network problem is not grounds for an extension.",
    },
    {
        question: "What conduct is prohibited?",
        answer: "Do not submit malware, attempt unauthorized access, misrepresent authorship, falsify AI disclosure, or interfere with another team's work. Harassment and discrimination are not tolerated. Report a security or conduct concern privately to the organizers instead of posting details publicly.",
    },
    {
        question: "How is participant data handled?",
        answer: "Account identity, team membership, submissions, evaluations, and audit records are used to run the competition and publish results. Access is limited by role. Passwords, session tokens, and identity-provider credentials are never shown to other participants.",
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
                <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                    Frequently asked questions
                </h1>
                <p className="text-base text-ink-muted">
                    Practical answers about eligibility, teams, submissions, review, voting, and
                    conduct. The{" "}
                    <Link href="/rules" className="text-primary underline underline-offset-4">
                        competition rules
                    </Link>{" "}
                    remain binding when the two differ.
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

            <Reveal className="rounded-lg border border-line bg-panel/60 p-6">
                <h2 className="text-lg font-semibold">Still need help?</h2>
                <p className="mt-2 text-sm leading-6 text-ink-muted">
                    Ask the organizer through the contact channel published for your competition.
                    Include the competition name, the page you used, and what you expected to
                    happen.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                        href="/contact"
                        className="inline-flex h-9 items-center rounded-md border border-line px-3 text-sm transition-colors hover:bg-raised"
                    >
                        Contact support
                    </Link>
                    <Link
                        href="/rules"
                        className="inline-flex h-9 items-center rounded-md border border-line px-3 text-sm transition-colors hover:bg-raised"
                    >
                        Read the rules
                    </Link>
                </div>
            </Reveal>
        </div>
    );
}
