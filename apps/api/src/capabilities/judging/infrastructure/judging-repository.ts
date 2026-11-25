import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { JudgeAssignmentStatus, OrganizationRole } from "@nethack/contracts";
import type { DatabaseExecutor, DatabaseSession } from "../../../infrastructure/database/client.js";
import {
    evaluations,
    evaluationScores,
    judgeAssignments,
    judgingCriteria,
    judgingRubrics,
    organizationMemberships,
    users,
} from "../../../infrastructure/database/schema/index.js";

export type RubricRow = typeof judgingRubrics.$inferSelect;
export type CriterionRow = typeof judgingCriteria.$inferSelect;
export type AssignmentRow = typeof judgeAssignments.$inferSelect;
export type EvaluationRow = typeof evaluations.$inferSelect;
export type EvaluationScoreRow = typeof evaluationScores.$inferSelect;

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

export interface NewCriterionValues {
    readonly organizationId: string;
    readonly rubricId: string;
    readonly name: string;
    readonly description: string;
    readonly maxScore: number;
    readonly weight: string;
    readonly position: number;
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

export class JudgingRepository {
    async listRubrics(
        db: DatabaseExecutor,
        organizationId: string,
        editionId: string,
    ): Promise<readonly RubricWithCriteria[]> {
        const rubrics = await db
            .select()
            .from(judgingRubrics)
            .where(
                and(
                    eq(judgingRubrics.organizationId, organizationId),
                    eq(judgingRubrics.editionId, editionId),
                ),
            )
            .orderBy(desc(judgingRubrics.createdAt), asc(judgingRubrics.id));
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

    async insertRubric(
        session: DatabaseSession,
        values: {
            readonly organizationId: string;
            readonly editionId: string;
            readonly name: string;
            readonly description: string;
        },
    ): Promise<RubricRow> {
        const [row] = await session.db.insert(judgingRubrics).values(values).returning();
        if (row === undefined) {
            throw new Error("The judging rubric could not be created.");
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
}
