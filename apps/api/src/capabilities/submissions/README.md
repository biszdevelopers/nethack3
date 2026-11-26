# Submissions capability

Owns submissions, their version history, review state, and attached files. Depends on `projects`, `teams`, `files`, `competitions`, and `participants`.

## Layers

- `domain/submission-rules.ts` — submission window, revision/withdrawal eligibility, and the explicit review transition map.
- `application/submission-service.ts` — use cases, visibility checks, file attachment orchestration, response mapping.
- `infrastructure/submission-repository.ts` — Drizzle queries over `submissions`, `submission_versions`, and `submission_files`.
- `http/submission-routes.ts` — Fastify routes and validation.
- `contracts.ts` — the fixed `submissions.v1` contract consumed by judging, voting, administration, and reporting.

## Routes

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/submissions` | Organization header required. Filters `editionId`, `projectId`, `mine`; cursor on `created_at`. Owners/organizers see everything unless `mine=true`; everyone else sees submissions of owned, member, or team projects. |
| POST | `/api/v1/submissions` | Project owner, project member, or organizer. Creates a `draft`; one submission per project, enforced by `submissions_project_unique`. Idempotent via `IdempotencyService` (`submissions.create`). |
| GET | `/api/v1/submissions/:submissionId` | Project owner/member, submission team member, or organizer. |
| POST | `/api/v1/submissions/:submissionId/versions` | Project manager only. Snapshots metadata, increments `currentVersion`, attaches approved project files through the `files` contract. Idempotent (`submissions.version`). |
| GET | `/api/v1/submissions/:submissionId/versions` | Same visibility as detail; returns every version with the files attached to it. |
| POST | `/api/v1/submissions/:submissionId/review` | Organization owner/organizer only. Explicit transitions; emits `submissions.submission.reviewed`. |
| POST | `/api/v1/submissions/:submissionId/withdraw` | Project manager only. `draft`, `submitted`, or `changes_requested` → `withdrawn`. |
| GET | `/api/v1/competitions/:editionId/submissions` | Organization owner/organizer only. Lists every submission for the edition with cursor pagination. |

## State machine

```
draft               -> (version + submit) -> submitted
submitted           -> under_review | changes_requested | accepted | rejected | disqualified
under_review        -> changes_requested | accepted | rejected | disqualified
changes_requested   -> under_review | accepted | rejected
accepted            -> accepted (idempotent only)
rejected            -> rejected (idempotent only)
withdrawn           -> terminal
disqualified        -> terminal
```

`REVIEW_TRANSITIONS` in `domain/submission-rules.ts` is the single authority. Statuses outside the map reject review transitions with a conflict.

## Versioning and deadlines

- A revision is allowed while the submission is `draft`, `submitted`, or `changes_requested`.
- `POST /versions` locks the submission row with `SELECT ... FOR UPDATE`, then inserts `currentVersion + 1`. `submission_versions_submission_version_unique` is the final defense against concurrent writers.
- The edition must be one of `published`, `registration_open`, `registration_closed`, `active`, or `judging`; `completed` and `archived` always reject. `startsAt`/`endsAt` are compared with `ctx.clock.now()`, never client time. `endsAt` is the hard deadline (`The submission deadline has passed.`).
- `submit=true` sets `status = submitted` and `submittedAt`; saving without `submit` keeps the current status (a draft stays a draft).

## Data ownership and files

- The capability reads only its own tables plus user display names where needed. Project ownership/membership, teams, editions, and files are resolved through contracts.
- Every submission response carries display fields: `projectTitle` is the current version title, then the project title, then `Untitled project`; `teamName` is resolved from the submission's team. List endpoints resolve project and team lookups through request-scoped `Map` caches so each distinct id is fetched once per request. `currentVersion = 0` uses the project title.
- Approved project files are attached after the version transaction commits. The files contract updates `submission_files`, whose foreign key needs the submission row committed before acquiring its lock; attaching inside the `FOR UPDATE` transaction would block on that lock. `attachToSubmission` moves a file to the newest version, so a version's file list reflects the latest attachment.
- Submission detail never reads another capability's tables; `projectTitle` and `teamName` come from the submission's current version and the `projects`/`teams` contracts.

## Events and auditing

- `submissions.submission.reviewed` carries `submissionId`, `projectId`, `projectTitle`, `ownerUserId`, `userId` (notification recipient), `teamId`, `status`, `organizationId`, `organizationName`, and `note`.
- Audit actions: `submission.created`, `submission.version.created`, `submission.submitted`, `submission.reviewed`, `submission.withdrawn`. Audit rows and outbox events are written inside the mutation transaction.

## Contract

`submissions.v1` exposes `getSubmission`, `listEditionSubmissions`, `isSubmittedForProject`, and `countSubmissions`, always inside an organization-scoped transaction. Summaries include the current version's `title` and `summary`, falling back to the project title/summary and finally `Untitled project` for the title when no version exists.

## Query shape

List queries left join `submission_versions` on `(submission_id, organization_id, version = current_version)` so the current version title arrives with the submission row instead of one query per row. Project and team display lookups are cached per request; the submission list itself stays a single keyset-paginated query.
