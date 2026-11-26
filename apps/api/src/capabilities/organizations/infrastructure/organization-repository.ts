import { and, desc, eq, lt, sql } from "drizzle-orm";
import type { OrganizationRole } from "@nethack/contracts";
import type { DatabaseExecutor, DatabaseSession } from "../../../infrastructure/database/client.js";
import {
    auditLogs,
    organizationInvitations,
    organizationMemberships,
    organizationSettings,
    organizations,
    users,
} from "../../../infrastructure/database/schema/index.js";

export interface OrganizationRow {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly description: string;
    readonly websiteUrl: string | null;
    readonly createdAt: Date;
    readonly updatedAt: Date;
}

export class OrganizationRepository {
    async insert(
        session: DatabaseSession,
        values: {
            id: string;
            name: string;
            slug: string;
            description: string;
            websiteUrl: string | null;
        },
    ): Promise<OrganizationRow> {
        const [row] = await session.db.insert(organizations).values(values).returning();
        if (row === undefined) {
            throw new Error("The organization could not be created.");
        }
        return row;
    }

    async insertSettings(session: DatabaseSession, organizationId: string): Promise<void> {
        await session.db.insert(organizationSettings).values({ organizationId });
    }

    async findById(db: DatabaseExecutor, organizationId: string): Promise<OrganizationRow | null> {
        const rows = await db
            .select()
            .from(organizations)
            .where(eq(organizations.id, organizationId))
            .limit(1);
        return rows[0] ?? null;
    }

    async findBySlug(db: DatabaseExecutor, slug: string): Promise<OrganizationRow | null> {
        const rows = await db
            .select()
            .from(organizations)
            .where(eq(organizations.slug, slug))
            .limit(1);
        return rows[0] ?? null;
    }

    async listForUser(
        db: DatabaseExecutor,
        userId: string,
    ): Promise<readonly (OrganizationRow & { role: OrganizationRole })[]> {
        const rows = await db
            .select({
                id: organizations.id,
                name: organizations.name,
                slug: organizations.slug,
                description: organizations.description,
                websiteUrl: organizations.websiteUrl,
                createdAt: organizations.createdAt,
                updatedAt: organizations.updatedAt,
                role: organizationMemberships.role,
            })
            .from(organizations)
            .innerJoin(
                organizationMemberships,
                eq(organizationMemberships.organizationId, organizations.id),
            )
            .where(eq(organizationMemberships.userId, userId))
            .orderBy(desc(organizations.createdAt));
        return rows;
    }

    async update(
        session: DatabaseSession,
        organizationId: string,
        values: {
            name?: string;
            description?: string;
            websiteUrl?: string | null;
            updatedAt: Date;
        },
    ): Promise<OrganizationRow> {
        const [row] = await session.db
            .update(organizations)
            .set(values)
            .where(eq(organizations.id, organizationId))
            .returning();
        if (row === undefined) {
            throw new Error("The organization could not be updated.");
        }
        return row;
    }

    async membership(
        db: DatabaseExecutor,
        organizationId: string,
        userId: string,
    ): Promise<{ role: OrganizationRole; status: "active" | "suspended" } | null> {
        const rows = await db
            .select({
                role: organizationMemberships.role,
                status: organizationMemberships.status,
            })
            .from(organizationMemberships)
            .where(
                and(
                    eq(organizationMemberships.organizationId, organizationId),
                    eq(organizationMemberships.userId, userId),
                ),
            )
            .limit(1);
        return rows[0] ?? null;
    }

    async listMembers(
        db: DatabaseExecutor,
        organizationId: string,
    ): Promise<
        readonly {
            organizationId: string;
            userId: string;
            role: OrganizationRole;
            status: "active" | "suspended";
            displayName: string;
            email: string | null;
            createdAt: Date;
        }[]
    > {
        return db
            .select({
                organizationId: organizationMemberships.organizationId,
                userId: organizationMemberships.userId,
                role: organizationMemberships.role,
                status: organizationMemberships.status,
                displayName: users.displayName,
                email: users.email,
                createdAt: organizationMemberships.createdAt,
            })
            .from(organizationMemberships)
            .innerJoin(users, eq(users.id, organizationMemberships.userId))
            .where(eq(organizationMemberships.organizationId, organizationId))
            .orderBy(organizationMemberships.createdAt);
    }

    async addMembership(
        session: DatabaseSession,
        values: { organizationId: string; userId: string; role: OrganizationRole },
    ): Promise<void> {
        await session.db.insert(organizationMemberships).values(values);
    }

    async updateMembership(
        session: DatabaseSession,
        organizationId: string,
        userId: string,
        values: { role?: OrganizationRole; status?: "active" | "suspended"; updatedAt: Date },
    ): Promise<boolean> {
        const rows = await session.db
            .update(organizationMemberships)
            .set(values)
            .where(
                and(
                    eq(organizationMemberships.organizationId, organizationId),
                    eq(organizationMemberships.userId, userId),
                ),
            )
            .returning({ id: organizationMemberships.id });
        return rows.length > 0;
    }

    async removeMembership(
        session: DatabaseSession,
        organizationId: string,
        userId: string,
    ): Promise<boolean> {
        const rows = await session.db
            .delete(organizationMemberships)
            .where(
                and(
                    eq(organizationMemberships.organizationId, organizationId),
                    eq(organizationMemberships.userId, userId),
                ),
            )
            .returning({ id: organizationMemberships.id });
        return rows.length > 0;
    }

    async countOwners(db: DatabaseExecutor, organizationId: string): Promise<number> {
        const rows = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(organizationMemberships)
            .where(
                and(
                    eq(organizationMemberships.organizationId, organizationId),
                    eq(organizationMemberships.role, "owner"),
                ),
            );
        return rows[0]?.count ?? 0;
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

    async createInvitation(
        session: DatabaseSession,
        values: {
            organizationId: string;
            email: string;
            role: OrganizationRole;
            tokenHash: string;
            invitedByUserId: string;
            expiresAt: Date;
        },
    ): Promise<{ id: string }> {
        const [row] = await session.db
            .insert(organizationInvitations)
            .values(values)
            .returning({ id: organizationInvitations.id });
        if (row === undefined) {
            throw new Error("The invitation could not be created.");
        }
        return row;
    }

    async findInvitationByTokenHash(
        db: DatabaseExecutor,
        tokenHash: string,
    ): Promise<{
        id: string;
        organizationId: string;
        email: string;
        role: OrganizationRole;
        status: string;
        expiresAt: Date;
    } | null> {
        const rows = await db
            .select({
                id: organizationInvitations.id,
                organizationId: organizationInvitations.organizationId,
                email: organizationInvitations.email,
                role: organizationInvitations.role,
                status: organizationInvitations.status,
                expiresAt: organizationInvitations.expiresAt,
            })
            .from(organizationInvitations)
            .where(eq(organizationInvitations.tokenHash, tokenHash))
            .limit(1);
        return rows[0] ?? null;
    }

    async markInvitationAccepted(
        session: DatabaseSession,
        invitationId: string,
        userId: string,
        acceptedAt: Date,
    ): Promise<void> {
        await session.db
            .update(organizationInvitations)
            .set({ status: "accepted", acceptedByUserId: userId, acceptedAt })
            .where(eq(organizationInvitations.id, invitationId));
    }

    async listInvitations(
        db: DatabaseExecutor,
        organizationId: string,
    ): Promise<
        readonly {
            id: string;
            organizationId: string;
            email: string;
            role: OrganizationRole;
            status: string;
            expiresAt: Date;
            createdAt: Date;
        }[]
    > {
        return db
            .select({
                id: organizationInvitations.id,
                organizationId: organizationInvitations.organizationId,
                email: organizationInvitations.email,
                role: organizationInvitations.role,
                status: organizationInvitations.status,
                expiresAt: organizationInvitations.expiresAt,
                createdAt: organizationInvitations.createdAt,
            })
            .from(organizationInvitations)
            .where(eq(organizationInvitations.organizationId, organizationId))
            .orderBy(desc(organizationInvitations.createdAt));
    }

    async settings(
        db: DatabaseExecutor,
        organizationId: string,
    ): Promise<{
        organizationId: string;
        registrationRequiresApproval: boolean;
        allowParticipantTeamCreation: boolean;
        publicShowcaseEnabled: boolean;
        updatedAt: Date;
    }> {
        const rows = await db
            .select()
            .from(organizationSettings)
            .where(eq(organizationSettings.organizationId, organizationId))
            .limit(1);
        const row = rows[0];
        if (row === undefined) {
            throw new Error("Organization settings are missing.");
        }
        return row;
    }

    async updateSettings(
        session: DatabaseSession,
        organizationId: string,
        values: {
            registrationRequiresApproval?: boolean;
            allowParticipantTeamCreation?: boolean;
            publicShowcaseEnabled?: boolean;
            updatedAt: Date;
        },
    ): Promise<void> {
        await session.db
            .update(organizationSettings)
            .set(values)
            .where(eq(organizationSettings.organizationId, organizationId));
    }

    async auditPage(
        db: DatabaseExecutor,
        organizationId: string,
        options: {
            limit: number;
            before: Date | null;
            action: string | null;
            entityType: string | null;
            actorUserId: string | null;
        },
    ): Promise<
        readonly {
            id: string;
            organizationId: string | null;
            actorUserId: string | null;
            actorDisplayName: string | null;
            action: string;
            entityType: string;
            entityId: string | null;
            metadata: Record<string, unknown>;
            createdAt: Date;
        }[]
    > {
        const conditions = [eq(auditLogs.organizationId, organizationId)];
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
}
