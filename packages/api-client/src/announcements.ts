import {
    announcementSchema,
    createAnnouncementRequestSchema,
    listResponseSchema,
    publicAnnouncementSchema,
    updateAnnouncementRequestSchema,
    type Announcement,
    type CreateAnnouncementRequest,
    type ListResponse,
    type PublicAnnouncement,
    type UpdateAnnouncementRequest,
} from "@nethack/contracts";
import type { ApiClient } from "./client.js";

export interface AnnouncementPageQuery {
    readonly cursor?: string;
    readonly limit?: number;
}

export interface PublicAnnouncementQuery extends AnnouncementPageQuery {
    readonly organization: string;
}

const announcementListSchema = listResponseSchema(announcementSchema);
const publicAnnouncementListSchema = listResponseSchema(publicAnnouncementSchema);

export class AnnouncementsApi {
    private readonly client: ApiClient;

    constructor(client: ApiClient) {
        this.client = client;
    }

    async list(
        organizationId: string,
        query: AnnouncementPageQuery = {},
    ): Promise<ListResponse<Announcement>> {
        return this.client.request("GET", `/api/v1/organizations/${organizationId}/announcements`, {
            query: { cursor: query.cursor, limit: query.limit },
            schema: announcementListSchema,
        });
    }

    async create(organizationId: string, input: CreateAnnouncementRequest): Promise<Announcement> {
        return this.client.request(
            "POST",
            `/api/v1/organizations/${organizationId}/announcements`,
            {
                body: createAnnouncementRequestSchema.parse(input),
                schema: announcementSchema,
            },
        );
    }

    async publish(announcementId: string): Promise<Announcement> {
        return this.client.request("POST", `/api/v1/announcements/${announcementId}/publish`, {
            schema: announcementSchema,
        });
    }

    async update(announcementId: string, input: UpdateAnnouncementRequest): Promise<Announcement> {
        return this.client.request("PATCH", `/api/v1/announcements/${announcementId}`, {
            body: updateAnnouncementRequestSchema.parse(input),
            schema: announcementSchema,
        });
    }

    async publicList(query: PublicAnnouncementQuery): Promise<ListResponse<PublicAnnouncement>> {
        return this.client.request("GET", "/api/v1/public/announcements", {
            query: {
                organization: query.organization,
                cursor: query.cursor,
                limit: query.limit,
            },
            schema: publicAnnouncementListSchema,
        });
    }
}
