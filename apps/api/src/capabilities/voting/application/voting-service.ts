import type {
    Ballot,
    CastBallotRequest,
    CreateVotingRoundRequest,
    OrganizationRole,
    VoteResult,
    VotingRound,
} from "@nethack/contracts";
import type { AuthContext } from "../../../authentication/types.js";
import type { Clock } from "../../../core/clock.js";
import { domainEvents } from "../../../core/domain-event.js";
import { ConflictError, NotFoundError, ValidationError } from "../../../core/errors.js";
import type { OutboxPublisher } from "../../../core/outbox.js";
import type { AuditLogger } from "../../../infrastructure/audit/audit-logger.js";
import type {
    DatabaseConnection,
    DatabaseSession,
} from "../../../infrastructure/database/client.js";
import type { CompetitionsContract } from "../../competitions/contracts.js";
import type { OrganizationsContract } from "../../organizations/contracts.js";
import type { ParticipantsContract } from "../../participants/contracts.js";
import type { SubmissionsContract } from "../../submissions/contracts.js";
import { normalizeEligibleRoles, VotingRules } from "../domain/voting-rules.js";
import type {
    NewVoteValues,
    VotingRepository,
    VotingRoundRow,
} from "../infrastructure/voting-repository.js";

const RESULT_LIMIT = 200;

export class VotingService {
    private readonly database: DatabaseConnection;
    private readonly repository: VotingRepository;
    private readonly competitions: CompetitionsContract;
    private readonly submissions: SubmissionsContract;
    private readonly participants: ParticipantsContract;
    private readonly organizations: OrganizationsContract;
    private readonly events: OutboxPublisher;
    private readonly audit: AuditLogger;
    private readonly clock: Clock;

    constructor(
        database: DatabaseConnection,
        repository: VotingRepository,
        competitions: CompetitionsContract,
        submissions: SubmissionsContract,
        participants: ParticipantsContract,
        organizations: OrganizationsContract,
        events: OutboxPublisher,
        audit: AuditLogger,
        clock: Clock,
    ) {
        this.database = database;
        this.repository = repository;
        this.competitions = competitions;
        this.submissions = submissions;
        this.participants = participants;
        this.organizations = organizations;
        this.events = events;
        this.audit = audit;
        this.clock = clock;
    }

    async listRounds(organizationId: string, editionId: string): Promise<readonly VotingRound[]> {
        await this.requireEdition(organizationId, editionId);
        const rows = await this.database.transaction({ organizationId }, (session) =>
            this.repository.listRounds(session.db, organizationId, editionId),
        );
        return rows.map(toVotingRound);
    }

    async createRound(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
        input: CreateVotingRoundRequest,
        ip: string | null,
    ): Promise<VotingRound> {
        await this.requireEdition(organizationId, editionId);
        const opensAt = parseNullable(input.opensAt);
        const closesAt = parseNullable(input.closesAt);
        VotingRules.assertSchedule(opensAt, closesAt);
        const row = await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const created = await this.repository.insertRound(session, {
                    organizationId,
                    editionId,
                    name: input.name,
                    description: input.description,
                    eligibleRoles: normalizeEligibleRoles(input.eligibleRoles),
                    maxSelections: input.maxSelections,
                    opensAt,
                    closesAt,
                });
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "voting.round.created",
                    entityType: "voting_round",
                    entityId: created.id,
                    metadata: { editionId, status: created.status },
                    ip,
                });
                return created;
            },
        );
        return toVotingRound(row);
    }

    async openRound(
        auth: AuthContext,
        organizationId: string,
        roundId: string,
        ip: string | null,
    ): Promise<VotingRound> {
        const organizationName = await this.requireOrganizationName(organizationId);
        const row = await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const round = await this.requireLockedRound(session, organizationId, roundId);
                const now = this.clock.now();
                VotingRules.assertOpenable(round, now);
                const updated = await this.repository.updateRound(session, {
                    organizationId,
                    roundId,
                    status: "open",
                    updatedAt: now,
                });
                if (updated === null) {
                    throw new NotFoundError("The voting round was not found.");
                }
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "voting.round.opened",
                    entityType: "voting_round",
                    entityId: roundId,
                    metadata: { editionId: round.editionId },
                    ip,
                });
                await this.publishRoundEvent(
                    session,
                    domainEvents.votingOpened,
                    round,
                    organizationName,
                );
                return updated;
            },
        );
        return toVotingRound(row);
    }

    async closeRound(
        auth: AuthContext,
        organizationId: string,
        roundId: string,
        ip: string | null,
    ): Promise<VotingRound> {
        const organizationName = await this.requireOrganizationName(organizationId);
        const row = await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const round = await this.requireLockedRound(session, organizationId, roundId);
                const now = this.clock.now();
                VotingRules.assertTransition(round.status, "closed");
                const updated = await this.repository.updateRound(session, {
                    organizationId,
                    roundId,
                    status: "closed",
                    updatedAt: now,
                });
                if (updated === null) {
                    throw new NotFoundError("The voting round was not found.");
                }
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "voting.round.closed",
                    entityType: "voting_round",
                    entityId: roundId,
                    metadata: { editionId: round.editionId },
                    ip,
                });
                await this.publishRoundEvent(
                    session,
                    domainEvents.votingClosed,
                    round,
                    organizationName,
                );
                return updated;
            },
        );
        return toVotingRound(row);
    }

    async publishRound(
        auth: AuthContext,
        organizationId: string,
        roundId: string,
        ip: string | null,
    ): Promise<VotingRound> {
        const organizationName = await this.requireOrganizationName(organizationId);
        const row = await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const round = await this.requireLockedRound(session, organizationId, roundId);
                const now = this.clock.now();
                VotingRules.assertTransition(round.status, "published");
                const updated = await this.repository.updateRound(session, {
                    organizationId,
                    roundId,
                    status: "published",
                    updatedAt: now,
                    publishedAt: now,
                });
                if (updated === null) {
                    throw new NotFoundError("The voting round was not found.");
                }
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "voting.round.published",
                    entityType: "voting_round",
                    entityId: roundId,
                    metadata: { editionId: round.editionId },
                    ip,
                });
                await this.publishRoundEvent(
                    session,
                    domainEvents.votingPublished,
                    round,
                    organizationName,
                );
                return updated;
            },
        );
        return toVotingRound(row);
    }

    async ballot(
        auth: AuthContext,
        organizationId: string,
        role: OrganizationRole,
        roundId: string,
    ): Promise<Ballot> {
        const round = await this.requireRound(organizationId, roundId);
        if (round.status !== "open" && round.status !== "closed") {
            throw new NotFoundError("The ballot was not found.");
        }
        await this.assertVoterEligible(organizationId, round, auth.user.id, role);
        const found = await this.database.transaction(
            { organizationId, userId: auth.user.id },
            (session) =>
                this.repository.findBallotWithVotes(
                    session.db,
                    organizationId,
                    roundId,
                    auth.user.id,
                ),
        );
        if (found === null) {
            throw new NotFoundError("The ballot was not found.");
        }
        return {
            roundId,
            userId: auth.user.id,
            submissionIds: [...found.submissionIds],
            submittedAt: found.ballot.submittedAt.toISOString(),
        };
    }

    async castBallot(
        auth: AuthContext,
        organizationId: string,
        role: OrganizationRole,
        roundId: string,
        input: CastBallotRequest,
        ip: string | null,
    ): Promise<Ballot> {
        const round = await this.requireRound(organizationId, roundId);
        const now = this.clock.now();
        VotingRules.assertBallotWindow(round, now);
        VotingRules.assertSelections(input.submissionIds, round.maxSelections);
        await this.assertVoterEligible(organizationId, round, auth.user.id, role);
        await this.assertSelectionsAreVotable(organizationId, round, input.submissionIds);

        try {
            const ballot = await this.database.transaction(
                { organizationId, userId: auth.user.id },
                async (session) => {
                    const locked = await this.requireLockedRound(session, organizationId, roundId);
                    const lockedAt = this.clock.now();
                    VotingRules.assertBallotWindow(locked, lockedAt);
                    const existing = await this.repository.findBallot(
                        session.db,
                        organizationId,
                        roundId,
                        auth.user.id,
                    );
                    if (existing !== null) {
                        throw new ConflictError(
                            "You have already submitted a ballot for this round.",
                        );
                    }
                    const inserted = await this.repository.insertBallot(session, {
                        organizationId,
                        roundId,
                        userId: auth.user.id,
                        submittedAt: lockedAt,
                    });
                    const voteRows: NewVoteValues[] = input.submissionIds.map((submissionId) => ({
                        organizationId,
                        roundId,
                        ballotId: inserted.id,
                        userId: auth.user.id,
                        submissionId,
                    }));
                    await this.repository.insertVotes(session, voteRows);
                    await this.audit.record(session, {
                        organizationId,
                        actorUserId: auth.user.id,
                        action: "voting.ballot.cast",
                        entityType: "ballot",
                        entityId: inserted.id,
                        metadata: { editionId: round.editionId, selections: voteRows.length },
                        ip,
                    });
                    return inserted;
                },
            );
            return {
                roundId,
                userId: auth.user.id,
                submissionIds: [...input.submissionIds],
                submittedAt: ballot.submittedAt.toISOString(),
            };
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new ConflictError("You have already submitted a ballot for this round.");
            }
            throw error;
        }
    }

    async roundResults(
        organizationId: string,
        role: OrganizationRole,
        roundId: string,
    ): Promise<VoteResult> {
        const round = await this.requireRound(organizationId, roundId);
        VotingRules.assertCanViewResults(round.status, role);
        return this.buildResult(organizationId, round);
    }

    async editionResults(
        organizationId: string,
        role: OrganizationRole,
        editionId: string,
    ): Promise<readonly VoteResult[]> {
        await this.requireEdition(organizationId, editionId);
        const rounds = await this.database.transaction({ organizationId }, (session) =>
            this.repository.listRounds(session.db, organizationId, editionId),
        );
        const visible =
            role === "owner" || role === "organizer"
                ? rounds
                : rounds.filter((round) => round.status === "published");
        return this.buildResults(organizationId, visible);
    }

    async publishedResults(
        organizationId: string,
        editionId: string,
    ): Promise<readonly VoteResult[]> {
        await this.requireEdition(organizationId, editionId);
        const rounds = await this.database.transaction({ organizationId }, (session) =>
            this.repository.listPublishedRounds(session.db, organizationId, editionId),
        );
        return this.buildResults(organizationId, rounds);
    }

    private async buildResults(
        organizationId: string,
        rounds: readonly VotingRoundRow[],
    ): Promise<readonly VoteResult[]> {
        const results: VoteResult[] = [];
        for (const round of rounds) {
            results.push(await this.buildResult(organizationId, round));
        }
        return results;
    }

    private async buildResult(organizationId: string, round: VotingRoundRow): Promise<VoteResult> {
        const { counts, totalBallots } = await this.database.transaction(
            { organizationId },
            async (session) => ({
                counts: await this.repository.aggregateVotes(session.db, organizationId, round.id),
                totalBallots: await this.repository.countBallots(
                    session.db,
                    organizationId,
                    round.id,
                ),
            }),
        );
        if (counts.length === 0) {
            return {
                roundId: round.id,
                roundName: round.name,
                publishedAt: nullableIso(round.publishedAt),
                totalBallots,
                entries: [],
            };
        }
        const submissions = await this.submissions.listEditionSubmissions(
            organizationId,
            round.editionId,
        );
        const titles = new Map<string, string>();
        for (const submission of submissions) {
            titles.set(submission.id, submission.title);
        }
        const entries = counts
            .map((row) => ({
                submissionId: row.submissionId,
                projectTitle: titles.get(row.submissionId) ?? "",
                teamName: null,
                votes: row.votes,
            }))
            .toSorted(
                (left, right) =>
                    right.votes - left.votes || left.projectTitle.localeCompare(right.projectTitle),
            )
            .slice(0, RESULT_LIMIT);
        return {
            roundId: round.id,
            roundName: round.name,
            publishedAt: nullableIso(round.publishedAt),
            totalBallots,
            entries,
        };
    }

    private async requireEdition(organizationId: string, editionId: string): Promise<void> {
        const edition = await this.competitions.getEdition(organizationId, editionId);
        if (edition === null) {
            throw new NotFoundError("The competition edition was not found.");
        }
    }

    private async requireOrganizationName(organizationId: string): Promise<string> {
        const organization = await this.organizations.getSummary(organizationId);
        if (organization === null) {
            throw new NotFoundError("The organization was not found.");
        }
        return organization.name;
    }

    private async requireRound(organizationId: string, roundId: string): Promise<VotingRoundRow> {
        const round = await this.database.transaction({ organizationId }, (session) =>
            this.repository.findRound(session.db, organizationId, roundId),
        );
        if (round === null) {
            throw new NotFoundError("The voting round was not found.");
        }
        return round;
    }

    private async requireLockedRound(
        session: DatabaseSession,
        organizationId: string,
        roundId: string,
    ): Promise<VotingRoundRow> {
        const round = await this.repository.lockRound(session, organizationId, roundId);
        if (round === null) {
            throw new NotFoundError("The voting round was not found.");
        }
        return round;
    }

    private async assertVoterEligible(
        organizationId: string,
        round: VotingRoundRow,
        userId: string,
        role: OrganizationRole,
    ): Promise<void> {
        VotingRules.assertRoleEligible(role, normalizeEligibleRoles(round.eligibleRoles));
        if (VotingRules.effectiveRole(role) === "participant") {
            VotingRules.assertApprovedParticipant(
                await this.participants.isApprovedParticipant(
                    organizationId,
                    round.editionId,
                    userId,
                ),
            );
        }
    }

    private async assertSelectionsAreVotable(
        organizationId: string,
        round: VotingRoundRow,
        submissionIds: readonly string[],
    ): Promise<void> {
        const submissions = await this.submissions.listEditionSubmissions(
            organizationId,
            round.editionId,
        );
        const byId = new Map(submissions.map((submission) => [submission.id, submission]));
        for (const submissionId of submissionIds) {
            const submission = byId.get(submissionId);
            if (submission === undefined || submission.editionId !== round.editionId) {
                throw new ValidationError(
                    "A selected submission does not belong to this edition.",
                    {
                        submissionIds: ["A selected submission does not belong to this edition."],
                    },
                );
            }
            if (!VotingRules.isVotableSubmission(submission.status)) {
                throw new ConflictError("A selected submission is not open for voting.");
            }
        }
    }

    private async publishRoundEvent(
        session: DatabaseSession,
        type: string,
        round: VotingRoundRow,
        organizationName: string,
    ): Promise<void> {
        await this.events.publish(session, {
            type,
            organizationId: round.organizationId,
            aggregateType: "voting_round",
            aggregateId: round.id,
            payload: {
                organizationId: round.organizationId,
                organizationName,
                editionId: round.editionId,
                roundId: round.id,
                roundName: round.name,
            },
        });
    }
}

function toVotingRound(row: VotingRoundRow): VotingRound {
    return {
        id: row.id,
        organizationId: row.organizationId,
        editionId: row.editionId,
        name: row.name,
        description: row.description,
        status: row.status,
        eligibleRoles: normalizeEligibleRoles(row.eligibleRoles),
        maxSelections: row.maxSelections,
        opensAt: nullableIso(row.opensAt),
        closesAt: nullableIso(row.closesAt),
        publishedAt: nullableIso(row.publishedAt),
        createdAt: row.createdAt.toISOString(),
    };
}

function parseNullable(value: string | null): Date | null {
    return value === null ? null : new Date(value);
}

function nullableIso(value: Date | null): string | null {
    return value === null ? null : value.toISOString();
}

function isUniqueViolation(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: unknown }).code === "23505"
    );
}
