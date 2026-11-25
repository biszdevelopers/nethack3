# Capability architecture

The capability model, static registration, communication rules, catalog, folder shape, and extraction path.

## Fundamental concept

Every feature is a capability. There is one backbone, the Nethack3 Core, and capabilities are ordinary modules around it. A capability is organized around its responsibility, not around a technical layer shared across the repository.

The architecture must permit a capability to become an independent package or service later without rewriting its domain behavior. That is achieved through explicit contracts, event-based integration, and infrastructure interfaces, not through premature distribution.

## Static registration

Capabilities are explicitly registered in `apps/api/src/capabilities/index.ts`. The Core never scans directories, loads code dynamically, or discovers extensions at runtime.

```ts
export const capabilities = [
    identityCapability,
    organizationsCapability,
    competitionsCapability,
    participantsCapability,
    teamsCapability,
    projectsCapability,
    submissionsCapability,
    judgingCapability,
    votingCapability,
    announcementsCapability,
    notificationsCapability,
    administrationCapability,
    filesCapability,
] satisfies readonly CapabilityDefinition[];
```

A capability definition declares:

- A unique, stable identifier.
- Its direct dependencies.
- The public contracts it provides.
- The domain events it publishes.
- The infrastructure interfaces it requires.
- Registration, start, and stop behavior.
- Its permission and event documentation.

The Core validates unique identifiers, missing dependencies, cycles, initialization order, duplicate contract registrations, and conflicting declarations before the application starts. The dependency graph is a directed acyclic graph, and topological resolution is O(V+E) in time and space for V capabilities and E dependency edges.

## Communication

Capabilities use exactly three integration mechanisms.

| Mechanism                | Use                                                              | Example                                              |
| ------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------- |
| Public contract          | A synchronous operation that requires a result                   | Submissions asks files to authorize an upload        |
| Domain event             | Notify other capabilities that something happened                | Submissions publishes `submissions.approved`         |
| Infrastructure interface | Access a shared technical service without owning its implementation | Clock, mail, storage, database transaction, logger   |

Rules:

- A public contract is declared in the capability's `index.ts` and typed in `packages/contracts`.
- A capability never imports another capability's `domain`, `application`, `infrastructure`, or `http` files.
- A capability never queries another capability's tables.
- Events describe facts in the past tense and carry stable identifiers, organization context, actor, timestamp, and the minimum payload a consumer needs.
- Consumers must be idempotent. Delivery can retry.
- Reliable event delivery uses a transactional outbox in PostgreSQL.
- Kafka, RabbitMQ, and distributed event infrastructure are not introduced prematurely.

Example flow:

```
Submission approved
    |-- submissions.approved event
    |-- notifications consumes and queues email and in-app notices
    |-- announcements consumes to create a draft announcement when configured
    |-- reporting consumes to update read models
```

Submissions must not know how email, announcements, or reporting are implemented.

## Capability independence

Every capability must:

- Own its business rules.
- Own its application operations.
- Own its persistence implementation.
- Expose explicit public contracts.
- Declare dependencies.
- Own its tests.
- Document its permissions.
- Document its events.
- Be independently testable.

A capability owns its tests in `apps/api/src/capabilities/<name>/tests`. A test may use another capability's public contract through its `index.ts`, but not its internals.

## Capability catalog

The API registers thirteen capabilities. `identity` covers local user records and account linking; the authentication runtime in `apps/api/src/authentication` owns OIDC, sessions, tokens, and backchannel handling.

| Capability      | Responsibility                                                                                                     | Depends on                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `identity`      | Local users, external identity links, profile, account state, user preferences                                      | None                                                              |
| `organizations` | Organizations, memberships, organization roles, organization settings                                              | identity                                                          |
| `competitions`  | Competition series, editions, divisions, rules, schedules, registration configuration, eligibility definitions       | organizations                                                     |
| `participants`  | Registrations, participant records, onboarding, eligibility status                                                  | identity, organizations, competitions                             |
| `teams`         | Teams, team members, invitations, team roles, team status                                                           | organizations, competitions, participants                         |
| `projects`      | Projects, project members, metadata, external repository links, team association                                    | organizations, competitions, participants, teams                  |
| `submissions`   | Submission state machine, versions, deadlines, revisions, review status, submission file references                 | organizations, competitions, projects, teams, files               |
| `judging`       | Rubrics, criteria, judge assignments, evaluations, conflicts of interest, calibration                               | organizations, competitions, participants, projects, submissions  |
| `voting`        | Voting rounds, eligibility, ballots, votes, duplicate prevention, results and publication rules                     | organizations, competitions, participants, projects               |
| `announcements` | Announcements, audience targeting, publication state, competition and organization notices                          | organizations, competitions                                       |
| `notifications` | In-app notifications, delivery preferences, email coordination, retry and failure state                             | identity                                                          |
| `administration`| Scoped administrative operations, administrative grants, audit records                                              | identity, organizations                                           |
| `files`         | Upload authorization, file metadata, signature and MIME validation, quarantine, inspection, approved storage, download authorization | identity, organizations                                           |

`notifications` and `announcements` consume events from other capabilities through the Core dispatcher. No capability depends on their implementation. `administration` records audited actions through an audit interface rather than importing another capability's internals.

## Owned data

Each capability owns the tables that represent its responsibility. The complete mapping is in `docs/architecture/data-ownership.md`.

| Capability      | Core tables                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------- |
| `identity`      | `users`, `external_identities`                                                                |
| `organizations` | `organizations`, `organization_memberships`                                                   |
| `competitions`  | `competition_series`, `competition_editions`, `divisions`                                     |
| `participants`  | `registrations`, `participants`                                                               |
| `teams`         | `teams`, `team_members`, `team_invitations`                                                   |
| `projects`      | `projects`, `project_members`                                                                 |
| `submissions`   | `submissions`, `submission_versions`, `submission_files`                                      |
| `judging`       | `judging_rubrics`, `judging_criteria`, `judge_assignments`, `evaluations`                     |
| `voting`        | `voting_rounds`, `ballots`, `votes`                                                           |
| `announcements` | `announcements`                                                                               |
| `notifications` | `notifications`                                                                               |
| `administration`| `audit_logs`                                                                                  |
| `files`         | File records, upload state, scan status, and storage object metadata                          |

Exact relational structure must be validated against the audited old platform and actual workflows before it is treated as final.

## Published events

Event names use `<capability>.<fact>`. The following are the declared integration facts; a capability may add events only with contract and documentation updates.

| Capability      | Events                                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------- |
| `identity`      | `identity.user-created`, `identity.user-profile-updated`, `identity.user-disabled`                  |
| `organizations` | `organizations.organization-created`, `organizations.membership-changed`                           |
| `competitions`  | `competitions.published`, `competitions.schedule-updated`, `competitions.registration-opened`       |
| `participants`  | `participants.registered`, `participants.withdrawn`                                                 |
| `teams`         | `teams.created`, `teams.member-joined`, `teams.invitation-sent`                                     |
| `projects`      | `projects.created`, `projects.updated`, `projects.published`                                        |
| `submissions`   | `submissions.submitted`, `submissions.revised`, `submissions.approved`, `submissions.rejected`      |
| `judging`       | `judging.judge-assigned`, `judging.evaluation-submitted`, `judging.evaluation-locked`               |
| `voting`        | `voting.round-opened`, `voting.vote-cast`, `voting.round-closed`, `voting.results-published`        |
| `announcements` | `announcements.published`                                                                           |
| `notifications` | `notifications.queued`, `notifications.delivered`, `notifications.failed`                           |
| `administration`| `administration.action-recorded`                                                                     |
| `files`         | `files.uploaded`, `files.approved`, `files.rejected`                                                |

Events are written to the outbox in the same transaction as the state change. A worker delivers them after commit. Handlers are idempotent, failures are recorded, and a consumer failure does not roll back the producer's committed business transaction.

## Server folder shape

```
apps/api/src/capabilities/teams/
|-- domain/
|   |-- team.ts
|   |-- team-member.ts
|   `-- team-rules.ts
|-- application/
|   |-- create-team.ts
|   |-- add-member.ts
|   |-- remove-member.ts
|   `-- get-team.ts
|-- infrastructure/
|   `-- team-database.ts
|-- http/
|   `-- team-routes.ts
|-- tests/
|   |-- create-team.test.ts
|   |-- team-rules.test.ts
|   `-- team-routes.test.ts
`-- index.ts
```

Rules:

- `domain` contains entities, value objects, invariants, and domain errors. It imports no database, HTTP, or framework code.
- `application` contains one operation per file, authorization coordination, transaction boundaries, and event emission.
- `infrastructure` contains Drizzle repositories and mappers for tables owned by this capability.
- `http` contains route registration, schema references, and mapping to the Core HTTP error format.
- `tests` contains unit and integration tests for this capability.
- `index.ts` exports the capability definition, public contracts, and public types only.
- No other file outside the folder imports anything except `index.ts`.

## Browser folder shape

```
apps/workspace/src/capabilities/teams/
|-- components/
|   |-- team-card.tsx
|   |-- team-form.tsx
|   `-- team-members.tsx
|-- hooks/
|-- api/
|-- pages/
`-- index.ts
```

- Browser capabilities are separated by responsibility, not by a global `components` or `hooks` folder.
- They use `packages/api-client` and TanStack Query for server state.
- They import shared schemas from `packages/contracts` and components from `packages/ui`.
- They do not import server modules, database code, or another capability's internals.
- `index.ts` exposes routes, components, and hooks that the application shell needs.

## Shared contracts

```
packages/contracts/src/teams/
|-- team-schema.ts
|-- team-requests.ts
|-- team-responses.ts
`-- index.ts
```

Contracts contain Zod schemas and inferred TypeScript types. They do not contain database access, business operations, or UI code. The same schema validates requests in the API and form input in the workspace.

## Future expansion

The architecture must accommodate multiple organizations, competition series and editions, divisions, different team sizes, alternative registration systems, different submission requirements, scoring rubrics, judging processes, voting systems, mentorship, workshops, attendance, sponsorship, volunteer management, analytics, integrations, notifications, external APIs, data imports and exports, and additional organizational workflows.

It does not implement all of these initially. Each is added as a capability or as an extension of an existing capability; the Core stays small.

## Extraction path

Initially, a capability is a folder:

```
apps/api/src/capabilities/teams/
```

If justified, it moves to:

```
packages/capability-teams/
```

or becomes a separately deployed service. Domain and application code should not need to be rewritten because packaging changes. This requires that infrastructure dependencies stay behind explicit interfaces and that cross-capability integration uses contracts and events.

Extraction is not an excuse to create distributed transactions. A capability that moves out of the process must publish and consume events reliably and accept eventual consistency at the integration boundary.

## Capability documentation

Every capability has a short README at `docs/capabilities/<name>.md` or beside the capability, describing:

- Ownership and responsibility.
- Dependencies.
- Public contracts.
- Persistence and owned tables.
- Permissions.
- Events published and consumed.
- Tests.
- Extraction procedure.

The README is part of the change, not an afterthought. A capability with undocumented permissions or events is incomplete.

## Review checks

- Is the feature inside the correct capability, or is it leaking into Core?
- Are dependencies declared and acyclic?
- Does integration use a public contract, a domain event, or an infrastructure interface?
- Are private imports or cross-capability database access present?
- Are tables owned by exactly one capability?
- Are events transactional, idempotent, and documented?
- Can the capability be tested without starting unrelated capabilities?
- Does the folder shape match the standard?
