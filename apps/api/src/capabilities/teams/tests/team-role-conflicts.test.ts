import { describe, expect, it, vi } from "vitest";
import type { AuthContext } from "../../../authentication/types.js";
import type { Clock } from "../../../core/clock.js";
import { ConflictError } from "../../../core/errors.js";
import type { AuditLogger } from "../../../infrastructure/audit/audit-logger.js";
import type {
    DatabaseConnection,
    DatabaseSession,
} from "../../../infrastructure/database/client.js";
import type { OutboxPublisher } from "../../../core/outbox.js";
import type { CompetitionsContract, EditionSummary } from "../../competitions/contracts.js";
import type { OrganizationsContract } from "../../organizations/contracts.js";
import type { ParticipantsContract } from "../../participants/contracts.js";
import type { SubmissionsContract } from "../../submissions/contracts.js";
import { TeamService } from "../application/team-service.js";
import type { InvitationWithTeam, TeamRepository } from "../infrastructure/team-repository.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const editionId = "22222222-2222-4222-8222-222222222222";
const teamId = "33333333-3333-4333-8333-333333333333";
const userId = "55555555-5555-4555-8555-555555555555";

function auth(): AuthContext {
    return {
        method: "session",
        sessionId: null,
        sessionTokenHash: null,
        csrfToken: null,
        csrfHash: null,
        user: {
            id: userId,
            displayName: "Member",
            email: "member@example.test",
            avatarUrl: null,
            locale: "en",
            status: "active",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
        memberships: [],
        globalAdministrator: false,
        permissions: [],
        expiresAt: new Date("2026-02-01T00:00:00.000Z"),
    };
}

function edition(): EditionSummary {
    return {
        id: editionId,
        organizationId,
        seriesId: "66666666-6666-4666-8666-666666666666",
        seriesName: "Series",
        name: "Edition",
        slug: "edition",
        description: "",
        status: "registration_open",
        timezone: "UTC",
        registrationOpensAt: null,
        registrationClosesAt: null,
        startsAt: null,
        endsAt: null,
        teamMinSize: 1,
        teamMaxSize: 4,
        maxParticipants: null,
        rulesMarkdown: "",
        publishedAt: null,
        themeName: null,
        themeDescription: null,
        showScores: false,
        showRanking: false,
    };
}

function invitation(): InvitationWithTeam {
    return {
        id: "77777777-7777-4777-8777-777777777777",
        teamId,
        email: "member@example.test",
        status: "pending",
        expiresAt: new Date("2099-01-01T00:00:00.000Z"),
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        organizationId,
        invitedByUserId: "88888888-8888-4888-8888-888888888888",
        teamName: "Fixture Team",
        editionId,
        captainUserId: "88888888-8888-4888-8888-888888888888",
        teamStatus: "forming",
        maxMembers: 4,
    };
}

function service(options: {
    readonly role: "judge" | "organizer" | "owner" | "participant" | null;
    readonly invitation?: InvitationWithTeam;
}): {
    readonly service: TeamService;
    readonly findInvitationById: ReturnType<typeof vi.fn>;
    readonly transaction: ReturnType<typeof vi.fn>;
} {
    const session = { db: {}, organizationId, userId } as unknown as DatabaseSession;
    const findInvitationById = vi.fn(async () => options.invitation ?? null);
    const transaction = vi.fn(
        async <T>(
            _options: unknown,
            work: (current: DatabaseSession) => Promise<T>,
        ): Promise<T> => {
            if (options.invitation === undefined) {
                throw new Error("The transaction should not start for a refused join.");
            }
            return work(session);
        },
    );
    const database = { transaction } as unknown as DatabaseConnection;
    const repository = { findInvitationById } as unknown as TeamRepository;
    const organizations = {
        getMembershipRole: async () => options.role,
    } as unknown as OrganizationsContract;
    const instance = new TeamService(
        database,
        repository,
        {} as unknown as OutboxPublisher,
        {} as unknown as AuditLogger,
        { now: () => new Date("2026-01-02T00:00:00.000Z") } as unknown as Clock,
        { getEdition: async () => edition() } as unknown as CompetitionsContract,
        {} as unknown as ParticipantsContract,
        organizations,
        () => ({}) as unknown as SubmissionsContract,
    );
    return { service: instance, findInvitationById, transaction };
}

describe("TeamService role conflicts", () => {
    it("refuses a judge creating a team before starting the transaction", async () => {
        const { service: teams, transaction } = service({ role: "judge" });

        await expect(
            teams.create(
                auth(),
                organizationId,
                { editionId, divisionId: null, name: "Team", description: "" },
                null,
            ),
        ).rejects.toBeInstanceOf(ConflictError);
        expect(transaction).not.toHaveBeenCalled();
    });

    it("refuses an organizer creating a team", async () => {
        const { service: teams, transaction } = service({ role: "organizer" });

        await expect(
            teams.create(
                auth(),
                organizationId,
                { editionId, divisionId: null, name: "Team", description: "" },
                null,
            ),
        ).rejects.toBeInstanceOf(ConflictError);
        expect(transaction).not.toHaveBeenCalled();
    });

    it("refuses a judge accepting a team invitation", async () => {
        const { service: teams, transaction } = service({
            role: "judge",
            invitation: invitation(),
        });

        await expect(
            teams.acceptInvitationById(auth(), organizationId, invitation().id, null),
        ).rejects.toBeInstanceOf(ConflictError);
        expect(transaction).toHaveBeenCalledTimes(1);
    });

    it("refuses an organizer accepting a team invitation", async () => {
        const { service: teams } = service({
            role: "organizer",
            invitation: invitation(),
        });

        await expect(
            teams.acceptInvitationById(auth(), organizationId, invitation().id, null),
        ).rejects.toBeInstanceOf(ConflictError);
    });
});
