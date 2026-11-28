import type {
    Award,
    AwardCatalog,
    CreateAwardRequest,
    MyResults,
    MyResultsFeedback,
    PublicCertificate,
    PublicResults,
    ResultsStatus,
    TeamAward,
    UpdateAwardRequest,
} from "@nethack/contracts";
import { MINIMUM_PUBLIC_REVIEWS, publicResultsSchema } from "@nethack/contracts";
import type { AuthContext } from "../../../authentication/types.js";
import type { Clock } from "../../../core/clock.js";
import { domainEvents } from "../../../core/domain-event.js";
import {
    ConflictError,
    databaseErrorDetails,
    InternalError,
    isUniqueViolationError,
    NotFoundError,
} from "../../../core/errors.js";
import type { OutboxPublisher } from "../../../core/outbox.js";
import type { AuditLogger } from "../../../infrastructure/audit/audit-logger.js";
import type { DatabaseConnection } from "../../../infrastructure/database/client.js";
import type { CompetitionsContract, EditionSummary } from "../../competitions/contracts.js";
import type { JudgingContract } from "../../judging/contracts.js";
import type { OrganizationsContract } from "../../organizations/contracts.js";
import type { SubmissionsContract } from "../../submissions/contracts.js";
import type { TeamsContract } from "../../teams/contracts.js";
import type { VotingContract } from "../../voting/contracts.js";
import {
    applyReviewThreshold,
    assemblePublicResults,
    findTeamResult,
    type AssemblyAward,
    type TeamResultView,
} from "../domain/results-assembly.js";
import type {
    AwardRow,
    AwardUpdateValues,
    RecognitionRepository,
    TeamAwardRow,
} from "../infrastructure/recognition-repository.js";

export class RecognitionService {
    private readonly database: DatabaseConnection;
    private readonly repository: RecognitionRepository;
    private readonly competitions: CompetitionsContract;
    private readonly teams: TeamsContract;
    private readonly submissions: SubmissionsContract;
    private readonly judging: JudgingContract;
    private readonly voting: VotingContract;
    private readonly organizations: OrganizationsContract;
    private readonly events: OutboxPublisher;
    private readonly audit: AuditLogger;
    private readonly clock: Clock;

    constructor(
        database: DatabaseConnection,
        repository: RecognitionRepository,
        competitions: CompetitionsContract,
        teams: TeamsContract,
        submissions: SubmissionsContract,
        judging: JudgingContract,
        voting: VotingContract,
        organizations: OrganizationsContract,
        events: OutboxPublisher,
        audit: AuditLogger,
        clock: Clock,
    ) {
        this.database = database;
        this.repository = repository;
        this.competitions = competitions;
        this.teams = teams;
        this.submissions = submissions;
        this.judging = judging;
        this.voting = voting;
        this.organizations = organizations;
        this.events = events;
        this.audit = audit;
        this.clock = clock;
    }

    async catalog(organizationId: string, editionId: string): Promise<AwardCatalog> {
        await this.requireEdition(organizationId, editionId);
        const [awardRows, assignmentRows, teamRows] = await Promise.all([
            this.database.transaction({ organizationId }, (session) =>
                this.repository.listAwards(session.db, organizationId, editionId),
            ),
            this.database.transaction({ organizationId }, (session) =>
                this.repository.listTeamAwards(session.db, organizationId, editionId),
            ),
            this.teams.listEditionTeams(organizationId, editionId),
        ]);
        const teamNames = new Map(teamRows.map((team) => [team.id, team.name] as const));
        const awardsById = new Map(awardRows.map((award) => [award.id, award] as const));
        const teamAwards = assignmentRows.map((row) => {
            const award = awardsById.get(row.awardId);
            const teamName = teamNames.get(row.teamId);
            if (award === undefined || teamName === undefined) {
                throw new InternalError("A team award references missing data.");
            }
            return toTeamAward(row, award, teamName);
        });
        return { awards: awardRows.map(toAward), teamAwards };
    }

    async createAward(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
        input: CreateAwardRequest,
        ip: string | null,
    ): Promise<Award> {
        await this.requireEdition(organizationId, editionId);
        const now = this.clock.now();
        try {
            const row = await this.database.transaction(
                { organizationId, userId: auth.user.id },
                async (session) => {
                    const created = await this.repository.insertAward(session, {
                        organizationId,
                        editionId,
                        namespace: input.namespace,
                        name: input.name,
                        description: input.description,
                        icon: input.icon,
                        color: input.color,
                        createdByUserId: auth.user.id,
                        createdAt: now,
                        updatedAt: now,
                    });
                    await this.audit.record(session, {
                        organizationId,
                        actorUserId: auth.user.id,
                        action: "recognition.award.created",
                        entityType: "award",
                        entityId: created.id,
                        metadata: { editionId, namespace: created.namespace },
                        ip,
                    });
                    return created;
                },
            );
            return toAward(row);
        } catch (error) {
            if (isUniqueViolationError(error)) {
                throw new ConflictError("That award key is already used in this edition.");
            }
            throw error;
        }
    }

    async updateAward(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
        awardId: string,
        input: UpdateAwardRequest,
        ip: string | null,
    ): Promise<Award> {
        await this.requireEdition(organizationId, editionId);
        const values: AwardUpdateValues = {
            updatedAt: this.clock.now(),
            ...(input.name === undefined ? {} : { name: input.name }),
            ...(input.description === undefined ? {} : { description: input.description }),
            ...(input.icon === undefined ? {} : { icon: input.icon }),
            ...(input.color === undefined ? {} : { color: input.color }),
        };
        const row = await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const existing = await this.repository.findAwardForUpdate(
                    session,
                    organizationId,
                    awardId,
                );
                if (existing === null || existing.editionId !== editionId) {
                    throw new NotFoundError("The award was not found.");
                }
                const updated = await this.repository.updateAward(
                    session,
                    organizationId,
                    awardId,
                    values,
                );
                if (updated === null) {
                    throw new NotFoundError("The award was not found.");
                }
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "recognition.award.updated",
                    entityType: "award",
                    entityId: awardId,
                    metadata: { editionId, namespace: updated.namespace },
                    ip,
                });
                return updated;
            },
        );
        return toAward(row);
    }

    async deleteAward(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
        awardId: string,
        ip: string | null,
    ): Promise<void> {
        await this.requireEdition(organizationId, editionId);
        await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const existing = await this.repository.findAwardForUpdate(
                    session,
                    organizationId,
                    awardId,
                );
                if (existing === null || existing.editionId !== editionId) {
                    throw new NotFoundError("The award was not found.");
                }
                const assignments = await this.repository.countTeamAwardsForAward(
                    session.db,
                    organizationId,
                    awardId,
                );
                if (assignments > 0) {
                    throw new ConflictError(
                        "Remove this award from every team before deleting it.",
                    );
                }
                let deleted: AwardRow | null;
                try {
                    deleted = await this.repository.deleteAward(session, organizationId, awardId);
                } catch (error) {
                    if (databaseErrorDetails(error).code === "23503") {
                        throw new ConflictError(
                            "Remove this award from every team before deleting it.",
                        );
                    }
                    throw error;
                }
                if (deleted === null) {
                    throw new NotFoundError("The award was not found.");
                }
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "recognition.award.deleted",
                    entityType: "award",
                    entityId: awardId,
                    metadata: { editionId, namespace: deleted.namespace },
                    ip,
                });
            },
        );
    }

    async assignAward(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
        teamId: string,
        awardId: string,
        note: string,
        ip: string | null,
    ): Promise<TeamAward> {
        await this.requireEdition(organizationId, editionId);
        const [team, award] = await Promise.all([
            this.teams.getTeam(organizationId, teamId),
            this.database.transaction({ organizationId }, (session) =>
                this.repository.findAward(session.db, organizationId, awardId),
            ),
        ]);
        if (team === null || team.editionId !== editionId) {
            throw new NotFoundError("The team was not found in this edition.");
        }
        if (award === null || award.editionId !== editionId) {
            throw new NotFoundError("The award was not found in this edition.");
        }
        try {
            const row = await this.database.transaction(
                { organizationId, userId: auth.user.id },
                async (session) => {
                    const created = await this.repository.insertTeamAward(session, {
                        organizationId,
                        editionId,
                        teamId,
                        awardId,
                        note,
                        assignedByUserId: auth.user.id,
                        assignedAt: this.clock.now(),
                    });
                    await this.audit.record(session, {
                        organizationId,
                        actorUserId: auth.user.id,
                        action: "recognition.award.assigned",
                        entityType: "team_award",
                        entityId: created.id,
                        metadata: { editionId, teamId, awardId },
                        ip,
                    });
                    return created;
                },
            );
            return toTeamAward(row, award, team.name);
        } catch (error) {
            if (isUniqueViolationError(error)) {
                throw new ConflictError("That team already has this award.");
            }
            throw error;
        }
    }

    async unassignAward(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
        teamId: string,
        awardId: string,
        ip: string | null,
    ): Promise<void> {
        await this.requireEdition(organizationId, editionId);
        await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const deleted = await this.repository.deleteTeamAward(
                    session,
                    organizationId,
                    editionId,
                    teamId,
                    awardId,
                );
                if (deleted === null) {
                    throw new NotFoundError("The team award was not found.");
                }
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "recognition.award.unassigned",
                    entityType: "team_award",
                    entityId: deleted.id,
                    metadata: { editionId, teamId, awardId },
                    ip,
                });
            },
        );
    }

    async status(organizationId: string, editionId: string): Promise<ResultsStatus> {
        await this.requireEdition(organizationId, editionId);
        const [results, judgingResults, votingResults, teamAwards] = await Promise.all([
            this.database.transaction({ organizationId }, (session) =>
                this.repository.findResults(session.db, organizationId, editionId),
            ),
            this.judging.listEditionResults(organizationId, editionId),
            this.voting.getPublishedResults(organizationId, editionId),
            this.database.transaction({ organizationId }, (session) =>
                this.repository.listTeamAwards(session.db, organizationId, editionId),
            ),
        ]);
        return {
            editionId,
            published: results !== null,
            publishedAt: results === null ? null : results.publishedAt.toISOString(),
            publishedByUserId: results?.publishedByUserId ?? null,
            judgingEntryCount: judgingResults.length,
            awardAssignmentCount: teamAwards.length,
            votingRoundCount: votingResults.length,
        };
    }

    async publish(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
        ip: string | null,
    ): Promise<PublicResults> {
        const edition = await this.requireEdition(organizationId, editionId);
        const organization = await this.requireOrganization(organizationId);
        const existing = await this.database.transaction({ organizationId }, (session) =>
            this.repository.findResults(session.db, organizationId, editionId),
        );
        if (existing !== null) {
            throw new ConflictError("Results for this edition are already published.");
        }
        const publishedAt = this.clock.now();
        const [snapshot, teams] = await Promise.all([
            this.buildSnapshot(organizationId, editionId, publishedAt),
            this.teams.listEditionTeamsWithMembers(organizationId, editionId),
        ]);
        const participantUserIds = [
            ...new Set(teams.flatMap((team) => team.members.map((member) => member.userId))),
        ];
        const frozenSnapshot: PublicResults = {
            ...snapshot,
            edition: { ...snapshot.edition, status: "completed" },
        };
        try {
            await this.database.transaction(
                { organizationId, userId: auth.user.id },
                async (session) => {
                    const previousEditionStatus = await this.competitions.freezeForResults(
                        session,
                        organizationId,
                        editionId,
                    );
                    const closedRounds = await this.voting.closeOpenRoundsForResults(
                        session,
                        organizationId,
                        editionId,
                        auth.user.id,
                    );
                    const inserted = await this.repository.insertResults(session, {
                        organizationId,
                        editionId,
                        publishedAt,
                        publishedByUserId: auth.user.id,
                        previousEditionStatus,
                        snapshot: frozenSnapshot,
                    });
                    await this.audit.record(session, {
                        organizationId,
                        actorUserId: auth.user.id,
                        action: "recognition.results.published",
                        entityType: "edition_results",
                        entityId: inserted.editionId,
                        metadata: {
                            editionId,
                            judgingEntries: frozenSnapshot.judgingEntries.length,
                            awards: frozenSnapshot.awards.length,
                            closedRounds,
                            previousEditionStatus,
                        },
                        ip,
                    });
                    await this.events.publish(session, {
                        type: domainEvents.resultsPublished,
                        organizationId,
                        aggregateType: "competition_edition",
                        aggregateId: editionId,
                        payload: {
                            organizationId,
                            organizationName: organization.name,
                            editionId,
                            editionName: edition.name,
                            participantUserIds,
                            publishedAt: publishedAt.toISOString(),
                        },
                    });
                },
            );
        } catch (error) {
            if (isUniqueViolationError(error)) {
                throw new ConflictError("Results for this edition are already published.");
            }
            throw error;
        }
        return frozenSnapshot;
    }

    async unpublish(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
        ip: string | null,
    ): Promise<void> {
        await this.requireEdition(organizationId, editionId);
        await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const existing = await this.repository.findResultsForUpdate(
                    session,
                    organizationId,
                    editionId,
                );
                if (existing === null) {
                    throw new NotFoundError("This edition has no published results.");
                }
                const deleted = await this.repository.deleteResults(
                    session,
                    organizationId,
                    editionId,
                );
                if (deleted === null) {
                    throw new NotFoundError("This edition has no published results.");
                }
                // Pre-migration publications have no stored status; voting is the safe pre-freeze default.
                const restoredStatus = existing.previousEditionStatus ?? "voting";
                await this.competitions.restoreEditionStatus(
                    session,
                    organizationId,
                    editionId,
                    restoredStatus,
                );
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "recognition.results.unpublished",
                    entityType: "edition_results",
                    entityId: editionId,
                    metadata: { editionId, restoredEditionStatus: restoredStatus },
                    ip,
                });
            },
        );
    }

    async myResults(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
    ): Promise<MyResults> {
        await this.requireEdition(organizationId, editionId);
        const [activeTeam, history, row] = await Promise.all([
            this.teams.getTeamForUser(organizationId, editionId, auth.user.id),
            this.teams.listUserTeamHistory(organizationId, auth.user.id),
            this.database.transaction({ organizationId }, (session) =>
                this.repository.findResults(session.db, organizationId, editionId),
            ),
        ]);
        const results = row === null ? null : parseSnapshot(row.snapshot);
        const currentHistory = history.find(
            (entry) =>
                entry.editionId === editionId &&
                results !== null &&
                findTeamResult(results, entry.teamId) !== null,
        );
        const currentTeam =
            activeTeam === null
                ? currentHistory === undefined
                    ? null
                    : { id: currentHistory.teamId, name: currentHistory.teamName }
                : { id: activeTeam.id, name: activeTeam.name };
        const currentView =
            currentTeam === null || results === null
                ? null
                : findTeamResult(results, currentTeam.id);
        const current =
            currentTeam === null
                ? null
                : {
                      teamId: currentTeam.id,
                      teamName: currentTeam.name,
                      score:
                          results?.showScores === true && currentView !== null
                              ? (currentView.displayScore ?? currentView.averageScore)
                              : null,
                      rank: results?.showRanking === true ? (currentView?.rank ?? null) : null,
                      feedback:
                          results === null || currentView === null
                              ? []
                              : await this.teamFeedback(organizationId, editionId, currentView),
                      awards: [...(currentView?.awards ?? [])],
                  };

        const pastByEdition = new Map<string, (typeof history)[number]>();
        for (const entry of history) {
            if (entry.editionId === editionId) {
                continue;
            }
            const existing = pastByEdition.get(entry.editionId);
            if (
                existing === undefined ||
                (existing.leftAt !== null && entry.leftAt === null) ||
                (existing.leftAt === entry.leftAt && entry.joinedAt > existing.joinedAt)
            ) {
                pastByEdition.set(entry.editionId, entry);
            }
        }
        const pastEntries = await Promise.all(
            [...pastByEdition.values()].map(
                async (pastTeam): Promise<MyResults["past"][number] | null> => {
                    const pastRow = await this.database.transaction({ organizationId }, (session) =>
                        this.repository.findResults(session.db, organizationId, pastTeam.editionId),
                    );
                    if (pastRow === null) {
                        return null;
                    }
                    const pastResults = parseSnapshot(pastRow.snapshot);
                    const view = findTeamResult(pastResults, pastTeam.teamId);
                    if (view === null) {
                        return null;
                    }
                    return {
                        editionId: pastTeam.editionId,
                        editionName: pastTeam.editionName,
                        editionSlug: pastTeam.editionSlug,
                        teamId: pastTeam.teamId,
                        teamName: pastTeam.teamName,
                        score: pastResults.showScores
                            ? (view.displayScore ?? view.averageScore)
                            : null,
                        rank: pastResults.showRanking ? view.rank : null,
                        feedback: await this.teamFeedback(organizationId, pastTeam.editionId, view),
                        awards: [...view.awards],
                        publishedAt: pastRow.publishedAt.toISOString(),
                    };
                },
            ),
        );
        const past = pastEntries
            .flatMap((entry) => (entry === null ? [] : [entry]))
            .toSorted((left, right) => right.publishedAt.localeCompare(left.publishedAt));

        return {
            editionId,
            published: results !== null,
            publishedAt: results === null ? null : results.publishedAt,
            current,
            past,
        };
    }

    async published(organizationId: string, editionId: string): Promise<PublicResults | null> {
        await this.requireEdition(organizationId, editionId);
        const row = await this.database.transaction({ organizationId }, (session) =>
            this.repository.findResults(session.db, organizationId, editionId),
        );
        return row === null ? null : parseSnapshot(row.snapshot);
    }

    async publicResults(slug: string): Promise<PublicResults> {
        const row = await this.repository.findResultsBySlug(this.database.db, slug);
        if (row === null || !(await this.competitions.isPublicEdition(row.editionId))) {
            throw new NotFoundError("The published results were not found.");
        }
        return parseSnapshot(row.snapshot);
    }

    async publicCertificate(teamId: string): Promise<PublicCertificate> {
        const row = await this.repository.findResultsForTeam(this.database.db, teamId);
        if (row === null || !(await this.competitions.isPublicEdition(row.editionId))) {
            throw new NotFoundError("The certificate was not found.");
        }
        const results = parseSnapshot(row.snapshot);
        const view = findTeamResult(results, teamId);
        if (view === null) {
            throw new NotFoundError("The certificate was not found.");
        }
        // A rank-only certificate would disclose standings the organizers hid.
        const rank = results.showRanking ? view.rank : null;
        if (rank === null && view.awards.length === 0) {
            throw new NotFoundError("The certificate was not found.");
        }
        return {
            team: { id: view.teamId, name: view.teamName },
            project: view.project,
            edition: {
                id: results.edition.id,
                name: results.edition.name,
                slug: results.edition.slug,
                organizationName: results.edition.organizationName,
                startsAt: results.edition.startsAt,
                endsAt: results.edition.endsAt,
            },
            rank,
            awards: [...view.awards],
            publishedAt: results.publishedAt,
        };
    }

    private async teamFeedback(
        organizationId: string,
        editionId: string,
        view: TeamResultView,
    ): Promise<MyResultsFeedback[]> {
        if (view.submittedCount < MINIMUM_PUBLIC_REVIEWS) {
            return [];
        }
        const feedback = await this.judging.listTeamFeedback(
            organizationId,
            editionId,
            view.teamId,
        );
        return feedback.flatMap((entry): MyResultsFeedback[] => {
            const comment = entry.comment.trim();
            return comment.length === 0 ? [] : [{ comment, submittedAt: entry.submittedAt }];
        });
    }

    private async buildSnapshot(
        organizationId: string,
        editionId: string,
        publishedAt: Date,
    ): Promise<PublicResults> {
        const edition = await this.requireEdition(organizationId, editionId);
        const organization = await this.requireOrganization(organizationId);
        const [teamRows, submissionRows, judgingRows, votingRows, awardRows, assignmentRows] =
            await Promise.all([
                this.teams.listEditionTeams(organizationId, editionId),
                this.submissions.listEditionSubmissions(organizationId, editionId),
                this.judging.listEditionResults(organizationId, editionId),
                this.voting.getPublishedResults(organizationId, editionId),
                this.database.transaction({ organizationId }, (session) =>
                    this.repository.listAwards(session.db, organizationId, editionId),
                ),
                this.database.transaction({ organizationId }, (session) =>
                    this.repository.listTeamAwards(session.db, organizationId, editionId),
                ),
            ]);
        const divisionIds = [
            ...new Set(
                teamRows.flatMap((team) => (team.divisionId === null ? [] : [team.divisionId])),
            ),
        ];
        const divisionRows = await Promise.all(
            divisionIds.map((divisionId) =>
                this.competitions.getDivision(organizationId, divisionId),
            ),
        );
        return assemblePublicResults({
            edition: toPublicEdition(edition, organization.name, organization.slug),
            showScores: edition.showScores,
            showRanking: edition.showRanking,
            judging: judgingRows,
            voting: votingRows,
            teams: teamRows.map((team) => ({
                id: team.id,
                name: team.name,
                divisionId: team.divisionId,
            })),
            submissions: submissionRows.map((submission) => ({
                id: submission.id,
                projectId: submission.projectId,
                projectSlug: submission.projectSlug,
                teamId: submission.teamId,
                title: submission.title,
            })),
            divisions: divisionRows.flatMap((division) =>
                division === null ? [] : [{ id: division.id, name: division.name }],
            ),
            awards: awardRows.map(toAssemblyAward),
            teamAwards: assignmentRows.map((assignment) => ({
                awardId: assignment.awardId,
                teamId: assignment.teamId,
                note: assignment.note,
            })),
            publishedAt: publishedAt.toISOString(),
        });
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

    private async requireOrganization(
        organizationId: string,
    ): Promise<{ name: string; slug: string }> {
        const organization = await this.organizations.getSummary(organizationId);
        if (organization === null) {
            throw new NotFoundError("The organization was not found.");
        }
        return { name: organization.name, slug: organization.slug };
    }
}

function parseSnapshot(value: PublicResults): PublicResults {
    const parsed = publicResultsSchema.safeParse(value);
    if (!parsed.success) {
        throw new InternalError("The published results snapshot is invalid.");
    }
    return applyReviewThreshold(parsed.data);
}

function toAward(row: AwardRow): Award {
    return {
        id: row.id,
        organizationId: row.organizationId,
        editionId: row.editionId,
        namespace: row.namespace,
        name: row.name,
        description: row.description,
        icon: row.icon,
        color: row.color,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    };
}

function toAssemblyAward(row: AwardRow): AssemblyAward {
    return {
        id: row.id,
        namespace: row.namespace,
        name: row.name,
        description: row.description,
        icon: row.icon,
        color: row.color,
    };
}

function toTeamAward(row: TeamAwardRow, award: AwardRow, teamName: string): TeamAward {
    return {
        id: row.id,
        organizationId: row.organizationId,
        editionId: row.editionId,
        teamId: row.teamId,
        teamName,
        awardId: row.awardId,
        note: row.note,
        assignedByUserId: row.assignedByUserId,
        assignedAt: row.assignedAt.toISOString(),
        award: toAward(award),
    };
}

function toPublicEdition(
    edition: EditionSummary,
    organizationName: string,
    organizationSlug: string,
): PublicResults["edition"] {
    return {
        id: edition.id,
        name: edition.name,
        slug: edition.slug,
        description: edition.description,
        status: edition.status,
        seriesName: edition.seriesName,
        organizationName,
        organizationSlug,
        startsAt: edition.startsAt,
        endsAt: edition.endsAt,
    };
}
