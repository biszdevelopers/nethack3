import type { ReactNode } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@nethack/ui/static";

export const metadata = {
    title: "About",
    description: "How nethack organizes competitions, teams, submissions, and review.",
};

export default function AboutPage(): ReactNode {
    return (
        <div className="mx-auto flex w-full max-w-[900px] flex-col gap-8 px-6 py-12">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-semibold tracking-tight">About nethack</h1>
                <p className="text-sm text-ink-muted">
                    nethack is a competition platform. It does not run competitions itself; it
                    gives organizations the structure to run them consistently.
                </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>For participants</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2 text-sm text-ink-muted">
                        <p>
                            Sign in with your organization account, register for an open
                            competition, and manage your team from the workspace.
                        </p>
                        <p>
                            Projects, attachments, and submission versions stay attached to your
                            team. Organizer decisions and review notes appear in the same place.
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>For organizers</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2 text-sm text-ink-muted">
                        <p>
                            Configure series and editions, publish rules and schedules, approve
                            registrations, and assign judges from one administration surface.
                        </p>
                        <p>
                            Every organization is isolated. Membership roles and competition
                            eligibility are enforced by the API and the database.
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>How review works</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-ink-muted">
                        Judges receive assignments tied to a rubric. Scores and written feedback
                        are submitted per criterion. Conflicts of interest can be declared before
                        evaluation.
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Public information</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-ink-muted">
                        Only published competitions, published projects, and announcements marked
                        public appear here. Private teams, submissions, and evaluations stay inside
                        the authenticated workspace.
                    </CardContent>
                </Card>
            </div>
            <p className="text-sm text-ink-muted">
                Ready to take part?{" "}
                <Link href="/competitions" className="text-primary underline-offset-4 hover:underline">
                    Browse competitions
                </Link>
                .
            </p>
        </div>
    );
}
