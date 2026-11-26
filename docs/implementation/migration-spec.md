# Legacy data migration specification

Status: specification for the nethack migration tooling. No production data migration has been executed. The tool has been exercised only with the synthetic fixture `docs/implementation/migration-fixture.json`.

This document is the contract between the old-platform operator, the migration operator, and the nethack engineering team. It describes what the tool accepts, what it writes, how it stays idempotent, how failures are handled, and what must be true before the old platform is retired.

## 1. Scope

In scope:

- Organizations and organization settings.
- Users and external identities.
- Organization memberships.
- Competition series, editions, and divisions.
- Registrations.
- Teams and team members.
- Participants derived from approved registrations and team membership.
- Projects and project members.
- Submissions and submission versions.
- Submission file metadata.
- A migration audit record per organization.

Out of scope:

- Password hashes, sessions, refresh tokens, API keys, and other credentials.
- Direct Microsoft Graph, Teams, SharePoint, OneDrive, or Outlook imports.
- Judging rubrics, assignments, evaluations, scores, and feedback.
- Voting rounds, ballots, votes, and vote integrity records.
- Announcements, notifications, invitations, email archives, and analytics.
- Historical application logs and audit logs.
- File bytes. The tool records metadata only; blob transfer is a separate controlled operation.
- Historical URL redirects. These are applied by deployment configuration, not by this tool.

The tool writes only the tables listed in section 6. It does not alter the schema, create tables, or run migrations.

## 2. Accepted source formats

### 2.1 JSON export

The only accepted migration input is a UTF-8 JSON document with:

```json
{
    "format": "nethack-legacy-export/1",
    "sourceSystem": "old-platform-name",
    "generatedAt": "2026-01-01T00:00:00.000Z",
    "users": [],
    "organizations": []
}
```

The authoritative schema is `scripts/legacy-migration/schema.ts`. Unknown fields are rejected. Missing required fields are rejected. Enum values are validated against the nethack database enums. Malformed timestamps, URLs, email addresses, UUIDs in the map file, and SHA-256 checksums are rejected.

A complete synthetic example is `docs/implementation/migration-fixture.json`. It contains no real people, organizations, projects, or files.

### 2.2 Other formats

- SQL schema dumps are accepted for audit and comparison, not as migration input. The operator must produce the JSON export through a reviewed transformation.
- CSV, spreadsheets, and ad hoc query results are not accepted directly. They must be converted into the JSON format and validated.
- File stores are not accepted as input. The operator must stage file bytes separately and provide a manifest rendered into the JSON export.
- Unknown `format` values are rejected. There is no best-effort mode.

### 2.3 Size and safety limits

The tool reads the entire export into memory and validates it with Zod. Large exports should be split by organization. Each organization transaction must fit within the database statement and transaction limits of the target environment. The operator must test the largest organization against staging before production.

## 3. Identity mapping

### 3.1 Stable key

The durable identity key is `(issuer, subject)`, matching `external_identities_issuer_subject_unique`. The issuer must be the issuer that nethack will validate at login. With Basis Auth, the subject is the Basis Auth `sub` and the issuer is the configured Basis Auth issuer.

### 3.2 Microsoft identifiers

Basis Auth is an OpenID Connect provider in front of Microsoft Entra ID. Nethack does not receive Microsoft tokens. A Microsoft tenant ID, object ID, user principal name, or email address is not automatically the Basis Auth `(issuer, subject)` pair.

If the old platform stored Microsoft identifiers, the operator must provide an approved mapping to Basis Auth `sub` values. The migration tool does not call Microsoft or Basis Auth to discover or create identities.

### 3.3 Email rules

- Email is profile data, not a foreign key.
- An email may be used to find candidates for manual review.
- An email must never cause a silent link between two accounts.
- Two exported users with the same email, case-insensitive, fail validation.
- A user with no identity fails validation.
- An identity already linked to a different user in the target database fails the organization transaction.
- If a new identity's email already belongs to a different target user, the database unique constraint fails the transaction. The operator must resolve the collision explicitly, mirroring the nethack login behavior that rejects email-based account linking.
- No passwords, password hashes, MFA secrets, sessions, or tokens are accepted or written.

### 3.4 Status and profile fields

- `active` and `disabled` map to `users.status`.
- Display name, email, locale, and timestamps are preserved.
- An existing user row is reused only when the deterministic user ID, display name, email (case-insensitive), and status match. Otherwise the transaction fails. The tool never overwrites a user profile.
- Identities are inserted with `email_at_login`, `created_at`, and `last_login_at`. Existing identity rows are verified, not modified.

## 4. Organization verification

Before migration, the operator must confirm for every organization:

- The legal or accountable organization name.
- The public name, slug, description, and website.
- At least one active owner membership, with evidence that the person is authorized to own the organization in nethack.
- Every organizer, judge, and participant membership and status.
- That the organization is not a duplicate of another organization.
- That no user is being moved into an organization without a documented relationship.

The planner enforces:

- Unique organization external IDs.
- Unique organization slugs.
- At least one active `owner` membership.
- Unique membership per user within an organization.
- Known user references.
- No cross-organization references in organization-owned rows.

The tool does not verify legal authority. That is a human approval step.

## 5. Entity mapping and order

Within each organization transaction, rows are inserted in dependency order:

1. `organizations`
2. `organization_settings`
3. `users` and `external_identities` (referenced users only; reused across organizations when they already exist)
4. `organization_memberships`
5. `competition_series`
6. `competition_editions`
7. `divisions`
8. `registrations`
9. `teams`
10. `team_members`
11. `participants` (derived)
12. `projects`
13. `project_members`
14. `submissions`
15. `submission_versions`
16. `submission_files` (metadata)
17. `audit_logs` (one `legacy.migration.applied` record)

### 5.1 Users and identities

Global rows. The planner maps `users[].externalId` to a deterministic user UUID. Each identity maps `(issuer, subject)` to the global identity UUID. A user must have at least one identity. Users not referenced by any migrated organization are reported as warnings and are not written, because global users are written inside organization transactions.

### 5.2 Organizations and memberships

`organizations[].externalId` maps to the organization UUID. Settings default to the schema defaults when omitted. Memberships map the exported role and status to the database enums.

### 5.3 Series, editions, and divisions

Series and editions keep names, slugs, descriptions, status, time zone, dates, team-size limits, participant limit, rules text, and publication time. Divisions keep names, slugs, descriptions, and team-size limits. Edition slugs are unique per organization; division slugs are unique per edition.

Milestones are not part of the v1 export. If historical schedules must be preserved, add a milestone section to the export and extend the planner before running production.

### 5.4 Registrations

Registrations map edition, user, optional division, status, note, creation and decision times. The unique key is `(edition, user)`. A division must belong to the registration edition.

### 5.5 Teams and participants

Teams map edition, optional division, name, description, status, captain, maximum members, and timestamps. Team names are unique per edition. Exactly one member must have the `captain` role and must be the declared captain.

Participants are derived, not exported separately:

- Every registration with status `approved` produces one participant.
- The participant's team is the team the user belongs to in that edition.
- The participant's division is the registration division.
- A user in more than one team in the same edition makes participant assignment ambiguous and fails validation.
- A team member without an approved registration is migrated as a team member but produces no participant record and a warning.

### 5.6 Projects

Projects map edition, optional team, owner, title, slug, summary, description, repository URL, demo URL, tags, status, publication time, and timestamps. Project slugs are unique per organization. The owner must exist; if the owner is not listed in `members`, the planner derives an owner membership and reports a warning. A project team must belong to the same edition.

### 5.7 Submissions and versions

The database allows one submission per project. A submission maps project, optional team, status, submitted time, review note, and timestamps. Team must match the project team when both are present. Versions keep the version number, title, summary, description, repository URL, demo URL, author, and creation time. Version numbers are unique per submission. `currentVersion` is the highest imported version.

A non-draft submission requires at least one version and `submittedAt`. A draft submission must not have `submittedAt`.

### 5.8 Files

Only metadata is written:

- `fileName`, `contentType`, `byteSize`, `checksumSha256`, `storageKey`
- project, optional submission and version
- uploader, timestamps, status, rejection reason

File bytes are not copied. The operator must stage the blob under the same `storageKey` in the target store and verify the SHA-256 checksum. Until that is done, the file must remain `quarantined` or `scanning`. The tool warns when a file is marked `approved` without `inspectedAt`, but it cannot verify the blob.

`storageKey` is globally unique. Duplicate keys fail validation.

### 5.9 Audit record

Each committed organization writes one `audit_logs` row:

- `action`: `legacy.migration.applied`
- `entity_type`: `organization`
- `entity_id`: the new organization UUID
- `metadata`: source system, input SHA-256, export generation time, organization external ID, and per-entity counts

The audit row does not replace the operator's migration record or the mapping file.

## 6. Tables written

The apply adapter writes only:

```
organizations
organization_settings
users
external_identities
organization_memberships
competition_series
competition_editions
divisions
registrations
teams
team_members
participants
projects
project_members
submissions
submission_versions
submission_files
audit_logs
```

No other table is written. In particular, the tool never writes sessions, auth transactions, revoked tokens, backchannel data, global administrators, idempotency keys, outbox events, jobs, invitations, milestones, judging, voting, announcements, notifications, or schema migrations.

## 7. Idempotency and the mapping file

### 7.1 Deterministic UUIDs

Every exported entity external ID maps to a UUID derived from:

```
SHA-1( fixed namespace, entity kind, organization scope or "global", external ID )
```

The digest is formatted as a UUID with version and variant bits set. The result is stable across runs and machines. It is not a random UUID. This is UUIDv5 (SHA-1) used as an identifier derivation, not as a security primitive.

This makes duplicate rows visible through primary keys and unique constraints. It does not authorize overwriting existing rows.

### 7.2 Mapping file

`--apply` requires `--map <path>`. The map file is JSON:

```json
{
    "format": "nethack-legacy-migration-map/1",
    "sourceSystem": "old-platform-name",
    "inputSha256": "64 hex characters",
    "updatedAt": "2026-01-01T00:00:00.000Z",
    "appliedOrganizations": ["organization-external-id"],
    "ids": {
        "organization:organization-external-id": "uuid"
    }
}
```

The map:

- Records every external ID to UUID mapping for audit and review.
- Records which organizations committed.
- Is written after each successful organization transaction, using an atomic temporary-file rename.
- Is rejected if its `sourceSystem` or `inputSha256` does not match the current export.
- Is skipped for organizations already listed in `appliedOrganizations`, after verifying that the organization row exists in the target.

The map is not proof that every child row exists. It is a resume and audit artifact. If the target database is reset, discard the map and start a new one.

### 7.3 Re-running

- Same export and same map: organizations listed as applied are skipped; no rows are written for them.
- Same export and a map missing some organizations: those organizations are applied; completed organizations are skipped.
- Same export without a map: apply is refused because `--map` is required.
- Changed export with an old map: refused because `inputSha256` differs.
- Existing rows with conflicting content: the organization transaction fails and rolls back.

## 8. Modes, guards, and credentials

The CLI runs under Bun or Node.js 24 and later. Examples use `bun`.

### 8.1 Dry run

`--dry-run`:

- Reads and validates the export.
- Applies the optional map and reports already-applied organizations.
- Prints counts, warnings, source system, generation time, and input SHA-256.
- Performs no database writes.
- Does not require `DATABASE_MIGRATION_URL`.

Dry run does not inspect the target database for conflicts. Run it against an empty staging database or a restored copy when target-state validation is required.

### 8.2 Apply

`--apply`:

- Requires `--map`.
- Requires `DATABASE_MIGRATION_URL` with owner or migration credentials.
- Never reads `DATABASE_URL`.
- Never logs the connection string, password, or token.
- Applies one transaction per organization.
- Writes the map after each commit.
- Exits nonzero if validation, conflict detection, or a database operation fails.

### 8.3 Production guard

When `NODE_ENV=production`, both flags are required:

```
--allow-production --confirm MIGRATE_LEGACY_DATA
```

The guard applies to dry run and apply. Without both flags the tool refuses to run. The confirmation string is a constant, not a user-supplied environment value.

### 8.4 Database role

Use an owner or migration role that can write the listed tables and set the transaction-local tenant context. Do not use the runtime application role for migration. Do not grant `BYPASSRLS` to the runtime role. Do not place the migration credential in the workspace, the public site, or client JavaScript.

### 8.5 Exit codes

| Code | Meaning                                                                          |
| ---- | -------------------------------------------------------------------------------- |
| 0    | Dry run succeeded, or every organization transaction committed or was skipped    |
| 1    | Invalid input, guard failure, conflict, missing configuration, or database error |

## 9. Transaction and failure semantics

- Each organization is one PostgreSQL transaction.
- The transaction starts with: `select set_config('nethack.organization_id', $1, true), set_config('nethack.user_id', '', true)`.
- The setting is transaction-local and cannot leak through a pooled connection.
- Any insert failure rolls back the entire organization, including global users inserted by that organization transaction.
- Prior organizations remain committed. The map lists only committed organizations.
- The tool never deletes or updates existing rows to force a migration through.
- There is no automatic destructive rollback of committed organizations.
- A failed run is resumed with the same map after the conflict is resolved.
- If the target itself must be rolled back, restore from the verified backup and start with a new map.

## 10. Pre-migration validation queries

Run these read-only checks against the staging target before and after apply. Replace `$1` with the organization UUID and `$2` with the organization external ID where needed.

### 10.1 Organization and ownership

```sql
select id, name, slug, description, website_url
from organizations
where slug = $1;

select role, status, count(*)
from organization_memberships
where organization_id = $1
group by role, status
order by role, status;

select count(*) as active_owners
from organization_memberships
where organization_id = $1
  and role = 'owner'
  and status = 'active';
```

Requirement: exactly one organization row for the slug, and at least one active owner.

### 10.2 Identity uniqueness and coverage

```sql
select issuer, subject, count(*)
from external_identities
group by issuer, subject
having count(*) > 1;

select u.id, u.display_name
from users u
left join external_identities i on i.user_id = u.id
where i.id is null;

select lower(email), count(*)
from users
where email is not null
group by lower(email)
having count(*) > 1;
```

Requirements: no duplicate `(issuer, subject)`, every migrated user has an identity, and no duplicate non-null email.

### 10.3 Organization-scoped counts

```sql
select 'memberships' as entity, count(*) from organization_memberships where organization_id = $1
union all select 'series', count(*) from competition_series where organization_id = $1
union all select 'editions', count(*) from competition_editions where organization_id = $1
union all select 'divisions', count(*) from divisions where organization_id = $1
union all select 'registrations', count(*) from registrations where organization_id = $1
union all select 'teams', count(*) from teams where organization_id = $1
union all select 'team_members', count(*) from team_members where organization_id = $1
union all select 'participants', count(*) from participants where organization_id = $1
union all select 'projects', count(*) from projects where organization_id = $1
union all select 'project_members', count(*) from project_members where organization_id = $1
union all select 'submissions', count(*) from submissions where organization_id = $1
union all select 'submission_versions', count(*) from submission_versions where organization_id = $1
union all select 'submission_files', count(*) from submission_files where organization_id = $1;
```

Compare each count with the dry-run report and the map file.

### 10.4 Cross-organization references

```sql
select r.id
from registrations r
join competition_editions e on e.id = r.edition_id
where r.organization_id <> e.organization_id;

select p.id
from projects p
join competition_editions e on e.id = p.edition_id
where p.organization_id <> e.organization_id;

select s.id
from submissions s
join projects p on p.id = s.project_id
where s.organization_id <> p.organization_id
   or s.edition_id <> p.edition_id;

select f.id
from submission_files f
join projects p on p.id = f.project_id
where f.organization_id <> p.organization_id;
```

Requirements: zero rows. Composite foreign keys should already enforce this; the queries are an independent check.

### 10.5 Submissions and versions

```sql
select s.id, s.status, s.current_version,
       count(v.id) as versions,
       max(v.version) as highest_version,
       s.submitted_at
from submissions s
left join submission_versions v on v.submission_id = s.id
where s.organization_id = $1
group by s.id
having (s.status <> 'draft' and (count(v.id) = 0 or s.submitted_at is null))
    or (s.status = 'draft' and s.submitted_at is not null)
    or s.current_version <> coalesce(max(v.version), 0);

select submission_id, version, count(*)
from submission_versions
where organization_id = $1
group by submission_id, version
having count(*) > 1;
```

Requirements: zero rows.

### 10.6 File metadata

```sql
select storage_key, count(*)
from submission_files
where organization_id = $1
group by storage_key
having count(*) > 1;

select id, storage_key, checksum_sha256, status, inspected_at
from submission_files
where organization_id = $1
  and status = 'approved'
  and inspected_at is null;
```

Requirements: no duplicate storage keys; no approved file without inspection time. Blob checksum verification is separate.

### 10.7 Published showcase consistency

```sql
select p.id, p.slug, p.status, p.published_at
from projects p
join competition_editions e on e.id = p.edition_id
where p.organization_id = $1
  and p.status = 'published'
  and (p.published_at is null or e.status = 'draft');

select e.id, e.slug, e.status, e.published_at
from competition_editions e
where e.organization_id = $1
  and e.status <> 'draft'
  and e.published_at is null;
```

Requirements: decide explicitly whether a published project in a draft edition is acceptable. The default expectation is zero rows.

### 10.8 Audit evidence

```sql
select id, action, entity_id, metadata, created_at
from audit_logs
where organization_id = $1
  and action = 'legacy.migration.applied'
order by created_at desc;
```

Requirement: one row per committed organization with the expected input hash and counts.

### 10.9 Tenant context and RLS

Run as a non-owner role with the transaction-local context set to the organization, then confirm:

- The organization's rows are visible.
- Another organization's private rows are not visible.
- Clearing the context returns no private rows.
- A pooled connection does not retain the previous organization's context.

## 11. Acceptance checks

An organization is accepted only when all of the following are true:

- Dry run completed with no validation errors.
- The map input SHA-256 matches the approved export.
- Apply committed the organization and wrote the map entry.
- Counts match the approved dry-run report and the source reconciliation.
- Every migrated user has at least one identity and at most one identity per issuer.
- Every organization has at least one active owner.
- Every registration references a valid edition and user.
- Every team has exactly one captain and only same-edition members.
- Every project has an owner, a valid edition, and a same-edition team when set.
- Every submission belongs to one project and has a valid version set.
- Every file metadata row points to a staged storage key and checksum.
- No cross-organization references are present.
- The public site renders the expected published competitions and projects.
- A test user can sign in through Basis Auth and sees the correct organization and role.
- A user from another organization cannot read the migrated organization's private data through the API.
- File downloads work only after blob staging, checksum verification, and scan.
- URL redirects resolve old public links without loops or collisions.
- Backup and restore of the target reproduce the accepted state.
- The operator signs the acceptance record.

## 12. Abort and rollback rules

Abort immediately when:

- The export format or schema version is unknown.
- Validation reports any issue.
- The map belongs to different input.
- A production guard is missing.
- The database URL is missing or malformed.
- Any organization transaction fails.
- A mapping or identity collision cannot be resolved without a human decision.
- A file checksum or blob is missing at acceptance time.

On abort:

- The failing organization transaction rolls back.
- Prior committed organizations remain.
- The map contains only committed organizations.
- Do not edit the database manually to make counts pass.
- Do not reuse a map after restoring the database.
- Record the failure, the organization external ID, the database error, and the operator decision.

Rollback options, in order:

1. Fix the export or target conflict and resume with the same map.
2. Restore the target from the pre-migration backup and start with a new map.
3. Apply a forward corrective migration with a documented review.

There is no automatic `DELETE` rollback. Deleting migrated rows could violate foreign keys, erase audit evidence, or destroy data that users have already started using.

## 13. Operator runbook

1. Freeze changes on the old platform or establish a read-only export window.
2. Export the schema, data dictionary, users, organizations, competitions, teams, projects, submissions, files metadata, and URL map.
3. Sanitize the staging export and remove credentials, tokens, and unnecessary personal data.
4. Convert the export to `nethack-legacy-export/1`.
5. Run `bun scripts/migrate-legacy.ts --input <file> --dry-run --map <map>`.
6. Review every warning and validation issue with the operator.
7. Restore a production-like staging database and run the apply path.
8. Execute the validation queries and acceptance checks.
9. Verify Basis Auth login for representative users.
10. Stage file blobs, verify checksums, scan, and update file status through the approved operational process.
11. Verify public pages, redirects, and cross-organization authorization.
12. Back up the production target and record the restore test.
13. Run production apply with the guard flags.
14. Repeat validation and acceptance checks against production.
15. Monitor errors, login failures, and public 404/500 rates.
16. Make the old platform read-only; retain it until the retirement criteria are met.
17. Retire the old platform only after legal, security, and product sign-off.

## 14. Known limitations

- The apply path has been exercised against a disposable local PostgreSQL database under Bun and Node.js 24 with the synthetic fixture. It has not been exercised against real old-platform data, staging, or production.
- The export format is version 1 and does not include milestones, judging, voting, announcements, notifications, invitations, or historical audits.
- File bytes are not migrated. Metadata without staged blobs is incomplete.
- The tool cannot verify organization ownership, legal retention, or consent.
- The tool cannot discover Basis Auth identities or call Microsoft.
- Deterministic UUIDs are stable but not meaningful. The map file is the human-readable record.
- The map is trusted for skip decisions after a row-existence check. It does not prove that every child row still exists.
- Dry run does not detect target conflicts. Use a restored staging copy for target-state validation.
- The tool does not run schema migrations. The target schema must already be current.
- The tool does not send notifications, emails, or webhooks.

## 15. Change control

Any change to the export format, mapping rules, table list, identity rules, or idempotency behavior requires:

- A new export format version or an explicit compatibility decision.
- Updated Zod schemas and planner tests.
- Updated validation queries.
- A new dry run and staging apply.
- Operator approval before production.
