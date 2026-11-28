import { and, asc, desc, eq, inArray, isNotNull, lt, or, sql } from "drizzle-orm";
import type { CompetitionEditionStatus, MilestoneKind } from "@nethack/contracts";
import type { DatabaseExecutor, DatabaseSession } from "../../../infrastructure/database/client.js";
import {
    competitionEditions,
    competitionSeries,
    divisions,
    milestones,
    organizations,
    projects,
    registrations,
    submissions,
    teams,
} from "../../../infrastructure/database/schema/index.js";

const VISIBLE_EDITION_STATUSES: readonly CompetitionEditionStatus[] = [
    "published",
    "registration_open",
    "registration_closed",
    "active",
    "judging",
    "voting",
    "completed",
    "archived",
];

const PUBLIC_PROJECT_LIMIT = 100;

export type SeriesRow = typeof competitionSeries.$inferSelect;
export type EditionRow = typeof competitionEditions.$inferSelect;
export type DivisionRow = typeof divisions.$inferSelect;
export type MilestoneRow = typeof milestones.$inferSelect;

export type EditionWithSeriesRow = EditionRow & { readonly seriesName: string };
export type PublicEditionRow = EditionWithSeriesRow;
export type OrganizationPublicRow = typeof organizations.$inferSelect;

export interface PublicProjectRow {
    readonly id: string;
    readonly title: string;
    readonly slug: string;
    readonly summary: string;
    readonly publishedAt: Date | null;
    readonly teamName: string | null;
}

export interface NewSeriesValues {
    readonly organizationId: string;
    readonly name: string;
    readonly slug: string;
    readonly description: string;
}

export interface SeriesUpdateValues {
    readonly updatedAt: Date;
    readonly name?: string;
    readonly description?: string;
}

export interface NewEditionValues {
    readonly organizationId: string;
    readonly seriesId: string;
    readonly name: string;
    readonly slug: string;
    readonly description: string;
    readonly themeName: string | null;
    readonly themeDescription: string | null;
    readonly contactEmail: string | null;
    readonly contactUrl: string | null;
    readonly showScores: boolean;
    readonly showRanking: boolean;
    readonly timezone: string;
    readonly registrationOpensAt: Date | null;
    readonly registrationClosesAt: Date | null;
    readonly startsAt: Date | null;
    readonly endsAt: Date | null;
    readonly teamMinSize: number;
    readonly teamMaxSize: number;
    readonly maxParticipants: number | null;
    readonly rulesMarkdown: string;
    readonly resultsOpenAt: Date | null;
}

export interface EditionUpdateValues {
    readonly updatedAt: Date;
    readonly name?: string;
    readonly description?: string;
    readonly themeName?: string | null;
    readonly themeDescription?: string | null;
    readonly contactEmail?: string | null;
    readonly contactUrl?: string | null;
    readonly showScores?: boolean;
    readonly showRanking?: boolean;
    readonly status?: CompetitionEditionStatus;
    readonly timezone?: string;
    readonly registrationOpensAt?: Date | null;
    readonly registrationClosesAt?: Date | null;
    readonly startsAt?: Date | null;
    readonly endsAt?: Date | null;
    readonly teamMinSize?: number;
    readonly teamMaxSize?: number;
    readonly maxParticipants?: number | null;
    readonly rulesMarkdown?: string;
    readonly resultsOpenAt?: Date | null;
    readonly publishedAt?: Date | null;
}

export interface NewDivisionValues {
    readonly organizationId: string;
    readonly editionId: string;
    readonly name: string;
    readonly slug: string;
    readonly description: string;
    readonly minTeamSize: number | null;
    readonly maxTeamSize: number | null;
}

export interface DivisionUpdateValues {
    readonly name?: string;
    readonly description?: string;
    readonly minTeamSize?: number | null;
    readonly maxTeamSize?: number | null;
}

export interface MilestoneUpdateValues {
    readonly title?: string;
    readonly description?: string;
    readonly kind?: MilestoneKind;
    readonly occursAt?: Date;
}

export interface EditionPageOptions {
    readonly limit: number;
    readonly seriesId: string | null;
    readonly before: Date | null;
    readonly beforeId: string | null;
}

export interface NewMilestoneValues {
    readonly organizationId: string;
    readonly editionId: string;
    readonly title: string;
    readonly description: string;
    readonly kind: MilestoneKind;
    readonly occursAt: Date;
}

export class CompetitionRepository {
    async listSeries(db: DatabaseExecutor, organizationId: string): Promise<readonly SeriesRow[]> {
        return db
            .select()
            .from(competitionSeries)
            .where(eq(competitionSeries.organizationId, organizationId))
            .orderBy(desc(competitionSeries.createdAt));
    }

    async findSeriesById(
        db: DatabaseExecutor,
        organizationId: string,
        seriesId: string,
    ): Promise<SeriesRow | null> {
        const rows = await db
            .select()
            .from(competitionSeries)
            .where(
                and(
                    eq(competitionSeries.organizationId, organizationId),
                    eq(competitionSeries.id, seriesId),
                ),
            )
            .limit(1);
        return rows[0] ?? null;
    }

    async insertSeries(session: DatabaseSession, values: NewSeriesValues): Promise<SeriesRow> {
        const [row] = await session.db.insert(competitionSeries).values(values).returning();
        if (row === undefined) {
            throw new Error("The competition series could not be created.");
        }
        return row;
    }

    async lockSeries(
        session: DatabaseSession,
        organizationId: string,
        seriesId: string,
    ): Promise<SeriesRow | null> {
        const rows = await session.db
            .select()
            .from(competitionSeries)
            .where(
                and(
                    eq(competitionSeries.organizationId, organizationId),
                    eq(competitionSeries.id, seriesId),
                ),
            )
            .for("update")
            .limit(1);
        return rows[0] ?? null;
    }

    async updateSeries(
        session: DatabaseSession,
        organizationId: string,
        seriesId: string,
        values: SeriesUpdateValues,
    ): Promise<SeriesRow | null> {
        const rows = await session.db
            .update(competitionSeries)
            .set(values)
            .where(
                and(
                    eq(competitionSeries.organizationId, organizationId),
                    eq(competitionSeries.id, seriesId),
                ),
            )
            .returning();
        return rows[0] ?? null;
    }

    async deleteSeries(
        session: DatabaseSession,
        organizationId: string,
        seriesId: string,
    ): Promise<void> {
        await session.db
            .delete(competitionSeries)
            .where(
                and(
                    eq(competitionSeries.organizationId, organizationId),
                    eq(competitionSeries.id, seriesId),
                ),
            );
    }

    async countEditionsForSeries(
        db: DatabaseExecutor,
        organizationId: string,
        seriesId: string,
    ): Promise<number> {
        const rows = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(competitionEditions)
            .where(
                and(
                    eq(competitionEditions.organizationId, organizationId),
                    eq(competitionEditions.seriesId, seriesId),
                ),
            );
        return rows[0]?.count ?? 0;
    }

    async findEdition(
        db: DatabaseExecutor,
        organizationId: string,
        editionId: string,
    ): Promise<EditionWithSeriesRow | null> {
        const rows = await db
            .select({ edition: competitionEditions, seriesName: competitionSeries.name })
            .from(competitionEditions)
            .innerJoin(competitionSeries, eq(competitionSeries.id, competitionEditions.seriesId))
            .where(
                and(
                    eq(competitionEditions.organizationId, organizationId),
                    eq(competitionEditions.id, editionId),
                ),
            )
            .limit(1);
        const row = rows[0];
        return row === undefined ? null : { ...row.edition, seriesName: row.seriesName };
    }

    async listEditions(
        db: DatabaseExecutor,
        organizationId: string,
    ): Promise<readonly EditionWithSeriesRow[]> {
        const rows = await db
            .select({ edition: competitionEditions, seriesName: competitionSeries.name })
            .from(competitionEditions)
            .innerJoin(competitionSeries, eq(competitionSeries.id, competitionEditions.seriesId))
            .where(eq(competitionEditions.organizationId, organizationId))
            .orderBy(desc(competitionEditions.createdAt), desc(competitionEditions.id));
        return rows.map((row) => ({ ...row.edition, seriesName: row.seriesName }));
    }

    async listEditionsPage(
        db: DatabaseExecutor,
        organizationId: string,
        options: EditionPageOptions,
    ): Promise<readonly EditionWithSeriesRow[]> {
        const conditions = [eq(competitionEditions.organizationId, organizationId)];
        if (options.seriesId !== null) {
            conditions.push(eq(competitionEditions.seriesId, options.seriesId));
        }
        if (options.before !== null && options.beforeId !== null) {
            const before = options.before;
            const beforeId = options.beforeId;
            const cursorCondition = or(
                lt(competitionEditions.createdAt, before),
                and(
                    eq(competitionEditions.createdAt, before),
                    lt(competitionEditions.id, beforeId),
                ),
            );
            if (cursorCondition !== undefined) {
                conditions.push(cursorCondition);
            }
        }
        const rows = await db
            .select({ edition: competitionEditions, seriesName: competitionSeries.name })
            .from(competitionEditions)
            .innerJoin(competitionSeries, eq(competitionSeries.id, competitionEditions.seriesId))
            .where(and(...conditions))
            .orderBy(desc(competitionEditions.createdAt), desc(competitionEditions.id))
            .limit(options.limit);
        return rows.map((row) => ({ ...row.edition, seriesName: row.seriesName }));
    }

    async insertEdition(session: DatabaseSession, values: NewEditionValues): Promise<EditionRow> {
        const [row] = await session.db.insert(competitionEditions).values(values).returning();
        if (row === undefined) {
            throw new Error("The competition edition could not be created.");
        }
        return row;
    }

    async updateEdition(
        session: DatabaseSession,
        organizationId: string,
        editionId: string,
        values: EditionUpdateValues,
    ): Promise<EditionRow | null> {
        const rows = await session.db
            .update(competitionEditions)
            .set(values)
            .where(
                and(
                    eq(competitionEditions.organizationId, organizationId),
                    eq(competitionEditions.id, editionId),
                ),
            )
            .returning();
        return rows[0] ?? null;
    }

    async countRegistrations(
        db: DatabaseExecutor,
        organizationId: string,
        editionId: string,
    ): Promise<number> {
        const rows = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(registrations)
            .where(
                and(
                    eq(registrations.organizationId, organizationId),
                    eq(registrations.editionId, editionId),
                ),
            );
        return rows[0]?.count ?? 0;
    }

    async countTeams(
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

    async countRegistrationsByEdition(
        db: DatabaseExecutor,
        organizationId: string,
        editionIds: readonly string[],
    ): Promise<Map<string, number>> {
        if (editionIds.length === 0) {
            return new Map();
        }
        const rows = await db
            .select({
                editionId: registrations.editionId,
                count: sql<number>`count(*)::int`,
            })
            .from(registrations)
            .where(
                and(
                    eq(registrations.organizationId, organizationId),
                    inArray(registrations.editionId, [...editionIds]),
                ),
            )
            .groupBy(registrations.editionId);
        return new Map(rows.map((row) => [row.editionId, row.count]));
    }

    async countTeamsByEdition(
        db: DatabaseExecutor,
        organizationId: string,
        editionIds: readonly string[],
    ): Promise<Map<string, number>> {
        if (editionIds.length === 0) {
            return new Map();
        }
        const rows = await db
            .select({
                editionId: teams.editionId,
                count: sql<number>`count(*)::int`,
            })
            .from(teams)
            .where(
                and(
                    eq(teams.organizationId, organizationId),
                    inArray(teams.editionId, [...editionIds]),
                ),
            )
            .groupBy(teams.editionId);
        return new Map(rows.map((row) => [row.editionId, row.count]));
    }

    async countSubmissions(
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

    async insertDivision(
        session: DatabaseSession,
        values: NewDivisionValues,
    ): Promise<DivisionRow> {
        const [row] = await session.db.insert(divisions).values(values).returning();
        if (row === undefined) {
            throw new Error("The division could not be created.");
        }
        return row;
    }

    async listDivisions(
        db: DatabaseExecutor,
        organizationId: string,
        editionId: string,
    ): Promise<readonly DivisionRow[]> {
        return db
            .select()
            .from(divisions)
            .where(
                and(
                    eq(divisions.organizationId, organizationId),
                    eq(divisions.editionId, editionId),
                ),
            )
            .orderBy(asc(divisions.name), asc(divisions.id));
    }

    async findDivision(
        db: DatabaseExecutor,
        organizationId: string,
        divisionId: string,
    ): Promise<DivisionRow | null> {
        const rows = await db
            .select()
            .from(divisions)
            .where(and(eq(divisions.organizationId, organizationId), eq(divisions.id, divisionId)))
            .limit(1);
        return rows[0] ?? null;
    }

    async findDivisionForEdition(
        db: DatabaseExecutor,
        organizationId: string,
        editionId: string,
        divisionId: string,
    ): Promise<DivisionRow | null> {
        const rows = await db
            .select()
            .from(divisions)
            .where(
                and(
                    eq(divisions.organizationId, organizationId),
                    eq(divisions.editionId, editionId),
                    eq(divisions.id, divisionId),
                ),
            )
            .limit(1);
        return rows[0] ?? null;
    }

    async lockDivisionForEdition(
        session: DatabaseSession,
        organizationId: string,
        editionId: string,
        divisionId: string,
    ): Promise<DivisionRow | null> {
        const rows = await session.db
            .select()
            .from(divisions)
            .where(
                and(
                    eq(divisions.organizationId, organizationId),
                    eq(divisions.editionId, editionId),
                    eq(divisions.id, divisionId),
                ),
            )
            .for("update")
            .limit(1);
        return rows[0] ?? null;
    }

    async updateDivision(
        session: DatabaseSession,
        organizationId: string,
        editionId: string,
        divisionId: string,
        values: DivisionUpdateValues,
    ): Promise<DivisionRow | null> {
        const rows = await session.db
            .update(divisions)
            .set(values)
            .where(
                and(
                    eq(divisions.organizationId, organizationId),
                    eq(divisions.editionId, editionId),
                    eq(divisions.id, divisionId),
                ),
            )
            .returning();
        return rows[0] ?? null;
    }

    async deleteDivision(
        session: DatabaseSession,
        organizationId: string,
        editionId: string,
        divisionId: string,
    ): Promise<void> {
        await session.db
            .delete(divisions)
            .where(
                and(
                    eq(divisions.organizationId, organizationId),
                    eq(divisions.editionId, editionId),
                    eq(divisions.id, divisionId),
                ),
            );
    }

    async countDivisionRegistrations(
        db: DatabaseExecutor,
        organizationId: string,
        divisionId: string,
    ): Promise<number> {
        const rows = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(registrations)
            .where(
                and(
                    eq(registrations.organizationId, organizationId),
                    eq(registrations.divisionId, divisionId),
                ),
            );
        return rows[0]?.count ?? 0;
    }

    async countDivisionTeams(
        db: DatabaseExecutor,
        organizationId: string,
        divisionId: string,
    ): Promise<number> {
        const rows = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(teams)
            .where(and(eq(teams.organizationId, organizationId), eq(teams.divisionId, divisionId)));
        return rows[0]?.count ?? 0;
    }

    async insertMilestone(
        session: DatabaseSession,
        values: NewMilestoneValues,
    ): Promise<MilestoneRow> {
        const [row] = await session.db.insert(milestones).values(values).returning();
        if (row === undefined) {
            throw new Error("The milestone could not be created.");
        }
        return row;
    }

    async listMilestones(
        db: DatabaseExecutor,
        organizationId: string,
        editionId: string,
    ): Promise<readonly MilestoneRow[]> {
        return db
            .select()
            .from(milestones)
            .where(
                and(
                    eq(milestones.organizationId, organizationId),
                    eq(milestones.editionId, editionId),
                ),
            )
            .orderBy(asc(milestones.occursAt), asc(milestones.id));
    }

    async findMilestone(
        db: DatabaseExecutor,
        organizationId: string,
        editionId: string,
        milestoneId: string,
    ): Promise<MilestoneRow | null> {
        const rows = await db
            .select()
            .from(milestones)
            .where(
                and(
                    eq(milestones.organizationId, organizationId),
                    eq(milestones.editionId, editionId),
                    eq(milestones.id, milestoneId),
                ),
            )
            .limit(1);
        return rows[0] ?? null;
    }

    async updateMilestone(
        session: DatabaseSession,
        organizationId: string,
        editionId: string,
        milestoneId: string,
        values: MilestoneUpdateValues,
    ): Promise<MilestoneRow | null> {
        const rows = await session.db
            .update(milestones)
            .set(values)
            .where(
                and(
                    eq(milestones.organizationId, organizationId),
                    eq(milestones.editionId, editionId),
                    eq(milestones.id, milestoneId),
                ),
            )
            .returning();
        return rows[0] ?? null;
    }

    async deleteMilestone(
        session: DatabaseSession,
        organizationId: string,
        editionId: string,
        milestoneId: string,
    ): Promise<void> {
        await session.db
            .delete(milestones)
            .where(
                and(
                    eq(milestones.organizationId, organizationId),
                    eq(milestones.editionId, editionId),
                    eq(milestones.id, milestoneId),
                ),
            );
    }

    async findVisibleEditionById(
        db: DatabaseExecutor,
        editionId: string,
    ): Promise<EditionRow | null> {
        const rows = await db
            .select()
            .from(competitionEditions)
            .where(
                and(
                    eq(competitionEditions.id, editionId),
                    inArray(competitionEditions.status, [...VISIBLE_EDITION_STATUSES]),
                ),
            )
            .limit(1);
        return rows[0] ?? null;
    }

    async findOrganizationBySlug(
        db: DatabaseExecutor,
        slug: string,
    ): Promise<OrganizationPublicRow | null> {
        const rows = await db
            .select()
            .from(organizations)
            .where(eq(organizations.slug, slug))
            .limit(1);
        return rows[0] ?? null;
    }

    async listPublicEditions(
        db: DatabaseExecutor,
        options: { readonly limit: number; readonly organizationId: string | null },
    ): Promise<readonly PublicEditionRow[]> {
        const conditions = [inArray(competitionEditions.status, [...VISIBLE_EDITION_STATUSES])];
        if (options.organizationId !== null) {
            conditions.push(eq(competitionEditions.organizationId, options.organizationId));
        }
        const rows = await db
            .select({ edition: competitionEditions, seriesName: competitionSeries.name })
            .from(competitionEditions)
            .innerJoin(competitionSeries, eq(competitionSeries.id, competitionEditions.seriesId))
            .where(and(...conditions))
            .orderBy(
                desc(competitionEditions.publishedAt),
                desc(competitionEditions.createdAt),
                desc(competitionEditions.id),
            )
            .limit(options.limit);
        return rows.map((row) => ({ ...row.edition, seriesName: row.seriesName }));
    }

    async findPublicEditionBySlug(
        db: DatabaseExecutor,
        slug: string,
    ): Promise<PublicEditionRow | null> {
        // Edition slugs are unique per organization, so a global slug lookup
        // resolves to the most recently published visible edition.
        const rows = await db
            .select({ edition: competitionEditions, seriesName: competitionSeries.name })
            .from(competitionEditions)
            .innerJoin(competitionSeries, eq(competitionSeries.id, competitionEditions.seriesId))
            .where(
                and(
                    eq(competitionEditions.slug, slug),
                    inArray(competitionEditions.status, [...VISIBLE_EDITION_STATUSES]),
                ),
            )
            .orderBy(
                desc(competitionEditions.publishedAt),
                desc(competitionEditions.createdAt),
                desc(competitionEditions.id),
            )
            .limit(1);
        const row = rows[0];
        return row === undefined ? null : { ...row.edition, seriesName: row.seriesName };
    }

    async countPublishedProjectsByEdition(
        db: DatabaseExecutor,
        editionIds: readonly string[],
    ): Promise<Map<string, number>> {
        if (editionIds.length === 0) {
            return new Map();
        }
        const rows = await db
            .select({
                editionId: projects.editionId,
                count: sql<number>`count(*)::int`,
            })
            .from(projects)
            .where(
                and(
                    inArray(projects.editionId, [...editionIds]),
                    eq(projects.status, "published"),
                    isNotNull(projects.publishedAt),
                ),
            )
            .groupBy(projects.editionId);
        return new Map(rows.map((row) => [row.editionId, row.count]));
    }

    async listPublicProjects(
        db: DatabaseExecutor,
        editionId: string,
    ): Promise<readonly PublicProjectRow[]> {
        return db
            .select({
                id: projects.id,
                title: projects.title,
                slug: projects.slug,
                summary: projects.summary,
                publishedAt: projects.publishedAt,
                teamName: teams.name,
            })
            .from(projects)
            .leftJoin(teams, eq(teams.id, projects.teamId))
            .where(
                and(
                    eq(projects.editionId, editionId),
                    eq(projects.status, "published"),
                    isNotNull(projects.publishedAt),
                ),
            )
            .orderBy(desc(projects.publishedAt), asc(projects.title))
            .limit(PUBLIC_PROJECT_LIMIT);
    }
}
