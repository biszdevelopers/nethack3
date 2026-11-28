import { describe, expect, it } from "vitest";
import {
    createEditionRequestSchema,
    updateEditionApprovalRequestSchema,
    type CompetitionEditionStatus,
} from "@nethack/contracts";
import type { AuthContext } from "../../../authentication/types.js";
import type { Clock } from "../../../core/clock.js";
import { ConflictError, NotFoundError, ValidationError } from "../../../core/errors.js";
import type { OutboxPublisher } from "../../../core/outbox.js";
import type { AuditEntry, AuditLogger } from "../../../infrastructure/audit/audit-logger.js";
import type {
    DatabaseConnection,
    DatabaseExecutor,
    DatabaseSession,
} from "../../../infrastructure/database/client.js";
import { CompetitionService } from "../application/competition-service.js";
import {
    CompetitionRules,
    isThemePublished,
    type EditionActivationState,
} from "../domain/competition-rules.js";
import type {
    CompetitionRepository,
    DivisionRow,
    EditionRow,
    EditionUpdateValues,
    MilestoneRow,
    NewDivisionValues,
    NewEditionValues,
    NewMilestoneValues,
    OrganizerEditionRow,
    PublicEditionRow,
    SeriesRow,
} from "../infrastructure/competition-repository.js";
import type { OrganizationsContract } from "../../organizations/contracts.js";

const ORGANIZATION_ID = "f1000000-0000-4000-8000-000000000001";
const SERIES_ID = "f1000000-0000-4000-8000-000000000002";
const OTHER_SERIES_ID = "f1000000-0000-4000-8000-000000000022";
const EDITION_ID = "f1000000-0000-4000-8000-000000000003";
const SOURCE_ID = "f1000000-0000-4000-8000-000000000004";
const ACTOR_ID = "f1000000-0000-4000-8000-000000000010";
const NOW = new Date("2026-11-28T12:00:00.000Z");
const STARTS_AT = new Date("2026-12-10T09:00:00.000Z");
const ENDS_AT = new Date("2026-12-12T18:00:00.000Z");

const auth = { user: { id: ACTOR_ID } } as unknown as AuthContext;

function editionRow(overrides: Partial<EditionRow> = {}): EditionRow {
    return {
        id: EDITION_ID,
        organizationId: ORGANIZATION_ID,
        seriesId: SERIES_ID,
        name: "Edition",
        slug: "edition",
        description: "",
        themeName: null,
        themeDescription: null,
        contactEmail: null,
        contactUrl: null,
        showScores: false,
        showRanking: false,
        requiresBoardApproval: false,
        isBlankStart: false,
        boardApprovedAt: null,
        boardApprovedByUserId: null,
        status: "draft",
        statusBeforePause: null,
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
        ...overrides,
    };
}

class FakeRepository {
    readonly editions: EditionRow[];
    readonly divisions: readonly DivisionRow[];
    readonly milestones: readonly MilestoneRow[];
    readonly insertedEditions: NewEditionValues[] = [];
    readonly insertedDivisions: NewDivisionValues[] = [];
    readonly insertedMilestones: NewMilestoneValues[] = [];
    readonly updates: EditionUpdateValues[] = [];
    publicRows: readonly PublicEditionRow[] = [];

    constructor(options: {
        readonly editions?: readonly EditionRow[];
        readonly divisions?: readonly DivisionRow[];
        readonly milestones?: readonly MilestoneRow[];
    }) {
        this.editions = [...(options.editions ?? [])];
        this.divisions = options.divisions ?? [];
        this.milestones = options.milestones ?? [];
    }

    async findSeriesById(): Promise<SeriesRow> {
        return {
            id: SERIES_ID,
            organizationId: ORGANIZATION_ID,
            name: "Series",
            slug: "series",
            description: "",
            createdAt: NOW,
            updatedAt: NOW,
        };
    }

    async findEdition(
        _db: DatabaseExecutor,
        _organizationId: string,
        editionId: string,
    ): Promise<OrganizerEditionRow | null> {
        const row = this.editions.find((item) => item.id === editionId);
        return row === undefined
            ? null
            : {
                  ...row,
                  seriesName: "Series",
                  boardApprovedByName: row.boardApprovedByUserId === null ? null : "Board Member",
              };
    }

    async lockEdition(
        _session: DatabaseSession,
        _organizationId: string,
        editionId: string,
    ): Promise<EditionRow | null> {
        return this.editions.find((item) => item.id === editionId) ?? null;
    }

    async insertEdition(_session: DatabaseSession, values: NewEditionValues): Promise<EditionRow> {
        this.insertedEditions.push(values);
        const row = editionRow({
            ...values,
            status: "draft",
            publishedAt: null,
            createdAt: NOW,
            updatedAt: NOW,
        });
        this.editions.push(row);
        return row;
    }

    async updateEdition(
        _session: DatabaseSession,
        _organizationId: string,
        editionId: string,
        values: EditionUpdateValues,
    ): Promise<EditionRow | null> {
        this.updates.push(values);
        const index = this.editions.findIndex((item) => item.id === editionId);
        const current = this.editions[index];
        if (current === undefined) {
            return null;
        }
        const row = { ...current, ...values };
        this.editions[index] = row;
        return row;
    }

    async listDivisions(): Promise<readonly DivisionRow[]> {
        return this.divisions;
    }

    async listMilestones(): Promise<readonly MilestoneRow[]> {
        return this.milestones;
    }

    async insertDivision(
        _session: DatabaseSession,
        values: NewDivisionValues,
    ): Promise<DivisionRow> {
        this.insertedDivisions.push(values);
        return {
            id: `division-${String(this.insertedDivisions.length)}`,
            ...values,
            createdAt: NOW,
        };
    }

    async insertMilestone(
        _session: DatabaseSession,
        values: NewMilestoneValues,
    ): Promise<MilestoneRow> {
        this.insertedMilestones.push(values);
        return {
            id: `milestone-${String(this.insertedMilestones.length)}`,
            ...values,
            createdAt: NOW,
        };
    }

    async listPublicEditions(): Promise<readonly PublicEditionRow[]> {
        return this.publicRows;
    }

    async countPublishedProjectsByEdition(): Promise<Map<string, number>> {
        return new Map();
    }
}

interface Harness {
    readonly service: CompetitionService;
    readonly repository: FakeRepository;
    readonly audits: AuditEntry[];
}

function harness(repository: FakeRepository): Harness {
    const audits: AuditEntry[] = [];
    const session: DatabaseSession = {
        db: {} as DatabaseExecutor,
        organizationId: ORGANIZATION_ID,
        userId: ACTOR_ID,
    };
    const database = {
        db: {} as DatabaseExecutor,
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
    const organizations = {
        async getSummary(organizationId: string) {
            return {
                id: organizationId,
                name: "Example Organization",
                slug: "example-organization",
                description: "",
                websiteUrl: null,
            };
        },
    } as unknown as OrganizationsContract;
    const service = new CompetitionService(
        database,
        repository as unknown as CompetitionRepository,
        { publish: async () => undefined } as unknown as OutboxPublisher,
        audit,
        { now: () => NOW } as Clock,
        organizations,
    );
    return { service, repository, audits };
}

function activationState(overrides: Partial<EditionActivationState> = {}): EditionActivationState {
    return {
        isBlankStart: false,
        requiresBoardApproval: false,
        themeName: null,
        startsAt: null,
        endsAt: null,
        boardApprovedAt: null,
        ...overrides,
    };
}

const MINIMAL_CREATE = {
    name: "Copied edition",
    slug: "copied-edition",
    timezone: "Europe/Berlin",
};

describe("activation readiness", () => {
    it("allows a regular edition with no copied configuration", () => {
        expect(CompetitionRules.activationBlockers(activationState())).toEqual([]);
    });

    it("lists every missing blank-shell item in one conflict", () => {
        expect(
            CompetitionRules.activationBlockers(activationState({ isBlankStart: true })),
        ).toEqual(["theme name", "start date", "end date", "board approval"]);
        expect(() =>
            CompetitionRules.assertActivationReady(activationState({ isBlankStart: true })),
        ).toThrow(/theme name, start date, end date, board approval/);
    });

    it("requires board approval whenever the edition requires it", () => {
        expect(
            CompetitionRules.activationBlockers(activationState({ requiresBoardApproval: true })),
        ).toEqual(["board approval"]);
    });

    it("passes a complete blank shell", () => {
        const complete = activationState({
            isBlankStart: true,
            themeName: "Beneath the surface",
            startsAt: STARTS_AT,
            endsAt: ENDS_AT,
            boardApprovedAt: NOW,
        });
        expect(CompetitionRules.activationBlockers(complete)).toEqual([]);
        expect(() => CompetitionRules.assertActivationReady(complete)).not.toThrow();
    });

    it("treats a blank theme as missing", () => {
        expect(
            CompetitionRules.activationBlockers(
                activationState({
                    isBlankStart: true,
                    themeName: "  ",
                    startsAt: STARTS_AT,
                    endsAt: ENDS_AT,
                    boardApprovedAt: NOW,
                }),
            ),
        ).toEqual(["theme name"]);
    });
});

describe("upcoming theme masking", () => {
    it.each([
        ["draft", false],
        ["published", false],
        ["registration_open", false],
        ["registration_closed", false],
        ["paused", false],
        ["active", true],
        ["judging", true],
        ["voting", true],
        ["completed", true],
        ["archived", true],
    ] as const)("%s reveals the theme: %s", (status, published) => {
        expect(isThemePublished(status)).toBe(published);
    });

    it("masks the theme in the public list for an unrevealed phase", async () => {
        const repository = new FakeRepository({ editions: [editionRow()] });
        repository.publicRows = [
            {
                ...editionRow({
                    status: "registration_open",
                    themeName: "Beneath the surface",
                    themeDescription: "Hidden until the event starts.",
                }),
                seriesName: "Series",
            },
        ];
        const { service } = harness(repository);

        const items = await service.publicCompetitions(10);

        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({
            status: "registration_open",
            themeName: null,
            themeDescription: null,
        });
    });
});

describe("edition approval transitions", () => {
    it("validates the approval request", () => {
        expect(updateEditionApprovalRequestSchema.parse({ approved: true }).approved).toBe(true);
        expect(updateEditionApprovalRequestSchema.safeParse({ approved: "yes" }).success).toBe(
            false,
        );
        expect(
            updateEditionApprovalRequestSchema.safeParse({ approved: true, by: ACTOR_ID }).success,
        ).toBe(false);
    });

    it("records the caller and the time, then audits it", async () => {
        const repository = new FakeRepository({
            editions: [editionRow({ requiresBoardApproval: true })],
        });
        const { service, audits } = harness(repository);

        const approved = await service.setBoardApproval(
            auth,
            ORGANIZATION_ID,
            EDITION_ID,
            { approved: true },
            "203.0.113.10",
        );

        expect(approved.boardApprovedAt).toBe(NOW.toISOString());
        expect(approved.boardApprovedByName).toBe("Board Member");
        expect(audits).toHaveLength(1);
        expect(audits[0]).toMatchObject({
            action: "competition.edition.approved",
            entityType: "competition_edition",
            entityId: EDITION_ID,
            metadata: { approved: true },
        });
    });

    it("clears both fields and audits a revoke", async () => {
        const repository = new FakeRepository({
            editions: [
                editionRow({
                    requiresBoardApproval: true,
                    boardApprovedAt: NOW,
                    boardApprovedByUserId: ACTOR_ID,
                }),
            ],
        });
        const { service, audits } = harness(repository);

        const revoked = await service.setBoardApproval(
            auth,
            ORGANIZATION_ID,
            EDITION_ID,
            { approved: false },
            null,
        );

        expect(revoked.boardApprovedAt).toBeNull();
        expect(revoked.boardApprovedByName).toBeNull();
        expect(audits[0]).toMatchObject({
            action: "competition.edition.approval_revoked",
            metadata: { approved: false },
        });
    });

    it("rejects an unknown edition", async () => {
        const { service } = harness(new FakeRepository({}));

        await expect(
            service.setBoardApproval(auth, ORGANIZATION_ID, EDITION_ID, { approved: true }, null),
        ).rejects.toBeInstanceOf(NotFoundError);
    });
});

describe("publishing with readiness", () => {
    it("blocks a blank shell until every item exists", async () => {
        const repository = new FakeRepository({
            editions: [editionRow({ isBlankStart: true, requiresBoardApproval: true })],
        });
        const { service, repository: repo } = harness(repository);

        await expect(
            service.publish(auth, ORGANIZATION_ID, EDITION_ID, null),
        ).rejects.toBeInstanceOf(ConflictError);
        expect(repo.updates).toHaveLength(0);
    });

    it("blocks a regular edition whose board approval is required", async () => {
        const repository = new FakeRepository({
            editions: [editionRow({ requiresBoardApproval: true })],
        });
        const { service } = harness(repository);

        await expect(service.publish(auth, ORGANIZATION_ID, EDITION_ID, null)).rejects.toThrow(
            /board approval/,
        );
    });

    it("blocks publishing through a status update too", async () => {
        const repository = new FakeRepository({
            editions: [
                editionRow({
                    isBlankStart: true,
                    requiresBoardApproval: true,
                    themeName: "Beneath the surface",
                    startsAt: STARTS_AT,
                    endsAt: ENDS_AT,
                }),
            ],
        });
        const { service, repository: repo } = harness(repository);

        await expect(
            service.update(
                auth,
                ORGANIZATION_ID,
                EDITION_ID,
                { status: "published", themeName: undefined, themeDescription: undefined },
                null,
            ),
        ).rejects.toThrow(/board approval/);
        expect(repo.updates).toHaveLength(0);
    });

    it("publishes a complete approved edition", async () => {
        const repository = new FakeRepository({
            editions: [
                editionRow({
                    isBlankStart: true,
                    requiresBoardApproval: true,
                    themeName: "Beneath the surface",
                    startsAt: STARTS_AT,
                    endsAt: ENDS_AT,
                    boardApprovedAt: NOW,
                    boardApprovedByUserId: ACTOR_ID,
                }),
            ],
        });
        const { service } = harness(repository);

        const published = await service.publish(auth, ORGANIZATION_ID, EDITION_ID, null);

        expect(published.status).toBe("published");
    });
});

describe("copy and blank-shell creation", () => {
    it("copies theme, schedule, rules, contacts, divisions, and milestones", async () => {
        const source = editionRow({
            id: SOURCE_ID,
            name: "Source",
            slug: "source",
            themeName: "Beneath the surface",
            themeDescription: "Build something hidden.",
            contactEmail: "organizers@example.org",
            contactUrl: "https://example.org/contact",
            timezone: "Europe/Berlin",
            registrationOpensAt: new Date("2026-11-01T00:00:00.000Z"),
            registrationClosesAt: new Date("2026-11-20T00:00:00.000Z"),
            startsAt: STARTS_AT,
            endsAt: ENDS_AT,
            resultsOpenAt: new Date("2026-12-20T00:00:00.000Z"),
            teamMinSize: 2,
            teamMaxSize: 6,
            rulesMarkdown: "## Rules",
        });
        const sourceDivision: DivisionRow = {
            id: "division-source",
            organizationId: ORGANIZATION_ID,
            editionId: SOURCE_ID,
            name: "Open",
            slug: "open",
            description: "Open division.",
            minTeamSize: 1,
            maxTeamSize: 4,
            createdAt: NOW,
        };
        const sourceMilestone: MilestoneRow = {
            id: "milestone-source",
            organizationId: ORGANIZATION_ID,
            editionId: SOURCE_ID,
            title: "Submission deadline",
            description: "",
            kind: "submission",
            occursAt: ENDS_AT,
            createdAt: NOW,
        };
        const repository = new FakeRepository({
            editions: [source],
            divisions: [sourceDivision],
            milestones: [sourceMilestone],
        });
        const { service } = harness(repository);

        const created = await service.createEdition(
            auth,
            ORGANIZATION_ID,
            SERIES_ID,
            createEditionRequestSchema.parse({
                ...MINIMAL_CREATE,
                copyFromEditionId: SOURCE_ID,
            }),
            null,
        );

        expect(created.name).toBe("Copied edition");
        expect(repository.insertedEditions[0]).toMatchObject({
            themeName: "Beneath the surface",
            themeDescription: "Build something hidden.",
            contactEmail: "organizers@example.org",
            contactUrl: "https://example.org/contact",
            timezone: "Europe/Berlin",
            teamMinSize: 2,
            teamMaxSize: 6,
            rulesMarkdown: "## Rules",
            isBlankStart: false,
            requiresBoardApproval: false,
        });
        expect(repository.insertedEditions[0]?.registrationOpensAt).toEqual(
            source.registrationOpensAt,
        );
        expect(repository.insertedEditions[0]?.startsAt).toEqual(STARTS_AT);
        expect(repository.insertedEditions[0]?.resultsOpenAt).toEqual(source.resultsOpenAt);
        expect(repository.insertedDivisions).toEqual([
            expect.objectContaining({
                editionId: created.id,
                name: "Open",
                slug: "open",
                minTeamSize: 1,
                maxTeamSize: 4,
            }),
        ]);
        expect(repository.insertedMilestones).toEqual([
            expect.objectContaining({
                editionId: created.id,
                title: "Submission deadline",
                kind: "submission",
                occursAt: ENDS_AT,
            }),
        ]);
    });

    it("refuses a source edition from another series", async () => {
        const repository = new FakeRepository({
            editions: [editionRow({ id: SOURCE_ID, seriesId: OTHER_SERIES_ID })],
        });
        const { service } = harness(repository);

        await expect(
            service.createEdition(
                auth,
                ORGANIZATION_ID,
                SERIES_ID,
                createEditionRequestSchema.parse({
                    ...MINIMAL_CREATE,
                    copyFromEditionId: SOURCE_ID,
                }),
                null,
            ),
        ).rejects.toBeInstanceOf(NotFoundError);
        expect(repository.insertedEditions).toHaveLength(0);
    });

    it("creates a blank shell that requires board approval", async () => {
        const repository = new FakeRepository({});
        const { service } = harness(repository);

        const created = await service.createEdition(
            auth,
            ORGANIZATION_ID,
            SERIES_ID,
            createEditionRequestSchema.parse({ ...MINIMAL_CREATE, isBlankStart: true }),
            null,
        );

        expect(created.isBlankStart).toBe(true);
        expect(created.requiresBoardApproval).toBe(true);
        expect(repository.insertedEditions[0]).toMatchObject({
            themeName: null,
            teamMinSize: 1,
            isBlankStart: true,
            requiresBoardApproval: true,
        });
        expect(repository.insertedDivisions).toHaveLength(0);
        expect(repository.insertedMilestones).toHaveLength(0);
    });

    it("refuses a blank shell that also copies", async () => {
        expect(
            createEditionRequestSchema.safeParse({
                ...MINIMAL_CREATE,
                copyFromEditionId: SOURCE_ID,
                isBlankStart: true,
            }).success,
        ).toBe(false);
        const { service } = harness(new FakeRepository({}));

        await expect(
            service.createEdition(
                auth,
                ORGANIZATION_ID,
                SERIES_ID,
                {
                    ...createEditionRequestSchema.parse(MINIMAL_CREATE),
                    copyFromEditionId: SOURCE_ID,
                    isBlankStart: true,
                },
                null,
            ),
        ).rejects.toBeInstanceOf(ValidationError);
    });
});

describe("theme status typing", () => {
    it("uses the edition status union", () => {
        const status: CompetitionEditionStatus = "published";
        expect(isThemePublished(status)).toBe(false);
    });
});
