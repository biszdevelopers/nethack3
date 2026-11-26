# Platform audit and historical-data assessment

Status: Phase 0 audit completed against the repository and the product specification. The old platform is not present, so this document does not describe its actual schema, data volume, authentication configuration, or feature completeness.

## 1. Scope and method

This audit answers the Phase 0 questions in `FULL_PLAN.md` section 19.1:

- What pages and functionality existed on the old platform?
- What data and authentication arrangements existed?
- Which Microsoft integrations existed?
- What historical data must be preserved?
- Which features should not be carried forward?

Evidence reviewed:

- `FULL_PLAN.md`, especially sections 8, 12, 18, and 19.
- `SETUP_GUIDE.md`, the Basis Auth downstream contract.
- The repository at `C:\Users\rjian\Desktop\nethack3`, including Git history, applications, capabilities, contracts, database schema, and migrations.
- `docs/implementation/REQUIREMENT_TRACKER.md`.
- The migration tool, fixture, and tests added with this audit.

No old platform source tree, database dump, schema export, user export, file store manifest, URL map, analytics export, or production configuration was provided. The only local database artifacts are the ignored development directory `.data/pg`, which the repository scripts use for a local PostgreSQL instance. They are not an old-platform export and were not treated as one.

Consequences:

- The old platform page inventory, schema, user volume, and authentication behavior are unknown.
- No mapping from old records to nethack records has been verified against real data.
- No production data migration has been executed.
- The migration tool in this repository is a validated, tested mechanism for a documented JSON export. It has been exercised only with the synthetic fixture `docs/implementation/migration-fixture.json`.

## 2. Repository evidence

Git history starts with repository initialization and the nethack3 application commits. There is no commit that imports an old platform source tree, old migrations, or a production dump.

The database migrations under `database/migrations/` create only the nethack schema:

- `0000_handy_katie_power.sql` creates the nethack tables, enums, indexes, and constraints.
- `0001_rls-policies.sql` adds organization row-level security and grants for the runtime role.
- `0002_tighten-settings-rls.sql` tightens organization settings isolation.

No migration maps, copies, or references legacy tables. No credentials, dumps, or production connection strings are tracked. `.env` is ignored; `.env.example` contains development placeholders only.

## 3. What exists in the repository

### 3.1 Applications

| Application | Implemented surface | Audit note |
| --- | --- | --- |
| `apps/site` | Next.js public site with landing, competition directory, competition detail, rules, schedule, project showcase, project detail, past competitions, about, FAQ, announcements, error/not-found/loading routes, sitemap, robots | Source exists; this audit did not verify visual completion or production behavior |
| `apps/workspace` | React and Vite authenticated workspace with sign-in, dashboard, competitions, teams, projects, submissions, judging, voting, organization, admin, notifications, settings, auth-error, and component lab pages | Source exists; feature completeness is tracked separately in the requirement tracker |
| `apps/api` | Fastify API with the Nethack3 Core and capabilities for identity, organizations, competitions, participants, teams, projects, submissions, files, judging, voting, announcements, notifications, and administration | Source exists; integration and security evidence is tracked separately |
| `packages/ui` | Nethack UI components, tokens, providers, hooks, and motion primitives | Source exists; catalog completeness is not asserted here |
| `packages/contracts` | Zod request and response contracts | Source exists |
| `packages/api-client` | Typed HTTP client used by the workspace | Source exists |

### 3.2 API capabilities

`apps/api/src/capabilities/` contains:

- `identity`
- `organizations`
- `competitions`
- `participants`
- `teams`
- `projects`
- `submissions`
- `files`
- `judging`
- `voting`
- `announcements`
- `notifications`
- `administration`

The migration tool writes organization, identity, competition, participation, team, project, submission, and file-metadata tables. It intentionally does not write judging, voting, announcement, notification, or historical audit data.

### 3.3 Database tables

The schema in `apps/api/src/infrastructure/database/schema/` contains:

| Group | Tables |
| --- | --- |
| Identity | `users`, `external_identities`, `sessions`, `auth_transactions`, `revoked_access_tokens`, `backchannel_events`, `backchannel_challenges`, `global_administrators`, `idempotency_keys`, `outbox_events`, `jobs`, `audit_logs` |
| Organizations | `organizations`, `organization_settings`, `organization_memberships`, `organization_invitations` |
| Competitions | `competition_series`, `competition_editions`, `divisions`, `milestones` |
| Participation | `registrations`, `participants` |
| Teams | `teams`, `team_members`, `team_invitations` |
| Projects | `projects`, `project_members` |
| Submissions and files | `submissions`, `submission_versions`, `submission_files` |
| Judging | `judging_rubrics`, `judging_criteria`, `judge_assignments`, `evaluations`, `evaluation_scores` |
| Voting | `voting_rounds`, `ballots`, `votes` |
| Communications | `announcements`, `notifications` |

Every organization-owned record carries `organization_id` and uses composite foreign keys where the schema enforces organization consistency. Row-level security is forced on organization-owned tables in `0001_rls-policies.sql`.

## 4. Planned page and feature inventory

The following inventory comes from `FULL_PLAN.md` section 8. It is the product scope that historical data must support. A source file exists for most public and workspace surfaces, but this audit does not certify those surfaces as complete or verified.

### 4.1 Public experience

| Planned page or feature | Historical migration relevance |
| --- | --- |
| Landing page | No historical data required |
| Competition directory | Historical editions must be published or archived with correct visibility |
| Competition overview | Series, edition, schedule, rules, divisions |
| Rules | Edition rules text must be preserved or deliberately replaced |
| Schedule | Milestones and dates; the migration tool imports edition dates but not milestones |
| Project showcase | Published project records and published submission versions |
| Project detail | Project metadata, members, repository and demo links, attachments |
| Past competitions | Completed and archived editions, divisions, and results |
| About | No historical data required |
| FAQ | No historical data required |
| Public announcements | Announcement history is not migrated by the tool |
| No artificial marketing sections | Excluded by the plan |
| No invented sponsors or testimonials | Excluded by the plan |
| No decorative statistics | Excluded by the plan |

### 4.2 Participant experience

- Basis Auth login.
- First-time onboarding.
- Profile management.
- Organization selection.
- Competition registration.
- Participant dashboard.
- Competition overview.
- Team discovery, creation, invitations, and membership.
- Project creation and editing.
- File management.
- Submission workflow and history.
- Notifications and announcements.
- Account preferences.

Migration relevance: user identity, display name, email, status, organization membership, registration, team membership, project membership, submission history, and file metadata. Invitations, notifications, and preferences are not migrated by the tool.

### 4.3 Team workspace

Team information, member management, invitations, membership roles, project association, project files, activity history, team status, and submission readiness.

Migration relevance: team, team members, captain, division, and project/team association. Activity history and invitations are not migrated.

### 4.4 Project and submission system

Project creation, metadata, description, members, repository links, attachments, submission requirements, draft state, validation, confirmation, versioning, history, deadline enforcement, revisions, organizer review, and published showcase.

Migration relevance: project, project members, submission, submission versions, and file metadata. Review notes are imported as text. Judging evaluations and scores are not imported.

### 4.5 Judging

Judge dashboard, assigned projects, project review, rubric, criteria, scoring, written feedback, conflict-of-interest declarations, evaluation submission, evaluation history, assignment management, and calibration.

Migration relevance: the files and tables exist, but the migration tool does not import judging data. Historical results requiring judging evidence need a separate approved mapping.

### 4.6 Voting

Voting rounds, eligibility, ballots, vote submission, duplicate-vote prevention, vote integrity, results, and publication rules.

Migration relevance: the files and tables exist, but the migration tool does not import voting data. Historical vote records need a separate approved mapping and integrity review.

### 4.7 Organizer experience

Organization management, competition series, editions, divisions, registration configuration, eligibility, deadlines, participants, teams, projects, submissions, rubrics, judges, assignments, evaluations, voting, results, announcements, notifications, reports, audit logs, permissions, and settings.

Migration relevance: organizations, memberships, series, editions, divisions, registrations, participants, teams, projects, submissions, and file metadata are supported. Rubrics, assignments, evaluations, voting, announcements, notifications, reports, and historical audit logs are not supported by the tool.

### 4.8 Administration

Administrative privileges must be scoped per organization. Global administration is rare, separately granted, and auditable.

Migration relevance: organization roles are imported through memberships. Global administrator status is not imported; it must be granted deliberately in nethack after review.

## 5. Data entities and ownership

The plan's section 12.3 entity list is implemented with the following ownership boundaries:

- Global identity: `users`, `external_identities`.
- Global operations: `audit_logs`, `outbox_events`, `jobs`.
- Organization-owned: settings, memberships, invitations, series, editions, divisions, milestones, registrations, participants, teams, team members, team invitations, projects, project members, submissions, submission versions, submission files, judging, voting, announcements, and notifications.

The migration tool writes global users only inside an organization transaction and only for users referenced by that organization. It reuses an existing user row only when the deterministic user ID and profile fields match. It never merges users by email.

## 6. Authentication arrangement in nethack

`SETUP_GUIDE.md` and `apps/api/src/authentication/` define the arrangement:

- Basis Auth is an OpenID Connect provider in front of Microsoft Entra ID.
- Users authenticate through Microsoft; nethack never receives Microsoft tokens.
- Nethack receives an ID token for login and an access token for its API.
- The stable user key is the Basis Auth `sub`, stored with the configured issuer in `external_identities(issuer, subject)`.
- Email is profile data and can change. It is not a durable foreign key.
- Nethack owns its browser session and never forwards the Basis Auth SSO session.
- Session tokens are stored server-side and hashed. Refresh tokens are encrypted at rest. The browser cookie is `__Host-nethack_session`.
- Logout and revocation are handled through backchannel events and the Basis Auth logout endpoint.
- When a login presents an email that already belongs to a different identity, `user-service.ts` rejects the login with `AccountLinkRequiredError` instead of linking silently.

Historical identity implication: the old platform must provide the Basis Auth issuer and `sub` for each migrated user, or an approved mapping from its own identity keys to those values. A Microsoft object ID, email address, username, or display name is not a substitute for the Basis Auth `(issuer, subject)` pair.

## 7. Microsoft and Basis Auth integration assessment

Present in the repository:

- OIDC discovery, authorization code with PKCE, token validation, refresh rotation, session management, backchannel logout, and revocation in the authentication code.
- Basis Auth issuer configuration and client/resource credentials in the environment schema.
- External identity storage keyed by issuer and subject.

Not present in the repository:

- Direct Microsoft Graph calls.
- Microsoft Teams, SharePoint, OneDrive, or Outlook integrations.
- Microsoft Entra group-to-organization synchronization.
- Import of Microsoft tenant IDs, object IDs, or group memberships.

If the old platform relied on any of those integrations, they are not part of the current nethack implementation and must be assessed separately. The migration tool does not create or modify Microsoft or Basis Auth records.

## 8. Historical-data assessment

### 8.1 What can be stated

- No old-platform artifacts were provided.
- No old-platform schema has been inspected.
- No old-platform user, identity, competition, team, project, submission, file, or URL data has been inspected.
- No production or staging migration has been executed.
- The migration tool has been tested only against synthetic data.
- The nethack schema is the target; it is not evidence of the old schema.

### 8.2 What cannot be stated

- The number of historical users, organizations, editions, teams, projects, or submissions.
- Whether the old platform used Microsoft Entra directly, Basis Auth, another identity provider, or local passwords.
- Whether old user identifiers can be mapped to Basis Auth `(issuer, subject)` pairs.
- Whether old organization boundaries match nethack organizations.
- Whether old submissions have complete version history.
- Whether old files are intact, scanned, or legally retainable.
- Whether old URLs can be redirected without collisions.
- Whether judging or voting results are required for historical continuity.

### 8.3 Data quality risks to resolve before migration

- Duplicate user records with the same email.
- Users without a usable external identity.
- Email addresses reassigned to different people.
- Deleted or anonymized users referenced by historical projects.
- Organizations whose ownership is disputed or undocumented.
- Teams with members from multiple editions or divisions.
- Projects without an owner, team, or edition.
- Submissions with missing versions or timestamps.
- Files whose blobs are missing, corrupted, or unscanned.
- Soft-deleted records that must remain deleted.
- Personally identifiable information subject to retention or erasure requests.

## 9. Functionality to preserve

Subject to operator confirmation, the historical record should preserve:

- User continuity through Basis Auth identities.
- Organization membership and roles.
- Competition series, editions, divisions, dates, status, and rules.
- Registrations and their decisions.
- Teams, captains, members, and division assignment.
- Projects, ownership, membership, metadata, repository and demo links.
- Submission history and immutable version snapshots.
- File metadata and, separately, file bytes with checksums and scan status.
- Published showcase state and public visibility.
- Historical URLs through an explicit redirect map.
- Audit evidence for the migration itself.

Not every preserved item needs to be editable after migration. Archived editions and published showcase records may be read-only in nethack while remaining available to the public.

## 10. Functionality intentionally excluded

The following are excluded by the product plan or by the current migration scope:

- AI chat, assistants, or generated content.
- Sponsors, sponsor tiers, logos, and sponsor workflows.
- Fabricated testimonials, statistics, marketing sections, and decorative metrics.
- Legacy password hashes, password reset tokens, sessions, refresh tokens, and API keys.
- Direct Microsoft Graph, Teams, SharePoint, OneDrive, or Outlook integrations.
- Notification delivery history and email archive.
- Invitations that were never accepted, unless the operator demonstrates a legal or workflow need.
- Historical audit logs, application logs, and analytics events.
- Judging rubrics, assignments, evaluations, scores, and feedback.
- Voting rounds, ballots, votes, and vote integrity records.
- Legacy administrative roles that do not map to organization owner, organizer, judge, or participant.
- Collaboration features that have no real workflow in nethack.

Exclusion is a default, not an irreversible decision. Any excluded category that the operator requires must be added to the specification with an explicit mapping, validation plan, and acceptance test.

## 11. Information required from the old-platform operator

The following inputs are required before a real migration can be specified or executed.

### 11.1 Schema and data model

- Database engine and version.
- Schema-only export, including tables, columns, types, defaults, nullability, primary keys, foreign keys, unique constraints, check constraints, indexes, enums, views, triggers, and sequences.
- Table and column comments, or a data dictionary.
- Row counts per table and per organization.
- Entity relationship diagram or a written relationship description.
- Soft-delete and archival rules.
- Known orphan rows and data quality exceptions.

### 11.2 Users and identities

- One row per user with the old stable user ID.
- Basis Auth issuer and `sub` where available.
- If Basis Auth identities do not exist, the old identity provider, issuer, subject, tenant ID, and object ID.
- Email, display name, status, locale, created and updated timestamps.
- Email change history and known email collisions.
- Deleted, disabled, anonymized, and test accounts.
- Confirmation of which accounts must be able to log in after cutover.

### 11.3 Authentication configuration

- Identity provider and tenant.
- Client IDs, redirect URIs, scopes, and resource audiences.
- Whether MFA, conditional access, or account filters applied.
- Session lifetime and logout behavior.
- Account-linking policy and evidence of any historical linking.
- Whether local passwords or other credentials existed.
- Confirmation that no password or token material will be exported.

### 11.4 Organizations and competitions

- Legal organization names, public names, slugs, descriptions, and websites.
- Owners and organizers with evidence of authority.
- Membership roles and status.
- Series and edition names, slugs, descriptions, statuses, time zones, dates, rules, team-size limits, participant limits, and publication state.
- Divisions and their limits.
- Milestones if they must appear in nethack.

### 11.5 Participation and projects

- Registrations with edition, user, division, status, note, and decision time.
- Teams with edition, division, name, status, captain, members, roles, and join times.
- Projects with edition, team, owner, title, slug, summary, description, repository URL, demo URL, tags, status, publication time, and members.
- Submissions with project, team, status, submitted time, review note, and every version with author and timestamp.
- Published showcase decisions and takedown requests.

### 11.6 Files

- File store type and export method.
- One manifest row per file: old file ID, project ID, submission ID, version, file name, content type, byte size, SHA-256 checksum, storage key or object path, uploader, upload time, scan status, deletion status.
- Confirmation that bytes can be exported without loss.
- Malware scanning and quarantine requirements.
- Retention, legal hold, and deletion requirements.
- A staging copy for validation, with real personal data minimized or sanitized where possible.

### 11.7 URLs and public content

- Complete old URL inventory for public pages, projects, competitions, files, and assets.
- Desired new URL or redirect for each old URL.
- Permanent versus temporary redirect decision.
- Canonical host and scheme.
- Sitemap and robots requirements.
- Pages that must return 410 Gone rather than redirect.
- Public announcements and rules text that must be preserved.

### 11.8 Governance and cutover

- Data protection agreement, retention schedule, and jurisdiction.
- Handling of minors, consent, and deletion requests.
- Named migration owner and acceptance approver.
- Freeze window and read-only period for the old platform.
- Staging and production target environments.
- Backup and restore evidence for the target.
- Rollback authority and contact list.
- Old-platform retirement date and evidence required before retirement.

## 12. Migration tooling delivered with this audit

| Artifact | Purpose | Verification performed |
| --- | --- | --- |
| `docs/implementation/migration-spec.md` | Migration rules, mapping, validation, rollback, acceptance | Document review |
| `scripts/migrate-legacy.ts` | CLI for the documented JSON export | Fixture dry run executed |
| `scripts/legacy-migration/planner.ts` | Pure validation and planning core | Node Vitest unit tests |
| `scripts/legacy-migration/database.ts` | PostgreSQL apply adapter | Typechecked and exercised against a disposable local PostgreSQL database with the synthetic fixture |
| `scripts/legacy-migration/runtime.ts` | Guards, map file, run orchestration | Node Vitest unit tests |
| `scripts/legacy-migration/schema.ts` | Zod export and map schemas | Node Vitest unit tests |
| `docs/implementation/migration-fixture.json` | Synthetic export with no real people or data | Used by tests, dry run, and disposable apply check |
| `tests/migration/migrate-legacy.test.ts` | Validation, planning, dry-run, apply, and guard tests | 22 tests passed under Node Vitest |

### 12.1 Executed verification record

The following checks were executed for this audit:

- Node Vitest: `tests/migration/migrate-legacy.test.ts`, 22 tests passed.
- CLI dry run against the synthetic fixture: counts printed, no database writes.
- Disposable local PostgreSQL check: a temporary database was created, the nethack migrations were applied, the synthetic fixture was applied through `--apply --map` under Bun, and the tool was run a second time with the same map. The first run wrote 25 rows across the supported tables. The second run wrote 0 rows and skipped the organization as already applied. Counts matched the fixture, orphan checks returned 0, and the temporary database was dropped.
- The apply path was repeated under Node.js 24 against a separate disposable database and wrote the same 25 rows.
- Production guard: `NODE_ENV=production` without `--allow-production` refused to run.

No production or historical-data migration was executed. These checks use only synthetic data and a disposable local database.

## 13. Phase 0 and Phase 12 status

Phase 0 is complete only when the operator inputs in section 11 have been reviewed and the migration specification has been accepted. At the time of this audit, that condition is not met because no old-platform artifacts were provided.

Phase 12 is not complete. Completed prerequisites:

- A documented export format.
- A deterministic, idempotent planner.
- A dry-run and apply CLI with production guards.
- A file-based mapping and audit artifact.
- Unit tests that do not require a live database.
- A synthetic fixture.
- An apply-path check against a disposable local PostgreSQL database using the synthetic fixture, including an idempotent second run.

Blocked or outstanding:

- Real schema and data export.
- Identity mapping to Basis Auth `(issuer, subject)`.
- Organization ownership verification.
- File store export and checksum verification.
- URL redirect map.
- Staging migration and validation.
- Production cutover, monitoring, recovery verification, and old-platform retirement.

## 14. Open questions for the operator

1. Which old user identifier is stable enough to become the external ID in the export, and how does it map to Basis Auth `sub`?
2. Did the old platform use Basis Auth, Microsoft Entra directly, or local accounts? Are any old sessions or tokens still valid?
3. Are historical judging and voting results required for public or legal reasons, or is a published results summary sufficient?
4. Which old URLs receive search traffic or external links and must redirect?
5. Which files are legally required to remain available, and which should be deleted at cutover?
6. Are there organizations with disputed ownership or shared ownership?
7. Are there deleted or anonymized users whose historical projects must remain attributed?
8. What is the required recovery time and recovery point for the cutover?
9. Who signs off that the migrated public showcase is accurate?
10. When may the old platform be made read-only and when may it be retired?
