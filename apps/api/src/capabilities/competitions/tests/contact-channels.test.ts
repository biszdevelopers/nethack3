import { describe, expect, it } from "vitest";
import {
    createEditionRequestSchema,
    publicCompetitionSchema,
    updateEditionRequestSchema,
} from "@nethack/contracts";
import type { Clock } from "../../../core/clock.js";
import type { OutboxPublisher } from "../../../core/outbox.js";
import type { AuditLogger } from "../../../infrastructure/audit/audit-logger.js";
import type {
    DatabaseConnection,
    DatabaseExecutor,
} from "../../../infrastructure/database/client.js";
import { CompetitionService } from "../application/competition-service.js";
import type { CompetitionRepository } from "../infrastructure/competition-repository.js";
import type { OrganizationsContract } from "../../organizations/contracts.js";

const MINIMAL_CREATE = {
    name: "Contact edition",
    slug: "contact-edition",
    timezone: "UTC",
};

const PUBLIC_COMPETITION = {
    editionId: "f1000000-0000-4000-8000-000000000003",
    name: "Fixture Build Weekend",
    slug: "fixture-build-weekend",
    description: "Edition used to verify organizer contact channels.",
    themeName: null,
    themeDescription: null,
    contactEmail: "organizers@example.org",
    contactUrl: "https://teams.microsoft.com/l/channel/example",
    status: "published",
    organizationName: "Example Workspace",
    organizationSlug: "example-workspace",
    seriesName: "Fixture Series",
    startsAt: null,
    endsAt: null,
    registrationClosesAt: null,
    resultsOpenAt: null,
    teamMinSize: 1,
    teamMaxSize: 4,
    showScores: false,
    showRanking: false,
    publishedProjectCount: 0,
};

describe("edition contact channel validation", () => {
    it("defaults both channels to not configured", () => {
        const parsed = createEditionRequestSchema.parse(MINIMAL_CREATE);
        expect(parsed.contactEmail).toBeNull();
        expect(parsed.contactUrl).toBeNull();
    });

    it("keeps a valid email and https URL", () => {
        const parsed = createEditionRequestSchema.parse({
            ...MINIMAL_CREATE,
            contactEmail: "  organizers@example.org  ",
            contactUrl: "https://teams.microsoft.com/l/channel/example",
        });
        expect(parsed.contactEmail).toBe("organizers@example.org");
        expect(parsed.contactUrl).toBe("https://teams.microsoft.com/l/channel/example");
    });

    it("treats blank channels as not configured", () => {
        const created = createEditionRequestSchema.parse({
            ...MINIMAL_CREATE,
            contactEmail: "   ",
            contactUrl: "",
        });
        expect(created.contactEmail).toBeNull();
        expect(created.contactUrl).toBeNull();

        const updated = updateEditionRequestSchema.parse({ contactEmail: " ", contactUrl: "" });
        expect(updated.contactEmail).toBeNull();
        expect(updated.contactUrl).toBeNull();
    });

    it("rejects a malformed email address", () => {
        expect(
            createEditionRequestSchema.safeParse({
                ...MINIMAL_CREATE,
                contactEmail: "organizers-at-example",
            }).success,
        ).toBe(false);
    });

    it("rejects a non-https contact URL", () => {
        for (const contactUrl of ["http://example.org/contact", "teams.microsoft.com", "ftp://x"]) {
            expect(
                createEditionRequestSchema.safeParse({ ...MINIMAL_CREATE, contactUrl }).success,
            ).toBe(false);
        }
    });

    it("supports clearing and partial updates", () => {
        expect(updateEditionRequestSchema.parse({ contactEmail: null }).contactEmail).toBeNull();
        expect(updateEditionRequestSchema.parse({ contactUrl: null }).contactUrl).toBeNull();
        const untouched = updateEditionRequestSchema.parse({ name: "Renamed" });
        expect(untouched.contactEmail).toBeUndefined();
        expect(untouched.contactUrl).toBeUndefined();
    });
});

describe("public competition contact payload", () => {
    it("maps the organizer contact channels into the public payload", async () => {
        const service = publicServiceFor({
            contactEmail: "organizers@example.org",
            contactUrl: "https://teams.microsoft.com/l/channel/example",
        });

        const detail = await service.publicCompetitionDetail(PUBLIC_COMPETITION.slug);

        expect(detail.contactEmail).toBe("organizers@example.org");
        expect(detail.contactUrl).toBe("https://teams.microsoft.com/l/channel/example");
        expect(publicCompetitionSchema.parse(detail).contactEmail).toBe("organizers@example.org");
    });

    it("keeps unconfigured channels null in the public payload", async () => {
        const service = publicServiceFor({ contactEmail: null, contactUrl: null });

        const detail = await service.publicCompetitionDetail(PUBLIC_COMPETITION.slug);

        expect(detail.contactEmail).toBeNull();
        expect(detail.contactUrl).toBeNull();
    });

    it("keeps the contact keys in the serialized contract", () => {
        const parsed = publicCompetitionSchema.parse(PUBLIC_COMPETITION);
        expect(parsed.contactEmail).toBe("organizers@example.org");
        expect(parsed.contactUrl).toBe("https://teams.microsoft.com/l/channel/example");
    });

    it("requires both contact keys so the payload stays explicit", () => {
        const withoutEmail: Record<string, unknown> = { ...PUBLIC_COMPETITION };
        delete withoutEmail.contactEmail;
        expect(publicCompetitionSchema.safeParse(withoutEmail).success).toBe(false);

        const withoutUrl: Record<string, unknown> = { ...PUBLIC_COMPETITION };
        delete withoutUrl.contactUrl;
        expect(publicCompetitionSchema.safeParse(withoutUrl).success).toBe(false);
    });
});

const ORGANIZATION_ID = "f1000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-03-01T12:00:00.000Z");

function publicServiceFor(contact: {
    contactEmail: string | null;
    contactUrl: string | null;
}): CompetitionService {
    const repository = {
        async findPublicEditionBySlug() {
            return {
                id: PUBLIC_COMPETITION.editionId,
                organizationId: ORGANIZATION_ID,
                seriesId: "f1000000-0000-4000-8000-000000000002",
                name: PUBLIC_COMPETITION.name,
                slug: PUBLIC_COMPETITION.slug,
                description: PUBLIC_COMPETITION.description,
                themeName: null,
                themeDescription: null,
                contactEmail: contact.contactEmail,
                contactUrl: contact.contactUrl,
                showScores: false,
                showRanking: false,
                status: "published" as const,
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
                publishedAt: NOW,
                createdAt: NOW,
                updatedAt: NOW,
                seriesName: PUBLIC_COMPETITION.seriesName,
            };
        },
        async listDivisions() {
            return [];
        },
        async listMilestones() {
            return [];
        },
        async listPublicProjects() {
            return [];
        },
        async countPublishedProjectsByEdition() {
            return new Map<string, number>();
        },
    } as unknown as CompetitionRepository;
    const organizations = {
        async getSummary() {
            return {
                id: ORGANIZATION_ID,
                name: PUBLIC_COMPETITION.organizationName,
                slug: PUBLIC_COMPETITION.organizationSlug,
                description: "",
                websiteUrl: null,
            };
        },
        async isPublicShowcaseEnabled() {
            return true;
        },
    } as unknown as OrganizationsContract;
    const database = { db: {} as DatabaseExecutor } as unknown as DatabaseConnection;
    return new CompetitionService(
        database,
        repository,
        {} as OutboxPublisher,
        {} as AuditLogger,
        { now: () => NOW } as Clock,
        organizations,
    );
}
