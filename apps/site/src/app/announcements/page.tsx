import type { ReactNode } from "react";
import { EmptyState, Markdown } from "@nethack/ui/static";

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
        <div className="mx-auto flex w-full max-w-[800px] flex-col gap-8 px-6 py-12">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-semibold tracking-tight">Announcements</h1>
                <p className="text-sm text-ink-muted">
                    Public updates published by competition organizations.
                </p>
            </div>
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
                <div className="flex flex-col divide-y divide-line">
                    {announcements.items.map((announcement) => (
                        <article key={announcement.id} className="flex flex-col gap-3 py-6 first:pt-0">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
                                <span>{announcement.organizationName}</span>
                                <span>
                                    {announcement.publishedAt === null
                                        ? "Draft"
                                        : new Intl.DateTimeFormat("en", {
                                              dateStyle: "medium",
                                          }).format(new Date(announcement.publishedAt))}
                                </span>
                            </div>
                            <h2 className="text-lg font-semibold">{announcement.title}</h2>
                            <Markdown source={announcement.bodyMarkdown} />
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
}
