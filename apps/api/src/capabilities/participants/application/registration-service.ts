import type {
    MyParticipation,
    RegisterForCompetitionRequest,
    Registration,
    DecideRegistrationRequest,
} from "@nethack/contracts";
import type { AuthContext } from "../../../authentication/types.js";
import type { CompetitionsContract, EditionSummary } from "../../competitions/contracts.js";
import type { Clock } from "../../../core/clock.js";
import { domainEvents } from "../../../core/domain-event.js";
import {
    ConflictError,
    InternalError,
    isUniqueViolationError as isUniqueViolation,
    NotFoundError,
    ValidationError,
} from "../../../core/errors.js";
import type { OutboxPublisher } from "../../../core/outbox.js";
import type { AuditLogger } from "../../../infrastructure/audit/audit-logger.js";
import type {
    DatabaseConnection,
    DatabaseSession,
} from "../../../infrastructure/database/client.js";
import type { OrganizationsContract } from "../../organizations/contracts.js";
import { RegistrationRules } from "../domain/registration-rules.js";
import type {
    EditionLockRow,
    ParticipationRow,
    RegistrationRepository,
    RegistrationViewRow,
} from "../infrastructure/registration-repository.js";

export class RegistrationService {
    private readonly database: DatabaseConnection;
    private readonly repository: RegistrationRepository;
    private readonly competitions: CompetitionsContract;
    private readonly organizations: OrganizationsContract;
    private readonly events: OutboxPublisher;
    private readonly audit: AuditLogger;
    private readonly clock: Clock;

    constructor(
        database: DatabaseConnection,
        repository: RegistrationRepository,
        competitions: CompetitionsContract,
        organizations: OrganizationsContract,
        events: OutboxPublisher,
        audit: AuditLogger,
        clock: Clock,
    ) {
        this.database = database;
        this.repository = repository;
        this.competitions = competitions;
        this.organizations = organizations;
        this.events = events;
        this.audit = audit;
        this.clock = clock;
    }

    async register(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
        input: RegisterForCompetitionRequest,
        ip: string | null,
    ): Promise<Registration> {
        const edition = await this.requireEdition(organizationId, editionId);
        const organization = await this.requireOrganization(organizationId);
        if (input.divisionId !== null) {
            const division = await this.competitions.getDivision(organizationId, input.divisionId);
            if (division === null || division.editionId !== editionId) {
                throw new ValidationError("The division does not belong to this competition.");
            }
        }
        const now = this.clock.now();
        try {
            const row = await this.database.transaction(
                { organizationId, userId: auth.user.id },
                async (session) => {
                    const locked = await this.requireLockedEdition(
                        session,
                        organizationId,
                        editionId,
                    );
                    RegistrationRules.assertRegistrationOpen(
                        {
                            status: locked.status,
                            registrationOpensAt: locked.registrationOpensAt,
                            registrationClosesAt: locked.registrationClosesAt,
                        },
                        now,
                    );
                    const existing = await this.repository.findRegistration(
                        session.db,
                        organizationId,
                        editionId,
                        auth.user.id,
                    );
                    if (existing !== null) {
                        throw new ConflictError("You are already registered for this competition.");
                    }
                    const approvedCount = await this.repository.countParticipants(
                        session.db,
                        organizationId,
                        editionId,
                    );
                    const status = RegistrationRules.initialStatus(
                        locked.maxParticipants,
                        approvedCount,
                    );
                    const registration = await this.repository.insertRegistration(session, {
                        organizationId,
                        editionId,
                        userId: auth.user.id,
                        divisionId: input.divisionId,
                        status,
                        note: input.note,
                    });
                    await this.audit.record(session, {
                        organizationId,
                        actorUserId: auth.user.id,
                        action: "participant.registration.requested",
                        entityType: "registration",
                        entityId: registration.id,
                        metadata: { editionId, status },
                        ip,
                    });
                    await this.events.publish(session, {
                        type: domainEvents.registrationRequested,
                        organizationId,
                        aggregateType: "registration",
                        aggregateId: registration.id,
                        payload: {
                            userId: auth.user.id,
                            email: auth.user.email,
                            registrationId: registration.id,
                            organizationId,
                            editionId,
                            editionName: edition.name,
                            organizationName: organization.name,
                            status,
                        },
                    });
                    return registration;
                },
            );
            return {
                id: row.id,
                organizationId: row.organizationId,
                editionId: row.editionId,
                userId: row.userId,
                participantId: null,
                displayName: auth.user.displayName,
                email: auth.user.email,
                divisionId: row.divisionId,
                status: row.status,
                note: row.note,
                createdAt: row.createdAt.toISOString(),
                decidedAt: null,
                decidedByUserId: null,
            };
        } catch (error) {
            throw this.rethrowUnique(error, "You are already registered for this competition.");
        }
    }

    async list(organizationId: string, editionId: string): Promise<readonly Registration[]> {
        await this.requireEdition(organizationId, editionId);
        const rows = await this.database.transaction({ organizationId }, (session) =>
            this.repository.listRegistrationViews(session.db, organizationId, editionId),
        );
        return rows.map(toRegistration);
    }

    async decide(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
        registrationId: string,
        input: DecideRegistrationRequest,
        ip: string | null,
    ): Promise<Registration> {
        const edition = await this.requireEdition(organizationId, editionId);
        const organization = await this.requireOrganization(organizationId);
        const now = this.clock.now();
        try {
            const view = await this.database.transaction(
                { organizationId, userId: auth.user.id },
                async (session) => {
                    const locked = await this.requireLockedEdition(
                        session,
                        organizationId,
                        editionId,
                    );
                    const registration = await this.repository.findRegistrationByIdForUpdate(
                        session,
                        organizationId,
                        editionId,
                        registrationId,
                    );
                    if (registration === null) {
                        throw new NotFoundError("The registration was not found.");
                    }
                    RegistrationRules.assertCanDecide(registration.status, input.status);
                    if (input.status === "approved") {
                        const approvedCount = await this.repository.countParticipants(
                            session.db,
                            organizationId,
                            editionId,
                        );
                        RegistrationRules.assertCapacity(locked.maxParticipants, approvedCount);
                        await this.repository.insertParticipant(session, {
                            organizationId,
                            editionId,
                            userId: registration.userId,
                            divisionId: registration.divisionId,
                            registeredAt: now,
                        });
                    }
                    const updated = await this.repository.updateRegistration(
                        session,
                        registration.id,
                        {
                            status: input.status,
                            note: input.note,
                            decidedByUserId: auth.user.id,
                            decidedAt: now,
                            updatedAt: now,
                        },
                    );
                    if (updated === null) {
                        throw new NotFoundError("The registration was not found.");
                    }
                    const current = await this.repository.findRegistrationView(
                        session.db,
                        organizationId,
                        editionId,
                        registration.userId,
                    );
                    if (current === null) {
                        throw new InternalError("The registration could not be reloaded.");
                    }
                    await this.audit.record(session, {
                        organizationId,
                        actorUserId: auth.user.id,
                        action: "participant.registration.decided",
                        entityType: "registration",
                        entityId: registration.id,
                        metadata: { editionId, status: input.status },
                        ip,
                    });
                    await this.events.publish(session, {
                        type: domainEvents.registrationDecided,
                        organizationId,
                        aggregateType: "registration",
                        aggregateId: registration.id,
                        payload: {
                            userId: registration.userId,
                            email: current.email,
                            registrationId: registration.id,
                            organizationId,
                            editionId,
                            editionName: edition.name,
                            organizationName: organization.name,
                            status: input.status,
                        },
                    });
                    return current;
                },
            );
            return toRegistration(view);
        } catch (error) {
            throw this.rethrowUnique(error, "The participant already exists.");
        }
    }

    async withdraw(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
        ip: string | null,
    ): Promise<void> {
        await this.requireEdition(organizationId, editionId);
        const now = this.clock.now();
        await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const registration = await this.repository.findRegistrationForUserForUpdate(
                    session,
                    organizationId,
                    editionId,
                    auth.user.id,
                );
                if (registration === null) {
                    throw new NotFoundError("The registration was not found.");
                }
                RegistrationRules.assertWithdrawable(registration.status);
                const participant = await this.repository.findParticipant(
                    session.db,
                    organizationId,
                    editionId,
                    auth.user.id,
                );
                if (participant !== null) {
                    RegistrationRules.assertNoTeam(participant.teamId);
                    await this.repository.deleteParticipant(session, participant.id);
                }
                await this.repository.withdrawRegistration(session, registration.id, now);
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "participant.registration.withdrawn",
                    entityType: "registration",
                    entityId: registration.id,
                    metadata: { editionId },
                    ip,
                });
            },
        );
    }

    async myParticipations(auth: AuthContext): Promise<readonly MyParticipation[]> {
        const perOrganization = await Promise.all(
            auth.memberships
                .filter((membership) => membership.status === "active")
                .map((membership) =>
                    this.database.transaction(
                        {
                            organizationId: membership.organizationId,
                            userId: auth.user.id,
                        },
                        (session) =>
                            this.repository.listParticipationsForUser(
                                session.db,
                                membership.organizationId,
                                auth.user.id,
                            ),
                    ),
                ),
        );
        const rows: ParticipationRow[] = perOrganization.flat();

        const organizations = new Map<string, string>();
        await Promise.all(
            [...new Set(rows.map((row) => row.organizationId))].map(async (organizationId) => {
                const summary = await this.organizations.getSummary(organizationId);
                if (summary !== null) {
                    organizations.set(organizationId, summary.name);
                }
            }),
        );
        const editions = new Map<string, EditionSummary>();
        await Promise.all(
            [...new Set(rows.map((row) => `${row.organizationId}:${row.editionId}`))].map(
                async (key) => {
                    const separator = key.indexOf(":");
                    const organizationId = key.slice(0, separator);
                    const editionId = key.slice(separator + 1);
                    const edition = await this.competitions.getEdition(organizationId, editionId);
                    if (edition !== null) {
                        editions.set(key, edition);
                    }
                },
            ),
        );

        const items: MyParticipation[] = [];
        for (const row of rows) {
            const organizationName = organizations.get(row.organizationId);
            const edition = editions.get(`${row.organizationId}:${row.editionId}`);
            if (organizationName === undefined || edition === undefined) {
                continue;
            }
            items.push({
                organizationId: row.organizationId,
                editionId: row.editionId,
                editionName: edition.name,
                editionSlug: edition.slug,
                organizationName,
                status: row.status,
                divisionId: row.participantDivisionId ?? row.divisionId,
                teamId: row.teamId,
                registeredAt: (row.participantRegisteredAt ?? row.createdAt).toISOString(),
            });
        }
        items.sort((left, right) => right.registeredAt.localeCompare(left.registeredAt));
        return items;
    }

    private async requireEdition(
        organizationId: string,
        editionId: string,
    ): Promise<EditionSummary> {
        const edition = await this.competitions.getEdition(organizationId, editionId);
        if (edition === null) {
            throw new NotFoundError("The competition edition was not found.");
        }
        return edition;
    }

    private async requireOrganization(organizationId: string) {
        const organization = await this.organizations.getSummary(organizationId);
        if (organization === null) {
            throw new NotFoundError("The organization was not found.");
        }
        return organization;
    }

    private async requireLockedEdition(
        session: DatabaseSession,
        organizationId: string,
        editionId: string,
    ): Promise<EditionLockRow> {
        const locked = await this.repository.lockEdition(session, organizationId, editionId);
        if (locked === null) {
            throw new NotFoundError("The competition edition was not found.");
        }
        return locked;
    }

    private rethrowUnique(error: unknown, message: string): unknown {
        return isUniqueViolation(error) ? new ConflictError(message) : error;
    }
}

function toRegistration(row: RegistrationViewRow): Registration {
    return {
        id: row.id,
        organizationId: row.organizationId,
        editionId: row.editionId,
        userId: row.userId,
        participantId: row.participantId,
        displayName: row.displayName,
        email: row.email,
        divisionId: row.divisionId,
        status: row.status,
        note: row.note,
        createdAt: row.createdAt.toISOString(),
        decidedAt: row.decidedAt === null ? null : row.decidedAt.toISOString(),
        decidedByUserId: row.decidedByUserId,
    };
}

