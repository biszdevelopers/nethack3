import type {
    Ballot,
    CastBallotRequest,
    CreateVotingRoundRequest,
    OrganizationRole,
    VoteResult,
    VotableSubmission,
    VotingRound,
} from "@nethack/contracts";
import type { AuthContext } from "../../../authentication/types.js";
import type { Clock } from "../../../core/clock.js";
import { domainEvents } from "../../../core/domain-event.js";
import {
    ConflictError,
    ForbiddenError,
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
import type { CompetitionsContract, EditionSummary } from "../../competitions/contracts.js";
import type { OrganizationsContract } from "../../organizations/contracts.js";
import type { ParticipantsContract } from "../../participants/contracts.js";
import type { ProjectsContract } from "../../projects/contracts.js";
import type { SubmissionsContract } from "../../submissions/contracts.js";
import type { TeamsContract } from "../../teams/contracts.js";
import { toVotableSubmissions } from "../domain/votable-submissions.js";
import { rankVoteTallies } from "../domain/voting-results.js";
import { normalizeEligibleRoles, VotingRules } from "../domain/voting-rules.js";
import type {
    BallotRow,
    NewVoteValues,
    VotingRepository,
    VotingRoundRow,
} from "../infrastructure/voting-repository.js";
import {
    EMPTY_PROJECT_DISCLOSURE,
    toProjectDisclosure,
    type ProjectDisclosure,
} from "./project-disclosure.js";

const RESULT_LIMIT = 200;

export class VotingService {
    private readonly database: DatabaseConnection;
    private readonly repository: VotingRepository;
    private readonly competitions: CompetitionsContract;
    private readonly submissions: SubmissionsContract;
    private readonly participants: ParticipantsContract;
    private readonly organizations: OrganizationsContract;
    private readonly teams: TeamsContract;
    private readonly projects: ProjectsContract;
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
        teams: TeamsContract,
        projects: ProjectsContract,
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
        this.teams = teams;
        this.projects = projects;
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

    async votableSubmissions(
        organizationId: string,
        role: OrganizationRole,
        editionId: string,
    ): Promise<readonly VotableSubmission[]> {
        await this.requireEdition(organizationId, editionId);
        await this.assertCanDiscoverVotableSubmissions(organizationId, editionId, role);
        const submissions = await this.submissions.listEditionSubmissions(
            organizationId,
            editionId,
        );
        const votable = submissions.filter((submission) =>
            VotingRules.isVotableSubmission(submission.status),
        );
        const teamNames = await this.resolveTeamNames(
            organizationId,
            votable.flatMap((submission) =>
                submission.teamId === null ? [] : [submission.teamId],
            ),
        );
        const disclosures = await this.projectDisclosures(
            organizationId,
            votable.map((submission) => submission.projectId),
        );
        return toVotableSubmissions(
            votable.map((submission) => ({
                ...submission,
                ...(disclosures.get(submission.projectId) ?? EMPTY_PROJECT_DISCLOSURE),
            })),
            teamNames,
        );
    }

    async createRound(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
        input: CreateVotingRoundRequest,
        ip: string | null,
    ): Promise<VotingRound> {
        const edition = await this.requireEdition(organizationId, editionId);
        VotingRules.assertEditionAcceptsVoting(edition.status);
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
                    maxVotesPerUser: input.maxVotesPerUser,
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
        const preview = await this.requireRound(organizationId, roundId);
        await this.requireUnfrozenEdition(organizationId, preview.editionId);
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
        const preview = await this.requireRound(organizationId, roundId);
        await this.requireUnfrozenEdition(organizationId, preview.editionId);
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
        const preview = await this.requireRound(organizationId, roundId);
        await this.requireUnfrozenEdition(organizationId, preview.editionId);
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

    async closeOpenRoundsForResults(
        session: DatabaseSession,
        organizationId: string,
        editionId: string,
        actorUserId: string,
    ): Promise<number> {
        const now = this.clock.now();
        const closed = await this.repository.closeOpenRounds(
            session,
            organizationId,
            editionId,
            now,
        );
        for (const round of closed) {
            await this.audit.record(session, {
                organizationId,
                actorUserId,
                action: "voting.round.closed",
                entityType: "voting_round",
                entityId: round.id,
                metadata: { editionId, reason: "results_published" },
                ip: null,
            });
            await this.events.publish(session, {
                type: domainEvents.votingClosed,
                organizationId,
                aggregateType: "voting_round",
                aggregateId: round.id,
                payload: {
                    organizationId,
                    editionId,
                    roundId: round.id,
                    roundName: round.name,
                    reason: "results_published",
                },
            });
        }
        return closed.length;
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
            scores: [...found.scores],
            reasoning: found.ballot.reasoning,
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
        await this.requireUnfrozenEdition(organizationId, round.editionId);
        const now = this.clock.now();
        VotingRules.assertBallotWindow(round, now);
        VotingRules.assertScores(input.scores, round.maxSelections, round.maxVotesPerUser);
        await this.assertVoterEligible(organizationId, round, auth.user.id, role);
        await this.assertSelectionsAreVotable(
            organizationId,
            round,
            input.scores.map((score) => score.submissionId),
        );

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
                    let current: BallotRow;
                    if (existing === null) {
                        current = await this.repository.insertBallot(session, {
                            organizationId,
                            roundId,
                            userId: auth.user.id,
                            reasoning: input.reasoning,
                            submittedAt: lockedAt,
                        });
                    } else {
                        await this.repository.deleteVotes(session, organizationId, existing.id);
                        const updated = await this.repository.touchBallot(
                            session,
                            organizationId,
                            existing.id,
                            lockedAt,
                            input.reasoning,
                        );
                        if (updated === null) {
                            throw new NotFoundError("The ballot was not found.");
                        }
                        current = updated;
                    }
                    const voteRows: NewVoteValues[] = input.scores.map((score) => ({
                        organizationId,
                        roundId,
                        ballotId: current.id,
                        userId: auth.user.id,
                        submissionId: score.submissionId,
                        stars: score.stars,
                    }));
                    await this.repository.insertVotes(session, voteRows);
                    await this.audit.record(session, {
                        organizationId,
                        actorUserId: auth.user.id,
                        action: "voting.ballot.cast",
                        entityType: "ballot",
                        entityId: current.id,
                        metadata: {
                            editionId: round.editionId,
                            selections: voteRows.length,
                            stars: input.scores.reduce((sum, score) => sum + score.stars, 0),
                            replaced: existing !== null,
                        },
                        ip,
                    });
                    return current;
                },
            );
            return {
                roundId,
                userId: auth.user.id,
                scores: [...input.scores],
                reasoning: input.reasoning,
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
        return this.buildResult(organizationId, round, VotingRules.isOrganizerRole(role));
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
        return this.buildResults(organizationId, visible, role === "owner" || role === "organizer");
    }

    async publishedResults(
        organizationId: string,
        editionId: string,
    ): Promise<readonly VoteResult[]> {
        await this.requireEdition(organizationId, editionId);
        const rounds = await this.database.transaction({ organizationId }, (session) =>
            this.repository.listPublishedRounds(session.db, organizationId, editionId),
        );
        return this.buildResults(organizationId, rounds, false);
    }

    private async buildResults(
        organizationId: string,
        rounds: readonly VotingRoundRow[],
        includeAudit: boolean,
    ): Promise<readonly VoteResult[]> {
        const results: VoteResult[] = [];
        for (const round of rounds) {
            results.push(await this.buildResult(organizationId, round, includeAudit));
        }
        return results;
    }

    private async buildResult(
        organizationId: string,
        round: VotingRoundRow,
        includeAudit: boolean,
    ): Promise<VoteResult> {
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
        const audit = includeAudit ? await this.buildAudit(organizationId, round.id) : undefined;
        if (counts.length === 0) {
            return {
                roundId: round.id,
                roundName: round.name,
                publishedAt: nullableIso(round.publishedAt),
                totalBallots,
                entries: [],
                ...(audit === undefined ? {} : { audit }),
            };
        }
        const submissions = await this.submissions.listEditionSubmissions(
            organizationId,
            round.editionId,
        );
        const titles = new Map<string, string>();
        const teamNamesBySubmission = new Map<string, string | null>();
        const teamNames = await this.resolveTeamNames(
            organizationId,
            submissions.flatMap((submission) =>
                submission.teamId === null ? [] : [submission.teamId],
            ),
        );
        for (const submission of submissions) {
            titles.set(submission.id, submission.title);
            teamNamesBySubmission.set(
                submission.id,
                submission.teamId === null ? null : (teamNames.get(submission.teamId) ?? null),
            );
        }
        const entries = rankVoteTallies(counts, titles, RESULT_LIMIT, teamNamesBySubmission);
        return {
            roundId: round.id,
            roundName: round.name,
            publishedAt: nullableIso(round.publishedAt),
            totalBallots,
            entries,
            ...(audit === undefined ? {} : { audit }),
        };
    }

    private async buildAudit(
        organizationId: string,
        roundId: string,
    ): Promise<VoteResult["audit"]> {
        const ballots = await this.database.transaction({ organizationId }, (session) =>
            this.repository.listBallotsWithVotes(session.db, organizationId, roundId),
        );
        return ballots.map((entry) => ({
            userId: entry.ballot.userId,
            submittedAt: entry.ballot.submittedAt.toISOString(),
            reasoning: entry.ballot.reasoning,
            scores: entry.scores.map((score) => ({
                submissionId: score.submissionId,
                stars: score.stars,
            })),
        }));
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

    private async requireUnfrozenEdition(organizationId: string, editionId: string): Promise<void> {
        const edition = await this.requireEdition(organizationId, editionId);
        VotingRules.assertEditionAcceptsVoting(edition.status);
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

    private async assertCanDiscoverVotableSubmissions(
        organizationId: string,
        editionId: string,
        role: OrganizationRole,
    ): Promise<void> {
        const effective = VotingRules.effectiveRole(role);
        if (effective === "organizer") {
            return;
        }
        const rounds = await this.database.transaction({ organizationId }, (session) =>
            this.repository.listRounds(session.db, organizationId, editionId),
        );
        const eligible = rounds.some((round) =>
            normalizeEligibleRoles(round.eligibleRoles).includes(effective),
        );
        if (!eligible) {
            throw new ForbiddenError(
                "Your organization role is not eligible in any voting round of this edition.",
            );
        }
    }

    private async resolveTeamNames(
        organizationId: string,
        teamIds: readonly string[],
    ): Promise<Map<string, string>> {
        const names = new Map<string, string>();
        await Promise.all(
            [...new Set(teamIds)].map(async (teamId) => {
                const team = await this.teams.getTeam(organizationId, teamId);
                if (team !== null) {
                    names.set(teamId, team.name);
                }
            }),
        );
        return names;
    }

    private async projectDisclosures(
        organizationId: string,
        projectIds: readonly string[],
    ): Promise<ReadonlyMap<string, ProjectDisclosure>> {
        const entries = await Promise.all(
            [...new Set(projectIds)].map(async (projectId) => {
                const project = await this.projects.getProject(organizationId, projectId);
                return [projectId, toProjectDisclosure(project)] as const;
            }),
        );
        return new Map(entries);
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
                throw new ValidationError("A scored submission does not belong to this edition.", {
                    scores: ["A scored submission does not belong to this edition."],
                });
            }
            if (!VotingRules.isVotableSubmission(submission.status)) {
                throw new ConflictError("A scored submission is not open for voting.");
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
        maxVotesPerUser: row.maxVotesPerUser,
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
