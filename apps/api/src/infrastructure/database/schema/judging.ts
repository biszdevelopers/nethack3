import {
    boolean,
    foreignKey,
    index,
    integer,
    jsonb,
    numeric,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    unique,
    uuid,
} from "drizzle-orm/pg-core";
import { competitionEditions, divisions } from "./competitions.js";
import { organizations } from "./organizations.js";
import { submissions } from "./submissions.js";
import { users } from "./identity.js";

export interface RubricCommentTemplate {
    readonly label: string;
    readonly body: string;
}

export interface RubricCommentGuidance {
    readonly introduction: string;
    readonly guidelines: readonly string[];
    readonly templates: readonly RubricCommentTemplate[];
}

export interface RubricCriterionSnapshot {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly minScore: number;
    readonly maxScore: number;
    readonly weight: number;
    readonly position: number;
}

export interface RubricSnapshot {
    readonly rubricId: string;
    readonly name: string;
    readonly version: number;
    readonly divisionId: string | null;
    readonly commentGuidance: RubricCommentGuidance;
    readonly criteria: readonly RubricCriterionSnapshot[];
}

export interface ScoreCurvePoint {
    readonly rawScore: number;
    readonly displayScore: number;
}

export interface RubricTemplateCriterion {
    readonly name: string;
    readonly description: string;
    readonly minScore: number;
    readonly maxScore: number;
    readonly weight: number;
    readonly position: number;
}

export interface RubricTemplateTrack {
    readonly key: string;
    readonly name: string;
    readonly criteria: readonly RubricTemplateCriterion[];
}

export interface RubricTemplateDefinition {
    readonly tracks: readonly RubricTemplateTrack[];
    readonly commentGuidance: RubricCommentGuidance;
}

const EMPTY_COMMENT_GUIDANCE: RubricCommentGuidance = {
    introduction: "",
    guidelines: [],
    templates: [],
};

export const assignmentStatusEnum = pgEnum("assignment_status", [
    "assigned",
    "in_progress",
    "submitted",
    "conflict_declared",
    "revoked",
]);

export const evaluationStatusEnum = pgEnum("evaluation_status", ["draft", "submitted"]);

export const judgingRubrics = pgTable(
    "judging_rubrics",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        organizationId: uuid("organization_id")
            .notNull()
            .references(() => organizations.id, { onDelete: "cascade" }),
        editionId: uuid("edition_id").notNull(),
        divisionId: uuid("division_id"),
        familyId: uuid("family_id").notNull().defaultRandom(),
        version: integer("version").notNull().default(1),
        active: boolean("active").notNull().default(true),
        name: text("name").notNull(),
        description: text("description").notNull().default(""),
        commentGuidance: jsonb("comment_guidance")
            .$type<RubricCommentGuidance>()
            .notNull()
            .default(EMPTY_COMMENT_GUIDANCE),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        unique("judging_rubrics_id_org_unique").on(table.id, table.organizationId),
        uniqueIndex("judging_rubrics_family_version_unique").on(table.familyId, table.version),
        index("judging_rubrics_org_edition_idx").on(table.organizationId, table.editionId),
        index("judging_rubrics_family_idx").on(table.organizationId, table.familyId, table.version),
        index("judging_rubrics_division_idx").on(table.organizationId, table.divisionId),
        foreignKey({
            name: "judging_rubrics_edition_fk",
            columns: [table.editionId, table.organizationId],
            foreignColumns: [competitionEditions.id, competitionEditions.organizationId],
        }).onDelete("cascade"),
        foreignKey({
            name: "judging_rubrics_division_fk",
            columns: [table.divisionId, table.organizationId],
            foreignColumns: [divisions.id, divisions.organizationId],
        }).onDelete("restrict"),
    ],
);

export const judgingRubricTemplates = pgTable(
    "judging_rubric_templates",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        organizationId: uuid("organization_id")
            .notNull()
            .references(() => organizations.id, { onDelete: "cascade" }),
        name: text("name").notNull(),
        description: text("description").notNull().default(""),
        definition: jsonb("definition").$type<RubricTemplateDefinition>().notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        unique("judging_rubric_templates_id_org_unique").on(table.id, table.organizationId),
        uniqueIndex("judging_rubric_templates_org_name_unique").on(
            table.organizationId,
            table.name,
        ),
        index("judging_rubric_templates_org_idx").on(table.organizationId),
    ],
);

export const judgingScoreCurves = pgTable(
    "judging_score_curves",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        organizationId: uuid("organization_id")
            .notNull()
            .references(() => organizations.id, { onDelete: "cascade" }),
        editionId: uuid("edition_id").notNull(),
        points: jsonb("points").$type<readonly ScoreCurvePoint[]>().notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        unique("judging_score_curves_id_org_unique").on(table.id, table.organizationId),
        uniqueIndex("judging_score_curves_org_edition_unique").on(
            table.organizationId,
            table.editionId,
        ),
        foreignKey({
            name: "judging_score_curves_edition_fk",
            columns: [table.editionId, table.organizationId],
            foreignColumns: [competitionEditions.id, competitionEditions.organizationId],
        }).onDelete("cascade"),
    ],
);

export const judgingCriteria = pgTable(
    "judging_criteria",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        organizationId: uuid("organization_id")
            .notNull()
            .references(() => organizations.id, { onDelete: "cascade" }),
        rubricId: uuid("rubric_id").notNull(),
        name: text("name").notNull(),
        description: text("description").notNull().default(""),
        minScore: integer("min_score").notNull().default(0),
        maxScore: integer("max_score").notNull(),
        weight: numeric("weight", { precision: 5, scale: 2 }).notNull().default("1"),
        position: integer("position").notNull().default(0),
    },
    (table) => [
        unique("judging_criteria_id_org_unique").on(table.id, table.organizationId),
        index("judging_criteria_rubric_idx").on(table.organizationId, table.rubricId),
        foreignKey({
            name: "judging_criteria_rubric_fk",
            columns: [table.rubricId, table.organizationId],
            foreignColumns: [judgingRubrics.id, judgingRubrics.organizationId],
        }).onDelete("cascade"),
    ],
);

export const judgeAssignments = pgTable(
    "judge_assignments",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        organizationId: uuid("organization_id")
            .notNull()
            .references(() => organizations.id, { onDelete: "cascade" }),
        editionId: uuid("edition_id").notNull(),
        rubricId: uuid("rubric_id").notNull(),
        submissionId: uuid("submission_id").notNull(),
        judgeUserId: uuid("judge_user_id")
            .notNull()
            .references(() => users.id, { onDelete: "restrict" }),
        status: assignmentStatusEnum("status").notNull().default("assigned"),
        conflictNote: text("conflict_note"),
        assignmentNote: text("assignment_note").notNull().default(""),
        dueAt: timestamp("due_at", { withTimezone: true }),
        assignedByUserId: uuid("assigned_by_user_id").references(() => users.id, {
            onDelete: "set null",
        }),
        assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        unique("judge_assignments_id_org_unique").on(table.id, table.organizationId),
        uniqueIndex("judge_assignments_submission_judge_unique").on(
            table.submissionId,
            table.judgeUserId,
        ),
        index("judge_assignments_judge_status_idx").on(
            table.organizationId,
            table.judgeUserId,
            table.status,
        ),
        index("judge_assignments_edition_idx").on(table.organizationId, table.editionId),
        foreignKey({
            name: "judge_assignments_edition_fk",
            columns: [table.editionId, table.organizationId],
            foreignColumns: [competitionEditions.id, competitionEditions.organizationId],
        }).onDelete("cascade"),
        foreignKey({
            name: "judge_assignments_rubric_fk",
            columns: [table.rubricId, table.organizationId],
            foreignColumns: [judgingRubrics.id, judgingRubrics.organizationId],
        }).onDelete("restrict"),
        foreignKey({
            name: "judge_assignments_submission_fk",
            columns: [table.submissionId, table.organizationId],
            foreignColumns: [submissions.id, submissions.organizationId],
        }).onDelete("cascade"),
    ],
);

export const evaluations = pgTable(
    "evaluations",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        organizationId: uuid("organization_id")
            .notNull()
            .references(() => organizations.id, { onDelete: "cascade" }),
        assignmentId: uuid("assignment_id").notNull(),
        judgeUserId: uuid("judge_user_id")
            .notNull()
            .references(() => users.id, { onDelete: "restrict" }),
        status: evaluationStatusEnum("status").notNull().default("draft"),
        overallComment: text("overall_comment").notNull().default(""),
        weightedScore: numeric("weighted_score", { precision: 7, scale: 2 }),
        submittedAt: timestamp("submitted_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        unique("evaluations_id_org_unique").on(table.id, table.organizationId),
        uniqueIndex("evaluations_assignment_unique").on(table.assignmentId),
        index("evaluations_org_judge_idx").on(table.organizationId, table.judgeUserId),
        index("evaluations_org_status_idx").on(table.organizationId, table.status),
        foreignKey({
            name: "evaluations_assignment_fk",
            columns: [table.assignmentId, table.organizationId],
            foreignColumns: [judgeAssignments.id, judgeAssignments.organizationId],
        }).onDelete("cascade"),
    ],
);

export const evaluationScores = pgTable(
    "evaluation_scores",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        organizationId: uuid("organization_id")
            .notNull()
            .references(() => organizations.id, { onDelete: "cascade" }),
        evaluationId: uuid("evaluation_id").notNull(),
        criterionId: uuid("criterion_id").notNull(),
        score: integer("score").notNull(),
        comment: text("comment").notNull().default(""),
    },
    (table) => [
        uniqueIndex("evaluation_scores_evaluation_criterion_unique").on(
            table.evaluationId,
            table.criterionId,
        ),
        index("evaluation_scores_org_idx").on(table.organizationId, table.evaluationId),
        foreignKey({
            name: "evaluation_scores_evaluation_fk",
            columns: [table.evaluationId, table.organizationId],
            foreignColumns: [evaluations.id, evaluations.organizationId],
        }).onDelete("cascade"),
        foreignKey({
            name: "evaluation_scores_criterion_fk",
            columns: [table.criterionId, table.organizationId],
            foreignColumns: [judgingCriteria.id, judgingCriteria.organizationId],
        }).onDelete("restrict"),
    ],
);

export type EvaluationVersionStatus = "draft" | "submitted";

export interface EvaluationVersionScore {
    readonly criterionId: string;
    readonly score: number;
    readonly comment: string;
}

export const evaluationVersions = pgTable(
    "evaluation_versions",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        organizationId: uuid("organization_id")
            .notNull()
            .references(() => organizations.id, { onDelete: "cascade" }),
        evaluationId: uuid("evaluation_id").notNull(),
        assignmentId: uuid("assignment_id").notNull(),
        judgeUserId: uuid("judge_user_id")
            .notNull()
            .references(() => users.id, { onDelete: "restrict" }),
        revision: integer("revision").notNull(),
        status: text("status").$type<EvaluationVersionStatus>().notNull(),
        overallComment: text("overall_comment").notNull().default(""),
        weightedScore: numeric("weighted_score", { precision: 7, scale: 2 }),
        rubricId: uuid("rubric_id"),
        rubricVersion: integer("rubric_version"),
        rubricSnapshot: jsonb("rubric_snapshot").$type<RubricSnapshot>(),
        scores: jsonb("scores").$type<readonly EvaluationVersionScore[]>().notNull(),
        submittedAt: timestamp("submitted_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        unique("evaluation_versions_evaluation_revision_unique").on(
            table.evaluationId,
            table.revision,
        ),
        unique("evaluation_versions_id_org_unique").on(table.id, table.organizationId),
        index("evaluation_versions_assignment_revision_idx").on(
            table.organizationId,
            table.assignmentId,
            table.revision.desc(),
        ),
        foreignKey({
            name: "evaluation_versions_evaluation_fk",
            columns: [table.evaluationId, table.organizationId],
            foreignColumns: [evaluations.id, evaluations.organizationId],
        }).onDelete("cascade"),
    ],
);

export const judgeFlagStatusEnum = pgEnum("judge_flag_status", ["open", "resolved"]);

export const judgeFlags = pgTable(
    "judge_flags",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        organizationId: uuid("organization_id")
            .notNull()
            .references(() => organizations.id, { onDelete: "cascade" }),
        editionId: uuid("edition_id").notNull(),
        assignmentId: uuid("assignment_id").notNull(),
        submissionId: uuid("submission_id").notNull(),
        reportedByUserId: uuid("reported_by_user_id")
            .notNull()
            .references(() => users.id, { onDelete: "restrict" }),
        reason: text("reason").notNull(),
        status: judgeFlagStatusEnum("status").notNull().default("open"),
        resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id, {
            onDelete: "set null",
        }),
        resolvedAt: timestamp("resolved_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        unique("judge_flags_id_org_unique").on(table.id, table.organizationId),
        uniqueIndex("judge_flags_assignment_judge_unique").on(
            table.assignmentId,
            table.reportedByUserId,
        ),
        index("judge_flags_edition_status_idx").on(
            table.organizationId,
            table.editionId,
            table.status,
        ),
        index("judge_flags_judge_idx").on(table.organizationId, table.reportedByUserId),
        foreignKey({
            name: "judge_flags_edition_fk",
            columns: [table.editionId, table.organizationId],
            foreignColumns: [competitionEditions.id, competitionEditions.organizationId],
        }).onDelete("cascade"),
        foreignKey({
            name: "judge_flags_assignment_fk",
            columns: [table.assignmentId, table.organizationId],
            foreignColumns: [judgeAssignments.id, judgeAssignments.organizationId],
        }).onDelete("cascade"),
        foreignKey({
            name: "judge_flags_submission_fk",
            columns: [table.submissionId, table.organizationId],
            foreignColumns: [submissions.id, submissions.organizationId],
        }).onDelete("cascade"),
    ],
);
