import { describe, expect, it, vi } from "vitest";
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
import { ProjectService } from "../application/project-service.js";
import { ProjectRules } from "../domain/project-rules.js";
import type { ProjectRepository, ProjectRow } from "../infrastructure/project-repository.js";

const ORGANIZATION_ID = "f1000000-0000-4000-8000-000000000001";
const PROJECT_ID = "f1000000-0000-4000-8000-000000000030";
const USER_ID = "f1000000-0000-4000-8000-000000000011";

const now = new Date("2026-02-10T12:00:00.000Z");
const auth = { user: { id: USER_ID } } as unknown as AuthContext;

function projectRow(overrides: Partial<ProjectRow> = {}): ProjectRow {
    return {
        id: PROJECT_ID,
        organizationId: ORGANIZATION_ID,
        editionId: "f1000000-0000-4000-8000-000000000003",
        teamId: null,
        ownerUserId: USER_ID,
        title: "Project",
        slug: "project",
        summary: "Summary",
        descriptionMarkdown: "",
        repositoryUrl: "https://example.com/repo",
        demoUrl: "https://example.com/demo",
        videoUrl: "https://example.com/video",
        aiDisclosure: "No AI tools or models were used in this project.",
        tags: [],
        status: "draft",
        publishedAt: null,
        lockedAt: null,
        createdAt: now,
        updatedAt: now,
        ...overrides,
    };
}

function serviceFor(locked: ProjectRow): ProjectService {
    const repository = {
        findById: async () => locked,
        memberRole: async () => "owner",
    } as unknown as ProjectRepository;
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
    return new ProjectService(
        database,
        repository,
        {} as never,
        {} as OutboxPublisher,
        {} as AuditLogger,
        { now: () => now } as Clock,
    );
}

describe("ProjectRules lock", () => {
    it("allows edits while the project is unlocked", () => {
        expect(() => ProjectRules.assertNotLocked(null)).not.toThrow();
    });

    it("rejects edits after the project is locked", () => {
        expect(() => ProjectRules.assertNotLocked(now)).toThrow(ConflictError);
        expect(() => ProjectRules.assertNotLocked(now)).toThrow(
            "locked when its first version was submitted",
        );
    });
});

describe("ProjectService update lock rejection", () => {
    it("rejects an update once lockedAt is set", async () => {
        const service = serviceFor(projectRow({ lockedAt: now }));

        await expect(
            service.update(
                auth,
                ORGANIZATION_ID,
                "participant",
                PROJECT_ID,
                { title: "Renamed project" },
                null,
            ),
        ).rejects.toThrow(ConflictError);
    });

    it("keeps unlocked projects editable", async () => {
        const unlocked = projectRow();
        const update = async () => ({ ...unlocked, title: "Renamed project" });
        const repository = {
            findById: async () => unlocked,
            memberRole: async () => "owner",
            update,
        } as unknown as ProjectRepository;
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
        const service = new ProjectService(
            database,
            repository,
            {} as never,
            {} as OutboxPublisher,
            { record: async () => undefined } as unknown as AuditLogger,
            { now: () => now } as Clock,
        );

        const updated = await service.update(
            auth,
            ORGANIZATION_ID,
            "participant",
            PROJECT_ID,
            { title: "Renamed project" },
            null,
        );
        expect(updated.title).toBe("Renamed project");
        expect(updated.lockedAt).toBeNull();
    });
});

describe("ProjectService unlock", () => {
    it("clears the lock through the repository", async () => {
        const locked = projectRow({ lockedAt: now });
        const unlocked = projectRow();
        const unlock = vi.fn(async () => unlocked);
        const repository = {
            findById: async () => locked,
            unlock,
        } as unknown as ProjectRepository;
        const audit = { record: async () => undefined };
        const service = new ProjectService(
            {} as DatabaseConnection,
            repository,
            {} as never,
            {} as OutboxPublisher,
            audit as unknown as AuditLogger,
            { now: () => now } as Clock,
        );
        const session = {
            db: {} as DatabaseExecutor,
            organizationId: ORGANIZATION_ID,
            userId: USER_ID,
        } as DatabaseSession;

        await service.unlockProject(session, ORGANIZATION_ID, PROJECT_ID, now);

        expect(unlock).toHaveBeenCalledWith(session, ORGANIZATION_ID, PROJECT_ID, now);
    });
});
