import { and, desc, eq, isNotNull, isNull, lt, or } from "drizzle-orm";
import type { AnnouncementVisibility } from "@nethack/contracts";
import type { DatabaseExecutor, DatabaseSession } from "../../../infrastructure/database/client.js";
import {
    announcements,
    organizations,
    users,
} from "../../../infrastructure/database/schema/index.js";

export interface AnnouncementRecord {
    readonly id: string;
    readonly organizationId: string;
    readonly editionId: string | null;
    readonly title: string;
    readonly bodyMarkdown: string;
    readonly visibility: AnnouncementVisibility;
    readonly publishedAt: Date | null;
    readonly authorUserId: string;
    readonly createdAt: Date;
    readonly updatedAt: Date;
}

export interface AnnouncementRow extends AnnouncementRecord {
    readonly authorDisplayName: string;
}

export interface PublicAnnouncementRow {
    readonly id: string;
    readonly title: string;
    readonly bodyMarkdown: string;
    readonly publishedAt: Date | null;
    readonly organizationName: string;
    readonly organizationSlug: string;
}

export class AnnouncementRepository {
    async insert(
        session: DatabaseSession,
        values: {
            organizationId: string;
            editionId: string | null;
            title: string;
            bodyMarkdown: string;
            visibility: AnnouncementVisibility;
            publishedAt: Date | null;
            authorUserId: string;
        },
    ): Promise<AnnouncementRecord> {
        const [row] = await session.db.insert(announcements).values(values).returning();
        if (row === undefined) {
            throw new Error("The announcement could not be created.");
        }
        return row;
    }

    async findById(db: DatabaseExecutor, announcementId: string): Promise<AnnouncementRow | null> {
        const rows = await db
            .select({
                id: announcements.id,
                organizationId: announcements.organizationId,
                editionId: announcements.editionId,
                title: announcements.title,
                bodyMarkdown: announcements.bodyMarkdown,
                visibility: announcements.visibility,
                publishedAt: announcements.publishedAt,
                authorUserId: announcements.authorUserId,
                authorDisplayName: users.displayName,
                createdAt: announcements.createdAt,
                updatedAt: announcements.updatedAt,
            })
            .from(announcements)
            .innerJoin(users, eq(users.id, announcements.authorUserId))
            .where(eq(announcements.id, announcementId))
            .limit(1);
        return rows[0] ?? null;
    }

    async listForOrganization(
        db: DatabaseExecutor,
        organizationId: string,
        options: {
            limit: number;
            before: { createdAt: Date; id: string } | null;
            includeDrafts: boolean;
        },
    ): Promise<readonly AnnouncementRow[]> {
        const conditions = [eq(announcements.organizationId, organizationId)];
        if (!options.includeDrafts) {
            conditions.push(isNotNull(announcements.publishedAt));
        }
        if (options.before !== null) {
            const cursorCondition = or(
                lt(announcements.createdAt, options.before.createdAt),
                and(
                    eq(announcements.createdAt, options.before.createdAt),
                    lt(announcements.id, options.before.id),
                ),
            );
            if (cursorCondition !== undefined) {
                conditions.push(cursorCondition);
            }
        }
        return db
            .select({
                id: announcements.id,
                organizationId: announcements.organizationId,
                editionId: announcements.editionId,
                title: announcements.title,
                bodyMarkdown: announcements.bodyMarkdown,
                visibility: announcements.visibility,
                publishedAt: announcements.publishedAt,
                authorUserId: announcements.authorUserId,
                authorDisplayName: users.displayName,
                createdAt: announcements.createdAt,
                updatedAt: announcements.updatedAt,
            })
            .from(announcements)
            .innerJoin(users, eq(users.id, announcements.authorUserId))
            .where(and(...conditions))
            .orderBy(desc(announcements.createdAt), desc(announcements.id))
            .limit(options.limit);
    }

    async listPublic(
        db: DatabaseExecutor,
        organizationId: string | null,
        options: { limit: number; before: { createdAt: Date; id: string } | null },
    ): Promise<readonly PublicAnnouncementRow[]> {
        const conditions = [
            eq(announcements.visibility, "public"),
            isNotNull(announcements.publishedAt),
        ];
        if (organizationId !== null) {
            conditions.push(eq(announcements.organizationId, organizationId));
        }
        if (options.before !== null) {
            const cursorCondition = or(
                lt(announcements.publishedAt, options.before.createdAt),
                and(
                    eq(announcements.publishedAt, options.before.createdAt),
                    lt(announcements.id, options.before.id),
                ),
            );
            if (cursorCondition !== undefined) {
                conditions.push(cursorCondition);
            }
        }
        return db
            .select({
                id: announcements.id,
                title: announcements.title,
                bodyMarkdown: announcements.bodyMarkdown,
                publishedAt: announcements.publishedAt,
                organizationName: organizations.name,
                organizationSlug: organizations.slug,
            })
            .from(announcements)
            .innerJoin(organizations, eq(organizations.id, announcements.organizationId))
            .where(and(...conditions))
            .orderBy(desc(announcements.publishedAt), desc(announcements.id))
            .limit(options.limit);
    }

    async listPublished(
        db: DatabaseExecutor,
        organizationId: string,
        options: { limit: number },
    ): Promise<readonly AnnouncementRow[]> {
        return db
            .select({
                id: announcements.id,
                organizationId: announcements.organizationId,
                editionId: announcements.editionId,
                title: announcements.title,
                bodyMarkdown: announcements.bodyMarkdown,
                visibility: announcements.visibility,
                publishedAt: announcements.publishedAt,
                authorUserId: announcements.authorUserId,
                authorDisplayName: users.displayName,
                createdAt: announcements.createdAt,
                updatedAt: announcements.updatedAt,
            })
            .from(announcements)
            .innerJoin(users, eq(users.id, announcements.authorUserId))
            .where(
                and(
                    eq(announcements.organizationId, organizationId),
                    isNotNull(announcements.publishedAt),
                ),
            )
            .orderBy(desc(announcements.publishedAt))
            .limit(options.limit);
    }

    async update(
        session: DatabaseSession,
        announcementId: string,
        values: {
            title?: string;
            bodyMarkdown?: string;
            visibility?: AnnouncementVisibility;
            updatedAt: Date;
        },
    ): Promise<boolean> {
        const rows = await session.db
            .update(announcements)
            .set(values)
            .where(eq(announcements.id, announcementId))
            .returning({ id: announcements.id });
        return rows.length > 0;
    }

    async publishIfUnpublished(
        session: DatabaseSession,
        announcementId: string,
        publishedAt: Date,
    ): Promise<boolean> {
        const rows = await session.db
            .update(announcements)
            .set({ publishedAt, updatedAt: publishedAt })
            .where(and(eq(announcements.id, announcementId), isNull(announcements.publishedAt)))
            .returning({ id: announcements.id });
        return rows.length > 0;
    }
}
