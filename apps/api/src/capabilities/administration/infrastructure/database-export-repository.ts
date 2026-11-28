import { asc, eq, sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool, PoolClient } from "pg";
import type { DatabaseConnection } from "../../../infrastructure/database/client.js";
import * as schema from "../../../infrastructure/database/schema/index.js";
import type {
    DatabaseExportSection,
    DatabaseExportSnapshot,
    DatabaseExportSource,
} from "../application/database-export.js";

type ExportRow = Record<string, unknown>;

export class PostgresDatabaseExportSource implements DatabaseExportSource {
    private readonly pool: Pool;

    constructor(database: DatabaseConnection) {
        this.pool = database.pool;
    }

    async open(): Promise<DatabaseExportSnapshot> {
        const client = await this.pool.connect();
        try {
            await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
            return new PostgresDatabaseExportSnapshot(client, drizzle(client, { schema }));
        } catch (error) {
            client.release();
            throw error;
        }
    }
}

class PostgresDatabaseExportSnapshot implements DatabaseExportSnapshot {
    private readonly client: PoolClient;
    private readonly db: NodePgDatabase<typeof schema>;
    private currentOrganizationId: string | null = null;
    private released = false;

    constructor(client: PoolClient, db: NodePgDatabase<typeof schema>) {
        this.client = client;
        this.db = db;
    }

    async useOrganization(organizationId: string): Promise<void> {
        if (this.currentOrganizationId === organizationId) {
            return;
        }
        await this.client.query("select set_config('nethack.organization_id', $1, true)", [
            organizationId,
        ]);
        this.currentOrganizationId = organizationId;
    }

    async read(
        section: DatabaseExportSection,
        offset: number,
        limit: number,
    ): Promise<readonly ExportRow[]> {
        switch (section) {
            case "organizations":
                return this.db
                    .select({
                        id: schema.organizations.id,
                        name: schema.organizations.name,
                        slug: schema.organizations.slug,
                        description: schema.organizations.description,
                        websiteUrl: schema.organizations.websiteUrl,
                        createdAt: schema.organizations.createdAt,
                        updatedAt: schema.organizations.updatedAt,
                    })
                    .from(schema.organizations)
                    .orderBy(asc(schema.organizations.id))
                    .limit(limit)
                    .offset(offset);
            case "notifications":
                return this.db
                    .select({
                        id: schema.notifications.id,
                        organizationId: schema.notifications.organizationId,
                        kind: schema.notifications.kind,
                        title: schema.notifications.title,
                        linkUrl: schema.notifications.linkUrl,
                        readAt: schema.notifications.readAt,
                        emailSentAt: schema.notifications.emailSentAt,
                        createdAt: schema.notifications.createdAt,
                    })
                    .from(schema.notifications)
                    .orderBy(asc(schema.notifications.createdAt), asc(schema.notifications.id))
                    .limit(limit)
                    .offset(offset);
            case "judgingAggregates":
                return this.readJudgingAggregates(offset, limit);
            case "voteTotals":
                return this.readVoteTotals(offset, limit);
            default:
                return this.readTenantSection(section, offset, limit);
        }
    }

    async close(): Promise<void> {
        if (this.released) {
            return;
        }
        try {
            await this.client.query("COMMIT");
        } finally {
            this.released = true;
            this.client.release();
        }
    }

    async abort(): Promise<void> {
        if (this.released) {
            return;
        }
        try {
            await this.client.query("ROLLBACK");
        } finally {
            this.released = true;
            this.client.release();
        }
    }

    private async readTenantSection(
        section: Exclude<
            DatabaseExportSection,
            "organizations" | "notifications" | "judgingAggregates" | "voteTotals"
        >,
        offset: number,
        limit: number,
    ): Promise<readonly ExportRow[]> {
        const organizationId = this.requireOrganization();
        switch (section) {
            case "competitionSeries":
                return this.db
                    .select({
                        id: schema.competitionSeries.id,
                        organizationId: schema.competitionSeries.organizationId,
                        name: schema.competitionSeries.name,
                        slug: schema.competitionSeries.slug,
                        description: schema.competitionSeries.description,
                        createdAt: schema.competitionSeries.createdAt,
                        updatedAt: schema.competitionSeries.updatedAt,
                    })
                    .from(schema.competitionSeries)
                    .where(eq(schema.competitionSeries.organizationId, organizationId))
                    .orderBy(asc(schema.competitionSeries.id))
                    .limit(limit)
                    .offset(offset);
            case "competitionEditions":
                return this.db
                    .select({
                        id: schema.competitionEditions.id,
                        organizationId: schema.competitionEditions.organizationId,
                        seriesId: schema.competitionEditions.seriesId,
                        name: schema.competitionEditions.name,
                        slug: schema.competitionEditions.slug,
                        description: schema.competitionEditions.description,
                        status: schema.competitionEditions.status,
                        timezone: schema.competitionEditions.timezone,
                        registrationOpensAt: schema.competitionEditions.registrationOpensAt,
                        registrationClosesAt: schema.competitionEditions.registrationClosesAt,
                        startsAt: schema.competitionEditions.startsAt,
                        endsAt: schema.competitionEditions.endsAt,
                        teamMinSize: schema.competitionEditions.teamMinSize,
                        teamMaxSize: schema.competitionEditions.teamMaxSize,
                        maxParticipants: schema.competitionEditions.maxParticipants,
                        rulesMarkdown: schema.competitionEditions.rulesMarkdown,
                        publishedAt: schema.competitionEditions.publishedAt,
                        createdAt: schema.competitionEditions.createdAt,
                        updatedAt: schema.competitionEditions.updatedAt,
                    })
                    .from(schema.competitionEditions)
                    .where(eq(schema.competitionEditions.organizationId, organizationId))
                    .orderBy(asc(schema.competitionEditions.id))
                    .limit(limit)
                    .offset(offset);
            case "divisions":
                return this.db
                    .select({
                        id: schema.divisions.id,
                        organizationId: schema.divisions.organizationId,
                        editionId: schema.divisions.editionId,
                        name: schema.divisions.name,
                        slug: schema.divisions.slug,
                        description: schema.divisions.description,
                        minTeamSize: schema.divisions.minTeamSize,
                        maxTeamSize: schema.divisions.maxTeamSize,
                        createdAt: schema.divisions.createdAt,
                    })
                    .from(schema.divisions)
                    .where(eq(schema.divisions.organizationId, organizationId))
                    .orderBy(asc(schema.divisions.id))
                    .limit(limit)
                    .offset(offset);
            case "milestones":
                return this.db
                    .select({
                        id: schema.milestones.id,
                        organizationId: schema.milestones.organizationId,
                        editionId: schema.milestones.editionId,
                        title: schema.milestones.title,
                        description: schema.milestones.description,
                        kind: schema.milestones.kind,
                        occursAt: schema.milestones.occursAt,
                        createdAt: schema.milestones.createdAt,
                    })
                    .from(schema.milestones)
                    .where(eq(schema.milestones.organizationId, organizationId))
                    .orderBy(asc(schema.milestones.id))
                    .limit(limit)
                    .offset(offset);
            case "teams":
                return this.db
                    .select({
                        id: schema.teams.id,
                        organizationId: schema.teams.organizationId,
                        editionId: schema.teams.editionId,
                        divisionId: schema.teams.divisionId,
                        name: schema.teams.name,
                        description: schema.teams.description,
                        status: schema.teams.status,
                        captainUserId: schema.teams.captainUserId,
                        maxMembers: schema.teams.maxMembers,
                        createdAt: schema.teams.createdAt,
                        updatedAt: schema.teams.updatedAt,
                    })
                    .from(schema.teams)
                    .where(eq(schema.teams.organizationId, organizationId))
                    .orderBy(asc(schema.teams.id))
                    .limit(limit)
                    .offset(offset);
            case "teamMembers":
                return this.db
                    .select({
                        id: schema.teamMembers.id,
                        organizationId: schema.teamMembers.organizationId,
                        teamId: schema.teamMembers.teamId,
                        userId: schema.teamMembers.userId,
                        role: schema.teamMembers.role,
                        joinedAt: schema.teamMembers.joinedAt,
                    })
                    .from(schema.teamMembers)
                    .where(eq(schema.teamMembers.organizationId, organizationId))
                    .orderBy(asc(schema.teamMembers.id))
                    .limit(limit)
                    .offset(offset);
            case "projects":
                return this.db
                    .select({
                        id: schema.projects.id,
                        organizationId: schema.projects.organizationId,
                        editionId: schema.projects.editionId,
                        teamId: schema.projects.teamId,
                        ownerUserId: schema.projects.ownerUserId,
                        title: schema.projects.title,
                        slug: schema.projects.slug,
                        summary: schema.projects.summary,
                        descriptionMarkdown: schema.projects.descriptionMarkdown,
                        repositoryUrl: schema.projects.repositoryUrl,
                        demoUrl: schema.projects.demoUrl,
                        tags: schema.projects.tags,
                        status: schema.projects.status,
                        publishedAt: schema.projects.publishedAt,
                        createdAt: schema.projects.createdAt,
                        updatedAt: schema.projects.updatedAt,
                    })
                    .from(schema.projects)
                    .where(eq(schema.projects.organizationId, organizationId))
                    .orderBy(asc(schema.projects.id))
                    .limit(limit)
                    .offset(offset);
            case "projectMembers":
                return this.db
                    .select({
                        id: schema.projectMembers.id,
                        organizationId: schema.projectMembers.organizationId,
                        projectId: schema.projectMembers.projectId,
                        userId: schema.projectMembers.userId,
                        role: schema.projectMembers.role,
                        createdAt: schema.projectMembers.createdAt,
                    })
                    .from(schema.projectMembers)
                    .where(eq(schema.projectMembers.organizationId, organizationId))
                    .orderBy(asc(schema.projectMembers.id))
                    .limit(limit)
                    .offset(offset);
            case "submissions":
                return this.db
                    .select({
                        id: schema.submissions.id,
                        organizationId: schema.submissions.organizationId,
                        editionId: schema.submissions.editionId,
                        projectId: schema.submissions.projectId,
                        teamId: schema.submissions.teamId,
                        status: schema.submissions.status,
                        currentVersion: schema.submissions.currentVersion,
                        submittedAt: schema.submissions.submittedAt,
                        createdAt: schema.submissions.createdAt,
                        updatedAt: schema.submissions.updatedAt,
                    })
                    .from(schema.submissions)
                    .where(eq(schema.submissions.organizationId, organizationId))
                    .orderBy(asc(schema.submissions.id))
                    .limit(limit)
                    .offset(offset);
            case "submissionVersions":
                return this.db
                    .select({
                        id: schema.submissionVersions.id,
                        organizationId: schema.submissionVersions.organizationId,
                        submissionId: schema.submissionVersions.submissionId,
                        version: schema.submissionVersions.version,
                        title: schema.submissionVersions.title,
                        summary: schema.submissionVersions.summary,
                        descriptionMarkdown: schema.submissionVersions.descriptionMarkdown,
                        repositoryUrl: schema.submissionVersions.repositoryUrl,
                        demoUrl: schema.submissionVersions.demoUrl,
                        createdAt: schema.submissionVersions.createdAt,
                    })
                    .from(schema.submissionVersions)
                    .where(eq(schema.submissionVersions.organizationId, organizationId))
                    .orderBy(asc(schema.submissionVersions.id))
                    .limit(limit)
                    .offset(offset);
            case "submissionFiles":
                return this.db
                    .select({
                        id: schema.submissionFiles.id,
                        organizationId: schema.submissionFiles.organizationId,
                        projectId: schema.submissionFiles.projectId,
                        submissionId: schema.submissionFiles.submissionId,
                        versionId: schema.submissionFiles.versionId,
                        fileName: schema.submissionFiles.fileName,
                        contentType: schema.submissionFiles.contentType,
                        byteSize: schema.submissionFiles.byteSize,
                        checksumSha256: schema.submissionFiles.checksumSha256,
                        status: schema.submissionFiles.status,
                        createdAt: schema.submissionFiles.createdAt,
                    })
                    .from(schema.submissionFiles)
                    .where(eq(schema.submissionFiles.organizationId, organizationId))
                    .orderBy(asc(schema.submissionFiles.id))
                    .limit(limit)
                    .offset(offset);
            case "judgingRubrics":
                return this.db
                    .select({
                        id: schema.judgingRubrics.id,
                        organizationId: schema.judgingRubrics.organizationId,
                        editionId: schema.judgingRubrics.editionId,
                        name: schema.judgingRubrics.name,
                        description: schema.judgingRubrics.description,
                        createdAt: schema.judgingRubrics.createdAt,
                        updatedAt: schema.judgingRubrics.updatedAt,
                    })
                    .from(schema.judgingRubrics)
                    .where(eq(schema.judgingRubrics.organizationId, organizationId))
                    .orderBy(asc(schema.judgingRubrics.id))
                    .limit(limit)
                    .offset(offset);
            case "judgingCriteria":
                return this.db
                    .select({
                        id: schema.judgingCriteria.id,
                        organizationId: schema.judgingCriteria.organizationId,
                        rubricId: schema.judgingCriteria.rubricId,
                        name: schema.judgingCriteria.name,
                        description: schema.judgingCriteria.description,
                        maxScore: schema.judgingCriteria.maxScore,
                        weight: schema.judgingCriteria.weight,
                        position: schema.judgingCriteria.position,
                    })
                    .from(schema.judgingCriteria)
                    .where(eq(schema.judgingCriteria.organizationId, organizationId))
                    .orderBy(asc(schema.judgingCriteria.id))
                    .limit(limit)
                    .offset(offset);
            case "judgeAssignments":
                return this.db
                    .select({
                        id: schema.judgeAssignments.id,
                        organizationId: schema.judgeAssignments.organizationId,
                        editionId: schema.judgeAssignments.editionId,
                        rubricId: schema.judgeAssignments.rubricId,
                        submissionId: schema.judgeAssignments.submissionId,
                        status: schema.judgeAssignments.status,
                        dueAt: schema.judgeAssignments.dueAt,
                        assignedAt: schema.judgeAssignments.assignedAt,
                        updatedAt: schema.judgeAssignments.updatedAt,
                    })
                    .from(schema.judgeAssignments)
                    .where(eq(schema.judgeAssignments.organizationId, organizationId))
                    .orderBy(asc(schema.judgeAssignments.id))
                    .limit(limit)
                    .offset(offset);
            case "awards":
                return this.db
                    .select({
                        id: schema.awards.id,
                        organizationId: schema.awards.organizationId,
                        editionId: schema.awards.editionId,
                        namespace: schema.awards.namespace,
                        name: schema.awards.name,
                        description: schema.awards.description,
                        icon: schema.awards.icon,
                        color: schema.awards.color,
                        createdAt: schema.awards.createdAt,
                        updatedAt: schema.awards.updatedAt,
                    })
                    .from(schema.awards)
                    .where(eq(schema.awards.organizationId, organizationId))
                    .orderBy(asc(schema.awards.id))
                    .limit(limit)
                    .offset(offset);
            case "teamAwards":
                return this.db
                    .select({
                        id: schema.teamAwards.id,
                        organizationId: schema.teamAwards.organizationId,
                        editionId: schema.teamAwards.editionId,
                        teamId: schema.teamAwards.teamId,
                        awardId: schema.teamAwards.awardId,
                        note: schema.teamAwards.note,
                        assignedAt: schema.teamAwards.assignedAt,
                    })
                    .from(schema.teamAwards)
                    .where(eq(schema.teamAwards.organizationId, organizationId))
                    .orderBy(asc(schema.teamAwards.id))
                    .limit(limit)
                    .offset(offset);
            case "editionResults":
                return this.db
                    .select({
                        editionId: schema.editionResults.editionId,
                        organizationId: schema.editionResults.organizationId,
                        publishedAt: schema.editionResults.publishedAt,
                        snapshot: schema.editionResults.snapshot,
                    })
                    .from(schema.editionResults)
                    .where(eq(schema.editionResults.organizationId, organizationId))
                    .orderBy(asc(schema.editionResults.editionId))
                    .limit(limit)
                    .offset(offset);
            case "votingRounds":
                return this.db
                    .select({
                        id: schema.votingRounds.id,
                        organizationId: schema.votingRounds.organizationId,
                        editionId: schema.votingRounds.editionId,
                        name: schema.votingRounds.name,
                        description: schema.votingRounds.description,
                        status: schema.votingRounds.status,
                        eligibleRoles: schema.votingRounds.eligibleRoles,
                        maxSelections: schema.votingRounds.maxSelections,
                        opensAt: schema.votingRounds.opensAt,
                        closesAt: schema.votingRounds.closesAt,
                        publishedAt: schema.votingRounds.publishedAt,
                        createdAt: schema.votingRounds.createdAt,
                        updatedAt: schema.votingRounds.updatedAt,
                    })
                    .from(schema.votingRounds)
                    .where(eq(schema.votingRounds.organizationId, organizationId))
                    .orderBy(asc(schema.votingRounds.id))
                    .limit(limit)
                    .offset(offset);
            default:
                throw new Error(`Unsupported export section: ${String(section)}`);
        }
    }

    private async readJudgingAggregates(
        offset: number,
        limit: number,
    ): Promise<readonly ExportRow[]> {
        const organizationId = this.requireOrganization();
        const result = await this.db.execute(sql`
            select assignment.submission_id as "submissionId",
                   count(*)::int as "assignmentCount",
                   count(evaluation.id) filter (where evaluation.status = 'submitted')::int
                       as "submittedEvaluationCount",
                   avg(evaluation.weighted_score) filter (where evaluation.status = 'submitted')::float8
                       as "averageWeightedScore"
            from judge_assignments assignment
            left join evaluations evaluation
                on evaluation.assignment_id = assignment.id
               and evaluation.organization_id = assignment.organization_id
            where assignment.organization_id = ${organizationId}
            group by assignment.submission_id
            order by assignment.submission_id
            limit ${limit} offset ${offset}
        `);
        return result.rows as ExportRow[];
    }

    private async readVoteTotals(offset: number, limit: number): Promise<readonly ExportRow[]> {
        const organizationId = this.requireOrganization();
        const result = await this.db.execute(sql`
            select round_id as "roundId",
                   submission_id as "submissionId",
                   count(*)::int as "voteCount",
                   sum(stars)::int as "totalStars",
                   avg(stars)::float8 as "averageStars"
            from votes
            where organization_id = ${organizationId}
            group by round_id, submission_id
            order by round_id, submission_id
            limit ${limit} offset ${offset}
        `);
        return result.rows as ExportRow[];
    }

    private requireOrganization(): string {
        if (this.currentOrganizationId === null) {
            throw new Error("The export snapshot has no organization context.");
        }
        return this.currentOrganizationId;
    }
}
