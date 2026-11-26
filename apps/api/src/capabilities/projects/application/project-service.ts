import { randomUUID } from "node:crypto";
import type {
    CreateProjectRequest,
    OrganizationRole,
    Project,
    ProjectDetail,
    ProjectMember,
    PublicProject,
    UpdateProjectRequest,
} from "@nethack/contracts";
import type { AuthContext } from "../../../authentication/types.js";
import type { Clock } from "../../../core/clock.js";
import type { DatabaseConnection } from "../../../infrastructure/database/client.js";
import type { OutboxPublisher } from "../../../core/outbox.js";
import {
    ConflictError,
    ForbiddenError,
    isUniqueViolationError as isUniqueViolation,
    NotFoundError,
    ValidationError,
} from "../../../core/errors.js";
import { domainEvents } from "../../../core/domain-event.js";
import type { AuditLogger } from "../../../infrastructure/audit/audit-logger.js";
import type { CompetitionsContract, EditionSummary } from "../../competitions/contracts.js";
import type { OrganizationsContract } from "../../organizations/contracts.js";
import type { ParticipantsContract } from "../../participants/contracts.js";
import type { TeamSummary, TeamsContract } from "../../teams/contracts.js";
import type { ProjectSummary } from "../contracts.js";
import { filterShowcasedProjects, ProjectRules } from "../domain/project-rules.js";
import type {
    ProjectMemberView,
    ProjectRepository,
    ProjectRow,
    PublicProjectRow,
} from "../infrastructure/project-repository.js";

export interface ProjectContracts {
    readonly competitions: CompetitionsContract;
    readonly organizations: OrganizationsContract;
    readonly participants: ParticipantsContract;
    readonly teams: TeamsContract;
}

export interface ProjectCursor {
    readonly createdAt: Date;
    readonly id: string;
}

export interface PublicProjectEntry {
    readonly project: PublicProject;
    readonly createdAt: Date;
    readonly id: string;
}

export class ProjectService {
    private readonly database: DatabaseConnection;
    private readonly repository: ProjectRepository;
    private readonly contracts: ProjectContracts;
    private readonly events: OutboxPublisher;
    private readonly audit: AuditLogger;
    private readonly clock: Clock;

    constructor(
        database: DatabaseConnection,
        repository: ProjectRepository,
        contracts: ProjectContracts,
        events: OutboxPublisher,
        audit: AuditLogger,
        clock: Clock,
    ) {
        this.database = database;
        this.repository = repository;
        this.contracts = contracts;
        this.events = events;
        this.audit = audit;
        this.clock = clock;
    }

    async list(
        auth: AuthContext,
        organizationId: string,
        role: OrganizationRole,
        options: {
            editionId: string | null;
            teamId: string | null;
            mine: boolean;
            cursor: ProjectCursor | null;
            limit: number;
        },
    ): Promise<readonly Project[]> {
        const includeAll = !options.mine && ProjectRules.isOrganizer(role);
        const rows = await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) =>
                this.repository.listVisible(session.db, {
                    organizationId,
                    userId: auth.user.id,
                    editionId: options.editionId,
                    teamId: options.teamId,
                    mine: options.mine,
                    includeAll,
                    cursor: options.cursor,
                    limit: options.limit,
                }),
        );
        return rows.map(toProject);
    }

    async create(
        auth: AuthContext,
        organizationId: string,
        role: OrganizationRole,
        input: CreateProjectRequest,
        ip: string | null,
    ): Promise<Project> {
        const edition = await this.contracts.competitions.getEdition(
            organizationId,
            input.editionId,
        );
        if (edition === null) {
            throw new ValidationError("The competition edition was not found.");
        }
        const approved = await this.contracts.participants.isApprovedParticipant(
            organizationId,
            input.editionId,
            auth.user.id,
        );
        if (!approved) {
            throw new ForbiddenError(
                "An approved participant registration is required to create a project.",
            );
        }
        if (input.teamId !== null) {
            await this.assertTeamEligible(
                organizationId,
                input.editionId,
                input.teamId,
                auth.user.id,
                !ProjectRules.isOrganizer(role),
            );
        }

        for (let attempt = 0; attempt < 3; attempt += 1) {
            const projectId = randomUUID();
            const slug = ProjectRules.buildSlug(input.title);
            try {
                const created = await this.database.transaction(
                    { organizationId, userId: auth.user.id },
                    async (session) => {
                        const row = await this.repository.insert(session, {
                            id: projectId,
                            organizationId,
                            editionId: input.editionId,
                            teamId: input.teamId,
                            ownerUserId: auth.user.id,
                            title: input.title,
                            slug,
                            summary: input.summary,
                            descriptionMarkdown: input.descriptionMarkdown,
                            repositoryUrl: input.repositoryUrl,
                            demoUrl: input.demoUrl,
                            tags: input.tags,
                        });
                        await this.repository.addMember(session, {
                            organizationId,
                            projectId: row.id,
                            userId: auth.user.id,
                            role: "owner",
                        });
                        await this.audit.record(session, {
                            organizationId,
                            actorUserId: auth.user.id,
                            action: "project.created",
                            entityType: "project",
                            entityId: row.id,
                            metadata: { editionId: input.editionId, slug: row.slug },
                            ip,
                        });
                        return row;
                    },
                );
                return toProject(created);
            } catch (error) {
                if (!isUniqueViolation(error)) {
                    throw error;
                }
            }
        }
        throw new ConflictError(
            "A project with a similar title already exists. Try a different title.",
        );
    }

    async detail(
        auth: AuthContext,
        organizationId: string,
        role: OrganizationRole,
        projectId: string,
    ): Promise<ProjectDetail> {
        const loaded = await this.load(organizationId, projectId, auth.user.id);
        const teamMember =
            loaded.project.teamId === null
                ? false
                : await this.contracts.teams.isTeamMember(
                      organizationId,
                      loaded.project.teamId,
                      auth.user.id,
                  );
        if (
            !ProjectRules.canView(loaded.project, auth.user.id, role, loaded.memberRole, teamMember)
        ) {
            throw new NotFoundError("The project was not found.");
        }
        const team =
            loaded.project.teamId === null
                ? null
                : await this.contracts.teams.getTeam(organizationId, loaded.project.teamId);
        const members = await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => this.repository.listMembers(session.db, organizationId, projectId),
        );
        return {
            ...toProject(loaded.project),
            teamName: team?.name ?? null,
            members: members.map(toMember),
            // Submission data is owned by the submissions capability.
            submissions: [],
        };
    }

    async update(
        auth: AuthContext,
        organizationId: string,
        role: OrganizationRole,
        projectId: string,
        input: UpdateProjectRequest,
        ip: string | null,
    ): Promise<Project> {
        if (Object.keys(input).length === 0) {
            throw new ValidationError("Provide at least one field to update.");
        }
        const loaded = await this.load(organizationId, projectId, auth.user.id);
        ProjectRules.assertCanEdit(loaded.project, auth.user.id, role, loaded.memberRole);
        if (input.teamId !== undefined && input.teamId !== null) {
            await this.assertTeamEligible(
                organizationId,
                loaded.project.editionId,
                input.teamId,
                auth.user.id,
                !ProjectRules.isOrganizer(role),
            );
        }
        const updated = await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const current = await this.repository.findById(
                    session.db,
                    organizationId,
                    projectId,
                );
                if (current === null) {
                    throw new NotFoundError("The project was not found.");
                }
                const memberRole = await this.repository.memberRole(
                    session.db,
                    organizationId,
                    projectId,
                    auth.user.id,
                );
                ProjectRules.assertCanEdit(current, auth.user.id, role, memberRole);
                const row = await this.repository.update(session, organizationId, projectId, {
                    ...(input.title === undefined ? {} : { title: input.title }),
                    ...(input.summary === undefined ? {} : { summary: input.summary }),
                    ...(input.descriptionMarkdown === undefined
                        ? {}
                        : { descriptionMarkdown: input.descriptionMarkdown }),
                    ...(input.repositoryUrl === undefined
                        ? {}
                        : { repositoryUrl: input.repositoryUrl }),
                    ...(input.demoUrl === undefined ? {} : { demoUrl: input.demoUrl }),
                    ...(input.tags === undefined ? {} : { tags: input.tags }),
                    ...(input.teamId === undefined ? {} : { teamId: input.teamId }),
                    updatedAt: this.clock.now(),
                });
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "project.updated",
                    entityType: "project",
                    entityId: projectId,
                    metadata: { fields: Object.keys(input) },
                    ip,
                });
                return row;
            },
        );
        return toProject(updated);
    }

    async publish(
        auth: AuthContext,
        organizationId: string,
        role: OrganizationRole,
        projectId: string,
        ip: string | null,
    ): Promise<Project> {
        const loaded = await this.load(organizationId, projectId, auth.user.id);
        ProjectRules.assertCanPublish(loaded.project, auth.user.id, role, loaded.memberRole);
        if (loaded.project.status === "published" && loaded.project.publishedAt !== null) {
            return toProject(loaded.project);
        }
        const edition: EditionSummary | null = await this.contracts.competitions.getEdition(
            organizationId,
            loaded.project.editionId,
        );
        if (edition === null) {
            throw new NotFoundError("The competition edition was not found.");
        }
        ProjectRules.assertEditionAllowsPublishing(edition.status);
        ProjectRules.assertPublishableContent(loaded.project.title, loaded.project.summary);
        const now = this.clock.now();
        const published = await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const current = await this.repository.findById(
                    session.db,
                    organizationId,
                    projectId,
                );
                if (current === null) {
                    throw new NotFoundError("The project was not found.");
                }
                const memberRole = await this.repository.memberRole(
                    session.db,
                    organizationId,
                    projectId,
                    auth.user.id,
                );
                ProjectRules.assertCanPublish(current, auth.user.id, role, memberRole);
                const row = await this.repository.update(session, organizationId, projectId, {
                    status: "published",
                    publishedAt: now,
                    updatedAt: now,
                });
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "project.published",
                    entityType: "project",
                    entityId: projectId,
                    metadata: { slug: row.slug, editionId: row.editionId },
                    ip,
                });
                await this.events.publish(session, {
                    type: domainEvents.projectPublished,
                    organizationId,
                    aggregateType: "project",
                    aggregateId: projectId,
                    payload: {
                        projectId,
                        title: row.title,
                        organizationId,
                        editionId: row.editionId,
                        ownerUserId: row.ownerUserId,
                    },
                });
                return row;
            },
        );
        return toProject(published);
    }

    async members(
        auth: AuthContext,
        organizationId: string,
        role: OrganizationRole,
        projectId: string,
    ): Promise<readonly ProjectMember[]> {
        const loaded = await this.load(organizationId, projectId, auth.user.id);
        const teamMember =
            loaded.project.teamId === null
                ? false
                : await this.contracts.teams.isTeamMember(
                      organizationId,
                      loaded.project.teamId,
                      auth.user.id,
                  );
        if (
            !ProjectRules.canView(loaded.project, auth.user.id, role, loaded.memberRole, teamMember)
        ) {
            throw new NotFoundError("The project was not found.");
        }
        const rows = await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => this.repository.listMembers(session.db, organizationId, projectId),
        );
        return rows.map(toMember);
    }

    async addMember(
        auth: AuthContext,
        organizationId: string,
        role: OrganizationRole,
        projectId: string,
        email: string,
        ip: string | null,
    ): Promise<ProjectMember> {
        const loaded = await this.load(organizationId, projectId, auth.user.id);
        ProjectRules.assertCanManageMembers(loaded.project, auth.user.id, role, loaded.memberRole);
        const user = await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => this.repository.findUserByEmail(session.db, email),
        );
        if (user === null) {
            throw new NotFoundError("No account exists with that email address.");
        }
        const existing = await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) =>
                this.repository.memberRole(session.db, organizationId, projectId, user.id),
        );
        if (existing !== null) {
            throw new ConflictError("That person is already a member of this project.");
        }
        const approved = await this.contracts.participants.isApprovedParticipant(
            organizationId,
            loaded.project.editionId,
            user.id,
        );
        const inTeam =
            loaded.project.teamId !== null &&
            (await this.contracts.teams.isTeamMember(
                organizationId,
                loaded.project.teamId,
                user.id,
            ));
        if (!approved && !inTeam) {
            throw new ValidationError(
                "That person is not an approved participant or team member for this edition.",
            );
        }
        try {
            await this.database.transaction(
                { organizationId, userId: auth.user.id },
                async (session) => {
                    await this.repository.addMember(session, {
                        organizationId,
                        projectId,
                        userId: user.id,
                        role: "member",
                    });
                    await this.audit.record(session, {
                        organizationId,
                        actorUserId: auth.user.id,
                        action: "project.member.added",
                        entityType: "project_member",
                        entityId: user.id,
                        metadata: { projectId },
                        ip,
                    });
                },
            );
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new ConflictError("That person is already a member of this project.");
            }
            throw error;
        }
        return { userId: user.id, displayName: user.displayName, role: "member" };
    }

    async listPublic(
        competitionSlug: string | null,
        cursor: ProjectCursor | null,
        limit: number,
    ): Promise<readonly PublicProjectEntry[]> {
        const showcaseEnabled = new Map<string, boolean>();
        const visible: PublicProjectRow[] = [];
        let pageCursor = cursor;
        while (visible.length < limit) {
            const remaining = limit - visible.length;
            const batch = await this.repository.publicList(this.database.db, {
                competitionSlug,
                cursor: pageCursor,
                limit: remaining,
            });
            if (batch.length === 0) {
                break;
            }
            await this.loadShowcaseFlags(batch, showcaseEnabled);
            visible.push(...filterShowcasedProjects(batch, showcaseEnabled));
            const last = batch[batch.length - 1];
            if (last === undefined || batch.length < remaining) {
                break;
            }
            pageCursor = { createdAt: last.createdAt, id: last.id };
        }
        const members = await this.repository.publicMembers(
            this.database.db,
            visible.map((row) => row.id),
        );
        return visible.map((row) => ({
            project: toPublicProject(row, members.get(row.id) ?? []),
            createdAt: row.createdAt,
            id: row.id,
        }));
    }

    async getPublic(slug: string): Promise<PublicProject> {
        const row = await this.repository.publicBySlug(this.database.db, slug);
        if (row === null) {
            throw new NotFoundError("The project was not found.");
        }
        if (!(await this.contracts.organizations.isPublicShowcaseEnabled(row.organizationId))) {
            throw new NotFoundError("The project was not found.");
        }
        const members = await this.repository.publicMembers(this.database.db, [row.id]);
        return toPublicProject(row, members.get(row.id) ?? []);
    }

    private async loadShowcaseFlags(
        rows: readonly { readonly organizationId: string }[],
        cache: Map<string, boolean>,
    ): Promise<void> {
        const missing = new Set<string>();
        for (const row of rows) {
            if (!cache.has(row.organizationId)) {
                missing.add(row.organizationId);
            }
        }
        for (const organizationId of missing) {
            cache.set(
                organizationId,
                await this.contracts.organizations.isPublicShowcaseEnabled(organizationId),
            );
        }
    }

    private async load(
        organizationId: string,
        projectId: string,
        userId: string,
    ): Promise<{ project: ProjectRow; memberRole: "owner" | "member" | null }> {
        return this.database.transaction({ organizationId, userId }, async (session) => {
            const project = await this.repository.findById(session.db, organizationId, projectId);
            if (project === null) {
                throw new NotFoundError("The project was not found.");
            }
            const memberRole = await this.repository.memberRole(
                session.db,
                organizationId,
                projectId,
                userId,
            );
            return { project, memberRole };
        });
    }

    private async assertTeamEligible(
        organizationId: string,
        editionId: string,
        teamId: string,
        userId: string,
        requireMembership: boolean,
    ): Promise<TeamSummary> {
        const team = await this.contracts.teams.getTeam(organizationId, teamId);
        if (team === null) {
            throw new ValidationError("The team was not found.");
        }
        if (team.editionId !== editionId) {
            throw new ValidationError("The team does not belong to this edition.");
        }
        if (
            requireMembership &&
            !(await this.contracts.teams.isTeamMember(organizationId, teamId, userId))
        ) {
            throw new ForbiddenError("You must be a member of that team to link it to a project.");
        }
        return team;
    }
}

export function toProject(row: ProjectRow): Project {
    return {
        id: row.id,
        organizationId: row.organizationId,
        editionId: row.editionId,
        teamId: row.teamId,
        ownerUserId: row.ownerUserId,
        title: row.title,
        slug: row.slug,
        summary: row.summary,
        descriptionMarkdown: row.descriptionMarkdown,
        repositoryUrl: row.repositoryUrl,
        demoUrl: row.demoUrl,
        tags: [...row.tags],
        status: row.status,
        publishedAt: row.publishedAt === null ? null : row.publishedAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    };
}

export function toProjectSummary(row: ProjectRow): ProjectSummary {
    return {
        id: row.id,
        organizationId: row.organizationId,
        editionId: row.editionId,
        teamId: row.teamId,
        ownerUserId: row.ownerUserId,
        title: row.title,
        slug: row.slug,
        summary: row.summary,
        descriptionMarkdown: row.descriptionMarkdown,
        repositoryUrl: row.repositoryUrl,
        demoUrl: row.demoUrl,
        tags: [...row.tags],
        status: row.status,
        publishedAt: row.publishedAt === null ? null : row.publishedAt.toISOString(),
    };
}

function toMember(row: ProjectMemberView): ProjectMember {
    return { userId: row.userId, displayName: row.displayName, role: row.role };
}

function toPublicProject(row: PublicProjectRow, members: readonly string[]): PublicProject {
    return {
        id: row.id,
        title: row.title,
        slug: row.slug,
        summary: row.summary,
        descriptionMarkdown: row.descriptionMarkdown,
        repositoryUrl: row.repositoryUrl,
        demoUrl: row.demoUrl,
        tags: [...row.tags],
        publishedAt: row.publishedAt === null ? null : row.publishedAt.toISOString(),
        teamName: row.teamName,
        organizationName: row.organizationName,
        competitionName: row.competitionName,
        competitionSlug: row.competitionSlug,
        members: members.map((displayName) => ({ displayName })),
    };
}
