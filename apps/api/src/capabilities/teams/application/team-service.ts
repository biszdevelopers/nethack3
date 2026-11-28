import { randomUUID } from "node:crypto";
import type {
    AuditLog,
    CreateTeamRequest,
    OrganizationRole,
    Team,
    TeamDetail,
    TeamInvitation,
    TeamInvitationAcceptance,
    TeamInvitationStatus,
    TeamStatus,
    UpdateTeamRequest,
} from "@nethack/contracts";
import { randomToken, sha256Hex } from "../../../authentication/crypto.js";
import type { AuthContext } from "../../../authentication/types.js";
import type { Clock } from "../../../core/clock.js";
import {
    ConflictError,
    databaseErrorDetails,
    ForbiddenError,
    isUniqueViolationError as isUniqueViolation,
    NotFoundError,
} from "../../../core/errors.js";
import { domainEvents } from "../../../core/domain-event.js";
import type { OutboxPublisher } from "../../../core/outbox.js";
import type {
    DatabaseConnection,
    DatabaseSession,
} from "../../../infrastructure/database/client.js";
import type { AuditLogger } from "../../../infrastructure/audit/audit-logger.js";
import type {
    CompetitionsContract,
    DivisionSummary,
    EditionSummary,
} from "../../competitions/contracts.js";
import type { ParticipantsContract } from "../../participants/contracts.js";
import type { OrganizationsContract } from "../../organizations/contracts.js";
import { TeamRules } from "../domain/team-rules.js";
import type { TeamMemberSummary, TeamWithMembers } from "../contracts.js";
import type {
    InvitationWithTeam,
    TeamInvitationRow,
    TeamMemberRow,
    TeamRepository,
    TeamRow,
} from "../infrastructure/team-repository.js";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ORGANIZER_ROLES: readonly OrganizationRole[] = ["owner", "organizer"];
const ORGANIZER_ONLY_TEAM_STATUSES: ReadonlySet<TeamStatus> = new Set(["disqualified", "no_show"]);

export class TeamService {
    private readonly database: DatabaseConnection;
    private readonly repository: TeamRepository;
    private readonly events: OutboxPublisher;
    private readonly audit: AuditLogger;
    private readonly clock: Clock;
    private readonly competitions: CompetitionsContract;
    private readonly participants: ParticipantsContract;
    private readonly organizations: OrganizationsContract;

    constructor(
        database: DatabaseConnection,
        repository: TeamRepository,
        events: OutboxPublisher,
        audit: AuditLogger,
        clock: Clock,
        competitions: CompetitionsContract,
        participants: ParticipantsContract,
        organizations: OrganizationsContract,
    ) {
        this.database = database;
        this.repository = repository;
        this.events = events;
        this.audit = audit;
        this.clock = clock;
        this.competitions = competitions;
        this.participants = participants;
        this.organizations = organizations;
    }

    async list(organizationId: string, editionId: string): Promise<readonly Team[]> {
        await this.resolveEdition(organizationId, editionId);
        return this.database.transaction({ organizationId }, async (session) => {
            const rows = await this.repository.listByEdition(session.db, organizationId, editionId);
            return rows.map((row) => toTeam(row, row.memberCount));
        });
    }

    async listMine(organizationId: string, userId: string): Promise<readonly Team[]> {
        return this.database.transaction({ organizationId, userId }, async (session) => {
            const rows = await this.repository.listForUser(session.db, organizationId, userId);
            return rows.map((row) => toTeam(row, row.memberCount));
        });
    }

    async listEditionTeamsWithMembers(
        organizationId: string,
        editionId: string,
    ): Promise<readonly TeamWithMembers[]> {
        await this.resolveEdition(organizationId, editionId);
        return this.database.transaction({ organizationId }, async (session) => {
            const rows = await this.repository.listByEdition(session.db, organizationId, editionId);
            const members = await this.repository.membersForEdition(
                session.db,
                organizationId,
                editionId,
            );
            const byTeam = new Map<string, TeamMemberSummary[]>();
            for (const member of members) {
                const list = byTeam.get(member.teamId) ?? [];
                list.push({
                    userId: member.userId,
                    displayName: member.displayName,
                    avatarUrl: member.avatarUrl,
                    role: member.role,
                    joinedAt: member.joinedAt.toISOString(),
                });
                byTeam.set(member.teamId, list);
            }
            return rows.map((row) => ({
                ...toTeam(row, row.memberCount),
                members: byTeam.get(row.id) ?? [],
            }));
        });
    }

    async updateTeamStatus(
        actor: { readonly userId: string; readonly ip: string | null },
        organizationId: string,
        editionId: string,
        teamId: string,
        status: TeamStatus,
    ): Promise<void> {
        await this.database.transaction(
            { organizationId, userId: actor.userId },
            async (session) => {
                const team = await this.repository.findByIdForUpdate(
                    session,
                    organizationId,
                    teamId,
                );
                if (team === null || team.editionId !== editionId) {
                    throw new NotFoundError("The team was not found in this edition.");
                }
                TeamRules.assertStatusTransition(team.status, status);
                await this.repository.update(session, teamId, {
                    status,
                    updatedAt: this.clock.now(),
                });
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: actor.userId,
                    action: "team.updated",
                    entityType: "team",
                    entityId: teamId,
                    metadata: { fields: ["status"], status },
                    ip: actor.ip,
                });
            },
        );
    }

    async deleteTeam(
        actor: { readonly userId: string; readonly ip: string | null },
        organizationId: string,
        editionId: string,
        teamId: string,
    ): Promise<void> {
        await this.database.transaction(
            { organizationId, userId: actor.userId },
            async (session) => {
                const team = await this.repository.findByIdForUpdate(
                    session,
                    organizationId,
                    teamId,
                );
                if (team === null || team.editionId !== editionId) {
                    throw new NotFoundError("The team was not found in this edition.");
                }
                const memberCount = await this.repository.countMembers(session.db, teamId);
                TeamRules.assertCanDelete(memberCount);
                const deleted = await this.repository.delete(
                    session,
                    organizationId,
                    editionId,
                    teamId,
                );
                if (!deleted) {
                    throw new NotFoundError("The team was not found in this edition.");
                }
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: actor.userId,
                    action: "team.deleted",
                    entityType: "team",
                    entityId: teamId,
                    metadata: { name: team.name, editionId },
                    ip: actor.ip,
                });
            },
        );
    }

    async create(
        auth: AuthContext,
        organizationId: string,
        input: CreateTeamRequest,
        ip: string | null,
    ): Promise<Team> {
        const now = this.clock.now();
        const edition = await this.resolveEdition(organizationId, input.editionId);
        TeamRules.assertEditionAcceptsTeams(edition, now);
        TeamRules.requireApprovedRegistration(
            await this.participants.getRegistration(organizationId, input.editionId, auth.user.id),
        );
        const divisionId = input.divisionId;
        const division = await this.resolveDivision(organizationId, edition.id, divisionId);
        const limits = TeamRules.limits(edition, division);
        const teamId = randomUUID();

        try {
            const team = await this.database.transaction(
                { organizationId, userId: auth.user.id },
                async (session) => {
                    const locked = await this.repository.lockRegistration(
                        session,
                        organizationId,
                        input.editionId,
                        auth.user.id,
                    );
                    if (!locked) {
                        throw new ConflictError(
                            "Your participant registration is not ready for team creation.",
                        );
                    }
                    const existing = await this.repository.findByUserInEdition(
                        session.db,
                        organizationId,
                        input.editionId,
                        auth.user.id,
                    );
                    if (existing !== null) {
                        throw new ConflictError("You already belong to a team in this edition.");
                    }
                    const inserted = await this.repository.insert(session, {
                        id: teamId,
                        organizationId,
                        editionId: input.editionId,
                        divisionId,
                        name: input.name,
                        description: input.description,
                        captainUserId: auth.user.id,
                        maxMembers: limits.max,
                    });
                    await this.repository.insertMember(session, {
                        organizationId,
                        teamId,
                        userId: auth.user.id,
                        role: "captain",
                    });
                    await this.audit.record(session, {
                        organizationId,
                        actorUserId: auth.user.id,
                        action: "team.created",
                        entityType: "team",
                        entityId: teamId,
                        metadata: { name: inserted.name, editionId: edition.id },
                        ip,
                    });
                    await this.events.publish(session, {
                        type: domainEvents.teamCreated,
                        organizationId,
                        aggregateType: "team",
                        aggregateId: teamId,
                        payload: {
                            teamId,
                            teamName: inserted.name,
                            organizationId,
                            organizationName: await this.organizationName(organizationId),
                            captainUserId: auth.user.id,
                            captainEmail: auth.user.email,
                        },
                    });
                    return toTeam(inserted, 1);
                },
            );
            // The participant FK takes a key-share lock on the new team row.
            // Running it after commit avoids a self-deadlock against the team
            // FOR UPDATE lock owned by the transaction above.
            await this.participants.setParticipantTeam(
                organizationId,
                input.editionId,
                auth.user.id,
                teamId,
            );
            return team;
        } catch (error) {
            const constraint = uniqueConstraint(error);
            if (constraint === "team_members_team_user_unique") {
                throw new ConflictError("You already belong to a team in this edition.");
            }
            if (constraint !== null) {
                throw new ConflictError("That team name is already used in this edition.");
            }
            throw error;
        }
    }

    async detail(
        auth: AuthContext,
        organizationId: string,
        teamId: string,
        organizationRole: OrganizationRole,
    ): Promise<TeamDetail> {
        return this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const team = await this.repository.findById(session.db, organizationId, teamId);
                if (team === null) {
                    throw new NotFoundError("The team was not found.");
                }
                return this.buildDetail(session, team, auth.user.id, isOrganizer(organizationRole));
            },
        );
    }

    async update(
        auth: AuthContext,
        organizationId: string,
        teamId: string,
        organizationRole: OrganizationRole,
        input: UpdateTeamRequest,
        ip: string | null,
    ): Promise<TeamDetail> {
        try {
            return await this.database.transaction(
                { organizationId, userId: auth.user.id },
                async (session) => {
                    const team = await this.repository.findByIdForUpdate(
                        session,
                        organizationId,
                        teamId,
                    );
                    if (team === null) {
                        throw new NotFoundError("The team was not found.");
                    }
                    TeamRules.assertCaptainOrOrganizer(
                        team.captainUserId,
                        auth.user.id,
                        isOrganizer(organizationRole),
                    );
                    TeamRules.assertActiveTeam(team.status);
                    const edition = await this.resolveEdition(organizationId, team.editionId);
                    const divisionId =
                        input.divisionId === undefined ? team.divisionId : input.divisionId;
                    const division = await this.resolveDivision(
                        organizationId,
                        team.editionId,
                        divisionId,
                    );
                    const limits = TeamRules.limits(edition, division);
                    const memberCount = await this.repository.countMembers(session.db, teamId);
                    if (input.status === "ready") {
                        TeamRules.assertReady(memberCount, limits);
                    } else if (divisionId !== team.divisionId) {
                        TeamRules.assertWithinMax(memberCount, limits);
                    }
                    if (input.status !== undefined && input.status !== team.status) {
                        if (
                            !isOrganizer(organizationRole) &&
                            ORGANIZER_ONLY_TEAM_STATUSES.has(input.status)
                        ) {
                            throw new ForbiddenError(
                                "Only an organizer may disqualify a team or mark it as a no-show.",
                            );
                        }
                        TeamRules.assertStatusTransition(team.status, input.status);
                    }
                    const updated = await this.repository.update(session, teamId, {
                        ...(input.name === undefined ? {} : { name: input.name }),
                        ...(input.description === undefined
                            ? {}
                            : { description: input.description }),
                        ...(input.status === undefined ? {} : { status: input.status }),
                        ...(input.divisionId === undefined
                            ? {}
                            : { divisionId: input.divisionId, maxMembers: limits.max }),
                        updatedAt: this.clock.now(),
                    });
                    await this.audit.record(session, {
                        organizationId,
                        actorUserId: auth.user.id,
                        action: "team.updated",
                        entityType: "team",
                        entityId: teamId,
                        metadata: { fields: Object.keys(input) },
                        ip,
                    });
                    return this.buildDetail(
                        session,
                        updated,
                        auth.user.id,
                        isOrganizer(organizationRole),
                    );
                },
            );
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new ConflictError("That team name is already used in this edition.");
            }
            throw error;
        }
    }

    async invite(
        auth: AuthContext,
        organizationId: string,
        teamId: string,
        input: { readonly email: string },
        ip: string | null,
    ): Promise<TeamInvitation> {
        const now = this.clock.now();
        const email = input.email.toLowerCase();
        const token = randomToken(32);
        const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);

        try {
            return await this.database.transaction(
                { organizationId, userId: auth.user.id },
                async (session) => {
                    const team = await this.repository.findByIdForUpdate(
                        session,
                        organizationId,
                        teamId,
                    );
                    if (team === null) {
                        throw new NotFoundError("The team was not found.");
                    }
                    TeamRules.assertCaptainOnly(team.captainUserId, auth.user.id);
                    TeamRules.assertActiveTeam(team.status);
                    if (auth.user.email !== null && auth.user.email.toLowerCase() === email) {
                        throw new ConflictError("You cannot invite yourself to your team.");
                    }
                    const memberCount = await this.repository.countMembers(session.db, teamId);
                    TeamRules.assertCapacity(memberCount, {
                        min: 1,
                        max: team.maxMembers,
                    });
                    const invitedUser = await this.repository.userByEmail(session.db, email);
                    if (
                        invitedUser !== null &&
                        (await this.repository.findMember(session.db, teamId, invitedUser.id)) !==
                            null
                    ) {
                        throw new ConflictError("That person is already a member of this team.");
                    }
                    if (
                        (await this.repository.findInvitationByTeamAndEmail(
                            session.db,
                            teamId,
                            email,
                        )) !== null
                    ) {
                        throw new ConflictError("That email is already invited to this team.");
                    }
                    const invitation = await this.repository.insertInvitation(session, {
                        organizationId,
                        teamId,
                        email,
                        tokenHash: sha256Hex(token),
                        invitedByUserId: auth.user.id,
                        expiresAt,
                    });
                    await this.audit.record(session, {
                        organizationId,
                        actorUserId: auth.user.id,
                        action: "team.invitation.created",
                        entityType: "team",
                        entityId: teamId,
                        metadata: { invitationId: invitation.id, role: "member" },
                        ip,
                    });
                    await this.events.publish(session, {
                        type: domainEvents.teamInvitationCreated,
                        organizationId,
                        aggregateType: "team",
                        aggregateId: teamId,
                        payload: {
                            invitationId: invitation.id,
                            teamId,
                            teamName: team.name,
                            organizationId,
                            organizationName: await this.organizationName(organizationId),
                            email,
                            token,
                            role: "member",
                            expiresAt: expiresAt.toISOString(),
                        },
                    });
                    return {
                        id: invitation.id,
                        email,
                        status: "pending",
                        expiresAt: expiresAt.toISOString(),
                        createdAt: invitation.createdAt.toISOString(),
                    };
                },
            );
        } catch (error) {
            const constraint = uniqueConstraint(error);
            if (constraint === "team_invitations_team_email_unique") {
                throw new ConflictError("That email is already invited to this team.");
            }
            if (constraint !== null) {
                throw new ConflictError("The invitation could not be created. Try again.");
            }
            throw error;
        }
    }

    async acceptInvitation(
        auth: AuthContext,
        organizationId: string,
        token: string,
        ip: string | null,
    ): Promise<TeamInvitationAcceptance> {
        if (auth.user.email === null) {
            throw new ForbiddenError("Your account has no email address to match an invitation.");
        }
        const tokenHash = sha256Hex(token);
        const preview = await this.database.transaction({ organizationId }, async (session) =>
            this.repository.findInvitationByTokenHash(session.db, tokenHash),
        );
        if (preview === null) {
            throw new NotFoundError("The team invitation was not found.");
        }
        this.assertInvitationUsable(preview, auth.user.email, organizationId);
        if (
            !(await this.participants.isApprovedParticipant(
                preview.organizationId,
                preview.editionId,
                auth.user.id,
            ))
        ) {
            throw new ForbiddenError(
                "An approved participant registration is required to join a team.",
            );
        }

        const now = this.clock.now();
        try {
            const acceptance = await this.database.transaction(
                { organizationId: preview.organizationId, userId: auth.user.id },
                async (session) => {
                    const invitation = await this.repository.lockInvitationByTokenHash(
                        session,
                        tokenHash,
                    );
                    if (invitation === null) {
                        throw new NotFoundError("The team invitation was not found.");
                    }
                    this.assertInvitationUsable(invitation, auth.user.email ?? "", organizationId);
                    const team = await this.repository.findByIdForUpdate(
                        session,
                        invitation.organizationId,
                        invitation.teamId,
                    );
                    if (team === null) {
                        throw new NotFoundError("The team was not found.");
                    }
                    TeamRules.assertActiveTeam(team.status);
                    await this.repository.lockRegistration(
                        session,
                        invitation.organizationId,
                        invitation.editionId,
                        auth.user.id,
                    );
                    const existing = await this.repository.findByUserInEdition(
                        session.db,
                        invitation.organizationId,
                        invitation.editionId,
                        auth.user.id,
                    );
                    if (existing !== null) {
                        throw new ConflictError("You already belong to a team in this edition.");
                    }
                    const memberCount = await this.repository.countMembers(
                        session.db,
                        invitation.teamId,
                    );
                    TeamRules.assertCapacity(memberCount, {
                        min: 1,
                        max: invitation.maxMembers,
                    });
                    await this.repository.insertMember(session, {
                        organizationId: invitation.organizationId,
                        teamId: invitation.teamId,
                        userId: auth.user.id,
                        role: "member",
                    });
                    await this.repository.markInvitationAccepted(
                        session,
                        invitation.id,
                        auth.user.id,
                        now,
                    );
                    await this.audit.record(session, {
                        organizationId: invitation.organizationId,
                        actorUserId: auth.user.id,
                        action: "team.invitation.accepted",
                        entityType: "team",
                        entityId: invitation.teamId,
                        metadata: { invitationId: invitation.id },
                        ip,
                    });
                    await this.events.publish(session, {
                        type: domainEvents.teamInvitationAccepted,
                        organizationId: invitation.organizationId,
                        aggregateType: "team",
                        aggregateId: invitation.teamId,
                        payload: {
                            teamId: invitation.teamId,
                            teamName: invitation.teamName,
                            organizationId: invitation.organizationId,
                            organizationName: await this.organizationName(
                                invitation.organizationId,
                            ),
                            captainUserId: invitation.captainUserId,
                        },
                    });
                    return {
                        teamId: invitation.teamId,
                        teamName: invitation.teamName,
                        editionId: invitation.editionId,
                        organizationId: invitation.organizationId,
                        acceptedAt: now.toISOString(),
                    };
                },
            );
            // See create(): the participant FK update must run after the team
            // and invitation locks are released to avoid a self-deadlock.
            await this.participants.setParticipantTeam(
                acceptance.organizationId,
                acceptance.editionId,
                auth.user.id,
                acceptance.teamId,
            );
            return {
                teamId: acceptance.teamId,
                teamName: acceptance.teamName,
                acceptedAt: acceptance.acceptedAt,
            };
        } catch (error) {
            if (uniqueConstraint(error) === "team_members_team_user_unique") {
                throw new ConflictError("You already belong to a team in this edition.");
            }
            if (isUniqueViolation(error)) {
                throw new ConflictError("You are already a member of this team.");
            }
            throw error;
        }
    }

    async removeMember(
        auth: AuthContext,
        organizationId: string,
        teamId: string,
        targetUserId: string,
        organizationRole: OrganizationRole,
        ip: string | null,
    ): Promise<void> {
        await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const team = await this.repository.findByIdForUpdate(
                    session,
                    organizationId,
                    teamId,
                );
                if (team === null) {
                    throw new NotFoundError("The team was not found.");
                }
                const selfRemoval = targetUserId === auth.user.id;
                if (!selfRemoval) {
                    TeamRules.assertCaptainOrOrganizer(
                        team.captainUserId,
                        auth.user.id,
                        isOrganizer(organizationRole),
                    );
                }
                TeamRules.assertNotRemovingCaptain(team.captainUserId, targetUserId);
                const removed = await this.repository.removeMember(session, teamId, targetUserId);
                if (!removed) {
                    throw new NotFoundError("That person is not a member of this team.");
                }
                await this.participants.setParticipantTeam(
                    organizationId,
                    team.editionId,
                    targetUserId,
                    null,
                );
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "team.member.removed",
                    entityType: "team",
                    entityId: teamId,
                    metadata: { userId: targetUserId, self: selfRemoval },
                    ip,
                });
                await this.events.publish(session, {
                    type: domainEvents.teamMemberRemoved,
                    organizationId,
                    aggregateType: "team",
                    aggregateId: teamId,
                    payload: {
                        teamId,
                        teamName: team.name,
                        organizationId,
                        removedUserId: targetUserId,
                    },
                });
            },
        );
    }

    async transferCaptain(
        auth: AuthContext,
        organizationId: string,
        teamId: string,
        targetUserId: string,
        organizationRole: OrganizationRole,
        ip: string | null,
    ): Promise<void> {
        await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const team = await this.repository.findByIdForUpdate(
                    session,
                    organizationId,
                    teamId,
                );
                if (team === null) {
                    throw new NotFoundError("The team was not found.");
                }
                TeamRules.assertCaptainOrOrganizer(
                    team.captainUserId,
                    auth.user.id,
                    isOrganizer(organizationRole),
                );
                TeamRules.assertActiveTeam(team.status);
                if (team.captainUserId === targetUserId) {
                    return;
                }
                const target = await this.repository.findMember(session.db, teamId, targetUserId);
                if (target === null) {
                    throw new NotFoundError("That person is not a member of this team.");
                }
                const demoted = await this.repository.updateMemberRole(
                    session,
                    teamId,
                    team.captainUserId,
                    "member",
                );
                if (!demoted) {
                    throw new ConflictError("The current captain is not a team member.");
                }
                await this.repository.updateMemberRole(session, teamId, targetUserId, "captain");
                await this.repository.update(session, teamId, {
                    captainUserId: targetUserId,
                    updatedAt: this.clock.now(),
                });
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "team.captain.transferred",
                    entityType: "team",
                    entityId: teamId,
                    metadata: {
                        previousCaptainUserId: team.captainUserId,
                        captainUserId: targetUserId,
                    },
                    ip,
                });
            },
        );
    }

    async leave(
        auth: AuthContext,
        organizationId: string,
        teamId: string,
        ip: string | null,
    ): Promise<void> {
        await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const team = await this.repository.findByIdForUpdate(
                    session,
                    organizationId,
                    teamId,
                );
                if (team === null) {
                    throw new NotFoundError("The team was not found.");
                }
                TeamRules.assertCanLeave(team.captainUserId, auth.user.id);
                const removed = await this.repository.removeMember(session, teamId, auth.user.id);
                if (!removed) {
                    throw new NotFoundError("You are not a member of this team.");
                }
                await this.participants.setParticipantTeam(
                    organizationId,
                    team.editionId,
                    auth.user.id,
                    null,
                );
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "team.member.left",
                    entityType: "team",
                    entityId: teamId,
                    metadata: { userId: auth.user.id },
                    ip,
                });
                await this.events.publish(session, {
                    type: domainEvents.teamMemberRemoved,
                    organizationId,
                    aggregateType: "team",
                    aggregateId: teamId,
                    payload: {
                        teamId,
                        teamName: team.name,
                        organizationId,
                        removedUserId: auth.user.id,
                    },
                });
            },
        );
    }

    async activity(
        organizationId: string,
        teamId: string,
        userId: string,
        options: { readonly limit: number; readonly before: Date | null },
    ): Promise<readonly AuditLog[]> {
        return this.database.transaction({ organizationId, userId }, async (session) => {
            const team = await this.repository.findById(session.db, organizationId, teamId);
            if (team === null) {
                throw new NotFoundError("The team was not found.");
            }
            const member = await this.repository.findMember(session.db, teamId, userId);
            if (member === null) {
                throw new ForbiddenError("Only team members may view team activity.");
            }
            const rows = await this.repository.auditPage(
                session.db,
                organizationId,
                teamId,
                options,
            );
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
        });
    }

    private assertInvitationUsable(
        invitation: InvitationWithTeam,
        email: string,
        organizationId: string,
    ): void {
        if (invitation.organizationId !== organizationId) {
            throw new NotFoundError("The team invitation was not found.");
        }
        if (invitation.status !== "pending" || invitation.expiresAt <= this.clock.now()) {
            throw new ConflictError("The team invitation is no longer valid.");
        }
        if (invitation.email.toLowerCase() !== email.toLowerCase()) {
            throw new ForbiddenError("This invitation was issued to a different email address.");
        }
    }

    private async buildDetail(
        session: DatabaseSession,
        team: TeamRow,
        actorUserId: string,
        organizer: boolean,
    ): Promise<TeamDetail> {
        const viewer = await this.repository.findMember(session.db, team.id, actorUserId);
        const memberCount = await this.repository.countMembers(session.db, team.id);
        const canSeeMembers = organizer || viewer !== null;
        const canSeeInvitations = organizer || team.captainUserId === actorUserId;
        const members = canSeeMembers ? await this.repository.members(session.db, team.id) : [];
        const invitations = canSeeInvitations
            ? await this.repository.listInvitations(session.db, team.id)
            : [];
        return toDetail(team, memberCount, members, invitations, this.clock.now());
    }

    private async resolveEdition(
        organizationId: string,
        editionId: string,
    ): Promise<EditionSummary> {
        const edition = await this.competitions.getEdition(organizationId, editionId);
        if (edition === null) {
            throw new NotFoundError("The competition edition was not found.");
        }
        return edition;
    }

    private async resolveDivision(
        organizationId: string,
        editionId: string,
        divisionId: string | null,
    ): Promise<DivisionSummary | null> {
        if (divisionId === null) {
            return null;
        }
        const division = await this.competitions.getDivision(organizationId, divisionId);
        if (division === null || division.editionId !== editionId) {
            throw new NotFoundError("The competition division was not found.");
        }
        return division;
    }

    private async organizationName(organizationId: string): Promise<string> {
        const organization = await this.organizations.getSummary(organizationId);
        if (organization === null) {
            throw new NotFoundError("The organization was not found.");
        }
        return organization.name;
    }
}

export function toTeam(team: TeamRow, memberCount: number): Team {
    return {
        id: team.id,
        organizationId: team.organizationId,
        editionId: team.editionId,
        divisionId: team.divisionId,
        name: team.name,
        description: team.description,
        status: team.status,
        captainUserId: team.captainUserId,
        memberCount,
        maxMembers: team.maxMembers,
        createdAt: team.createdAt.toISOString(),
        updatedAt: team.updatedAt.toISOString(),
    };
}

function toDetail(
    team: TeamRow,
    memberCount: number,
    members: readonly TeamMemberRow[],
    invitations: readonly TeamInvitationRow[],
    now: Date,
): TeamDetail {
    return {
        ...toTeam(team, memberCount),
        members: members.map((member) => ({
            userId: member.userId,
            displayName: member.displayName,
            avatarUrl: member.avatarUrl,
            role: member.role,
            joinedAt: member.joinedAt.toISOString(),
        })),
        invitations: invitations.map((invitation) => ({
            id: invitation.id,
            email: invitation.email,
            status: invitationStatus(invitation, now),
            expiresAt: invitation.expiresAt.toISOString(),
            createdAt: invitation.createdAt.toISOString(),
        })),
    };
}

function invitationStatus(invitation: TeamInvitationRow, now: Date): TeamInvitationStatus {
    if (invitation.status === "pending" && invitation.expiresAt <= now) {
        return "expired";
    }
    switch (invitation.status) {
        case "accepted":
        case "declined":
        case "revoked":
            return invitation.status;
        default:
            return "pending";
    }
}

function isOrganizer(role: OrganizationRole): boolean {
    return ORGANIZER_ROLES.includes(role);
}

function uniqueConstraint(error: unknown): string | null {
    const details = databaseErrorDetails(error);
    if (details.code !== "23505") {
        return null;
    }
    return details.constraint ?? "";
}
