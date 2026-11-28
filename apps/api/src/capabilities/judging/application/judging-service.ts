import type {
    AssignmentDetail,
    AssignmentHistory,
    CreateAssignmentRequest,
    CreateRubricRequest,
    Criterion,
    Evaluation,
    JudgeAssignment,
    JudgeAssignmentStatus,
    JudgeFlag,
    JudgingCoverage,
    JudgingHistoryItem,
    JudgingResult,
    JudgingRubric,
    OrganizationRole,
    SaveEvaluationRequest,
} from "@nethack/contracts";
import type { AuthContext } from "../../../authentication/types.js";
import type { Clock } from "../../../core/clock.js";
import { domainEvents } from "../../../core/domain-event.js";
import {
    ConflictError,
    ForbiddenError,
    InternalError,
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
import type { OrganizationSummary, OrganizationsContract } from "../../organizations/contracts.js";
import type { SubmissionSummary, SubmissionsContract } from "../../submissions/contracts.js";
import type { TeamsContract } from "../../teams/contracts.js";
import { nextEvaluationRevision, toEvaluationVersion } from "../domain/evaluation-history.js";
import { JudgeFlagRules } from "../domain/judge-flags.js";
import { summarizeJudgeCoverage } from "../domain/judging-coverage.js";
import { aggregateJudgingResults } from "../domain/judging-results.js";
import { JudgingRules, type ScorableCriterion } from "../domain/judging-rules.js";
import type { JudgingSummary } from "../contracts.js";
import type {
    AssignmentView,
    CriterionRow,
    EvaluationRow,
    JudgeFlagView,
    JudgingRepository,
    RubricWithCriteria,
} from "../infrastructure/judging-repository.js";

export interface JudgingContracts {
    readonly submissions: SubmissionsContract;
    readonly competitions: CompetitionsContract;
    readonly organizations: OrganizationsContract;
    readonly teams: TeamsContract;
}

export class JudgingService {
    private readonly database: DatabaseConnection;
    private readonly repository: JudgingRepository;
    private readonly contracts: JudgingContracts;
    private readonly events: OutboxPublisher;
    private readonly audit: AuditLogger;
    private readonly clock: Clock;

    constructor(
        database: DatabaseConnection,
        repository: JudgingRepository,
        contracts: JudgingContracts,
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

    async listRubrics(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
    ): Promise<readonly JudgingRubric[]> {
        this.requireMembership(auth, organizationId);
        await this.requireEdition(organizationId, editionId);
        const rows = await this.database.transaction({ organizationId }, async (session) =>
            this.repository.listRubrics(session.db, organizationId, editionId),
        );
        return rows.map(toRubric);
    }

    async createRubric(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
        input: CreateRubricRequest,
        ip: string | null,
    ): Promise<JudgingRubric> {
        this.assertOrganizer(auth, organizationId);
        await this.requireEdition(organizationId, editionId);
        const created = await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const rubric = await this.repository.insertRubric(session, {
                    organizationId,
                    editionId,
                    name: input.name,
                    description: input.description,
                });
                const criteria = await this.repository.insertCriteria(
                    session,
                    input.criteria.map((criterion, position) => ({
                        organizationId,
                        rubricId: rubric.id,
                        name: criterion.name,
                        description: criterion.description,
                        maxScore: criterion.maxScore,
                        weight: criterion.weight.toFixed(2),
                        position,
                    })),
                );
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "judging.rubric.created",
                    entityType: "judging_rubric",
                    entityId: rubric.id,
                    metadata: { editionId, criteriaCount: criteria.length },
                    ip,
                });
                return { rubric, criteria };
            },
        );
        return toRubric(created);
    }

    async listEditionAssignments(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
    ): Promise<readonly JudgeAssignment[]> {
        this.assertOrganizer(auth, organizationId);
        await this.requireEdition(organizationId, editionId);
        const views = await this.database.transaction({ organizationId }, async (session) =>
            this.repository.listAssignmentsForEdition(session.db, organizationId, editionId),
        );
        return this.toAssignments(organizationId, views);
    }

    async editionResults(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
    ): Promise<readonly JudgingResult[]> {
        this.assertOrganizer(auth, organizationId);
        return this.editionResultsForOrganization(organizationId, editionId);
    }

    async editionResultsForOrganization(
        organizationId: string,
        editionId: string,
    ): Promise<readonly JudgingResult[]> {
        await this.requireEdition(organizationId, editionId);
        const [evaluationRows, submissionRows, teamRows] = await Promise.all([
            this.database.transaction({ organizationId }, async (session) =>
                this.repository.listEditionEvaluationRows(session.db, organizationId, editionId),
            ),
            this.contracts.submissions.listEditionSubmissions(organizationId, editionId),
            this.contracts.teams.listEditionTeams(organizationId, editionId),
        ]);
        const submissionsById = new Map(
            submissionRows.map((submission) => [submission.id, submission] as const),
        );
        const teamsById = new Map(teamRows.map((team) => [team.id, team] as const));
        const rows = evaluationRows.map((row) => {
            const submission = submissionsById.get(row.submissionId);
            if (submission === undefined) {
                throw new InternalError("A judging assignment references a missing submission.");
            }
            return {
                ...row,
                projectId: submission.projectId,
                projectTitle: submission.title,
                teamId: submission.teamId,
                teamName:
                    submission.teamId === null
                        ? null
                        : (teamsById.get(submission.teamId)?.name ?? null),
            };
        });
        return aggregateJudgingResults(rows);
    }

    async createAssignment(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
        input: CreateAssignmentRequest,
        ip: string | null,
    ): Promise<JudgeAssignment> {
        this.assertOrganizer(auth, organizationId);
        await this.requireEdition(organizationId, editionId);
        const submission = await this.requireSubmission(
            organizationId,
            editionId,
            input.submissionId,
        );
        const organization = await this.requireOrganization(organizationId);
        const lookup = await this.database.transaction({ organizationId }, async (session) => ({
            rubric: await this.repository.findRubric(session.db, organizationId, input.rubricId),
            judge: await this.repository.findJudgeCandidate(
                session.db,
                organizationId,
                input.judgeEmail,
            ),
        }));
        if (lookup.rubric === null || lookup.rubric.rubric.editionId !== editionId) {
            throw new NotFoundError(
                "The judging rubric was not found for this competition edition.",
            );
        }
        if (lookup.judge === null) {
            throw new NotFoundError("No active judge was found with that email address.");
        }
        const judge = lookup.judge;
        JudgingRules.assertJudgeEligible(judge.role, judge.status);
        const dueAt = input.dueAt === null ? null : new Date(input.dueAt);
        const now = this.clock.now();
        try {
            const row = await this.database.transaction(
                { organizationId, userId: auth.user.id },
                async (session) => {
                    const existing = await this.repository.findAssignmentBySubmissionAndJudge(
                        session.db,
                        organizationId,
                        input.submissionId,
                        judge.userId,
                    );
                    if (existing !== null && existing.status !== "revoked") {
                        throw new ConflictError(
                            "That judge is already assigned to this submission.",
                        );
                    }
                    let assignment;
                    if (existing === null) {
                        assignment = await this.repository.insertAssignment(session, {
                            organizationId,
                            editionId,
                            rubricId: input.rubricId,
                            submissionId: input.submissionId,
                            judgeUserId: judge.userId,
                            status: "assigned",
                            assignmentNote: input.note,
                            dueAt,
                            assignedByUserId: auth.user.id,
                        });
                    } else {
                        const revived = await this.repository.updateAssignment(
                            session,
                            organizationId,
                            existing.id,
                            {
                                status: "assigned",
                                rubricId: input.rubricId,
                                conflictNote: null,
                                assignmentNote: input.note,
                                dueAt,
                                assignedByUserId: auth.user.id,
                                assignedAt: now,
                                updatedAt: now,
                            },
                        );
                        if (revived === null) {
                            throw new NotFoundError("The judging assignment was not found.");
                        }
                        assignment = revived;
                    }
                    await this.audit.record(session, {
                        organizationId,
                        actorUserId: auth.user.id,
                        action: "judging.assignment.created",
                        entityType: "judge_assignment",
                        entityId: assignment.id,
                        metadata: {
                            submissionId: assignment.submissionId,
                            judgeUserId: assignment.judgeUserId,
                            rubricId: assignment.rubricId,
                        },
                        ip,
                    });
                    await this.events.publish(session, {
                        type: domainEvents.judgeAssigned,
                        organizationId,
                        aggregateType: "judge_assignment",
                        aggregateId: assignment.id,
                        payload: {
                            assignmentId: assignment.id,
                            submissionId: assignment.submissionId,
                            projectTitle: submission.title,
                            judgeUserId: assignment.judgeUserId,
                            judgeEmail: judge.email,
                            email: judge.email,
                            organizationId,
                            organizationName: organization.name,
                            editionId,
                            dueAt: dueAt === null ? null : dueAt.toISOString(),
                        },
                    });
                    return assignment;
                },
            );
            return toAssignment(
                { assignment: row, judgeDisplayName: judge.displayName },
                submission.title,
            );
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new ConflictError("That judge is already assigned to this submission.");
            }
            throw error;
        }
    }

    async listMyAssignments(
        auth: AuthContext,
        organizationId: string,
        status: JudgeAssignmentStatus | null,
    ): Promise<readonly JudgeAssignment[]> {
        this.requireMembership(auth, organizationId);
        const views = await this.database.transaction({ organizationId }, async (session) =>
            this.repository.listAssignmentsForJudge(
                session.db,
                organizationId,
                auth.user.id,
                status,
            ),
        );
        return this.toAssignments(organizationId, views);
    }

    async reportFlag(
        auth: AuthContext,
        organizationId: string,
        assignmentId: string,
        reason: string,
        ip: string | null,
    ): Promise<JudgeFlag> {
        this.requireMembership(auth, organizationId);
        try {
            return await this.database.transaction(
                { organizationId, userId: auth.user.id },
                async (session) => {
                    const assignment = await this.repository.findAssignmentForUpdate(
                        session,
                        organizationId,
                        assignmentId,
                    );
                    if (assignment === null) {
                        throw new NotFoundError("The judging assignment was not found.");
                    }
                    if (assignment.judgeUserId !== auth.user.id) {
                        throw new ForbiddenError("Only the assigned judge may report a flag.");
                    }
                    JudgeFlagRules.assertCanFlag(assignment.status);
                    const existing = await this.repository.findFlagByAssignmentAndJudge(
                        session.db,
                        organizationId,
                        assignmentId,
                        auth.user.id,
                    );
                    if (existing !== null) {
                        throw new ConflictError("You already reported a flag for this project.");
                    }
                    const flag = await this.repository.insertFlag(session, {
                        organizationId,
                        editionId: assignment.editionId,
                        assignmentId,
                        submissionId: assignment.submissionId,
                        reportedByUserId: auth.user.id,
                        reason,
                        status: "open",
                    });
                    await this.audit.record(session, {
                        organizationId,
                        actorUserId: auth.user.id,
                        action: "judging.flag.reported",
                        entityType: "judge_flag",
                        entityId: flag.id,
                        metadata: {
                            assignmentId,
                            submissionId: assignment.submissionId,
                        },
                        ip,
                    });
                    const view = await this.repository.findFlagViewById(
                        session.db,
                        organizationId,
                        flag.id,
                    );
                    if (view === null) {
                        throw new InternalError("The judging flag could not be read back.");
                    }
                    return toJudgeFlag(view);
                },
            );
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new ConflictError("You already reported a flag for this project.");
            }
            throw error;
        }
    }

    async listEditionFlags(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
    ): Promise<readonly JudgeFlag[]> {
        this.assertOrganizer(auth, organizationId);
        await this.requireEdition(organizationId, editionId);
        const views = await this.database.transaction({ organizationId }, async (session) =>
            this.repository.listFlagsForEdition(session.db, organizationId, editionId),
        );
        return views.map(toJudgeFlag);
    }

    async resolveFlag(
        auth: AuthContext,
        organizationId: string,
        flagId: string,
        ip: string | null,
    ): Promise<JudgeFlag> {
        this.assertOrganizer(auth, organizationId);
        const now = this.clock.now();
        return this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const existing = await this.repository.findFlagForUpdate(
                    session,
                    organizationId,
                    flagId,
                );
                if (existing === null) {
                    throw new NotFoundError("The judging flag was not found.");
                }
                const next = JudgeFlagRules.resolution(existing.status);
                if (next !== null) {
                    const resolved = await this.repository.resolveFlag(
                        session,
                        organizationId,
                        flagId,
                        { resolvedByUserId: auth.user.id, resolvedAt: now },
                    );
                    if (resolved === null) {
                        throw new NotFoundError("The judging flag was not found.");
                    }
                    await this.audit.record(session, {
                        organizationId,
                        actorUserId: auth.user.id,
                        action: "judging.flag.resolved",
                        entityType: "judge_flag",
                        entityId: flagId,
                        metadata: {
                            assignmentId: existing.assignmentId,
                            submissionId: existing.submissionId,
                        },
                        ip,
                    });
                }
                const view = await this.repository.findFlagViewById(
                    session.db,
                    organizationId,
                    flagId,
                );
                if (view === null) {
                    throw new NotFoundError("The judging flag was not found.");
                }
                return toJudgeFlag(view);
            },
        );
    }

    async judgingCoverage(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
    ): Promise<JudgingCoverage> {
        this.assertOrganizer(auth, organizationId);
        const edition = await this.requireEdition(organizationId, editionId);
        const loaded = await this.database.transaction({ organizationId }, async (session) => ({
            rows: await this.repository.listEditionEvaluationRows(
                session.db,
                organizationId,
                editionId,
            ),
            flags: await this.repository.listFlagsForEdition(session.db, organizationId, editionId),
        }));
        const summary = summarizeJudgeCoverage(
            loaded.rows,
            loaded.flags.map((view) => ({
                reportedByUserId: view.flag.reportedByUserId,
                status: view.flag.status,
            })),
        );
        return {
            editionId,
            editionName: edition.name,
            judgeCount: summary.judges.length,
            assignmentCount: summary.assignmentCount,
            submittedCount: summary.submittedCount,
            editionAverageScore: summary.editionAverageScore,
            judges: [...summary.judges],
            openFlags: loaded.flags.filter((view) => view.flag.status === "open").map(toJudgeFlag),
        };
    }

    async judgingHistory(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
    ): Promise<readonly JudgingHistoryItem[]> {
        this.requireMembership(auth, organizationId);
        await this.requireEdition(organizationId, editionId);
        const [rows, submissionRows, teamRows] = await Promise.all([
            this.database.transaction({ organizationId }, async (session) =>
                this.repository.listSubmittedEvaluationRows(
                    session.db,
                    organizationId,
                    auth.user.id,
                    editionId,
                ),
            ),
            this.contracts.submissions.listEditionSubmissions(organizationId, editionId),
            this.contracts.teams.listEditionTeams(organizationId, editionId),
        ]);
        const submissionsById = new Map(
            submissionRows.map((submission) => [submission.id, submission] as const),
        );
        const teamsById = new Map(teamRows.map((team) => [team.id, team] as const));
        return rows.map((row) => {
            const submission = submissionsById.get(row.submissionId);
            if (submission === undefined) {
                throw new InternalError("A judging evaluation references a missing submission.");
            }
            return {
                assignmentId: row.assignmentId,
                submissionId: row.submissionId,
                projectId: submission.projectId,
                projectTitle: submission.title,
                teamId: submission.teamId,
                teamName:
                    submission.teamId === null
                        ? null
                        : (teamsById.get(submission.teamId)?.name ?? null),
                rubricName: row.rubricName,
                evaluationId: row.evaluationId,
                weightedScore: row.weightedScore,
                overallComment: row.overallComment,
                submittedAt: row.submittedAt.toISOString(),
                scores: row.scores.map((score) => ({ ...score })),
            };
        });
    }

    async assignmentDetail(
        auth: AuthContext,
        organizationId: string,
        assignmentId: string,
    ): Promise<AssignmentDetail> {
        const role = this.requireMembership(auth, organizationId);
        const view = await this.database.transaction({ organizationId }, async (session) =>
            this.repository.findAssignmentView(session.db, organizationId, assignmentId),
        );
        if (view === null) {
            throw new NotFoundError("The judging assignment was not found.");
        }
        this.assertCanView(view, auth.user.id, role);
        const loaded = await this.database.transaction({ organizationId }, async (session) => ({
            rubric: await this.repository.findRubric(
                session.db,
                organizationId,
                view.assignment.rubricId,
            ),
            evaluation: await this.repository.findEvaluationWithScores(
                session.db,
                organizationId,
                assignmentId,
            ),
        }));
        const rubric = loaded.rubric;
        if (rubric === null) {
            throw new NotFoundError("The judging rubric was not found.");
        }
        const evaluation = loaded.evaluation;
        const submission = await this.requireSubmission(
            organizationId,
            view.assignment.editionId,
            view.assignment.submissionId,
        );
        return {
            assignment: toAssignment(view, submission.title),
            criteria: rubric.criteria.map(toCriterion),
            submission: {
                id: submission.id,
                projectId: submission.projectId,
                projectTitle: submission.title,
                teamId: submission.teamId,
            },
            evaluation:
                evaluation === null ? null : toEvaluation(evaluation.evaluation, evaluation.scores),
        };
    }

    async declareConflict(
        auth: AuthContext,
        organizationId: string,
        assignmentId: string,
        note: string,
        ip: string | null,
    ): Promise<void> {
        this.requireMembership(auth, organizationId);
        const now = this.clock.now();
        await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const assignment = await this.repository.findAssignmentForUpdate(
                    session,
                    organizationId,
                    assignmentId,
                );
                if (assignment === null) {
                    throw new NotFoundError("The judging assignment was not found.");
                }
                if (assignment.judgeUserId !== auth.user.id) {
                    throw new ForbiddenError("Only the assigned judge may declare a conflict.");
                }
                JudgingRules.assertCanDeclareConflict(assignment.status);
                const updated = await this.repository.updateAssignment(
                    session,
                    organizationId,
                    assignmentId,
                    { status: "conflict_declared", conflictNote: note, updatedAt: now },
                );
                if (updated === null) {
                    throw new NotFoundError("The judging assignment was not found.");
                }
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "judging.assignment.conflict_declared",
                    entityType: "judge_assignment",
                    entityId: assignmentId,
                    metadata: { submissionId: assignment.submissionId },
                    ip,
                });
            },
        );
    }

    async saveEvaluation(
        auth: AuthContext,
        organizationId: string,
        assignmentId: string,
        input: SaveEvaluationRequest,
    ): Promise<Evaluation> {
        this.requireMembership(auth, organizationId);
        const now = this.clock.now();
        return this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const assignment = await this.repository.findAssignmentForUpdate(
                    session,
                    organizationId,
                    assignmentId,
                );
                if (assignment === null) {
                    throw new NotFoundError("The judging assignment was not found.");
                }
                if (assignment.judgeUserId !== auth.user.id) {
                    throw new ForbiddenError("Only the assigned judge may score this assignment.");
                }
                JudgingRules.assertCanEvaluate(assignment.status);
                JudgingRules.assertBeforeDeadline(assignment.dueAt, now);
                const rubric = await this.repository.findRubric(
                    session.db,
                    organizationId,
                    assignment.rubricId,
                );
                if (rubric === null) {
                    throw new NotFoundError("The judging rubric was not found.");
                }
                const criteria = scorableCriteria(rubric.criteria);
                const weighted = JudgingRules.weightedScore(criteria, input.scores);
                const existing = await this.repository.findEvaluation(
                    session.db,
                    organizationId,
                    assignmentId,
                );
                if (existing !== null && existing.status === "submitted") {
                    throw new ConflictError("This evaluation was already submitted.");
                }
                let evaluation: EvaluationRow;
                if (existing === null) {
                    evaluation = await this.repository.insertEvaluation(session, {
                        organizationId,
                        assignmentId,
                        judgeUserId: auth.user.id,
                        status: "draft",
                        overallComment: input.overallComment,
                        weightedScore: weighted.toFixed(2),
                    });
                } else {
                    const updated = await this.repository.updateEvaluation(
                        session,
                        organizationId,
                        existing.id,
                        {
                            status: "draft",
                            overallComment: input.overallComment,
                            weightedScore: weighted.toFixed(2),
                            updatedAt: now,
                        },
                    );
                    if (updated === null) {
                        throw new NotFoundError("The evaluation was not found.");
                    }
                    evaluation = updated;
                }
                await this.repository.deleteScores(session, organizationId, evaluation.id);
                await this.repository.insertScores(
                    session,
                    input.scores.map((score) => ({
                        organizationId,
                        evaluationId: evaluation.id,
                        criterionId: score.criterionId,
                        score: score.score,
                        comment: score.comment,
                    })),
                );
                const updatedAssignment = await this.repository.updateAssignment(
                    session,
                    organizationId,
                    assignmentId,
                    { status: "in_progress", updatedAt: now },
                );
                if (updatedAssignment === null) {
                    throw new NotFoundError("The judging assignment was not found.");
                }
                await this.recordEvaluationVersion(session, {
                    organizationId,
                    assignmentId,
                    judgeUserId: auth.user.id,
                    evaluation,
                    status: "draft",
                    scores: input.scores,
                    submittedAt: null,
                });
                return toEvaluation(evaluation, input.scores);
            },
        );
    }

    async submitEvaluation(
        auth: AuthContext,
        organizationId: string,
        assignmentId: string,
        ip: string | null,
    ): Promise<Evaluation> {
        this.requireMembership(auth, organizationId);
        const assignment = await this.database.transaction({ organizationId }, async (session) =>
            this.repository.findAssignment(session.db, organizationId, assignmentId),
        );
        if (assignment === null) {
            throw new NotFoundError("The judging assignment was not found.");
        }
        if (assignment.judgeUserId !== auth.user.id) {
            throw new ForbiddenError("Only the assigned judge may submit this evaluation.");
        }
        const submission = await this.requireSubmission(
            organizationId,
            assignment.editionId,
            assignment.submissionId,
        );
        const now = this.clock.now();
        return this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const locked = await this.repository.findAssignmentForUpdate(
                    session,
                    organizationId,
                    assignmentId,
                );
                if (locked === null) {
                    throw new NotFoundError("The judging assignment was not found.");
                }
                if (locked.judgeUserId !== auth.user.id) {
                    throw new ForbiddenError("Only the assigned judge may submit this evaluation.");
                }
                JudgingRules.assertCanEvaluate(locked.status);
                JudgingRules.assertBeforeDeadline(locked.dueAt, now);
                const loaded = await this.repository.findEvaluationWithScores(
                    session.db,
                    organizationId,
                    assignmentId,
                );
                if (loaded === null) {
                    throw new ValidationError("Save a draft evaluation before submitting.");
                }
                if (loaded.evaluation.status === "submitted") {
                    throw new ConflictError("This evaluation was already submitted.");
                }
                const rubric = await this.repository.findRubric(
                    session.db,
                    organizationId,
                    locked.rubricId,
                );
                if (rubric === null) {
                    throw new NotFoundError("The judging rubric was not found.");
                }
                const criteria = scorableCriteria(rubric.criteria);
                const weighted = JudgingRules.weightedScore(criteria, loaded.scores);
                const evaluation = await this.repository.updateEvaluation(
                    session,
                    organizationId,
                    loaded.evaluation.id,
                    {
                        status: "submitted",
                        weightedScore: weighted.toFixed(2),
                        submittedAt: now,
                        updatedAt: now,
                    },
                );
                if (evaluation === null) {
                    throw new NotFoundError("The evaluation was not found.");
                }
                const updatedAssignment = await this.repository.updateAssignment(
                    session,
                    organizationId,
                    assignmentId,
                    { status: "submitted", updatedAt: now },
                );
                if (updatedAssignment === null) {
                    throw new NotFoundError("The judging assignment was not found.");
                }
                await this.recordEvaluationVersion(session, {
                    organizationId,
                    assignmentId,
                    judgeUserId: auth.user.id,
                    evaluation,
                    status: "submitted",
                    scores: loaded.scores,
                    submittedAt: now,
                });
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "judging.evaluation.submitted",
                    entityType: "evaluation",
                    entityId: evaluation.id,
                    metadata: {
                        assignmentId,
                        submissionId: locked.submissionId,
                        weightedScore: weighted,
                    },
                    ip,
                });
                await this.events.publish(session, {
                    type: domainEvents.evaluationSubmitted,
                    organizationId,
                    aggregateType: "judge_assignment",
                    aggregateId: assignmentId,
                    payload: {
                        assignmentId,
                        submissionId: locked.submissionId,
                        projectId: submission.projectId,
                        judgeUserId: auth.user.id,
                        organizationId,
                        editionId: locked.editionId,
                        weightedScore: weighted,
                    },
                });
                return toEvaluation(evaluation, loaded.scores);
            },
        );
    }

    async evaluationHistory(
        auth: AuthContext,
        organizationId: string,
        assignmentId: string,
    ): Promise<AssignmentHistory> {
        const role = this.requireMembership(auth, organizationId);
        const loaded = await this.database.transaction({ organizationId }, async (session) => ({
            view: await this.repository.findAssignmentView(
                session.db,
                organizationId,
                assignmentId,
            ),
            evaluation: await this.repository.findEvaluationWithScores(
                session.db,
                organizationId,
                assignmentId,
            ),
            versions: await this.repository.listEvaluationVersions(
                session.db,
                organizationId,
                assignmentId,
            ),
        }));
        if (loaded.view === null) {
            throw new NotFoundError("The judging assignment was not found.");
        }
        this.assertCanView(loaded.view, auth.user.id, role);
        return {
            evaluation:
                loaded.evaluation === null
                    ? null
                    : toEvaluation(loaded.evaluation.evaluation, loaded.evaluation.scores),
            versions: loaded.versions.map(toEvaluationVersion),
        };
    }

    async revokeAssignment(
        auth: AuthContext,
        organizationId: string,
        assignmentId: string,
        ip: string | null,
    ): Promise<void> {
        this.assertOrganizer(auth, organizationId);
        const now = this.clock.now();
        await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const assignment = await this.repository.findAssignmentForUpdate(
                    session,
                    organizationId,
                    assignmentId,
                );
                if (assignment === null) {
                    throw new NotFoundError("The judging assignment was not found.");
                }
                if (assignment.status === "revoked") {
                    return;
                }
                const updated = await this.repository.updateAssignment(
                    session,
                    organizationId,
                    assignmentId,
                    { status: "revoked", updatedAt: now },
                );
                if (updated === null) {
                    throw new NotFoundError("The judging assignment was not found.");
                }
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "judging.assignment.revoked",
                    entityType: "judge_assignment",
                    entityId: assignmentId,
                    metadata: {
                        submissionId: assignment.submissionId,
                        judgeUserId: assignment.judgeUserId,
                    },
                    ip,
                });
            },
        );
    }

    async getAssignment(
        organizationId: string,
        assignmentId: string,
    ): Promise<JudgingSummary | null> {
        return this.database.transaction({ organizationId }, async (session) => {
            const assignment = await this.repository.findAssignment(
                session.db,
                organizationId,
                assignmentId,
            );
            if (assignment === null) {
                return null;
            }
            const evaluation = await this.repository.findEvaluation(
                session.db,
                organizationId,
                assignmentId,
            );
            return {
                assignmentId: assignment.id,
                submissionId: assignment.submissionId,
                judgeUserId: assignment.judgeUserId,
                status: assignment.status,
                hasSubmittedEvaluation: evaluation !== null && evaluation.status === "submitted",
            };
        });
    }

    async countSubmittedEvaluations(organizationId: string, editionId: string): Promise<number> {
        return this.database.transaction({ organizationId }, async (session) =>
            this.repository.countSubmittedEvaluations(session.db, organizationId, editionId),
        );
    }

    async countOpenFlags(organizationId: string, editionId: string): Promise<number> {
        return this.database.transaction({ organizationId }, async (session) =>
            this.repository.countOpenFlags(session.db, organizationId, editionId),
        );
    }

    async getEvaluation(organizationId: string, assignmentId: string): Promise<Evaluation | null> {
        return this.database.transaction({ organizationId }, async (session) => {
            const loaded = await this.repository.findEvaluationWithScores(
                session.db,
                organizationId,
                assignmentId,
            );
            return loaded === null ? null : toEvaluation(loaded.evaluation, loaded.scores);
        });
    }

    private async recordEvaluationVersion(
        session: DatabaseSession,
        input: {
            readonly organizationId: string;
            readonly assignmentId: string;
            readonly judgeUserId: string;
            readonly evaluation: EvaluationRow;
            readonly status: "draft" | "submitted";
            readonly scores: readonly {
                readonly criterionId: string;
                readonly score: number;
                readonly comment: string;
            }[];
            readonly submittedAt: Date | null;
        },
    ): Promise<void> {
        const latestRevision = await this.repository.latestEvaluationRevision(
            session.db,
            input.organizationId,
            input.evaluation.id,
        );
        await this.repository.insertEvaluationVersion(session, {
            organizationId: input.organizationId,
            evaluationId: input.evaluation.id,
            assignmentId: input.assignmentId,
            judgeUserId: input.judgeUserId,
            revision: nextEvaluationRevision(latestRevision),
            status: input.status,
            overallComment: input.evaluation.overallComment,
            weightedScore: input.evaluation.weightedScore,
            scores: input.scores.map((score) => ({
                criterionId: score.criterionId,
                score: score.score,
                comment: score.comment,
            })),
            submittedAt: input.submittedAt,
        });
    }

    private async toAssignments(
        organizationId: string,
        views: readonly AssignmentView[],
    ): Promise<readonly JudgeAssignment[]> {
        if (views.length === 0) {
            return [];
        }
        const summaries = await this.submissionSummaries(organizationId, views);
        return views.map((view) =>
            toAssignment(view, submissionTitle(summaries, view.assignment.submissionId)),
        );
    }

    private async submissionSummaries(
        organizationId: string,
        views: readonly AssignmentView[],
    ): Promise<Map<string, SubmissionSummary>> {
        const editionIds = [...new Set(views.map((view) => view.assignment.editionId))];
        const lists = await Promise.all(
            editionIds.map((editionId) =>
                this.contracts.submissions.listEditionSubmissions(organizationId, editionId),
            ),
        );
        const summaries = new Map<string, SubmissionSummary>();
        for (const list of lists) {
            for (const summary of list) {
                summaries.set(summary.id, summary);
            }
        }
        return summaries;
    }

    private async requireSubmission(
        organizationId: string,
        editionId: string,
        submissionId: string,
    ): Promise<SubmissionSummary> {
        const summary = await this.contracts.submissions.getSubmission(
            organizationId,
            submissionId,
        );
        if (
            summary === null ||
            summary.organizationId !== organizationId ||
            summary.editionId !== editionId
        ) {
            throw new NotFoundError("The submission was not found for this competition edition.");
        }
        return summary;
    }

    private async requireEdition(
        organizationId: string,
        editionId: string,
    ): Promise<EditionSummary> {
        const edition = await this.contracts.competitions.getEdition(organizationId, editionId);
        if (edition === null) {
            throw new NotFoundError("The competition edition was not found.");
        }
        return edition;
    }

    private async requireOrganization(organizationId: string): Promise<OrganizationSummary> {
        const organization = await this.contracts.organizations.getSummary(organizationId);
        if (organization === null) {
            throw new NotFoundError("The organization was not found.");
        }
        return organization;
    }

    private requireMembership(auth: AuthContext, organizationId: string): OrganizationRole {
        const membership = auth.memberships.find(
            (candidate) =>
                candidate.organizationId === organizationId && candidate.status === "active",
        );
        if (membership === undefined) {
            throw new ForbiddenError("You are not an active member of this organization.");
        }
        return membership.role;
    }

    private assertOrganizer(auth: AuthContext, organizationId: string): void {
        if (!JudgingRules.isOrganizer(this.requireMembership(auth, organizationId))) {
            throw new ForbiddenError("Your organization role does not permit this action.");
        }
    }

    private assertCanView(view: AssignmentView, userId: string, role: OrganizationRole): void {
        if (!JudgingRules.isOrganizer(role) && view.assignment.judgeUserId !== userId) {
            throw new NotFoundError("The judging assignment was not found.");
        }
    }
}

export function toEvaluation(
    evaluation: EvaluationRow,
    scores: readonly {
        readonly criterionId: string;
        readonly score: number;
        readonly comment: string;
    }[],
): Evaluation {
    return {
        id: evaluation.id,
        organizationId: evaluation.organizationId,
        assignmentId: evaluation.assignmentId,
        judgeUserId: evaluation.judgeUserId,
        status: evaluation.status,
        overallComment: evaluation.overallComment,
        scores: scores.map((score) => ({
            criterionId: score.criterionId,
            score: score.score,
            comment: score.comment,
        })),
        weightedScore: evaluation.weightedScore === null ? null : Number(evaluation.weightedScore),
        submittedAt: nullableIso(evaluation.submittedAt),
        updatedAt: evaluation.updatedAt.toISOString(),
    };
}

function toJudgeFlag(view: JudgeFlagView): JudgeFlag {
    return {
        id: view.flag.id,
        organizationId: view.flag.organizationId,
        editionId: view.flag.editionId,
        assignmentId: view.flag.assignmentId,
        submissionId: view.flag.submissionId,
        reportedByUserId: view.flag.reportedByUserId,
        reportedByDisplayName: view.reportedByDisplayName,
        reason: view.flag.reason,
        status: view.flag.status,
        resolvedByUserId: view.flag.resolvedByUserId,
        resolvedByDisplayName: view.resolvedByDisplayName,
        resolvedAt: nullableIso(view.flag.resolvedAt),
        createdAt: view.flag.createdAt.toISOString(),
    };
}

function toRubric(row: RubricWithCriteria): JudgingRubric {
    return {
        id: row.rubric.id,
        organizationId: row.rubric.organizationId,
        editionId: row.rubric.editionId,
        name: row.rubric.name,
        description: row.rubric.description,
        criteria: row.criteria
            .toSorted((left, right) => left.position - right.position)
            .map(toCriterion),
        createdAt: row.rubric.createdAt.toISOString(),
        updatedAt: row.rubric.updatedAt.toISOString(),
    };
}

function toCriterion(row: CriterionRow): Criterion {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        maxScore: row.maxScore,
        weight: Number(row.weight),
        position: row.position,
    };
}

function toAssignment(view: AssignmentView, projectTitle: string): JudgeAssignment {
    return {
        id: view.assignment.id,
        organizationId: view.assignment.organizationId,
        editionId: view.assignment.editionId,
        rubricId: view.assignment.rubricId,
        submissionId: view.assignment.submissionId,
        judgeUserId: view.assignment.judgeUserId,
        judgeDisplayName: view.judgeDisplayName,
        projectTitle,
        status: view.assignment.status,
        conflictNote: view.assignment.conflictNote,
        assignmentNote: view.assignment.assignmentNote,
        dueAt: nullableIso(view.assignment.dueAt),
        assignedAt: view.assignment.assignedAt.toISOString(),
    };
}

function scorableCriteria(rows: readonly CriterionRow[]): readonly ScorableCriterion[] {
    return rows.map((row) => ({
        id: row.id,
        maxScore: row.maxScore,
        weight: Number(row.weight),
    }));
}

function submissionTitle(summaries: Map<string, SubmissionSummary>, submissionId: string): string {
    const summary = summaries.get(submissionId);
    if (summary === undefined) {
        throw new InternalError("A judging assignment references a missing submission.");
    }
    return summary.title;
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
