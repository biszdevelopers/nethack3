# ADR-005: Organization-aware database

Decision record for tenant scope as a first-class database concern.

## Status

accepted.

## Context

Nethack supports multiple organizations, multiple competition series and editions, divisions, participants who belong to several organizations, and administrative privileges scoped to one organization. Retrofitting tenant scope after data exists creates ambiguous ownership, unsafe queries, and cross-organization leakage.

## Decision

Every organization-owned record carries a non-null `organization_id` from the first migration.

- Organization-scoped queries always include the organization predicate derived from the authenticated context after membership verification.
- Unique constraints and indexes are organization-scoped unless global uniqueness is intentional.
- Composite foreign keys include `organization_id` where practical, preventing references across organizations.
- PostgreSQL Row-Level Security is used as an additional layer where appropriate.
- RLS uses a transaction-local tenant context set with `SET LOCAL`, a non-owner application role, no `BYPASSRLS`, and `FORCE ROW LEVEL SECURITY` where appropriate.
- A missing tenant context fails closed and denies access.
- Runtime and migration credentials are separate. Migrations run as a separate job.
- Connection pooling resets tenant context on acquire and release, and pool isolation is tested under concurrency.
- RLS never replaces API authorization. Every protected request checks identity, organization context, resource organization, membership, operation permission, competition eligibility, and any assignment or ownership rule.
- Cross-capability runtime queries do not join another capability's tables. Data access goes through contracts or event-maintained projections.

## Consequences

- Every schema design and query must consider organization scope, which adds discipline but prevents a class of leaks.
- Tests must include cross-organization negative cases for every protected resource.
- RLS policies and connection-pool behavior require dedicated tests.
- Some cross-organization administrative reads require an explicit global permission and audit record.
- Migrations must be reviewed for tenant backfills and constraint validity on existing data.
