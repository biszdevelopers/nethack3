import { describe, expect, it } from "vitest";
import {
    publicAnnouncementQuerySchema,
    toPublicAnnouncement,
} from "../domain/public-announcement.js";

const announcementId = "11111111-1111-4111-8111-111111111111";

describe("publicAnnouncementQuerySchema", () => {
    it("accepts a request without an organization", () => {
        const parsed = publicAnnouncementQuerySchema.parse({});
        expect(parsed.organization).toBeUndefined();
    });

    it("accepts a valid organization slug", () => {
        const parsed = publicAnnouncementQuerySchema.parse({ organization: "acme-robotics" });
        expect(parsed.organization).toBe("acme-robotics");
    });

    it("rejects an invalid organization slug", () => {
        const result = publicAnnouncementQuerySchema.safeParse({ organization: "Not A Slug" });
        expect(result.success).toBe(false);
    });

    it("coerces the limit and keeps the cursor", () => {
        const parsed = publicAnnouncementQuerySchema.parse({ limit: "5", cursor: "abc" });
        expect(parsed.limit).toBe(5);
        expect(parsed.cursor).toBe("abc");
    });
});

describe("toPublicAnnouncement", () => {
    it("maps the public projection without private fields", () => {
        const item = toPublicAnnouncement({
            id: announcementId,
            title: "Schedule update",
            bodyMarkdown: "The finals moved to Friday.",
            publishedAt: new Date("2026-01-02T03:04:05.000Z"),
            organizationName: "Acme Robotics",
            organizationSlug: "acme-robotics",
        });

        expect(item).toEqual({
            id: announcementId,
            title: "Schedule update",
            bodyMarkdown: "The finals moved to Friday.",
            publishedAt: "2026-01-02T03:04:05.000Z",
            organizationName: "Acme Robotics",
            organizationSlug: "acme-robotics",
        });
        expect(item).not.toHaveProperty("authorUserId");
        expect(item).not.toHaveProperty("organizationId");
    });

    it("rejects an unpublished row", () => {
        expect(() =>
            toPublicAnnouncement({
                id: announcementId,
                title: "Draft",
                bodyMarkdown: "",
                publishedAt: null,
                organizationName: "Acme Robotics",
                organizationSlug: "acme-robotics",
            }),
        ).toThrow("public announcement");
    });
});
