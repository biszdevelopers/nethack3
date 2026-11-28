import { and, asc, desc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { JudgeAssignmentStatus, OrganizationRole } from "@nethack/contracts";
import type { DatabaseExecutor, DatabaseSession } from "../../../infrastructure/database/client.js";
import {
    evaluations,
    evaluationScores,
    evaluationVersions,
    judgeAssignments,
    judgeFlags,
    judgingCriteria,
    judgingRubricTemplates,
    judgingRubrics,
    judgingScoreCurves,
    organizationMemberships,
    users,
} from "../../../infrastructure/database/schema/index.js";
import type {
    RubricCommentGuidance,
    RubricSnapshot,
    RubricTemplateDefinition,
    ScoreCurvePoint,
} from "../../../infrastructure/database/schema/judging.js";

const EVALUATION_HISTORY_LIMIT = 50;

export type RubricRow = typeof judgingRubrics.$inferSelect;
export type CriterionRow = typeof judgingCriteria.$inferSelect;
export type RubricTemplateRow = typeof judgingRubricTemplates.$inferSelect;
export type ScoreCurveRow = typeof judgingScoreCurves.$inferSelect;
export type AssignmentRow = typeof judgeAssignments.$inferSelect;
export type EvaluationRow = typeof evaluations.$inferSelect;
export type EvaluationScoreRow = typeof evaluationScores.$inferSelect;
export type EvaluationVersionRow = typeof evaluationVersions.$inferSelect;
export type JudgeFlagRow = typeof judgeFlags.$inferSelect;

export interface RubricWithCriteria {
    readonly rubric: RubricRow;
    readonly criteria: readonly CriterionRow[];
}

export interface AssignmentView {
    readonly assignment: AssignmentRow;
    readonly judgeDisplayName: string;
}

export interface JudgeCandidate {
    readonly userId: string;
    readonly displayName: string;
    readonly email: string;
    readonly role: OrganizationRole;
    readonly status: "active" | "suspended";
}

export interface EvaluationWithScores {
    readonly evaluation: EvaluationRow;
    readonly scores: readonly EvaluationScoreRow[];
}

export interface EditionEvaluationRow {
    readonly assignmentId: string;
    readonly submissionId: string;
    readonly judgeUserId: string;
    readonly judgeDisplayName: string;
    readonly assignmentStatus: JudgeAssignmentStatus;
    readonly evaluationStatus: "draft" | "submitted" | null;
    readonly weightedScore: number | null;
    readonly submittedAt: string | null;
}

export interface JudgeFlagView {
    readonly flag: JudgeFlagRow;
    readonly reportedByDisplayName: string;
    readonly resolvedByDisplayName: string | null;
}

export interface SubmittedEvaluationRow {
    readonly evaluationId: string;
    readonly assignmentId: string;
    readonly submissionId: string;
    readonly rubricName: string;
    readonly rubricVersion: number;
    readonly weightedScore: number | null;
    readonly overallComment: string;
    readonly submittedAt: Date;
    readonly scores: readonly {
        readonly criterionId: string;
        readonly criterionName: string;
        readonly minScore: number;
        readonly maxScore: number;
        readonly weight: number;
        readonly score: number;
        readonly comment: string;
    }[];
}

export interface NewFlagValues {
    readonly organizationId: string;
    readonly editionId: string;
    readonly assignmentId: string;
    readonly submissionId: string;
    readonly reportedByUserId: string;
    readonly reason: string;
    readonly status: "open";
}

export interface NewCriterionValues {
    readonly organizationId: string;
    readonly rubricId: string;
    readonly name: string;
    readonly description: string;
    readonly minScore: number;
    readonly maxScore: number;
    readonly weight: string;
    readonly position: number;
}

export interface NewRubricValues {
    readonly organizationId: string;
    readonly editionId: string;
    readonly divisionId: string | null;
    readonly familyId?: string;
    readonly version: number;
    readonly active: boolean;
    readonly name: string;
    readonly description: string;
    readonly commentGuidance: RubricCommentGuidance;
}

export interface NewRubricTemplateValues {
    readonly organizationId: string;
    readonly name: string;
    readonly description: string;
    readonly definition: RubricTemplateDefinition;
}

export interface NewAssignmentValues {
    readonly organizationId: string;
    readonly editionId: string;
    readonly rubricId: string;
    readonly submissionId: string;
    readonly judgeUserId: string;
    readonly status: JudgeAssignmentStatus;
    readonly assignmentNote: string;
    readonly dueAt: Date | null;
    readonly assignedByUserId: string | null;
}

export interface AssignmentUpdateValues {
    readonly updatedAt: Date;
    readonly status?: JudgeAssignmentStatus;
    readonly rubricId?: string;
    readonly conflictNote?: string | null;
    readonly assignmentNote?: string;
    readonly dueAt?: Date | null;
    readonly assignedByUserId?: string | null;
    readonly assignedAt?: Date;
}

export interface NewEvaluationValues {
    readonly organizationId: string;
    readonly assignmentId: string;
    readonly judgeUserId: string;
    readonly status: "draft" | "submitted";
    readonly overallComment: string;
    readonly weightedScore: string;
}

export interface EvaluationUpdateValues {
    readonly updatedAt: Date;
    readonly status?: "draft" | "submitted";
    readonly overallComment?: string;
    readonly weightedScore?: string | null;
    readonly submittedAt?: Date | null;
}

export interface NewScoreValues {
    readonly organizationId: string;
    readonly evaluationId: string;
    readonly criterionId: string;
    readonly score: number;
    readonly comment: string;
}

export interface NewEvaluationVersionValues {
    readonly organizationId: string;
    readonly evaluationId: string;
    readonly assignmentId: string;
    readonly judgeUserId: string;
    readonly revision: number;
    readonly status: EvaluationVersionRow["status"];
    readonly overallComment: string;
    readonly weightedScore: string | null;
    readonly rubricId: string | null;
    readonly rubricVersion: number | null;
    readonly rubricSnapshot: RubricSnapshot | null;
    readonly scores: EvaluationVersionRow["scores"];
    readonly submittedAt: Date | null;
}

export class JudgingRepository {
    async listRubrics(
        db: DatabaseExecutor,
        organizationId: string,
        editionId: string,
        includeInactive = false,
    ): Promise<readonly RubricWithCriteria[]> {
        const conditions = [
            eq(judgingRubrics.organizationId, organizationId),
            eq(judgingRubrics.editionId, editionId),
        ];
        if (!includeInactive) {
            conditions.push(eq(judgingRubrics.active, true));
        }
        const rubrics = await db
            .select()
            .from(judgingRubrics)
            .where(and(...conditions))
            .orderBy(
                asc(judgingRubrics.familyId),
                desc(judgingRubrics.version),
                asc(judgingRubrics.id),
            );
        if (rubrics.length === 0) {
            return [];
        }
        const criteria = await db
            .select()
            .from(judgingCriteria)
            .where(
                and(
                    eq(judgingCriteria.organizationId, organizationId),
                    inArray(
                        judgingCriteria.rubricId,
                        rubrics.map((rubric) => rubric.id),
                    ),
                ),
            )
            .orderBy(asc(judgingCriteria.position), asc(judgingCriteria.id));
        const byRubric = new Map<string, CriterionRow[]>();
        for (const criterion of criteria) {
            const list = byRubric.get(criterion.rubricId) ?? [];
            list.push(criterion);
            byRubric.set(criterion.rubricId, list);
        }
        return rubrics.map((rubric) => ({
            rubric,
            criteria: byRubric.get(rubric.id) ?? [],
        }));
    }

    async listEditionEvaluationRows(
        db: DatabaseExecutor,
        organizationId: string,
        editionId: string,
    ): Promise<readonly EditionEvaluationRow[]> {
        const rows = await db
            .select({
                assignmentId: judgeAssignments.id,
                submissionId: judgeAssignments.submissionId,
                judgeUserId: judgeAssignments.judgeUserId,
                judgeDisplayName: users.displayName,
                assignmentStatus: judgeAssignments.status,
                evaluationStatus: evaluations.status,
                weightedScore: evaluations.weightedScore,
                submittedAt: evaluations.submittedAt,
            })
            .from(judgeAssignments)
            .innerJoin(users, eq(users.id, judgeAssignments.judgeUserId))
            .leftJoin(
                evaluations,
                and(
                    eq(evaluations.assignmentId, judgeAssignments.id),
                    eq(evaluations.organizationId, organizationId),
                ),
            )
            .where(
                and(
                    eq(judgeAssignments.organizationId, organizationId),
                    eq(judgeAssignments.editionId, editionId),
                    ne(judgeAssignments.status, "revoked"),
                ),
            )
            .orderBy(asc(judgeAssignments.submissionId), asc(judgeAssignments.id));

        return rows.map((row) => ({
            assignmentId: row.assignmentId,
            submissionId: row.submissionId,
            judgeUserId: row.judgeUserId,
            judgeDisplayName: row.judgeDisplayName,
            assignmentStatus: row.assignmentStatus,
            evaluationStatus: row.evaluationStatus,
            weightedScore: row.weightedScore === null ? null : Number(row.weightedScore),
            submittedAt: row.submittedAt === null ? null : row.submittedAt.toISOString(),
        }));
    }

    async findRubric(
        db: DatabaseExecutor,
        organizationId: string,
        rubricId: string,
    ): Promise<RubricWithCriteria | null> {
        const rows = await db
            .select()
            .from(judgingRubrics)
            .where(
                and(
                    eq(judgingRubrics.organizationId, organizationId),
                    eq(judgingRubrics.id, rubricId),
                ),
            )
            .limit(1);
        const rubric = rows[0];
        if (rubric === undefined) {
            return null;
        }
        const criteria = await db
            .select()
            .from(judgingCriteria)
            .where(
                and(
                    eq(judgingCriteria.organizationId, organizationId),
                    eq(judgingCriteria.rubricId, rubric.id),
                ),
            )
            .orderBy(asc(judgingCriteria.position), asc(judgingCriteria.id));
        return { rubric, criteria };
    }

    async findRubricForUpdate(
        session: DatabaseSession,
        organizationId: string,
        rubricId: string,
    ): Promise<RubricWithCriteria | null> {
        const rows = await session.db
            .select()
            .from(judgingRubrics)
            .where(
                and(
                    eq(judgingRubrics.organizationId, organizationId),
                    eq(judgingRubrics.id, rubricId),
                ),
            )
            .limit(1)
            .for("update");
        const rubric = rows[0];
        if (rubric === undefined) {
            return null;
        }
        const criteria = await session.db
            .select()
            .from(judgingCriteria)
            .where(
                and(
                    eq(judgingCriteria.organizationId, organizationId),
                    eq(judgingCriteria.rubricId, rubric.id),
                ),
            )
            .orderBy(asc(judgingCriteria.position), asc(judgingCriteria.id));
        return { rubric, criteria };
    }

    async insertRubric(session: DatabaseSession, values: NewRubricValues): Promise<RubricRow> {
        const [row] = await session.db
            .insert(judgingRubrics)
            .values({
                organizationId: values.organizationId,
                editionId: values.editionId,
                divisionId: values.divisionId,
                version: values.version,
                active: values.active,
                name: values.name,
                description: values.description,
                commentGuidance: values.commentGuidance,
                ...(values.familyId === undefined ? {} : { familyId: values.familyId }),
            })
            .returning();
        if (row === undefined) {
            throw new Error("The judging rubric could not be created.");
        }
        return row;
    }

    async maxRubricVersion(
        db: DatabaseExecutor,
        organizationId: string,
        familyId: string,
    ): Promise<number | null> {
        const rows = await db
            .select({ version: sql<number | null>`max(${judgingRubrics.version})` })
            .from(judgingRubrics)
            .where(
                and(
                    eq(judgingRubrics.organizationId, organizationId),
                    eq(judgingRubrics.familyId, familyId),
                ),
            );
        const version = rows[0]?.version;
        return version === undefined || version === null ? null : Number(version);
    }

    async setRubricActive(
        session: DatabaseSession,
        organizationId: string,
        rubricId: string,
        active: boolean,
        updatedAt: Date,
    ): Promise<RubricRow | null> {
        const rows = await session.db
            .update(judgingRubrics)
            .set({ active, updatedAt })
            .where(
                and(
                    eq(judgingRubrics.organizationId, organizationId),
                    eq(judgingRubrics.id, rubricId),
                ),
            )
            .returning();
        return rows[0] ?? null;
    }

    async deactivateRubricFamily(
        session: DatabaseSession,
        organizationId: string,
        familyId: string,
        exceptRubricId: string,
        updatedAt: Date,
    ): Promise<void> {
        await session.db
            .update(judgingRubrics)
            .set({ active: false, updatedAt })
            .where(
                and(
                    eq(judgingRubrics.organizationId, organizationId),
                    eq(judgingRubrics.familyId, familyId),
                    ne(judgingRubrics.id, exceptRubricId),
                ),
            );
    }

    async listRubricTemplates(
        db: DatabaseExecutor,
        organizationId: string,
    ): Promise<readonly RubricTemplateRow[]> {
        return db
            .select()
            .from(judgingRubricTemplates)
            .where(eq(judgingRubricTemplates.organizationId, organizationId))
            .orderBy(asc(judgingRubricTemplates.name), asc(judgingRubricTemplates.id));
    }

    async findRubricTemplate(
        db: DatabaseExecutor,
        organizationId: string,
        templateId: string,
    ): Promise<RubricTemplateRow | null> {
        const rows = await db
            .select()
            .from(judgingRubricTemplates)
            .where(
                and(
                    eq(judgingRubricTemplates.organizationId, organizationId),
                    eq(judgingRubricTemplates.id, templateId),
                ),
            )
            .limit(1);
        return rows[0] ?? null;
    }

    async insertRubricTemplate(
        session: DatabaseSession,
        values: NewRubricTemplateValues,
    ): Promise<RubricTemplateRow> {
        const [row] = await session.db.insert(judgingRubricTemplates).values(values).returning();
        if (row === undefined) {
            throw new Error("The rubric template could not be created.");
        }
        return row;
    }

    async updateRubricTemplate(
        session: DatabaseSession,
        organizationId: string,
        templateId: string,
        values: {
            readonly name: string;
            readonly description: string;
            readonly definition: RubricTemplateDefinition;
            readonly updatedAt: Date;
        },
    ): Promise<RubricTemplateRow | null> {
        const rows = await session.db
            .update(judgingRubricTemplates)
            .set(values)
            .where(
                and(
                    eq(judgingRubricTemplates.organizationId, organizationId),
                    eq(judgingRubricTemplates.id, templateId),
                ),
            )
            .returning();
        return rows[0] ?? null;
    }

    async deleteRubricTemplate(
        session: DatabaseSession,
        organizationId: string,
        templateId: string,
    ): Promise<RubricTemplateRow | null> {
        const rows = await session.db
            .delete(judgingRubricTemplates)
            .where(
                and(
                    eq(judgingRubricTemplates.organizationId, organizationId),
                    eq(judgingRubricTemplates.id, templateId),
                ),
            )
            .returning();
        return rows[0] ?? null;
    }

    async findScoreCurve(
        db: DatabaseExecutor,
        organizationId: string,
        editionId: string,
    ): Promise<ScoreCurveRow | null> {
        const rows = await db
            .select()
            .from(judgingScoreCurves)
            .where(
                and(
                    eq(judgingScoreCurves.organizationId, organizationId),
                    eq(judgingScoreCurves.editionId, editionId),
                ),
            )
            .limit(1);
        return rows[0] ?? null;
    }

    async upsertScoreCurve(
        session: DatabaseSession,
        values: {
            readonly organizationId: string;
            readonly editionId: string;
            readonly points: readonly ScoreCurvePoint[];
            readonly updatedAt: Date;
        },
    ): Promise<ScoreCurveRow> {
        const [row] = await session.db
            .insert(judgingScoreCurves)
            .values({
                organizationId: values.organizationId,
                editionId: values.editionId,
                points: [...values.points],
                updatedAt: values.updatedAt,
            })
            .onConflictDoUpdate({
                target: [judgingScoreCurves.organizationId, judgingScoreCurves.editionId],
                set: { points: [...values.points], updatedAt: values.updatedAt },
            })
            .returning();
        if (row === undefined) {
            throw new Error("The score curve could not be saved.");
        }
        return row;
    }

    async insertCriteria(
        session: DatabaseSession,
        values: readonly NewCriterionValues[],
    ): Promise<readonly CriterionRow[]> {
        if (values.length === 0) {
            return [];
        }
        return session.db
            .insert(judgingCriteria)
            .values([...values])
            .returning();
    }

    async findJudgeCandidate(
        db: DatabaseExecutor,
        organizationId: string,
        email: string,
    ): Promise<JudgeCandidate | null> {
        // Users and memberships are read-only directory data here. Move this
        // lookup to an organizations/identity contract when one exposes it.
        const rows = await db
            .select({
                userId: users.id,
                displayName: users.displayName,
                email: users.email,
                role: organizationMemberships.role,
                status: organizationMemberships.status,
            })
            .from(users)
            .innerJoin(organizationMemberships, eq(organizationMemberships.userId, users.id))
            .where(
                and(
                    eq(organizationMemberships.organizationId, organizationId),
                    sql`lower(${users.email}) = ${email.toLowerCase()}`,
                ),
            )
            .limit(1);
        const row = rows[0];
        if (row === undefined || row.email === null) {
            return null;
        }
        return {
            userId: row.userId,
            displayName: row.displayName,
            email: row.email,
            role: row.role,
            status: row.status,
        };
    }

    async findAssignment(
        db: DatabaseExecutor,
        organizationId: string,
        assignmentId: string,
    ): Promise<AssignmentRow | null> {
        const rows = await db
            .select()
            .from(judgeAssignments)
            .where(
                and(
                    eq(judgeAssignments.organizationId, organizationId),
                    eq(judgeAssignments.id, assignmentId),
                ),
            )
            .limit(1);
        return rows[0] ?? null;
    }

    async findAssignmentForUpdate(
        session: DatabaseSession,
        organizationId: string,
        assignmentId: string,
    ): Promise<AssignmentRow | null> {
        const rows = await session.db
            .select()
            .from(judgeAssignments)
            .where(
                and(
                    eq(judgeAssignments.organizationId, organizationId),
                    eq(judgeAssignments.id, assignmentId),
                ),
            )
            .limit(1)
            .for("update");
        return rows[0] ?? null;
    }

    async findAssignmentView(
        db: DatabaseExecutor,
        organizationId: string,
        assignmentId: string,
    ): Promise<AssignmentView | null> {
        const rows = await db
            .select({ assignment: judgeAssignments, judgeDisplayName: users.displayName })
            .from(judgeAssignments)
            .innerJoin(users, eq(users.id, judgeAssignments.judgeUserId))
            .where(
                and(
                    eq(judgeAssignments.organizationId, organizationId),
                    eq(judgeAssignments.id, assignmentId),
                ),
            )
            .limit(1);
        return rows[0] ?? null;
    }

    async listAssignmentsForEdition(
        db: DatabaseExecutor,
        organizationId: string,
        editionId: string,
    ): Promise<readonly AssignmentView[]> {
        return db
            .select({ assignment: judgeAssignments, judgeDisplayName: users.displayName })
            .from(judgeAssignments)
            .innerJoin(users, eq(users.id, judgeAssignments.judgeUserId))
            .where(
                and(
                    eq(judgeAssignments.organizationId, organizationId),
                    eq(judgeAssignments.editionId, editionId),
                ),
            )
            .orderBy(desc(judgeAssignments.assignedAt), asc(judgeAssignments.id));
    }

    async listAssignmentsForJudge(
        db: DatabaseExecutor,
        organizationId: string,
        judgeUserId: string,
        status: JudgeAssignmentStatus | null,
    ): Promise<readonly AssignmentView[]> {
        const conditions = [
            eq(judgeAssignments.organizationId, organizationId),
            eq(judgeAssignments.judgeUserId, judgeUserId),
        ];
        if (status !== null) {
            conditions.push(eq(judgeAssignments.status, status));
        }
        return db
            .select({ assignment: judgeAssignments, judgeDisplayName: users.displayName })
            .from(judgeAssignments)
            .innerJoin(users, eq(users.id, judgeAssignments.judgeUserId))
            .where(and(...conditions))
            .orderBy(desc(judgeAssignments.assignedAt), asc(judgeAssignments.id));
    }

    async findAssignmentBySubmissionAndJudge(
        db: DatabaseExecutor,
        organizationId: string,
        submissionId: string,
        judgeUserId: string,
    ): Promise<AssignmentRow | null> {
        const rows = await db
            .select()
            .from(judgeAssignments)
            .where(
                and(
                    eq(judgeAssignments.organizationId, organizationId),
                    eq(judgeAssignments.submissionId, submissionId),
                    eq(judgeAssignments.judgeUserId, judgeUserId),
                ),
            )
            .limit(1);
        return rows[0] ?? null;
    }

    async insertAssignment(
        session: DatabaseSession,
        values: NewAssignmentValues,
    ): Promise<AssignmentRow> {
        const [row] = await session.db.insert(judgeAssignments).values(values).returning();
        if (row === undefined) {
            throw new Error("The judging assignment could not be created.");
        }
        return row;
    }

    async updateAssignment(
        session: DatabaseSession,
        organizationId: string,
        assignmentId: string,
        values: AssignmentUpdateValues,
    ): Promise<AssignmentRow | null> {
        const rows = await session.db
            .update(judgeAssignments)
            .set(values)
            .where(
                and(
                    eq(judgeAssignments.organizationId, organizationId),
                    eq(judgeAssignments.id, assignmentId),
                ),
            )
            .returning();
        return rows[0] ?? null;
    }

    async findEvaluation(
        db: DatabaseExecutor,
        organizationId: string,
        assignmentId: string,
    ): Promise<EvaluationRow | null> {
        const rows = await db
            .select()
            .from(evaluations)
            .where(
                and(
                    eq(evaluations.organizationId, organizationId),
                    eq(evaluations.assignmentId, assignmentId),
                ),
            )
            .limit(1);
        return rows[0] ?? null;
    }

    async findEvaluationWithScores(
        db: DatabaseExecutor,
        organizationId: string,
        assignmentId: string,
    ): Promise<EvaluationWithScores | null> {
        const evaluation = await this.findEvaluation(db, organizationId, assignmentId);
        if (evaluation === null) {
            return null;
        }
        const rows = await db
            .select({ score: evaluationScores })
            .from(evaluationScores)
            .innerJoin(judgingCriteria, eq(judgingCriteria.id, evaluationScores.criterionId))
            .where(
                and(
                    eq(evaluationScores.organizationId, organizationId),
                    eq(evaluationScores.evaluationId, evaluation.id),
                ),
            )
            .orderBy(asc(judgingCriteria.position), asc(judgingCriteria.id));
        return { evaluation, scores: rows.map((row) => row.score) };
    }

    async insertEvaluation(
        session: DatabaseSession,
        values: NewEvaluationValues,
    ): Promise<EvaluationRow> {
        const [row] = await session.db.insert(evaluations).values(values).returning();
        if (row === undefined) {
            throw new Error("The evaluation could not be created.");
        }
        return row;
    }

    async updateEvaluation(
        session: DatabaseSession,
        organizationId: string,
        evaluationId: string,
        values: EvaluationUpdateValues,
    ): Promise<EvaluationRow | null> {
        const rows = await session.db
            .update(evaluations)
            .set(values)
            .where(
                and(
                    eq(evaluations.organizationId, organizationId),
                    eq(evaluations.id, evaluationId),
                ),
            )
            .returning();
        return rows[0] ?? null;
    }

    async deleteScores(
        session: DatabaseSession,
        organizationId: string,
        evaluationId: string,
    ): Promise<void> {
        await session.db
            .delete(evaluationScores)
            .where(
                and(
                    eq(evaluationScores.organizationId, organizationId),
                    eq(evaluationScores.evaluationId, evaluationId),
                ),
            );
    }

    async insertScores(session: DatabaseSession, values: readonly NewScoreValues[]): Promise<void> {
        if (values.length === 0) {
            return;
        }
        await session.db.insert(evaluationScores).values([...values]);
    }

    async latestEvaluationRevision(
        db: DatabaseExecutor,
        organizationId: string,
        evaluationId: string,
    ): Promise<number | null> {
        const rows = await db
            .select({ revision: sql<number | null>`max(${evaluationVersions.revision})` })
            .from(evaluationVersions)
            .where(
                and(
                    eq(evaluationVersions.organizationId, organizationId),
                    eq(evaluationVersions.evaluationId, evaluationId),
                ),
            );
        const revision = rows[0]?.revision;
        return revision === undefined || revision === null ? null : Number(revision);
    }

    async insertEvaluationVersion(
        session: DatabaseSession,
        values: NewEvaluationVersionValues,
    ): Promise<EvaluationVersionRow> {
        const [row] = await session.db
            .insert(evaluationVersions)
            .values({ ...values, scores: [...values.scores] })
            .returning();
        if (row === undefined) {
            throw new Error("The evaluation version could not be created.");
        }
        return row;
    }

    async listEvaluationVersions(
        db: DatabaseExecutor,
        organizationId: string,
        assignmentId: string,
    ): Promise<readonly EvaluationVersionRow[]> {
        return db
            .select()
            .from(evaluationVersions)
            .where(
                and(
                    eq(evaluationVersions.organizationId, organizationId),
                    eq(evaluationVersions.assignmentId, assignmentId),
                ),
            )
            .orderBy(desc(evaluationVersions.revision))
            .limit(EVALUATION_HISTORY_LIMIT);
    }

    async countSubmittedEvaluations(
        db: DatabaseExecutor,
        organizationId: string,
        editionId: string,
    ): Promise<number> {
        const rows = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(evaluations)
            .innerJoin(judgeAssignments, eq(judgeAssignments.id, evaluations.assignmentId))
            .where(
                and(
                    eq(evaluations.organizationId, organizationId),
                    eq(judgeAssignments.organizationId, organizationId),
                    eq(judgeAssignments.editionId, editionId),
                    eq(evaluations.status, "submitted"),
                ),
            );
        return rows[0]?.count ?? 0;
    }

    async countOpenFlags(
        db: DatabaseExecutor,
        organizationId: string,
        editionId: string,
    ): Promise<number> {
        const rows = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(judgeFlags)
            .where(
                and(
                    eq(judgeFlags.organizationId, organizationId),
                    eq(judgeFlags.editionId, editionId),
                    eq(judgeFlags.status, "open"),
                ),
            );
        return rows[0]?.count ?? 0;
    }

    async findFlagByAssignmentAndJudge(
        db: DatabaseExecutor,
        organizationId: string,
        assignmentId: string,
        judgeUserId: string,
    ): Promise<JudgeFlagRow | null> {
        const rows = await db
            .select()
            .from(judgeFlags)
            .where(
                and(
                    eq(judgeFlags.organizationId, organizationId),
                    eq(judgeFlags.assignmentId, assignmentId),
                    eq(judgeFlags.reportedByUserId, judgeUserId),
                ),
            )
            .limit(1);
        return rows[0] ?? null;
    }

    async findFlagForUpdate(
        session: DatabaseSession,
        organizationId: string,
        flagId: string,
    ): Promise<JudgeFlagRow | null> {
        const rows = await session.db
            .select()
            .from(judgeFlags)
            .where(and(eq(judgeFlags.organizationId, organizationId), eq(judgeFlags.id, flagId)))
            .limit(1)
            .for("update");
        return rows[0] ?? null;
    }

    async findFlagViewById(
        db: DatabaseExecutor,
        organizationId: string,
        flagId: string,
    ): Promise<JudgeFlagView | null> {
        const reporter = alias(users, "flag_reporter");
        const resolver = alias(users, "flag_resolver");
        const rows = await db
            .select({
                flag: judgeFlags,
                reportedByDisplayName: reporter.displayName,
                resolvedByDisplayName: resolver.displayName,
            })
            .from(judgeFlags)
            .innerJoin(reporter, eq(reporter.id, judgeFlags.reportedByUserId))
            .leftJoin(resolver, eq(resolver.id, judgeFlags.resolvedByUserId))
            .where(and(eq(judgeFlags.organizationId, organizationId), eq(judgeFlags.id, flagId)))
            .limit(1);
        return rows[0] ?? null;
    }

    async listFlagsForEdition(
        db: DatabaseExecutor,
        organizationId: string,
        editionId: string,
    ): Promise<readonly JudgeFlagView[]> {
        const reporter = alias(users, "flag_reporter");
        const resolver = alias(users, "flag_resolver");
        return db
            .select({
                flag: judgeFlags,
                reportedByDisplayName: reporter.displayName,
                resolvedByDisplayName: resolver.displayName,
            })
            .from(judgeFlags)
            .innerJoin(reporter, eq(reporter.id, judgeFlags.reportedByUserId))
            .leftJoin(resolver, eq(resolver.id, judgeFlags.resolvedByUserId))
            .where(
                and(
                    eq(judgeFlags.organizationId, organizationId),
                    eq(judgeFlags.editionId, editionId),
                ),
            )
            .orderBy(asc(judgeFlags.status), desc(judgeFlags.createdAt));
    }

    async insertFlag(session: DatabaseSession, values: NewFlagValues): Promise<JudgeFlagRow> {
        const [row] = await session.db.insert(judgeFlags).values(values).returning();
        if (row === undefined) {
            throw new Error("The judging flag could not be created.");
        }
        return row;
    }

    async resolveFlag(
        session: DatabaseSession,
        organizationId: string,
        flagId: string,
        values: {
            readonly resolvedByUserId: string;
            readonly resolvedAt: Date;
        },
    ): Promise<JudgeFlagRow | null> {
        const rows = await session.db
            .update(judgeFlags)
            .set({ status: "resolved", ...values })
            .where(and(eq(judgeFlags.organizationId, organizationId), eq(judgeFlags.id, flagId)))
            .returning();
        return rows[0] ?? null;
    }

    async listSubmittedEvaluationRows(
        db: DatabaseExecutor,
        organizationId: string,
        judgeUserId: string,
        editionId: string,
    ): Promise<readonly SubmittedEvaluationRow[]> {
        const rows = await db
            .select({
                evaluationId: evaluations.id,
                assignmentId: judgeAssignments.id,
                submissionId: judgeAssignments.submissionId,
                rubricName: judgingRubrics.name,
                rubricVersion: judgingRubrics.version,
                weightedScore: evaluations.weightedScore,
                overallComment: evaluations.overallComment,
                submittedAt: evaluations.submittedAt,
            })
            .from(evaluations)
            .innerJoin(
                judgeAssignments,
                and(
                    eq(judgeAssignments.id, evaluations.assignmentId),
                    eq(judgeAssignments.organizationId, organizationId),
                ),
            )
            .innerJoin(
                judgingRubrics,
                and(
                    eq(judgingRubrics.id, judgeAssignments.rubricId),
                    eq(judgingRubrics.organizationId, organizationId),
                ),
            )
            .where(
                and(
                    eq(evaluations.organizationId, organizationId),
                    eq(evaluations.judgeUserId, judgeUserId),
                    eq(evaluations.status, "submitted"),
                    eq(judgeAssignments.editionId, editionId),
                    isNotNull(evaluations.submittedAt),
                ),
            )
            .orderBy(desc(evaluations.submittedAt), asc(judgeAssignments.id));
        if (rows.length === 0) {
            return [];
        }
        const evaluationIds = rows.map((row) => row.evaluationId);
        const scoreRows = await db
            .select({
                evaluationId: evaluationScores.evaluationId,
                criterionId: evaluationScores.criterionId,
                criterionName: judgingCriteria.name,
                minScore: judgingCriteria.minScore,
                maxScore: judgingCriteria.maxScore,
                weight: judgingCriteria.weight,
                score: evaluationScores.score,
                comment: evaluationScores.comment,
            })
            .from(evaluationScores)
            .innerJoin(
                judgingCriteria,
                and(
                    eq(judgingCriteria.id, evaluationScores.criterionId),
                    eq(judgingCriteria.organizationId, organizationId),
                ),
            )
            .where(
                and(
                    eq(evaluationScores.organizationId, organizationId),
                    inArray(evaluationScores.evaluationId, evaluationIds),
                ),
            )
            .orderBy(asc(judgingCriteria.position), asc(judgingCriteria.id));
        const scoresByEvaluation = new Map<
            string,
            {
                criterionId: string;
                criterionName: string;
                minScore: number;
                maxScore: number;
                weight: number;
                score: number;
                comment: string;
            }[]
        >();
        for (const score of scoreRows) {
            const list = scoresByEvaluation.get(score.evaluationId) ?? [];
            list.push({
                criterionId: score.criterionId,
                criterionName: score.criterionName,
                minScore: score.minScore,
                maxScore: score.maxScore,
                weight: Number(score.weight),
                score: score.score,
                comment: score.comment,
            });
            scoresByEvaluation.set(score.evaluationId, list);
        }
        const results: SubmittedEvaluationRow[] = [];
        for (const row of rows) {
            if (row.submittedAt === null) {
                continue;
            }
            results.push({
                evaluationId: row.evaluationId,
                assignmentId: row.assignmentId,
                submissionId: row.submissionId,
                rubricName: row.rubricName,
                rubricVersion: row.rubricVersion,
                weightedScore: row.weightedScore === null ? null : Number(row.weightedScore),
                overallComment: row.overallComment,
                submittedAt: row.submittedAt,
                scores: scoresByEvaluation.get(row.evaluationId) ?? [],
            });
        }
        return results;
    }
}
