import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { loadLocalEnvironment } from "./bootstrap.js";
import { loadConfiguration } from "./core/configuration.js";
import * as schema from "./infrastructure/database/schema/index.js";

loadLocalEnvironment();

const config = loadConfiguration();
if (config.isProduction) {
    console.error("The development fixture seed refuses to run in production.");
    process.exit(1);
}

const connectionString = process.env.DATABASE_MIGRATION_URL ?? config.database.url;
const pool = new Pool({ connectionString, max: 1, application_name: "nethack-seed" });
const database = drizzle(pool, { schema });

const ORGANIZATION_ID = "f1000000-0000-4000-8000-000000000001";
const SERIES_ID = "f1000000-0000-4000-8000-000000000002";
const EDITION_ID = "f1000000-0000-4000-8000-000000000003";
const DIVISION_ID = "f1000000-0000-4000-8000-000000000004";
const MILESTONE_ID = "f1000000-0000-4000-8000-000000000005";
const ORGANIZER_ID = "f1000000-0000-4000-8000-000000000010";
const PARTICIPANT_ID = "f1000000-0000-4000-8000-000000000011";
const JUDGE_ID = "f1000000-0000-4000-8000-000000000012";
const TEAM_ID = "f1000000-0000-4000-8000-000000000020";
const REGISTRATION_ID = "f1000000-0000-4000-8000-000000000021";
const PARTICIPANT_ROW_ID = "f1000000-0000-4000-8000-000000000022";
const PROJECT_ID = "f1000000-0000-4000-8000-000000000030";
const SUBMISSION_ID = "f1000000-0000-4000-8000-000000000031";
const VERSION_ID = "f1000000-0000-4000-8000-000000000032";
const ANNOUNCEMENT_ID = "f1000000-0000-4000-8000-000000000040";

const now = new Date();
const day = 24 * 60 * 60 * 1000;

try {
    await database.transaction(async (tx) => {
        await tx.execute(
            sql`select set_config('nethack.organization_id', ${ORGANIZATION_ID}, true)`,
        );

        await tx
            .insert(schema.users)
            .values([
                {
                    id: ORGANIZER_ID,
                    displayName: "Fixture Organizer",
                    email: "organizer@fixture.invalid",
                    locale: "en",
                },
                {
                    id: PARTICIPANT_ID,
                    displayName: "Fixture Participant",
                    email: "participant@fixture.invalid",
                    locale: "en",
                },
                {
                    id: JUDGE_ID,
                    displayName: "Fixture Judge",
                    email: "judge@fixture.invalid",
                    locale: "en",
                },
            ])
            .onConflictDoNothing();

        await tx
            .insert(schema.externalIdentities)
            .values([
                {
                    userId: ORGANIZER_ID,
                    issuer: config.basisAuth.issuer,
                    subject: "fixture-organizer",
                    emailAtLogin: "organizer@fixture.invalid",
                },
                {
                    userId: PARTICIPANT_ID,
                    issuer: config.basisAuth.issuer,
                    subject: "fixture-participant",
                    emailAtLogin: "participant@fixture.invalid",
                },
                {
                    userId: JUDGE_ID,
                    issuer: config.basisAuth.issuer,
                    subject: "fixture-judge",
                    emailAtLogin: "judge@fixture.invalid",
                },
            ])
            .onConflictDoNothing();

        await tx
            .insert(schema.organizations)
            .values({
                id: ORGANIZATION_ID,
                name: "Example Workspace (development fixture)",
                slug: "example-workspace",
                description:
                    "A development-only organization used to exercise nethack workflows locally.",
            })
            .onConflictDoNothing();

        await tx
            .insert(schema.organizationSettings)
            .values({ organizationId: ORGANIZATION_ID, publicShowcaseEnabled: true })
            .onConflictDoNothing();

        await tx
            .insert(schema.organizationMemberships)
            .values([
                { organizationId: ORGANIZATION_ID, userId: ORGANIZER_ID, role: "owner" },
                { organizationId: ORGANIZATION_ID, userId: JUDGE_ID, role: "judge" },
                { organizationId: ORGANIZATION_ID, userId: PARTICIPANT_ID, role: "participant" },
            ])
            .onConflictDoNothing();

        await tx
            .insert(schema.competitionSeries)
            .values({
                id: SERIES_ID,
                organizationId: ORGANIZATION_ID,
                name: "Fixture Series",
                slug: "fixture-series",
                description: "Development fixture series.",
            })
            .onConflictDoNothing();

        await tx
            .insert(schema.competitionEditions)
            .values({
                id: EDITION_ID,
                organizationId: ORGANIZATION_ID,
                seriesId: SERIES_ID,
                name: "Fixture Build Weekend",
                slug: "fixture-build-weekend",
                description:
                    "A development fixture edition used to verify registration, teams, projects, and the public showcase.",
                status: "voting",
                timezone: "UTC",
                registrationOpensAt: new Date(now.getTime() - 7 * day),
                registrationClosesAt: new Date(now.getTime() + 14 * day),
                startsAt: new Date(now.getTime() + 21 * day),
                endsAt: new Date(now.getTime() + 23 * day),
                teamMinSize: 1,
                teamMaxSize: 4,
                rulesMarkdown:
                    "## Eligibility\n\nParticipants must belong to the fixture organization.\n\n## Submission\n\nOne project per team with a repository link and a short summary.",
                publishedAt: now,
            })
            .onConflictDoNothing();

        await tx
            .insert(schema.divisions)
            .values({
                id: DIVISION_ID,
                organizationId: ORGANIZATION_ID,
                editionId: EDITION_ID,
                name: "Open",
                slug: "open",
                description: "Open division.",
            })
            .onConflictDoNothing();

        await tx
            .insert(schema.milestones)
            .values({
                id: MILESTONE_ID,
                organizationId: ORGANIZATION_ID,
                editionId: EDITION_ID,
                title: "Registration closes",
                description: "Teams must be complete before this milestone.",
                kind: "registration",
                occursAt: new Date(now.getTime() + 14 * day),
            })
            .onConflictDoNothing();

        await tx
            .insert(schema.registrations)
            .values({
                id: REGISTRATION_ID,
                organizationId: ORGANIZATION_ID,
                editionId: EDITION_ID,
                userId: PARTICIPANT_ID,
                divisionId: DIVISION_ID,
                status: "approved",
                decidedByUserId: ORGANIZER_ID,
                decidedAt: now,
            })
            .onConflictDoNothing();

        await tx
            .insert(schema.teams)
            .values({
                id: TEAM_ID,
                organizationId: ORGANIZATION_ID,
                editionId: EDITION_ID,
                divisionId: DIVISION_ID,
                name: "Fixture Team",
                description: "Development fixture team.",
                status: "ready",
                captainUserId: PARTICIPANT_ID,
                maxMembers: 4,
            })
            .onConflictDoNothing();

        await tx
            .insert(schema.participants)
            .values({
                id: PARTICIPANT_ROW_ID,
                organizationId: ORGANIZATION_ID,
                editionId: EDITION_ID,
                userId: PARTICIPANT_ID,
                divisionId: DIVISION_ID,
                teamId: TEAM_ID,
            })
            .onConflictDoNothing();

        await tx
            .insert(schema.teamMembers)
            .values({
                organizationId: ORGANIZATION_ID,
                teamId: TEAM_ID,
                userId: PARTICIPANT_ID,
                role: "captain",
            })
            .onConflictDoNothing();

        await tx
            .insert(schema.projects)
            .values({
                id: PROJECT_ID,
                organizationId: ORGANIZATION_ID,
                editionId: EDITION_ID,
                teamId: TEAM_ID,
                ownerUserId: PARTICIPANT_ID,
                title: "Fixture Project",
                slug: "fixture-project",
                summary: "A development fixture project used to verify the public showcase.",
                descriptionMarkdown:
                    "## What it does\n\nThis project exists only in development fixtures.\n\n## Stack\n\n- TypeScript\n- PostgreSQL",
                repositoryUrl: "https://example.com/fixture",
                tags: ["fixture", "typescript"],
                status: "published",
                publishedAt: now,
            })
            .onConflictDoNothing();

        await tx
            .insert(schema.projectMembers)
            .values({
                organizationId: ORGANIZATION_ID,
                projectId: PROJECT_ID,
                userId: PARTICIPANT_ID,
                role: "owner",
            })
            .onConflictDoNothing();

        await tx
            .insert(schema.submissions)
            .values({
                id: SUBMISSION_ID,
                organizationId: ORGANIZATION_ID,
                editionId: EDITION_ID,
                projectId: PROJECT_ID,
                teamId: TEAM_ID,
                status: "submitted",
                currentVersion: 1,
                submittedAt: now,
            })
            .onConflictDoNothing();

        await tx
            .insert(schema.submissionVersions)
            .values({
                id: VERSION_ID,
                organizationId: ORGANIZATION_ID,
                submissionId: SUBMISSION_ID,
                version: 1,
                title: "Fixture Project",
                summary: "A development fixture project used to verify the public showcase.",
                descriptionMarkdown: "Initial fixture submission.",
                repositoryUrl: "https://example.com/fixture",
                createdByUserId: PARTICIPANT_ID,
            })
            .onConflictDoNothing();

        await tx
            .insert(schema.announcements)
            .values({
                id: ANNOUNCEMENT_ID,
                organizationId: ORGANIZATION_ID,
                editionId: EDITION_ID,
                title: "Fixture announcement",
                bodyMarkdown:
                    "This announcement is part of the development fixtures. It confirms that public announcements render correctly.",
                visibility: "public",
                publishedAt: now,
                authorUserId: ORGANIZER_ID,
            })
            .onConflictDoNothing();
    });
    console.log("Development fixtures seeded.");
    console.log("Organizer subject: fixture-organizer");
    console.log("Participant subject: fixture-participant");
    console.log("Judge subject: fixture-judge");
} catch (error) {
    console.error("Seed failed.", error instanceof Error ? error.message : error);
    process.exitCode = 1;
} finally {
    await pool.end();
}
