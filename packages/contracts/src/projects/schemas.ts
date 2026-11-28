import { z } from "zod";
import {
    emailSchema,
    httpUrlSchema,
    idSchema,
    isoDateTimeSchema,
    markdownSchema,
} from "../common/schemas.js";

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
    videoUrl: httpUrlSchema.nullable(),
    aiDisclosure: z.string().max(2000),
    tags: z.array(z.string()),
    status: projectStatusSchema,
    publishedAt: isoDateTimeSchema.nullable(),
    lockedAt: isoDateTimeSchema.nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
});
export type Project = z.infer<typeof projectSchema>;

export const projectMemberSchema = z.object({
    userId: idSchema,
    displayName: z.string(),
    avatarUrl: httpUrlSchema.nullable(),
    role: z.enum(["owner", "member"]),
});
export type ProjectMember = z.infer<typeof projectMemberSchema>;

export const addProjectMemberRequestSchema = z
    .object({
        email: emailSchema,
    })
    .strict();
export type AddProjectMemberRequest = z.infer<typeof addProjectMemberRequestSchema>;

export const projectDetailSchema = projectSchema.extend({
    teamName: z.string().nullable(),
    members: z.array(
        z.object({
            userId: idSchema,
            displayName: z.string(),
            avatarUrl: httpUrlSchema.nullable(),
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
        videoUrl: httpUrlSchema.nullable().default(null),
        aiDisclosure: z.string().trim().max(2000).default(""),
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
        videoUrl: httpUrlSchema.nullable().optional(),
        aiDisclosure: z.string().trim().max(2000).optional(),
        tags: z.array(z.string().trim().min(1).max(32)).max(10).optional(),
        teamId: idSchema.nullable().optional(),
    })
    .strict();
export type UpdateProjectRequest = z.infer<typeof updateProjectRequestSchema>;

export const PROJECT_EVIDENCE_LABELS = {
    repositoryUrl: "repository URL",
    demoUrl: "demo URL",
    videoUrl: "demonstration video URL",
    aiDisclosure: "AI-use disclosure",
} as const;

export type ProjectEvidenceField = keyof typeof PROJECT_EVIDENCE_LABELS;

export interface ProjectEvidence {
    readonly repositoryUrl: string | null;
    readonly demoUrl: string | null;
    readonly videoUrl: string | null;
    readonly aiDisclosure: string;
}

/** Submission evidence the project must provide before any version exists. */
export function missingProjectEvidence(project: ProjectEvidence): readonly ProjectEvidenceField[] {
    const missing: ProjectEvidenceField[] = [];
    if ((project.repositoryUrl ?? "").trim().length === 0) {
        missing.push("repositoryUrl");
    }
    if ((project.demoUrl ?? "").trim().length === 0) {
        missing.push("demoUrl");
    }
    if ((project.videoUrl ?? "").trim().length === 0) {
        missing.push("videoUrl");
    }
    if (project.aiDisclosure.trim().length === 0) {
        missing.push("aiDisclosure");
    }
    return missing;
}

export const projectLinkTargetSchema = z.object({
    kind: z.enum(["repository", "demo"]),
    url: httpUrlSchema,
});
export type ProjectLinkTarget = z.infer<typeof projectLinkTargetSchema>;
