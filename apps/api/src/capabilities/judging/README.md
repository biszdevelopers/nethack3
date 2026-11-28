# Judging capability

Owns judging rubrics, criteria, judge assignments, evaluations, evaluation scores, immutable evaluation version snapshots, and the organizer-facing ranked results for an edition. It decides who judges which submission, how a rubric produces a weighted score, when an evaluation is a draft or submitted, and how submitted evaluations aggregate into a ranking.

## Dependencies

- `submissions` (`submissions.v1`) for submission existence, project title, team id, and edition membership.
- `competitions` (`competitions.v1`) for edition existence inside the organization.
- `organizations` (`organizations.v1`) for the organization name in assignment events.
- `teams` (`teams.v1`) for team names in edition results.
- Core services: database transactions, clock, audit log, transactional outbox.

## Public contract

`judging.v1` (`JUDGING_CONTRACT`):

| Method | Behavior |
| --- | --- |
| `getAssignment(organizationId, assignmentId)` | Assignment summary and whether its evaluation is submitted. Runs in an organization-scoped transaction. |
| `countSubmittedEvaluations(organizationId, editionId)` | Count of submitted evaluations for an edition. Runs in an organization-scoped transaction. |
| `countOpenFlags(organizationId, editionId)` | Count of `judge_flags` with status `open` for an edition. Runs in an organization-scoped transaction. |
| `getEvaluation(organizationId, assignmentId)` | The evaluation with scores, or `null`. Runs in an organization-scoped transaction. |
| `listTeamFeedback(organizationId, editionId, teamId)` | Anonymous `{ comment, weightedScore, submittedAt }` entries for a team's submitted evaluations. Judge identity is removed. Returns an empty list until at least three submitted evaluations exist. |

## Tables

Owned writes: `judging_rubrics`, `judging_criteria`, `judging_rubric_templates`, `judging_score_curves`, `judge_assignments`, `evaluations`, `evaluation_scores`, `evaluation_versions`, `judge_flags`. All access is organization-scoped through row-level security.

`judging_rubrics` stores immutable versions. `family_id` groups versions of the same rubric, `version` increments within the family, and `active` marks the version offered to new assignments. `division_id` scopes a rubric to one division; `null` is edition-wide. `comment_guidance` stores the introduction, guidelines, and comment templates shown to judges. Saving an edit inserts a new row and archives the prior version instead of mutating it.

`judging_criteria` stores `min_score`, `max_score`, `weight`, and `position`. Criterion weights must total 100 per rubric track within a 0.01 tolerance. There is no implicit normalization; authored totals outside the tolerance are rejected on create, update, template application, and publish.

`judging_rubric_templates` stores organization-wide `{ tracks, commentGuidance }` definitions. A template never changes a rubric version already used for judging.

`judging_score_curves` stores one presentation-only points curve per edition. `points` is a JSON array of `{ rawScore, displayScore }` integers; raw scores increase strictly, display scores cannot decrease, and the curve starts at raw 0 and ends at raw 100. The curve never changes raw scores or ranks.

`judge_flags` stores judge-reported concerns with organization, edition, assignment, and submission scope. `status` moves from `open` to `resolved`; `resolved_by_user_id` and `resolved_at` record the organizer decision. A judge can report at most one flag per assignment (`unique(assignment_id, reported_by_user_id)`).

`evaluation_versions` stores immutable snapshots of every saved draft and submitted evaluation. Rows are only inserted, never updated or deleted by the capability. `revision` is scoped per evaluation and increments from the previous maximum. Each snapshot also stores `rubric_id`, `rubric_version`, and a `rubric_snapshot` JSON copy of the pinned rubric and its criteria so later rubric edits cannot alter historical feedback. Migration `0003_evaluation-history.sql` creates the table, its composite FK to `evaluations(id, organization_id)`, the revision index, RLS, and the `nethack_app` grant.

Read-only joins outside the capability:

- `users` and `organization_memberships` resolve a judge by email and verify that the judge is an active owner, organizer, or judge in the organization. This is directory and membership data. Move it to an identity or organizations contract when one exposes those lookups.
- Submissions, projects, teams, and divisions are never read directly. Submission data comes from `submissions.v1`, team and division names come from `teams.v1`, project context comes from `projects.v1`, and division names are resolved through `competitions.v1`. Assignment and history DTOs expose submission state, team, division, description, repository, demo, video, and AI-use disclosure.

## Routes and permissions

All routes require authentication. Routes without an organization in the path use `x-nethack-organization-id`. Every edition route also verifies that the edition belongs to the organization.

| Method | Route | Permission |
| --- | --- | --- |
| GET | `/api/v1/competitions/:editionId/rubrics` | Active organization member; active versions by default, `?includeInactive=true` is organizer-only |
| POST | `/api/v1/competitions/:editionId/rubrics` | Owner or organizer |
| GET | `/api/v1/competitions/:editionId/rubrics/:rubricId` | Active organization member |
| PATCH | `/api/v1/competitions/:editionId/rubrics/:rubricId` | Owner or organizer; creates the next immutable version |
| POST | `/api/v1/competitions/:editionId/rubrics/:rubricId/publish` | Owner or organizer |
| POST | `/api/v1/competitions/:editionId/rubrics/:rubricId/archive` | Owner or organizer |
| POST | `/api/v1/competitions/:editionId/rubrics/templates/:templateId/apply` | Owner or organizer |
| GET | `/api/v1/competitions/:editionId/score-curve` | Active organization member |
| PATCH | `/api/v1/competitions/:editionId/score-curve` | Owner or organizer |
| GET | `/api/v1/organizations/:organizationId/rubric-templates` | Owner or organizer |
| POST | `/api/v1/organizations/:organizationId/rubric-templates` | Owner or organizer |
| PUT | `/api/v1/organizations/:organizationId/rubric-templates/:templateId` | Owner or organizer |
| DELETE | `/api/v1/organizations/:organizationId/rubric-templates/:templateId` | Owner or organizer |
| GET | `/api/v1/competitions/:editionId/assignments` | Owner or organizer |
| GET | `/api/v1/competitions/:editionId/judging-results` | Owner or organizer; ranked mean of submitted evaluations |
| GET | `/api/v1/competitions/:editionId/teams/:teamId/judging-feedback` | Owner or organizer; anonymous written feedback, withheld below three submitted evaluations |
| POST | `/api/v1/competitions/:editionId/assignments` | Owner or organizer |
| GET | `/api/v1/judging/assignments?status=` | Active organization member; returns only the caller's assignments |
| GET | `/api/v1/judging/history?editionId=` | Active organization member; returns only the caller's submitted evaluations |
| GET | `/api/v1/competitions/:editionId/judging-coverage` | Owner or organizer; per-judge progress, calibration, open flags |
| GET | `/api/v1/competitions/:editionId/judging-flags` | Owner or organizer |
| POST | `/api/v1/judging-flags/:flagId/resolve` | Owner or organizer; idempotent |
| GET | `/api/v1/assignments/:assignmentId` | Assigned judge or owner/organizer |
| POST | `/api/v1/assignments/:assignmentId/conflict` | Assigned judge |
| POST | `/api/v1/assignments/:assignmentId/flag` | Assigned judge |
| PUT | `/api/v1/assignments/:assignmentId/evaluation` | Assigned judge |
| POST | `/api/v1/assignments/:assignmentId/evaluation/submit` | Assigned judge |
| GET | `/api/v1/assignments/:assignmentId/history` | Assigned judge or owner/organizer |
| POST | `/api/v1/assignments/:assignmentId/revoke` | Owner or organizer |

The assignment is the scoring authority. An organizer who is not the assigned judge cannot save or submit an evaluation. Organizers can view assignments and evaluations inside their organization.

## Rubric and assignment rules

- Creating a rubric inserts the rubric and its criteria in one transaction. Criterion `position` is the array index. `divisionId` must belong to the edition; `null` creates an edition-wide rubric.
- Criterion weights must total 100 per division or track within a 0.01 tolerance. Create, update, template application, and publish reject totals outside that tolerance instead of normalizing them. Every criterion validates `0 <= minScore < maxScore <= 100`.
- Editing a rubric through `PATCH` inserts a new version in the same `family_id`, makes it active, and archives the previous versions. Existing assignments keep their pinned `rubricId`.
- Publishing a version activates it and archives the other versions in its family. Archiving deactivates one version without deleting it or its criteria.
- Applying a template creates a new rubric version in a new family from the selected track. The template's criteria weights must total 100.
- Creating an assignment resolves the judge by email, requires an active `owner`, `organizer`, or `judge` membership, requires the submission to belong to the edition and organization, and requires the rubric to belong to the edition. The assignment pins the rubric version row it was created with.
- Duplicate active assignment (`submission_id`, `judge_user_id`) is a `409 conflict`. A previously revoked assignment is revived in place so the unique index remains valid.
- `judge.assignment.created` is published with `{ assignmentId, submissionId, projectTitle, judgeUserId, judgeEmail, email, organizationId, organizationName, editionId, dueAt }`. `email` duplicates `judgeEmail` because the notification handler reads `email`.
- A judge can declare a conflict while the assignment is `assigned` or `in_progress`. The note is stored and the status becomes `conflict_declared`. Conflicted assignments cannot be evaluated.
- Revoking sets `revoked` and prevents any later evaluation. Revocation is idempotent and does not delete a submitted evaluation.
- A deadline set on the assignment rejects evaluation saves and submissions after `dueAt` with `409 conflict`. Conflict declarations are not deadline-bound.

## Evaluation rules

- A save requires exactly one score for every rubric criterion and no others. Each score is an integer between the criterion `minScore` and `maxScore`.
- The overall comment must contain at least 20 characters after trimming, must not contain an unfilled `{{...}}` template placeholder, and must not contain the judge's own display name or email address (case-insensitive). Draft saves and submissions enforce the same rules and return a field-scoped `validation_error` on `overallComment`.
- Saving and submitting an evaluation are rejected with `409 conflict` when the edition is `completed` or `archived` (results published). Assignment, history, coverage, and result reads stay available and the assignment detail reports `frozen` so the workspace shows a read-only state.
- Updating the score curve is rejected with `409 conflict` once results are published or the edition is frozen. Reading the curve remains available.
- `normalized = (score - minScore) / (maxScore - minScore)`; `weightedScore = round2(sum(normalized * weight) / sum(weight) * 100)`. A criterion with no range contributes zero.
- Saving upserts the single evaluation row (`unique(assignment_id)`), replaces all score rows (`unique(evaluation_id, criterion_id)`), and moves the assignment to `in_progress`.
- Submitting requires a draft evaluation, a complete scorecard, and an open assignment. It sets the evaluation and assignment to `submitted`, records `submittedAt`, and publishes `judging.evaluation.submitted` with `{ assignmentId, submissionId, projectId, judgeUserId, organizationId, editionId, weightedScore }`.
- Every successful draft save and submission inserts an `evaluation_versions` snapshot in the same transaction. The snapshot contains the full scorecard, status, overall comment, weighted score, the pinned rubric id and version, a rubric snapshot, and the submission timestamp. Revision `n` is built from the previous maximum revision plus one; existing snapshots are never mutated.
- `GET /history` returns `{ evaluation, versions, scoreCurve, displayWeightedScore }`: the current single-row evaluation, up to 50 snapshots ordered newest revision first, and the curve-adjusted display score. The evaluation table remains the current state; `evaluation_versions` is the revision history.
- `GET /judging-results` groups active assignments by submission, averages only submitted weighted scores, excludes drafts and revoked assignments, ranks ties equally, and places unscored submissions last with a null rank. Each row includes `averageScore` (raw, used for ranking) and `displayScore` (edition curve, presentation only).
- `GET /judging/history` reads the caller's submitted evaluations from judging-owned tables and enriches them with submission metadata from `submissions.v1`, team names from `teams.v1`, division names from `competitions.v1`, and project context from `projects.v1`. Items include team, division, description, repository, demo, video, AI-use disclosure, submission state, the pinned rubric version, and the curve-adjusted display score. It does not require judging to be open.
- `GET /assignments/:assignmentId` returns the pinned rubric (including comment guidance), the edition score curve, and `displayWeightedScore` alongside the raw evaluation score. Assignment and submission summaries include team, division, description, repository, demo, video, AI-use disclosure, and submission state.
- `GET /competitions/:editionId/teams/:teamId/judging-feedback` returns `{ teamId, threshold, submittedCount, withheld, feedback }`. `feedback` contains only `{ comment, weightedScore, submittedAt }`; judge identity is never returned. Below three submitted evaluations the endpoint returns `withheld: true` and an empty list, and `judging.v1.listTeamFeedback` returns an empty list.
- `GET /judging-coverage` aggregates non-revoked assignments per judge: assignment count, submitted count, recusals, open flags, and the mean submitted weighted score. Calibration compares each judge's average with the edition average; a delta of at least 10 points is `above`, at most -10 is `below`, otherwise `in_line`. Judges without submitted scores are `insufficient_data`.
- A flag requires the caller to be the assigned judge and an assignment that is `assigned`, `in_progress`, or `submitted`. Resolving an already-resolved flag returns the existing flag without a second audit record.

## Audit

- `judging.rubric.created`
- `judging.rubric.version_created`
- `judging.rubric.published`
- `judging.rubric.archived`
- `judging.rubric_template.created`
- `judging.rubric_template.updated`
- `judging.rubric_template.deleted`
- `judging.rubric_template.applied`
- `judging.score_curve.updated`
- `judging.assignment.created`
- `judging.assignment.revoked`
- `judging.assignment.conflict_declared`
- `judging.evaluation.submitted`
- `judging.flag.reported`
- `judging.flag.resolved`

## Tests

`tests/judging-rules.test.ts` covers scoring math, weight and maximum-score handling, rounding, missing/duplicate/extra criteria, score bounds, deadline checks, assignment state transitions, and judge eligibility. `tests/rubric-model.test.ts` covers weight totals and tolerance, min/max bounds, rubric version numbers, rubric snapshots, and the score curve (interpolation, monotonicity, bounds, and ranking independence). `tests/judge-comments.test.ts` covers the 20-character minimum, unfilled placeholders, judge identity detection, and field-scoped errors. `tests/team-feedback.test.ts` covers the three-reviewer threshold and identity removal. `tests/evaluation-history.test.ts` covers revision numbering and snapshot mapping. `tests/judging-results.test.ts` covers submitted-only averaging, draft exclusion, tie ranking, and unscored submissions. `tests/judging-coverage.test.ts` covers coverage counts, draft exclusion, revoked exclusion, calibration labels, and the threshold. `tests/judge-flags.test.ts` covers flag eligibility and resolution transitions. `tests/e2e/04-judge-workflow.spec.ts` verifies assignment context and the submitted score in the edition results; `tests/e2e/12-judging-workflow.spec.ts` covers the judge queue, submission, history context, flag, and organizer coverage; `tests/e2e/17-rubric-tracks.spec.ts` covers division-scoped rubrics, versions, templates, the score curve, comment validation, and the judge's curve-adjusted view; `tests/e2e/26-judge-feedback.spec.ts` covers anonymous organizer feedback above and below the three-reviewer threshold and judge history context. The unit tests are pure and do not require a database.

## Extraction

The capability imports only other capabilities' `contracts.ts` files and Core interfaces. To extract it, move `apps/api/src/capabilities/judging` to a package, keep `judging.v1` and the event names stable, and provide the same Core services. Replace the read-only `users`/`organization_memberships` lookup with a contract when one exists.
