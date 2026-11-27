import type { ReactNode } from "react";
import { Megaphone } from "lucide-react";
import { EmptyState, Markdown } from "@nethack/ui/static";
import { Reveal } from "@nethack/ui/motion";
import { getAnnouncements } from "../../lib/public-api";

export const metadata = {
    title: "Announcements",
    description: "Public announcements from nethack organizations.",
};

export default async function AnnouncementsPage(): Promise<ReactNode> {
    let announcements: Awaited<ReturnType<typeof getAnnouncements>> = {
        items: [],
        nextCursor: null,
    };
    let unavailable = false;
    try {
        announcements = await getAnnouncements();
    } catch {
        unavailable = true;
    }

    return (
        <div className="mx-auto flex w-full max-w-[900px] flex-col gap-8 px-4 py-10 sm:px-6 md:py-14">
            <Reveal className="flex flex-col gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs text-primary">
                    <Megaphone className="size-3.5" aria-hidden="true" />
                    updates
                </span>
                <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                    Announcements
                </h1>
                <p className="text-base text-ink-muted">
                    Public updates published by competition organizations.
                </p>
            </Reveal>

            {unavailable ? (
                <EmptyState
                    title="Announcements are unavailable"
                    description="The public API could not be reached. Try again shortly."
                />
            ) : announcements.items.length === 0 ? (
                <EmptyState
                    title="No public announcements"
                    description="Organizations publish announcements here when there is something participants need to know."
                />
            ) : (
                <div className="flex flex-col gap-4">
                    {announcements.items.map((announcement, index) => (
                        <Reveal key={announcement.id} delay={index * 0.05}>
                            <article className="rounded-lg border border-line bg-panel/60 p-6 transition-colors hover:border-line-strong">
                                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
                                    <span className="text-primary">
                                        {announcement.organizationName}
                                    </span>
                                    <span>·</span>
                                    <span>
                                        {announcement.publishedAt === null
                                            ? "Draft"
                                            : new Intl.DateTimeFormat("en", {
                                                  dateStyle: "medium",
                                              }).format(new Date(announcement.publishedAt))}
                                    </span>
                                </div>
                                <h2 className="mb-3 text-xl font-bold tracking-tight">
                                    {announcement.title}
                                </h2>
                                <div className="prose-nethack">
                                    <Markdown source={announcement.bodyMarkdown} />
                                </div>
                            </article>
                        </Reveal>
                    ))}
                </div>
            )}
        </div>
    );
}
