import type {
    Announcement,
    CreateAnnouncementRequest,
    PublicAnnouncement,
    UpdateAnnouncementRequest,
} from "@nethack/contracts";
import type { AuthContext } from "../../../authentication/types.js";
import type { Clock } from "../../../core/clock.js";
import { domainEvents } from "../../../core/domain-event.js";
import { NotFoundError, ValidationError } from "../../../core/errors.js";
import type { OutboxPublisher } from "../../../core/outbox.js";
import type { DatabaseConnection } from "../../../infrastructure/database/client.js";
import type { AuditLogger } from "../../../infrastructure/audit/audit-logger.js";
import type { AnnouncementSummary } from "../contracts.js";
import { assertHasChanges } from "../domain/announcement-rules.js";
import type {
    AnnouncementRecord,
    AnnouncementRepository,
    AnnouncementRow,
} from "../infrastructure/announcement-repository.js";
import type { OrganizationsContract } from "../../organizations/contracts.js";

export interface AnnouncementPageOptions {
    readonly limit: number;
    readonly before: { createdAt: Date; id: string } | null;
}

export class AnnouncementService {
    private readonly database: DatabaseConnection;
    private readonly repository: AnnouncementRepository;
    private readonly events: OutboxPublisher;
    private readonly audit: AuditLogger;
    private readonly clock: Clock;
    private readonly organizations: OrganizationsContract;

    constructor(
        database: DatabaseConnection,
        repository: AnnouncementRepository,
        events: OutboxPublisher,
        audit: AuditLogger,
        clock: Clock,
        organizations: OrganizationsContract,
    ) {
        this.database = database;
        this.repository = repository;
        this.events = events;
        this.audit = audit;
        this.clock = clock;
        this.organizations = organizations;
    }

    async list(
        auth: AuthContext,
        organizationId: string,
        options: AnnouncementPageOptions & { includeDrafts: boolean },
    ): Promise<readonly Announcement[]> {
        const rows = await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) =>
                this.repository.listForOrganization(session.db, organizationId, options),
        );
        return rows.map(toAnnouncement);
    }

    async create(
        auth: AuthContext,
        organizationId: string,
        input: CreateAnnouncementRequest,
        ip: string | null,
    ): Promise<Announcement> {
        const now = this.clock.now();
        try {
            const row = await this.database.transaction(
                { organizationId, userId: auth.user.id },
                async (session) => {
                    const created = await this.repository.insert(session, {
                        organizationId,
                        editionId: input.editionId,
                        title: input.title,
                        bodyMarkdown: input.bodyMarkdown,
                        visibility: input.visibility,
                        publishedAt: input.publish ? now : null,
                        authorUserId: auth.user.id,
                    });
                    await this.audit.record(session, {
                        organizationId,
                        actorUserId: auth.user.id,
                        action: "announcement.created",
                        entityType: "announcement",
                        entityId: created.id,
                        metadata: {
                            visibility: created.visibility,
                            published: created.publishedAt !== null,
                        },
                        ip,
                    });
                    return created;
                },
            );
            return toAnnouncement({
                ...row,
                authorDisplayName: auth.user.displayName,
            });
        } catch (error) {
            if (isForeignKeyViolation(error)) {
                throw new ValidationError(
                    "The competition edition was not found in this organization.",
                );
            }
            throw error;
        }
    }

    async update(
        auth: AuthContext,
        organizationId: string,
        announcementId: string,
        input: UpdateAnnouncementRequest,
        ip: string | null,
    ): Promise<Announcement> {
        assertHasChanges(input);
        const now = this.clock.now();
        const row = await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const existing = await this.repository.findById(session.db, announcementId);
                if (existing === null || existing.organizationId !== organizationId) {
                    throw new NotFoundError("The announcement was not found.");
                }
                await this.repository.update(session, announcementId, {
                    ...(input.title === undefined ? {} : { title: input.title }),
                    ...(input.bodyMarkdown === undefined
                        ? {}
                        : { bodyMarkdown: input.bodyMarkdown }),
                    ...(input.visibility === undefined ? {} : { visibility: input.visibility }),
                    updatedAt: now,
                });
                const updated = await this.repository.findById(session.db, announcementId);
                if (updated === null) {
                    throw new NotFoundError("The announcement was not found.");
                }
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "announcement.updated",
                    entityType: "announcement",
                    entityId: announcementId,
                    metadata: { fields: Object.keys(input) },
                    ip,
                });
                return updated;
            },
        );
        return toAnnouncement(row);
    }

    async publish(
        auth: AuthContext,
        organizationId: string,
        announcementId: string,
        ip: string | null,
    ): Promise<Announcement> {
        const organization = await this.organizations.getSummary(organizationId);
        if (organization === null) {
            throw new NotFoundError("The organization was not found.");
        }
        const now = this.clock.now();
        const row = await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const existing = await this.repository.findById(session.db, announcementId);
                if (existing === null || existing.organizationId !== organizationId) {
                    throw new NotFoundError("The announcement was not found.");
                }
                const published = await this.repository.publishIfUnpublished(
                    session,
                    announcementId,
                    now,
                );
                if (!published) {
                    const current = await this.repository.findById(session.db, announcementId);
                    if (current === null || current.organizationId !== organizationId) {
                        throw new NotFoundError("The announcement was not found.");
                    }
                    return current;
                }
                const updated = await this.repository.findById(session.db, announcementId);
                if (updated === null) {
                    throw new NotFoundError("The announcement was not found.");
                }
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "announcement.published",
                    entityType: "announcement",
                    entityId: announcementId,
                    metadata: { visibility: updated.visibility },
                    ip,
                });
                await this.events.publish(session, {
                    type: domainEvents.announcementPublished,
                    organizationId,
                    aggregateType: "announcement",
                    aggregateId: announcementId,
                    payload: {
                        announcementId,
                        title: updated.title,
                        organizationId,
                        organizationName: organization.name,
                        visibility: updated.visibility,
                    },
                });
                return updated;
            },
        );
        return toAnnouncement(row);
    }

    async listPublic(
        organizationSlug: string,
        options: AnnouncementPageOptions,
    ): Promise<readonly PublicAnnouncement[]> {
        const organization = await this.organizations.getSummaryBySlug(organizationSlug);
        if (organization === null) {
            return [];
        }
        const rows = await this.repository.listPublic(this.database.db, organization.id, options);
        return rows.map((row) => toPublicAnnouncement(row, organization));
    }

    async listPublished(
        organizationId: string,
        options: { limit: number },
    ): Promise<readonly AnnouncementSummary[]> {
        const rows = await this.database.transaction({ organizationId }, async (session) =>
            this.repository.listPublished(session.db, organizationId, options),
        );
        return rows.map((row) => ({
            id: row.id,
            organizationId: row.organizationId,
            title: row.title,
            bodyMarkdown: row.bodyMarkdown,
            publishedAt: row.publishedAt === null ? null : row.publishedAt.toISOString(),
            visibility: row.visibility,
        }));
    }
}

function toAnnouncement(row: AnnouncementRecord & { authorDisplayName: string }): Announcement {
    return {
        id: row.id,
        organizationId: row.organizationId,
        editionId: row.editionId,
        title: row.title,
        bodyMarkdown: row.bodyMarkdown,
        visibility: row.visibility,
        publishedAt: row.publishedAt === null ? null : row.publishedAt.toISOString(),
        authorUserId: row.authorUserId,
        authorDisplayName: row.authorDisplayName,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    };
}

function toPublicAnnouncement(
    row: AnnouncementRow,
    organization: { readonly name: string; readonly slug: string },
): PublicAnnouncement {
    if (row.publishedAt === null) {
        throw new Error("A public announcement must have a publication timestamp.");
    }
    return {
        id: row.id,
        title: row.title,
        bodyMarkdown: row.bodyMarkdown,
        publishedAt: row.publishedAt.toISOString(),
        organizationName: organization.name,
        organizationSlug: organization.slug,
    };
}

function isForeignKeyViolation(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: unknown }).code === "23503"
    );
}
