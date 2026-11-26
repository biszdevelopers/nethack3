import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Gavel, ShieldCheck, Users, Workflow } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@nethack/ui/static";
import { Reveal, StaggerReveal, Tilt } from "@nethack/ui/motion";

export const metadata = {
    title: "About",
    description: "How nethack organizes competitions, teams, submissions, and review.",
};

export default function AboutPage(): ReactNode {
    return (
        <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-12 px-4 py-10 sm:px-6 md:py-14">
            <Reveal className="flex flex-col gap-4">
                <Badge variant="soft" color="primary" dot>
                    platform
                </Badge>
                <h1 className="text-3xl font-extrabold tracking-tight glow sm:text-4xl md:text-5xl">
                    About nethack
                </h1>
                <p className="max-w-3xl text-base text-ink-muted">
                    nethack is a competition platform. It does not run competitions itself; it
                    gives organizations the structure to run them consistently and gives
                    participants one place to take part.
                </p>
            </Reveal>

            <StaggerReveal className="grid gap-4 md:grid-cols-2">
                <Tilt>
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="size-4 text-primary" aria-hidden="true" />
                                For participants
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3 text-sm text-ink-muted">
                            <p>
                                Sign in with your organization account, register for an open
                                competition, and manage your team from the workspace.
                            </p>
                            <p>
                                Projects, attachments, and submission versions stay attached to
                                your team. Organizer decisions and review notes appear in the same
                                place.
                            </p>
                        </CardContent>
                    </Card>
                </Tilt>
                <Tilt>
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Workflow className="size-4 text-primary" aria-hidden="true" />
                                For organizers
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3 text-sm text-ink-muted">
                            <p>
                                Configure series and editions, publish rules and schedules, approve
                                registrations, and assign judges from one administration surface.
                            </p>
                            <p>
                                Every organization is isolated. Membership roles and competition
                                eligibility are enforced by the API and by row-level security.
                            </p>
                        </CardContent>
                    </Card>
                </Tilt>
                <Tilt>
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Gavel className="size-4 text-primary" aria-hidden="true" />
                                How review works
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-ink-muted">
                            Judges receive assignments tied to a rubric. Scores and written feedback
                            are submitted per criterion, and conflicts of interest can be declared
                            before evaluation.
                        </CardContent>
                    </Card>
                </Tilt>
                <Tilt>
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
                                Public information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-ink-muted">
                            Only published competitions, published projects, and announcements
                            marked public appear here. Private teams, submissions, and evaluations
                            stay inside the authenticated workspace.
                        </CardContent>
                    </Card>
                </Tilt>
            </StaggerReveal>

            <Reveal className="rounded-xl border border-primary/25 bg-primary/[0.06] p-6 md:p-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-xl font-bold tracking-tight">Ready to take part?</h2>
                        <p className="text-sm text-ink-muted">
                            Browse published editions or open the workspace to register.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button asChild>
                            <Link href="/competitions">
                                Browse competitions
                                <ArrowRight className="size-4" aria-hidden="true" />
                            </Link>
                        </Button>
                        <Button asChild variant="outline" color="neutral">
                            <Link href="/faq">Read the FAQ</Link>
                        </Button>
                    </div>
                </div>
            </Reveal>
        </div>
    );
}
