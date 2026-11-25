import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "../common/schemas.js";

export const criterionSchema = z.object({
    id: idSchema,
    name: z.string(),
    description: z.string(),
    maxScore: z.number().int().min(1).max(100),
    weight: z.number().min(0.1).max(10),
    position: z.number().int().nonnegative(),
});
export type Criterion = z.infer<typeof criterionSchema>;

export const judgingRubricSchema = z.object({
    id: idSchema,
    organizationId: idSchema,
    editionId: idSchema,
    name: z.string(),
    description: z.string(),
    criteria: z.array(criterionSchema),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
});
export type JudgingRubric = z.infer<typeof judgingRubricSchema>;

export const createRubricRequestSchema = z
    .object({
        name: z.string().trim().min(2).max(120),
        description: z.string().max(2000).default(""),
        criteria: z
            .array(
                z
                    .object({
                        name: z.string().trim().min(1).max(120),
                        description: z.string().max(1000).default(""),
                        maxScore: z.number().int().min(1).max(100),
                        weight: z.number().min(0.1).max(10).default(1),
                    })
                    .strict(),
            )
            .min(1)
            .max(20),
    })
    .strict();
export type CreateRubricRequest = z.infer<typeof createRubricRequestSchema>;

export const judgeAssignmentStatusSchema = z.enum([
    "assigned",
    "in_progress",
    "submitted",
    "conflict_declared",
    "revoked",
]);
export type JudgeAssignmentStatus = z.infer<typeof judgeAssignmentStatusSchema>;

export const judgeAssignmentSchema = z.object({
    id: idSchema,
    organizationId: idSchema,
    editionId: idSchema,
    rubricId: idSchema,
    submissionId: idSchema,
    judgeUserId: idSchema,
    judgeDisplayName: z.string(),
    projectTitle: z.string(),
    status: judgeAssignmentStatusSchema,
    conflictNote: z.string().nullable(),
    assignmentNote: z.string(),
    dueAt: isoDateTimeSchema.nullable(),
    assignedAt: isoDateTimeSchema,
});
export type JudgeAssignment = z.infer<typeof judgeAssignmentSchema>;

export const createAssignmentRequestSchema = z
    .object({
        submissionId: idSchema,
        judgeEmail: z.email(),
        rubricId: idSchema,
        dueAt: isoDateTimeSchema.nullable().default(null),
        note: z.string().max(2000).default(""),
    })
    .strict();
export type CreateAssignmentRequest = z.infer<typeof createAssignmentRequestSchema>;

export const conflictDeclarationRequestSchema = z
    .object({
        note: z.string().trim().min(5).max(2000),
    })
    .strict();
export type ConflictDeclarationRequest = z.infer<typeof conflictDeclarationRequestSchema>;

export const evaluationScoreSchema = z.object({
    criterionId: idSchema,
    score: z.number().int().min(0).max(100),
    comment: z.string().max(2000).default(""),
});
export type EvaluationScore = z.infer<typeof evaluationScoreSchema>;

export const saveEvaluationRequestSchema = z
    .object({
        scores: z.array(evaluationScoreSchema).min(1).max(20),
        overallComment: z.string().max(4000).default(""),
    })
    .strict();
export type SaveEvaluationRequest = z.infer<typeof saveEvaluationRequestSchema>;

export const evaluationSchema = z.object({
    id: idSchema,
    organizationId: idSchema,
    assignmentId: idSchema,
    judgeUserId: idSchema,
    status: z.enum(["draft", "submitted"]),
    overallComment: z.string(),
    scores: z.array(evaluationScoreSchema),
    weightedScore: z.number().nullable(),
    submittedAt: isoDateTimeSchema.nullable(),
    updatedAt: isoDateTimeSchema,
});
export type Evaluation = z.infer<typeof evaluationSchema>;

export const assignmentSubmissionSummarySchema = z.object({
    id: idSchema,
    projectId: idSchema,
    projectTitle: z.string(),
    teamId: idSchema.nullable(),
});
export type AssignmentSubmissionSummary = z.infer<typeof assignmentSubmissionSummarySchema>;

export const assignmentDetailSchema = z.object({
    assignment: judgeAssignmentSchema,
    criteria: z.array(criterionSchema),
    submission: assignmentSubmissionSummarySchema,
    evaluation: evaluationSchema.nullable(),
});
export type AssignmentDetail = z.infer<typeof assignmentDetailSchema>;

export const assignmentHistorySchema = z.object({
    evaluation: evaluationSchema.nullable(),
});
export type AssignmentHistory = z.infer<typeof assignmentHistorySchema>;
