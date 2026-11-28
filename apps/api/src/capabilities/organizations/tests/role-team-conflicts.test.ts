import { describe, expect, it } from "vitest";
import type { OrganizationRole } from "@nethack/contracts";
import type { Clock } from "../../../core/clock.js";
import { ConflictError } from "../../../core/errors.js";
import type { OutboxPublisher } from "../../../core/outbox.js";
import type { AuditLogger } from "../../../infrastructure/audit/audit-logger.js";
import type {
    DatabaseConnection,
    DatabaseSession,
} from "../../../infrastructure/database/client.js";
import type { TeamsContract } from "../../teams/contracts.js";
import { OrganizationService } from "../application/organization-service.js";
import type { OrganizationRepository } from "../infrastructure/organization-repository.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const actorId = "22222222-2222-4222-8222-222222222222";
const targetId = "33333333-3333-4333-8333-333333333333";
const ownerId = "44444444-4444-4444-8444-444444444444";

function service(options: { readonly currentRole: OrganizationRole; readonly hasTeam: boolean }): {
    readonly service: OrganizationService;
    readonly updateCalls: { count: number };
    readonly teamChecks: { count: number };
} {
    const updateCalls = { count: 0 };
    const teamChecks = { count: 0 };
    const session = {
        db: {},
        organizationId,
        userId: actorId,
    } as unknown as DatabaseSession;
    let nextRole = options.currentRole;
    const repository = {
        membership: async () => ({ role: options.currentRole, status: "active" }),
        lockMemberships: async () => [
            { userId: actorId, role: "organizer", status: "active" },
            { userId: ownerId, role: "owner", status: "active" },
            { userId: targetId, role: options.currentRole, status: "active" },
        ],
        updateMembership: async (
            _session: DatabaseSession,
            _organizationId: string,
            userId: string,
            values: { role: OrganizationRole },
        ) => {
            expect(userId).toBe(targetId);
            nextRole = values.role;
            updateCalls.count += 1;
            return true;
        },
        memberWithUser: async (_db: unknown, _organizationId: string, userId: string) => ({
            organizationId,
            userId,
            role: nextRole,
            status: "active",
            displayName: "Member",
            email: null,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
    } as unknown as OrganizationRepository;
    const database = {
        db: {},
        transaction: async <T>(
            _options: unknown,
            work: (current: DatabaseSession) => Promise<T>,
        ): Promise<T> => work(session),
    } as unknown as DatabaseConnection;
    const events = { publish: async () => undefined } as unknown as OutboxPublisher;
    const audit = { record: async () => undefined } as unknown as AuditLogger;
    const clock = { now: () => new Date("2026-01-02T00:00:00.000Z") } as unknown as Clock;
    const teams = {
        hasActiveTeamMembership: async () => {
            teamChecks.count += 1;
            return options.hasTeam;
        },
    } as unknown as TeamsContract;

    return {
        service: new OrganizationService(database, repository, events, audit, clock, () => teams),
        updateCalls,
        teamChecks,
    };
}

describe("OrganizationService role conflicts", () => {
    it("refuses promoting a competing participant to judge", async () => {
        const {
            service: organizations,
            updateCalls,
            teamChecks,
        } = service({
            currentRole: "participant",
            hasTeam: true,
        });

        await expect(
            organizations.updateMemberRole(
                { userId: actorId, ip: null },
                organizationId,
                targetId,
                "judge",
            ),
        ).rejects.toBeInstanceOf(ConflictError);
        expect(teamChecks.count).toBe(1);
        expect(updateCalls.count).toBe(0);
    });

    it("refuses promoting a competing participant to organizer", async () => {
        const { service: organizations, updateCalls } = service({
            currentRole: "participant",
            hasTeam: true,
        });

        await expect(
            organizations.updateMemberRole(
                { userId: actorId, ip: null },
                organizationId,
                targetId,
                "organizer",
            ),
        ).rejects.toBeInstanceOf(ConflictError);
        expect(updateCalls.count).toBe(0);
    });

    it("lets a competing participant keep the participant role without a team lookup", async () => {
        const {
            service: organizations,
            updateCalls,
            teamChecks,
        } = service({
            currentRole: "participant",
            hasTeam: true,
        });

        await expect(
            organizations.updateMemberRole(
                { userId: actorId, ip: null },
                organizationId,
                targetId,
                "participant",
            ),
        ).resolves.toMatchObject({ userId: targetId });
        expect(teamChecks.count).toBe(0);
        expect(updateCalls.count).toBe(1);
    });

    it("allows a teamless participant to become a judge or organizer", async () => {
        const judgeCase = service({ currentRole: "participant", hasTeam: false });
        const organizerCase = service({ currentRole: "participant", hasTeam: false });

        await expect(
            judgeCase.service.updateMemberRole(
                { userId: actorId, ip: null },
                organizationId,
                targetId,
                "judge",
            ),
        ).resolves.toMatchObject({ userId: targetId });
        await expect(
            organizerCase.service.updateMemberRole(
                { userId: actorId, ip: null },
                organizationId,
                targetId,
                "organizer",
            ),
        ).resolves.toMatchObject({ userId: targetId });
        expect(judgeCase.updateCalls.count).toBe(1);
        expect(organizerCase.updateCalls.count).toBe(1);
    });
});
