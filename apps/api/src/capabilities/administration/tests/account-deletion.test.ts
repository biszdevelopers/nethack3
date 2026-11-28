import { describe, expect, it } from "vitest";
import type { AuthContext } from "../../../authentication/types.js";
import { FixedClock } from "../../../core/clock.js";
import { ConflictError, ForbiddenError } from "../../../core/errors.js";
import type { AuditLogger, AuditEntry } from "../../../infrastructure/audit/audit-logger.js";
import type {
    DatabaseConnection,
    DatabaseExecutor,
    DatabaseSession,
} from "../../../infrastructure/database/client.js";
import {
    ballots,
    debugAiSessions,
    evaluations,
    judgeAssignments,
    notifications,
    registrations,
    teamMembers,
    userProfileThemes,
    users,
    votes,
} from "../../../infrastructure/database/schema/index.js";
import type { OrganizationsContract } from "../../organizations/contracts.js";
import { AdministrationService } from "../application/administration-service.js";
import { AdministrationRules, type UserDeletionBlockers } from "../domain/administration-rules.js";
import {
    AccountDeletionRepository,
    type DeletableUserRow,
} from "../infrastructure/account-deletion-repository.js";
import type {
    AdministrationRepository,
    GlobalAdministratorRow,
} from "../infrastructure/administration-repository.js";

const actorId = "11111111-1111-4111-8111-111111111111";
const targetId = "22222222-2222-4222-8222-222222222222";

const noBlockers: UserDeletionBlockers = {
    captainedTeams: 0,
    ownedProjects: 0,
    authoredAnnouncements: 0,
    submissionVersions: 0,
    submissionFiles: 0,
    awards: 0,
    teamAwards: 0,
    editionResults: 0,
    judgeFlags: 0,
    flaggedAssignments: 0,
    submittedEvaluations: 0,
    soleOwnedOrganizations: 0,
};

function auth(): AuthContext {
    return {
        method: "session",
        sessionId: null,
        sessionTokenHash: null,
        csrfToken: null,
        csrfHash: null,
        user: {
            id: actorId,
            displayName: "Operator",
            email: "operator@example.test",
            avatarUrl: null,
            locale: "en",
            status: "active",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
        memberships: [],
        globalAdministrator: true,
        permissions: [],
        expiresAt: new Date("2026-02-01T00:00:00.000Z"),
    };
}

function target(): DeletableUserRow {
    return { id: targetId, displayName: "Target", email: "target@example.test" };
}

interface Harness {
    readonly service: AdministrationService;
    readonly calls: string[];
    readonly audits: AuditEntry[];
    readonly deleteCalls: { count: number };
    readonly transactionCalls: { count: number };
}

function harness(
    options: {
        readonly administrator?: boolean;
        readonly administratorCount?: number;
        readonly blockers?: Partial<UserDeletionBlockers>;
        readonly missingTarget?: boolean;
    } = {},
): Harness {
    const calls: string[] = [];
    const audits: AuditEntry[] = [];
    const deleteCalls = { count: 0 };
    const transactionCalls = { count: 0 };
    const session = {
        db: {},
        organizationId: null,
        userId: actorId,
    } as unknown as DatabaseSession;
    const database = {
        transaction: async <T>(
            _options: unknown,
            work: (current: DatabaseSession) => Promise<T>,
        ): Promise<T> => {
            transactionCalls.count += 1;
            return work(session);
        },
    } as unknown as DatabaseConnection;
    const repository = {
        findAdministrator: async (): Promise<GlobalAdministratorRow | null> =>
            options.administrator === true
                ? {
                      userId: targetId,
                      displayName: "Target",
                      email: "target@example.test",
                      grantedAt: new Date("2026-01-01T00:00:00.000Z"),
                      grantedByUserId: null,
                  }
                : null,
        lockAdministratorCount: async () => options.administratorCount ?? 2,
        listAdministrators: async () => [],
        listOrganizationIds: async () => [],
        findUserByEmail: async () => null,
        insertGrant: async () => undefined,
        deleteGrant: async () => true,
        auditPage: async () => [],
        globalAuditPage: async () => [],
    } as unknown as AdministrationRepository;
    const accountDeletion = {
        findUser: async () => (options.missingTarget === true ? null : target()),
        countBlockers: async () => ({ ...noBlockers, ...options.blockers }),
        deleteDependents: async () => {
            calls.push("delete");
            deleteCalls.count += 1;
        },
    } as unknown as AccountDeletionRepository;
    const audit = {
        record: async (_session: DatabaseSession, entry: AuditEntry) => {
            calls.push("audit");
            audits.push(entry);
        },
    } as unknown as AuditLogger;
    const service = new AdministrationService(
        database,
        repository,
        accountDeletion,
        audit,
        new FixedClock(new Date("2026-01-02T00:00:00.000Z")),
        {} as unknown as OrganizationsContract,
    );
    return { service, calls, audits, deleteCalls, transactionCalls };
}

describe("AdministrationRules account deletion guards", () => {
    it("refuses deleting your own account", () => {
        expect(() => AdministrationRules.assertNotSelfDeletion(actorId, actorId)).toThrow(
            ForbiddenError,
        );
        expect(() => AdministrationRules.assertNotSelfDeletion(actorId, targetId)).not.toThrow();
    });

    it("refuses deleting the last global administrator", () => {
        expect(() => AdministrationRules.assertCanDeleteAdministrator(true, 1)).toThrow(
            ConflictError,
        );
        expect(() => AdministrationRules.assertCanDeleteAdministrator(true, 0)).toThrow(
            ConflictError,
        );
        expect(() => AdministrationRules.assertCanDeleteAdministrator(true, 2)).not.toThrow();
        expect(() => AdministrationRules.assertCanDeleteAdministrator(false, 0)).not.toThrow();
    });

    it("names the ownership or history that blocks deletion", () => {
        expect(() =>
            AdministrationRules.assertCanDeleteAccount({ ...noBlockers, captainedTeams: 1 }),
        ).toThrow(/captaining a team/);
        expect(() =>
            AdministrationRules.assertCanDeleteAccount({ ...noBlockers, ownedProjects: 1 }),
        ).toThrow(/owning a project/);
        expect(() =>
            AdministrationRules.assertCanDeleteAccount({
                ...noBlockers,
                soleOwnedOrganizations: 1,
            }),
        ).toThrow(/last owner of an organization/);
        expect(() =>
            AdministrationRules.assertCanDeleteAccount({
                ...noBlockers,
                submittedEvaluations: 1,
            }),
        ).toThrow(/submitted evaluations/);
        expect(() => AdministrationRules.assertCanDeleteAccount(noBlockers)).not.toThrow();
    });
});

describe("AdministrationService.deleteUserAccount", () => {
    it("audits the actor and target before deleting dependent rows", async () => {
        const current = harness();
        await current.service.deleteUserAccount(auth(), targetId, "127.0.0.1");

        expect(current.calls).toEqual(["audit", "delete"]);
        expect(current.audits[0]).toMatchObject({
            organizationId: null,
            actorUserId: actorId,
            action: "administration.user.deleted",
            entityType: "user",
            entityId: targetId,
            metadata: { displayName: "Target", email: "target@example.test" },
        });
    });

    it("refuses self-deletion before opening a transaction", async () => {
        const current = harness();
        await expect(current.service.deleteUserAccount(auth(), actorId, null)).rejects.toThrow(
            ForbiddenError,
        );
        expect(current.transactionCalls.count).toBe(0);
        expect(current.deleteCalls.count).toBe(0);
    });

    it("refuses deleting a missing account", async () => {
        const current = harness({ missingTarget: true });
        await expect(current.service.deleteUserAccount(auth(), targetId, null)).rejects.toThrow(
            /No user account/,
        );
        expect(current.deleteCalls.count).toBe(0);
    });

    it("refuses deleting the last global administrator", async () => {
        const current = harness({ administrator: true, administratorCount: 1 });
        await expect(current.service.deleteUserAccount(auth(), targetId, null)).rejects.toThrow(
            ConflictError,
        );
        expect(current.deleteCalls.count).toBe(0);
    });

    it("refuses deleting an account that still owns records", async () => {
        const current = harness({ blockers: { ownedProjects: 1 } });
        await expect(current.service.deleteUserAccount(auth(), targetId, null)).rejects.toThrow(
            /owning a project/,
        );
        expect(current.deleteCalls.count).toBe(0);
    });

    it("allows deleting a non-administrator with no blockers", async () => {
        const current = harness();
        await current.service.deleteUserAccount(auth(), targetId, null);
        expect(current.deleteCalls.count).toBe(1);
    });
});

describe("AccountDeletionRepository.deleteDependents", () => {
    it("deletes tenant rows once per organization and removes the user last", async () => {
        const deleted: unknown[] = [];
        let executeCalls = 0;
        const db = {
            execute: async () => {
                executeCalls += 1;
                return { rows: [] };
            },
            delete: (table: unknown) => {
                deleted.push(table);
                if (table === users) {
                    return {
                        where: () => ({ returning: async () => [{ id: targetId }] }),
                    };
                }
                return { where: async () => [] };
            },
        } as unknown as DatabaseExecutor;
        const session = {
            db,
            organizationId: null,
            userId: actorId,
        } as unknown as DatabaseSession;

        await new AccountDeletionRepository().deleteDependents(session, targetId, [
            "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        ]);

        expect(executeCalls).toBe(3);
        expect(deleted.filter((table) => table === teamMembers)).toHaveLength(2);
        expect(deleted.filter((table) => table === votes)).toHaveLength(2);
        expect(deleted.filter((table) => table === ballots)).toHaveLength(2);
        expect(deleted.filter((table) => table === registrations)).toHaveLength(2);
        expect(deleted.filter((table) => table === evaluations)).toHaveLength(2);
        expect(deleted.filter((table) => table === judgeAssignments)).toHaveLength(2);
        expect(deleted.filter((table) => table === notifications)).toHaveLength(1);
        expect(deleted.filter((table) => table === debugAiSessions)).toHaveLength(1);
        expect(deleted.filter((table) => table === userProfileThemes)).toHaveLength(1);
        expect(deleted.at(-1)).toBe(users);
    });
});
