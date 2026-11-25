# Judging capability

Owns judging rubrics, criteria, judge assignments, evaluations, and evaluation scores. It decides who judges which submission, how a rubric produces a weighted score, and when an evaluation is a draft or submitted.

## Dependencies

- `submissions` (`submissions.v1`) for submission existence, project title, team id, and edition membership.
- `competitions` (`competitions.v1`) for edition existence inside the organization.
- `organizations` (`organizations.v1`) for the organization name in assignment events.
- Core services: database transactions, clock, audit log, transactional outbox.

## Public contract

`judging.v1` (`JUDGING_CONTRACT`):

| Method | Behavior |
| --- | --- |
| `getAssignment(organizationId, assignmentId)` | Assignment summary and whether its evaluation is submitted. Runs in an organization-scoped transaction. |
| `countSubmittedEvaluations(organizationId, editionId)` | Count of submitted evaluations for an edition. Runs in an organization-scoped transaction. |
| `getEvaluation(organizationId, assignmentId)` | The evaluation with scores, or `null`. Runs in an organization-scoped transaction. |

## Tables

Owned writes: `judging_rubrics`, `judging_criteria`, `judge_assignments`, `evaluations`, `evaluation_scores`. All access is organization-scoped through row-level security.

Read-only joins outside the capability:

- `users` and `organization_memberships` resolve a judge by email and verify that the judge is an active owner, organizer, or judge in the organization. This is directory and membership data. Move it to an identity or organizations contract when one exposes those lookups.
- Submissions, projects, and teams are never read directly. Submission data comes from `submissions.v1`. The assignment detail exposes `teamId`; resolving a team display name would require the `teams` contract, which is not a judging dependency.

## Routes and permissions

All routes require authentication. Routes without an organization in the path use `x-nethack-organization-id`. Every edition route also verifies that the edition belongs to the organization.

| Method | Route | Permission |
| --- | --- | --- |
| GET | `/api/v1/competitions/:editionId/rubrics` | Active organization member |
| POST | `/api/v1/competitions/:editionId/rubrics` | Owner or organizer |
| GET | `/api/v1/competitions/:editionId/assignments` | Owner or organizer |
| POST | `/api/v1/competitions/:editionId/assignments` | Owner or organizer |
| GET | `/api/v1/judging/assignments?status=` | Active organization member; returns only the caller's assignments |
| GET | `/api/v1/assignments/:assignmentId` | Assigned judge or owner/organizer |
| POST | `/api/v1/assignments/:assignmentId/conflict` | Assigned judge |
| PUT | `/api/v1/assignments/:assignmentId/evaluation` | Assigned judge |
| POST | `/api/v1/assignments/:assignmentId/evaluation/submit` | Assigned judge |
| GET | `/api/v1/assignments/:assignmentId/history` | Assigned judge or owner/organizer |
| POST | `/api/v1/assignments/:assignmentId/revoke` | Owner or organizer |

The assignment is the scoring authority. An organizer who is not the assigned judge cannot save or submit an evaluation. Organizers can view assignments and evaluations inside their organization.

## Rubric and assignment rules

- Creating a rubric inserts the rubric and its criteria in one transaction. Criterion `position` is the array index.
- Creating an assignment resolves the judge by email, requires an active `owner`, `organizer`, or `judge` membership, requires the submission to belong to the edition and organization, and requires the rubric to belong to the edition.
- Duplicate active assignment (`submission_id`, `judge_user_id`) is a `409 conflict`. A previously revoked assignment is revived in place so the unique index remains valid.
- `judge.assignment.created` is published with `{ assignmentId, submissionId, projectTitle, judgeUserId, judgeEmail, email, organizationId, organizationName, editionId, dueAt }`. `email` duplicates `judgeEmail` because the notification handler reads `email`.
- A judge can declare a conflict while the assignment is `assigned` or `in_progress`. The note is stored and the status becomes `conflict_declared`. Conflicted assignments cannot be evaluated.
- Revoking sets `revoked` and prevents any later evaluation. Revocation is idempotent and does not delete a submitted evaluation.
- A deadline set on the assignment rejects evaluation saves and submissions after `dueAt` with `409 conflict`. Conflict declarations are not deadline-bound.

## Evaluation rules

- A save requires exactly one score for every rubric criterion and no others. Each score is an integer between `0` and the criterion `maxScore`.
- `weightedScore = round2(sum(score / maxScore * weight) / sum(weight) * 100)`.
- Saving upserts the single evaluation row (`unique(assignment_id)`), replaces all score rows (`unique(evaluation_id, criterion_id)`), and moves the assignment to `in_progress`.
- Submitting requires a draft evaluation, a complete scorecard, and an open assignment. It sets the evaluation and assignment to `submitted`, records `submittedAt`, and publishes `judging.evaluation.submitted` with `{ assignmentId, submissionId, projectId, judgeUserId, organizationId, editionId, weightedScore }`.
- Evaluations are single-row per assignment, so `GET /history` returns the current evaluation and nothing else. The audit log remains the immutable history.

## Audit

- `judging.rubric.created`
- `judging.assignment.created`
- `judging.assignment.revoked`
- `judging.assignment.conflict_declared`
- `judging.evaluation.submitted`

## Tests

`tests/judging-rules.test.ts` covers scoring math, weight and maximum-score handling, rounding, missing/duplicate/extra criteria, score bounds, deadline checks, assignment state transitions, and judge eligibility. The tests are pure and do not require a database.

## Extraction

The capability imports only other capabilities' `contracts.ts` files and Core interfaces. To extract it, move `apps/api/src/capabilities/judging` to a package, keep `judging.v1` and the event names stable, and provide the same Core services. Replace the read-only `users`/`organization_memberships` lookup with a contract when one exists.
