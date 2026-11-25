import { z } from "zod";
import { idSchema, isoDateTimeSchema, markdownSchema } from "../common/schemas.js";

export const announcementVisibilitySchema = z.enum(["organization", "public"]);
export type AnnouncementVisibility = z.infer<typeof announcementVisibilitySchema>;

export const announcementSchema = z.object({
    id: idSchema,
    organizationId: idSchema,
    editionId: idSchema.nullable(),
    title: z.string(),
    bodyMarkdown: z.string(),
    visibility: announcementVisibilitySchema,
    publishedAt: isoDateTimeSchema.nullable(),
    authorUserId: idSchema,
    authorDisplayName: z.string(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
});
export type Announcement = z.infer<typeof announcementSchema>;

export const createAnnouncementRequestSchema = z
    .object({
        editionId: idSchema.nullable().default(null),
        title: z.string().trim().min(2).max(160),
        bodyMarkdown: markdownSchema,
        visibility: announcementVisibilitySchema.default("organization"),
        publish: z.boolean().default(false),
    })
    .strict();
export type CreateAnnouncementRequest = z.infer<typeof createAnnouncementRequestSchema>;

export const updateAnnouncementRequestSchema = z
    .object({
        title: z.string().trim().min(2).max(160).optional(),
        bodyMarkdown: markdownSchema.optional(),
        visibility: announcementVisibilitySchema.optional(),
    })
    .strict()
    .refine(
        (value) =>
            value.title !== undefined ||
            value.bodyMarkdown !== undefined ||
            value.visibility !== undefined,
        "Provide at least one field to update.",
    );
export type UpdateAnnouncementRequest = z.infer<typeof updateAnnouncementRequestSchema>;
