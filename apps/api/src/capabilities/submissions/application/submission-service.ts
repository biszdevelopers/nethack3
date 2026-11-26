import type {
    CreateSubmissionRequest,
    CreateSubmissionVersionRequest,
    OrganizationRole,
    ReviewSubmissionRequest,
    Submission,
    SubmissionDetail,
    SubmissionFile,
    SubmissionVersion,
} from "@nethack/contracts";
import type { AuthContext } from "../../../authentication/types.js";
import type { Clock } from "../../../core/clock.js";
import { domainEvents } from "../../../core/domain-event.js";
import { ConflictError, ForbiddenError, NotFoundError } from "../../../core/errors.js";
import type { OutboxPublisher } from "../../../core/outbox.js";
import type { DatabaseConnection } from "../../../infrastructure/database/client.js";
import type { AuditLogger } from "../../../infrastructure/audit/audit-logger.js";
import type { CompetitionsContract } from "../../competitions/contracts.js";
import type { FilesContract } from "../../files/contracts.js";
import type { OrganizationsContract } from "../../organizations/contracts.js";
import type { ProjectSummary, ProjectsContract } from "../../projects/contracts.js";
import type { TeamSummary, TeamsContract } from "../../teams/contracts.js";
import type { SubmissionSummary } from "../contracts.js";
import { SubmissionRules } from "../domain/submission-rules.js";
import type {
    SubmissionFileRow,
    SubmissionRepository,
    SubmissionRow,
    SubmissionVersionRow,
    SubmissionWithVersionRow,
} from "../infrastructure/submission-repository.js";

const LIST_SCAN_BATCH = 50;

export interface SubmissionContracts {
    readonly projects: ProjectsContract;
    readonly teams: TeamsContract;
    readonly competitions: CompetitionsContract;
    readonly files: FilesContract;
    readonly organizations: OrganizationsContract;
}

export interface SubmissionListOptions {
    readonly editionId: string | null;
    readonly projectId: string | null;
    readonly mine: boolean;
    readonly cursor: { readonly createdAt: Date; readonly id: string } | null;
    readonly limit: number;
}

export class SubmissionService {
    private readonly database: DatabaseConnection;
    private readonly repository: SubmissionRepository;
    private readonly contracts: SubmissionContracts;
    private readonly events: OutboxPublisher;
    private readonly audit: AuditLogger;
    private readonly clock: Clock;

    constructor(
        database: DatabaseConnection,
        repository: SubmissionRepository,
        contracts: SubmissionContracts,
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
        options: SubmissionListOptions,
    ): Promise<readonly Submission[]> {
        if (SubmissionRules.isOrganizer(role) && !options.mine) {
            const rows = await this.database.transaction(
                { organizationId, userId: auth.user.id },
                async (session) =>
                    this.repository.list(session.db, {
                        organizationId,
                        editionId: options.editionId,
                        projectId: options.projectId,
                        cursor: options.cursor,
                        limit: options.limit,
                    }),
            );
            const resolver = new DisplayResolver(this.contracts);
            return Promise.all(
                rows.map((row) => this.toSubmissionView(organizationId, row, resolver)),
            );
        }

        // Participants only see submissions they can reach through a project or team.
        // Visibility lives in other capabilities, so rows are scanned in cursor order
        // and filtered here instead of joining foreign tables.
        const team =
            options.editionId === null
                ? null
                : await this.contracts.teams.getTeamForUser(
                      organizationId,
                      options.editionId,
                      auth.user.id,
                  );
        const teamId = team?.id ?? null;
        const resolver = new DisplayResolver(this.contracts);
        const collected: SubmissionWithVersionRow[] = [];
        let cursor = options.cursor;
        while (collected.length < options.limit) {
            const batch = await this.database.transaction(
                { organizationId, userId: auth.user.id },
                async (session) =>
                    this.repository.list(session.db, {
                        organizationId,
                        editionId: options.editionId,
                        projectId: options.projectId,
                        cursor,
                        limit: LIST_SCAN_BATCH,
                    }),
            );
            if (batch.length === 0) {
                break;
            }
            for (const row of batch) {
                if (
                    await this.canViewRow(
                        organizationId,
                        auth.user.id,
                        teamId,
                        row.submission,
                        resolver,
                    )
                ) {
                    collected.push(row);
                    if (collected.length >= options.limit) {
                        break;
                    }
                }
            }
            if (collected.length >= options.limit) {
                break;
            }
            const last = batch[batch.length - 1];
            if (last === undefined || batch.length < LIST_SCAN_BATCH) {
                break;
            }
            cursor = { createdAt: last.submission.createdAt, id: last.submission.id };
        }
        return Promise.all(
            collected.map((row) => this.toSubmissionView(organizationId, row, resolver)),
        );
    }

    async create(
        auth: AuthContext,
        organizationId: string,
        role: OrganizationRole,
        input: CreateSubmissionRequest,
        ip: string | null,
    ): Promise<Submission> {
        const project = await this.requireManagedProject(
            organizationId,
            role,
            auth.user.id,
            input.projectId,
        );
        const now = this.clock.now();
        try {
            const row = await this.database.transaction(
                { organizationId, userId: auth.user.id },
                async (session) => {
                    const existing = await this.repository.findByProjectId(
                        session.db,
                        organizationId,
                        project.id,
                    );
                    if (existing !== null) {
                        throw new ConflictError("A submission already exists for this project.");
                    }
                    const created = await this.repository.insert(session, {
                        organizationId,
                        editionId: project.editionId,
                        projectId: project.id,
                        teamId: project.teamId,
                        status: "draft",
                        createdAt: now,
                        updatedAt: now,
                    });
                    await this.audit.record(session, {
                        organizationId,
                        actorUserId: auth.user.id,
                        action: "submission.created",
                        entityType: "submission",
                        entityId: created.id,
                        metadata: {
                            projectId: project.id,
                            editionId: project.editionId,
                            teamId: project.teamId,
                        },
                        ip,
                    });
                    return created;
                },
            );
            return toSubmission(
                row,
                SubmissionRules.displayTitle(null, project.title),
                await this.teamName(organizationId, row.teamId),
            );
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new ConflictError("A submission already exists for this project.");
            }
            throw error;
        }
    }

    async detail(
        auth: AuthContext,
        organizationId: string,
        role: OrganizationRole,
        submissionId: string,
    ): Promise<SubmissionDetail> {
        const row = await this.load(organizationId, submissionId);
        const resolver = new DisplayResolver(this.contracts);
        const project = await this.assertCanView(organizationId, role, auth.user.id, row, resolver);
        return this.buildDetail(organizationId, row, project, resolver);
    }

    async createVersion(
        auth: AuthContext,
        organizationId: string,
        role: OrganizationRole,
        submissionId: string,
        input: CreateSubmissionVersionRequest,
        ip: string | null,
    ): Promise<SubmissionDetail> {
        const now = this.clock.now();
        try {
            const outcome = await this.database.transaction(
                { organizationId, userId: auth.user.id },
                async (session) => {
                    const row = await this.repository.findByIdForUpdate(
                        session,
                        organizationId,
                        submissionId,
                    );
                    if (row === null) {
                        throw new NotFoundError("The submission was not found.");
                    }
                    const project = await this.requireManagedProject(
                        organizationId,
                        role,
                        auth.user.id,
                        row.projectId,
                    );
                    if (project.editionId !== row.editionId) {
                        throw new ConflictError(
                            "The submission edition no longer matches its project.",
                        );
                    }
                    const edition = await this.contracts.competitions.getEdition(
                        organizationId,
                        row.editionId,
                    );
                    if (edition === null) {
                        throw new NotFoundError("The competition edition was not found.");
                    }
                    SubmissionRules.assertSubmissionWindow(edition, now);
                    SubmissionRules.assertRevisable(row.status);
                    const version = row.currentVersion + 1;
                    const inserted = await this.repository.insertVersion(session, {
                        organizationId,
                        submissionId: row.id,
                        version,
                        title: input.title,
                        summary: input.summary,
                        descriptionMarkdown: input.descriptionMarkdown,
                        repositoryUrl: input.repositoryUrl,
                        demoUrl: input.demoUrl,
                        createdByUserId: auth.user.id,
                        createdAt: now,
                    });
                    const next = await this.repository.update(session, organizationId, row.id, {
                        currentVersion: version,
                        status: input.submit ? "submitted" : row.status,
                        ...(input.submit ? { submittedAt: now } : {}),
                        updatedAt: now,
                    });
                    await this.audit.record(session, {
                        organizationId,
                        actorUserId: auth.user.id,
                        action: "submission.version.created",
                        entityType: "submission",
                        entityId: row.id,
                        metadata: { version, submitted: input.submit },
                        ip,
                    });
                    if (input.submit) {
                        await this.audit.record(session, {
                            organizationId,
                            actorUserId: auth.user.id,
                            action: "submission.submitted",
                            entityType: "submission",
                            entityId: row.id,
                            metadata: { version },
                            ip,
                        });
                    }
                    return { submission: next, versionId: inserted.id, project };
                },
            );
            // Files attach through the files capability, whose transactions need the
            // submission row to be committed before taking the foreign-key lock.
            const files = await this.contracts.files.listProjectFiles(
                organizationId,
                outcome.submission.projectId,
            );
            for (const file of files) {
                await this.contracts.files.attachToSubmission(
                    organizationId,
                    file.id,
                    outcome.submission.id,
                    outcome.versionId,
                );
            }
            return await this.buildDetail(
                organizationId,
                outcome.submission,
                outcome.project,
                new DisplayResolver(this.contracts),
            );
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new ConflictError(
                    "A newer version was created concurrently. Reload and try again.",
                );
            }
            throw error;
        }
    }

    async review(
        auth: AuthContext,
        organizationId: string,
        submissionId: string,
        input: ReviewSubmissionRequest,
        ip: string | null,
    ): Promise<SubmissionDetail> {
        const organization = await this.contracts.organizations.getSummary(organizationId);
        if (organization === null) {
            throw new NotFoundError("The organization was not found.");
        }
        const now = this.clock.now();
        const updated = await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const row = await this.repository.findByIdForUpdate(
                    session,
                    organizationId,
                    submissionId,
                );
                if (row === null) {
                    throw new NotFoundError("The submission was not found.");
                }
                SubmissionRules.assertReviewTransition(row.status, input.status);
                const project = await this.contracts.projects.getProject(
                    organizationId,
                    row.projectId,
                );
                if (project === null) {
                    throw new NotFoundError("The project was not found.");
                }
                const next = await this.repository.update(session, organizationId, row.id, {
                    status: input.status,
                    reviewNote: input.note,
                    reviewNoteUpdatedAt: now,
                    updatedAt: now,
                });
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "submission.reviewed",
                    entityType: "submission",
                    entityId: row.id,
                    metadata: {
                        from: row.status,
                        status: next.status,
                        noteRecorded: input.note.length > 0,
                    },
                    ip,
                });
                await this.events.publish(session, {
                    type: domainEvents.submissionReviewed,
                    organizationId,
                    aggregateType: "submission",
                    aggregateId: row.id,
                    payload: {
                        submissionId: row.id,
                        projectId: row.projectId,
                        projectTitle: project.title,
                        ownerUserId: project.ownerUserId,
                        userId: project.ownerUserId,
                        teamId: row.teamId,
                        status: next.status,
                        organizationId,
                        organizationName: organization.name,
                        note: input.note,
                    },
                });
                return { submission: next, project };
            },
        );
        return this.buildDetail(
            organizationId,
            updated.submission,
            updated.project,
            new DisplayResolver(this.contracts),
        );
    }

    async withdraw(
        auth: AuthContext,
        organizationId: string,
        role: OrganizationRole,
        submissionId: string,
        ip: string | null,
    ): Promise<SubmissionDetail> {
        const now = this.clock.now();
        const updated = await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const row = await this.repository.findByIdForUpdate(
                    session,
                    organizationId,
                    submissionId,
                );
                if (row === null) {
                    throw new NotFoundError("The submission was not found.");
                }
                const project = await this.requireManagedProject(
                    organizationId,
                    role,
                    auth.user.id,
                    row.projectId,
                );
                SubmissionRules.assertWithdrawable(row.status);
                const next = await this.repository.update(session, organizationId, row.id, {
                    status: "withdrawn",
                    updatedAt: now,
                });
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "submission.withdrawn",
                    entityType: "submission",
                    entityId: row.id,
                    metadata: { from: row.status },
                    ip,
                });
                return { submission: next, project };
            },
        );
        return this.buildDetail(
            organizationId,
            updated.submission,
            updated.project,
            new DisplayResolver(this.contracts),
        );
    }

    async listEdition(
        organizationId: string,
        editionId: string,
        cursor: { readonly createdAt: Date; readonly id: string } | null,
        limit: number,
    ): Promise<readonly Submission[]> {
        const edition = await this.contracts.competitions.getEdition(organizationId, editionId);
        if (edition === null) {
            throw new NotFoundError("The competition edition was not found.");
        }
        const rows = await this.database.transaction({ organizationId }, async (session) =>
            this.repository.list(session.db, {
                organizationId,
                editionId,
                projectId: null,
                cursor,
                limit,
            }),
        );
        const resolver = new DisplayResolver(this.contracts);
        return Promise.all(rows.map((row) => this.toSubmissionView(organizationId, row, resolver)));
    }

    async versions(
        auth: AuthContext,
        organizationId: string,
        role: OrganizationRole,
        submissionId: string,
    ): Promise<readonly SubmissionVersion[]> {
        const row = await this.load(organizationId, submissionId);
        await this.assertCanView(
            organizationId,
            role,
            auth.user.id,
            row,
            new DisplayResolver(this.contracts),
        );
        const { versions, files } = await this.database.transaction(
            { organizationId },
            async (session) => ({
                versions: await this.repository.listVersions(
                    session.db,
                    organizationId,
                    submissionId,
                ),
                files: await this.repository.listAttachedFiles(
                    session.db,
                    organizationId,
                    submissionId,
                ),
            }),
        );
        return toVersions(versions, files);
    }

    private async load(organizationId: string, submissionId: string): Promise<SubmissionRow> {
        const row = await this.database.transaction({ organizationId }, async (session) =>
            this.repository.findById(session.db, organizationId, submissionId),
        );
        if (row === null) {
            throw new NotFoundError("The submission was not found.");
        }
        return row;
    }

    private async requireManagedProject(
        organizationId: string,
        role: OrganizationRole,
        userId: string,
        projectId: string,
    ): Promise<ProjectSummary> {
        const project = await this.contracts.projects.getProject(organizationId, projectId);
        if (project === null) {
            throw new NotFoundError("The project was not found.");
        }
        if (SubmissionRules.isOrganizer(role) || project.ownerUserId === userId) {
            return project;
        }
        if (await this.contracts.projects.isProjectMember(organizationId, projectId, userId)) {
            return project;
        }
        throw new ForbiddenError(
            "Only the project owner, a project member, or an organizer may manage this submission.",
        );
    }

    private async assertCanView(
        organizationId: string,
        role: OrganizationRole,
        userId: string,
        row: SubmissionRow,
        resolver: DisplayResolver,
    ): Promise<ProjectSummary> {
        const project = await resolver.project(organizationId, row.projectId);
        if (project === null) {
            throw new NotFoundError("The submission was not found.");
        }
        if (SubmissionRules.isOrganizer(role) || project.ownerUserId === userId) {
            return project;
        }
        if (await this.contracts.projects.isProjectMember(organizationId, row.projectId, userId)) {
            return project;
        }
        const teamId = row.teamId ?? project.teamId;
        if (
            teamId !== null &&
            (await this.contracts.teams.isTeamMember(organizationId, teamId, userId))
        ) {
            return project;
        }
        throw new NotFoundError("The submission was not found.");
    }

    private async canViewRow(
        organizationId: string,
        userId: string,
        teamId: string | null,
        row: SubmissionRow,
        resolver: DisplayResolver,
    ): Promise<boolean> {
        if (teamId !== null && row.teamId === teamId) {
            return true;
        }
        const project = await resolver.project(organizationId, row.projectId);
        if (project === null) {
            return false;
        }
        if (project.ownerUserId === userId) {
            return true;
        }
        if (teamId !== null && project.teamId === teamId) {
            return true;
        }
        return this.contracts.projects.isProjectMember(organizationId, row.projectId, userId);
    }

    private async toSubmissionView(
        organizationId: string,
        row: SubmissionWithVersionRow,
        resolver: DisplayResolver,
    ): Promise<Submission> {
        const versionTitle = row.submission.currentVersion === 0 ? null : row.title;
        const needsProject = versionTitle === null || versionTitle.trim().length === 0;
        const project = needsProject
            ? await resolver.project(organizationId, row.submission.projectId)
            : null;
        const team =
            row.submission.teamId === null
                ? null
                : await resolver.team(organizationId, row.submission.teamId);
        return toSubmission(
            row.submission,
            SubmissionRules.displayTitle(versionTitle, project?.title ?? null),
            team?.name ?? null,
        );
    }

    private async teamName(organizationId: string, teamId: string | null): Promise<string | null> {
        if (teamId === null) {
            return null;
        }
        const team = await this.contracts.teams.getTeam(organizationId, teamId);
        return team?.name ?? null;
    }

    private async buildDetail(
        organizationId: string,
        row: SubmissionRow,
        project: ProjectSummary,
        resolver: DisplayResolver,
    ): Promise<SubmissionDetail> {
        const { versions, files } = await this.database.transaction(
            { organizationId },
            async (session) => ({
                versions: await this.repository.listVersions(session.db, organizationId, row.id),
                files: await this.repository.listAttachedFiles(session.db, organizationId, row.id),
            }),
        );
        const current = versions.find((version) => version.version === row.currentVersion);
        const team = row.teamId === null ? null : await resolver.team(organizationId, row.teamId);
        return toSubmissionDetail(
            row,
            SubmissionRules.displayTitle(current?.title ?? null, project.title),
            team?.name ?? null,
            toVersions(versions, files),
        );
    }
}

/**
 * Request-scoped display cache. Project and team lookups repeat across rows, so
 * each distinct id resolves once per service call.
 */
class DisplayResolver {
    private readonly projects = new Map<string, Promise<ProjectSummary | null>>();
    private readonly teams = new Map<string, Promise<TeamSummary | null>>();
    private readonly contracts: SubmissionContracts;

    constructor(contracts: SubmissionContracts) {
        this.contracts = contracts;
    }

    project(organizationId: string, projectId: string): Promise<ProjectSummary | null> {
        const cached = this.projects.get(projectId);
        if (cached !== undefined) {
            return cached;
        }
        const pending = this.contracts.projects.getProject(organizationId, projectId);
        this.projects.set(projectId, pending);
        return pending;
    }

    team(organizationId: string, teamId: string): Promise<TeamSummary | null> {
        const cached = this.teams.get(teamId);
        if (cached !== undefined) {
            return cached;
        }
        const pending = this.contracts.teams.getTeam(organizationId, teamId);
        this.teams.set(teamId, pending);
        return pending;
    }
}

export function toSubmission(
    row: SubmissionRow,
    projectTitle: string,
    teamName: string | null,
): Submission {
    return {
        id: row.id,
        organizationId: row.organizationId,
        editionId: row.editionId,
        projectId: row.projectId,
        teamId: row.teamId,
        status: row.status,
        currentVersion: row.currentVersion,
        submittedAt: row.submittedAt === null ? null : row.submittedAt.toISOString(),
        projectTitle,
        teamName,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    };
}

export function toSubmissionSummary(
    row: SubmissionRow,
    version: { readonly title: string; readonly summary: string } | null,
): SubmissionSummary {
    return {
        id: row.id,
        organizationId: row.organizationId,
        editionId: row.editionId,
        projectId: row.projectId,
        teamId: row.teamId,
        status: row.status,
        currentVersion: row.currentVersion,
        submittedAt: row.submittedAt === null ? null : row.submittedAt.toISOString(),
        title: version?.title ?? "",
        summary: version?.summary ?? "",
    };
}

export function toSubmissionDetail(
    row: SubmissionRow,
    projectTitle: string,
    teamName: string | null,
    versions: readonly SubmissionVersion[],
): SubmissionDetail {
    return {
        ...toSubmission(row, projectTitle, teamName),
        versions: [...versions],
        reviewNote: row.reviewNote,
        reviewNoteUpdatedAt:
            row.reviewNoteUpdatedAt === null ? null : row.reviewNoteUpdatedAt.toISOString(),
    };
}

function toVersions(
    versions: readonly SubmissionVersionRow[],
    files: readonly SubmissionFileRow[],
): SubmissionVersion[] {
    const filesByVersion = new Map<string, SubmissionFile[]>();
    for (const file of files) {
        if (file.versionId === null) {
            continue;
        }
        const list = filesByVersion.get(file.versionId);
        if (list === undefined) {
            filesByVersion.set(file.versionId, [toFile(file)]);
        } else {
            list.push(toFile(file));
        }
    }
    return versions.map((version) => ({
        id: version.id,
        submissionId: version.submissionId,
        version: version.version,
        title: version.title,
        summary: version.summary,
        descriptionMarkdown: version.descriptionMarkdown,
        repositoryUrl: version.repositoryUrl,
        demoUrl: version.demoUrl,
        createdByUserId: version.createdByUserId,
        createdAt: version.createdAt.toISOString(),
        files: filesByVersion.get(version.id) ?? [],
    }));
}

function toFile(row: SubmissionFileRow): SubmissionFile {
    return {
        id: row.id,
        submissionId: row.submissionId,
        projectId: row.projectId,
        fileName: row.fileName,
        contentType: row.contentType,
        byteSize: row.byteSize,
        checksumSha256: row.checksumSha256,
        status: row.status,
        rejectionReason: row.rejectionReason,
        uploadedByUserId: row.uploadedByUserId,
        createdAt: row.createdAt.toISOString(),
    };
}

function isUniqueViolation(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: unknown }).code === "23505"
    );
}
