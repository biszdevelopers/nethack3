export interface AnnouncementSummary {
    readonly id: string;
    readonly organizationId: string;
    readonly title: string;
    readonly bodyMarkdown: string;
    readonly publishedAt: string | null;
    readonly visibility: "organization" | "public";
}

export interface AnnouncementsContract {
    listPublished(
        organizationId: string,
        options: { readonly limit: number },
    ): Promise<readonly AnnouncementSummary[]>;
}

export const ANNOUNCEMENTS_CONTRACT = "announcements.v1";
