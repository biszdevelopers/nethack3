# Recognition capability

Organizer awards, results publication, public results, and certificates.

## Public contracts

- `RecognitionContract.getPublishedResults(organizationId, editionId)` returns the stored publication snapshot or `null`.
- Consumes `CompetitionsContract`, `TeamsContract`, `SubmissionsContract`, `JudgingContract`, `VotingContract`, and `OrganizationsContract`. No other capability tables are read.

## Persistence

- `awards` — award catalog, unique by `(edition_id, namespace)`.
- `team_awards` — award assignments, unique by `(team_id, award_id)`; deleting an assigned award is refused.
- `edition_results` — one row per edition holding the immutable `publicResultsSchema` snapshot.

Migration `0005_fair_luckman.sql` enables forced row-level security on all three tables, grants the runtime role, adds an organization-scoped policy to each, and adds a public `SELECT` policy on `edition_results` for the public results and certificate routes. The public policy only exposes rows that organizers explicitly published.

## Routes

Organizer (owner or organizer role):

- `GET /api/v1/competitions/:editionId/awards`
- `POST /api/v1/competitions/:editionId/awards`
- `PATCH /api/v1/competitions/:editionId/awards/:awardId`
- `DELETE /api/v1/competitions/:editionId/awards/:awardId`
- `POST /api/v1/competitions/:editionId/teams/:teamId/awards/:awardId`
- `DELETE /api/v1/competitions/:editionId/teams/:teamId/awards/:awardId`
- `GET /api/v1/competitions/:editionId/results-status`
- `POST /api/v1/competitions/:editionId/results/publish`
- `DELETE /api/v1/competitions/:editionId/results/publish`

Authenticated member:

- `GET /api/v1/competitions/:editionId/my-results`

Public:

- `GET /api/v1/public/competitions/:slug/results`
- `GET /api/v1/public/certificates/:teamId`

## Events and audit

Publication, publication removal, and every award mutation write an audit record inside the same transaction. Domain events are not emitted.

## Tests

- `tests/recognition-rules.test.ts` — award request validation.
- `tests/results-assembly.test.ts` — ranking order, division resolution, award attachment, People's Choice selection, and certificate eligibility.
