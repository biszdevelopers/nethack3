# Data ownership

Table ownership, organization isolation, transaction rules, and migration policy for the nethack3 PostgreSQL database.

## Database boundary

- PostgreSQL is the application database.
- PostgreSQL 14 or newer is the minimum supported version.
- Drizzle ORM and Drizzle migrations are the only persistence layer.
- The nethack database is separate from the Basis Auth database, with separate credentials.
- Nethack must never query or modify Basis Auth internal tables.
- The two databases may share a PostgreSQL server initially, but not a database or a role.
- Runtime credentials and migration credentials are separate.
- The runtime role is not the table owner and does not have `BYPASSRLS`.

## Ownership rule

Each table is owned by exactly one capability. Ownership means the capability defines the table, writes it, and exposes any required read or write behavior through its public contract.

| Capability       | Owned tables                                                              |
| ---------------- | ------------------------------------------------------------------------- |
| `identity`       | `users`, `external_identities`                                            |
| `organizations`  | `organizations`, `organization_memberships`                               |
| `competitions`   | `competition_series`, `competition_editions`, `divisions`                 |
| `participants`   | `registrations`, `participants`                                           |
| `teams`          | `teams`, `team_members`, `team_invitations`                               |
| `projects`       | `projects`, `project_members`                                             |
| `submissions`    | `submissions`, `submission_versions`, `submission_files`                  |
| `judging`        | `judging_rubrics`, `judging_criteria`, `judge_assignments`, `evaluations` |
| `voting`         | `voting_rounds`, `ballots`, `votes`                                       |
| `announcements`  | `announcements`                                                           |
| `notifications`  | `notifications`                                                           |
| `administration` | `audit_logs`                                                              |
| `files`          | File records, upload state, scan status, and storage object metadata      |

Infrastructure-owned tables:

| Owner | Tables |
| --- | --- |
| Authentication | Session records, authentication transactions, access-token revocation entries |
| Core | Transactional outbox, consumer deduplication, idempotency records, background job leases |

Authentication-owned tables are not part of the identity capability. The identity capability owns the durable user record and external identity links; the authentication runtime owns protocol state and sessions.

The exact relational structure must be validated against the audited old platform and actual workflows before it is treated as final. This mapping defines ownership, not a frozen column list.

## Organization hierarchy

```
organization
  `-- competition series
        `-- competition edition
              |-- division
              |-- registration
              |     `-- participant
              |-- team
              |     `-- project
              |           `-- submission
              |                 |-- judging
              |                 `-- voting
              `-- announcement
```

- An organization can manage multiple series.
- A series can have multiple editions.
- A participant can belong to multiple organizations and competitions.
- Do not assume one annual competition or one organizational owner.
- Every record in the hierarchy carries the organization scope required by its ownership rules.

## Cross-capability references

- A capability may store a foreign key to another capability's table when referential integrity requires it.
- A foreign key grants no permission to read or write the referenced table.
- Application queries do not join across capability-owned tables.
- To read another capability's data, use its public contract or an event-maintained projection owned by the reading capability.
- A projection stores only what the consumer needs and records the source event identifier for idempotency.
- A shared view may be created only when a documented query cannot be served efficiently through contracts or projections. The view has a named owner and an explicit public contract.

## Organization scope

Every organization-owned record carries a non-null `organization_id`.

Rules:

- Organization-owned tables include `organization_id` as the first column of relevant indexes.
- Unique constraints are organization-scoped unless uniqueness is intentionally global.
- Foreign keys that cross resources use composite keys including `organization_id` where practical, so a team cannot reference a participant in another organization.
- Every query on organization-owned data includes the organization predicate.
- The organization predicate comes from the authenticated context after membership verification, not from an unvalidated request field.
- A missing organization context fails closed.
- Cross-organization access is tested as a negative path for every protected resource.

## Row-level security

PostgreSQL Row-Level Security is an additional layer, never a substitute for API authorization.

When RLS is enabled:

- Set tenant context transaction-locally with `SET LOCAL`.
- Use a non-owner application role.
- Do not grant `BYPASSRLS`.
- Use `FORCE ROW LEVEL SECURITY` where appropriate.
- Policies read the transaction-local organization identifier and deny when it is absent.
- The runtime role has only the privileges it needs on each table.
- Migrations run with a separate owner or migration role.
- Connection pooling must not leak tenant context between borrowers. Context is reset on acquire and release, and a pooled connection never carries a prior tenant.
- Tests verify pool isolation under concurrent requests.
- A missing or malformed tenant context denies access rather than returning all rows.

RLS does not replace checks for user identity, membership, resource ownership, operation permission, competition eligibility, or assignment.

## Authorization data

Authorization requires all applicable checks:

1. Authenticated user identity.
2. Organization context.
3. Resource organization.
4. Membership.
5. Requested operation permission.
6. Competition eligibility.
7. Assignment or ownership rule.

Local tables maintain organizations, memberships, competition roles, team memberships, judge assignments, and administrative privileges. Basis Auth permissions may complement these checks but never replace organization-specific resource checks.

Administrative privileges are explicitly scoped. A user who administers one organization does not automatically administer another. Global administrative privileges are rare, separately granted, and audited.

## Identity data

- The durable external identity reference is the pair `(issuer, subject)` from Basis Auth.
- Email is profile data and may change. It is not a durable foreign key and is not used for automatic account linking.
- Account linking follows an explicit policy and never silently links an existing account by email alone.
- `users` stores the local account state; `external_identities` stores issuer and subject links.
- Disabled accounts and token validity barriers are enforced at authentication and authorization boundaries.

## Sensitive data

| Class | Examples | Handling |
| --- | --- | --- |
| Public | Published competition pages, published projects | May be cached publicly with an explicit policy |
| Internal | Draft state, operational metadata | Authenticated access; not publicly cached |
| Personal | Names, email addresses, memberships, evaluations | Least privilege, organization scope, no unnecessary logging |
| Secret | Tokens, secrets, session identifiers, encryption keys | Never stored in plaintext where a hash or encryption is required |

Additional rules:

- Access tokens and refresh tokens are stored server-side only. Refresh tokens are encrypted with AES-256-GCM.
- Session identifiers are stored as SHA-256 hashes.
- Passwords are never stored by nethack; authentication is delegated to Basis Auth.
- Logs exclude tokens, cookies, authorization codes, secrets, and raw file contents.
- Personal data is not copied into analytics or cache keys.
- Data exports require authorization and are audited.

## Transactions

- Application operations define transaction boundaries. Repositories do not commit independently.
- Multi-step writes run in one transaction.
- Business invariants are enforced by database constraints where possible, not only by application checks.
- Critical operations are idempotent: submissions, votes, invitations, file finalization, and external effects.
- Events are written to the outbox in the same transaction as the state change.
- A capability never opens a transaction that spans another capability's private tables.
- Contract calls that require atomicity are designed explicitly; otherwise the caller accepts separate transactions and eventual consistency.
- Deadlocks are prevented by consistent lock ordering and short transactions.
- Refresh rotation and other contended records use row locks as described in ADR-006.

## Files data

- The `files` capability owns file records, upload state, scan status, and storage metadata.
- Projects and submissions store file references, not storage paths.
- Object storage keys are generated by the API and never derived from user input.
- Original filenames are metadata and are escaped when displayed.
- Quarantine, inspection, and approved storage states are explicit.
- Download authorization is checked by the API on every request; a storage URL is not a permanent grant.

## Query rules

- Parameterized queries only. Never concatenate user input into SQL.
- Allowlist sort fields and filter operators.
- Do not accept user-controlled table names, column names, or SQL fragments.
- Index foreign keys and common organization-scoped filters.
- Use composite indexes for organization-scoped access.
- Avoid N+1 queries and unbounded result sets.
- Use cursor pagination with explicit ordering.
- Bound connection pools and statement timeouts.
- Inspect execution plans for new query shapes.
- Use indexes based on real query patterns, not every column.

## Migrations

- Drizzle migrations live under `database/`.
- Migrations run as a separate job with migration credentials.
- Destructive migrations are never run automatically on every API start.
- Use expand-and-contract for zero-downtime changes: add compatible structures, deploy code that uses them, backfill, then remove old structures.
- Migrations are forward-only in production. Rollback is a forward migration or a restore, with a documented procedure.
- Every migration is tested against a production-like schema and reviewed for lock duration, table rewrite, and index build cost.
- Seed data is development-only and cannot create fake production metrics.
- Backup, restore, and migration compatibility are verified before release.

## Caching

- The database is the system of record. Caches never own data.
- Authenticated responses use `Cache-Control: private, no-store`.
- No shared private cache crosses users or organizations.
- A cache key that includes private data includes the organization and user scope.
- Public caches contain public data only and are invalidated when published content changes.
- The tenant cache rules are recorded in ADR-008.

## Review checks

- Is every new table assigned to exactly one capability?
- Does every organization-owned row have `organization_id`, appropriate indexes, and scoped constraints?
- Is tenant context set transaction-locally and denied when absent?
- Are cross-capability reads through contracts or projections?
- Are queries parameterized, bounded, and organization-scoped?
- Are events written in the same transaction as the state change?
- Are migrations separate, reversible by forward migration, and safe under load?
- Is sensitive data minimized, encrypted, or hashed as required?
