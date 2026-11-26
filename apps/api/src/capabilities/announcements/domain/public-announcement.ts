import { z } from "zod";
import { cursorSchema, limitSchema, slugSchema, type PublicAnnouncement } from "@nethack/contracts";

export const publicAnnouncementQuerySchema = z.object({
    organization: slugSchema.optional(),
    cursor: cursorSchema.optional(),
    limit: limitSchema.optional(),
});

export interface PublicAnnouncementSource {
    readonly id: string;
    readonly title: string;
    readonly bodyMarkdown: string;
    readonly publishedAt: Date | null;
    readonly organizationName: string;
    readonly organizationSlug: string;
}

export function toPublicAnnouncement(source: PublicAnnouncementSource): PublicAnnouncement {
    if (source.publishedAt === null) {
        throw new Error("A public announcement must have a publication timestamp.");
    }
    return {
        id: source.id,
        title: source.title,
        bodyMarkdown: source.bodyMarkdown,
        publishedAt: source.publishedAt.toISOString(),
        organizationName: source.organizationName,
        organizationSlug: source.organizationSlug,
    };
}
