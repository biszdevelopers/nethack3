import { AUTH_ORIGIN, FIXTURE, USERS } from "./config.js";
import { ownerQuery, ownerTenantBatch } from "./db.js";

const ORG = FIXTURE.organizationId;
const OPEN_EDITION = FIXTURE.openEditionId;
const OPEN_DIVISION = FIXTURE.openDivisionId;
const ARCHIVE_EDITION = FIXTURE.archiveEditionId;
const ARCHIVE_PROJECT_ID = "f2000000-0000-4000-8000-000000000080";
const OTHER_ORG = FIXTURE.otherOrganizationId;

const AUTHOR_ID = "f2000000-0000-4000-8000-000000000041";
const AUTHOR_PARTICIPANT_ID = "f2000000-0000-4000-8000-000000000043";
const LAB_TEAM_ID = "f2000000-0000-4000-8000-000000000050";
const LAB_TEAM_MEMBER_ID = "f2000000-0000-4000-8000-000000000051";
const LAB_PROJECT_ID = "f2000000-0000-4000-8000-000000000060";
const LAB_PROJECT_MEMBER_ID = "f2000000-0000-4000-8000-000000000061";
const LAB_SUBMISSION_ID = "f2000000-0000-4000-8000-000000000070";
const LAB_VERSION_ID = "f2000000-0000-4000-8000-000000000071";

const ORGANIZER_RUBRIC_ID = "f4000000-0000-4000-8000-000000000001";
const LAB_RUBRIC_ID = FIXTURE.labRubricId;
const LAB_ASSIGNMENT_ID = FIXTURE.labAssignmentId;

const TEAM_ADMIN_ID = "f2000000-0000-4000-8000-0000000000a1";
const DISPOSABLE_TEAM_ID = "f2000000-0000-4000-8000-0000000000b1";
const DISPOSABLE_TEAM_MEMBER_ID = "f2000000-0000-4000-8000-0000000000c1";
const DISPOSABLE_REGISTRATION_ID = "f2000000-0000-4000-8000-0000000000d1";
const DISPOSABLE_PARTICIPANT_ID = "f2000000-0000-4000-8000-0000000000e1";
const DISPOSABLE_INVITATION_ID = "f2000000-0000-4000-8000-0000000000f1";

const OTHER_USER_ID = "f3000000-0000-4000-8000-000000000010";
const OTHER_SERIES_ID = "f3000000-0000-4000-8000-000000000002";
const OTHER_EDITION_ID = "f3000000-0000-4000-8000-000000000003";
const OTHER_PROJECT_ID = "f3000000-0000-4000-8000-000000000030";

export async function seedE2eFixtures(): Promise<void> {
    await seedUsers();
    await seedOpenEdition();
    await seedJudgingLab();
    await seedOtherOrganization();
}

async function seedUsers(): Promise<void> {
    const users = [
        {
            id: FIXTURE.applicantId,
            name: USERS.applicant.name,
            email: USERS.applicant.email,
            subject: USERS.applicant.subject,
        },
        {
            id: AUTHOR_ID,
            name: "Fixture Author",
            email: "author@fixture.invalid",
            subject: "fixture-author",
        },
        {
            id: TEAM_ADMIN_ID,
            name: USERS.teamAdmin.name,
            email: USERS.teamAdmin.email,
            subject: USERS.teamAdmin.subject,
        },
        {
            id: OTHER_USER_ID,
            name: USERS.outsider.name,
            email: USERS.outsider.email,
            subject: USERS.outsider.subject,
        },
    ];
    for (const user of users) {
        await ownerQuery(
            "insert into users (id, display_name, email, locale) values ($1, $2, $3, 'en')",
            [user.id, user.name, user.email],
        );
        await ownerQuery(
            `insert into external_identities (user_id, issuer, subject, email_at_login)
             values ($1, $2, $3, $4)`,
            [user.id, AUTH_ORIGIN, user.subject, user.email],
        );
    }
    await ownerQuery(
        `insert into organization_memberships (organization_id, user_id, role)
         values ($1, $2, 'participant'), ($1, $3, 'participant'), ($1, $4, 'participant')`,
        [ORG, FIXTURE.applicantId, AUTHOR_ID, TEAM_ADMIN_ID],
    );
}

async function seedOpenEdition(): Promise<void> {
    await ownerTenantBatch(ORG, [
        {
            text: `insert into competition_editions
                   (id, organization_id, series_id, name, slug, description, status, timezone,
                    registration_opens_at, registration_closes_at, starts_at, ends_at,
                    team_min_size, team_max_size, rules_markdown, published_at)
                   values ($1, $2, $3, $4, $5, $6, 'registration_open', 'UTC',
                           now() - interval '7 days', now() + interval '14 days',
                           now() - interval '1 day', now() + interval '14 days',
                           1, 4, 'E2E registration is open.', now())`,
            values: [
                OPEN_EDITION,
                ORG,
                FIXTURE.seriesId,
                FIXTURE.openEditionName,
                FIXTURE.openEditionSlug,
                "An edition created by the E2E harness for registration and team workflows.",
            ],
        },
        {
            text: `insert into divisions (id, organization_id, edition_id, name, slug, description)
                   values ($1, $2, $3, 'Open', 'open', 'Open division for the E2E edition.')`,
            values: [OPEN_DIVISION, ORG, OPEN_EDITION],
        },
        {
            text: `insert into registrations
                   (id, organization_id, edition_id, user_id, division_id, status,
                    decided_by_user_id, decided_at)
                   values ($1, $2, $3, $4, $5, 'approved', $6, now())`,
            values: [
                FIXTURE.applicantRegistrationId,
                ORG,
                OPEN_EDITION,
                FIXTURE.judgeId,
                OPEN_DIVISION,
                FIXTURE.organizerId,
            ],
        },
        {
            text: `insert into participants (organization_id, edition_id, user_id, division_id)
                   values ($1, $2, $3, $4)`,
            values: [ORG, OPEN_EDITION, FIXTURE.judgeId, OPEN_DIVISION],
        },
        {
            text: `insert into registrations
                   (organization_id, edition_id, user_id, division_id, status)
                   values ($1, $2, $3, $4, 'pending')`,
            values: [ORG, OPEN_EDITION, FIXTURE.applicantId, OPEN_DIVISION],
        },
        {
            text: `insert into registrations
                   (id, organization_id, edition_id, user_id, division_id, status,
                    decided_by_user_id, decided_at)
                   values ($1, $2, $3, $4, $5, 'approved', $6, now())`,
            values: [
                DISPOSABLE_REGISTRATION_ID,
                ORG,
                OPEN_EDITION,
                TEAM_ADMIN_ID,
                OPEN_DIVISION,
                FIXTURE.organizerId,
            ],
        },
        {
            text: `insert into teams
                   (id, organization_id, edition_id, division_id, name, description, status,
                    captain_user_id, max_members)
                   values ($1, $2, $3, $4, 'E2E Disposable Team',
                           'Team used by the team invitation and disband journey.', 'forming', $5, 4)`,
            values: [DISPOSABLE_TEAM_ID, ORG, OPEN_EDITION, OPEN_DIVISION, TEAM_ADMIN_ID],
        },
        {
            text: `insert into team_members (id, organization_id, team_id, user_id, role)
                   values ($1, $2, $3, $4, 'captain')`,
            values: [DISPOSABLE_TEAM_MEMBER_ID, ORG, DISPOSABLE_TEAM_ID, TEAM_ADMIN_ID],
        },
        {
            text: `insert into participants
                   (id, organization_id, edition_id, user_id, division_id, team_id)
                   values ($1, $2, $3, $4, $5, $6)`,
            values: [
                DISPOSABLE_PARTICIPANT_ID,
                ORG,
                OPEN_EDITION,
                TEAM_ADMIN_ID,
                OPEN_DIVISION,
                DISPOSABLE_TEAM_ID,
            ],
        },
        {
            text: `insert into team_invitations
                   (id, organization_id, team_id, email, token_hash, status, invited_by_user_id,
                    expires_at)
                   values ($1, $2, $3, $4, $5, 'pending', $6, now() + interval '7 days')`,
            values: [
                DISPOSABLE_INVITATION_ID,
                ORG,
                DISPOSABLE_TEAM_ID,
                USERS.applicant.email,
                "a".repeat(64),
                TEAM_ADMIN_ID,
            ],
        },
        {
            text: `insert into competition_editions
                   (id, organization_id, series_id, name, slug, description, status, timezone,
                    registration_opens_at, registration_closes_at, starts_at, ends_at,
                    team_min_size, team_max_size, published_at)
                   values ($1, $2, $3, $4, $5, 'A completed season used by the archive tests.',
                           'completed', 'UTC', now() - interval '90 days',
                           now() - interval '80 days', now() - interval '75 days',
                           now() - interval '70 days', 1, 4, now() - interval '90 days')`,
            values: [
                ARCHIVE_EDITION,
                ORG,
                FIXTURE.seriesId,
                FIXTURE.archiveEditionName,
                FIXTURE.archiveEditionSlug,
            ],
        },
        {
            text: `insert into projects
                   (id, organization_id, edition_id, owner_user_id, title, slug, summary,
                    description_markdown, repository_url, demo_url, video_url, ai_disclosure,
                    tags, status, published_at)
                   values ($1, $2, $3, $4, 'Archived Showcase Project',
                           'archived-showcase-project', 'A project from a completed season.',
                           'Archive fixture.', 'https://example.com/archive-repo',
                           'https://example.com/archive-demo', 'https://example.com/archive-video',
                           'No AI tools were used in this archived project.',
                           array['archive'], 'published', now() - interval '70 days')`,
            values: [ARCHIVE_PROJECT_ID, ORG, ARCHIVE_EDITION, AUTHOR_ID],
        },
    ]);
}

async function seedJudgingLab(): Promise<void> {
    await ownerTenantBatch(ORG, [
        {
            text: `insert into registrations
                   (organization_id, edition_id, user_id, division_id, status,
                    decided_by_user_id, decided_at)
                   values ($1, $2, $3, $4, 'approved', $5, now())`,
            values: [ORG, FIXTURE.editionId, AUTHOR_ID, FIXTURE.divisionId, FIXTURE.organizerId],
        },
        {
            text: `insert into teams
                   (id, organization_id, edition_id, division_id, name, description, status,
                    captain_user_id, max_members)
                   values ($1, $2, $3, $4, 'Fixture Author Team', 'Judging fixture team.', 'ready', $5, 4)`,
            values: [LAB_TEAM_ID, ORG, FIXTURE.editionId, FIXTURE.divisionId, AUTHOR_ID],
        },
        {
            text: `insert into participants
                   (id, organization_id, edition_id, user_id, division_id, team_id)
                   values ($1, $2, $3, $4, $5, $6)`,
            values: [
                AUTHOR_PARTICIPANT_ID,
                ORG,
                FIXTURE.editionId,
                AUTHOR_ID,
                FIXTURE.divisionId,
                LAB_TEAM_ID,
            ],
        },
        {
            text: `insert into team_members (id, organization_id, team_id, user_id, role)
                   values ($1, $2, $3, $4, 'captain')`,
            values: [LAB_TEAM_MEMBER_ID, ORG, LAB_TEAM_ID, AUTHOR_ID],
        },
        {
            text: `insert into projects
                   (id, organization_id, edition_id, team_id, owner_user_id, title, slug, summary,
                    description_markdown, repository_url, demo_url, video_url, ai_disclosure,
                    tags, status, published_at, locked_at)
                   values ($1, $2, $3, $4, $5, $6, 'judging-lab-project',
                           'A fixture project used to exercise rubric scoring.',
                           'Judging lab fixture.', 'https://example.com/judging-lab',
                           'https://example.com/judging-lab-demo',
                           'https://example.com/judging-lab-video',
                           'No AI tools or models were used in this project.',
                           array['judging', 'lab'], 'published', now(), now())`,
            values: [
                LAB_PROJECT_ID,
                ORG,
                FIXTURE.editionId,
                LAB_TEAM_ID,
                AUTHOR_ID,
                FIXTURE.labProjectTitle,
            ],
        },
        {
            text: `insert into project_members (id, organization_id, project_id, user_id, role)
                   values ($1, $2, $3, $4, 'owner')`,
            values: [LAB_PROJECT_MEMBER_ID, ORG, LAB_PROJECT_ID, AUTHOR_ID],
        },
        {
            text: `insert into submissions
                   (id, organization_id, edition_id, project_id, team_id, status, current_version, submitted_at)
                   values ($1, $2, $3, $4, $5, 'submitted', 1, now())`,
            values: [LAB_SUBMISSION_ID, ORG, FIXTURE.editionId, LAB_PROJECT_ID, LAB_TEAM_ID],
        },
        {
            text: `insert into submission_versions
                   (id, organization_id, submission_id, version, title, summary,
                    description_markdown, repository_url, created_by_user_id)
                   values ($1, $2, $3, 1, $4, 'Lab submission version one.',
                           'Initial judging lab submission.', 'https://example.com/judging-lab', $5)`,
            values: [LAB_VERSION_ID, ORG, LAB_SUBMISSION_ID, FIXTURE.labProjectTitle, AUTHOR_ID],
        },
        {
            text: `insert into judging_rubrics (id, organization_id, edition_id, name, description)
                   values ($1, $2, $3, 'E2E Organizer Rubric',
                           'Rubric used by the organizer assignment workflow.')`,
            values: [ORGANIZER_RUBRIC_ID, ORG, FIXTURE.editionId],
        },
        {
            text: `insert into judging_criteria
                   (id, organization_id, rubric_id, name, description, max_score, weight, position)
                   values ('f4000000-0000-4000-8000-000000000011', $1, $2, 'Impact', '', 10, 50.00, 0),
                          ('f4000000-0000-4000-8000-000000000012', $1, $2, 'Craft', '', 10, 50.00, 1)`,
            values: [ORG, ORGANIZER_RUBRIC_ID],
        },
        {
            text: `insert into judging_rubrics (id, organization_id, edition_id, name, description)
                   values ($1, $2, $3, 'Judging Lab Rubric',
                           'Rubric used by the judge scoring workflow.')`,
            values: [LAB_RUBRIC_ID, ORG, FIXTURE.editionId],
        },
        {
            text: `insert into judging_criteria
                   (id, organization_id, rubric_id, name, description, max_score, weight, position)
                   values ('f4000000-0000-4000-8000-000000000021', $1, $2, 'Impact', 'Reach of the work.', 10, 50.00, 0),
                          ('f4000000-0000-4000-8000-000000000022', $1, $2, 'Craft', 'Quality of execution.', 10, 50.00, 1)`,
            values: [ORG, LAB_RUBRIC_ID],
        },
        {
            text: `insert into judge_assignments
                   (id, organization_id, edition_id, rubric_id, submission_id, judge_user_id,
                    status, assignment_note, due_at, assigned_by_user_id)
                   values ($1, $2, $3, $4, $5, $6, 'assigned', 'Score the lab project.',
                           now() + interval '7 days', $7)`,
            values: [
                LAB_ASSIGNMENT_ID,
                ORG,
                FIXTURE.editionId,
                LAB_RUBRIC_ID,
                LAB_SUBMISSION_ID,
                FIXTURE.judgeId,
                FIXTURE.organizerId,
            ],
        },
    ]);
}

async function seedOtherOrganization(): Promise<void> {
    await ownerQuery(
        `insert into organizations (id, name, slug, description)
         values ($1, $2, 'other-workspace', 'A second organization used for isolation checks.')`,
        [OTHER_ORG, FIXTURE.otherOrganizationName],
    );
    await ownerQuery(
        `insert into organization_settings (organization_id, public_showcase_enabled)
         values ($1, true)`,
        [OTHER_ORG],
    );
    await ownerQuery(
        `insert into organization_memberships (organization_id, user_id, role)
         values ($1, $2, 'owner')`,
        [OTHER_ORG, OTHER_USER_ID],
    );
    await ownerTenantBatch(OTHER_ORG, [
        {
            text: `insert into competition_series (id, organization_id, name, slug, description)
                   values ($1, $2, 'Other Series', 'other-series', 'Second organization series.')`,
            values: [OTHER_SERIES_ID, OTHER_ORG],
        },
        {
            text: `insert into competition_editions
                   (id, organization_id, series_id, name, slug, description, status, timezone,
                    team_min_size, team_max_size, published_at)
                   values ($1, $2, $3, 'Other Edition', 'other-edition',
                           'Second organization edition.', 'published', 'UTC', 1, 4, now())`,
            values: [OTHER_EDITION_ID, OTHER_ORG, OTHER_SERIES_ID],
        },
        {
            text: `insert into projects
                   (id, organization_id, edition_id, owner_user_id, title, slug, summary,
                    description_markdown, tags, status, published_at)
                   values ($1, $2, $3, $4, $5, 'other-organization-project',
                           'A project that belongs to the second organization.',
                           'Second organization fixture.', array['other'], 'published', now())`,
            values: [
                OTHER_PROJECT_ID,
                OTHER_ORG,
                OTHER_EDITION_ID,
                OTHER_USER_ID,
                FIXTURE.otherProjectTitle,
            ],
        },
        {
            text: `insert into project_members (organization_id, project_id, user_id, role)
                   values ($1, $2, $3, 'owner')`,
            values: [OTHER_ORG, OTHER_PROJECT_ID, OTHER_USER_ID],
        },
    ]);
}
