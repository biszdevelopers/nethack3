import type { ReactNode } from "react";
import Link from "next/link";
import { Bug, Database, MessageSquare, Shield } from "lucide-react";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@nethack/ui/static";
import { Reveal, StaggerReveal } from "@nethack/ui/motion";

export const metadata = {
    title: "Contact",
    description:
        "Where to send questions about a competition, a security report, a privacy request, or a platform defect on nethack.",
};

const ROUTES = [
    {
        icon: MessageSquare,
        title: "Competition and account questions",
        body: "The organizing team owns registration decisions, schedules, rule clarifications, judging, and results. Use the contact channel that team publishes with your competition or in your registration correspondence. Include the competition name, the display name on your account, and the page you were using.",
    },
    {
        icon: Shield,
        title: "Security reports",
        body: "Report a suspected vulnerability privately to the operator of this deployment. Do not open a public report, post reproduction steps in a public channel, or access data that does not belong to you. State the affected page or endpoint, the conditions required to reproduce the behavior, the observed result, and the expected result.",
    },
    {
        icon: Database,
        title: "Privacy and account data",
        body: "Account identity is provided by Basis Auth. You can review and correct your display name and locale in the workspace settings. nethack does not provide a self-service export or deletion flow; direct a data request to the team that operates the deployment, which retains competition records under its own policy.",
    },
    {
        icon: Bug,
        title: "Platform defects",
        body: "For a broken page or workflow, include the page address, the action you took, the result you expected, the result you observed, and the approximate time. A screenshot helps when the problem is visual. Report the defect to the team that operates the deployment.",
    },
] as const;

export default function ContactPage(): ReactNode {
    const workspaceOrigin = process.env.WORKSPACE_ORIGIN ?? "http://localhost:5173";

    return (
        <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-10 px-4 py-10 sm:px-6 md:py-14">
            <Reveal className="flex flex-col gap-4">
                <Badge variant="soft" color="primary" dot>
                    support
                </Badge>
                <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
                    Contact
                </h1>
                <p className="max-w-3xl text-base text-ink-muted">
                    nethack is the platform; each competition is operated by the organization that
                    publishes it. Choose the request type below so it reaches the people who can
                    resolve it.
                </p>
                <Alert
                    variant="soft"
                    tone="neutral"
                    title="No platform-wide address is published here"
                    icon={<MessageSquare className="size-4" />}
                >
                    <p>
                        Contact details belong to the organization operating this deployment, so
                        this page does not list a platform-wide address.
                    </p>
                </Alert>
            </Reveal>

            <StaggerReveal className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {ROUTES.map((route) => {
                    const Icon = route.icon;
                    return (
                        <Card key={route.title} variant="soft" className="h-full">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Icon className="size-4 text-primary" aria-hidden="true" />
                                    {route.title}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm leading-7 text-ink-muted">
                                {route.body}
                            </CardContent>
                        </Card>
                    );
                })}
            </StaggerReveal>

            <Reveal className="grid gap-6 rounded-lg border border-line bg-panel/60 p-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:p-8">
                <div className="flex flex-col gap-3">
                    <h2 className="text-xl font-bold tracking-tight">What to include</h2>
                    <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-7 text-ink-muted">
                        <li>The competition and edition name.</li>
                        <li>The display name on the account you used.</li>
                        <li>The page address and the action you attempted.</li>
                        <li>For rule questions, the specific rule and your interpretation.</li>
                        <li>For security reports, reproduction steps and the affected endpoint.</li>
                    </ul>
                </div>
                <div className="flex flex-col gap-3">
                    <h2 className="text-xl font-bold tracking-tight">What not to send</h2>
                    <p className="text-sm leading-7 text-ink-muted">
                        Never send passwords, session cookies, access tokens, or another
                        participant&apos;s personal data. Platform staff never need your credentials
                        to investigate a defect.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline" color="neutral" size="sm">
                            <Link href="/faq">Read the FAQ</Link>
                        </Button>
                        <Button asChild variant="subtle" color="neutral" size="sm">
                            <a href={`${workspaceOrigin}/sign-in`}>Open the workspace</a>
                        </Button>
                    </div>
                </div>
            </Reveal>

            <Reveal delay={0.05} className="text-sm text-ink-muted">
                <p>
                    Contributors should read{" "}
                    <Link
                        href="/contributing"
                        className="text-primary underline underline-offset-2 hover:text-primary-hover"
                    >
                        the contributing and disclosure policy
                    </Link>{" "}
                    before reporting a security issue or preparing a code change.
                </p>
            </Reveal>
        </div>
    );
}
