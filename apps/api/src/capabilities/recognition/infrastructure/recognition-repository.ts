import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import type { CompetitionEditionStatus, PublicResults } from "@nethack/contracts";
import type { DatabaseExecutor, DatabaseSession } from "../../../infrastructure/database/client.js";
import {
    awards,
    editionResults,
    teamAwards,
} from "../../../infrastructure/database/schema/index.js";

export type AwardRow = typeof awards.$inferSelect;
export type TeamAwardRow = typeof teamAwards.$inferSelect;
export type EditionResultsRow = typeof editionResults.$inferSelect;

export interface NewAwardValues {
    readonly organizationId: string;
    readonly editionId: string;
    readonly namespace: string;
    readonly name: string;
    readonly description: string;
    readonly icon: string;
    readonly color: string;
    readonly createdByUserId: string;
    readonly createdAt: Date;
    readonly updatedAt: Date;
}

export interface AwardUpdateValues {
    readonly name?: string;
    readonly description?: string;
    readonly icon?: string;
    readonly color?: string;
    readonly updatedAt: Date;
}

export interface NewTeamAwardValues {
    readonly organizationId: string;
    readonly editionId: string;
    readonly teamId: string;
    readonly awardId: string;
    readonly note: string;
    readonly assignedByUserId: string;
    readonly assignedAt: Date;
}

export interface NewEditionResultsValues {
    readonly organizationId: string;
    readonly editionId: string;
    readonly publishedAt: Date;
    readonly publishedByUserId: string;
    readonly previousEditionStatus: CompetitionEditionStatus | null;
    readonly snapshot: PublicResults;
}

export class RecognitionRepository {
    async listAwards(
        db: DatabaseExecutor,
        organizationId: string,
        editionId: string,
    ): Promise<readonly AwardRow[]> {
        return db
            .select()
            .from(awards)
            .where(and(eq(awards.organizationId, organizationId), eq(awards.editionId, editionId)))
            .orderBy(asc(awards.namespace));
    }

    async findAward(
        db: DatabaseExecutor,
        organizationId: string,
        awardId: string,
    ): Promise<AwardRow | null> {
        const rows = await db
            .select()
            .from(awards)
            .where(and(eq(awards.organizationId, organizationId), eq(awards.id, awardId)))
            .limit(1);
        return rows[0] ?? null;
    }

    async findAwardForUpdate(
        session: DatabaseSession,
        organizationId: string,
        awardId: string,
    ): Promise<AwardRow | null> {
        const rows = await session.db
            .select()
            .from(awards)
            .where(and(eq(awards.organizationId, organizationId), eq(awards.id, awardId)))
            .limit(1)
            .for("update");
        return rows[0] ?? null;
    }

    async insertAward(session: DatabaseSession, values: NewAwardValues): Promise<AwardRow> {
        const rows = await session.db.insert(awards).values(values).returning();
        const row = rows[0];
        if (row === undefined) {
            throw new Error("The award insert returned no row.");
        }
        return row;
    }

    async updateAward(
        session: DatabaseSession,
        organizationId: string,
        awardId: string,
        values: AwardUpdateValues,
    ): Promise<AwardRow | null> {
        const rows = await session.db
            .update(awards)
            .set(values)
            .where(and(eq(awards.organizationId, organizationId), eq(awards.id, awardId)))
            .returning();
        return rows[0] ?? null;
    }

    async deleteAward(
        session: DatabaseSession,
        organizationId: string,
        awardId: string,
    ): Promise<AwardRow | null> {
        const rows = await session.db
            .delete(awards)
            .where(and(eq(awards.organizationId, organizationId), eq(awards.id, awardId)))
            .returning();
        return rows[0] ?? null;
    }

    async listTeamAwards(
        db: DatabaseExecutor,
        organizationId: string,
        editionId: string,
    ): Promise<readonly TeamAwardRow[]> {
        return db
            .select()
            .from(teamAwards)
            .where(
                and(
                    eq(teamAwards.organizationId, organizationId),
                    eq(teamAwards.editionId, editionId),
                ),
            )
            .orderBy(asc(teamAwards.assignedAt), asc(teamAwards.id));
    }

    async countTeamAwardsForAward(
        db: DatabaseExecutor,
        organizationId: string,
        awardId: string,
    ): Promise<number> {
        const rows = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(teamAwards)
            .where(
                and(eq(teamAwards.organizationId, organizationId), eq(teamAwards.awardId, awardId)),
            );
        return rows[0]?.count ?? 0;
    }

    async findTeamAward(
        db: DatabaseExecutor,
        organizationId: string,
        editionId: string,
        teamId: string,
        awardId: string,
    ): Promise<TeamAwardRow | null> {
        const rows = await db
            .select()
            .from(teamAwards)
            .where(
                and(
                    eq(teamAwards.organizationId, organizationId),
                    eq(teamAwards.editionId, editionId),
                    eq(teamAwards.teamId, teamId),
                    eq(teamAwards.awardId, awardId),
                ),
            )
            .limit(1);
        return rows[0] ?? null;
    }

    async insertTeamAward(
        session: DatabaseSession,
        values: NewTeamAwardValues,
    ): Promise<TeamAwardRow> {
        const rows = await session.db.insert(teamAwards).values(values).returning();
        const row = rows[0];
        if (row === undefined) {
            throw new Error("The team award insert returned no row.");
        }
        return row;
    }

    async deleteTeamAward(
        session: DatabaseSession,
        organizationId: string,
        editionId: string,
        teamId: string,
        awardId: string,
    ): Promise<TeamAwardRow | null> {
        const rows = await session.db
            .delete(teamAwards)
            .where(
                and(
                    eq(teamAwards.organizationId, organizationId),
                    eq(teamAwards.editionId, editionId),
                    eq(teamAwards.teamId, teamId),
                    eq(teamAwards.awardId, awardId),
                ),
            )
            .returning();
        return rows[0] ?? null;
    }

    async findResults(
        db: DatabaseExecutor,
        organizationId: string,
        editionId: string,
    ): Promise<EditionResultsRow | null> {
        const rows = await db
            .select()
            .from(editionResults)
            .where(
                and(
                    eq(editionResults.organizationId, organizationId),
                    eq(editionResults.editionId, editionId),
                ),
            )
            .limit(1);
        return rows[0] ?? null;
    }

    async findResultsForUpdate(
        session: DatabaseSession,
        organizationId: string,
        editionId: string,
    ): Promise<EditionResultsRow | null> {
        const rows = await session.db
            .select()
            .from(editionResults)
            .where(
                and(
                    eq(editionResults.organizationId, organizationId),
                    eq(editionResults.editionId, editionId),
                ),
            )
            .limit(1)
            .for("update");
        return rows[0] ?? null;
    }

    async findResultsBySlug(db: DatabaseExecutor, slug: string): Promise<EditionResultsRow | null> {
        const rows = await db
            .select()
            .from(editionResults)
            .where(sql`${editionResults.snapshot} -> 'edition' ->> 'slug' = ${slug}`)
            .orderBy(desc(editionResults.publishedAt))
            .limit(1);
        return rows[0] ?? null;
    }

    async findResultsForTeam(
        db: DatabaseExecutor,
        teamId: string,
    ): Promise<EditionResultsRow | null> {
        const entryMatch = sql`${editionResults.snapshot} -> 'judgingEntries' @> ${JSON.stringify([{ teamId }])}::jsonb`;
        const awardMatch = sql`${editionResults.snapshot} -> 'awards' @> ${JSON.stringify([{ teams: [{ teamId }] }])}::jsonb`;
        const rows = await db
            .select()
            .from(editionResults)
            .where(or(entryMatch, awardMatch))
            .orderBy(desc(editionResults.publishedAt))
            .limit(1);
        return rows[0] ?? null;
    }

    async insertResults(
        session: DatabaseSession,
        values: NewEditionResultsValues,
    ): Promise<EditionResultsRow> {
        const rows = await session.db.insert(editionResults).values(values).returning();
        const row = rows[0];
        if (row === undefined) {
            throw new Error("The results insert returned no row.");
        }
        return row;
    }

    async deleteResults(
        session: DatabaseSession,
        organizationId: string,
        editionId: string,
    ): Promise<EditionResultsRow | null> {
        const rows = await session.db
            .delete(editionResults)
            .where(
                and(
                    eq(editionResults.organizationId, organizationId),
                    eq(editionResults.editionId, editionId),
                ),
            )
            .returning();
        return rows[0] ?? null;
    }
}
