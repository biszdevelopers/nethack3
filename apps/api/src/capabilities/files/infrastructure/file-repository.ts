import { and, desc, eq, isNotNull, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import type { DatabaseExecutor, DatabaseSession } from "../../../infrastructure/database/client.js";
import { submissionFiles } from "../../../infrastructure/database/schema/index.js";
import { buildFileSnapshot } from "../domain/file-snapshot.js";

export type FileRow = typeof submissionFiles.$inferSelect;

export interface AdministrationFileRow {
    readonly id: string;
    readonly organizationId: string;
    readonly projectId: string | null;
    readonly submissionId: string | null;
    readonly versionId: string | null;
    readonly fileName: string;
    readonly contentType: string;
    readonly byteSize: number;
    readonly checksumSha256: string;
    readonly status: FileRow["status"];
    readonly createdAt: Date;
}

const administrationFileColumns = {
    id: submissionFiles.id,
    organizationId: submissionFiles.organizationId,
    projectId: submissionFiles.projectId,
    submissionId: submissionFiles.submissionId,
    versionId: submissionFiles.versionId,
    fileName: submissionFiles.fileName,
    contentType: submissionFiles.contentType,
    byteSize: submissionFiles.byteSize,
    checksumSha256: submissionFiles.checksumSha256,
    status: submissionFiles.status,
    createdAt: submissionFiles.createdAt,
};

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
                    isNull(submissionFiles.submissionId),
                    isNull(submissionFiles.versionId),
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

    async findSnapshot(
        db: DatabaseExecutor,
        organizationId: string,
        submissionId: string,
        versionId: string,
        storageKey: string,
    ): Promise<boolean> {
        const rows = await db
            .select({ id: submissionFiles.id })
            .from(submissionFiles)
            .where(
                and(
                    eq(submissionFiles.organizationId, organizationId),
                    eq(submissionFiles.submissionId, submissionId),
                    eq(submissionFiles.versionId, versionId),
                    eq(submissionFiles.storageKey, storageKey),
                ),
            )
            .limit(1);
        return rows.length > 0;
    }

    async insertSnapshot(
        session: DatabaseSession,
        source: FileRow,
        submissionId: string,
        versionId: string,
    ): Promise<void> {
        await session.db.insert(submissionFiles).values(
            buildFileSnapshot(
                {
                    projectId: source.projectId,
                    storageKey: source.storageKey,
                    fileName: source.fileName,
                    contentType: source.contentType,
                    byteSize: source.byteSize,
                    checksumSha256: source.checksumSha256,
                    uploadedByUserId: source.uploadedByUserId,
                    inspectedAt: source.inspectedAt,
                },
                {
                    organizationId: source.organizationId,
                    submissionId,
                    versionId,
                },
            ),
        );
    }

    async countAdministrationFiles(
        db: DatabaseExecutor,
        organizationId: string,
        linkedOnly: boolean,
    ): Promise<number> {
        const conditions: SQL[] = [
            eq(submissionFiles.organizationId, organizationId),
            ne(submissionFiles.status, "deleted"),
        ];
        if (linkedOnly) {
            conditions.push(
                or(isNotNull(submissionFiles.submissionId), isNotNull(submissionFiles.versionId)) ??
                    sql`false`,
            );
        }
        const rows = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(submissionFiles)
            .where(and(...conditions));
        return rows[0]?.count ?? 0;
    }

    async listAdministrationFiles(
        db: DatabaseExecutor,
        organizationId: string,
        linkedOnly: boolean,
        limit: number,
        offset: number,
    ): Promise<readonly AdministrationFileRow[]> {
        const conditions: SQL[] = [
            eq(submissionFiles.organizationId, organizationId),
            ne(submissionFiles.status, "deleted"),
        ];
        if (linkedOnly) {
            conditions.push(
                or(isNotNull(submissionFiles.submissionId), isNotNull(submissionFiles.versionId)) ??
                    sql`false`,
            );
        }
        return db
            .select(administrationFileColumns)
            .from(submissionFiles)
            .where(and(...conditions))
            .orderBy(desc(submissionFiles.createdAt), desc(submissionFiles.id))
            .limit(limit)
            .offset(offset);
    }

    async countStorageReferences(
        db: DatabaseExecutor,
        organizationId: string,
        storageKey: string,
        excludingFileId: string,
    ): Promise<number> {
        const rows = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(submissionFiles)
            .where(
                and(
                    eq(submissionFiles.organizationId, organizationId),
                    eq(submissionFiles.storageKey, storageKey),
                    ne(submissionFiles.id, excludingFileId),
                    ne(submissionFiles.status, "deleted"),
                ),
            );
        return rows[0]?.count ?? 0;
    }
}
