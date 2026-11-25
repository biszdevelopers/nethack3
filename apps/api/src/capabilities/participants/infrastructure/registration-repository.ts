import { and, desc, eq, sql } from "drizzle-orm";
import type { CompetitionEditionStatus } from "@nethack/contracts";
import type { DatabaseExecutor, DatabaseSession } from "../../../infrastructure/database/client.js";
import {
    competitionEditions,
    participants,
    registrations,
    users,
} from "../../../infrastructure/database/schema/index.js";

export type RegistrationRow = typeof registrations.$inferSelect;
export type ParticipantRow = typeof participants.$inferSelect;

export interface EditionLockRow {
    readonly status: CompetitionEditionStatus;
    readonly registrationOpensAt: Date | null;
    readonly registrationClosesAt: Date | null;
    readonly maxParticipants: number | null;
}

export interface RegistrationViewRow {
    readonly id: string;
    readonly organizationId: string;
    readonly editionId: string;
    readonly userId: string;
    readonly divisionId: string | null;
    readonly status: RegistrationRow["status"];
    readonly note: string;
    readonly decidedByUserId: string | null;
    readonly createdAt: Date;
    readonly updatedAt: Date;
    readonly decidedAt: Date | null;
    readonly participantId: string | null;
    readonly displayName: string;
    readonly email: string | null;
}

export interface ParticipationRow {
    readonly organizationId: string;
    readonly editionId: string;
    readonly status: RegistrationRow["status"];
    readonly divisionId: string | null;
    readonly participantDivisionId: string | null;
    readonly teamId: string | null;
    readonly participantRegisteredAt: Date | null;
    readonly createdAt: Date;
}

export interface NewRegistrationValues {
    readonly organizationId: string;
    readonly editionId: string;
    readonly userId: string;
    readonly divisionId: string | null;
    readonly status: "pending" | "waitlisted";
    readonly note: string;
}

export interface RegistrationUpdateValues {
    readonly status: RegistrationRow["status"];
    readonly note: string;
    readonly decidedByUserId: string;
    readonly decidedAt: Date;
    readonly updatedAt: Date;
}

export interface NewParticipantValues {
    readonly organizationId: string;
    readonly editionId: string;
    readonly userId: string;
    readonly divisionId: string | null;
    readonly registeredAt: Date;
}

export class RegistrationRepository {
    async lockEdition(
        session: DatabaseSession,
        organizationId: string,
        editionId: string,
    ): Promise<EditionLockRow | null> {
        const rows = await session.db
            .select({
                status: competitionEditions.status,
                registrationOpensAt: competitionEditions.registrationOpensAt,
                registrationClosesAt: competitionEditions.registrationClosesAt,
                maxParticipants: competitionEditions.maxParticipants,
            })
            .from(competitionEditions)
            .where(
                and(
                    eq(competitionEditions.organizationId, organizationId),
                    eq(competitionEditions.id, editionId),
                ),
            )
            .for("update")
            .limit(1);
        return rows[0] ?? null;
    }

    async findRegistration(
        db: DatabaseExecutor,
        organizationId: string,
        editionId: string,
        userId: string,
    ): Promise<RegistrationRow | null> {
        const rows = await db
            .select()
            .from(registrations)
            .where(
                and(
                    eq(registrations.organizationId, organizationId),
                    eq(registrations.editionId, editionId),
                    eq(registrations.userId, userId),
                ),
            )
            .limit(1);
        return rows[0] ?? null;
    }

    async findRegistrationByIdForUpdate(
        session: DatabaseSession,
        organizationId: string,
        editionId: string,
        registrationId: string,
    ): Promise<RegistrationRow | null> {
        const rows = await session.db
            .select()
            .from(registrations)
            .where(
                and(
                    eq(registrations.organizationId, organizationId),
                    eq(registrations.editionId, editionId),
                    eq(registrations.id, registrationId),
                ),
            )
            .for("update")
            .limit(1);
        return rows[0] ?? null;
    }

    async findRegistrationForUserForUpdate(
        session: DatabaseSession,
        organizationId: string,
        editionId: string,
        userId: string,
    ): Promise<RegistrationRow | null> {
        const rows = await session.db
            .select()
            .from(registrations)
            .where(
                and(
                    eq(registrations.organizationId, organizationId),
                    eq(registrations.editionId, editionId),
                    eq(registrations.userId, userId),
                ),
            )
            .for("update")
            .limit(1);
        return rows[0] ?? null;
    }

    async findRegistrationView(
        db: DatabaseExecutor,
        organizationId: string,
        editionId: string,
        userId: string,
    ): Promise<RegistrationViewRow | null> {
        const rows = await db
            .select({
                id: registrations.id,
                organizationId: registrations.organizationId,
                editionId: registrations.editionId,
                userId: registrations.userId,
                divisionId: registrations.divisionId,
                status: registrations.status,
                note: registrations.note,
                decidedByUserId: registrations.decidedByUserId,
                createdAt: registrations.createdAt,
                updatedAt: registrations.updatedAt,
                decidedAt: registrations.decidedAt,
                participantId: participants.id,
                displayName: users.displayName,
                email: users.email,
            })
            .from(registrations)
            .innerJoin(users, eq(users.id, registrations.userId))
            .leftJoin(
                participants,
                and(
                    eq(participants.organizationId, registrations.organizationId),
                    eq(participants.editionId, registrations.editionId),
                    eq(participants.userId, registrations.userId),
                ),
            )
            .where(
                and(
                    eq(registrations.organizationId, organizationId),
                    eq(registrations.editionId, editionId),
                    eq(registrations.userId, userId),
                ),
            )
            .limit(1);
        return rows[0] ?? null;
    }

    async listRegistrationViews(
        db: DatabaseExecutor,
        organizationId: string,
        editionId: string,
    ): Promise<readonly RegistrationViewRow[]> {
        return db
            .select({
                id: registrations.id,
                organizationId: registrations.organizationId,
                editionId: registrations.editionId,
                userId: registrations.userId,
                divisionId: registrations.divisionId,
                status: registrations.status,
                note: registrations.note,
                decidedByUserId: registrations.decidedByUserId,
                createdAt: registrations.createdAt,
                updatedAt: registrations.updatedAt,
                decidedAt: registrations.decidedAt,
                participantId: participants.id,
                displayName: users.displayName,
                email: users.email,
            })
            .from(registrations)
            .innerJoin(users, eq(users.id, registrations.userId))
            .leftJoin(
                participants,
                and(
                    eq(participants.organizationId, registrations.organizationId),
                    eq(participants.editionId, registrations.editionId),
                    eq(participants.userId, registrations.userId),
                ),
            )
            .where(
                and(
                    eq(registrations.organizationId, organizationId),
                    eq(registrations.editionId, editionId),
                ),
            )
            .orderBy(desc(registrations.createdAt));
    }

    async insertRegistration(
        session: DatabaseSession,
        values: NewRegistrationValues,
    ): Promise<RegistrationRow> {
        const [row] = await session.db.insert(registrations).values(values).returning();
        if (row === undefined) {
            throw new Error("The registration could not be created.");
        }
        return row;
    }

    async updateRegistration(
        session: DatabaseSession,
        registrationId: string,
        values: RegistrationUpdateValues,
    ): Promise<RegistrationRow | null> {
        const rows = await session.db
            .update(registrations)
            .set(values)
            .where(eq(registrations.id, registrationId))
            .returning();
        return rows[0] ?? null;
    }

    async withdrawRegistration(
        session: DatabaseSession,
        registrationId: string,
        updatedAt: Date,
    ): Promise<void> {
        await session.db
            .update(registrations)
            .set({ status: "withdrawn", updatedAt })
            .where(eq(registrations.id, registrationId));
    }

    async insertParticipant(
        session: DatabaseSession,
        values: NewParticipantValues,
    ): Promise<ParticipantRow> {
        const [row] = await session.db.insert(participants).values(values).returning();
        if (row === undefined) {
            throw new Error("The participant could not be created.");
        }
        return row;
    }

    async findParticipant(
        db: DatabaseExecutor,
        organizationId: string,
        editionId: string,
        userId: string,
    ): Promise<ParticipantRow | null> {
        const rows = await db
            .select()
            .from(participants)
            .where(
                and(
                    eq(participants.organizationId, organizationId),
                    eq(participants.editionId, editionId),
                    eq(participants.userId, userId),
                ),
            )
            .limit(1);
        return rows[0] ?? null;
    }

    async deleteParticipant(session: DatabaseSession, participantId: string): Promise<void> {
        await session.db.delete(participants).where(eq(participants.id, participantId));
    }

    async updateParticipantTeam(
        session: DatabaseSession,
        organizationId: string,
        editionId: string,
        userId: string,
        teamId: string | null,
    ): Promise<boolean> {
        const rows = await session.db
            .update(participants)
            .set({ teamId })
            .where(
                and(
                    eq(participants.organizationId, organizationId),
                    eq(participants.editionId, editionId),
                    eq(participants.userId, userId),
                ),
            )
            .returning({ id: participants.id });
        return rows.length > 0;
    }

    async countParticipants(
        db: DatabaseExecutor,
        organizationId: string,
        editionId: string,
    ): Promise<number> {
        const rows = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(participants)
            .where(
                and(
                    eq(participants.organizationId, organizationId),
                    eq(participants.editionId, editionId),
                ),
            );
        return rows[0]?.count ?? 0;
    }

    async countRegistrations(
        db: DatabaseExecutor,
        organizationId: string,
        editionId: string,
    ): Promise<{ total: number; approved: number }> {
        const rows = await db
            .select({
                total: sql<number>`count(*)::int`,
                approved: sql<number>`(count(*) filter (where ${registrations.status} = 'approved'))::int`,
            })
            .from(registrations)
            .where(
                and(
                    eq(registrations.organizationId, organizationId),
                    eq(registrations.editionId, editionId),
                ),
            );
        return {
            total: rows[0]?.total ?? 0,
            approved: rows[0]?.approved ?? 0,
        };
    }

    async listParticipationsForUser(
        db: DatabaseExecutor,
        organizationId: string,
        userId: string,
    ): Promise<readonly ParticipationRow[]> {
        return db
            .select({
                organizationId: registrations.organizationId,
                editionId: registrations.editionId,
                status: registrations.status,
                divisionId: registrations.divisionId,
                participantDivisionId: participants.divisionId,
                teamId: participants.teamId,
                participantRegisteredAt: participants.registeredAt,
                createdAt: registrations.createdAt,
            })
            .from(registrations)
            .leftJoin(
                participants,
                and(
                    eq(participants.organizationId, registrations.organizationId),
                    eq(participants.editionId, registrations.editionId),
                    eq(participants.userId, registrations.userId),
                ),
            )
            .where(
                and(
                    eq(registrations.organizationId, organizationId),
                    eq(registrations.userId, userId),
                ),
            )
            .orderBy(desc(registrations.createdAt));
    }
}
