# Administration capability

Owns platform-level administration: the global administrator grant, the cross-organization audit view, and the organization report summary. Global administrator privileges are a platform flag on a user account, never an organization role.

## Dependencies

- `identity` for authentication state resolved by `AuthGuard`.
- `organizations` for organization existence through `requireOrganization` on the report route.
- `competitions` (`competitions.v1`) for the organization's editions.
- `participants` (`participants.v1`), `teams` (`teams.v1`), `projects` (`projects.v1`), `submissions` (`submissions.v1`), `judging` (`judging.v1`) for per-edition counts.
- Core services: database transactions, audit log, clock.

## Tables

Owned writes: `global_administrators`.

Platform reads: `users` for display name and email resolution, `audit_logs` for the cross-organization audit page, `global_administrators` for reads.

## Routes and permissions

Administrator routes never establish an organization context. Only the report route calls `requireOrganization`.

| Method | Route | Permission |
| --- | --- | --- |
| GET | `/api/v1/admin/global-administrators` | Global administrator |
| POST | `/api/v1/admin/global-administrators` | Global administrator |
| DELETE | `/api/v1/admin/global-administrators/:userId` | Global administrator |
| GET | `/api/v1/admin/audit?organizationId=` | Global administrator |
| GET | `/api/v1/organizations/:organizationId/reports` | Owner or organizer of that organization |

`GET /api/v1/admin/audit` requires `organizationId`; audit records are always organization-scoped. It supports `cursor`, `limit`, `action`, `entityType`, and `actorUserId` filters, newest first, and joins `users` for `actorDisplayName`.

## Rules

- Grant resolves the target account by email; an unknown email is `404 not found`. An existing grant is `409 conflict`, including a concurrent duplicate insert.
- Revoke returns `404 not found` when no grant exists. The last remaining global administrator cannot be revoked (`409 conflict`); the administrator rows are locked for the duration of the check so two concurrent revocations cannot remove the final pair.
- Global administrator privileges are separate from organization membership. `requireOrganization` only proves membership in the addressed organization, so holding administrator privileges never grants organization routes through this capability.
- The report summary aggregates real counts from the public contracts for up to 50 editions per organization, ordered by `startsAt` descending with unscheduled editions last. Counts are fetched in parallel per edition. Contract failures propagate; no partial or invented numbers are returned.

## Audit

Audited actions, always with `organizationId` null, the acting administrator as actor, and the target user as entity:

- `administration.global_administrator.granted` with `{ reason }`
- `administration.global_administrator.revoked` with `{ reason }`

No domain events or jobs are published.

## Tests

- `tests/administration-rules.test.ts` covers the last-administrator rule.
- `tests/report-summary.test.ts` covers the report aggregation shape, edition ordering, and the 50-edition bound with mocked contracts. No database is required.

## Extraction

The folder depends on other capabilities only through their public contract types and constants, and on Core interfaces. To extract it, move `apps/api/src/capabilities/administration` to a package, keep the route paths and audit action names stable, and provide the same Core interfaces.
