import { tmpdir } from "node:os";
import { join } from "node:path";

export const API_PORT = Number(process.env.E2E_API_PORT ?? "3102");
export const AUTH_PORT = Number(process.env.E2E_AUTH_PORT ?? "4110");
export const WORKSPACE_PORT = Number(process.env.E2E_WORKSPACE_PORT ?? "5273");
export const SITE_PORT = Number(process.env.E2E_SITE_PORT ?? "3100");
export const WORKER_HEALTH_PORT = Number(process.env.E2E_WORKER_HEALTH_PORT ?? "4111");

export const API_ORIGIN = `http://127.0.0.1:${String(API_PORT)}`;
export const AUTH_ORIGIN = `http://127.0.0.1:${String(AUTH_PORT)}`;
export const WORKSPACE_ORIGIN = `http://127.0.0.1:${String(WORKSPACE_PORT)}`;
export const SITE_ORIGIN = `http://127.0.0.1:${String(SITE_PORT)}`;
export const WORKER_HEALTH_URL = `http://127.0.0.1:${String(WORKER_HEALTH_PORT)}/health`;
export const STORAGE_ROOT = join(tmpdir(), "nethack-e2e-storage");

export const DATABASE = {
    host: process.env.NETHACK_TEST_DB_HOST ?? "127.0.0.1",
    port: process.env.NETHACK_TEST_DB_PORT ?? "55432",
    name: process.env.NETHACK_TEST_DB_NAME ?? "nethack_test",
    ownerUser: "nethack",
    ownerPassword: "nethack_dev_password",
    runtimeUser: "nethack_app",
    runtimePassword: "nethack_app_password",
} as const;

export const OWNER_DATABASE_URL =
    process.env.NETHACK_TEST_OWNER_URL ??
    `postgres://${DATABASE.ownerUser}:${DATABASE.ownerPassword}@${DATABASE.host}:${DATABASE.port}/${DATABASE.name}`;

export const RUNTIME_DATABASE_URL =
    process.env.NETHACK_TEST_RUNTIME_URL ??
    `postgres://${DATABASE.runtimeUser}:${DATABASE.runtimePassword}@${DATABASE.host}:${DATABASE.port}/${DATABASE.name}`;

export const AUTH = {
    clientId: "nethack-e2e-client",
    clientSecret: "nethack-e2e-client-secret",
    resource: "devconnect://nethack.test",
    resourceSecret: "nethack-e2e-resource-secret",
    redirectUri: `${API_ORIGIN}/api/v1/auth/callback`,
    postLogoutRedirectUri: `${WORKSPACE_ORIGIN}/`,
} as const;

export const SESSION_ENCRYPTION_KEYS = "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=";

export const FIXTURE = {
    organizationId: "f1000000-0000-4000-8000-000000000001",
    organizationName: "Example Workspace (development fixture)",
    organizationSlug: "example-workspace",
    seriesId: "f1000000-0000-4000-8000-000000000002",
    editionId: "f1000000-0000-4000-8000-000000000003",
    editionName: "Fixture Build Weekend",
    editionSlug: "fixture-build-weekend",
    divisionId: "f1000000-0000-4000-8000-000000000004",
    organizerId: "f1000000-0000-4000-8000-000000000010",
    participantId: "f1000000-0000-4000-8000-000000000011",
    judgeId: "f1000000-0000-4000-8000-000000000012",
    teamId: "f1000000-0000-4000-8000-000000000020",
    projectId: "f1000000-0000-4000-8000-000000000030",
    projectTitle: "Fixture Project",
    projectSlug: "fixture-project",
    submissionId: "f1000000-0000-4000-8000-000000000031",
    announcementId: "f1000000-0000-4000-8000-000000000040",
    openEditionId: "f2000000-0000-4000-8000-000000000001",
    openEditionName: "E2E Open Edition",
    openEditionSlug: "e2e-open-edition",
    openDivisionId: "f2000000-0000-4000-8000-000000000002",
    archiveEditionId: "f2000000-0000-4000-8000-000000000003",
    archiveEditionName: "Fixture Archive Season",
    archiveEditionSlug: "fixture-archive-season",
    applicantId: "f2000000-0000-4000-8000-000000000021",
    applicantRegistrationId: "f2000000-0000-4000-8000-000000000022",
    disposableTeamId: "f2000000-0000-4000-8000-0000000000b1",
    disposableTeamName: "E2E Disposable Team",
    labRubricId: "f4000000-0000-4000-8000-000000000002",
    labAssignmentId: "f4000000-0000-4000-8000-000000000030",
    labProjectTitle: "Judging Lab Project",
    otherOrganizationId: "f3000000-0000-4000-8000-000000000001",
    otherOrganizationName: "Other Workspace",
    otherProjectTitle: "Other Organization Project",
} as const;

export interface MockUser {
    readonly subject: string;
    readonly email: string;
    readonly name: string;
}

export const USERS = {
    organizer: {
        subject: "fixture-organizer",
        email: "organizer@fixture.invalid",
        name: "Fixture Organizer",
    },
    participant: {
        subject: "fixture-participant",
        email: "participant@fixture.invalid",
        name: "Fixture Participant",
    },
    judge: {
        subject: "fixture-judge",
        email: "judge@fixture.invalid",
        name: "Fixture Judge",
    },
    teamAdmin: {
        subject: "fixture-team-admin",
        email: "team-admin@fixture.invalid",
        name: "Fixture Team Admin",
    },
    applicant: {
        subject: "fixture-applicant",
        email: "applicant@fixture.invalid",
        name: "Fixture Applicant",
    },
    outsider: {
        subject: "fixture-outsider",
        email: "outsider@fixture.invalid",
        name: "Fixture Outsider",
    },
    nobody: {
        subject: "fixture-nobody",
        email: "nobody@fixture.invalid",
        name: "Fixture Nobody",
    },
} as const satisfies Record<string, MockUser>;

export const DESKTOP_VIEWPORT = { width: 1440, height: 900 } as const;
