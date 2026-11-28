import { and, desc, eq, lt, sql, type SQL } from "drizzle-orm";
import type { DatabaseExecutor, DatabaseSession } from "../../../infrastructure/database/client.js";
import {
    auditLogs,
    globalAdministrators,
    organizations,
    users,
} from "../../../infrastructure/database/schema/index.js";

export interface GlobalAdministratorRow {
    readonly userId: string;
    readonly displayName: string;
    readonly email: string | null;
    readonly grantedAt: Date;
    readonly grantedByUserId: string | null;
}

export interface AuditRow {
    readonly id: string;
    readonly organizationId: string | null;
    readonly actorUserId: string | null;
    readonly actorDisplayName: string | null;
    readonly action: string;
    readonly entityType: string;
    readonly entityId: string | null;
    readonly metadata: Record<string, unknown>;
    readonly createdAt: Date;
}

export interface GlobalAuditOptions {
    readonly organizationId: string | null;
    readonly limit: number;
    readonly before: Date | null;
    readonly action: string | null;
    readonly entityType: string | null;
    readonly actorUserId: string | null;
}

const administratorColumns = {
    userId: globalAdministrators.userId,
    displayName: users.displayName,
    email: users.email,
    grantedAt: globalAdministrators.grantedAt,
    grantedByUserId: globalAdministrators.grantedByUserId,
};

export class AdministrationRepository {
    /**
     * Platform directory used by global administrator tools. Organization
     * business data is still reached through capability contracts.
     */
    async listOrganizationIds(db: DatabaseExecutor): Promise<readonly string[]> {
        const rows = await db
            .select({ id: organizations.id })
            .from(organizations)
            .orderBy(organizations.id);
        return rows.map((row) => row.id);
    }

    async listAdministrators(db: DatabaseExecutor): Promise<readonly GlobalAdministratorRow[]> {
        return db
            .select(administratorColumns)
            .from(globalAdministrators)
            .innerJoin(users, eq(users.id, globalAdministrators.userId))
            .orderBy(desc(globalAdministrators.grantedAt));
    }

    async findAdministrator(
        db: DatabaseExecutor,
        userId: string,
    ): Promise<GlobalAdministratorRow | null> {
        const rows = await db
            .select(administratorColumns)
            .from(globalAdministrators)
            .innerJoin(users, eq(users.id, globalAdministrators.userId))
            .where(eq(globalAdministrators.userId, userId))
            .limit(1);
        return rows[0] ?? null;
    }

    async findUserByEmail(
        db: DatabaseExecutor,
        email: string,
    ): Promise<{ id: string; displayName: string; email: string | null } | null> {
        const rows = await db
            .select({ id: users.id, displayName: users.displayName, email: users.email })
            .from(users)
            .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
            .limit(1);
        return rows[0] ?? null;
    }

    async insertGrant(
        session: DatabaseSession,
        values: {
            userId: string;
            grantedByUserId: string;
            reason: string;
            grantedAt: Date;
        },
    ): Promise<void> {
        await session.db.insert(globalAdministrators).values(values);
    }

    async deleteGrant(session: DatabaseSession, userId: string): Promise<boolean> {
        const rows = await session.db
            .delete(globalAdministrators)
            .where(eq(globalAdministrators.userId, userId))
            .returning({ userId: globalAdministrators.userId });
        return rows.length > 0;
    }

    // Row locks keep concurrent revocations from removing the last administrator together.
    async lockAdministratorCount(session: DatabaseSession): Promise<number> {
        const rows = await session.db
            .select({ userId: globalAdministrators.userId })
            .from(globalAdministrators)
            .for("update");
        return rows.length;
    }

    async auditPage(
        db: DatabaseExecutor,
        options: {
            organizationId: string;
            limit: number;
            before: Date | null;
            action: string | null;
            entityType: string | null;
            actorUserId: string | null;
        },
    ): Promise<readonly AuditRow[]> {
        const conditions = [eq(auditLogs.organizationId, options.organizationId)];
        if (options.before !== null) {
            conditions.push(lt(auditLogs.createdAt, options.before));
        }
        if (options.action !== null) {
            conditions.push(eq(auditLogs.action, options.action));
        }
        if (options.entityType !== null) {
            conditions.push(eq(auditLogs.entityType, options.entityType));
        }
        if (options.actorUserId !== null) {
            conditions.push(eq(auditLogs.actorUserId, options.actorUserId));
        }
        return db
            .select({
                id: auditLogs.id,
                organizationId: auditLogs.organizationId,
                actorUserId: auditLogs.actorUserId,
                actorDisplayName: users.displayName,
                action: auditLogs.action,
                entityType: auditLogs.entityType,
                entityId: auditLogs.entityId,
                metadata: auditLogs.metadata,
                createdAt: auditLogs.createdAt,
            })
            .from(auditLogs)
            .leftJoin(users, eq(users.id, auditLogs.actorUserId))
            .where(and(...conditions))
            .orderBy(desc(auditLogs.createdAt))
            .limit(options.limit);
    }

    async globalAuditPage(
        db: DatabaseExecutor,
        options: GlobalAuditOptions,
    ): Promise<readonly AuditRow[]> {
        const conditions: SQL[] = [];
        if (options.organizationId !== null) {
            conditions.push(eq(auditLogs.organizationId, options.organizationId));
        }
        if (options.before !== null) {
            conditions.push(lt(auditLogs.createdAt, options.before));
        }
        if (options.action !== null) {
            conditions.push(eq(auditLogs.action, options.action));
        }
        if (options.entityType !== null) {
            conditions.push(eq(auditLogs.entityType, options.entityType));
        }
        if (options.actorUserId !== null) {
            conditions.push(eq(auditLogs.actorUserId, options.actorUserId));
        }
        return db
            .select({
                id: auditLogs.id,
                organizationId: auditLogs.organizationId,
                actorUserId: auditLogs.actorUserId,
                actorDisplayName: users.displayName,
                action: auditLogs.action,
                entityType: auditLogs.entityType,
                entityId: auditLogs.entityId,
                metadata: auditLogs.metadata,
                createdAt: auditLogs.createdAt,
            })
            .from(auditLogs)
            .leftJoin(users, eq(users.id, auditLogs.actorUserId))
            .where(conditions.length === 0 ? undefined : and(...conditions))
            .orderBy(desc(auditLogs.createdAt))
            .limit(options.limit);
    }
}
