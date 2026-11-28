import type { ReactNode } from "react";
import Link from "next/link";
import { BookOpen, GitPullRequest, Scale, Shield, Terminal } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@nethack/ui/static";
import { Reveal, StaggerReveal } from "@nethack/ui/motion";

export const metadata = {
    title: "Contributing",
    description:
        "Contribution expectations, security disclosure, and code of conduct for the nethack platform.",
};

export default function ContributingPage(): ReactNode {
    return (
        <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-10 px-4 py-10 sm:px-6 md:py-14">
            <Reveal className="flex flex-col gap-4">
                <Badge variant="soft" color="primary" dot>
                    project
                </Badge>
                <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
                    Contributing to nethack
                </h1>
                <p className="max-w-3xl text-base text-ink-muted">
                    nethack is distributed under the Apache License 2.0. Contributions are accepted
                    when they preserve the capability boundaries, the security guarantees, and the
                    documented behavior of the platform.
                </p>
            </Reveal>

            <Reveal className="flex flex-col gap-4">
                <h2 className="text-2xl font-bold tracking-tight">Before you change code</h2>
                <p className="max-w-3xl text-sm leading-7 text-ink-muted">
                    Read the repository instructions and the engineering documentation for the area
                    you intend to change. A feature belongs to one capability; the Core stays small.
                    Public contracts, database access, authentication, and authorization are
                    reviewed as security boundaries, not as implementation details.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                    <Card variant="soft">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-sm">
                                <Terminal className="size-4 text-primary" aria-hidden="true" />
                                Local checks
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-2 text-sm text-ink-muted">
                            <p>Run the checks that cover your change before requesting review.</p>
                            <code className="rounded-sm border border-line bg-app px-2 py-1 text-xs">
                                bun run check
                            </code>
                            <code className="rounded-sm border border-line bg-app px-2 py-1 text-xs">
                                bun run test:integration
                            </code>
                            <code className="rounded-sm border border-line bg-app px-2 py-1 text-xs">
                                bun run test:e2e
                            </code>
                        </CardContent>
                    </Card>
                    <Card variant="soft">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-sm">
                                <GitPullRequest
                                    className="size-4 text-primary"
                                    aria-hidden="true"
                                />
                                Change expectations
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-2 text-sm leading-6 text-ink-muted">
                            <p>
                                Keep each change focused on one problem. Describe why the change is
                                needed and what behavior it alters.
                            </p>
                            <p>
                                Include tests for new behavior and for the failure paths your change
                                introduces. Do not weaken or disable an existing test to obtain a
                                passing run.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </Reveal>

            <Reveal className="flex flex-col gap-4">
                <h2 className="text-2xl font-bold tracking-tight">Reporting security issues</h2>
                <p className="max-w-3xl text-sm leading-7 text-ink-muted">
                    Disclose a suspected vulnerability privately to the operator of the deployment
                    you are testing. Do not file a public report, post reproduction steps publicly,
                    or access data that does not belong to you. A report should describe the
                    affected page or endpoint, the conditions required to reproduce the behavior,
                    the observed and expected results, and any evidence that does not contain
                    personal data.
                </p>
                <p className="max-w-3xl text-sm leading-7 text-ink-muted">
                    Send the report through a private channel published by the deployment operator.
                    The operator decides whether the report is accepted. This project does not
                    advertise a standing bounty program, and no compensation is promised in advance.
                    Good-faith research that stops at the minimum access needed to demonstrate a
                    defect is treated as a contribution.
                </p>
            </Reveal>

            <Reveal className="flex flex-col gap-4">
                <h2 className="text-2xl font-bold tracking-tight">Responsible disclosure</h2>
                <p className="max-w-3xl text-sm leading-7 text-ink-muted">
                    Allow the operator a reasonable period to investigate and deploy a correction
                    before publishing details. Do not use a discovered weakness to disrupt the
                    service, alter competition records, or obtain another participant&apos;s data.
                    Activity that exceeds good-faith verification is handled as a security incident
                    rather than as research.
                </p>
            </Reveal>

            <Reveal className="flex flex-col gap-4">
                <h2 className="text-2xl font-bold tracking-tight">Code of conduct</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                    <Card variant="soft">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-sm">
                                <Scale className="size-4 text-primary" aria-hidden="true" />
                                Expected conduct
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm leading-6 text-ink-muted">
                            Discuss ideas and code, not people. Give specific, project-focused
                            review comments. Assume good faith until evidence shows otherwise, and
                            correct your own mistakes plainly.
                        </CardContent>
                    </Card>
                    <Card variant="soft">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-sm">
                                <Shield className="size-4 text-primary" aria-hidden="true" />
                                Unacceptable conduct
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm leading-6 text-ink-muted">
                            Harassment, discrimination, threats, deliberate intimidation, and the
                            publication of another person&apos;s private information are not
                            permitted in project spaces.
                        </CardContent>
                    </Card>
                </div>
                <p className="max-w-3xl text-sm leading-7 text-ink-muted">
                    Report a conduct concern through the same private channel used for security
                    reports. The operator decides the response, which may include removing access to
                    project spaces.
                </p>
            </Reveal>

            <StaggerReveal className="flex flex-wrap gap-2 rounded-lg border border-line bg-panel/60 p-5">
                <Button asChild variant="outline" color="neutral" size="sm">
                    <Link href="/contact">Contact guidance</Link>
                </Button>
                <Button asChild variant="subtle" color="neutral" size="sm">
                    <Link href="/faq">
                        <BookOpen className="size-3.5" aria-hidden="true" />
                        FAQ
                    </Link>
                </Button>
                <Button asChild variant="subtle" color="neutral" size="sm">
                    <Link href="/about">How the platform works</Link>
                </Button>
            </StaggerReveal>
        </div>
    );
}
