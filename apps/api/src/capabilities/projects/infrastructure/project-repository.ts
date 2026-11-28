import { and, desc, eq, exists, inArray, isNotNull, lt, or, sql, type SQL } from "drizzle-orm";
import type { ProjectStatus, TeamStatus } from "@nethack/contracts";
import type { DatabaseExecutor, DatabaseSession } from "../../../infrastructure/database/client.js";
import {
    competitionEditions,
    divisions,
    organizations,
    projectMembers,
    projects,
    teamMembers,
    teams,
    users,
} from "../../../infrastructure/database/schema/index.js";

const PUBLIC_EDITION_STATUSES = [
    "published",
    "registration_open",
    "registration_closed",
    "active",
    "judging",
    "voting",
    "completed",
    "archived",
] as const;

export type ProjectRow = typeof projects.$inferSelect;

export interface ProjectMemberView {
    readonly userId: string;
    readonly displayName: string;
    readonly avatarUrl: string | null;
    readonly role: "owner" | "member";
}

export interface PublicProjectRow {
    readonly id: string;
    readonly organizationId: string;
    readonly title: string;
    readonly slug: string;
    readonly summary: string;
    readonly descriptionMarkdown: string;
    readonly repositoryUrl: string | null;
    readonly demoUrl: string | null;
    readonly videoUrl: string | null;
    readonly aiDisclosure: string;
    readonly tags: readonly string[];
    readonly publishedAt: Date | null;
    readonly teamId: string | null;
    readonly teamName: string | null;
    readonly teamStatus: TeamStatus | null;
    readonly divisionName: string | null;
    readonly organizationName: string;
    readonly competitionName: string;
    readonly competitionSlug: string;
    readonly createdAt: Date;
}

interface Cursor {
    readonly createdAt: Date;
    readonly id: string;
}

export class ProjectRepository {
    async insert(
        session: DatabaseSession,
        values: {
            id: string;
            organizationId: string;
            editionId: string;
            teamId: string | null;
            ownerUserId: string;
            title: string;
            slug: string;
            summary: string;
            descriptionMarkdown: string;
            repositoryUrl: string | null;
            demoUrl: string | null;
            videoUrl: string | null;
            aiDisclosure: string;
            tags: readonly string[];
        },
    ): Promise<ProjectRow> {
        const [row] = await session.db
            .insert(projects)
            .values({ ...values, tags: [...values.tags] })
            .returning();
        if (row === undefined) {
            throw new Error("The project could not be created.");
        }
        return row;
    }

    async findById(
        db: DatabaseExecutor,
        organizationId: string,
        projectId: string,
    ): Promise<ProjectRow | null> {
        const rows = await db
            .select()
            .from(projects)
            .where(and(eq(projects.organizationId, organizationId), eq(projects.id, projectId)))
            .limit(1);
        return rows[0] ?? null;
    }

    async memberRole(
        db: DatabaseExecutor,
        organizationId: string,
        projectId: string,
        userId: string,
    ): Promise<"owner" | "member" | null> {
        const rows = await db
            .select({ role: projectMembers.role })
            .from(projectMembers)
            .where(
                and(
                    eq(projectMembers.organizationId, organizationId),
                    eq(projectMembers.projectId, projectId),
                    eq(projectMembers.userId, userId),
                ),
            )
            .limit(1);
        return rows[0]?.role ?? null;
    }

    async isMemberOrOwner(
        db: DatabaseExecutor,
        organizationId: string,
        projectId: string,
        userId: string,
    ): Promise<boolean> {
        const rows = await db
            .select({ ownerUserId: projects.ownerUserId })
            .from(projects)
            .where(and(eq(projects.organizationId, organizationId), eq(projects.id, projectId)))
            .limit(1);
        const project = rows[0];
        if (project === undefined) {
            return false;
        }
        if (project.ownerUserId === userId) {
            return true;
        }
        return (await this.memberRole(db, organizationId, projectId, userId)) !== null;
    }

    async addMember(
        session: DatabaseSession,
        values: {
            organizationId: string;
            projectId: string;
            userId: string;
            role: "owner" | "member";
        },
    ): Promise<void> {
        await session.db.insert(projectMembers).values(values);
    }

    async listVisible(
        db: DatabaseExecutor,
        options: {
            organizationId: string;
            userId: string;
            editionId: string | null;
            teamId: string | null;
            mine: boolean;
            includeAll: boolean;
            cursor: Cursor | null;
            limit: number;
        },
    ): Promise<readonly ProjectRow[]> {
        const conditions: SQL[] = [eq(projects.organizationId, options.organizationId)];
        if (options.editionId !== null) {
            conditions.push(eq(projects.editionId, options.editionId));
        }
        if (options.teamId !== null) {
            conditions.push(eq(projects.teamId, options.teamId));
        }
        if (!options.includeAll || options.mine) {
            const projectMember = exists(
                db
                    .select({ one: sql`1` })
                    .from(projectMembers)
                    .where(
                        and(
                            eq(projectMembers.projectId, projects.id),
                            eq(projectMembers.userId, options.userId),
                        ),
                    ),
            );
            const teamMember = exists(
                db
                    .select({ one: sql`1` })
                    .from(teamMembers)
                    .where(
                        and(
                            eq(teamMembers.teamId, projects.teamId),
                            eq(teamMembers.userId, options.userId),
                        ),
                    ),
            );
            conditions.push(
                or(
                    eq(projects.ownerUserId, options.userId),
                    projectMember,
                    and(isNotNull(projects.teamId), teamMember),
                ) ?? sql`false`,
            );
        }
        if (options.cursor !== null) {
            conditions.push(
                or(
                    lt(projects.createdAt, options.cursor.createdAt),
                    and(
                        eq(projects.createdAt, options.cursor.createdAt),
                        lt(projects.id, options.cursor.id),
                    ),
                ) ?? sql`false`,
            );
        }
        return db
            .select()
            .from(projects)
            .where(and(...conditions))
            .orderBy(desc(projects.createdAt), desc(projects.id))
            .limit(options.limit);
    }

    async update(
        session: DatabaseSession,
        organizationId: string,
        projectId: string,
        values: {
            title?: string;
            summary?: string;
            descriptionMarkdown?: string;
            repositoryUrl?: string | null;
            demoUrl?: string | null;
            videoUrl?: string | null;
            aiDisclosure?: string;
            tags?: readonly string[];
            teamId?: string | null;
            status?: ProjectStatus;
            publishedAt?: Date | null;
            updatedAt: Date;
        },
    ): Promise<ProjectRow> {
        const { tags, ...rest } = values;
        const [row] = await session.db
            .update(projects)
            .set(tags === undefined ? rest : { ...rest, tags: [...tags] })
            .where(and(eq(projects.organizationId, organizationId), eq(projects.id, projectId)))
            .returning();
        if (row === undefined) {
            throw new Error("The project could not be updated.");
        }
        return row;
    }

    async listMembers(
        db: DatabaseExecutor,
        organizationId: string,
        projectId: string,
    ): Promise<readonly ProjectMemberView[]> {
        return db
            .select({
                userId: projectMembers.userId,
                displayName: users.displayName,
                avatarUrl: users.avatarUrl,
                role: projectMembers.role,
            })
            .from(projectMembers)
            .innerJoin(users, eq(users.id, projectMembers.userId))
            .where(
                and(
                    eq(projectMembers.organizationId, organizationId),
                    eq(projectMembers.projectId, projectId),
                ),
            )
            .orderBy(projectMembers.createdAt);
    }

    async findUserByEmail(
        db: DatabaseExecutor,
        email: string,
    ): Promise<{ id: string; displayName: string; avatarUrl: string | null } | null> {
        const rows = await db
            .select({ id: users.id, displayName: users.displayName, avatarUrl: users.avatarUrl })
            .from(users)
            .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
            .limit(1);
        return rows[0] ?? null;
    }

    async listTeamProjects(
        db: DatabaseExecutor,
        organizationId: string,
        teamId: string,
    ): Promise<readonly ProjectRow[]> {
        return db
            .select()
            .from(projects)
            .where(and(eq(projects.organizationId, organizationId), eq(projects.teamId, teamId)))
            .orderBy(desc(projects.createdAt), desc(projects.id));
    }

    async countByEdition(
        db: DatabaseExecutor,
        organizationId: string,
        editionId: string,
    ): Promise<number> {
        const rows = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(projects)
            .where(
                and(eq(projects.organizationId, organizationId), eq(projects.editionId, editionId)),
            );
        return rows[0]?.count ?? 0;
    }

    async publicList(
        db: DatabaseExecutor,
        options: {
            competitionSlug: string | null;
            cursor: Cursor | null;
            limit: number;
        },
    ): Promise<readonly PublicProjectRow[]> {
        const conditions: SQL[] = [
            eq(projects.status, "published"),
            isNotNull(projects.publishedAt),
            inArray(competitionEditions.status, [...PUBLIC_EDITION_STATUSES]),
        ];
        if (options.competitionSlug !== null) {
            conditions.push(eq(competitionEditions.slug, options.competitionSlug));
        }
        if (options.cursor !== null) {
            conditions.push(
                or(
                    lt(projects.createdAt, options.cursor.createdAt),
                    and(
                        eq(projects.createdAt, options.cursor.createdAt),
                        lt(projects.id, options.cursor.id),
                    ),
                ) ?? sql`false`,
            );
        }
        return db
            .select({
                id: projects.id,
                organizationId: projects.organizationId,
                title: projects.title,
                slug: projects.slug,
                summary: projects.summary,
                descriptionMarkdown: projects.descriptionMarkdown,
                repositoryUrl: projects.repositoryUrl,
                demoUrl: projects.demoUrl,
                videoUrl: projects.videoUrl,
                aiDisclosure: projects.aiDisclosure,
                tags: projects.tags,
                publishedAt: projects.publishedAt,
                teamId: teams.id,
                teamName: teams.name,
                teamStatus: teams.status,
                divisionName: divisions.name,
                organizationName: organizations.name,
                competitionName: competitionEditions.name,
                competitionSlug: competitionEditions.slug,
                createdAt: projects.createdAt,
            })
            .from(projects)
            .innerJoin(
                competitionEditions,
                and(
                    eq(competitionEditions.id, projects.editionId),
                    eq(competitionEditions.organizationId, projects.organizationId),
                ),
            )
            .innerJoin(organizations, eq(organizations.id, projects.organizationId))
            .leftJoin(
                teams,
                and(
                    eq(teams.id, projects.teamId),
                    eq(teams.organizationId, projects.organizationId),
                ),
            )
            .leftJoin(
                divisions,
                and(
                    eq(divisions.id, teams.divisionId),
                    eq(divisions.organizationId, teams.organizationId),
                ),
            )
            .where(and(...conditions))
            .orderBy(desc(projects.createdAt), desc(projects.id))
            .limit(options.limit);
    }

    async publicBySlug(db: DatabaseExecutor, slug: string): Promise<PublicProjectRow | null> {
        const rows = await db
            .select({
                id: projects.id,
                organizationId: projects.organizationId,
                title: projects.title,
                slug: projects.slug,
                summary: projects.summary,
                descriptionMarkdown: projects.descriptionMarkdown,
                repositoryUrl: projects.repositoryUrl,
                demoUrl: projects.demoUrl,
                videoUrl: projects.videoUrl,
                aiDisclosure: projects.aiDisclosure,
                tags: projects.tags,
                publishedAt: projects.publishedAt,
                teamId: teams.id,
                teamName: teams.name,
                teamStatus: teams.status,
                divisionName: divisions.name,
                organizationName: organizations.name,
                competitionName: competitionEditions.name,
                competitionSlug: competitionEditions.slug,
                createdAt: projects.createdAt,
            })
            .from(projects)
            .innerJoin(
                competitionEditions,
                and(
                    eq(competitionEditions.id, projects.editionId),
                    eq(competitionEditions.organizationId, projects.organizationId),
                ),
            )
            .innerJoin(organizations, eq(organizations.id, projects.organizationId))
            .leftJoin(
                teams,
                and(
                    eq(teams.id, projects.teamId),
                    eq(teams.organizationId, projects.organizationId),
                ),
            )
            .leftJoin(
                divisions,
                and(
                    eq(divisions.id, teams.divisionId),
                    eq(divisions.organizationId, teams.organizationId),
                ),
            )
            .where(
                and(
                    eq(projects.slug, slug),
                    eq(projects.status, "published"),
                    isNotNull(projects.publishedAt),
                    inArray(competitionEditions.status, [...PUBLIC_EDITION_STATUSES]),
                ),
            )
            .orderBy(desc(projects.publishedAt), desc(projects.createdAt))
            .limit(1);
        return rows[0] ?? null;
    }

    async publicMembers(
        db: DatabaseExecutor,
        projectIds: readonly string[],
    ): Promise<Map<string, string[]>> {
        const members = new Map<string, string[]>();
        if (projectIds.length === 0) {
            return members;
        }
        const rows = await db
            .select({
                projectId: projectMembers.projectId,
                displayName: users.displayName,
            })
            .from(projectMembers)
            .innerJoin(users, eq(users.id, projectMembers.userId))
            .where(inArray(projectMembers.projectId, [...projectIds]))
            .orderBy(projectMembers.createdAt);
        for (const row of rows) {
            const existing = members.get(row.projectId);
            if (existing === undefined) {
                members.set(row.projectId, [row.displayName]);
            } else {
                existing.push(row.displayName);
            }
        }
        return members;
    }
}
