# Competitions capability

Owns competition series, competition editions, divisions, and the edition schedule (`milestones`). It defines what a competition is, when it runs, how teams are sized, and which divisions exist. Registrations, participants, teams, projects, submissions, judging, and voting belong to other capabilities.

## Dependencies

- `organizations` (`organizations.v1`) for organization summaries and public showcase settings.
- Core services: database transactions, clock, audit log, transactional outbox.

## Public contracts

`competitions.v1` (`COMPETITIONS_CONTRACT`):

| Method | Behavior |
| --- | --- |
| `getEdition(organizationId, editionId)` | Edition summary including its series name. Runs in a transaction scoped to `organizationId` so row-level security exposes drafts. |
| `getDivision(organizationId, divisionId)` | Division summary. Runs in an organization-scoped transaction. |
| `isPublicEdition(editionId)` | True when the edition is visible through the public RLS predicate. Called without tenant context. |

## Tables

Owned writes: `competition_series`, `competition_editions`, `divisions`, `milestones`.

Read-only counts used by the edition detail response: `registrations`, `teams`, `submissions`, always scoped by `organization_id` and `edition_id` inside an organization transaction. Public detail reads published `projects` and `teams` through the RLS public predicates; it does not bypass row-level security. The public organization route resolves the slug against `organizations` and then uses `organizations.v1` for the summary and showcase decision.

## Routes and permissions

All routes require authentication unless listed as public. `x-nethack-organization-id` establishes the organization context for routes whose path has no organization id.

| Method | Route | Permission |
| --- | --- | --- |
| GET | `/api/v1/organizations/:organizationId/competitions` | Active organization member |
| POST | `/api/v1/organizations/:organizationId/competitions` | Owner or organizer |
| POST | `/api/v1/organizations/:organizationId/competitions/:seriesId/editions` | Owner or organizer |
| GET | `/api/v1/competitions/:editionId` | Active organization member |
| PATCH | `/api/v1/competitions/:editionId` | Owner or organizer |
| POST | `/api/v1/competitions/:editionId/publish` | Owner or organizer |
| GET | `/api/v1/competitions/:editionId/divisions` | Active organization member |
| POST | `/api/v1/competitions/:editionId/divisions` | Owner or organizer |
| GET | `/api/v1/competitions/:editionId/milestones` | Active organization member |
| POST | `/api/v1/competitions/:editionId/milestones` | Owner or organizer |
| GET | `/api/v1/public/competitions` | Public, cacheable |
| GET | `/api/v1/public/competitions/:slug` | Public, cacheable |
| GET | `/api/v1/public/organizations/:slug` | Public, cacheable |

## Rules

- Edition status transitions are allowlisted: `draft -> published`, `published -> registration_open | archived`, `registration_open -> registration_closed | archived`, `registration_closed -> active | archived`, `active -> judging | completed | archived`, `judging -> voting | completed | archived`, `voting -> completed | archived`, `completed -> archived`. Anything else is a conflict.
- `POST /publish` and a status change to `published` are allowed from `draft` only. Publishing sets `publishedAt` and emits `competitions.edition.published`.
- Team size bounds (`teamMinSize <= teamMaxSize`) and date ordering are validated on create and on update using the merged edition state.
- Series and edition slugs are unique per organization; divisions are unique per edition. PostgreSQL `23505` violations become `409 conflict`.
- Edition detail counts are real row counts. Missing rows produce `0`.
- Divisions are ordered by name, milestones by occurrence time.
- Public listing and detail query without tenant context; the RLS public predicates hide drafts and non-showcased projects. Edition slugs are unique per organization, so the global public slug lookup returns the most recently published visible edition when the same slug exists in more than one organization.
- Public organization pages require `organization_settings.public_showcase_enabled`.

## Audit and events

Audited organizer mutations:

- `competition.series.created`
- `competition.edition.created`
- `competition.edition.updated`
- `competition.edition.published`
- `competition.division.created`
- `competition.milestone.created`

Published event: `competitions.edition.published` with `{ editionId, organizationId, actorUserId, name, slug, publishedAt }`.

## Tests

`tests/competition-rules.test.ts` covers every allowed and forbidden status transition, publish eligibility, team-size bounds, and date ordering. The tests are pure and do not require a database.

## Extraction

The folder depends on organizations only through `organizations.v1` and on Core interfaces for transactions, clock, audit, and events. To extract it, move `apps/api/src/capabilities/competitions` to a package, keep the contract and event names stable, and provide the same Core interfaces. No other capability imports its domain, application, infrastructure, or HTTP files.
