import type { ReactNode } from "react";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@nethack/ui";
import {
    ArrowUpRight,
    CalendarClock,
    EyeOff,
    ListChecks,
    MessagesSquare,
    Users,
} from "lucide-react";

export function PresentationPage(): ReactNode {
    const siteOrigin = import.meta.env.VITE_SITE_ORIGIN ?? "http://localhost:3000";

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Presentation stage"
                description="Guidance for teams invited to present their project after judging."
            />

            <Alert
                variant="soft"
                tone="neutral"
                title="Invitations come from the organizers"
                icon={<Users className="size-4" />}
            >
                <p>
                    The organizing team selects presenting teams from the published judging results,
                    starting with the highest-placed teams. A team presents only after it receives
                    an invitation with a time and location. Check notifications and the competition
                    schedule for the current edition.
                </p>
            </Alert>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ListChecks className="size-4 text-primary" aria-hidden="true" />
                            What to prepare
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-6 text-ink-muted">
                            <li>
                                A live walkthrough of the submitted project, with any accounts,
                                sample data, and local setup ready before the slot.
                            </li>
                            <li>
                                A short explanation of the problem, your approach, and the parts of
                                the project that used AI tools, matching your submission disclosure.
                            </li>
                            <li>
                                A backup recording in case the live environment cannot run. The
                                recording must follow the same anonymity rules as the presentation.
                            </li>
                            <li>
                                The repository link and README, in case judges inspect the source.
                            </li>
                        </ul>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <EyeOff className="size-4 text-primary" aria-hidden="true" />
                            Identity and anonymity
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3 text-sm leading-6 text-ink-muted">
                        <p>
                            Presentations must not reveal the identity of any participant unless the
                            organizers explicitly ask for it. Keep names, school or employer
                            identifiers, personal accounts, and identifying background details out
                            of slides, demos, and recordings.
                        </p>
                        <p>
                            The competition rules govern submission content, AI disclosure, and
                            licensing. Those requirements continue to apply after judging ends.
                        </p>
                        <Button
                            asChild
                            variant="outline"
                            color="neutral"
                            size="sm"
                            className="w-fit"
                        >
                            <a href={`${siteOrigin}/competitions`}>Browse competition pages</a>
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CalendarClock className="size-4 text-primary" aria-hidden="true" />
                        Scheduling and contact
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-sm leading-6 text-ink-muted">
                    <p>
                        No presentation dates are published on this page. The organizers send the
                        slot, venue, and format with the invitation, and any change is announced
                        through the same channel and in workspace notifications.
                    </p>
                    <p>
                        If your team is invited and the schedule conflicts with a documented
                        constraint, contact the organizing team before the slot. Do not send
                        credentials or another participant&apos;s personal data.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline" color="neutral" size="sm">
                            <a
                                href={`${siteOrigin}/contact`}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Contact guidance
                                <ArrowUpRight className="size-3.5" aria-hidden="true" />
                            </a>
                        </Button>
                        <Button asChild variant="subtle" color="neutral" size="sm">
                            <a href={`${siteOrigin}/faq`}>Read the FAQ</a>
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <p className="text-xs text-ink-subtle">
                <MessagesSquare className="mr-1.5 inline size-3" aria-hidden="true" />
                Presentation logistics are owned by the organizing team, not by the platform.
            </p>
        </div>
    );
}
