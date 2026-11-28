import { and, desc, eq, inArray, lt, ne, or, sql, type SQL } from "drizzle-orm";
import type { SubmissionStatus } from "@nethack/contracts";
import type { DatabaseExecutor, DatabaseSession } from "../../../infrastructure/database/client.js";
import {
    submissionFiles,
    submissions,
    submissionVersions,
} from "../../../infrastructure/database/schema/index.js";

export type SubmissionRow = typeof submissions.$inferSelect;
export type SubmissionVersionRow = typeof submissionVersions.$inferSelect;
export type SubmissionFileRow = typeof submissionFiles.$inferSelect;

export interface SubmissionCursor {
    readonly createdAt: Date;
    readonly id: string;
}

export interface SubmissionListOptions {
    readonly organizationId: string;
    readonly editionId: string | null;
    readonly projectId: string | null;
    readonly cursor: SubmissionCursor | null;
    readonly limit: number | null;
}

export interface SubmissionWithVersionRow {
    readonly submission: SubmissionRow;
    readonly title: string | null;
    readonly summary: string | null;
}

export interface SubmissionUpdateValues {
    readonly status?: SubmissionStatus;
    readonly currentVersion?: number;
    readonly submittedAt?: Date | null;
    readonly reviewNote?: string;
    readonly reviewNoteUpdatedAt?: Date;
    readonly updatedAt: Date;
}

const SUBMITTED_STATUSES = [
    "submitted",
    "under_review",
    "changes_requested",
    "accepted",
    "rejected",
    "disqualified",
] as const;

export class SubmissionRepository {
    async insert(
        session: DatabaseSession,
        values: {
            organizationId: string;
            editionId: string;
            projectId: string;
            teamId: string | null;
            status: SubmissionStatus;
            createdAt: Date;
            updatedAt: Date;
        },
    ): Promise<SubmissionRow> {
        const [row] = await session.db.insert(submissions).values(values).returning();
        if (row === undefined) {
            throw new Error("The submission could not be created.");
        }
        return row;
    }

    async findById(
        db: DatabaseExecutor,
        organizationId: string,
        submissionId: string,
    ): Promise<SubmissionRow | null> {
        const rows = await db
            .select()
            .from(submissions)
            .where(
                and(
                    eq(submissions.organizationId, organizationId),
                    eq(submissions.id, submissionId),
                ),
            )
            .limit(1);
        return rows[0] ?? null;
    }

    async findByIdForUpdate(
        session: DatabaseSession,
        organizationId: string,
        submissionId: string,
    ): Promise<SubmissionRow | null> {
        const rows = await session.db
            .select()
            .from(submissions)
            .where(
                and(
                    eq(submissions.organizationId, organizationId),
                    eq(submissions.id, submissionId),
                ),
            )
            .limit(1)
            .for("update");
        return rows[0] ?? null;
    }

    async findByProjectId(
        db: DatabaseExecutor,
        organizationId: string,
        projectId: string,
    ): Promise<SubmissionRow | null> {
        const rows = await db
            .select()
            .from(submissions)
            .where(
                and(
                    eq(submissions.organizationId, organizationId),
                    eq(submissions.projectId, projectId),
                ),
            )
            .limit(1);
        return rows[0] ?? null;
    }

    async list(
        db: DatabaseExecutor,
        options: SubmissionListOptions,
    ): Promise<readonly SubmissionWithVersionRow[]> {
        const conditions: SQL[] = [eq(submissions.organizationId, options.organizationId)];
        if (options.editionId !== null) {
            conditions.push(eq(submissions.editionId, options.editionId));
        }
        if (options.projectId !== null) {
            conditions.push(eq(submissions.projectId, options.projectId));
        }
        if (options.cursor !== null) {
            conditions.push(
                or(
                    lt(submissions.createdAt, options.cursor.createdAt),
                    and(
                        eq(submissions.createdAt, options.cursor.createdAt),
                        lt(submissions.id, options.cursor.id),
                    ),
                ) ?? sql`false`,
            );
        }
        const query = db
            .select({
                submission: submissions,
                title: submissionVersions.title,
                summary: submissionVersions.summary,
            })
            .from(submissions)
            .leftJoin(
                submissionVersions,
                and(
                    eq(submissionVersions.submissionId, submissions.id),
                    eq(submissionVersions.organizationId, submissions.organizationId),
                    eq(submissionVersions.version, submissions.currentVersion),
                ),
            )
            .where(and(...conditions))
            .orderBy(desc(submissions.createdAt), desc(submissions.id));
        if (options.limit === null) {
            return query;
        }
        return query.limit(options.limit);
    }

    async hasSubmittedProject(
        db: DatabaseExecutor,
        organizationId: string,
        projectId: string,
    ): Promise<boolean> {
        const rows = await db
            .select({ id: submissions.id })
            .from(submissions)
            .where(
                and(
                    eq(submissions.organizationId, organizationId),
                    eq(submissions.projectId, projectId),
                    inArray(submissions.status, [...SUBMITTED_STATUSES]),
                ),
            )
            .limit(1);
        return rows.length > 0;
    }

    async countByEdition(
        db: DatabaseExecutor,
        organizationId: string,
        editionId: string,
    ): Promise<number> {
        const rows = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(submissions)
            .where(
                and(
                    eq(submissions.organizationId, organizationId),
                    eq(submissions.editionId, editionId),
                ),
            );
        return rows[0]?.count ?? 0;
    }

    async countTeamSubmissions(
        db: DatabaseExecutor,
        organizationId: string,
        editionId: string,
        teamId: string,
    ): Promise<number> {
        const rows = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(submissions)
            .where(
                and(
                    eq(submissions.organizationId, organizationId),
                    eq(submissions.editionId, editionId),
                    eq(submissions.teamId, teamId),
                ),
            );
        return rows[0]?.count ?? 0;
    }

    async update(
        session: DatabaseSession,
        organizationId: string,
        submissionId: string,
        values: SubmissionUpdateValues,
    ): Promise<SubmissionRow> {
        const [row] = await session.db
            .update(submissions)
            .set(values)
            .where(
                and(
                    eq(submissions.organizationId, organizationId),
                    eq(submissions.id, submissionId),
                ),
            )
            .returning();
        if (row === undefined) {
            throw new Error("The submission could not be updated.");
        }
        return row;
    }

    async insertVersion(
        session: DatabaseSession,
        values: {
            organizationId: string;
            submissionId: string;
            version: number;
            title: string;
            summary: string;
            descriptionMarkdown: string;
            repositoryUrl: string | null;
            demoUrl: string | null;
            createdByUserId: string;
            createdAt: Date;
        },
    ): Promise<SubmissionVersionRow> {
        const [row] = await session.db.insert(submissionVersions).values(values).returning();
        if (row === undefined) {
            throw new Error("The submission version could not be created.");
        }
        return row;
    }

    async findVersion(
        db: DatabaseExecutor,
        organizationId: string,
        submissionId: string,
        version: number,
    ): Promise<SubmissionVersionRow | null> {
        const rows = await db
            .select()
            .from(submissionVersions)
            .where(
                and(
                    eq(submissionVersions.organizationId, organizationId),
                    eq(submissionVersions.submissionId, submissionId),
                    eq(submissionVersions.version, version),
                ),
            )
            .limit(1);
        return rows[0] ?? null;
    }

    async listVersions(
        db: DatabaseExecutor,
        organizationId: string,
        submissionId: string,
    ): Promise<readonly SubmissionVersionRow[]> {
        return db
            .select()
            .from(submissionVersions)
            .where(
                and(
                    eq(submissionVersions.organizationId, organizationId),
                    eq(submissionVersions.submissionId, submissionId),
                ),
            )
            .orderBy(submissionVersions.version);
    }

    async listAttachedFiles(
        db: DatabaseExecutor,
        organizationId: string,
        submissionId: string,
    ): Promise<readonly SubmissionFileRow[]> {
        return db
            .select()
            .from(submissionFiles)
            .where(
                and(
                    eq(submissionFiles.organizationId, organizationId),
                    eq(submissionFiles.submissionId, submissionId),
                    ne(submissionFiles.status, "deleted"),
                ),
            )
            .orderBy(submissionFiles.createdAt, submissionFiles.id);
    }
}
