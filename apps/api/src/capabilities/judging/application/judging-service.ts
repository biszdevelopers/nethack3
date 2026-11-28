import type {
    ApplyRubricTemplateRequest,
    AssignmentDetail,
    AssignmentHistory,
    BulkAssignmentResult,
    CreateAssignmentRequest,
    CreateBulkAssignmentRequest,
    CreateRubricRequest,
    CreateRubricTemplateRequest,
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
    PublicRubric,
    RubricTemplate,
    RubricTemplateDefinition,
    SaveEvaluationRequest,
    ScoreCurve,
    ScoreCurveResponse,
    SubmissionStatus,
    TeamFeedbackEntry,
    TeamFeedbackResponse,
    UpdateRubricRequest,
    UpdateRubricTemplateRequest,
} from "@nethack/contracts";
import { DEFAULT_RUBRIC_COMMENT_GUIDANCE } from "@nethack/contracts";
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
import type { JobQueue } from "../../../infrastructure/jobs/job-queue.js";
import {
    isEditionResultsFrozen,
    type CompetitionsContract,
    type EditionSummary,
} from "../../competitions/contracts.js";
import type { OrganizationSummary, OrganizationsContract } from "../../organizations/contracts.js";
import type { ProjectsContract } from "../../projects/contracts.js";
import type { SubmissionSummary, SubmissionsContract } from "../../submissions/contracts.js";
import type { TeamsContract } from "../../teams/contracts.js";
import {
    planBulkAssignments,
    selectBulkSubmissionIds,
    type BulkSubmissionCandidate,
} from "../domain/bulk-assignment.js";
import { nextEvaluationRevision, toEvaluationVersion } from "../domain/evaluation-history.js";
import { assertJudgeCommentReady } from "../domain/judge-comments.js";
import {
    flagNotificationDedupeKey,
    flagNotificationRecipients,
    JudgeFlagRules,
} from "../domain/judge-flags.js";
import { summarizeJudgeCoverage } from "../domain/judging-coverage.js";
import { aggregateJudgingResults } from "../domain/judging-results.js";
import { JudgingRules, type ScorableCriterion } from "../domain/judging-rules.js";
import {
    assertRubricCriteria,
    assertRubricWeightTotal,
    assertTemplateTrack,
    buildRubricSnapshot,
    nextRubricVersion,
    normalizeTemplateCriteria,
    resolveRubricWeights,
    type RubricCriterionInput,
} from "../domain/rubric-definition.js";
import {
    applyScoreCurve,
    assertValidScoreCurve,
    DEFAULT_SCORE_CURVE_POINTS,
} from "../domain/score-curve.js";
import {
    anonymousTeamFeedback,
    TEAM_FEEDBACK_MIN_REVIEWERS,
    type SubmittedTeamFeedbackRow,
} from "../domain/team-feedback.js";
import type { JudgingSummary } from "../contracts.js";
import {
    EMPTY_PROJECT_DISCLOSURE,
    toProjectDisclosure,
    type ProjectDisclosure,
} from "./project-disclosure.js";
import type {
    AssignmentRow,
    AssignmentView,
    CriterionRow,
    EvaluationRow,
    JudgeFlagView,
    JudgingRepository,
    RubricTemplateRow,
    RubricWithCriteria,
} from "../infrastructure/judging-repository.js";

export interface JudgingContracts {
    readonly submissions: SubmissionsContract;
    readonly competitions: CompetitionsContract;
    readonly organizations: OrganizationsContract;
    readonly teams: TeamsContract;
    readonly projects: ProjectsContract;
}

/**
 * The notifications capability owns delivery. Flags only publish its job so the
 * organizer notification lands in the same transaction as the flag.
 */
const NOTIFICATION_DELIVERY_JOB = "notifications.deliver";

export class JudgingService {
    private readonly database: DatabaseConnection;
    private readonly repository: JudgingRepository;
    private readonly contracts: JudgingContracts;
    private readonly events: OutboxPublisher;
    private readonly jobs: JobQueue;
    private readonly audit: AuditLogger;
    private readonly clock: Clock;
    private readonly workspaceOrigin: string;

    constructor(
        database: DatabaseConnection,
        repository: JudgingRepository,
        contracts: JudgingContracts,
        events: OutboxPublisher,
        jobs: JobQueue,
        audit: AuditLogger,
        clock: Clock,
        workspaceOrigin: string,
    ) {
        this.database = database;
        this.repository = repository;
        this.contracts = contracts;
        this.events = events;
        this.jobs = jobs;
        this.audit = audit;
        this.clock = clock;
        this.workspaceOrigin = workspaceOrigin;
    }

    async listRubrics(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
        includeInactive = false,
    ): Promise<readonly JudgingRubric[]> {
        const role = this.requireMembership(auth, organizationId);
        if (includeInactive && !JudgingRules.isOrganizer(role)) {
            throw new ForbiddenError("Only organizers can view inactive rubric versions.");
        }
        await this.requireEdition(organizationId, editionId);
        const rows = await this.database.transaction({ organizationId }, async (session) =>
            this.repository.listRubrics(session.db, organizationId, editionId, includeInactive),
        );
        return rows.map(toRubric);
    }

    async listPublicRubrics(editionId: string): Promise<PublicRubric[]> {
        const edition = await this.contracts.competitions.getPublicEdition(editionId);
        if (edition === null) {
            throw new NotFoundError("The competition edition was not found.");
        }
        const [rows, divisions] = await Promise.all([
            this.database.transaction({ organizationId: edition.organizationId }, async (session) =>
                this.repository.listRubrics(session.db, edition.organizationId, editionId, false),
            ),
            this.contracts.competitions.listDivisions(edition.organizationId, editionId),
        ]);
        const divisionNames = new Map(divisions.map((division) => [division.id, division.name]));
        return rows.map((row) => {
            const rubric = toRubric(row);
            return {
                id: rubric.id,
                name: rubric.name,
                description: rubric.description,
                version: rubric.version,
                divisionId: rubric.divisionId,
                divisionName:
                    rubric.divisionId === null
                        ? null
                        : (divisionNames.get(rubric.divisionId) ?? null),
                criteria: rubric.criteria.map((criterion) => ({
                    name: criterion.name,
                    description: criterion.description,
                    maxScore: criterion.maxScore,
                    weight: criterion.weight,
                })),
            };
        });
    }

    async getRubric(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
        rubricId: string,
    ): Promise<JudgingRubric> {
        this.requireMembership(auth, organizationId);
        await this.requireEdition(organizationId, editionId);
        const rubric = await this.database.transaction({ organizationId }, async (session) =>
            this.repository.findRubric(session.db, organizationId, rubricId),
        );
        if (rubric === null || rubric.rubric.editionId !== editionId) {
            throw new NotFoundError(
                "The judging rubric was not found for this competition edition.",
            );
        }
        return toRubric(rubric);
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
        await this.requireDivision(organizationId, editionId, input.divisionId);
        const criteria = this.resolveCriteria(input.criteria);
        const guidance = input.commentGuidance ?? DEFAULT_RUBRIC_COMMENT_GUIDANCE;
        const created = await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const rubric = await this.repository.insertRubric(session, {
                    organizationId,
                    editionId,
                    divisionId: input.divisionId,
                    version: 1,
                    active: true,
                    name: input.name,
                    description: input.description,
                    commentGuidance: guidance,
                });
                const inserted = await this.repository.insertCriteria(
                    session,
                    criteria.map((criterion, position) => ({
                        organizationId,
                        rubricId: rubric.id,
                        name: criterion.name,
                        description: criterion.description,
                        minScore: criterion.minScore,
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
                    metadata: {
                        editionId,
                        divisionId: rubric.divisionId,
                        version: rubric.version,
                        criteriaCount: inserted.length,
                    },
                    ip,
                });
                return { rubric, criteria: inserted };
            },
        );
        return toRubric(created);
    }

    async updateRubric(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
        rubricId: string,
        input: UpdateRubricRequest,
        ip: string | null,
    ): Promise<JudgingRubric> {
        this.assertOrganizer(auth, organizationId);
        await this.requireEdition(organizationId, editionId);
        const now = this.clock.now();
        const created = await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const existing = await this.repository.findRubricForUpdate(
                    session,
                    organizationId,
                    rubricId,
                );
                if (existing === null || existing.rubric.editionId !== editionId) {
                    throw new NotFoundError(
                        "The judging rubric was not found for this competition edition.",
                    );
                }
                const divisionId =
                    input.divisionId === undefined ? existing.rubric.divisionId : input.divisionId;
                await this.requireDivision(organizationId, editionId, divisionId);
                const criteria =
                    input.criteria === undefined
                        ? existing.criteria.map((criterion) => ({
                              name: criterion.name,
                              description: criterion.description,
                              minScore: criterion.minScore,
                              maxScore: criterion.maxScore,
                              weight: Number(criterion.weight),
                          }))
                        : this.resolveCriteria(input.criteria);
                assertRubricWeightTotal(criteria.map((criterion) => criterion.weight));
                const latest = await this.repository.maxRubricVersion(
                    session.db,
                    organizationId,
                    existing.rubric.familyId,
                );
                const rubric = await this.repository.insertRubric(session, {
                    organizationId,
                    editionId,
                    divisionId,
                    familyId: existing.rubric.familyId,
                    version: nextRubricVersion(latest),
                    active: true,
                    name: input.name ?? existing.rubric.name,
                    description: input.description ?? existing.rubric.description,
                    commentGuidance: input.commentGuidance ?? existing.rubric.commentGuidance,
                });
                const inserted = await this.repository.insertCriteria(
                    session,
                    criteria.map((criterion, position) => ({
                        organizationId,
                        rubricId: rubric.id,
                        name: criterion.name,
                        description: criterion.description,
                        minScore: criterion.minScore,
                        maxScore: criterion.maxScore,
                        weight: criterion.weight.toFixed(2),
                        position,
                    })),
                );
                await this.repository.deactivateRubricFamily(
                    session,
                    organizationId,
                    existing.rubric.familyId,
                    rubric.id,
                    now,
                );
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "judging.rubric.version_created",
                    entityType: "judging_rubric",
                    entityId: rubric.id,
                    metadata: {
                        editionId,
                        previousRubricId: existing.rubric.id,
                        version: rubric.version,
                    },
                    ip,
                });
                return { rubric, criteria: inserted };
            },
        );
        return toRubric(created);
    }

    async publishRubric(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
        rubricId: string,
        ip: string | null,
    ): Promise<JudgingRubric> {
        this.assertOrganizer(auth, organizationId);
        await this.requireEdition(organizationId, editionId);
        const now = this.clock.now();
        const published = await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const existing = await this.repository.findRubricForUpdate(
                    session,
                    organizationId,
                    rubricId,
                );
                if (existing === null || existing.rubric.editionId !== editionId) {
                    throw new NotFoundError(
                        "The judging rubric was not found for this competition edition.",
                    );
                }
                assertRubricWeightTotal(
                    existing.criteria.map((criterion) => Number(criterion.weight)),
                );
                const rubric = existing.rubric.active
                    ? existing.rubric
                    : await this.repository.setRubricActive(
                          session,
                          organizationId,
                          rubricId,
                          true,
                          now,
                      );
                if (rubric === null) {
                    throw new NotFoundError("The judging rubric was not found.");
                }
                await this.repository.deactivateRubricFamily(
                    session,
                    organizationId,
                    existing.rubric.familyId,
                    rubricId,
                    now,
                );
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "judging.rubric.published",
                    entityType: "judging_rubric",
                    entityId: rubricId,
                    metadata: { editionId, version: existing.rubric.version },
                    ip,
                });
                return { rubric, criteria: existing.criteria };
            },
        );
        return toRubric(published);
    }

    async archiveRubric(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
        rubricId: string,
        ip: string | null,
    ): Promise<JudgingRubric> {
        this.assertOrganizer(auth, organizationId);
        await this.requireEdition(organizationId, editionId);
        const now = this.clock.now();
        const archived = await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const existing = await this.repository.findRubricForUpdate(
                    session,
                    organizationId,
                    rubricId,
                );
                if (existing === null || existing.rubric.editionId !== editionId) {
                    throw new NotFoundError(
                        "The judging rubric was not found for this competition edition.",
                    );
                }
                const rubric = existing.rubric.active
                    ? await this.repository.setRubricActive(
                          session,
                          organizationId,
                          rubricId,
                          false,
                          now,
                      )
                    : existing.rubric;
                if (rubric === null) {
                    throw new NotFoundError("The judging rubric was not found.");
                }
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "judging.rubric.archived",
                    entityType: "judging_rubric",
                    entityId: rubricId,
                    metadata: { editionId, version: existing.rubric.version },
                    ip,
                });
                return { rubric, criteria: existing.criteria };
            },
        );
        return toRubric(archived);
    }

    async listRubricTemplates(
        auth: AuthContext,
        organizationId: string,
    ): Promise<readonly RubricTemplate[]> {
        this.assertOrganizer(auth, organizationId);
        const rows = await this.database.transaction({ organizationId }, async (session) =>
            this.repository.listRubricTemplates(session.db, organizationId),
        );
        return rows.map(toRubricTemplate);
    }

    async createRubricTemplate(
        auth: AuthContext,
        organizationId: string,
        input: CreateRubricTemplateRequest,
        ip: string | null,
    ): Promise<RubricTemplate> {
        this.assertOrganizer(auth, organizationId);
        assertTemplateDefinition(input.definition);
        try {
            return await this.database.transaction(
                { organizationId, userId: auth.user.id },
                async (session) => {
                    const template = await this.repository.insertRubricTemplate(session, {
                        organizationId,
                        name: input.name,
                        description: input.description,
                        definition: input.definition,
                    });
                    await this.audit.record(session, {
                        organizationId,
                        actorUserId: auth.user.id,
                        action: "judging.rubric_template.created",
                        entityType: "judging_rubric_template",
                        entityId: template.id,
                        metadata: { name: template.name },
                        ip,
                    });
                    return toRubricTemplate(template);
                },
            );
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new ConflictError("A rubric template already uses that name.");
            }
            throw error;
        }
    }

    async updateRubricTemplate(
        auth: AuthContext,
        organizationId: string,
        templateId: string,
        input: UpdateRubricTemplateRequest,
        ip: string | null,
    ): Promise<RubricTemplate> {
        this.assertOrganizer(auth, organizationId);
        assertTemplateDefinition(input.definition);
        try {
            return await this.database.transaction(
                { organizationId, userId: auth.user.id },
                async (session) => {
                    const template = await this.repository.updateRubricTemplate(
                        session,
                        organizationId,
                        templateId,
                        {
                            name: input.name,
                            description: input.description,
                            definition: input.definition,
                            updatedAt: this.clock.now(),
                        },
                    );
                    if (template === null) {
                        throw new NotFoundError("The rubric template was not found.");
                    }
                    await this.audit.record(session, {
                        organizationId,
                        actorUserId: auth.user.id,
                        action: "judging.rubric_template.updated",
                        entityType: "judging_rubric_template",
                        entityId: template.id,
                        metadata: { name: template.name },
                        ip,
                    });
                    return toRubricTemplate(template);
                },
            );
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new ConflictError("A rubric template already uses that name.");
            }
            throw error;
        }
    }

    async deleteRubricTemplate(
        auth: AuthContext,
        organizationId: string,
        templateId: string,
        ip: string | null,
    ): Promise<void> {
        this.assertOrganizer(auth, organizationId);
        await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const template = await this.repository.findRubricTemplate(
                    session.db,
                    organizationId,
                    templateId,
                );
                if (template === null) {
                    throw new NotFoundError("The rubric template was not found.");
                }
                await this.repository.deleteRubricTemplate(session, organizationId, templateId);
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "judging.rubric_template.deleted",
                    entityType: "judging_rubric_template",
                    entityId: templateId,
                    metadata: { name: template.name },
                    ip,
                });
            },
        );
    }

    async applyRubricTemplate(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
        templateId: string,
        input: ApplyRubricTemplateRequest,
        ip: string | null,
    ): Promise<JudgingRubric> {
        this.assertOrganizer(auth, organizationId);
        await this.requireEdition(organizationId, editionId);
        await this.requireDivision(organizationId, editionId, input.divisionId);
        const created = await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const template = await this.repository.findRubricTemplate(
                    session.db,
                    organizationId,
                    templateId,
                );
                if (template === null) {
                    throw new NotFoundError("The rubric template was not found.");
                }
                const track =
                    input.trackKey === undefined
                        ? template.definition.tracks[0]
                        : template.definition.tracks.find(
                              (candidate) => candidate.key === input.trackKey,
                          );
                if (track === undefined) {
                    throw new NotFoundError("The rubric template track was not found.");
                }
                const criteria = normalizeTemplateCriteria(track.criteria);
                const rubric = await this.repository.insertRubric(session, {
                    organizationId,
                    editionId,
                    divisionId: input.divisionId,
                    version: 1,
                    active: true,
                    name: input.name ?? `${template.name} — ${track.name}`,
                    description: template.description,
                    commentGuidance: template.definition.commentGuidance,
                });
                const inserted = await this.repository.insertCriteria(
                    session,
                    criteria.map((criterion, position) => ({
                        organizationId,
                        rubricId: rubric.id,
                        name: criterion.name,
                        description: criterion.description,
                        minScore: criterion.minScore,
                        maxScore: criterion.maxScore,
                        weight: criterion.weight.toFixed(2),
                        position,
                    })),
                );
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "judging.rubric_template.applied",
                    entityType: "judging_rubric",
                    entityId: rubric.id,
                    metadata: {
                        editionId,
                        templateId,
                        trackKey: track.key,
                        divisionId: rubric.divisionId,
                    },
                    ip,
                });
                return { rubric, criteria: inserted };
            },
        );
        return toRubric(created);
    }

    async getScoreCurve(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
    ): Promise<ScoreCurveResponse> {
        this.requireMembership(auth, organizationId);
        await this.requireEdition(organizationId, editionId);
        const row = await this.database.transaction({ organizationId }, async (session) =>
            this.repository.findScoreCurve(session.db, organizationId, editionId),
        );
        return {
            editionId,
            curve: { points: row === null ? [...DEFAULT_SCORE_CURVE_POINTS] : [...row.points] },
            updatedAt: row === null ? null : row.updatedAt.toISOString(),
        };
    }

    async updateScoreCurve(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
        curve: ScoreCurve,
        ip: string | null,
    ): Promise<ScoreCurveResponse> {
        this.assertOrganizer(auth, organizationId);
        await this.requireWritableEdition(organizationId, editionId);
        assertValidScoreCurve(curve.points);
        const now = this.clock.now();
        const row = await this.database.transaction(
            { organizationId, userId: auth.user.id },
            async (session) => {
                const saved = await this.repository.upsertScoreCurve(session, {
                    organizationId,
                    editionId,
                    points: curve.points,
                    updatedAt: now,
                });
                await this.audit.record(session, {
                    organizationId,
                    actorUserId: auth.user.id,
                    action: "judging.score_curve.updated",
                    entityType: "judging_score_curve",
                    entityId: saved.id,
                    metadata: { editionId, points: curve.points },
                    ip,
                });
                return saved;
            },
        );
        return {
            editionId,
            curve: { points: [...row.points] },
            updatedAt: row.updatedAt.toISOString(),
        };
    }

    async listEditionAssignments(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
    ): Promise<readonly JudgeAssignment[]> {
        this.assertOrganizer(auth, organizationId);
        const edition = await this.requireEdition(organizationId, editionId);
        const views = await this.database.transaction({ organizationId }, async (session) =>
            this.repository.listAssignmentsForEdition(session.db, organizationId, editionId),
        );
        return this.toAssignments(organizationId, views, isEditionResultsFrozen(edition.status));
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
        const [evaluationRows, submissionRows, teamRows, curveRow] = await Promise.all([
            this.database.transaction({ organizationId }, async (session) =>
                this.repository.listEditionEvaluationRows(session.db, organizationId, editionId),
            ),
            this.contracts.submissions.listEditionSubmissions(organizationId, editionId),
            this.contracts.teams.listEditionTeams(organizationId, editionId),
            this.database.transaction({ organizationId }, async (session) =>
                this.repository.findScoreCurve(session.db, organizationId, editionId),
            ),
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
                teamStatus:
                    submission.teamId === null
                        ? null
                        : (teamsById.get(submission.teamId)?.status ?? null),
            };
        });
        return aggregateJudgingResults(
            rows,
            curveRow === null ? DEFAULT_SCORE_CURVE_POINTS : curveRow.points,
        );
    }

    async createAssignment(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
        input: CreateAssignmentRequest,
        ip: string | null,
    ): Promise<JudgeAssignment> {
        this.assertOrganizer(auth, organizationId);
        const edition = await this.requireEdition(organizationId, editionId);
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
        if (submission.teamId !== null) {
            const history = await this.contracts.teams.listUserTeamHistory(
                organizationId,
                judge.userId,
            );
            if (history.some((entry) => entry.teamId === submission.teamId)) {
                throw new ConflictError(
                    "That judge has been a member of this project's team and cannot be assigned to it.",
                );
            }
        }
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
            const [project, team] = await Promise.all([
                this.contracts.projects.getProject(organizationId, submission.projectId),
                submission.teamId === null
                    ? Promise.resolve(null)
                    : this.contracts.teams.getTeam(organizationId, submission.teamId),
            ]);
            const divisionName = await this.divisionNameFor(
                organizationId,
                team?.divisionId ?? null,
            );
            return toAssignment(
                { assignment: row, judgeDisplayName: judge.displayName },
                submission.title,
                team?.name ?? null,
                divisionName,
                submission.status,
                toProjectDisclosure(project),
                isEditionResultsFrozen(edition.status),
            );
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new ConflictError("That judge is already assigned to this submission.");
            }
            throw error;
        }
    }

    async createBulkAssignments(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
        input: CreateBulkAssignmentRequest,
        ip: string | null,
    ): Promise<BulkAssignmentResult> {
        this.assertOrganizer(auth, organizationId);
        const edition = await this.requireEdition(organizationId, editionId);
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

        let divisionTeamIds: readonly string[] = [];
        if (input.scope === "division") {
            if (input.divisionId === undefined) {
                throw new ValidationError("Choose the division to assign.");
            }
            await this.requireDivision(organizationId, editionId, input.divisionId);
            const teams = await this.contracts.teams.listEditionTeams(organizationId, editionId);
            divisionTeamIds = teams
                .filter((team) => team.divisionId === input.divisionId)
                .map((team) => team.id);
        }
        const submissions = await this.contracts.submissions.listEditionSubmissions(
            organizationId,
            editionId,
        );
        const candidates: readonly BulkSubmissionCandidate[] = submissions.map((submission) => ({
            id: submission.id,
            teamId: submission.teamId,
            status: submission.status,
        }));
        const submittedIds = selectBulkSubmissionIds({
            scope: input.scope,
            submissions: candidates,
            ...(input.submissionId === undefined ? {} : { submissionId: input.submissionId }),
            ...(input.scope === "division" ? { divisionTeamIds } : {}),
        });
        const history = await this.contracts.teams.listUserTeamHistory(
            organizationId,
            judge.userId,
        );
        const formerTeamIds = new Set(history.map((entry) => entry.teamId));
        const submissionIds = submittedIds.filter((submissionId) => {
            const candidate = candidates.find((entry) => entry.id === submissionId);
            return candidate?.teamId === null || candidate?.teamId === undefined
                ? true
                : !formerTeamIds.has(candidate.teamId);
        });
        const blockedByHistory = submittedIds.length - submissionIds.length;
        if (input.scope === "submission" && submittedIds.length === 0) {
            throw new NotFoundError("The submission was not found for this competition edition.");
        }
        if (input.scope === "submission" && submissionIds.length === 0) {
            throw new ConflictError(
                "That judge has been a member of this project's team and cannot be assigned to it.",
            );
        }

        const dueAt = input.dueAt === null ? null : new Date(input.dueAt);
        const now = this.clock.now();
        try {
            const created = await this.database.transaction(
                { organizationId, userId: auth.user.id },
                async (session) => {
                    const active = await this.repository.listActiveSubmissionIdsForJudge(
                        session.db,
                        organizationId,
                        editionId,
                        judge.userId,
                    );
                    const plan = planBulkAssignments(submissionIds, new Set(active));
                    const rows: AssignmentRow[] = [];
                    for (const submissionId of plan.toAssign) {
                        const existing = await this.repository.findAssignmentBySubmissionAndJudge(
                            session.db,
                            organizationId,
                            submissionId,
                            judge.userId,
                        );
                        if (existing === null) {
                            rows.push(
                                await this.repository.insertAssignment(session, {
                                    organizationId,
                                    editionId,
                                    rubricId: input.rubricId,
                                    submissionId,
                                    judgeUserId: judge.userId,
                                    status: "assigned",
                                    assignmentNote: input.note,
                                    dueAt,
                                    assignedByUserId: auth.user.id,
                                }),
                            );
                            continue;
                        }
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
                        rows.push(revived);
                    }
                    if (rows.length > 0) {
                        await this.audit.record(session, {
                            organizationId,
                            actorUserId: auth.user.id,
                            action: "judging.assignment.bulk_created",
                            entityType: "competition_edition",
                            entityId: editionId,
                            metadata: {
                                scope: input.scope,
                                divisionId: input.divisionId ?? null,
                                rubricId: input.rubricId,
                                judgeUserId: judge.userId,
                                assigned: rows.length,
                                skipped: plan.skipped,
                            },
                            ip,
                        });
                        const first = rows[0];
                        if (first !== undefined) {
                            await this.events.publish(session, {
                                type: domainEvents.judgeAssigned,
                                organizationId,
                                aggregateType: "judge_assignment",
                                aggregateId: first.id,
                                payload: {
                                    assignmentId: first.id,
                                    submissionId: first.submissionId,
                                    projectTitle: `${String(rows.length)} submissions`,
                                    judgeUserId: judge.userId,
                                    judgeEmail: judge.email,
                                    email: judge.email,
                                    organizationId,
                                    organizationName: organization.name,
                                    editionId,
                                    dueAt: dueAt === null ? null : dueAt.toISOString(),
                                },
                            });
                        }
                    }
                    return { rows, skipped: plan.skipped + blockedByHistory };
                },
            );
            const assigned = await this.toAssignments(
                organizationId,
                created.rows.map((assignment) => ({
                    assignment,
                    judgeDisplayName: judge.displayName,
                })),
                isEditionResultsFrozen(edition.status),
            );
            return { assigned: [...assigned], skipped: created.skipped };
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new ConflictError("A judge is already assigned to one of these submissions.");
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
        if (views.length === 0) {
            return [];
        }
        const editionIds = [...new Set(views.map((view) => view.assignment.editionId))];
        const editions = await Promise.all(
            editionIds.map((editionId) => this.requireEdition(organizationId, editionId)),
        );
        const frozenByEditionId = new Map(
            editions.map(
                (edition) => [edition.id, isEditionResultsFrozen(edition.status)] as const,
            ),
        );
        return this.toAssignments(organizationId, views, frozenByEditionId);
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
                    const recipients = flagNotificationRecipients(
                        await this.repository.listFlagRecipientCandidates(
                            session.db,
                            organizationId,
                        ),
                        auth.user.id,
                    );
                    for (const recipient of recipients) {
                        const dedupeKey = flagNotificationDedupeKey(
                            organizationId,
                            flag.id,
                            recipient.userId,
                        );
                        await this.jobs.enqueue(session, {
                            kind: NOTIFICATION_DELIVERY_JOB,
                            payload: {
                                userId: recipient.userId,
                                email: null,
                                organizationId,
                                kind: "system",
                                title: "Judging flag reported",
                                body: "A judge flagged a project for organizer review.",
                                linkUrl: new URL("/judging", this.workspaceOrigin).toString(),
                                dedupeKey,
                            },
                            organizationId,
                            dedupeKey: `notifications.deliver:${dedupeKey}`,
                        });
                    }
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
            standardDeviation: summary.standardDeviation,
            judges: [...summary.judges],
            outliers: [...summary.outliers],
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
        const [rows, submissionRows, teamRows, curveRow] = await Promise.all([
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
            this.database.transaction({ organizationId }, async (session) =>
                this.repository.findScoreCurve(session.db, organizationId, editionId),
            ),
        ]);
        const curvePoints = curveRow === null ? DEFAULT_SCORE_CURVE_POINTS : curveRow.points;
        const submissionsById = new Map(
            submissionRows.map((submission) => [submission.id, submission] as const),
        );
        const teamsById = new Map(teamRows.map((team) => [team.id, team] as const));
        const submittedSubmissionIds = new Set(rows.map((row) => row.submissionId));
        const [disclosures, divisionNames] = await Promise.all([
            this.projectDisclosures(
                organizationId,
                submissionRows
                    .filter((submission) => submittedSubmissionIds.has(submission.id))
                    .map((submission) => submission.projectId),
            ),
            this.divisionNamesById(
                organizationId,
                teamRows.map((team) => team.divisionId),
            ),
        ]);
        return rows.map((row) => {
            const submission = submissionsById.get(row.submissionId);
            if (submission === undefined) {
                throw new InternalError("A judging evaluation references a missing submission.");
            }
            const team = submission.teamId === null ? undefined : teamsById.get(submission.teamId);
            const disclosure = disclosures.get(submission.projectId) ?? EMPTY_PROJECT_DISCLOSURE;
            return {
                assignmentId: row.assignmentId,
                submissionId: row.submissionId,
                projectId: submission.projectId,
                projectTitle: submission.title,
                teamId: submission.teamId,
                teamName: team?.name ?? null,
                divisionName:
                    team?.divisionId === null || team?.divisionId === undefined
                        ? null
                        : (divisionNames.get(team.divisionId) ?? null),
                descriptionMarkdown: disclosure.descriptionMarkdown,
                repositoryUrl: disclosure.repositoryUrl,
                demoUrl: disclosure.demoUrl,
                videoUrl: disclosure.videoUrl,
                aiDisclosure: disclosure.aiDisclosure,
                submissionStatus: submission.status,
                rubricName: row.rubricName,
                rubricVersion: row.rubricVersion,
                evaluationId: row.evaluationId,
                weightedScore: row.weightedScore,
                displayWeightedScore:
                    row.weightedScore === null
                        ? null
                        : applyScoreCurve(row.weightedScore, curvePoints),
                overallComment: row.overallComment,
                submittedAt: row.submittedAt.toISOString(),
                scores: row.scores.map((score) => ({ ...score })),
            };
        });
    }

    /**
     * Anonymous written feedback for one team. Returns entries only after at
     * least TEAM_FEEDBACK_MIN_REVIEWERS submitted evaluations exist; judge
     * identity and individual score breakdowns are never part of the result.
     */
    async teamFeedbackForOrganization(
        organizationId: string,
        editionId: string,
        teamId: string,
    ): Promise<readonly TeamFeedbackEntry[]> {
        const loaded = await this.loadTeamFeedback(organizationId, editionId, teamId);
        return anonymousTeamFeedback(loaded.rows);
    }

    async teamFeedbackView(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
        teamId: string,
    ): Promise<TeamFeedbackResponse> {
        this.assertOrganizer(auth, organizationId);
        const loaded = await this.loadTeamFeedback(organizationId, editionId, teamId);
        const feedback = anonymousTeamFeedback(loaded.rows);
        return {
            teamId,
            threshold: TEAM_FEEDBACK_MIN_REVIEWERS,
            submittedCount: loaded.rows.length,
            withheld: feedback.length === 0,
            feedback: [...feedback],
        };
    }

    private async loadTeamFeedback(
        organizationId: string,
        editionId: string,
        teamId: string,
    ): Promise<{ readonly rows: readonly SubmittedTeamFeedbackRow[] }> {
        await this.requireEdition(organizationId, editionId);
        const team = await this.contracts.teams.getTeam(organizationId, teamId);
        if (team === null || team.editionId !== editionId) {
            throw new NotFoundError("The team was not found for this competition edition.");
        }
        const submissions = await this.contracts.submissions.listEditionSubmissions(
            organizationId,
            editionId,
        );
        const submissionIds = submissions
            .filter((submission) => submission.teamId === teamId)
            .map((submission) => submission.id);
        const rows = await this.database.transaction({ organizationId }, async (session) =>
            this.repository.listSubmittedFeedbackForSubmissions(
                session.db,
                organizationId,
                editionId,
                submissionIds,
            ),
        );
        return {
            rows: rows.map((row) => ({
                comment: row.overallComment,
                weightedScore: row.weightedScore,
                submittedAt: row.submittedAt.toISOString(),
            })),
        };
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
            curve: await this.repository.findScoreCurve(
                session.db,
                organizationId,
                view.assignment.editionId,
            ),
        }));
        const rubric = loaded.rubric;
        if (rubric === null) {
            throw new NotFoundError("The judging rubric was not found.");
        }
        const evaluation = loaded.evaluation;
        const curvePoints =
            loaded.curve === null ? DEFAULT_SCORE_CURVE_POINTS : loaded.curve.points;
        const edition = await this.requireEdition(organizationId, view.assignment.editionId);
        const submission = await this.requireSubmission(
            organizationId,
            view.assignment.editionId,
            view.assignment.submissionId,
        );
        const project = await this.contracts.projects.getProject(
            organizationId,
            submission.projectId,
        );
        const disclosure = toProjectDisclosure(project);
        const team =
            submission.teamId === null
                ? null
                : await this.contracts.teams.getTeam(organizationId, submission.teamId);
        const divisionName = await this.divisionNameFor(organizationId, team?.divisionId ?? null);
        const evaluationView =
            evaluation === null ? null : toEvaluation(evaluation.evaluation, evaluation.scores);
        return {
            assignment: toAssignment(
                view,
                submission.title,
                team?.name ?? null,
                divisionName,
                submission.status,
                disclosure,
                isEditionResultsFrozen(edition.status),
            ),
            rubric: toRubric(rubric),
            criteria: rubric.criteria.map(toCriterion),
            submission: {
                id: submission.id,
                projectId: submission.projectId,
                projectTitle: submission.title,
                teamId: submission.teamId,
                teamName: team?.name ?? null,
                divisionName,
                submissionStatus: submission.status,
                videoUrl: disclosure.videoUrl,
                aiDisclosure: disclosure.aiDisclosure,
                repositoryUrl: disclosure.repositoryUrl,
                demoUrl: disclosure.demoUrl,
                descriptionMarkdown: disclosure.descriptionMarkdown,
            },
            evaluation: evaluationView,
            scoreCurve: { points: [...curvePoints] },
            displayWeightedScore:
                evaluationView === null || evaluationView.weightedScore === null
                    ? null
                    : applyScoreCurve(evaluationView.weightedScore, curvePoints),
            frozen: isEditionResultsFrozen(edition.status),
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
        const existingAssignment = await this.database.transaction(
            { organizationId },
            async (session) =>
                this.repository.findAssignment(session.db, organizationId, assignmentId),
        );
        if (existingAssignment === null) {
            throw new NotFoundError("The judging assignment was not found.");
        }
        if (existingAssignment.judgeUserId !== auth.user.id) {
            throw new ForbiddenError("Only the assigned judge may score this assignment.");
        }
        await this.requireWritableEdition(organizationId, existingAssignment.editionId);
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
                assertJudgeCommentReady(input.overallComment, {
                    displayName: auth.user.displayName,
                    email: auth.user.email,
                });
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
                    rubric,
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
        await this.requireWritableEdition(organizationId, assignment.editionId);
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
                assertJudgeCommentReady(loaded.evaluation.overallComment, {
                    displayName: auth.user.displayName,
                    email: auth.user.email,
                });
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
                    rubric,
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
        const loaded = await this.database.transaction({ organizationId }, async (session) => {
            const view = await this.repository.findAssignmentView(
                session.db,
                organizationId,
                assignmentId,
            );
            return {
                view,
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
                curve:
                    view === null
                        ? null
                        : await this.repository.findScoreCurve(
                              session.db,
                              organizationId,
                              view.assignment.editionId,
                          ),
            };
        });
        if (loaded.view === null) {
            throw new NotFoundError("The judging assignment was not found.");
        }
        this.assertCanView(loaded.view, auth.user.id, role);
        const curvePoints =
            loaded.curve === null ? DEFAULT_SCORE_CURVE_POINTS : loaded.curve.points;
        const evaluation =
            loaded.evaluation === null
                ? null
                : toEvaluation(loaded.evaluation.evaluation, loaded.evaluation.scores);
        return {
            evaluation,
            versions: loaded.versions.map(toEvaluationVersion),
            scoreCurve: { points: [...curvePoints] },
            displayWeightedScore:
                evaluation === null || evaluation.weightedScore === null
                    ? null
                    : applyScoreCurve(evaluation.weightedScore, curvePoints),
        };
    }

    async voidEvaluation(
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
                const evaluation = await this.repository.findEvaluation(
                    session.db,
                    organizationId,
                    assignmentId,
                );
                if (evaluation === null) {
                    throw new NotFoundError("The evaluation was not found.");
                }
                if (evaluation.status !== "submitted") {
                    throw new ConflictError("Only a submitted evaluation can be voided.");
                }
                await this.repository.deleteEvaluation(session, organizationId, evaluation.id);
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
                    action: "judging.evaluation.voided",
                    entityType: "evaluation",
                    entityId: evaluation.id,
                    metadata: {
                        assignmentId,
                        submissionId: assignment.submissionId,
                        judgeUserId: assignment.judgeUserId,
                        weightedScore:
                            evaluation.weightedScore === null
                                ? null
                                : Number(evaluation.weightedScore),
                    },
                    ip,
                });
            },
        );
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
            readonly rubric: RubricWithCriteria;
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
        const criteria = input.rubric.criteria.map(toCriterion);
        await this.repository.insertEvaluationVersion(session, {
            organizationId: input.organizationId,
            evaluationId: input.evaluation.id,
            assignmentId: input.assignmentId,
            judgeUserId: input.judgeUserId,
            revision: nextEvaluationRevision(latestRevision),
            status: input.status,
            overallComment: input.evaluation.overallComment,
            weightedScore: input.evaluation.weightedScore,
            rubricId: input.rubric.rubric.id,
            rubricVersion: input.rubric.rubric.version,
            rubricSnapshot: buildRubricSnapshot({
                id: input.rubric.rubric.id,
                name: input.rubric.rubric.name,
                version: input.rubric.rubric.version,
                divisionId: input.rubric.rubric.divisionId,
                commentGuidance: {
                    introduction: input.rubric.rubric.commentGuidance.introduction,
                    guidelines: [...input.rubric.rubric.commentGuidance.guidelines],
                    templates: input.rubric.rubric.commentGuidance.templates.map((template) => ({
                        label: template.label,
                        body: template.body,
                    })),
                },
                criteria,
            }),
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
        frozen: boolean | ReadonlyMap<string, boolean> = false,
    ): Promise<readonly JudgeAssignment[]> {
        if (views.length === 0) {
            return [];
        }
        const summaries = await this.submissionSummaries(organizationId, views);
        const editionIds = [...new Set(views.map((view) => view.assignment.editionId))];
        const [teamLists, disclosures] = await Promise.all([
            Promise.all(
                editionIds.map((editionId) =>
                    this.contracts.teams.listEditionTeams(organizationId, editionId),
                ),
            ),
            this.projectDisclosures(
                organizationId,
                [...summaries.values()].map((summary) => summary.projectId),
            ),
        ]);
        const teamsById = new Map(teamLists.flat().map((team) => [team.id, team] as const));
        const divisionNames = await this.divisionNamesById(
            organizationId,
            [...teamsById.values()].map((team) => team.divisionId),
        );
        return views.map((view) => {
            const summary = summaries.get(view.assignment.submissionId);
            if (summary === undefined) {
                throw new InternalError("A judging assignment references a missing submission.");
            }
            const team = summary.teamId === null ? undefined : teamsById.get(summary.teamId);
            return toAssignment(
                view,
                summary.title,
                team?.name ?? null,
                team?.divisionId === null || team?.divisionId === undefined
                    ? null
                    : (divisionNames.get(team.divisionId) ?? null),
                summary.status,
                disclosures.get(summary.projectId) ?? EMPTY_PROJECT_DISCLOSURE,
                typeof frozen === "boolean"
                    ? frozen
                    : (frozen.get(view.assignment.editionId) ?? false),
            );
        });
    }

    private async divisionNamesById(
        organizationId: string,
        divisionIds: readonly (string | null)[],
    ): Promise<ReadonlyMap<string, string>> {
        const uniqueIds = [
            ...new Set(
                divisionIds.filter((divisionId): divisionId is string => divisionId !== null),
            ),
        ];
        const entries = await Promise.all(
            uniqueIds.map(async (divisionId) => {
                const division = await this.contracts.competitions.getDivision(
                    organizationId,
                    divisionId,
                );
                return division === null ? null : ([division.id, division.name] as const);
            }),
        );
        return new Map(
            entries.filter((entry): entry is readonly [string, string] => entry !== null),
        );
    }

    private async divisionNameFor(
        organizationId: string,
        divisionId: string | null,
    ): Promise<string | null> {
        if (divisionId === null) {
            return null;
        }
        const division = await this.contracts.competitions.getDivision(organizationId, divisionId);
        return division?.name ?? null;
    }

    private async projectDisclosures(
        organizationId: string,
        projectIds: readonly string[],
    ): Promise<ReadonlyMap<string, ProjectDisclosure>> {
        const uniqueIds = [...new Set(projectIds)];
        const entries = await Promise.all(
            uniqueIds.map(async (projectId) => {
                const project = await this.contracts.projects.getProject(organizationId, projectId);
                return [projectId, toProjectDisclosure(project)] as const;
            }),
        );
        return new Map(entries);
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

    private async requireWritableEdition(organizationId: string, editionId: string): Promise<void> {
        const edition = await this.requireEdition(organizationId, editionId);
        JudgingRules.assertEditionWritable(edition.status);
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

    private resolveCriteria(
        criteria: readonly RubricCriterionInput[],
    ): readonly RubricCriterionInput[] {
        assertRubricCriteria(criteria);
        const weights = resolveRubricWeights(criteria.map((criterion) => criterion.weight));
        return criteria.map((criterion, index) => ({
            name: criterion.name,
            description: criterion.description,
            minScore: criterion.minScore,
            maxScore: criterion.maxScore,
            weight: weights[index] ?? criterion.weight,
        }));
    }

    private async requireDivision(
        organizationId: string,
        editionId: string,
        divisionId: string | null,
    ): Promise<void> {
        if (divisionId === null) {
            return;
        }
        const division = await this.contracts.competitions.getDivision(organizationId, divisionId);
        if (division === null || division.editionId !== editionId) {
            throw new NotFoundError("The division was not found for this competition edition.");
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
        divisionId: row.rubric.divisionId,
        familyId: row.rubric.familyId,
        version: row.rubric.version,
        active: row.rubric.active,
        name: row.rubric.name,
        description: row.rubric.description,
        commentGuidance: {
            introduction: row.rubric.commentGuidance.introduction,
            guidelines: [...row.rubric.commentGuidance.guidelines],
            templates: row.rubric.commentGuidance.templates.map((template) => ({
                label: template.label,
                body: template.body,
            })),
        },
        criteria: row.criteria
            .toSorted((left, right) => left.position - right.position)
            .map(toCriterion),
        createdAt: row.rubric.createdAt.toISOString(),
        updatedAt: row.rubric.updatedAt.toISOString(),
    };
}

function toRubricTemplate(row: RubricTemplateRow): RubricTemplate {
    return {
        id: row.id,
        organizationId: row.organizationId,
        name: row.name,
        description: row.description,
        definition: {
            tracks: row.definition.tracks.map((track) => ({
                key: track.key,
                name: track.name,
                criteria: track.criteria.map((criterion) => ({ ...criterion })),
            })),
            commentGuidance: {
                introduction: row.definition.commentGuidance.introduction,
                guidelines: [...row.definition.commentGuidance.guidelines],
                templates: row.definition.commentGuidance.templates.map((template) => ({
                    label: template.label,
                    body: template.body,
                })),
            },
        },
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    };
}

function assertTemplateDefinition(definition: RubricTemplateDefinition): void {
    const keys = new Set<string>();
    for (const track of definition.tracks) {
        if (keys.has(track.key)) {
            throw new ValidationError(`The template has more than one “${track.key}” track.`);
        }
        keys.add(track.key);
        assertTemplateTrack(track);
    }
}

function toCriterion(row: CriterionRow): Criterion {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        minScore: row.minScore,
        maxScore: row.maxScore,
        weight: Number(row.weight),
        position: row.position,
    };
}

function toAssignment(
    view: AssignmentView,
    projectTitle: string,
    teamName: string | null,
    divisionName: string | null,
    submissionStatus: SubmissionStatus,
    disclosure: ProjectDisclosure,
    frozen?: boolean,
): JudgeAssignment {
    return {
        id: view.assignment.id,
        organizationId: view.assignment.organizationId,
        editionId: view.assignment.editionId,
        rubricId: view.assignment.rubricId,
        submissionId: view.assignment.submissionId,
        judgeUserId: view.assignment.judgeUserId,
        judgeDisplayName: view.judgeDisplayName,
        projectTitle,
        teamName,
        divisionName,
        descriptionMarkdown: disclosure.descriptionMarkdown,
        submissionStatus,
        videoUrl: disclosure.videoUrl,
        aiDisclosure: disclosure.aiDisclosure,
        repositoryUrl: disclosure.repositoryUrl,
        demoUrl: disclosure.demoUrl,
        status: view.assignment.status,
        conflictNote: view.assignment.conflictNote,
        assignmentNote: view.assignment.assignmentNote,
        dueAt: nullableIso(view.assignment.dueAt),
        assignedAt: view.assignment.assignedAt.toISOString(),
        ...(frozen === undefined ? {} : { frozen }),
    };
}

function scorableCriteria(rows: readonly CriterionRow[]): readonly ScorableCriterion[] {
    return rows.map((row) => ({
        id: row.id,
        minScore: row.minScore,
        maxScore: row.maxScore,
        weight: Number(row.weight),
    }));
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
