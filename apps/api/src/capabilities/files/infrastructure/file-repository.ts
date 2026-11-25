import { and, desc, eq } from "drizzle-orm";
import type { DatabaseExecutor, DatabaseSession } from "../../../infrastructure/database/client.js";
import { submissionFiles } from "../../../infrastructure/database/schema/index.js";

export type FileRow = typeof submissionFiles.$inferSelect;

export class FileRepository {
    async insert(
        session: DatabaseSession,
        values: {
            organizationId: string;
            projectId: string | null;
            fileName: string;
            contentType: string;
            byteSize: number;
            checksumSha256: string;
            storageKey: string;
            uploadedByUserId: string;
            createdAt: Date;
            inspectedAt: Date;
        },
    ): Promise<FileRow> {
        const [row] = await session.db
            .insert(submissionFiles)
            .values({ ...values, status: "approved" })
            .returning();
        if (row === undefined) {
            throw new Error("The file could not be recorded.");
        }
        return row;
    }

    async findById(
        db: DatabaseExecutor,
        organizationId: string,
        fileId: string,
    ): Promise<FileRow | null> {
        const rows = await db
            .select()
            .from(submissionFiles)
            .where(
                and(
                    eq(submissionFiles.organizationId, organizationId),
                    eq(submissionFiles.id, fileId),
                ),
            )
            .limit(1);
        return rows[0] ?? null;
    }

    async findApprovedPublic(db: DatabaseExecutor, fileId: string): Promise<FileRow | null> {
        const rows = await db
            .select()
            .from(submissionFiles)
            .where(and(eq(submissionFiles.id, fileId), eq(submissionFiles.status, "approved")))
            .limit(1);
        return rows[0] ?? null;
    }

    async listApproved(
        db: DatabaseExecutor,
        organizationId: string,
        projectId: string,
    ): Promise<readonly FileRow[]> {
        return db
            .select()
            .from(submissionFiles)
            .where(
                and(
                    eq(submissionFiles.organizationId, organizationId),
                    eq(submissionFiles.projectId, projectId),
                    eq(submissionFiles.status, "approved"),
                ),
            )
            .orderBy(desc(submissionFiles.createdAt), desc(submissionFiles.id));
    }

    async markDeleted(
        session: DatabaseSession,
        organizationId: string,
        fileId: string,
        deletedAt: Date,
    ): Promise<boolean> {
        const rows = await session.db
            .update(submissionFiles)
            .set({ status: "deleted", deletedAt })
            .where(
                and(
                    eq(submissionFiles.organizationId, organizationId),
                    eq(submissionFiles.id, fileId),
                ),
            )
            .returning({ id: submissionFiles.id });
        return rows.length > 0;
    }

    async attachToSubmission(
        session: DatabaseSession,
        organizationId: string,
        fileId: string,
        submissionId: string,
        versionId: string,
    ): Promise<boolean> {
        const rows = await session.db
            .update(submissionFiles)
            .set({ submissionId, versionId })
            .where(
                and(
                    eq(submissionFiles.organizationId, organizationId),
                    eq(submissionFiles.id, fileId),
                    eq(submissionFiles.status, "approved"),
                ),
            )
            .returning({ id: submissionFiles.id });
        return rows.length > 0;
    }
}
