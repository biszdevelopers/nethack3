import { describe, expect, it, vi } from "vitest";
import type { SubmissionStatus, TeamStatus } from "@nethack/contracts";
import type { AuthContext } from "../../../authentication/types.js";
import { FixedClock } from "../../../core/clock.js";
import { ForbiddenError } from "../../../core/errors.js";
import type { OutboxPublisher } from "../../../core/outbox.js";
import type { AuditLogger } from "../../../infrastructure/audit/audit-logger.js";
import type {
    DatabaseConnection,
    DatabaseExecutor,
    DatabaseSession,
} from "../../../infrastructure/database/client.js";
import type {
    CompetitionsContract,
    DivisionSummary,
    EditionSummary,
} from "../../competitions/contracts.js";
import type { OrganizationsContract } from "../../organizations/contracts.js";
import type { ParticipantsContract } from "../../participants/contracts.js";
import type { ProjectSummary, ProjectsContract } from "../../projects/contracts.js";
import type { SubmissionSummary, SubmissionsContract } from "../../submissions/contracts.js";
import type { TeamSummary, TeamsContract } from "../../teams/contracts.js";
import { VotingService } from "../application/voting-service.js";
import type { VotingRepository, VotingRoundRow } from "../infrastructure/voting-repository.js";

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const EDITION_ID = "22222222-2222-4222-8222-222222222222";
const ROUND_ID = "33333333-3333-4333-8333-333333333333";
const TEAM_ID = "44444444-4444-4444-8444-444444444444";
const DIVISION_ID = "55555555-5555-4555-8555-555555555555";
const PARTICIPANT_ID = "66666666-6666-4666-8666-666666666666";
const JUDGE_ID = "77777777-7777-4777-8777-777777777777";
const ORGANIZER_ID = "88888888-8888-4888-8888-888888888888";
const OWN_SUBMISSION_ID = "99999999-9999-4999-8999-999999999999";
const OTHER_SUBMISSION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_TEAM_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const now = new Date("2026-06-15T12:00:00.000Z");

function edition(): EditionSummary {
    return {
        id: EDITION_ID,
        organizationId: ORGANIZATION_ID,
        seriesId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        seriesName: "Series",
        name: "Edition",
        slug: "edition",
        description: "",
        status: "voting",
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

function division(id: string, name: string): DivisionSummary {
    return {
        id,
        organizationId: ORGANIZATION_ID,
        editionId: EDITION_ID,
        name,
        slug: name.toLowerCase(),
        description: "",
        minTeamSize: null,
        maxTeamSize: null,
    };
}

function team(status: TeamStatus, divisionId: string | null): TeamSummary {
    return {
        id: TEAM_ID,
        organizationId: ORGANIZATION_ID,
        editionId: EDITION_ID,
        divisionId,
        name: "Falcons",
        description: "",
        status,
        statusReason: "",
        lockedAt: null,
        captainUserId: PARTICIPANT_ID,
        memberCount: 1,
        maxMembers: 4,
    };
}

function otherTeam(): TeamSummary {
    return {
        ...team("ready", DIVISION_ID),
        id: OTHER_TEAM_ID,
        name: "Owls",
        divisionId: DIVISION_ID,
        captainUserId: JUDGE_ID,
    };
}

function submission(id: string, teamId: string, status: SubmissionStatus): SubmissionSummary {
    return {
        id,
        organizationId: ORGANIZATION_ID,
        editionId: EDITION_ID,
        projectId: `project-${id}`,
        projectSlug: `project-${id}`,
        teamId,
        status,
        currentVersion: 1,
        submittedAt: now.toISOString(),
        title: `Project ${id}`,
        summary: "",
    };
}

function round(): VotingRoundRow {
    return {
        id: ROUND_ID,
        organizationId: ORGANIZATION_ID,
        editionId: EDITION_ID,
        name: "Community choice",
        description: "",
        status: "open",
        eligibleRoles: ["participant", "judge"],
        maxSelections: 10,
        maxVotesPerUser: 0,
        opensAt: null,
        closesAt: null,
        publishedAt: null,
        createdAt: now,
        updatedAt: now,
    };
}

function project(): ProjectSummary {
    return {
        id: "project",
        organizationId: ORGANIZATION_ID,
        editionId: EDITION_ID,
        teamId: TEAM_ID,
        ownerUserId: PARTICIPANT_ID,
        title: "Project",
        slug: "project",
        summary: "",
        descriptionMarkdown: "",
        repositoryUrl: null,
        demoUrl: null,
        videoUrl: null,
        aiDisclosure: "",
        tags: [],
        status: "published",
        publishedAt: now.toISOString(),
        lockedAt: null,
    };
}

function auth(userId: string): AuthContext {
    return { user: { id: userId } } as unknown as AuthContext;
}

interface HarnessOptions {
    readonly teamStatus?: TeamStatus | null;
    readonly submissions?: readonly SubmissionSummary[];
    readonly approvedParticipant?: boolean;
}

interface Harness {
    readonly service: VotingService;
    readonly deleteVotesForSubmission: ReturnType<typeof vi.fn>;
    readonly auditEntries: Parameters<AuditLogger["record"]>[1][];
}

function harness(options: HarnessOptions = {}): Harness {
    const session: DatabaseSession = {
        db: {} as DatabaseExecutor,
        organizationId: ORGANIZATION_ID,
        userId: PARTICIPANT_ID,
    };
    const database = {
        transaction: async <T>(
            _options: unknown,
            work: (value: DatabaseSession) => Promise<T>,
        ): Promise<T> => work(session),
    } as unknown as DatabaseConnection;
    const deleteVotesForSubmission = vi.fn(async () => 2);
    const repository = {
        listRounds: async () => [round()],
        findRound: async () => round(),
        deleteVotesForSubmission,
    } as unknown as VotingRepository;
    const submissions = (
        options.submissions ?? [
            submission(OWN_SUBMISSION_ID, TEAM_ID, "submitted"),
            submission(OTHER_SUBMISSION_ID, OTHER_TEAM_ID, "submitted"),
        ]
    ).map((row) => row);
    const teamsContract = {
        getTeamForUser: async () =>
            options.teamStatus === undefined || options.teamStatus === null
                ? null
                : team(options.teamStatus, DIVISION_ID),
        getTeam: async (teamId: string) =>
            teamId === OTHER_TEAM_ID ? otherTeam() : team("ready", DIVISION_ID),
    } as unknown as TeamsContract;
    const competitions = {
        getEdition: async () => edition(),
        getDivision: async (_organizationId: string, divisionId: string) =>
            division(divisionId, divisionId === DIVISION_ID ? "Open" : "Junior"),
    } as unknown as CompetitionsContract;
    const submissionsContract = {
        listEditionSubmissions: async () => submissions,
    } as unknown as SubmissionsContract;
    const participants = {
        isApprovedParticipant: async () => options.approvedParticipant ?? true,
    } as unknown as ParticipantsContract;
    const organizations = {
        getSummary: async () => ({
            id: ORGANIZATION_ID,
            name: "Organization",
            slug: "organization",
        }),
    } as unknown as OrganizationsContract;
    const projects = {
        getProject: async () => project(),
    } as unknown as ProjectsContract;
    const events = {
        publish: async () => undefined,
    } as unknown as OutboxPublisher;
    const auditEntries: Parameters<AuditLogger["record"]>[1][] = [];
    const audit = {
        record: async (_session: DatabaseSession, entry: Parameters<AuditLogger["record"]>[1]) => {
            auditEntries.push(entry);
        },
    } as unknown as AuditLogger;

    return {
        service: new VotingService(
            database,
            repository,
            competitions,
            submissionsContract,
            participants,
            organizations,
            teamsContract,
            projects,
            events,
            audit,
            new FixedClock(now),
        ),
        deleteVotesForSubmission,
        auditEntries,
    };
}

describe("VotingService participant eligibility", () => {
    it("rejects discovery for a teamless participant", async () => {
        const { service } = harness({ teamStatus: null });

        await expect(
            service.votableSubmissions(ORGANIZATION_ID, "participant", EDITION_ID, PARTICIPANT_ID),
        ).rejects.toBeInstanceOf(ForbiddenError);
        await expect(
            service.votableSubmissions(ORGANIZATION_ID, "participant", EDITION_ID, PARTICIPANT_ID),
        ).rejects.toThrow("Only participants with an active team can vote in this round.");
    });

    it("rejects discovery for a participant whose team only has a draft", async () => {
        const { service } = harness({
            teamStatus: "ready",
            submissions: [submission(OWN_SUBMISSION_ID, TEAM_ID, "draft")],
        });

        await expect(
            service.votableSubmissions(ORGANIZATION_ID, "participant", EDITION_ID, PARTICIPANT_ID),
        ).rejects.toThrow(
            "Only participants whose team has a submitted project can vote in this round.",
        );
    });

    it("rejects a cast from a teamless participant before writing anything", async () => {
        const { service } = harness({ teamStatus: null });

        await expect(
            service.castBallot(
                auth(PARTICIPANT_ID),
                ORGANIZATION_ID,
                "participant",
                ROUND_ID,
                {
                    scores: [
                        { submissionId: OWN_SUBMISSION_ID, stars: 5 },
                        { submissionId: OTHER_SUBMISSION_ID, stars: 5 },
                    ],
                    reasoning: "",
                },
                null,
            ),
        ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("scopes a participant with a submitted team to the same division and other teams", async () => {
        const { service } = harness({ teamStatus: "ready" });

        const items = await service.votableSubmissions(
            ORGANIZATION_ID,
            "participant",
            EDITION_ID,
            PARTICIPANT_ID,
        );

        expect(items.map((item) => item.id)).toEqual([OTHER_SUBMISSION_ID]);
    });

    it("keeps a teamless judge unrestricted", async () => {
        const { service } = harness({ teamStatus: null });

        const items = await service.votableSubmissions(
            ORGANIZATION_ID,
            "judge",
            EDITION_ID,
            JUDGE_ID,
        );

        expect(items.map((item) => item.id)).toEqual([OWN_SUBMISSION_ID, OTHER_SUBMISSION_ID]);
    });

    it("lets an organizer review every votable submission", async () => {
        const { service } = harness({ teamStatus: null });

        const items = await service.votableSubmissions(
            ORGANIZATION_ID,
            "organizer",
            EDITION_ID,
            ORGANIZER_ID,
        );

        expect(items.map((item) => item.id)).toEqual([OWN_SUBMISSION_ID, OTHER_SUBMISSION_ID]);
    });
});

describe("VotingService.removeSubmissionVotes", () => {
    it("deletes and audits the submission's votes", async () => {
        const { service, deleteVotesForSubmission, auditEntries } = harness();

        const removed = await service.removeSubmissionVotes(ORGANIZATION_ID, OTHER_SUBMISSION_ID);

        expect(removed).toBe(2);
        expect(deleteVotesForSubmission).toHaveBeenCalledWith(
            expect.anything(),
            ORGANIZATION_ID,
            OTHER_SUBMISSION_ID,
        );
        expect(auditEntries).toEqual([
            {
                organizationId: ORGANIZATION_ID,
                actorUserId: null,
                action: "voting.votes.cleared",
                entityType: "submission",
                entityId: OTHER_SUBMISSION_ID,
                metadata: {
                    submissionId: OTHER_SUBMISSION_ID,
                    removedVotes: 2,
                },
                ip: null,
            },
        ]);
    });
});
