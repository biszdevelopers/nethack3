import type { ReactNode } from "react";
import Link from "next/link";
import { BookOpen, CheckCircle2, Gavel, ShieldCheck } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@nethack/ui/static";
import { Reveal, StaggerReveal } from "@nethack/ui/motion";

export const metadata = {
    title: "Competition rules",
    description:
        "Eligibility, team, submission, repository, demonstration video, AI disclosure, licensing, judging, voting, results, conduct, and security rules for nethack competitions.",
};

const SUBMISSION_CHECKLIST = [
    "A public source repository that evaluators can browse and clone without signing in.",
    "A README in American English describing the project, usage, technology, and video.",
    "A working project link, download, store listing, or installer.",
    "A demonstration video that follows the video rules for the edition.",
    "A complete AI-use disclosure naming the tools and the parts they helped produce.",
    "A license file, or acceptance of the default terms published for the edition.",
] as const;

const VIDEO_RULES = [
    "Keep the video between two and three minutes unless the edition states otherwise.",
    "Use no audio, narration, music, or sound effects, and do not reveal faces or names.",
    "Host the video on an approved platform through a link that works in a private browser window.",
    "Do not upload the video to a Git-based repository.",
    "Show the SHA-256 checksum when the project includes a downloadable executable.",
] as const;

export default function RulesPage(): ReactNode {
    return (
        <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-10 px-4 py-10 sm:px-6 md:py-14">
            <Reveal className="flex flex-col gap-4">
                <Badge variant="soft" color="primary" dot>
                    rules
                </Badge>
                <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
                    Competition rules
                </h1>
                <p className="max-w-3xl text-base leading-7 text-ink-muted">
                    These rules describe the baseline expectations for nethack competitions. Each
                    competition edition may publish additional requirements, dates, team limits, or
                    judging details. Read the edition rules first; this page applies when the
                    edition does not say otherwise.
                </p>
                <div className="flex flex-wrap gap-2">
                    <Link
                        href="/competitions"
                        className="inline-flex h-9 items-center rounded-md border border-line px-3 text-sm transition-colors hover:bg-raised"
                    >
                        Browse competitions
                    </Link>
                    <Link
                        href="/faq"
                        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm transition-colors hover:bg-raised"
                    >
                        <BookOpen className="size-3.5" aria-hidden="true" />
                        Read the FAQ
                    </Link>
                </div>
            </Reveal>

            <Reveal className="flex flex-col gap-3">
                <h2 className="text-2xl font-bold tracking-tight">Eligibility and registration</h2>
                <p className="max-w-3xl text-sm leading-7 text-ink-muted">
                    Eligibility is defined by the competition organizer and published on the
                    competition page. Register with an active organization account. If the edition
                    requires approval, your registration stays pending until an organizer decides.
                    Do not register more than one account, impersonate another participant, or join
                    more than one team in the same edition.
                </p>
            </Reveal>

            <Reveal className="flex flex-col gap-3">
                <h2 className="text-2xl font-bold tracking-tight">Teams</h2>
                <p className="max-w-3xl text-sm leading-7 text-ink-muted">
                    The edition page states the minimum and maximum team size. Every member must be
                    an eligible participant, and the captain is responsible for keeping the roster
                    accurate. Remove inactive members before inviting replacements. A team that
                    exceeds the limit or contains an ineligible member may be asked to correct the
                    roster before its submission is reviewed.
                </p>
            </Reveal>

            <Reveal className="flex flex-col gap-3">
                <h2 className="text-2xl font-bold tracking-tight">Submission requirements</h2>
                <p className="max-w-3xl text-sm leading-7 text-ink-muted">
                    Submit one project per team for the edition. The project must be your
                    team&apos;s work, must match the repository and demonstration you provide, and
                    must remain accessible through evaluation. A submission that is only an
                    executable, an archive, or a private link does not meet the requirements.
                </p>
                <StaggerReveal className="grid gap-3 sm:grid-cols-2">
                    {SUBMISSION_CHECKLIST.map((item) => (
                        <div
                            key={item}
                            className="flex items-start gap-2 rounded-md border border-line p-3 text-sm text-ink-muted"
                        >
                            <CheckCircle2
                                className="mt-0.5 size-4 shrink-0 text-primary"
                                aria-hidden="true"
                            />
                            <span>{item}</span>
                        </div>
                    ))}
                </StaggerReveal>
            </Reveal>

            <Reveal className="flex flex-col gap-3">
                <h2 className="text-2xl font-bold tracking-tight">Repository and README</h2>
                <p className="max-w-3xl text-sm leading-7 text-ink-muted">
                    The repository must contain the complete source needed to understand and
                    reproduce the project. Keep it public and do not remove essential files during
                    judging. The README must explain what the project does, how to access or run it,
                    which technologies it uses, and where to watch the demonstration video. Note any
                    account, hardware, or platform limitation that affects evaluation.
                </p>
                <p className="max-w-3xl text-sm leading-7 text-ink-muted">
                    Judges should not need to create an account on an unrelated service, pay for
                    access, or install uncommon software just to see the project. If the project
                    depends on specific hardware, the video must show the full experience.
                </p>
            </Reveal>

            <Reveal className="flex flex-col gap-3">
                <h2 className="text-2xl font-bold tracking-tight">Demonstration video</h2>
                <p className="max-w-3xl text-sm leading-7 text-ink-muted">
                    The video is part of the submission, not an optional extra. It must show the
                    project&apos;s main features and be understandable to someone who has never seen
                    the work. A private, broken, or access-restricted link is treated as a missing
                    video.
                </p>
                <ul className="flex max-w-3xl flex-col gap-2 text-sm leading-7 text-ink-muted">
                    {VIDEO_RULES.map((rule) => (
                        <li key={rule} className="flex gap-2">
                            <span aria-hidden="true" className="text-primary">
                                -
                            </span>
                            <span>{rule}</span>
                        </li>
                    ))}
                </ul>
            </Reveal>

            <Reveal className="flex flex-col gap-3">
                <h2 className="text-2xl font-bold tracking-tight">AI-use disclosure</h2>
                <p className="max-w-3xl text-sm leading-7 text-ink-muted">
                    Responsible AI use is allowed when it is disclosed. For each tool, describe the
                    parts of the project it helped produce: code, tests, documentation, artwork,
                    research, or presentation. Do not claim that AI did work it did not do, and do
                    not hide substantial assistance. If judges believe the disclosure is incomplete,
                    the team may be asked to explain its implementation and development process.
                </p>
            </Reveal>

            <Reveal className="flex flex-col gap-3">
                <h2 className="text-2xl font-bold tracking-tight">Licensing</h2>
                <p className="max-w-3xl text-sm leading-7 text-ink-muted">
                    Include a LICENSE file with an OSI-approved open-source license when possible.
                    Third-party libraries, assets, fonts, and datasets keep their own licenses; you
                    are responsible for complying with them. If the repository has no valid license
                    at submission time, the edition rules state which default terms apply. By
                    submitting, the team also grants the organizers a limited license to showcase
                    the project and its results, as described by the edition.
                </p>
            </Reveal>

            <Reveal className="flex flex-col gap-3">
                <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                    <Gavel className="size-5 text-primary" aria-hidden="true" />
                    Judging
                </h2>
                <p className="max-w-3xl text-sm leading-7 text-ink-muted">
                    Judges score against the published rubric. Each assignment is recorded, judges
                    declare conflicts of interest, and submitted evaluations are audited. Meeting
                    the minimum submission checklist does not guarantee a high score. Judges may
                    invite a team to demonstrate the project or explain technical decisions when
                    ownership or AI disclosure is unclear.
                </p>
            </Reveal>

            <Reveal className="flex flex-col gap-3">
                <h2 className="text-2xl font-bold tracking-tight">Peer voting</h2>
                <p className="max-w-3xl text-sm leading-7 text-ink-muted">
                    When the organizer opens a voting round, eligible participants receive a fixed
                    number of stars to distribute across projects. A ballot belongs to one
                    participant and one round, and duplicate selections are rejected. Voting is
                    separate from judge scoring and cannot change a judge&apos;s evaluation.
                </p>
            </Reveal>

            <Reveal className="flex flex-col gap-3">
                <h2 className="text-2xl font-bold tracking-tight">Results and recognition</h2>
                <p className="max-w-3xl text-sm leading-7 text-ink-muted">
                    Scores, ranks, and awards stay hidden until the organizer publishes results for
                    the edition. Published results use a frozen snapshot. Any prizes, certificates,
                    or recognition are announced by the organizer for that edition; this page does
                    not promise a prize or an amount.
                </p>
            </Reveal>

            <Reveal className="flex flex-col gap-3">
                <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                    <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
                    Conduct and security
                </h2>
                <p className="max-w-3xl text-sm leading-7 text-ink-muted">
                    Do not submit malware, attempt unauthorized access, disrupt the platform, alter
                    another team&apos;s records, or misrepresent authorship. Do not harass,
                    intimidate, or discriminate against other participants. Report a suspected
                    vulnerability or conduct concern privately to the organizer; do not publish
                    reproduction steps or another person&apos;s private information.
                </p>
                <p className="max-w-3xl text-sm leading-7 text-ink-muted">
                    Submissions may be inspected for malicious behavior. A confirmed violation can
                    lead to disqualification, removal from the showcase, and referral to the
                    appropriate institution.
                </p>
            </Reveal>

            <Reveal className="flex flex-col gap-3">
                <h2 className="text-2xl font-bold tracking-tight">Deadlines, appeals, and data</h2>
                <p className="max-w-3xl text-sm leading-7 text-ink-muted">
                    Deadlines use the time zone shown on the competition page. Late submissions are
                    not accepted, except for a documented platform failure that organizers can
                    verify from server logs. Questions about a rule should be sent before the
                    deadline. An appeal of a result or eligibility decision must identify the team,
                    the decision, and the evidence to review, and must be filed within the period
                    published by the organizer.
                </p>
                <p className="max-w-3xl text-sm leading-7 text-ink-muted">
                    The platform processes account identity, team membership, submissions,
                    evaluations, ballots, and audit records to run the competition and publish
                    results. Access is limited by role. Participants may request access, correction,
                    or deletion of personal data through the organizer; a request that would remove
                    a published result or break an archival obligation is handled by explaining the
                    remaining basis.
                </p>
            </Reveal>

            <Card variant="soft">
                <CardHeader>
                    <CardTitle>Edition rules take precedence</CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-7 text-ink-muted">
                    If an edition publishes a different deadline, team limit, video requirement, or
                    review process, follow the edition. Ask the organizer when a requirement is
                    unclear; do not assume that an unstated exception will be granted.
                </CardContent>
            </Card>
        </div>
    );
}
