import { describe, expect, it } from "vitest";
import {
    editionLifecycleRequestSchema,
    type CompetitionEditionStatus,
    type EditionLifecycleAction,
} from "@nethack/contracts";
import type { AuthContext } from "../../../authentication/types.js";
import type { Clock } from "../../../core/clock.js";
import { ConflictError, ValidationError } from "../../../core/errors.js";
import type { OutboxPublisher } from "../../../core/outbox.js";
import type { AuditEntry, AuditLogger } from "../../../infrastructure/audit/audit-logger.js";
import type {
    DatabaseConnection,
    DatabaseExecutor,
    DatabaseSession,
} from "../../../infrastructure/database/client.js";
import { CompetitionService } from "../application/competition-service.js";
import { CompetitionRules, type LifecycleTransition } from "../domain/competition-rules.js";
import type {
    CompetitionRepository,
    EditionRow,
    EditionUpdateValues,
} from "../infrastructure/competition-repository.js";
import type { OrganizationsContract } from "../../organizations/contracts.js";

const ORGANIZATION_ID = "f1000000-0000-4000-8000-000000000001";
const EDITION_ID = "f1000000-0000-4000-8000-000000000003";
const ACTOR_ID = "f1000000-0000-4000-8000-000000000010";
const NOW = new Date("2026-11-28T12:00:00.000Z");

const ALL_STATUSES: readonly CompetitionEditionStatus[] = [
    "draft",
    "published",
    "registration_open",
    "registration_closed",
    "active",
    "judging",
    "voting",
    "paused",
    "completed",
    "archived",
];

const PAUSABLE: readonly CompetitionEditionStatus[] = [
    "published",
    "registration_open",
    "registration_closed",
    "active",
    "judging",
    "voting",
];

interface AllowedCase {
    readonly action: EditionLifecycleAction;
    readonly from: CompetitionEditionStatus;
    readonly before: CompetitionEditionStatus | null;
    readonly to: CompetitionEditionStatus;
    readonly beforeAfter: CompetitionEditionStatus | null;
}

const ALLOWED: readonly AllowedCase[] = [
    ...PAUSABLE.map((from) => ({
        action: "pause" as const,
        from,
        before: null,
        to: "paused" as const,
        beforeAfter: from,
    })),
    {
        action: "resume",
        from: "paused",
        before: "registration_open",
        to: "registration_open",
        beforeAfter: null,
    },
    {
        action: "resume",
        from: "paused",
        before: "active",
        to: "active",
        beforeAfter: null,
    },
    {
        action: "resume",
        from: "paused",
        before: "voting",
        to: "voting",
        beforeAfter: null,
    },
    {
        action: "resume",
        from: "paused",
        before: null,
        to: "registration_open",
        beforeAfter: null,
    },
    {
        action: "reopen_submissions",
        from: "paused",
        before: "active",
        to: "active",
        beforeAfter: null,
    },
    {
        action: "reopen_submissions",
        from: "judging",
        before: null,
        to: "active",
        beforeAfter: null,
    },
    {
        action: "reopen_submissions",
        from: "voting",
        before: null,
        to: "active",
        beforeAfter: null,
    },
    {
        action: "reopen_judging",
        from: "voting",
        before: null,
        to: "judging",
        beforeAfter: null,
    },
    {
        action: "reopen_voting",
        from: "judging",
        before: null,
        to: "voting",
        beforeAfter: null,
    },
    ...(
        [
            "published",
            "registration_open",
            "registration_closed",
            "active",
            "judging",
            "voting",
            "paused",
        ] as const
    ).map((from) => ({
        action: "reset" as const,
        from,
        before: from === "paused" ? ("active" as const) : null,
        to: "draft" as const,
        beforeAfter: null,
    })),
];

function allowedKey(action: EditionLifecycleAction, from: CompetitionEditionStatus): string {
    return `${action}:${from}`;
}

const ALLOWED_KEYS = new Set(ALLOWED.map((item) => allowedKey(item.action, item.from)));

const REFUSED: readonly {
    readonly action: EditionLifecycleAction;
    readonly from: CompetitionEditionStatus;
}[] = (
    ["pause", "resume", "reopen_submissions", "reopen_judging", "reopen_voting", "reset"] as const
)
    .flatMap((action) => ALL_STATUSES.map((from) => ({ action, from })))
    .filter((item) => !ALLOWED_KEYS.has(allowedKey(item.action, item.from)));

function resolve(
    action: EditionLifecycleAction,
    from: CompetitionEditionStatus,
    before: CompetitionEditionStatus | null = null,
): LifecycleTransition {
    return CompetitionRules.resolveLifecycle(action, from, before);
}

describe("editionLifecycleRequestSchema", () => {
    it("requires explicit confirmation to reset", () => {
        expect(editionLifecycleRequestSchema.safeParse({ action: "reset" }).success).toBe(false);
        expect(
            editionLifecycleRequestSchema.safeParse({ action: "reset", confirm: false }).success,
        ).toBe(false);
        expect(
            editionLifecycleRequestSchema.parse({ action: "reset", confirm: true }).confirm,
        ).toBe(true);
    });

    it("accepts the other actions without confirmation", () => {
        for (const action of [
            "pause",
            "resume",
            "reopen_submissions",
            "reopen_judging",
            "reopen_voting",
        ] as const) {
            expect(editionLifecycleRequestSchema.parse({ action }).action).toBe(action);
        }
    });

    it("rejects unknown actions and extra fields", () => {
        expect(editionLifecycleRequestSchema.safeParse({ action: "archive" }).success).toBe(false);
        expect(
            editionLifecycleRequestSchema.safeParse({ action: "pause", force: true }).success,
        ).toBe(false);
    });
});

describe("CompetitionRules.resolveLifecycle allowed transitions", () => {
    it.each(ALLOWED)("$action from $from", (item) => {
        expect(resolve(item.action, item.from, item.before)).toEqual({
            status: item.to,
            statusBeforePause: item.beforeAfter,
        });
    });
});

describe("CompetitionRules.resolveLifecycle refused transitions", () => {
    it.each(REFUSED)("$action from $from", (item) => {
        expect(() => resolve(item.action, item.from)).toThrow(ConflictError);
    });

    it("explains that a completed edition must unpublish results first", () => {
        expect(() => resolve("reopen_submissions", "completed")).toThrow(/Unpublish the results/);
        expect(() => resolve("reopen_judging", "completed")).toThrow(/Unpublish the results/);
        expect(() => resolve("reopen_voting", "completed")).toThrow(/Unpublish the results/);
        expect(() => resolve("reset", "completed")).toThrow(/Unpublish the results/);
    });

    it("refuses a corrupted paused status fallback", () => {
        expect(() => resolve("resume", "paused", "paused")).toThrow(ConflictError);
        expect(() => resolve("resume", "paused", "archived")).toThrow(ConflictError);
    });
});

describe("CompetitionRules general transitions never own the paused lifecycle", () => {
    it.each(ALL_STATUSES)("refuses %s -> paused through a general update", (from) => {
        expect(() => CompetitionRules.assertTransition(from, "paused")).toThrow(ConflictError);
    });

    it.each(ALL_STATUSES)("refuses paused -> %s through a general update", (to) => {
        expect(() => CompetitionRules.assertTransition("paused", to)).toThrow(ConflictError);
    });

    it("keeps backward lifecycle edges out of the general transition table", () => {
        const backward = [
            ["judging", "active"],
            ["voting", "judging"],
            ["voting", "active"],
            ["completed", "voting"],
            ["completed", "judging"],
            ["completed", "active"],
        ] as const;
        for (const [from, to] of backward) {
            expect(() => CompetitionRules.assertTransition(from, to)).toThrow(ConflictError);
        }
    });
});

interface Harness {
    readonly service: CompetitionService;
    readonly repository: FakeRepository;
    readonly audits: AuditEntry[];
    readonly row: EditionRow;
}

class FakeRepository {
    row: EditionRow;
    readonly updates: EditionUpdateValues[] = [];

    constructor(row: EditionRow) {
        this.row = row;
    }

    async findEdition(): Promise<EditionRow> {
        return this.row;
    }

    async updateEdition(
        _session: DatabaseSession,
        _organizationId: string,
        _editionId: string,
        values: EditionUpdateValues,
    ): Promise<EditionRow> {
        this.updates.push(values);
        this.row = { ...this.row, ...values };
        return this.row;
    }
}

function editionRow(
    status: CompetitionEditionStatus,
    statusBeforePause: CompetitionEditionStatus | null,
): EditionRow {
    return {
        id: EDITION_ID,
        organizationId: ORGANIZATION_ID,
        seriesId: "f1000000-0000-4000-8000-000000000002",
        name: "Lifecycle edition",
        slug: "lifecycle-edition",
        description: "",
        themeName: null,
        themeDescription: null,
        contactEmail: null,
        contactUrl: null,
        showScores: false,
        showRanking: false,
        status,
        statusBeforePause,
        timezone: "UTC",
        registrationOpensAt: null,
        registrationClosesAt: null,
        startsAt: null,
        endsAt: null,
        teamMinSize: 1,
        teamMaxSize: 4,
        maxParticipants: null,
        rulesMarkdown: "",
        resultsOpenAt: null,
        publishedAt: null,
        createdAt: NOW,
        updatedAt: NOW,
    };
}

function harness(from: CompetitionEditionStatus, before: CompetitionEditionStatus | null): Harness {
    const row = editionRow(from, before);
    const repository = new FakeRepository(row);
    const audits: AuditEntry[] = [];
    const session: DatabaseSession = {
        db: {} as DatabaseExecutor,
        organizationId: ORGANIZATION_ID,
        userId: ACTOR_ID,
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
    const service = new CompetitionService(
        database,
        repository as unknown as CompetitionRepository,
        {} as OutboxPublisher,
        audit,
        { now: () => NOW } as Clock,
        {} as OrganizationsContract,
    );
    return { service, repository, audits, row };
}

const auth = { user: { id: ACTOR_ID } } as unknown as AuthContext;

describe("CompetitionService.lifecycle", () => {
    it.each(ALLOWED)("$action from $from persists the transition and audits it", async (item) => {
        const { service, repository, audits } = harness(item.from, item.before);

        const updated = await service.lifecycle(
            auth,
            ORGANIZATION_ID,
            EDITION_ID,
            { action: item.action, ...(item.action === "reset" ? { confirm: true } : {}) },
            "203.0.113.10",
        );

        expect(updated.status).toBe(item.to);
        expect(updated.statusBeforePause).toBe(item.beforeAfter);
        expect(repository.updates).toHaveLength(1);
        expect(repository.updates[0]).toMatchObject({
            status: item.to,
            statusBeforePause: item.beforeAfter,
            updatedAt: NOW,
        });
        expect(audits).toHaveLength(1);
        expect(audits[0]).toMatchObject({
            organizationId: ORGANIZATION_ID,
            actorUserId: ACTOR_ID,
            action: "competition.edition.lifecycle",
            entityType: "competition_edition",
            entityId: EDITION_ID,
            metadata: {
                action: item.action,
                previousStatus: item.from,
                nextStatus: item.to,
            },
            ip: "203.0.113.10",
        });
    });

    it.each(REFUSED)("refuses $action from $from without writing or auditing", async (item) => {
        const { service, repository, audits } = harness(item.from, null);

        await expect(
            service.lifecycle(
                auth,
                ORGANIZATION_ID,
                EDITION_ID,
                { action: item.action, ...(item.action === "reset" ? { confirm: true } : {}) },
                null,
            ),
        ).rejects.toBeInstanceOf(ConflictError);
        expect(repository.updates).toHaveLength(0);
        expect(audits).toHaveLength(0);
    });

    it("requires explicit confirmation to reset", async () => {
        const { service, repository, audits } = harness("active", null);

        await expect(
            service.lifecycle(auth, ORGANIZATION_ID, EDITION_ID, { action: "reset" }, null),
        ).rejects.toBeInstanceOf(ValidationError);
        expect(repository.updates).toHaveLength(0);
        expect(audits).toHaveLength(0);
    });
});
