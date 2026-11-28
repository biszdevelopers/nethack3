import type {
    CompetitionEdition,
    CompetitionEditionDetail,
    CompetitionEditionStatus,
    CompetitionSeries,
    CreateDivisionRequest,
    CreateEditionRequest,
    CreateMilestoneRequest,
    CreateSeriesRequest,
    Division,
    Milestone,
    OrganizerEdition,
    PublicCompetition,
    PublicCompetitionDetail,
    PublicOrganization,
    UpdateDivisionRequest,
    UpdateEditionRequest,
    UpdateMilestoneRequest,
    UpdateSeriesRequest,
} from "@nethack/contracts";
import type { AuthContext } from "../../../authentication/types.js";
import type { Clock } from "../../../core/clock.js";
import { domainEvents } from "../../../core/domain-event.js";
import {
    ConflictError,
    isUniqueViolationError as isUniqueViolation,
    NotFoundError,
} from "../../../core/errors.js";
import type { OutboxPublisher } from "../../../core/outbox.js";
import type { AuditLogger } from "../../../infrastructure/audit/audit-logger.js";
import type {
    DatabaseConnection,
    DatabaseSession,
} from "../../../infrastructure/database/client.js";
import type { OrganizationSummary, OrganizationsContract } from "../../organizations/contracts.js";
import { CompetitionRules, type EditionSchedule } from "../domain/competition-rules.js";
import type {
    CompetitionRepository,
    DivisionRow,
    EditionRow,
    EditionUpdateValues,
    EditionWithSeriesRow,
    MilestoneRow,
    PublicEditionRow,
    SeriesRow,
} from "../infrastructure/competition-repository.js";

const PUBLIC_EDITION_LIMIT = 100;

type MutableEditionUpdate = { -readonly [K in keyof EditionUpdateValues]: EditionUpdateValues[K] };

export interface EditionPageOptions {
    readonly limit: number;
    readonly seriesId: string | null;
    readonly before: Date | null;
    readonly beforeId: string | null;
}

export interface EditionPage {
    readonly items: readonly OrganizerEdition[];
    readonly hasMore: boolean;
}

export class CompetitionService {
    private readonly database: DatabaseConnection;
    private readonly repository: CompetitionRepository;
    private readonly events: OutboxPublisher;
    private readonly audit: AuditLogger;
    private readonly clock: Clock;
    private readonly organizations: OrganizationsContract;

    constructor(
        database: DatabaseConnection,
        repository: CompetitionRepository,
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

    async listSeries(organizationId: string): Promise<readonly CompetitionSeries[]> {
        const rows = await this.database.transaction({ organizationId }, (session) =>
            this.repository.listSeries(session.db, organizationId),
        );
        return rows.map(toSeries);
    }

    async createSeries(
        auth: AuthContext,
        organizationId: string,
        input: CreateSeriesRequest,
        ip: string | null,
    ): Promise<CompetitionSeries> {
        try {
            const row = await this.database.transaction(
                { organizationId, userId: auth.user.id },
                async (session) => {
                    const series = await this.repository.insertSeries(session, {
                        organizationId,
                        name: input.name,
                        slug: input.slug,
                        description: input.description,
                    });
                    await this.audit.record(session, {
                        organizationId,
                        actorUserId: auth.user.id,
                        action: "competition.series.created",
                        entityType: "competition_series",
                        entityId: series.id,
                        metadata: { slug: series.slug },
                        ip,
                    });
                    return series;
                },
            );
            return toSeries(row);
        } catch (error) {
            throw this.rethrowUnique(error, "That competition series slug is already in use.");
        }
    }

    async updateSeries(
        auth: AuthContext,
        organizationId: string,
        seriesId: string,
        input: UpdateSeriesRequest,
        ip: string | null,
    ): Promise<CompetitionSeries> {
        const now = this.clock.now();
        const row = await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const updated = await this.repository.updateSeries(
                    session,
                    organizationId,
                    seriesId,
                    {
                        ...(input.name === undefined ? {} : { name: input.name }),
                        ...(input.description === undefined
                            ? {}
                            : { description: input.description }),
                        updatedAt: now,
                    },
                );
                if (updated === null) {
                    throw new NotFoundError("The competition series was not found.");
                }
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "competition.series.updated",
                    entityType: "competition_series",
                    entityId: seriesId,
                    metadata: { fields: Object.keys(input) },
                    ip,
                });
                return updated;
            },
        );
        return toSeries(row);
    }

    async deleteSeries(
        auth: AuthContext,
        organizationId: string,
        seriesId: string,
        ip: string | null,
    ): Promise<void> {
        await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const series = await this.repository.lockSeries(session, organizationId, seriesId);
                if (series === null) {
                    throw new NotFoundError("The competition series was not found.");
                }
                const editionCount = await this.repository.countEditionsForSeries(
                    session.db,
                    organizationId,
                    seriesId,
                );
                CompetitionRules.assertSeriesIsDeletable(editionCount);
                await this.repository.deleteSeries(session, organizationId, seriesId);
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "competition.series.deleted",
                    entityType: "competition_series",
                    entityId: seriesId,
                    metadata: { slug: series.slug },
                    ip,
                });
            },
        );
    }

    async organizerEditions(
        organizationId: string,
        options: EditionPageOptions,
    ): Promise<EditionPage> {
        return this.editionPage(organizationId, options, false);
    }

    async seriesEditions(
        organizationId: string,
        seriesId: string,
        options: Omit<EditionPageOptions, "seriesId">,
    ): Promise<EditionPage> {
        return this.editionPage(organizationId, { ...options, seriesId }, true);
    }

    async createEdition(
        auth: AuthContext,
        organizationId: string,
        seriesId: string,
        input: CreateEditionRequest,
        ip: string | null,
    ): Promise<CompetitionEdition> {
        const schedule: EditionSchedule = {
            teamMinSize: input.teamMinSize,
            teamMaxSize: input.teamMaxSize,
            registrationOpensAt: parseNullable(input.registrationOpensAt),
            registrationClosesAt: parseNullable(input.registrationClosesAt),
            startsAt: parseNullable(input.startsAt),
            endsAt: parseNullable(input.endsAt),
        };
        CompetitionRules.assertEditionIsValid(schedule);
        try {
            const row = await this.database.transaction(
                { organizationId, userId: auth.user.id },
                async (session) => {
                    const series = await this.repository.findSeriesById(
                        session.db,
                        organizationId,
                        seriesId,
                    );
                    if (series === null) {
                        throw new NotFoundError("The competition series was not found.");
                    }
                    const edition = await this.repository.insertEdition(session, {
                        organizationId,
                        seriesId,
                        name: input.name,
                        slug: input.slug,
                        description: input.description,
                        themeName: input.themeName,
                        themeDescription: input.themeDescription,
                        showScores: input.showScores,
                        showRanking: input.showRanking,
                        timezone: input.timezone,
                        registrationOpensAt: schedule.registrationOpensAt,
                        registrationClosesAt: schedule.registrationClosesAt,
                        startsAt: schedule.startsAt,
                        endsAt: schedule.endsAt,
                        teamMinSize: input.teamMinSize,
                        teamMaxSize: input.teamMaxSize,
                        maxParticipants: input.maxParticipants,
                        rulesMarkdown: input.rulesMarkdown,
                    });
                    await this.audit.record(session, {
                        organizationId,
                        actorUserId: auth.user.id,
                        action: "competition.edition.created",
                        entityType: "competition_edition",
                        entityId: edition.id,
                        metadata: { seriesId, slug: edition.slug },
                        ip,
                    });
                    return edition;
                },
            );
            return toEdition(row);
        } catch (error) {
            throw this.rethrowUnique(error, "That competition edition slug is already in use.");
        }
    }

    async detail(organizationId: string, editionId: string): Promise<CompetitionEditionDetail> {
        const result = await this.database.transaction({ organizationId }, async (session) => {
            const [edition, divisions, milestones, registrationCount, teamCount, submissionCount] =
                await Promise.all([
                    this.repository.findEdition(session.db, organizationId, editionId),
                    this.repository.listDivisions(session.db, organizationId, editionId),
                    this.repository.listMilestones(session.db, organizationId, editionId),
                    this.repository.countRegistrations(session.db, organizationId, editionId),
                    this.repository.countTeams(session.db, organizationId, editionId),
                    this.repository.countSubmissions(session.db, organizationId, editionId),
                ]);
            return {
                edition,
                divisions,
                milestones,
                registrationCount,
                teamCount,
                submissionCount,
            };
        });
        if (result.edition === null) {
            throw new NotFoundError("The competition edition was not found.");
        }
        const organization = await this.requireOrganization(organizationId);
        return {
            ...toEdition(result.edition),
            seriesName: result.edition.seriesName,
            organizationName: organization.name,
            organizationSlug: organization.slug,
            divisions: result.divisions.map(toDivision),
            milestones: result.milestones.map(toMilestone),
            registrationCount: result.registrationCount,
            teamCount: result.teamCount,
            submissionCount: result.submissionCount,
        };
    }

    async update(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
        input: UpdateEditionRequest,
        ip: string | null,
    ): Promise<CompetitionEdition> {
        const now = this.clock.now();
        const updated = await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const current = await this.repository.findEdition(
                    session.db,
                    organizationId,
                    editionId,
                );
                if (current === null) {
                    throw new NotFoundError("The competition edition was not found.");
                }
                CompetitionRules.assertEditionIsValid({
                    teamMinSize: input.teamMinSize ?? current.teamMinSize,
                    teamMaxSize: input.teamMaxSize ?? current.teamMaxSize,
                    registrationOpensAt:
                        input.registrationOpensAt === undefined
                            ? current.registrationOpensAt
                            : parseNullable(input.registrationOpensAt),
                    registrationClosesAt:
                        input.registrationClosesAt === undefined
                            ? current.registrationClosesAt
                            : parseNullable(input.registrationClosesAt),
                    startsAt:
                        input.startsAt === undefined
                            ? current.startsAt
                            : parseNullable(input.startsAt),
                    endsAt:
                        input.endsAt === undefined ? current.endsAt : parseNullable(input.endsAt),
                });

                const values: MutableEditionUpdate = { updatedAt: now };
                if (input.name !== undefined) {
                    values.name = input.name;
                }
                if (input.description !== undefined) {
                    values.description = input.description;
                }
                if (input.themeName !== undefined) {
                    values.themeName = input.themeName;
                }
                if (input.themeDescription !== undefined) {
                    values.themeDescription = input.themeDescription;
                }
                if (input.showScores !== undefined) {
                    values.showScores = input.showScores;
                }
                if (input.showRanking !== undefined) {
                    values.showRanking = input.showRanking;
                }
                if (input.timezone !== undefined) {
                    values.timezone = input.timezone;
                }
                if (input.teamMinSize !== undefined) {
                    values.teamMinSize = input.teamMinSize;
                }
                if (input.teamMaxSize !== undefined) {
                    values.teamMaxSize = input.teamMaxSize;
                }
                if (input.maxParticipants !== undefined) {
                    values.maxParticipants = input.maxParticipants;
                }
                if (input.rulesMarkdown !== undefined) {
                    values.rulesMarkdown = input.rulesMarkdown;
                }
                if (input.registrationOpensAt !== undefined) {
                    values.registrationOpensAt = parseNullable(input.registrationOpensAt);
                }
                if (input.registrationClosesAt !== undefined) {
                    values.registrationClosesAt = parseNullable(input.registrationClosesAt);
                }
                if (input.startsAt !== undefined) {
                    values.startsAt = parseNullable(input.startsAt);
                }
                if (input.endsAt !== undefined) {
                    values.endsAt = parseNullable(input.endsAt);
                }
                if (input.status !== undefined) {
                    CompetitionRules.assertTransition(current.status, input.status);
                    values.status = input.status;
                    if (input.status === "published") {
                        values.publishedAt = now;
                    }
                }

                const row = await this.repository.updateEdition(
                    session,
                    organizationId,
                    editionId,
                    values,
                );
                if (row === null) {
                    throw new NotFoundError("The competition edition was not found.");
                }
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "competition.edition.updated",
                    entityType: "competition_edition",
                    entityId: editionId,
                    metadata: { fields: Object.keys(input) },
                    ip,
                });
                if (input.status === "published") {
                    await this.publishEvent(session, organizationId, auth.user.id, row);
                }
                return row;
            },
        );
        return toEdition(updated);
    }

    /**
     * Results publication freeze: one direct status write to `completed`,
     * bypassing the normal transition table because publication is the
     * organizer's explicit freeze action. Returns the status to restore on
     * unpublish.
     */
    async freezeForResults(
        session: DatabaseSession,
        organizationId: string,
        editionId: string,
    ): Promise<CompetitionEditionStatus> {
        const current = await this.repository.findEdition(session.db, organizationId, editionId);
        if (current === null) {
            throw new NotFoundError("The competition edition was not found.");
        }
        if (current.status === "completed") {
            return current.status;
        }
        const row = await this.repository.updateEdition(session, organizationId, editionId, {
            status: "completed",
            updatedAt: this.clock.now(),
        });
        if (row === null) {
            throw new NotFoundError("The competition edition was not found.");
        }
        return current.status;
    }

    async restoreEditionStatus(
        session: DatabaseSession,
        organizationId: string,
        editionId: string,
        status: CompetitionEditionStatus,
    ): Promise<void> {
        const row = await this.repository.updateEdition(session, organizationId, editionId, {
            status,
            updatedAt: this.clock.now(),
        });
        if (row === null) {
            throw new NotFoundError("The competition edition was not found.");
        }
    }

    async publish(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
        ip: string | null,
    ): Promise<CompetitionEdition> {
        const now = this.clock.now();
        const published = await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const current = await this.repository.findEdition(
                    session.db,
                    organizationId,
                    editionId,
                );
                if (current === null) {
                    throw new NotFoundError("The competition edition was not found.");
                }
                CompetitionRules.assertPublishable(current.status);
                const row = await this.repository.updateEdition(
                    session,
                    organizationId,
                    editionId,
                    {
                        status: "published",
                        publishedAt: now,
                        updatedAt: now,
                    },
                );
                if (row === null) {
                    throw new NotFoundError("The competition edition was not found.");
                }
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "competition.edition.published",
                    entityType: "competition_edition",
                    entityId: editionId,
                    metadata: { slug: row.slug },
                    ip,
                });
                await this.publishEvent(session, organizationId, auth.user.id, row);
                return row;
            },
        );
        return toEdition(published);
    }

    async divisions(organizationId: string, editionId: string): Promise<readonly Division[]> {
        const rows = await this.database.transaction({ organizationId }, async (session) => {
            const edition = await this.repository.findEdition(
                session.db,
                organizationId,
                editionId,
            );
            if (edition === null) {
                throw new NotFoundError("The competition edition was not found.");
            }
            return this.repository.listDivisions(session.db, organizationId, editionId);
        });
        return rows.map(toDivision);
    }

    async createDivision(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
        input: CreateDivisionRequest,
        ip: string | null,
    ): Promise<Division> {
        CompetitionRules.assertDivisionTeamSizes(input.minTeamSize, input.maxTeamSize);
        try {
            const row = await this.database.transaction(
                { organizationId, userId: auth.user.id },
                async (session) => {
                    const edition = await this.repository.findEdition(
                        session.db,
                        organizationId,
                        editionId,
                    );
                    if (edition === null) {
                        throw new NotFoundError("The competition edition was not found.");
                    }
                    const division = await this.repository.insertDivision(session, {
                        organizationId,
                        editionId,
                        name: input.name,
                        slug: input.slug,
                        description: input.description,
                        minTeamSize: input.minTeamSize,
                        maxTeamSize: input.maxTeamSize,
                    });
                    await this.audit.record(session, {
                        organizationId,
                        actorUserId: auth.user.id,
                        action: "competition.division.created",
                        entityType: "division",
                        entityId: division.id,
                        metadata: { editionId, slug: division.slug },
                        ip,
                    });
                    return division;
                },
            );
            return toDivision(row);
        } catch (error) {
            throw this.rethrowUnique(
                error,
                "That division slug is already in use for this edition.",
            );
        }
    }

    async updateDivision(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
        divisionId: string,
        input: UpdateDivisionRequest,
        ip: string | null,
    ): Promise<Division> {
        const row = await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const edition = await this.repository.findEdition(
                    session.db,
                    organizationId,
                    editionId,
                );
                if (edition === null) {
                    throw new NotFoundError("The competition edition was not found.");
                }
                const current = await this.repository.findDivisionForEdition(
                    session.db,
                    organizationId,
                    editionId,
                    divisionId,
                );
                if (current === null) {
                    throw new NotFoundError("The division was not found.");
                }
                CompetitionRules.assertDivisionTeamSizes(
                    input.minTeamSize === undefined ? current.minTeamSize : input.minTeamSize,
                    input.maxTeamSize === undefined ? current.maxTeamSize : input.maxTeamSize,
                );
                const updated = await this.repository.updateDivision(
                    session,
                    organizationId,
                    editionId,
                    divisionId,
                    {
                        ...(input.name === undefined ? {} : { name: input.name }),
                        ...(input.description === undefined
                            ? {}
                            : { description: input.description }),
                        ...(input.minTeamSize === undefined
                            ? {}
                            : { minTeamSize: input.minTeamSize }),
                        ...(input.maxTeamSize === undefined
                            ? {}
                            : { maxTeamSize: input.maxTeamSize }),
                    },
                );
                if (updated === null) {
                    throw new NotFoundError("The division was not found.");
                }
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "competition.division.updated",
                    entityType: "division",
                    entityId: divisionId,
                    metadata: { editionId, fields: Object.keys(input) },
                    ip,
                });
                return updated;
            },
        );
        return toDivision(row);
    }

    async deleteDivision(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
        divisionId: string,
        ip: string | null,
    ): Promise<void> {
        await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const edition = await this.repository.findEdition(
                    session.db,
                    organizationId,
                    editionId,
                );
                if (edition === null) {
                    throw new NotFoundError("The competition edition was not found.");
                }
                const division = await this.repository.lockDivisionForEdition(
                    session,
                    organizationId,
                    editionId,
                    divisionId,
                );
                if (division === null) {
                    throw new NotFoundError("The division was not found.");
                }
                const [registrationCount, teamCount] = await Promise.all([
                    this.repository.countDivisionRegistrations(
                        session.db,
                        organizationId,
                        divisionId,
                    ),
                    this.repository.countDivisionTeams(session.db, organizationId, divisionId),
                ]);
                CompetitionRules.assertDivisionIsDeletable(registrationCount, teamCount);
                await this.repository.deleteDivision(
                    session,
                    organizationId,
                    editionId,
                    divisionId,
                );
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "competition.division.deleted",
                    entityType: "division",
                    entityId: divisionId,
                    metadata: { editionId, slug: division.slug },
                    ip,
                });
            },
        );
    }

    async milestones(organizationId: string, editionId: string): Promise<readonly Milestone[]> {
        const rows = await this.database.transaction({ organizationId }, async (session) => {
            const edition = await this.repository.findEdition(
                session.db,
                organizationId,
                editionId,
            );
            if (edition === null) {
                throw new NotFoundError("The competition edition was not found.");
            }
            return this.repository.listMilestones(session.db, organizationId, editionId);
        });
        return rows.map(toMilestone);
    }

    async createMilestone(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
        input: CreateMilestoneRequest,
        ip: string | null,
    ): Promise<Milestone> {
        const row = await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const edition = await this.repository.findEdition(
                    session.db,
                    organizationId,
                    editionId,
                );
                if (edition === null) {
                    throw new NotFoundError("The competition edition was not found.");
                }
                const milestone = await this.repository.insertMilestone(session, {
                    organizationId,
                    editionId,
                    title: input.title,
                    description: input.description,
                    kind: input.kind,
                    occursAt: new Date(input.occursAt),
                });
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "competition.milestone.created",
                    entityType: "milestone",
                    entityId: milestone.id,
                    metadata: { editionId, kind: milestone.kind },
                    ip,
                });
                return milestone;
            },
        );
        return toMilestone(row);
    }

    async updateMilestone(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
        milestoneId: string,
        input: UpdateMilestoneRequest,
        ip: string | null,
    ): Promise<Milestone> {
        const row = await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const edition = await this.repository.findEdition(
                    session.db,
                    organizationId,
                    editionId,
                );
                if (edition === null) {
                    throw new NotFoundError("The competition edition was not found.");
                }
                const updated = await this.repository.updateMilestone(
                    session,
                    organizationId,
                    editionId,
                    milestoneId,
                    {
                        ...(input.title === undefined ? {} : { title: input.title }),
                        ...(input.description === undefined
                            ? {}
                            : { description: input.description }),
                        ...(input.kind === undefined ? {} : { kind: input.kind }),
                        ...(input.occursAt === undefined
                            ? {}
                            : { occursAt: new Date(input.occursAt) }),
                    },
                );
                if (updated === null) {
                    throw new NotFoundError("The milestone was not found.");
                }
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "competition.milestone.updated",
                    entityType: "milestone",
                    entityId: milestoneId,
                    metadata: { editionId, fields: Object.keys(input) },
                    ip,
                });
                return updated;
            },
        );
        return toMilestone(row);
    }

    async deleteMilestone(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
        milestoneId: string,
        ip: string | null,
    ): Promise<void> {
        await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const edition = await this.repository.findEdition(
                    session.db,
                    organizationId,
                    editionId,
                );
                if (edition === null) {
                    throw new NotFoundError("The competition edition was not found.");
                }
                const milestone = await this.repository.findMilestone(
                    session.db,
                    organizationId,
                    editionId,
                    milestoneId,
                );
                if (milestone === null) {
                    throw new NotFoundError("The milestone was not found.");
                }
                await this.repository.deleteMilestone(
                    session,
                    organizationId,
                    editionId,
                    milestoneId,
                );
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "competition.milestone.deleted",
                    entityType: "milestone",
                    entityId: milestoneId,
                    metadata: { editionId, title: milestone.title },
                    ip,
                });
            },
        );
    }

    async publicCompetitions(limit: number): Promise<readonly PublicCompetition[]> {
        const rows = await this.repository.listPublicEditions(this.database.db, {
            limit,
            organizationId: null,
        });
        const organizations = await this.organizationSummaries(
            rows.map((row) => row.organizationId),
        );
        const counts = await this.repository.countPublishedProjectsByEdition(
            this.database.db,
            rows.map((row) => row.id),
        );
        return rows.flatMap((row) => {
            const organization = organizations.get(row.organizationId);
            return organization === undefined
                ? []
                : [toPublicCompetition(row, organization, counts.get(row.id) ?? 0)];
        });
    }

    async publicCompetitionDetail(slug: string): Promise<PublicCompetitionDetail> {
        const row = await this.repository.findPublicEditionBySlug(this.database.db, slug);
        if (row === null) {
            throw new NotFoundError("The competition was not found.");
        }
        const organization = await this.requireOrganization(row.organizationId);
        const [divisionRows, milestoneRows, projectRows, counts] = await Promise.all([
            this.repository.listDivisions(this.database.db, row.organizationId, row.id),
            this.repository.listMilestones(this.database.db, row.organizationId, row.id),
            this.repository.listPublicProjects(this.database.db, row.id),
            this.repository.countPublishedProjectsByEdition(this.database.db, [row.id]),
        ]);
        return {
            ...toPublicCompetition(row, organization, counts.get(row.id) ?? 0),
            rulesMarkdown: row.rulesMarkdown,
            divisions: divisionRows.map((division) => ({
                id: division.id,
                name: division.name,
                slug: division.slug,
                description: division.description,
            })),
            milestones: milestoneRows.map((milestone) => ({
                id: milestone.id,
                title: milestone.title,
                description: milestone.description,
                kind: milestone.kind,
                occursAt: milestone.occursAt.toISOString(),
            })),
            projects: projectRows.map((project) => ({
                id: project.id,
                title: project.title,
                slug: project.slug,
                summary: project.summary,
                teamName: project.teamName,
                publishedAt: nullableIso(project.publishedAt),
            })),
        };
    }

    async publicOrganization(slug: string): Promise<PublicOrganization> {
        const organization = await this.repository.findOrganizationBySlug(this.database.db, slug);
        if (organization === null) {
            throw new NotFoundError("The organization was not found.");
        }
        const [summary, showcaseEnabled] = await Promise.all([
            this.organizations.getSummary(organization.id),
            this.organizations.isPublicShowcaseEnabled(organization.id),
        ]);
        if (summary === null || !showcaseEnabled) {
            throw new NotFoundError("The organization was not found.");
        }
        const rows = await this.repository.listPublicEditions(this.database.db, {
            limit: PUBLIC_EDITION_LIMIT,
            organizationId: organization.id,
        });
        const counts = await this.repository.countPublishedProjectsByEdition(
            this.database.db,
            rows.map((row) => row.id),
        );
        return {
            id: summary.id,
            name: summary.name,
            slug: summary.slug,
            description: summary.description,
            websiteUrl: summary.websiteUrl,
            competitions: rows.map((row) =>
                toPublicCompetition(row, summary, counts.get(row.id) ?? 0),
            ),
        };
    }

    private async editionPage(
        organizationId: string,
        options: EditionPageOptions,
        verifySeries: boolean,
    ): Promise<EditionPage> {
        const result = await this.database.transaction({ organizationId }, async (session) => {
            if (verifySeries && options.seriesId !== null) {
                const series = await this.repository.findSeriesById(
                    session.db,
                    organizationId,
                    options.seriesId,
                );
                if (series === null) {
                    throw new NotFoundError("The competition series was not found.");
                }
            }
            const rows = await this.repository.listEditionsPage(session.db, organizationId, {
                limit: options.limit + 1,
                seriesId: options.seriesId,
                before: options.before,
                beforeId: options.beforeId,
            });
            const visible = rows.slice(0, options.limit);
            const editionIds = visible.map((row) => row.id);
            const [registrationCounts, teamCounts] = await Promise.all([
                this.repository.countRegistrationsByEdition(session.db, organizationId, editionIds),
                this.repository.countTeamsByEdition(session.db, organizationId, editionIds),
            ]);
            return {
                visible,
                hasMore: rows.length > options.limit,
                registrationCounts,
                teamCounts,
            };
        });
        return {
            items: result.visible.map((row) =>
                toOrganizerEdition(
                    row,
                    result.registrationCounts.get(row.id) ?? 0,
                    result.teamCounts.get(row.id) ?? 0,
                ),
            ),
            hasMore: result.hasMore,
        };
    }

    private async publishEvent(
        session: DatabaseSession,
        organizationId: string,
        actorUserId: string,
        edition: EditionRow,
    ): Promise<void> {
        await this.events.publish(session, {
            type: domainEvents.competitionPublished,
            organizationId,
            aggregateType: "competition_edition",
            aggregateId: edition.id,
            payload: {
                editionId: edition.id,
                organizationId,
                actorUserId,
                name: edition.name,
                slug: edition.slug,
                publishedAt: (edition.publishedAt ?? this.clock.now()).toISOString(),
            },
        });
    }

    private async organizationSummaries(
        organizationIds: readonly string[],
    ): Promise<Map<string, OrganizationSummary>> {
        const unique = [...new Set(organizationIds)];
        const summaries = new Map<string, OrganizationSummary>();
        await Promise.all(
            unique.map(async (organizationId) => {
                const summary = await this.organizations.getSummary(organizationId);
                if (summary !== null) {
                    summaries.set(organizationId, summary);
                }
            }),
        );
        return summaries;
    }

    private async requireOrganization(organizationId: string): Promise<OrganizationSummary> {
        const organization = await this.organizations.getSummary(organizationId);
        if (organization === null) {
            throw new NotFoundError("The organization was not found.");
        }
        return organization;
    }

    private rethrowUnique(error: unknown, message: string): unknown {
        return isUniqueViolation(error) ? new ConflictError(message) : error;
    }
}

function toSeries(row: SeriesRow): CompetitionSeries {
    return {
        id: row.id,
        organizationId: row.organizationId,
        name: row.name,
        slug: row.slug,
        description: row.description,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    };
}

function toEdition(row: EditionRow): CompetitionEdition {
    return {
        id: row.id,
        organizationId: row.organizationId,
        seriesId: row.seriesId,
        name: row.name,
        slug: row.slug,
        description: row.description,
        themeName: row.themeName,
        themeDescription: row.themeDescription,
        showScores: row.showScores,
        showRanking: row.showRanking,
        status: row.status,
        timezone: row.timezone,
        registrationOpensAt: nullableIso(row.registrationOpensAt),
        registrationClosesAt: nullableIso(row.registrationClosesAt),
        startsAt: nullableIso(row.startsAt),
        endsAt: nullableIso(row.endsAt),
        teamMinSize: row.teamMinSize,
        teamMaxSize: row.teamMaxSize,
        maxParticipants: row.maxParticipants,
        rulesMarkdown: row.rulesMarkdown,
        publishedAt: nullableIso(row.publishedAt),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    };
}

function toOrganizerEdition(
    row: EditionWithSeriesRow,
    registrationCount: number,
    teamCount: number,
): OrganizerEdition {
    return {
        ...toEdition(row),
        seriesName: row.seriesName,
        registrationCount,
        teamCount,
    };
}

function toDivision(row: DivisionRow): Division {
    return {
        id: row.id,
        organizationId: row.organizationId,
        editionId: row.editionId,
        name: row.name,
        slug: row.slug,
        description: row.description,
        minTeamSize: row.minTeamSize,
        maxTeamSize: row.maxTeamSize,
        createdAt: row.createdAt.toISOString(),
    };
}

function toMilestone(row: MilestoneRow): Milestone {
    return {
        id: row.id,
        organizationId: row.organizationId,
        editionId: row.editionId,
        title: row.title,
        description: row.description,
        kind: row.kind,
        occursAt: row.occursAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
    };
}

function toPublicCompetition(
    row: PublicEditionRow,
    organization: OrganizationSummary,
    publishedProjectCount: number,
): PublicCompetition {
    return {
        editionId: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        themeName: row.themeName,
        themeDescription: row.themeDescription,
        showScores: row.showScores,
        showRanking: row.showRanking,
        status: row.status,
        organizationName: organization.name,
        organizationSlug: organization.slug,
        seriesName: row.seriesName,
        startsAt: nullableIso(row.startsAt),
        endsAt: nullableIso(row.endsAt),
        registrationClosesAt: nullableIso(row.registrationClosesAt),
        teamMinSize: row.teamMinSize,
        teamMaxSize: row.teamMaxSize,
        publishedProjectCount,
    };
}

function parseNullable(value: string | null): Date | null {
    return value === null ? null : new Date(value);
}

function nullableIso(value: Date | null): string | null {
    return value === null ? null : value.toISOString();
}
