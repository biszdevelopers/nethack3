import { z } from "zod";
import { httpUrlSchema, idSchema, isoDateTimeSchema, markdownSchema } from "../common/schemas.js";

export const projectStatusSchema = z.enum(["draft", "published", "archived"]);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const projectSchema = z.object({
    id: idSchema,
    organizationId: idSchema,
    editionId: idSchema,
    teamId: idSchema.nullable(),
    ownerUserId: idSchema,
    title: z.string(),
    slug: z.string(),
    summary: z.string(),
    descriptionMarkdown: z.string(),
    repositoryUrl: httpUrlSchema.nullable(),
    demoUrl: httpUrlSchema.nullable(),
    tags: z.array(z.string()),
    status: projectStatusSchema,
    publishedAt: isoDateTimeSchema.nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
});
export type Project = z.infer<typeof projectSchema>;

export const projectDetailSchema = projectSchema.extend({
    teamName: z.string().nullable(),
    members: z.array(
        z.object({
            userId: idSchema,
            displayName: z.string(),
            role: z.enum(["owner", "member"]),
        }),
    ),
    submissions: z.array(
        z.object({
            id: idSchema,
            status: z.string(),
            currentVersion: z.number().int(),
            submittedAt: isoDateTimeSchema.nullable(),
        }),
    ),
});
export type ProjectDetail = z.infer<typeof projectDetailSchema>;

export const createProjectRequestSchema = z
    .object({
        editionId: idSchema,
        teamId: idSchema.nullable().default(null),
        title: z.string().trim().min(2).max(160),
        summary: z.string().trim().min(2).max(500),
        descriptionMarkdown: markdownSchema.default(""),
        repositoryUrl: httpUrlSchema.nullable().default(null),
        demoUrl: httpUrlSchema.nullable().default(null),
        tags: z.array(z.string().trim().min(1).max(32)).max(10).default([]),
    })
    .strict();
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;

export const updateProjectRequestSchema = z
    .object({
        title: z.string().trim().min(2).max(160).optional(),
        summary: z.string().trim().min(2).max(500).optional(),
        descriptionMarkdown: markdownSchema.optional(),
        repositoryUrl: httpUrlSchema.nullable().optional(),
        demoUrl: httpUrlSchema.nullable().optional(),
        tags: z.array(z.string().trim().min(1).max(32)).max(10).optional(),
        teamId: idSchema.nullable().optional(),
    })
    .strict();
export type UpdateProjectRequest = z.infer<typeof updateProjectRequestSchema>;

export const projectLinkTargetSchema = z.object({
    kind: z.enum(["repository", "demo"]),
    url: httpUrlSchema,
});
export type ProjectLinkTarget = z.infer<typeof projectLinkTargetSchema>;
