import { describe, expect, it } from "vitest";
import type { AuthContext } from "../../../authentication/types.js";
import type { Clock } from "../../../core/clock.js";
import { ConflictError, ForbiddenError, NotFoundError } from "../../../core/errors.js";
import type { OutboxPublisher } from "../../../core/outbox.js";
import type { AuditEntry, AuditLogger } from "../../../infrastructure/audit/audit-logger.js";
import type {
    DatabaseConnection,
    DatabaseExecutor,
    DatabaseSession,
} from "../../../infrastructure/database/client.js";
import type { JobQueue } from "../../../infrastructure/jobs/job-queue.js";
import { JudgingService, type JudgingContracts } from "../application/judging-service.js";
import type {
    AssignmentRow,
    AssignmentUpdateValues,
    EvaluationRow,
    EvaluationWithScores,
    JudgeCandidate,
    JudgingRepository,
    RubricWithCriteria,
} from "../infrastructure/judging-repository.js";

const ORGANIZATION_ID = "f1000000-0000-4000-8000-000000000001";
const EDITION_ID = "f1000000-0000-4000-8000-000000000002";
const RUBRIC_ID = "f1000000-0000-4000-8000-000000000003";
const CRITERION_ID = "f1000000-0000-4000-8000-000000000004";
const ASSIGNMENT_ID = "f1000000-0000-4000-8000-000000000005";
const SUBMISSION_ID = "f1000000-0000-4000-8000-000000000006";
const JUDGE_ID = "f1000000-0000-4000-8000-000000000007";
const ORGANIZER_ID = "f1000000-0000-4000-8000-000000000008";
const PROJECT_ID = "f1000000-0000-4000-8000-000000000009";
const EVALUATION_ID = "f1000000-0000-4000-8000-00000000000a";
const NOW = new Date("2026-01-01T00:00:00.000Z");

function assignmentRow(overrides: Partial<AssignmentRow> = {}): AssignmentRow {
    return {
        id: ASSIGNMENT_ID,
        organizationId: ORGANIZATION_ID,
        editionId: EDITION_ID,
        rubricId: RUBRIC_ID,
        submissionId: SUBMISSION_ID,
        judgeUserId: JUDGE_ID,
        status: "submitted",
        conflictNote: null,
        assignmentNote: "",
        dueAt: null,
        assignedByUserId: ORGANIZER_ID,
        assignedAt: NOW,
        updatedAt: NOW,
        ...overrides,
    };
}

function evaluationWithScores(status: "draft" | "submitted"): EvaluationWithScores {
    return {
        evaluation: {
            id: EVALUATION_ID,
            organizationId: ORGANIZATION_ID,
            assignmentId: ASSIGNMENT_ID,
            judgeUserId: JUDGE_ID,
            status,
            overallComment: "Solid work.",
            weightedScore: "87.50",
            submittedAt: status === "submitted" ? NOW : null,
            createdAt: NOW,
            updatedAt: NOW,
        },
        scores: [],
    };
}

const rubric: RubricWithCriteria = {
    rubric: {
        id: RUBRIC_ID,
        organizationId: ORGANIZATION_ID,
        editionId: EDITION_ID,
        divisionId: null,
        familyId: "f1000000-0000-4000-8000-00000000000b",
        version: 1,
        active: true,
        name: "Fixture rubric",
        description: "",
        commentGuidance: { introduction: "", guidelines: [], templates: [] },
        createdAt: NOW,
        updatedAt: NOW,
    },
    criteria: [
        {
            id: CRITERION_ID,
            organizationId: ORGANIZATION_ID,
            rubricId: RUBRIC_ID,
            name: "Impact",
            description: "",
            minScore: 0,
            maxScore: 10,
            weight: "1.00",
            position: 0,
        },
    ],
};

const judge: JudgeCandidate = {
    userId: JUDGE_ID,
    displayName: "Fixture Judge",
    email: "judge@example.com",
    role: "judge",
    status: "active",
};

class FakeRepository {
    assignment: AssignmentRow;
    evaluation: EvaluationWithScores | null;
    readonly deletedEvaluationIds: string[] = [];
    readonly assignmentUpdates: {
        readonly assignmentId: string;
        readonly values: AssignmentUpdateValues;
    }[] = [];

    constructor(assignment: AssignmentRow, evaluation: EvaluationWithScores | null) {
        this.assignment = assignment;
        this.evaluation = evaluation;
    }

    async findAssignmentForUpdate(
        _session: DatabaseSession,
        organizationId: string,
        assignmentId: string,
    ): Promise<AssignmentRow | null> {
        return this.assignment.organizationId === organizationId &&
            this.assignment.id === assignmentId
            ? this.assignment
            : null;
    }

    async findEvaluation(
        _db: DatabaseExecutor,
        organizationId: string,
        assignmentId: string,
    ): Promise<EvaluationRow | null> {
        return this.evaluation !== null &&
            this.evaluation.evaluation.organizationId === organizationId &&
            this.evaluation.evaluation.assignmentId === assignmentId
            ? this.evaluation.evaluation
            : null;
    }

    async deleteEvaluation(
        _session: DatabaseSession,
        _organizationId: string,
        evaluationId: string,
    ): Promise<void> {
        this.deletedEvaluationIds.push(evaluationId);
        this.evaluation = null;
    }

    async updateAssignment(
        _session: DatabaseSession,
        _organizationId: string,
        assignmentId: string,
        values: AssignmentUpdateValues,
    ): Promise<AssignmentRow | null> {
        this.assignmentUpdates.push({ assignmentId, values });
        this.assignment = { ...this.assignment, ...values };
        return this.assignment;
    }

    async findRubric(): Promise<RubricWithCriteria | null> {
        return rubric;
    }

    async findJudgeCandidate(): Promise<JudgeCandidate | null> {
        return judge;
    }

    async findAssignmentBySubmissionAndJudge(): Promise<AssignmentRow | null> {
        return this.assignment;
    }
}

function authFor(role: "owner" | "organizer" | "judge"): AuthContext {
    return {
        user: {
            id: role === "judge" ? JUDGE_ID : ORGANIZER_ID,
            displayName: role === "judge" ? "Fixture Judge" : "Fixture Organizer",
            email: role === "judge" ? "judge@example.com" : "organizer@example.com",
        },
        memberships: [
            {
                organizationId: ORGANIZATION_ID,
                organizationName: "Fixture Organization",
                organizationSlug: "fixture",
                role,
                status: "active",
            },
        ],
    } as unknown as AuthContext;
}

interface Harness {
    readonly service: JudgingService;
    readonly repository: FakeRepository;
    readonly audits: AuditEntry[];
}

function harness(
    role: "owner" | "organizer" | "judge" = "organizer",
    status: "draft" | "submitted" | null = "submitted",
): Harness & { readonly auth: AuthContext } {
    const repository = new FakeRepository(
        assignmentRow({ status: status === "submitted" ? "submitted" : "in_progress" }),
        status === null ? null : evaluationWithScores(status),
    );
    const audits: AuditEntry[] = [];
    const session: DatabaseSession = {
        db: {} as DatabaseExecutor,
        organizationId: ORGANIZATION_ID,
        userId: role === "judge" ? JUDGE_ID : ORGANIZER_ID,
    };
    const database = {
        transaction: async <T>(
            _options: unknown,
            work: (value: DatabaseSession) => Promise<T>,
        ): Promise<T> => work(session),
    } as unknown as DatabaseConnection;
    const audit = {
        async record(_session: DatabaseSession, entry: AuditEntry): Promise<void> {
            audits.push(entry);
        },
    } as unknown as AuditLogger;
    const contracts = {
        competitions: {
            async getEdition() {
                return {
                    id: EDITION_ID,
                    organizationId: ORGANIZATION_ID,
                    name: "Fixture Edition",
                    status: "judging",
                };
            },
        },
        submissions: {
            async getSubmission() {
                return {
                    id: SUBMISSION_ID,
                    organizationId: ORGANIZATION_ID,
                    editionId: EDITION_ID,
                    projectId: PROJECT_ID,
                    projectSlug: "fixture-project",
                    teamId: null,
                    status: "submitted",
                    currentVersion: 1,
                    submittedAt: NOW.toISOString(),
                    title: "Fixture Project",
                    summary: "",
                };
            },
        },
        organizations: {
            async getSummary() {
                return {
                    id: ORGANIZATION_ID,
                    name: "Fixture Organization",
                    slug: "fixture",
                    description: "",
                    websiteUrl: null,
                };
            },
        },
        teams: {
            async listUserTeamHistory() {
                return [];
            },
            async getTeam() {
                return null;
            },
            async listEditionTeams() {
                return [];
            },
        },
        projects: {
            async getProject() {
                return null;
            },
        },
    } as unknown as JudgingContracts;
    const service = new JudgingService(
        database,
        repository as unknown as JudgingRepository,
        contracts,
        { async publish() {} } as unknown as OutboxPublisher,
        {} as unknown as JobQueue,
        audit,
        { now: () => NOW } as Clock,
        "https://workspace.example.com",
    );
    return { service, repository, audits, auth: authFor(role) };
}

describe("JudgingService.voidEvaluation", () => {
    it.each(["owner", "organizer"] as const)(
        "lets a %s void a submitted evaluation and audits the deletion",
        async (role) => {
            const { service, repository, audits, auth } = harness(role, "submitted");

            await service.voidEvaluation(auth, ORGANIZATION_ID, ASSIGNMENT_ID, "203.0.113.10");

            expect(repository.deletedEvaluationIds).toEqual([EVALUATION_ID]);
            expect(repository.assignment.status).toBe("revoked");
            expect(repository.assignmentUpdates[0]).toMatchObject({
                assignmentId: ASSIGNMENT_ID,
                values: { status: "revoked", updatedAt: NOW },
            });
            expect(audits).toHaveLength(1);
            expect(audits[0]).toMatchObject({
                organizationId: ORGANIZATION_ID,
                actorUserId: ORGANIZER_ID,
                action: "judging.evaluation.voided",
                entityType: "evaluation",
                entityId: EVALUATION_ID,
                metadata: {
                    assignmentId: ASSIGNMENT_ID,
                    submissionId: SUBMISSION_ID,
                    judgeUserId: JUDGE_ID,
                },
                ip: "203.0.113.10",
            });
        },
    );

    it("refuses a judge who is not an owner or organizer", async () => {
        const { service, repository, audits, auth } = harness("judge", "submitted");

        await expect(
            service.voidEvaluation(auth, ORGANIZATION_ID, ASSIGNMENT_ID, null),
        ).rejects.toBeInstanceOf(ForbiddenError);
        expect(repository.deletedEvaluationIds).toEqual([]);
        expect(repository.assignmentUpdates).toEqual([]);
        expect(audits).toEqual([]);
    });

    it("refuses a draft evaluation", async () => {
        const { service, repository, audits, auth } = harness("organizer", "draft");

        await expect(
            service.voidEvaluation(auth, ORGANIZATION_ID, ASSIGNMENT_ID, null),
        ).rejects.toBeInstanceOf(ConflictError);
        expect(repository.deletedEvaluationIds).toEqual([]);
        expect(repository.assignmentUpdates).toEqual([]);
        expect(audits).toEqual([]);
    });

    it("returns not found when no evaluation exists", async () => {
        const { service, repository, auth } = harness("organizer", null);

        await expect(
            service.voidEvaluation(auth, ORGANIZATION_ID, ASSIGNMENT_ID, null),
        ).rejects.toBeInstanceOf(NotFoundError);
        expect(repository.deletedEvaluationIds).toEqual([]);
    });

    it("allows the organizer to re-assign the revoked assignment after voiding", async () => {
        const { service, repository, auth } = harness("organizer", "submitted");

        await service.voidEvaluation(auth, ORGANIZATION_ID, ASSIGNMENT_ID, null);
        const reassigned = await service.createAssignment(
            auth,
            ORGANIZATION_ID,
            EDITION_ID,
            {
                submissionId: SUBMISSION_ID,
                judgeEmail: "judge@example.com",
                rubricId: RUBRIC_ID,
                dueAt: null,
                note: "Please score the revised submission.",
            },
            null,
        );

        expect(reassigned.status).toBe("assigned");
        expect(repository.assignmentUpdates.at(-1)).toMatchObject({
            assignmentId: ASSIGNMENT_ID,
            values: {
                status: "assigned",
                conflictNote: null,
                assignmentNote: "Please score the revised submission.",
            },
        });
    });
});
