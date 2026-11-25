# Tenant isolation

Status: database and API isolation specification. This document defines the
required controls. It does not assert that RLS, roles, policies, or tests are
implemented. Verification must be executed as described in section 8.

## 1. Tenant model

An organization is the tenant. Every organization-owned record must have an
explicit, non-null organization scope. There is no implicit tenant and no
"current organization" derived from an unverified request value.

Tenant-owned data includes, at minimum:

- Organization settings, memberships, and invitations.
- Competition series, editions, divisions, milestones, and rules.
- Registrations, participants, eligibility decisions, and divisions.
- Teams, team members, and team invitations.
- Projects, project members, and project links.
- Submissions, submission versions, and submission files.
- Rubrics, criteria, judge assignments, evaluations, and scores.
- Voting rounds, ballots, votes, and results.
- Announcements, notifications, reports, exports, and audit records that
  belong to an organization.
- Files and file metadata that belong to an organization-owned resource.

Global records, such as the user directory, external identity links, sessions,
and authentication transactions, are not tenant tables. They are accessed
through the identity capability with narrowly scoped queries. They must never be
used to bypass organization authorization.

## 2. Layered controls

Tenant isolation is not one control. It is a set of layers:

1. **API authorization**: the six-step check in
   `docs/security/authorization.md` is the primary control.
2. **Organization-scoped repositories**: every tenant query requires an
   organization identifier and includes it in the predicate.
3. **Composite keys and foreign keys**: the database prevents a child row from
   referencing a parent in another organization.
4. **PostgreSQL row-level security**: a defense-in-depth layer that denies rows
   outside the transaction's organization context.
5. **Storage and cache partitioning**: file prefixes, signed URLs, cache keys,
   and exports carry the organization scope.
6. **Worker and job context**: background jobs and outbox events carry the
   organization and set the database context before touching tenant data.
7. **Testing and review**: cross-organization tests, pool-isolation tests,
   catalog checks, and a new-table checklist.

RLS is not a substitute for API authorization. A request that reaches the
database with the wrong organization context must still be denied by the API
before the query runs. RLS limits the damage of a missing predicate; it does not
make an authorization bug harmless.

## 3. Schema requirements

### 3.1 Organization column

- Every tenant table has `organization_id uuid NOT NULL`.
- The column references `organizations(id)`.
- The column is never nullable for tenant data. A nullable organization column
  is a design defect unless the table is explicitly a platform table and is
  excluded from the tenant data path.
- The organization identifier is immutable after insert. Do not provide an
  update path that changes it.
- Every tenant query includes `organization_id = $organizationId`, even when
  RLS is active. This is required for correctness, index use, and defense in
  depth.

### 3.2 Composite keys

- Every tenant table has a unique constraint or unique index on
  `(id, organization_id)` to serve as a composite foreign-key target.
- Child tables reference the parent with both identifiers:

```sql
CREATE UNIQUE INDEX projects_id_organization_unique
  ON projects (id, organization_id);

ALTER TABLE submissions
  ADD COLUMN organization_id uuid NOT NULL,
  ADD CONSTRAINT submissions_project_fk
    FOREIGN KEY (project_id, organization_id)
    REFERENCES projects (id, organization_id);
```

- Unique business constraints include the organization. For example,
  `UNIQUE (organization_id, slug)` rather than `UNIQUE (slug)`.
- Indexes for organization-scoped access lead with `organization_id`, followed
  by the selective columns used by real queries.
- A child row must not be insertable or updatable with an organization that
  differs from its parent. The composite foreign key enforces this.
- Do not rely on application code alone to keep parent and child organizations
  consistent.

### 3.3 Global tables

The following tables are not tenant tables and must not be exposed to
organization-scoped queries without an explicit, reviewed join:

- `users`
- `external_identities`
- `sessions`
- `auth_transactions`
- `revoked_access_tokens`
- `backchannel_events`
- `backchannel_challenges`
- `global_administrators`
- `idempotency_keys` where the key is user-scoped rather than
  organization-scoped

Access to these tables is limited to the identity, session, and platform
administration paths. A tenant query must not join them in a way that returns
another organization's data.

Tables with a nullable organization column, such as outbox events, jobs, and
audit records, require an explicit policy decision:

- Organization-owned rows are visible only in the matching organization
  context.
- Platform rows with a null organization are not visible to an ordinary
  organization-scoped runtime session.
- Platform operations use a separate, audited path, not an RLS bypass on the
  ordinary application role.

## 4. PostgreSQL roles

Use separate roles for migration and runtime.

```sql
-- Schema owner and migration role. Used only by controlled migration jobs.
CREATE ROLE nethack_migrator LOGIN PASSWORD '<secret>'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

-- Runtime role. Not the owner. No DDL. No bypass.
CREATE ROLE nethack_app LOGIN PASSWORD '<secret>'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;

CREATE SCHEMA IF NOT EXISTS nethack AUTHORIZATION nethack_migrator;
```

Rules:

- `nethack_migrator` owns the schema and tables and is used only for
  migrations.
- `nethack_app` is not a table owner, not a superuser, and does not have
  `BYPASSRLS`.
- `nethack_app` has no `CREATE` privilege on the application schema.
- `nethack_app` has only the DML privileges it needs: `SELECT`, `INSERT`,
  `UPDATE`, and `DELETE` on tenant tables, and `USAGE, SELECT` on sequences.
- Do not grant `TRUNCATE`. It is not row-filtered by row-level security.
- Do not grant `REFERENCES`, `TRIGGER`, or schema ownership to the runtime role
  unless a specific reviewed feature requires it.
- Default privileges must be set so tables created later by the migration role
  are usable by the runtime role without granting DDL.
- The migration role is not used by the API, workers, or request handlers.
- Database superuser access is a break-glass operational path with audit, not a
  runtime credential.

Example grants:

```sql
GRANT USAGE ON SCHEMA public, nethack TO nethack_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nethack_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nethack_app;
ALTER DEFAULT PRIVILEGES FOR ROLE nethack_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nethack_app;
ALTER DEFAULT PRIVILEGES FOR ROLE nethack_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO nethack_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM nethack_app;
```

## 5. Row-level security design

### 5.1 Transaction-local organization context

The tenant context is a custom PostgreSQL setting named exactly
`nethack.organization_id`. It is set for the current transaction only.

```sql
SELECT set_config('nethack.organization_id', $1, true);
```

- The third argument `true` makes the setting transaction-local.
- Use `set_config` with a parameter, not string interpolation.
- Never use session-level `SET nethack.organization_id = ...` on a pooled
  connection.
- The setting is reset automatically when the transaction commits or rolls
  back.
- The application opens a transaction for every request that touches tenant
  data, sets the context, performs the work, and commits or rolls back.
- The organization identifier is validated as a UUID before it is passed to
  `set_config`.

### 5.2 Fail-closed context function

Policies must not silently return all rows when the setting is missing. Use a
function that raises on absent or invalid context.

```sql
CREATE OR REPLACE FUNCTION nethack.current_organization_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  value text;
BEGIN
  value := current_setting('nethack.organization_id', true);

  IF value IS NULL OR value = '' THEN
    RAISE EXCEPTION 'organization context is not set'
      USING ERRCODE = '42501';
  END IF;

  RETURN value::uuid;
END;
$$;

REVOKE ALL ON FUNCTION nethack.current_organization_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION nethack.current_organization_id() TO nethack_app;
```

The function is owned by the migration role and is not security definer. It
reads the caller's transaction setting. A missing context fails the query
instead of returning zero rows silently. The application must treat that failure
as a denial and must not retry without a context.

### 5.3 Policies

Enable and force row-level security on every tenant table.

```sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;

CREATE POLICY projects_tenant_select
  ON projects
  FOR SELECT
  TO nethack_app
  USING (organization_id = nethack.current_organization_id());

CREATE POLICY projects_tenant_insert
  ON projects
  FOR INSERT
  TO nethack_app
  WITH CHECK (organization_id = nethack.current_organization_id());

CREATE POLICY projects_tenant_update
  ON projects
  FOR UPDATE
  TO nethack_app
  USING (organization_id = nethack.current_organization_id())
  WITH CHECK (organization_id = nethack.current_organization_id());

CREATE POLICY projects_tenant_delete
  ON projects
  FOR DELETE
  TO nethack_app
  USING (organization_id = nethack.current_organization_id());
```

Requirements:

- Enable RLS on every tenant table.
- Use `FORCE ROW LEVEL SECURITY` so the table owner is also subject to
  policies. Superusers and roles with `BYPASSRLS` are still exempt; the runtime
  role must have neither.
- Define policies for `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.
- `USING` filters existing rows. `WITH CHECK` validates new or changed rows.
  An update must have both so a row cannot be moved to another organization.
- Policy names follow a consistent convention and are reviewed with the table.
- Do not use `USING (true)` or `WITH CHECK (true)` on a tenant table.
- Do not create a policy that depends on a client-supplied setting other than
  the verified transaction context.
- If a table has a platform-administration path, use a separate role or a
  separate audited function. Do not grant the ordinary application role a
  bypass.

### 5.4 Why the application role is not the owner

A table owner bypasses RLS unless `FORCE ROW LEVEL SECURITY` is set. Even with
force enabled, keeping the runtime role separate prevents accidental DDL,
prevents ownership-based bypass in tables where force is missing, and limits the
blast radius of a compromised request path. The migration role is the only
owner.

## 6. Connection pool behavior

- Use a transaction-scoped wrapper for every tenant operation. The wrapper sets
  the context, runs the callback, and commits or rolls back.
- Do not cache a database connection with tenant context across requests.
- Do not use a global mutable "current organization". Pass the organization
  explicitly through the call chain.
- Before a connection is handed to a request, assert that the transaction-local
  setting is absent or empty. If a previous transaction left session state, run
  `RESET nethack.organization_id` or `DISCARD ALL` outside a transaction and log
  a defect.
- Transaction-mode connection pooling is compatible with transaction-local
  settings. Session-mode assumptions are prohibited.
- The application must not use `SET SESSION` or `ALTER ROLE ... SET` to establish
  tenant context.
- Background workers set the context per job and clear it at the end of the
  transaction.
- A request that touches more than one organization, such as a platform report,
  must use a separate, explicitly authorized path. It must not reuse an
  organization-scoped connection and silently switch context in the middle of a
  transaction.

## 7. API-layer scoping

RLS is a second line. The API must be correct on its own.

- The organization identifier is established from the route and verified
  against the authenticated user's active membership.
- Repositories require an `organizationId` argument. Do not provide a
  convenience method that omits it.
- Every tenant query includes the organization predicate. Do not rely on RLS to
  add it.
- Joins include organization equality for every tenant table in the join.
- Nested resources are loaded through the full parent chain and organization
  scope.
- Search, counts, aggregates, exports, reports, and pagination apply the same
  organization scope. A count that includes another organization is a leak.
- Cache keys include the organization and the authorization-relevant variant.
  Authenticated responses use `Cache-Control: private, no-store`.
- File storage keys include the organization. Signed URLs are bound to one
  file and one organization.
- Audit queries are organization-scoped unless the caller is a platform
  administrator using the audited platform path.
- Logs must not include another organization's data. Include the organization
  identifier in structured logs for correlation, but not in public responses.
- Architecture tests must fail when a tenant repository is called without an
  organization identifier or when a query on a tenant table omits the
  organization predicate.

## 8. Testing

### 8.1 RLS integration tests

Connect as `nethack_app`, not as the migration role.

Required cases:

- With no context set, a tenant `SELECT` fails or returns no rows according to
  the fail-closed function. The test must assert denial, not an empty successful
  result that could be mistaken for valid data.
- With no context set, a tenant `INSERT` and `UPDATE` are denied.
- Organization A cannot select organization B's rows.
- Organization A cannot update or delete organization B's rows.
- Organization A cannot insert a row with organization B's identifier.
- Organization A cannot update a row to move it to organization B.
- A child row cannot reference a parent in another organization.
- A unique constraint scoped to one organization does not block the same value
  in another organization.
- A rollback does not leave a context that affects the next transaction.
- A missing or invalid UUID in the context is rejected.
- The runtime role cannot execute DDL or `TRUNCATE`.
- The runtime role is not a superuser and does not have `BYPASSRLS`.
- Every tenant table has RLS enabled, forced, and at least one policy for each
  required command.

### 8.2 Pool isolation tests

- Run concurrent transactions for organization A and organization B on the same
  connection pool. Interleave queries and assert that no row from the other
  organization is visible.
- Run a transaction that fails and rolls back, then run a transaction for a
  different organization on the same physical connection. Assert that the
  second transaction sees only its own context.
- Run a request with no context after a request with a context. Assert that it
  fails closed.
- Verify that the pool checkout assertion detects and clears leftover session
  state.

### 8.3 Catalog and architecture checks

- `pg_roles.rolsuper` is false and `pg_roles.rolbypassrls` is false for
  `nethack_app`.
- `pg_class.relrowsecurity` and `pg_class.relforcerowsecurity` are true for
  every tenant table.
- `pg_policies` contains policies for `SELECT`, `INSERT`, `UPDATE`, and
  `DELETE`, or a documented `ALL` policy that covers them with both `USING` and
  `WITH CHECK`.
- The runtime role does not own the tables.
- The migration role is not used by the application runtime.
- Source scans find no `SET SESSION`, no tenant setting outside the transaction
  wrapper, no `BYPASSRLS`, and no unscoped tenant repository methods.

### 8.4 End-to-end tests

- A user in organization A cannot load, search, export, or download
  organization B's data by changing an identifier.
- A user who switches organizations sees only the selected organization's data.
- A removed member loses access on the next request, not only after the session
  expires.
- A global administrator using the platform path sees only what the audited
  path permits, and the access is recorded.

## 9. New tenant table checklist

Before a new tenant table is merged:

- [ ] The table has `organization_id uuid NOT NULL`.
- [ ] The organization references `organizations(id)`.
- [ ] The table has a unique `(id, organization_id)` key.
- [ ] Child foreign keys include `organization_id` and reference the composite
  key.
- [ ] Business unique constraints include `organization_id`.
- [ ] Indexes lead with `organization_id` where the query pattern requires it.
- [ ] RLS is enabled and forced.
- [ ] Policies exist for select, insert, update, and delete with `USING` and
  `WITH CHECK` as appropriate.
- [ ] The runtime role has DML privileges but not ownership or DDL.
- [ ] The migration includes grants and default privileges.
- [ ] Repository methods require an organization identifier.
- [ ] Integration tests cover missing context, cross-organization access,
  insert, update, delete, and composite parent mismatch.
- [ ] Cache, export, file, and job paths include the organization if the table
  participates in them.
- [ ] The table is added to the catalog test that checks RLS and role
  attributes.

## 10. Limitations and residual risks

- RLS does not protect against a request that arrives with the wrong
  organization context. API authorization remains primary.
- An SQL injection executed as `nethack_app` can call `set_config` and change
  the organization context for its transaction. Parameterized SQL and input
  allowlists are therefore mandatory. RLS does not make injection safe.
- A superuser, a role with `BYPASSRLS`, or a migration role can bypass policies.
  Those credentials are break-glass and must be audited.
- A security-definer function can bypass the caller's row visibility if it is
  written incorrectly. Security-definer functions require explicit review and
  must set and validate their own context.
- RLS does not cover files, caches, search indexes, exports, logs, or
  third-party analytics. Those paths require their own organization scoping.
- A new table without policies is unprotected. The new-table checklist and
  catalog test are release requirements.
- Complex queries, views, materialized views, and foreign tables can hide
  bypasses. Views must be reviewed for `security_invoker` behavior and
  organization predicates.
- Performance can degrade if policies prevent index use. Policies should be
  simple equality predicates on indexed organization columns, and query plans
  must be inspected.
- A compromised application process can read any organization for which it can
  set context. Runtime isolation, least privilege, and incident response limit
  the impact but do not eliminate this risk.
