import { z } from "zod";
import { httpUrlSchema, idSchema, isoDateTimeSchema, markdownSchema } from "../common/schemas.js";

export const submissionStatusSchema = z.enum([
    "draft",
    "submitted",
    "under_review",
    "changes_requested",
    "accepted",
    "rejected",
    "withdrawn",
    "disqualified",
]);
export type SubmissionStatus = z.infer<typeof submissionStatusSchema>;

export const submissionFileStatusSchema = z.enum([
    "quarantined",
    "scanning",
    "approved",
    "rejected",
    "deleted",
]);
export type SubmissionFileStatus = z.infer<typeof submissionFileStatusSchema>;

export const submissionFileSchema = z.object({
    id: idSchema,
    submissionId: idSchema.nullable(),
    projectId: idSchema.nullable(),
    fileName: z.string(),
    contentType: z.string(),
    byteSize: z.number().int().nonnegative(),
    checksumSha256: z.string(),
    status: submissionFileStatusSchema,
    rejectionReason: z.string().nullable(),
    uploadedByUserId: idSchema,
    createdAt: isoDateTimeSchema,
});
export type SubmissionFile = z.infer<typeof submissionFileSchema>;

export const submissionVersionSchema = z.object({
    id: idSchema,
    submissionId: idSchema,
    version: z.number().int().min(1),
    title: z.string(),
    summary: z.string(),
    descriptionMarkdown: z.string(),
    repositoryUrl: httpUrlSchema.nullable(),
    demoUrl: httpUrlSchema.nullable(),
    createdByUserId: idSchema,
    createdAt: isoDateTimeSchema,
    files: z.array(submissionFileSchema),
});
export type SubmissionVersion = z.infer<typeof submissionVersionSchema>;

export const submissionSchema = z.object({
    id: idSchema,
    organizationId: idSchema,
    editionId: idSchema,
    projectId: idSchema,
    teamId: idSchema.nullable(),
    status: submissionStatusSchema,
    currentVersion: z.number().int().min(0),
    submittedAt: isoDateTimeSchema.nullable(),
    projectTitle: z.string(),
    teamName: z.string().nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
});
export type Submission = z.infer<typeof submissionSchema>;

export const submissionDetailSchema = submissionSchema.extend({
    versions: z.array(submissionVersionSchema),
    reviewNote: z.string(),
    reviewNoteUpdatedAt: isoDateTimeSchema.nullable(),
});
export type SubmissionDetail = z.infer<typeof submissionDetailSchema>;

export const createSubmissionRequestSchema = z
    .object({
        projectId: idSchema,
    })
    .strict();
export type CreateSubmissionRequest = z.infer<typeof createSubmissionRequestSchema>;

export const createSubmissionVersionRequestSchema = z
    .object({
        title: z.string().trim().min(2).max(160),
        summary: z.string().trim().min(2).max(500),
        descriptionMarkdown: markdownSchema.default(""),
        repositoryUrl: httpUrlSchema.nullable().default(null),
        demoUrl: httpUrlSchema.nullable().default(null),
        submit: z.boolean().default(false),
    })
    .strict();
export type CreateSubmissionVersionRequest = z.infer<typeof createSubmissionVersionRequestSchema>;

export const reviewSubmissionRequestSchema = z
    .object({
        status: z.enum([
            "under_review",
            "changes_requested",
            "accepted",
            "rejected",
            "disqualified",
        ]),
        note: z.string().max(4000).default(""),
    })
    .strict();
export type ReviewSubmissionRequest = z.infer<typeof reviewSubmissionRequestSchema>;

export const uploadConstraints = {
    maxBytes: 25 * 1024 * 1024,
    maxFilesPerSubmission: 20,
    allowedContentTypes: [
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/gif",
        "application/pdf",
        "application/zip",
        "text/plain",
    ],
} as const;
