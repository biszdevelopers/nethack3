import { describe, expect, it, vi } from "vitest";
import {
    missingProjectEvidence,
    PROJECT_EVIDENCE_LABELS,
    type CreateSubmissionVersionRequest,
    type ProjectEvidence,
} from "@nethack/contracts";
import type { AuthContext } from "../../../authentication/types.js";
import type { Clock } from "../../../core/clock.js";
import { ConflictError } from "../../../core/errors.js";
import type { OutboxPublisher } from "../../../core/outbox.js";
import type { AuditLogger } from "../../../infrastructure/audit/audit-logger.js";
import type {
    DatabaseConnection,
    DatabaseExecutor,
    DatabaseSession,
} from "../../../infrastructure/database/client.js";
import type { EditionSummary } from "../../competitions/contracts.js";
import type { ProjectSummary, ProjectsContract } from "../../projects/contracts.js";
import { SubmissionService } from "../application/submission-service.js";
import { SubmissionRules } from "../domain/submission-rules.js";

const ORGANIZATION_ID = "f1000000-0000-4000-8000-000000000001";
const EDITION_ID = "f1000000-0000-4000-8000-000000000003";
const PROJECT_ID = "f1000000-0000-4000-8000-000000000030";
const SUBMISSION_ID = "f1000000-0000-4000-8000-000000000031";
const USER_ID = "f1000000-0000-4000-8000-000000000011";

const now = new Date("2026-02-10T12:00:00.000Z");
const auth = { user: { id: USER_ID } } as unknown as AuthContext;

const completeEvidence: ProjectEvidence = {
    repositoryUrl: "https://example.com/repo",
    demoUrl: "https://example.com/demo",
    videoUrl: "https://example.com/video",
    aiDisclosure: "No AI tools or models were used in this project.",
};

function projectSummary(overrides: Partial<ProjectSummary> = {}): ProjectSummary {
    return {
        id: PROJECT_ID,
        organizationId: ORGANIZATION_ID,
        editionId: EDITION_ID,
        teamId: null,
        ownerUserId: USER_ID,
        title: "Project",
        slug: "project",
        summary: "Summary",
        descriptionMarkdown: "",
        ...completeEvidence,
        tags: [],
        status: "draft",
        publishedAt: null,
        lockedAt: null,
        ...overrides,
    };
}

describe("SubmissionRules project evidence", () => {
    it("accepts a project that carries all four evidence fields", () => {
        expect(missingProjectEvidence(completeEvidence)).toEqual([]);
        expect(() => SubmissionRules.assertProjectEvidence(completeEvidence)).not.toThrow();
    });

    it("identifies each blank evidence field", () => {
        const missing = missingProjectEvidence({
            repositoryUrl: " ",
            demoUrl: null,
            videoUrl: "",
            aiDisclosure: "   ",
        });
        expect(missing).toEqual(["repositoryUrl", "demoUrl", "videoUrl", "aiDisclosure"]);
        expect(missing.map((field) => PROJECT_EVIDENCE_LABELS[field])).toEqual([
            "repository URL",
            "demo URL",
            "demonstration video URL",
            "AI-use disclosure",
        ]);
    });

    it("throws a ConflictError that names the missing fields", () => {
        expect(() =>
            SubmissionRules.assertProjectEvidence({
                ...completeEvidence,
                videoUrl: null,
                aiDisclosure: " ",
            }),
        ).toThrow(ConflictError);
        expect(() =>
            SubmissionRules.assertProjectEvidence({
                ...completeEvidence,
                videoUrl: null,
                aiDisclosure: " ",
            }),
        ).toThrow("demonstration video URL, AI-use disclosure");
    });
});

describe("SubmissionService project lock", () => {
    it("locks the project in the same transaction as the first submitted version", async () => {
        const sessions: DatabaseSession[] = [];
        const database = {
            transaction: async (
                _options: unknown,
                work: (session: DatabaseSession) => Promise<unknown>,
            ) => {
                const session: DatabaseSession = {
                    db: {} as DatabaseExecutor,
                    organizationId: ORGANIZATION_ID,
                    userId: USER_ID,
                };
                sessions.push(session);
                return work(session);
            },
        } as unknown as DatabaseConnection;

        const submissionRow = {
            id: SUBMISSION_ID,
            organizationId: ORGANIZATION_ID,
            editionId: EDITION_ID,
            projectId: PROJECT_ID,
            teamId: null,
            status: "draft" as const,
            currentVersion: 0,
            submittedAt: null,
            reviewNote: "",
            reviewNoteUpdatedAt: null,
            createdAt: now,
            updatedAt: now,
        };
        const versionRow = {
            id: "f1000000-0000-4000-8000-000000000032",
            organizationId: ORGANIZATION_ID,
            submissionId: SUBMISSION_ID,
            version: 1,
            title: "First version",
            summary: "First submitted version.",
            descriptionMarkdown: "",
            repositoryUrl: null,
            demoUrl: null,
            createdByUserId: USER_ID,
            createdAt: now,
        };
        const repository = {
            findByIdForUpdate: async () => submissionRow,
            insertVersion: async () => versionRow,
            update: async () => ({
                ...submissionRow,
                currentVersion: 1,
                status: "submitted" as const,
                submittedAt: now,
            }),
            listVersions: async () => [versionRow],
            listAttachedFiles: async () => [],
        } as never;
        const lockProject = vi.fn(async () => undefined);
        const contracts = {
            projects: {
                getProject: async () => projectSummary(),
                isProjectMember: async () => true,
                lockProject,
            } as unknown as ProjectsContract,
            competitions: {
                getEdition: async () =>
                    ({
                        id: EDITION_ID,
                        organizationId: ORGANIZATION_ID,
                        status: "active",
                        startsAt: null,
                        endsAt: null,
                    }) as EditionSummary,
            } as never,
            teams: { getTeam: async () => null } as never,
            files: {
                listProjectFiles: async () => [],
                attachToSubmission: async () => undefined,
            } as never,
            organizations: {} as never,
        };
        const service = new SubmissionService(
            database,
            repository,
            contracts,
            { publish: async () => undefined } as unknown as OutboxPublisher,
            { record: async () => undefined } as unknown as AuditLogger,
            { now: () => now } as Clock,
        );
        const input: CreateSubmissionVersionRequest = {
            title: "First version",
            summary: "First submitted version.",
            descriptionMarkdown: "",
            repositoryUrl: null,
            demoUrl: null,
            submit: true,
        };

        await service.createVersion(
            auth,
            ORGANIZATION_ID,
            "participant",
            SUBMISSION_ID,
            input,
            null,
        );

        expect(lockProject).toHaveBeenCalledTimes(1);
        expect(lockProject).toHaveBeenCalledWith(ORGANIZATION_ID, PROJECT_ID, now, sessions[0]);
    });

    it("refuses a version when the project evidence is incomplete", async () => {
        const database = {
            transaction: async (
                _options: unknown,
                work: (session: DatabaseSession) => Promise<unknown>,
            ) =>
                work({
                    db: {} as DatabaseExecutor,
                    organizationId: ORGANIZATION_ID,
                    userId: USER_ID,
                }),
        } as unknown as DatabaseConnection;
        const submissionRow = {
            id: SUBMISSION_ID,
            organizationId: ORGANIZATION_ID,
            editionId: EDITION_ID,
            projectId: PROJECT_ID,
            teamId: null,
            status: "draft" as const,
            currentVersion: 0,
            submittedAt: null,
            reviewNote: "",
            reviewNoteUpdatedAt: null,
            createdAt: now,
            updatedAt: now,
        };
        const insertVersion = vi.fn(async () => {
            throw new Error("A version must not be created without evidence.");
        });
        const lockProject = vi.fn(async () => undefined);
        const contracts = {
            projects: {
                getProject: async () => projectSummary({ videoUrl: null, aiDisclosure: "" }),
                isProjectMember: async () => true,
                lockProject,
            } as unknown as ProjectsContract,
            competitions: { getEdition: async () => null } as never,
            teams: { getTeam: async () => null } as never,
            files: {} as never,
            organizations: {} as never,
        };
        const service = new SubmissionService(
            database,
            {
                findByIdForUpdate: async () => submissionRow,
                insertVersion,
            } as never,
            contracts,
            {} as OutboxPublisher,
            {} as AuditLogger,
            { now: () => now } as Clock,
        );

        await expect(
            service.createVersion(
                auth,
                ORGANIZATION_ID,
                "participant",
                SUBMISSION_ID,
                {
                    title: "First version",
                    summary: "First submitted version.",
                    descriptionMarkdown: "",
                    repositoryUrl: null,
                    demoUrl: null,
                    submit: true,
                },
                null,
            ),
        ).rejects.toThrow("demonstration video URL, AI-use disclosure");
        expect(insertVersion).not.toHaveBeenCalled();
        expect(lockProject).not.toHaveBeenCalled();
    });
});
