import { randomUUID } from "node:crypto";
import type {
    AddOrganizationMemberRequest,
    CreateOrganizationRequest,
    Organization,
    OrganizationInvitation,
    OrganizationMembership,
    OrganizationRole,
    OrganizationSettings,
    UpdateOrganizationMemberRequest,
    UpdateOrganizationRequest,
    UpdateOrganizationSettingsRequest,
} from "@nethack/contracts";
import { randomToken, sha256Hex } from "../../../authentication/crypto.js";
import type { AuthContext } from "../../../authentication/types.js";
import type { Clock } from "../../../core/clock.js";
import {
    ConflictError,
    ForbiddenError,
    isUniqueViolationError as isUniqueViolation,
    NotFoundError,
    ValidationError,
} from "../../../core/errors.js";
import { domainEvents } from "../../../core/domain-event.js";
import type { DatabaseConnection } from "../../../infrastructure/database/client.js";
import type { OutboxPublisher } from "../../../core/outbox.js";
import type { AuditLogger } from "../../../infrastructure/audit/audit-logger.js";
import { OrganizationRules } from "../domain/organization-rules.js";
import type { OrganizationMembershipActor } from "../contracts.js";
import type { OrganizationRepository } from "../infrastructure/organization-repository.js";

const INVITATION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export interface AddMemberResult {
    readonly kind: "membership" | "invitation";
    readonly membership: OrganizationMembership | null;
    readonly invitation: OrganizationInvitation | null;
}

export class OrganizationService {
    private readonly database: DatabaseConnection;
    private readonly repository: OrganizationRepository;
    private readonly events: OutboxPublisher;
    private readonly audit: AuditLogger;
    private readonly clock: Clock;

    constructor(
        database: DatabaseConnection,
        repository: OrganizationRepository,
        events: OutboxPublisher,
        audit: AuditLogger,
        clock: Clock,
    ) {
        this.database = database;
        this.repository = repository;
        this.events = events;
        this.audit = audit;
        this.clock = clock;
    }

    async list(auth: AuthContext): Promise<readonly Organization[]> {
        const rows = await this.repository.listForUser(this.database.db, auth.user.id);
        return rows.map(toOrganization);
    }

    async create(
        auth: AuthContext,
        input: CreateOrganizationRequest,
        ip: string | null,
    ): Promise<Organization> {
        const existing = await this.repository.findBySlug(this.database.db, input.slug);
        if (existing !== null) {
            throw new ConflictError("That organization slug is already in use.");
        }
        const organizationId = randomUUID();
        try {
            const created = await this.database.transaction(
                { organizationId, userId: auth.user.id },
                async (session) => {
                    const organization = await this.repository.insert(session, {
                        id: organizationId,
                        name: input.name,
                        slug: input.slug,
                        description: input.description,
                        websiteUrl: input.websiteUrl,
                    });
                    await this.repository.insertSettings(session, organizationId);
                    await this.repository.addMembership(session, {
                        organizationId,
                        userId: auth.user.id,
                        role: "owner",
                    });
                    await this.audit.record(session, {
                        organizationId,
                        actorUserId: auth.user.id,
                        action: "organization.created",
                        entityType: "organization",
                        entityId: organizationId,
                        metadata: { slug: input.slug },
                        ip,
                    });
                    await this.events.publish(session, {
                        type: domainEvents.organizationCreated,
                        organizationId,
                        aggregateType: "organization",
                        aggregateId: organizationId,
                        payload: {
                            organizationId,
                            name: organization.name,
                            slug: organization.slug,
                            ownerUserId: auth.user.id,
                        },
                    });
                    return organization;
                },
            );
            return toOrganization(created);
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new ConflictError("That organization slug is already in use.");
            }
            throw error;
        }
    }

    async get(organizationId: string): Promise<Organization> {
        const organization = await this.repository.findById(this.database.db, organizationId);
        if (organization === null) {
            throw new NotFoundError("The organization was not found.");
        }
        return toOrganization(organization);
    }

    async update(
        auth: AuthContext,
        organizationId: string,
        input: UpdateOrganizationRequest,
        ip: string | null,
    ): Promise<Organization> {
        const now = this.clock.now();
        const updated = await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const organization = await this.repository.update(session, organizationId, {
                    ...(input.name === undefined ? {} : { name: input.name }),
                    ...(input.description === undefined ? {} : { description: input.description }),
                    ...(input.websiteUrl === undefined ? {} : { websiteUrl: input.websiteUrl }),
                    updatedAt: now,
                });
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "organization.updated",
                    entityType: "organization",
                    entityId: organizationId,
                    metadata: { fields: Object.keys(input) },
                    ip,
                });
                return organization;
            },
        );
        return toOrganization(updated);
    }

    async members(organizationId: string): Promise<readonly OrganizationMembership[]> {
        const rows = await this.repository.listMembers(this.database.db, organizationId);
        return rows.map(toOrganizationMembership);
    }

    async listMembershipsWithUsers(
        organizationId: string,
    ): Promise<readonly OrganizationMembership[]> {
        return this.members(organizationId);
    }

    async updateMemberRole(
        actor: OrganizationMembershipActor,
        organizationId: string,
        targetUserId: string,
        role: OrganizationRole,
    ): Promise<OrganizationMembership> {
        const updated = await this.database.transaction(
            { organizationId, userId: actor.userId },
            async (session) => {
                const memberships = await this.repository.lockMemberships(session, organizationId);
                const target = memberships.find((row) => row.userId === targetUserId);
                if (target === undefined) {
                    throw new NotFoundError("The membership was not found.");
                }
                const ownerCount = memberships.filter((row) => row.role === "owner").length;
                OrganizationRules.assertRoleChangeIsSafe(target.role, role, ownerCount);
                const changed = await this.repository.updateMembership(
                    session,
                    organizationId,
                    targetUserId,
                    { role, updatedAt: this.clock.now() },
                );
                if (!changed) {
                    throw new NotFoundError("The membership was not found.");
                }
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: actor.userId,
                    action: "organization.membership.updated",
                    entityType: "organization_membership",
                    entityId: targetUserId,
                    metadata: { from: target.role, role },
                    ip: actor.ip,
                });
                const member = await this.repository.memberWithUser(
                    session.db,
                    organizationId,
                    targetUserId,
                );
                if (member === null) {
                    throw new Error("The updated membership could not be read back.");
                }
                return member;
            },
        );
        return toOrganizationMembership(updated);
    }

    async addMember(
        auth: AuthContext,
        organizationId: string,
        input: AddOrganizationMemberRequest,
        ip: string | null,
    ): Promise<AddMemberResult> {
        const organization = await this.get(organizationId);
        const email = input.email.toLowerCase();
        const role = input.role ?? "participant";
        const existingUser = await this.repository.findUserByEmail(this.database.db, email);

        if (existingUser !== null) {
            const membership = await this.repository.membership(
                this.database.db,
                organizationId,
                existingUser.id,
            );
            if (membership !== null) {
                throw new ConflictError("That person is already a member of this organization.");
            }
            const now = this.clock.now();
            await this.database.transaction(
                { organizationId, userId: auth.user.id },
                async (session) => {
                    await this.repository.addMembership(session, {
                        organizationId,
                        userId: existingUser.id,
                        role,
                    });
                    await this.audit.record(session, {
                        organizationId,
                        actorUserId: auth.user.id,
                        action: "organization.membership.added",
                        entityType: "membership",
                        entityId: existingUser.id,
                        metadata: { role },
                        ip,
                    });
                    await this.events.publish(session, {
                        type: domainEvents.membershipGranted,
                        organizationId,
                        aggregateType: "organization",
                        aggregateId: organizationId,
                        payload: {
                            userId: existingUser.id,
                            email: existingUser.email,
                            organizationId,
                            organizationName: organization.name,
                            role,
                        },
                    });
                },
            );
            return {
                kind: "membership",
                membership: {
                    organizationId,
                    userId: existingUser.id,
                    role,
                    status: "active",
                    displayName: existingUser.displayName,
                    email: existingUser.email,
                    createdAt: now.toISOString(),
                },
                invitation: null,
            };
        }

        const token = randomToken(32);
        const expiresAt = new Date(this.clock.now().getTime() + INVITATION_TTL_MS);
        const invitationId = await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const invitation = await this.repository.createInvitation(session, {
                    organizationId,
                    email,
                    role,
                    tokenHash: sha256Hex(token),
                    invitedByUserId: auth.user.id,
                    expiresAt,
                });
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "organization.invitation.created",
                    entityType: "invitation",
                    entityId: invitation.id,
                    metadata: { role },
                    ip,
                });
                await this.events.publish(session, {
                    type: "organizations.invitation.created",
                    organizationId,
                    aggregateType: "organization",
                    aggregateId: organizationId,
                    payload: {
                        invitationId: invitation.id,
                        email,
                        organizationId,
                        organizationName: organization.name,
                        role,
                        token,
                        expiresAt: expiresAt.toISOString(),
                    },
                });
                return invitation.id;
            },
        );

        return {
            kind: "invitation",
            membership: null,
            invitation: {
                id: invitationId,
                organizationId,
                email,
                role,
                status: "pending",
                expiresAt: expiresAt.toISOString(),
                createdAt: this.clock.now().toISOString(),
            },
        };
    }

    async invitations(organizationId: string): Promise<readonly OrganizationInvitation[]> {
        const rows = await this.repository.listInvitations(this.database.db, organizationId);
        return rows.map((row) => ({
            id: row.id,
            organizationId: row.organizationId,
            email: row.email,
            role: row.role,
            status: row.status as OrganizationInvitation["status"],
            expiresAt: row.expiresAt.toISOString(),
            createdAt: row.createdAt.toISOString(),
        }));
    }

    async acceptInvitation(
        auth: AuthContext,
        token: string,
        ip: string | null,
    ): Promise<{ organization: Organization; role: OrganizationRole }> {
        if (auth.user.email === null) {
            throw new ForbiddenError("Your account has no email address to match an invitation.");
        }
        const invitation = await this.repository.findInvitationByTokenHash(
            this.database.db,
            sha256Hex(token),
        );
        if (invitation === null) {
            throw new NotFoundError("The invitation was not found.");
        }
        if (invitation.status !== "pending" || invitation.expiresAt <= this.clock.now()) {
            throw new ConflictError("The invitation is no longer valid.");
        }
        if (invitation.email.toLowerCase() !== auth.user.email.toLowerCase()) {
            throw new ForbiddenError("This invitation was issued to a different email address.");
        }
        const organization = await this.get(invitation.organizationId);
        await this.database.transaction(
            { organizationId: invitation.organizationId, userId: auth.user.id },
            async (session) => {
                const existing = await this.repository.membership(
                    session.db,
                    invitation.organizationId,
                    auth.user.id,
                );
                if (existing !== null) {
                    throw new ConflictError("You are already a member of this organization.");
                }
                await this.repository.addMembership(session, {
                    organizationId: invitation.organizationId,
                    userId: auth.user.id,
                    role: invitation.role,
                });
                await this.repository.markInvitationAccepted(
                    session,
                    invitation.id,
                    auth.user.id,
                    this.clock.now(),
                );
                await this.audit.record(session, {
                    organizationId: invitation.organizationId,
                    actorUserId: auth.user.id,
                    action: "organization.invitation.accepted",
                    entityType: "invitation",
                    entityId: invitation.id,
                    metadata: { role: invitation.role },
                    ip,
                });
                await this.events.publish(session, {
                    type: domainEvents.membershipGranted,
                    organizationId: invitation.organizationId,
                    aggregateType: "organization",
                    aggregateId: invitation.organizationId,
                    payload: {
                        userId: auth.user.id,
                        email: auth.user.email,
                        organizationId: invitation.organizationId,
                        organizationName: organization.name,
                        role: invitation.role,
                    },
                });
            },
        );
        return { organization, role: invitation.role };
    }

    async updateMember(
        auth: AuthContext,
        organizationId: string,
        targetUserId: string,
        input: UpdateOrganizationMemberRequest,
        ip: string | null,
    ): Promise<void> {
        const membership = await this.repository.membership(
            this.database.db,
            organizationId,
            targetUserId,
        );
        if (membership === null) {
            throw new NotFoundError("The membership was not found.");
        }
        const ownerCount = await this.repository.countOwners(this.database.db, organizationId);
        if (input.role !== undefined) {
            OrganizationRules.assertRoleChangeIsSafe(membership.role, input.role, ownerCount);
        }
        if (input.status === "suspended" && membership.role === "owner") {
            OrganizationRules.assertRemovalIsSafe(membership.role, ownerCount);
        }
        await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const updated = await this.repository.updateMembership(
                    session,
                    organizationId,
                    targetUserId,
                    {
                        ...(input.role === undefined ? {} : { role: input.role }),
                        ...(input.status === undefined ? {} : { status: input.status }),
                        updatedAt: this.clock.now(),
                    },
                );
                if (!updated) {
                    throw new NotFoundError("The membership was not found.");
                }
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "organization.membership.updated",
                    entityType: "membership",
                    entityId: targetUserId,
                    metadata: {
                        ...(input.role === undefined ? {} : { role: input.role }),
                        ...(input.status === undefined ? {} : { status: input.status }),
                    },
                    ip,
                });
            },
        );
    }

    async removeMember(
        auth: AuthContext,
        organizationId: string,
        targetUserId: string,
        ip: string | null,
    ): Promise<void> {
        const membership = await this.repository.membership(
            this.database.db,
            organizationId,
            targetUserId,
        );
        if (membership === null) {
            throw new NotFoundError("The membership was not found.");
        }
        const ownerCount = await this.repository.countOwners(this.database.db, organizationId);
        OrganizationRules.assertRemovalIsSafe(membership.role, ownerCount);
        await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                await this.repository.removeMembership(session, organizationId, targetUserId);
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "organization.membership.removed",
                    entityType: "membership",
                    entityId: targetUserId,
                    ip,
                });
                await this.events.publish(session, {
                    type: domainEvents.membershipRevoked,
                    organizationId,
                    aggregateType: "organization",
                    aggregateId: organizationId,
                    payload: { userId: targetUserId, organizationId },
                });
            },
        );
    }

    async settings(organizationId: string): Promise<OrganizationSettings> {
        const row = await this.repository.settings(this.database.db, organizationId);
        return {
            organizationId: row.organizationId,
            registrationRequiresApproval: row.registrationRequiresApproval,
            allowParticipantTeamCreation: row.allowParticipantTeamCreation,
            publicShowcaseEnabled: row.publicShowcaseEnabled,
            updatedAt: row.updatedAt.toISOString(),
        };
    }

    async updateSettings(
        auth: AuthContext,
        organizationId: string,
        input: UpdateOrganizationSettingsRequest,
        ip: string | null,
    ): Promise<OrganizationSettings> {
        if (
            input.registrationRequiresApproval === undefined &&
            input.allowParticipantTeamCreation === undefined &&
            input.publicShowcaseEnabled === undefined
        ) {
            throw new ValidationError("Provide at least one setting.");
        }
        await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                await this.repository.updateSettings(session, organizationId, {
                    ...(input.registrationRequiresApproval === undefined
                        ? {}
                        : { registrationRequiresApproval: input.registrationRequiresApproval }),
                    ...(input.allowParticipantTeamCreation === undefined
                        ? {}
                        : { allowParticipantTeamCreation: input.allowParticipantTeamCreation }),
                    ...(input.publicShowcaseEnabled === undefined
                        ? {}
                        : { publicShowcaseEnabled: input.publicShowcaseEnabled }),
                    updatedAt: this.clock.now(),
                });
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "organization.settings.updated",
                    entityType: "organization_settings",
                    entityId: organizationId,
                    metadata: { fields: Object.keys(input) },
                    ip,
                });
            },
        );
        return this.settings(organizationId);
    }

    async auditPage(
        organizationId: string,
        options: {
            limit: number;
            before: Date | null;
            action: string | null;
            entityType: string | null;
            actorUserId: string | null;
        },
    ) {
        const rows = await this.repository.auditPage(this.database.db, organizationId, options);
        return rows.map((row) => ({
            id: row.id,
            organizationId: row.organizationId,
            actorUserId: row.actorUserId,
            actorDisplayName: row.actorDisplayName,
            action: row.action,
            entityType: row.entityType,
            entityId: row.entityId,
            metadata: row.metadata,
            createdAt: row.createdAt.toISOString(),
        }));
    }
}

function toOrganizationMembership(row: {
    organizationId: string;
    userId: string;
    role: OrganizationRole;
    status: "active" | "suspended";
    displayName: string;
    email: string | null;
    createdAt: Date;
}): OrganizationMembership {
    return {
        organizationId: row.organizationId,
        userId: row.userId,
        role: row.role,
        status: row.status,
        displayName: row.displayName,
        email: row.email,
        createdAt: row.createdAt.toISOString(),
    };
}

function toOrganization(row: {
    id: string;
    name: string;
    slug: string;
    description: string;
    websiteUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
}): Organization {
    return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        websiteUrl: row.websiteUrl,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    };
}
