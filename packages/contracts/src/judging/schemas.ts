import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "../common/schemas.js";

export const rubricCommentTemplateSchema = z
    .object({
        label: z.string().trim().min(1).max(120),
        body: z.string().trim().min(1).max(2000),
    })
    .strict();
export type RubricCommentTemplate = z.infer<typeof rubricCommentTemplateSchema>;

export const rubricCommentGuidanceSchema = z
    .object({
        introduction: z.string().max(1000).default(""),
        guidelines: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
        templates: z.array(rubricCommentTemplateSchema).max(20).default([]),
    })
    .strict();
export type RubricCommentGuidance = z.infer<typeof rubricCommentGuidanceSchema>;

export const DEFAULT_RUBRIC_COMMENT_GUIDANCE: RubricCommentGuidance = {
    introduction: "Make feedback specific, respectful, and focused on the project.",
    guidelines: [
        "Describe a strength you observed and one actionable next step.",
        "Comment on the work, not the people or their background.",
        "Do not include your name or details that could identify you.",
    ],
    templates: [
        {
            label: "Strength + next step",
            body: "Strength I observed: {{describe a specific feature or decision}}\nNext step: {{suggest one concrete action and why it matters}}",
        },
        {
            label: "What stood out",
            body: "What stood out: {{describe a specific moment, feature, or result}}\nTo make it stronger: {{suggest one practical improvement}}",
        },
    ],
};

export const scoreCurvePointSchema = z
    .object({
        rawScore: z.number().int().min(0).max(100),
        displayScore: z.number().int().min(0).max(100),
    })
    .strict();
export type ScoreCurvePoint = z.infer<typeof scoreCurvePointSchema>;

export const scoreCurveSchema = z
    .object({
        points: z.array(scoreCurvePointSchema).min(2).max(21),
    })
    .strict();
export type ScoreCurve = z.infer<typeof scoreCurveSchema>;

export const DEFAULT_SCORE_CURVE: ScoreCurve = {
    points: [
        { rawScore: 0, displayScore: 0 },
        { rawScore: 100, displayScore: 100 },
    ],
};

export const scoreCurveResponseSchema = z.object({
    editionId: idSchema,
    curve: scoreCurveSchema,
    updatedAt: isoDateTimeSchema.nullable(),
});
export type ScoreCurveResponse = z.infer<typeof scoreCurveResponseSchema>;

export const criterionSchema = z.object({
    id: idSchema,
    name: z.string(),
    description: z.string(),
    minScore: z.number().int().min(0).max(99),
    maxScore: z.number().int().min(1).max(100),
    weight: z.number().min(0.01).max(100),
    position: z.number().int().nonnegative(),
});
export type Criterion = z.infer<typeof criterionSchema>;

export const judgingRubricSchema = z.object({
    id: idSchema,
    organizationId: idSchema,
    editionId: idSchema,
    divisionId: idSchema.nullable(),
    familyId: idSchema,
    version: z.number().int().positive(),
    active: z.boolean(),
    name: z.string(),
    description: z.string(),
    commentGuidance: rubricCommentGuidanceSchema,
    criteria: z.array(criterionSchema),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
});
export type JudgingRubric = z.infer<typeof judgingRubricSchema>;

const rubricCriterionInputSchema = z
    .object({
        name: z.string().trim().min(1).max(120),
        description: z.string().max(1000).default(""),
        minScore: z.number().int().min(0).max(99).default(0),
        maxScore: z.number().int().min(1).max(100),
        weight: z.number().min(0.01).max(100).default(1),
    })
    .strict();

export const createRubricRequestSchema = z
    .object({
        name: z.string().trim().min(2).max(120),
        description: z.string().max(2000).default(""),
        divisionId: idSchema.nullable().default(null),
        commentGuidance: rubricCommentGuidanceSchema
            .default(DEFAULT_RUBRIC_COMMENT_GUIDANCE)
            .optional(),
        criteria: z.array(rubricCriterionInputSchema).min(1).max(20),
    })
    .strict();
export type CreateRubricRequest = z.infer<typeof createRubricRequestSchema>;

export const updateRubricRequestSchema = z
    .object({
        name: z.string().trim().min(2).max(120).optional(),
        description: z.string().max(2000).optional(),
        divisionId: idSchema.nullable().optional(),
        commentGuidance: rubricCommentGuidanceSchema.optional(),
        criteria: z.array(rubricCriterionInputSchema).min(1).max(20).optional(),
    })
    .strict();
export type UpdateRubricRequest = z.infer<typeof updateRubricRequestSchema>;

export const rubricTemplateCriterionSchema = z
    .object({
        name: z.string().trim().min(1).max(120),
        description: z.string().max(1000).default(""),
        minScore: z.number().int().min(0).max(99).default(0),
        maxScore: z.number().int().min(1).max(100),
        weight: z.number().min(0.01).max(100),
        position: z.number().int().nonnegative().default(0),
    })
    .strict();
export type RubricTemplateCriterion = z.infer<typeof rubricTemplateCriterionSchema>;

export const rubricTemplateTrackSchema = z
    .object({
        key: z
            .string()
            .trim()
            .min(1)
            .max(64)
            .regex(
                /^[a-z0-9][a-z0-9_-]*$/,
                "Use lowercase letters, numbers, underscores, or hyphens.",
            ),
        name: z.string().trim().min(1).max(80),
        criteria: z.array(rubricTemplateCriterionSchema).min(1).max(20),
    })
    .strict();
export type RubricTemplateTrack = z.infer<typeof rubricTemplateTrackSchema>;

export const rubricTemplateDefinitionSchema = z
    .object({
        tracks: z.array(rubricTemplateTrackSchema).min(1).max(8),
        commentGuidance: rubricCommentGuidanceSchema.default(DEFAULT_RUBRIC_COMMENT_GUIDANCE),
    })
    .strict();
export type RubricTemplateDefinition = z.infer<typeof rubricTemplateDefinitionSchema>;

export const rubricTemplateSchema = z.object({
    id: idSchema,
    organizationId: idSchema,
    name: z.string(),
    description: z.string(),
    definition: rubricTemplateDefinitionSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
});
export type RubricTemplate = z.infer<typeof rubricTemplateSchema>;

export const createRubricTemplateRequestSchema = z
    .object({
        name: z.string().trim().min(2).max(120),
        description: z.string().max(1000).default(""),
        definition: rubricTemplateDefinitionSchema,
    })
    .strict();
export type CreateRubricTemplateRequest = z.infer<typeof createRubricTemplateRequestSchema>;

export const updateRubricTemplateRequestSchema = createRubricTemplateRequestSchema;
export type UpdateRubricTemplateRequest = z.infer<typeof updateRubricTemplateRequestSchema>;

export const applyRubricTemplateRequestSchema = z
    .object({
        divisionId: idSchema.nullable().default(null),
        trackKey: z.string().trim().min(1).max(64).optional(),
        name: z.string().trim().min(2).max(120).optional(),
    })
    .strict();
export type ApplyRubricTemplateRequest = z.infer<typeof applyRubricTemplateRequestSchema>;

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
    frozen: z.boolean().optional(),
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

export const evaluationStatusSchema = z.enum(["draft", "submitted"]);
export type EvaluationStatus = z.infer<typeof evaluationStatusSchema>;

export const evaluationSchema = z.object({
    id: idSchema,
    organizationId: idSchema,
    assignmentId: idSchema,
    judgeUserId: idSchema,
    status: evaluationStatusSchema,
    overallComment: z.string(),
    scores: z.array(evaluationScoreSchema),
    weightedScore: z.number().nullable(),
    submittedAt: isoDateTimeSchema.nullable(),
    updatedAt: isoDateTimeSchema,
});
export type Evaluation = z.infer<typeof evaluationSchema>;

export const evaluationVersionSchema = z.object({
    revision: z.number().int().min(1),
    status: evaluationStatusSchema,
    overallComment: z.string(),
    weightedScore: z.number().nullable(),
    scores: z.array(evaluationScoreSchema),
    submittedAt: isoDateTimeSchema.nullable(),
    createdAt: isoDateTimeSchema,
});
export type EvaluationVersion = z.infer<typeof evaluationVersionSchema>;

export const assignmentSubmissionSummarySchema = z.object({
    id: idSchema,
    projectId: idSchema,
    projectTitle: z.string(),
    teamId: idSchema.nullable(),
});
export type AssignmentSubmissionSummary = z.infer<typeof assignmentSubmissionSummarySchema>;

export const assignmentDetailSchema = z.object({
    assignment: judgeAssignmentSchema,
    rubric: judgingRubricSchema,
    criteria: z.array(criterionSchema),
    submission: assignmentSubmissionSummarySchema,
    evaluation: evaluationSchema.nullable(),
    scoreCurve: scoreCurveSchema,
    displayWeightedScore: z.number().nullable(),
    frozen: z.boolean(),
});
export type AssignmentDetail = z.infer<typeof assignmentDetailSchema>;

export const assignmentHistorySchema = z.object({
    evaluation: evaluationSchema.nullable(),
    versions: z.array(evaluationVersionSchema),
    scoreCurve: scoreCurveSchema,
    displayWeightedScore: z.number().nullable(),
});
export type AssignmentHistory = z.infer<typeof assignmentHistorySchema>;

export const judgingResultEvaluationSchema = z.object({
    assignmentId: idSchema,
    judgeUserId: idSchema,
    judgeDisplayName: z.string(),
    status: evaluationStatusSchema.nullable(),
    weightedScore: z.number().nullable(),
    submittedAt: isoDateTimeSchema.nullable(),
});
export type JudgingResultEvaluation = z.infer<typeof judgingResultEvaluationSchema>;

export const judgingResultSchema = z.object({
    submissionId: idSchema,
    projectId: idSchema,
    projectTitle: z.string(),
    teamId: idSchema.nullable(),
    teamName: z.string().nullable(),
    assignmentCount: z.number().int().nonnegative(),
    submittedCount: z.number().int().nonnegative(),
    averageScore: z.number().nullable(),
    displayScore: z.number().nullable().optional(),
    rank: z.number().int().positive().nullable(),
    evaluations: z.array(judgingResultEvaluationSchema),
});
export type JudgingResult = z.infer<typeof judgingResultSchema>;

export const judgeFlagStatusSchema = z.enum(["open", "resolved"]);
export type JudgeFlagStatus = z.infer<typeof judgeFlagStatusSchema>;

export const judgeFlagSchema = z.object({
    id: idSchema,
    organizationId: idSchema,
    editionId: idSchema,
    assignmentId: idSchema,
    submissionId: idSchema,
    reportedByUserId: idSchema,
    reportedByDisplayName: z.string(),
    reason: z.string(),
    status: judgeFlagStatusSchema,
    resolvedByUserId: idSchema.nullable(),
    resolvedByDisplayName: z.string().nullable(),
    resolvedAt: isoDateTimeSchema.nullable(),
    createdAt: isoDateTimeSchema,
});
export type JudgeFlag = z.infer<typeof judgeFlagSchema>;

export const createJudgeFlagRequestSchema = z
    .object({
        reason: z.string().trim().min(5).max(2000),
    })
    .strict();
export type CreateJudgeFlagRequest = z.infer<typeof createJudgeFlagRequestSchema>;

export const judgingCalibrationSchema = z.enum(["above", "in_line", "below", "insufficient_data"]);
export type JudgingCalibration = z.infer<typeof judgingCalibrationSchema>;

export const judgingCoverageJudgeSchema = z.object({
    judgeUserId: idSchema,
    judgeDisplayName: z.string(),
    assignmentCount: z.number().int().nonnegative(),
    submittedCount: z.number().int().nonnegative(),
    conflictCount: z.number().int().nonnegative(),
    openFlagCount: z.number().int().nonnegative(),
    averageWeightedScore: z.number().nullable(),
    editionAverageScore: z.number().nullable(),
    calibrationDelta: z.number().nullable(),
    calibration: judgingCalibrationSchema,
});
export type JudgingCoverageJudge = z.infer<typeof judgingCoverageJudgeSchema>;

export const judgingCoverageSchema = z.object({
    editionId: idSchema,
    editionName: z.string(),
    judgeCount: z.number().int().nonnegative(),
    assignmentCount: z.number().int().nonnegative(),
    submittedCount: z.number().int().nonnegative(),
    editionAverageScore: z.number().nullable(),
    judges: z.array(judgingCoverageJudgeSchema),
    openFlags: z.array(judgeFlagSchema),
});
export type JudgingCoverage = z.infer<typeof judgingCoverageSchema>;

export const judgingHistoryCriterionScoreSchema = z.object({
    criterionId: idSchema,
    criterionName: z.string(),
    maxScore: z.number().int().positive(),
    weight: z.number(),
    score: z.number().int().nonnegative(),
    comment: z.string(),
});
export type JudgingHistoryCriterionScore = z.infer<typeof judgingHistoryCriterionScoreSchema>;

export const judgingHistoryItemSchema = z.object({
    assignmentId: idSchema,
    submissionId: idSchema,
    projectId: idSchema,
    projectTitle: z.string(),
    teamId: idSchema.nullable(),
    teamName: z.string().nullable(),
    rubricName: z.string(),
    rubricVersion: z.number().int().positive().optional(),
    evaluationId: idSchema,
    weightedScore: z.number().nullable(),
    displayWeightedScore: z.number().nullable().optional(),
    overallComment: z.string(),
    submittedAt: isoDateTimeSchema,
    scores: z.array(judgingHistoryCriterionScoreSchema),
});
export type JudgingHistoryItem = z.infer<typeof judgingHistoryItemSchema>;
