import { and, desc, eq, gt, isNull, lt, sql, type SQL } from "drizzle-orm";
import type { TeamRole, TeamStatus } from "@nethack/contracts";
import type { DatabaseExecutor, DatabaseSession } from "../../../infrastructure/database/client.js";
import {
    auditLogs,
    competitionEditions,
    registrations,
    teamInvitations,
    teamMembers,
    teams,
    users,
} from "../../../infrastructure/database/schema/index.js";

export interface TeamRow {
    readonly id: string;
    readonly organizationId: string;
    readonly editionId: string;
    readonly divisionId: string | null;
    readonly name: string;
    readonly description: string;
    readonly status: TeamStatus;
    readonly statusReason: string;
    readonly captainUserId: string;
    readonly maxMembers: number;
    readonly createdAt: Date;
    readonly updatedAt: Date;
}

export interface TeamWithMemberCount extends TeamRow {
    readonly memberCount: number;
}

export interface TeamMemberRow {
    readonly userId: string;
    readonly displayName: string;
    readonly avatarUrl: string | null;
    readonly role: TeamRole;
    readonly joinedAt: Date;
}

export interface EditionTeamMemberRow extends TeamMemberRow {
    readonly teamId: string;
}

export interface UserTeamHistoryRow {
    readonly teamId: string;
    readonly teamName: string;
    readonly editionId: string;
    readonly editionName: string;
    readonly editionSlug: string;
    readonly joinedAt: Date;
    readonly leftAt: Date | null;
}

export interface TeamInvitationRow {
    readonly id: string;
    readonly teamId: string;
    readonly email: string;
    readonly status: string;
    readonly expiresAt: Date;
    readonly createdAt: Date;
}

export interface InvitationWithTeam extends TeamInvitationRow {
    readonly organizationId: string;
    readonly invitedByUserId: string;
    readonly teamName: string;
    readonly editionId: string;
    readonly captainUserId: string;
    readonly teamStatus: TeamStatus;
    readonly maxMembers: number;
}

export interface MyInvitationRow {
    readonly id: string;
    readonly teamId: string;
    readonly teamName: string;
    readonly editionId: string;
    readonly divisionId: string | null;
    readonly inviterDisplayName: string;
    readonly status: string;
    readonly expiresAt: Date;
    readonly createdAt: Date;
}

export interface TeamAuditRow {
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

const memberCountColumn = sql<number>`(
    select count(*)::int from ${teamMembers}
    where ${teamMembers.teamId} = ${teams.id} and ${teamMembers.leftAt} is null
)`;

const invitationSelection = {
    id: teamInvitations.id,
    teamId: teamInvitations.teamId,
    organizationId: teamInvitations.organizationId,
    email: teamInvitations.email,
    status: teamInvitations.status,
    expiresAt: teamInvitations.expiresAt,
    createdAt: teamInvitations.createdAt,
    invitedByUserId: teamInvitations.invitedByUserId,
    teamName: teams.name,
    editionId: teams.editionId,
    captainUserId: teams.captainUserId,
    teamStatus: teams.status,
    maxMembers: teams.maxMembers,
} as const;

export class TeamRepository {
    async findById(
        db: DatabaseExecutor,
        organizationId: string,
        teamId: string,
    ): Promise<TeamRow | null> {
        const rows = await db
            .select()
            .from(teams)
            .where(and(eq(teams.organizationId, organizationId), eq(teams.id, teamId)))
            .limit(1);
        return rows[0] ?? null;
    }

    async findByIdForUpdate(
        session: DatabaseSession,
        organizationId: string,
        teamId: string,
    ): Promise<TeamRow | null> {
        const rows = await session.db
            .select()
            .from(teams)
            .where(and(eq(teams.organizationId, organizationId), eq(teams.id, teamId)))
            .limit(1)
            .for("update");
        return rows[0] ?? null;
    }

    async findByUserInEdition(
        db: DatabaseExecutor,
        organizationId: string,
        editionId: string,
        userId: string,
    ): Promise<TeamRow | null> {
        const rows = await db
            .select({ team: teams })
            .from(teams)
            .innerJoin(
                teamMembers,
                and(
                    eq(teamMembers.teamId, teams.id),
                    eq(teamMembers.organizationId, teams.organizationId),
                ),
            )
            .where(
                and(
                    eq(teams.organizationId, organizationId),
                    eq(teams.editionId, editionId),
                    eq(teamMembers.userId, userId),
                    isNull(teamMembers.leftAt),
                ),
            )
            .limit(1);
        return rows[0]?.team ?? null;
    }

    async listByEdition(
        db: DatabaseExecutor,
        organizationId: string,
        editionId: string,
    ): Promise<readonly TeamWithMemberCount[]> {
        return db
            .select({ team: teams, memberCount: memberCountColumn })
            .from(teams)
            .where(and(eq(teams.organizationId, organizationId), eq(teams.editionId, editionId)))
            .orderBy(teams.name)
            .then((rows) => rows.map((row) => ({ ...row.team, memberCount: row.memberCount })));
    }

    async listForUser(
        db: DatabaseExecutor,
        organizationId: string,
        userId: string,
    ): Promise<readonly TeamWithMemberCount[]> {
        const rows = await db
            .select({ team: teams, memberCount: memberCountColumn })
            .from(teams)
            .innerJoin(
                teamMembers,
                and(
                    eq(teamMembers.teamId, teams.id),
                    eq(teamMembers.organizationId, teams.organizationId),
                ),
            )
            .where(
                and(
                    eq(teams.organizationId, organizationId),
                    eq(teamMembers.userId, userId),
                    isNull(teamMembers.leftAt),
                ),
            )
            .orderBy(desc(teams.createdAt));
        return rows.map((row) => ({ ...row.team, memberCount: row.memberCount }));
    }

    async listUserTeamHistory(
        db: DatabaseExecutor,
        organizationId: string,
        userId: string,
    ): Promise<readonly UserTeamHistoryRow[]> {
        return db
            .select({
                teamId: teams.id,
                teamName: teams.name,
                editionId: teams.editionId,
                editionName: competitionEditions.name,
                editionSlug: competitionEditions.slug,
                joinedAt: teamMembers.joinedAt,
                leftAt: teamMembers.leftAt,
            })
            .from(teamMembers)
            .innerJoin(
                teams,
                and(
                    eq(teams.id, teamMembers.teamId),
                    eq(teams.organizationId, teamMembers.organizationId),
                ),
            )
            .innerJoin(
                competitionEditions,
                and(
                    eq(competitionEditions.id, teams.editionId),
                    eq(competitionEditions.organizationId, teams.organizationId),
                ),
            )
            .where(and(eq(teams.organizationId, organizationId), eq(teamMembers.userId, userId)))
            .orderBy(desc(teamMembers.joinedAt));
    }

    async countByEdition(
        db: DatabaseExecutor,
        organizationId: string,
        editionId: string,
    ): Promise<number> {
        const rows = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(teams)
            .where(and(eq(teams.organizationId, organizationId), eq(teams.editionId, editionId)));
        return rows[0]?.count ?? 0;
    }

    async countMembers(db: DatabaseExecutor, teamId: string): Promise<number> {
        const rows = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(teamMembers)
            .where(and(eq(teamMembers.teamId, teamId), isNull(teamMembers.leftAt)));
        return rows[0]?.count ?? 0;
    }

    async members(db: DatabaseExecutor, teamId: string): Promise<readonly TeamMemberRow[]> {
        return db
            .select({
                userId: teamMembers.userId,
                displayName: users.displayName,
                avatarUrl: users.avatarUrl,
                role: teamMembers.role,
                joinedAt: teamMembers.joinedAt,
            })
            .from(teamMembers)
            .innerJoin(users, eq(users.id, teamMembers.userId))
            .where(and(eq(teamMembers.teamId, teamId), isNull(teamMembers.leftAt)))
            .orderBy(
                sql`case when ${teamMembers.role} = 'captain' then 0 else 1 end`,
                teamMembers.joinedAt,
            );
    }

    async membersForEdition(
        db: DatabaseExecutor,
        organizationId: string,
        editionId: string,
    ): Promise<readonly EditionTeamMemberRow[]> {
        return db
            .select({
                teamId: teamMembers.teamId,
                userId: teamMembers.userId,
                displayName: users.displayName,
                avatarUrl: users.avatarUrl,
                role: teamMembers.role,
                joinedAt: teamMembers.joinedAt,
            })
            .from(teamMembers)
            .innerJoin(users, eq(users.id, teamMembers.userId))
            .innerJoin(
                teams,
                and(
                    eq(teams.id, teamMembers.teamId),
                    eq(teams.organizationId, teamMembers.organizationId),
                ),
            )
            .where(
                and(
                    eq(teams.organizationId, organizationId),
                    eq(teams.editionId, editionId),
                    isNull(teamMembers.leftAt),
                ),
            )
            .orderBy(
                sql`case when ${teamMembers.role} = 'captain' then 0 else 1 end`,
                teamMembers.joinedAt,
            );
    }

    async findMember(
        db: DatabaseExecutor,
        teamId: string,
        userId: string,
    ): Promise<TeamMemberRow | null> {
        const rows = await db
            .select({
                userId: teamMembers.userId,
                displayName: users.displayName,
                avatarUrl: users.avatarUrl,
                role: teamMembers.role,
                joinedAt: teamMembers.joinedAt,
            })
            .from(teamMembers)
            .innerJoin(users, eq(users.id, teamMembers.userId))
            .where(
                and(
                    eq(teamMembers.teamId, teamId),
                    eq(teamMembers.userId, userId),
                    isNull(teamMembers.leftAt),
                ),
            )
            .limit(1);
        return rows[0] ?? null;
    }

    async insert(
        session: DatabaseSession,
        values: {
            id: string;
            organizationId: string;
            editionId: string;
            divisionId: string | null;
            name: string;
            description: string;
            captainUserId: string;
            maxMembers: number;
        },
    ): Promise<TeamRow> {
        const [row] = await session.db.insert(teams).values(values).returning();
        if (row === undefined) {
            throw new Error("The team could not be created.");
        }
        return row;
    }

    async update(
        session: DatabaseSession,
        teamId: string,
        values: {
            name?: string;
            description?: string;
            status?: TeamStatus;
            statusReason?: string;
            divisionId?: string | null;
            captainUserId?: string;
            maxMembers?: number;
            updatedAt: Date;
        },
    ): Promise<TeamRow> {
        const [row] = await session.db
            .update(teams)
            .set(values)
            .where(eq(teams.id, teamId))
            .returning();
        if (row === undefined) {
            throw new Error("The team could not be updated.");
        }
        return row;
    }

    async delete(
        session: DatabaseSession,
        organizationId: string,
        editionId: string,
        teamId: string,
    ): Promise<boolean> {
        const rows = await session.db
            .delete(teams)
            .where(
                and(
                    eq(teams.organizationId, organizationId),
                    eq(teams.editionId, editionId),
                    eq(teams.id, teamId),
                ),
            )
            .returning({ id: teams.id });
        return rows.length > 0;
    }

    async insertMember(
        session: DatabaseSession,
        values: {
            organizationId: string;
            teamId: string;
            userId: string;
            role: TeamRole;
        },
    ): Promise<void> {
        await session.db.insert(teamMembers).values(values);
    }

    async updateMemberRole(
        session: DatabaseSession,
        teamId: string,
        userId: string,
        role: TeamRole,
    ): Promise<boolean> {
        const rows = await session.db
            .update(teamMembers)
            .set({ role })
            .where(
                and(
                    eq(teamMembers.teamId, teamId),
                    eq(teamMembers.userId, userId),
                    isNull(teamMembers.leftAt),
                ),
            )
            .returning({ id: teamMembers.id });
        return rows.length > 0;
    }

    async removeMember(
        session: DatabaseSession,
        teamId: string,
        userId: string,
        at: Date,
    ): Promise<boolean> {
        const rows = await session.db
            .update(teamMembers)
            .set({ leftAt: at })
            .where(
                and(
                    eq(teamMembers.teamId, teamId),
                    eq(teamMembers.userId, userId),
                    isNull(teamMembers.leftAt),
                ),
            )
            .returning({ id: teamMembers.id });
        return rows.length > 0;
    }

    async deleteAllMembers(
        session: DatabaseSession,
        teamId: string,
        at: Date,
    ): Promise<readonly string[]> {
        const rows = await session.db
            .update(teamMembers)
            .set({ leftAt: at })
            .where(and(eq(teamMembers.teamId, teamId), isNull(teamMembers.leftAt)))
            .returning({ userId: teamMembers.userId });
        return rows.map((row) => row.userId);
    }

    /** Locks the participant's registration row so concurrent team joins serialize. */
    async lockRegistration(
        session: DatabaseSession,
        organizationId: string,
        editionId: string,
        userId: string,
    ): Promise<boolean> {
        const rows = await session.db
            .select({ id: registrations.id })
            .from(registrations)
            .where(
                and(
                    eq(registrations.organizationId, organizationId),
                    eq(registrations.editionId, editionId),
                    eq(registrations.userId, userId),
                ),
            )
            .limit(1)
            .for("update");
        return rows.length > 0;
    }

    async userByEmail(
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

    async findInvitationByTeamAndEmail(
        db: DatabaseExecutor,
        teamId: string,
        email: string,
    ): Promise<TeamInvitationRow | null> {
        const rows = await db
            .select({
                id: teamInvitations.id,
                teamId: teamInvitations.teamId,
                email: teamInvitations.email,
                status: teamInvitations.status,
                expiresAt: teamInvitations.expiresAt,
                createdAt: teamInvitations.createdAt,
            })
            .from(teamInvitations)
            .where(
                and(
                    eq(teamInvitations.teamId, teamId),
                    sql`lower(${teamInvitations.email}) = ${email.toLowerCase()}`,
                ),
            )
            .limit(1);
        return rows[0] ?? null;
    }

    async insertInvitation(
        session: DatabaseSession,
        values: {
            organizationId: string;
            teamId: string;
            email: string;
            tokenHash: string;
            invitedByUserId: string;
            expiresAt: Date;
        },
    ): Promise<{ id: string; createdAt: Date }> {
        const [row] = await session.db
            .insert(teamInvitations)
            .values(values)
            .returning({ id: teamInvitations.id, createdAt: teamInvitations.createdAt });
        if (row === undefined) {
            throw new Error("The invitation could not be created.");
        }
        return row;
    }

    async reissueInvitation(
        session: DatabaseSession,
        invitationId: string,
        values: {
            tokenHash: string;
            invitedByUserId: string;
            expiresAt: Date;
        },
    ): Promise<{ id: string; createdAt: Date }> {
        const [row] = await session.db
            .update(teamInvitations)
            .set({
                tokenHash: values.tokenHash,
                invitedByUserId: values.invitedByUserId,
                expiresAt: values.expiresAt,
                status: "pending",
                acceptedByUserId: null,
                acceptedAt: null,
            })
            .where(eq(teamInvitations.id, invitationId))
            .returning({ id: teamInvitations.id, createdAt: teamInvitations.createdAt });
        if (row === undefined) {
            throw new Error("The invitation could not be reissued.");
        }
        return row;
    }

    async countPendingInvitations(
        db: DatabaseExecutor,
        teamId: string,
        now: Date,
    ): Promise<number> {
        const rows = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(teamInvitations)
            .where(
                and(
                    eq(teamInvitations.teamId, teamId),
                    eq(teamInvitations.status, "pending"),
                    gt(teamInvitations.expiresAt, now),
                ),
            );
        return rows[0]?.count ?? 0;
    }

    async listPendingInvitationsForEmail(
        db: DatabaseExecutor,
        organizationId: string,
        email: string,
        now: Date,
    ): Promise<readonly MyInvitationRow[]> {
        return db
            .select({
                id: teamInvitations.id,
                teamId: teamInvitations.teamId,
                teamName: teams.name,
                editionId: teams.editionId,
                divisionId: teams.divisionId,
                inviterDisplayName: users.displayName,
                status: teamInvitations.status,
                expiresAt: teamInvitations.expiresAt,
                createdAt: teamInvitations.createdAt,
            })
            .from(teamInvitations)
            .innerJoin(
                teams,
                and(
                    eq(teams.id, teamInvitations.teamId),
                    eq(teams.organizationId, teamInvitations.organizationId),
                ),
            )
            .innerJoin(users, eq(users.id, teamInvitations.invitedByUserId))
            .where(
                and(
                    eq(teamInvitations.organizationId, organizationId),
                    sql`lower(${teamInvitations.email}) = ${email.toLowerCase()}`,
                    eq(teamInvitations.status, "pending"),
                    gt(teamInvitations.expiresAt, now),
                ),
            )
            .orderBy(desc(teamInvitations.createdAt));
    }

    async findInvitationById(
        db: DatabaseExecutor,
        organizationId: string,
        invitationId: string,
    ): Promise<InvitationWithTeam | null> {
        const rows = await db
            .select(invitationSelection)
            .from(teamInvitations)
            .innerJoin(
                teams,
                and(
                    eq(teams.id, teamInvitations.teamId),
                    eq(teams.organizationId, teamInvitations.organizationId),
                ),
            )
            .where(
                and(
                    eq(teamInvitations.organizationId, organizationId),
                    eq(teamInvitations.id, invitationId),
                ),
            )
            .limit(1);
        return rows[0] ?? null;
    }

    async lockInvitationById(
        session: DatabaseSession,
        organizationId: string,
        invitationId: string,
    ): Promise<InvitationWithTeam | null> {
        const rows = await session.db
            .select(invitationSelection)
            .from(teamInvitations)
            .innerJoin(
                teams,
                and(
                    eq(teams.id, teamInvitations.teamId),
                    eq(teams.organizationId, teamInvitations.organizationId),
                ),
            )
            .where(
                and(
                    eq(teamInvitations.organizationId, organizationId),
                    eq(teamInvitations.id, invitationId),
                ),
            )
            .limit(1)
            .for("update", { of: teamInvitations });
        return rows[0] ?? null;
    }

    async markInvitationStatus(
        session: DatabaseSession,
        invitationId: string,
        status: "declined" | "revoked",
    ): Promise<void> {
        await session.db
            .update(teamInvitations)
            .set({ status })
            .where(eq(teamInvitations.id, invitationId));
    }

    async revokePendingInvitations(session: DatabaseSession, teamId: string): Promise<number> {
        const rows = await session.db
            .update(teamInvitations)
            .set({ status: "revoked" })
            .where(and(eq(teamInvitations.teamId, teamId), eq(teamInvitations.status, "pending")))
            .returning({ id: teamInvitations.id });
        return rows.length;
    }

    async findInvitationByTokenHash(
        db: DatabaseExecutor,
        tokenHash: string,
    ): Promise<InvitationWithTeam | null> {
        const rows = await db
            .select(invitationSelection)
            .from(teamInvitations)
            .innerJoin(
                teams,
                and(
                    eq(teams.id, teamInvitations.teamId),
                    eq(teams.organizationId, teamInvitations.organizationId),
                ),
            )
            .where(eq(teamInvitations.tokenHash, tokenHash))
            .limit(1);
        return rows[0] ?? null;
    }

    async lockInvitationByTokenHash(
        session: DatabaseSession,
        tokenHash: string,
    ): Promise<InvitationWithTeam | null> {
        const rows = await session.db
            .select(invitationSelection)
            .from(teamInvitations)
            .innerJoin(
                teams,
                and(
                    eq(teams.id, teamInvitations.teamId),
                    eq(teams.organizationId, teamInvitations.organizationId),
                ),
            )
            .where(eq(teamInvitations.tokenHash, tokenHash))
            .limit(1)
            .for("update");
        return rows[0] ?? null;
    }

    async markInvitationAccepted(
        session: DatabaseSession,
        invitationId: string,
        userId: string,
        acceptedAt: Date,
    ): Promise<void> {
        await session.db
            .update(teamInvitations)
            .set({ status: "accepted", acceptedByUserId: userId, acceptedAt })
            .where(eq(teamInvitations.id, invitationId));
    }

    async listInvitations(
        db: DatabaseExecutor,
        teamId: string,
    ): Promise<readonly TeamInvitationRow[]> {
        return db
            .select({
                id: teamInvitations.id,
                teamId: teamInvitations.teamId,
                email: teamInvitations.email,
                status: teamInvitations.status,
                expiresAt: teamInvitations.expiresAt,
                createdAt: teamInvitations.createdAt,
            })
            .from(teamInvitations)
            .where(eq(teamInvitations.teamId, teamId))
            .orderBy(desc(teamInvitations.createdAt));
    }

    async auditPage(
        db: DatabaseExecutor,
        organizationId: string,
        teamId: string,
        options: { readonly limit: number; readonly before: Date | null },
    ): Promise<readonly TeamAuditRow[]> {
        const conditions: SQL[] = [
            eq(auditLogs.organizationId, organizationId),
            eq(auditLogs.entityType, "team"),
            eq(auditLogs.entityId, teamId),
        ];
        if (options.before !== null) {
            conditions.push(lt(auditLogs.createdAt, options.before));
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
