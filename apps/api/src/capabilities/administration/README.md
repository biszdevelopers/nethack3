# Administration capability

Owns platform and organization administration: global administrator grants, the cross-organization audit view, organization member role administration, edition team operating tools, standings export, preflight counts, the organization report summary, the anonymized database export, the read-only developer file browser, and the persisted operator AI chat. Global administrator privileges are a platform flag on a user account, never an organization role.

## Dependencies

- `identity` for authentication state resolved by `AuthGuard`.
- `organizations` for organization existence through `requireOrganization` on the organization routes and the report route.
- `competitions` (`competitions.v1`) for edition resolution.
- `participants` (`participants.v1`), `teams` (`teams.v1`), `projects` (`projects.v1`), `submissions` (`submissions.v1`), `judging` (`judging.v1`) for per-edition counts, team lists, submission lists, and judging results.
- `voting` (`voting.v1`) for the published-results flag in preflight.
- `files` (`files.v1`) for read-only stored-file metadata in the developer browser.
- Core services: database transactions, audit log, clock.

## Tables

Owned writes: `global_administrators`, `debug_ai_sessions`, `debug_ai_messages`.

Platform reads: `users` for global administrator display/grant lookup and audit actor display, `audit_logs` for audit pages, `global_administrators` for grants, and the `organizations` platform directory for the export and file browser organization list.

The database export deliberately reads tenant tables directly because it is a platform archive endpoint. Every tenant read runs inside one `REPEATABLE READ READ ONLY` transaction and sets `nethack.organization_id` per organization so row level security still applies. Administration does not write or import another capability's tables for normal operations.

Organization memberships are read and updated only through `organizations.v1`. Administration does not import `organization_memberships`. Team, submission, and judging data is reached only through their public contracts.

## Routes and permissions

Administrator routes never establish an organization context. Organization-scoped routes use the `X-Nethack-Organization-Id` header, or the explicit `:organizationId` path parameter where present.

| Method | Route | Permission |
| --- | --- | --- |
| GET | `/api/v1/admin/global-administrators` | Global administrator |
| POST | `/api/v1/admin/global-administrators` | Global administrator |
| DELETE | `/api/v1/admin/global-administrators/:userId` | Global administrator |
| GET | `/api/v1/admin/audit?organizationId=` | Global administrator |
| GET | `/api/v1/admin/audit/global` | Global administrator |
| GET | `/api/v1/organizations/:organizationId/reports` | Owner or organizer of that organization |
| GET | `/api/v1/organizations/:organizationId/administration/users` | Owner or organizer |
| PATCH | `/api/v1/organizations/:organizationId/administration/users/:userId` | Owner or organizer |
| GET | `/api/v1/administration/editions/:editionId/teams` | Owner or organizer |
| PATCH | `/api/v1/administration/editions/:editionId/teams/:teamId` | Owner or organizer |
| DELETE | `/api/v1/administration/editions/:editionId/teams/:teamId` | Owner or organizer |
| POST | `/api/v1/administration/editions/:editionId/submissions/:submissionId/reopen` | Owner or organizer |
| GET | `/api/v1/administration/editions/:editionId/preflight` | Owner or organizer |
| GET | `/api/v1/administration/editions/:editionId/standings.csv` | Owner or organizer |
| GET | `/api/v1/admin/database/export` | Global administrator |
| GET | `/api/v1/admin/debug/files` | Global administrator |
| GET | `/api/v1/admin/debug/references` | Global administrator |
| GET | `/api/v1/admin/debug/ai/status` | Global administrator |
| GET | `/api/v1/admin/debug/ai/sessions` | Global administrator |
| POST | `/api/v1/admin/debug/ai/sessions` | Global administrator |
| GET | `/api/v1/admin/debug/ai/sessions/:sessionId` | Global administrator |
| DELETE | `/api/v1/admin/debug/ai/sessions/:sessionId` | Global administrator |
| POST | `/api/v1/admin/debug/ai/sessions/:sessionId/messages` | Global administrator |

`GET /api/v1/admin/audit` requires `organizationId`; audit records are always organization-scoped. `GET /api/v1/admin/audit/global` accepts an optional `organizationId` plus `action`, `entityType`, `actorUserId`, `cursor`, and `limit` (1-100). Both pages are newest first and join `users` for `actorDisplayName`.

## Operator tools

### Database export

`GET /api/v1/admin/database/export` streams one JSON object with `formatVersion`, `generatedAt`, `omitted`, and these sections: organizations, competition series and editions, divisions, milestones, teams and team members, projects and project members, submissions and versions, file metadata, judging rubrics/criteria/assignments and per-submission judging aggregates, awards and team awards, published results snapshots, voting rounds and per-submission vote totals, and notification metadata.

The export omits judge identities and per-judge evaluation records, invitation tokens, session token hashes, CSRF hashes, encrypted OAuth access and refresh tokens, other authentication secrets, stored file contents and storage keys, notification recipients, bodies and deduplication keys, and individual evaluation rows and comments. The serializer also strips any forbidden key recursively in case a query later selects one.

Tenant tables are read organization by organization inside one repeatable-read, read-only transaction. The response is an attachment named `nethack-export-<date>.json` with `cache-control: private, no-store`.

### File browser

`GET /api/v1/admin/debug/files` and `GET /api/v1/admin/debug/references` return paginated file metadata with `limit` (1-100) and `offset`. References are files linked to a submission or submission version. The response contains file name, content type, byte size, SHA-256 checksum, status, organization, project, submission, and version identifiers. Storage keys, uploader identity, rejection notes, and contents are never returned.

### Operator AI chat

Configuration is read only from the API process environment: `OPENAI_API_KEY` enables the feature, `OPENAI_BASE_URL` defaults to `https://api.openai.com/v1`, and `OPENAI_MODEL` defaults to `gpt-4o-mini`. A request never supplies a URL, model, or credential. The provider call has a fixed 20-second timeout and no tools.

Without `OPENAI_API_KEY`, `/status` and the session list report `configured: false`; message sends return `503` with a clear not-configured message and never invent a reply. Sessions and messages belong to the authenticated global administrator. A message send persists the user message and the assistant reply together only after the provider returns a non-empty answer; provider failures return `502` and persist nothing.

## Rules

- Grant resolves the target account by email; an unknown email is `404 not found`. An existing grant is `409 conflict`, including a concurrent duplicate insert.
- Revoke returns `404 not found` when no grant exists. The last remaining global administrator cannot be revoked (`409 conflict`); the administrator rows are locked for the duration of the check so two concurrent revocations cannot remove the final pair.
- Global administrator privileges are separate from organization membership. `requireOrganization` only proves membership in the addressed organization, so holding administrator privileges never grants organization routes through this capability.
- Organization member roles are `owner`, `organizer`, `judge`, and `participant`. `organizations.v1` locks membership rows, reads the owner count, and enforces the last-owner rule (`409 conflict`). Member status is returned for display; this capability changes roles only.
- Judge is reported as the membership role `judge`; there is no separate platform judge flag.
- Team status moves among `forming`, `ready`, and `disbanded`; the write is owned by `teams.v1`. A team can be deleted only when it has no members and no submission. Administration checks the submission count through `submissions.v1` before asking `teams.v1` to delete the empty team.
- Reopen accepts `draft` (default) or `changes_requested`, and only for a submission currently in `submitted`; the transition and audit are owned by `submissions.v1`. Administration blocks the request when `judging.v1` reports a submitted evaluation. Moving to `draft` clears `submitted_at`; `changes_requested` retains it.
- Standings CSV columns are `rank`, `project`, `team`, `average_score`, `submitted`, `assignments`, and `awards` (reserved and empty until an awards capability exists). Scores use two decimals. Cells are quoted per RFC 4180 and leading spreadsheet formula characters are neutralized. The response is an attachment named `standings-<editionId>.csv`.
- Preflight counts teams, projects, submissions, assignments, submitted evaluations, and open judge flags through the public contracts. Readiness booleans are derived from those counts. `publishedResults` is true when a voting round for the edition is published.
- The report summary aggregates real counts from the public contracts for up to 50 editions per organization, ordered by `startsAt` descending with unscheduled editions last. Counts are fetched in parallel per edition. Contract failures propagate; no partial or invented numbers are returned.

## Boundaries

Teams, submissions, judging, and organization memberships are reached only through their public contracts. Administration imports no other capability's persistence module or table.

There are no remaining persistence bridges.

The cross-capability reopen guard reads `judging.v1`, then calls `submissions.v1`. The judging read and the submission write are separate transactions, so a fix belongs in the judging/submission contracts if an atomic guard becomes required.

## Audit

Organization membership role changes are audited by `organizations.v1` as `organization.membership.updated`.

Platform-scoped audited actions, always with `organizationId` null, the acting administrator as actor, and the target user as entity:

- `administration.global_administrator.granted` with `{ reason }`
- `administration.global_administrator.revoked` with `{ reason }`

Team status, team deletion, and submission reopen audit rows are written by the teams and submissions capabilities.

No domain events or jobs are published.

## Tests

- `tests/administration-rules.test.ts` covers the last-administrator rule, organizer role guards, and the submitted-evaluation reopen guard.
- `tests/edition-administration-service.test.ts` covers team/member/submission composition and contract delegation for status changes, deletion, and reopening, including the blocking cases.
- `tests/preflight-service.test.ts` covers count aggregation, readiness, open flags, published results, and missing editions with mocked contracts.
- `tests/standings-csv.test.ts` covers CSV quoting, formula neutralization, numeric formatting, and empty ranks/scores.
- `tests/report-summary.test.ts` covers the report aggregation shape, edition ordering, and the 50-edition bound with mocked contracts. No database is required.
- `tests/database-export.test.ts` covers archive parsing, recursive omission of judge/token/file/notification secrets, and rollback when a read fails. No database is required.
- `tests/debug-ai-service.test.ts` covers the not-configured status and the `503` send path without any provider or repository call. No database is required.

## Extraction

The folder depends on other capabilities only through their public contract types and constants, and on Core interfaces. To extract it, move `apps/api/src/capabilities/administration` to a package, keep the route paths and audit action names stable, and provide the same Core interfaces.
