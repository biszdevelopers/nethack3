# Voting capability

Owns voting rounds, ballots, and votes. Organizers create rounds for a competition edition, control the round lifecycle, and read results. Eligible members cast one star ballot per round and may replace it until the round closes. The capability never counts votes on the client; vote integrity is enforced by the API and the database.

## Dependencies

- `organizations` (`organizations.v1`) for the organization name used in round events.
- `competitions` (`competitions.v1`) to confirm the edition belongs to the organization and resolve division (track) names.
- `participants` (`participants.v1`) to require an approved registration for the participant role.
- `submissions` (`submissions.v1`) for submission titles, edition membership, and votable status.
- `teams` (`teams.v1`) for the voter's team, ballot scope, and team/division names on the votable-submission discovery list.
- Core services: database transactions, clock, audit log, transactional outbox.

## Public contracts

`voting.v1` (`VOTING_CONTRACT`):

| Method | Behavior |
| --- | --- |
| `listRounds(organizationId, editionId)` | All rounds of the edition, in an organization-scoped transaction. |
| `getPublishedResults(organizationId, editionId)` | Results for published rounds only. Totals come from grouped SQL over `votes`; titles from `submissions.v1`. |
| `closeOpenRoundsForResults(session, organizationId, editionId, actorUserId)` | Results publication freeze: closes every `open` round of the edition inside the caller's transaction. |

## Star ballots

A ballot is a list of `{ submissionId, stars }` scores. Each scored submission receives 1 to 5 stars and the whole ballot must distribute exactly 10 stars, so at least two submissions must be scored. A submission appears at most once, and no more than the round's effective cap may be scored. The effective cap is `maxVotesPerUser` when it is greater than zero, otherwise `maxSelections`; when both are set the lower one wins. `maxVotesPerUser = 0` means no extra cap beyond `maxSelections`.

A ballot may carry optional `reasoning` text up to 2000 characters. It is stored on the ballot, returned to its author, and included only in organizer result payloads (`audit`) for review; it never appears in published public results.

`votes.stars` stores the awarded stars (integer, 1 to 5, database check constraint). Ballots remain editable while the round is `open`: recasting deletes the previous votes and inserts the new scores inside the same transaction, keeping the ballot row and its unique constraints.

## Tables

Owned: `voting_rounds`, `ballots`, `votes`. Every read and write runs inside `database.transaction({ organizationId })` so row-level security applies. The capability does not read submissions, projects, teams, or competitions tables directly.

## Routes and permissions

All routes require authentication. `x-nethack-organization-id` establishes the organization context for round-scoped routes.

| Method | Route | Permission |
| --- | --- | --- |
| GET | `/api/v1/competitions/:editionId/voting-rounds` | Active organization member |
| GET | `/api/v1/competitions/:editionId/votable-submissions` | Owner or organizer; judge/participant when a round of the edition lists their role |
| POST | `/api/v1/competitions/:editionId/voting-rounds` | Owner or organizer; creates a `draft` round |
| POST | `/api/v1/voting-rounds/:roundId/open` | Owner or organizer; `draft -> open` |
| POST | `/api/v1/voting-rounds/:roundId/close` | Owner or organizer; `open -> closed` |
| POST | `/api/v1/voting-rounds/:roundId/publish` | Owner or organizer; `closed -> published` |
| GET | `/api/v1/voting-rounds/:roundId/ballot` | Eligible voter with a submitted ballot; round must be `open` or `closed` |
| POST | `/api/v1/voting-rounds/:roundId/ballot` | Eligible voter while the round is `open` and inside the window; creates or replaces the caller's ballot |
| GET | `/api/v1/voting-rounds/:roundId/results` | Owner or organizer always; other members only when `published` |
| GET | `/api/v1/competitions/:editionId/results` | Owner or organizer for all rounds; other members only for published rounds |

## Rules

- Round transitions are allowlisted: `draft -> open`, `open -> closed`, `closed -> published`. Anything else is a `409 conflict`. Repeating a status is also a conflict.
- Opening validates `opensAt`/`closesAt` ordering and rejects a window that has already ended.
- A ballot is accepted only while the round is `open` and `now` is inside `opensAt`/`closesAt`.
- Results publication freezes the edition: while the edition status is `completed` or `archived`, creating, opening, closing, or publishing rounds and casting ballots are rejected with `409 conflict`. Unpublishing results restores the previous edition status but does not reopen rounds or delete ballots.
- Eligibility: the caller's active organization role must be listed in `eligibleRoles`. `owner` counts as `organizer`. A caller whose effective role is `participant` must also have an approved registration for the edition; `judge` and `organizer` need no registration.
- Ballot scope: a voter's ballot lists only submissions from the voter's own division (track), excluding submissions owned by the voter's own team. The voter's team is resolved through `teams.v1.getTeamForUser(organizationId, editionId, userId)`. Organizers and owners may review every votable submission for management; a cast still re-applies the same scope when they belong to a team in the edition.
- Fallbacks: a voter with no team in the edition (or no division on that team) is not narrowed down; their ballot lists every votable submission, excluding the voter's own team when one is known. A voter whose team is `withdrawn`, `disqualified`, `no_show`, or `disbanded` gets no ballot options and every cast is rejected. `forming` and `ready` teams can vote.
- Scoring rules: unique submission IDs, between 1 and the effective scored-project cap (see above), every score from 1 to 5 stars, exactly 10 stars in total, all submissions belonging to the round's edition, in a votable status (`submitted`, `under_review`, `changes_requested`, `accepted`), inside the voter's division, and never owned by the voter's own team. `draft`, `rejected`, `disqualified`, and `withdrawn` submissions are rejected. The same scope is re-applied when the ballot is cast; the API never trusts the client's project list.
- Casting locks the round row with `SELECT ... FOR UPDATE`, re-checks the window, and writes the ballot and its votes in one transaction. A first cast inserts the ballot; a recast deletes the existing votes and inserts the new scores. The `(round, user)` and `(round, user, submission)` unique constraints remain the final defense.
- Results group votes per submission with `count(*)` (ballots) and `SUM(stars)`, then rank by average stars descending, total stars descending, and project title ascending. Each entry carries `rank`, `votes`, `totalStars`, `averageStars` (rounded to two decimals), and the resolved team name. Rank 1 is the People's Choice. `totalBallots` is the real ballot count; `publishedAt` is null until the round is published.
- Votable-submission discovery returns only submissions in the ballot's votable set and scope, mapped to `{ id, projectTitle, summary, teamId, teamName, divisionName, videoUrl, aiDisclosure, repositoryUrl, demoUrl }`. Team names and division names are resolved through `teams.v1` and `competitions.v1` once per distinct team in the filtered result set; a missing team or division yields a null name. A missing voter team is the documented safe fallback (whole votable set); an inactive voter team yields an empty list. The endpoint is authenticated and relies on the server default `Cache-Control: private, no-store`.

## Audit and events

Audited: `voting.round.created`, `voting.round.opened`, `voting.round.closed`, `voting.round.published`, `voting.ballot.cast`. Ballot audit metadata contains the edition, the number of scored submissions, the total stars, and whether the cast replaced an earlier ballot; reasoning is stored on the ballot rather than copied into audit metadata. Results publication closes open rounds with the `results_published` reason.

Published events: `voting.round.opened`, `voting.round.closed`, `voting.round.published`, each with `{ organizationId, organizationName, editionId, roundId, roundName }`. Freeze closures omit `organizationName` and add `reason: "results_published"`.

## Tests

`tests/voting-rules.test.ts` covers every allowed and forbidden transition, schedule and window validation, star allocation rules (exact total, per-submission bounds, duplicates, scored-project cap, per-voter cap, edition freeze), eligibility (including owner-as-organizer and participant approval), result visibility, and votable submission statuses. `tests/ballot-eligibility.test.ts` covers same-division acceptance, own-team and out-of-division rejection, the teamless and divisionless fallbacks, and inactive teams on cast. `tests/ballot-schema.test.ts` covers reasoning bounds and ballot defaults. `tests/voting-results.test.ts` covers star aggregation, average rounding, ranking, and the People's Choice leader. `tests/votable-submissions.test.ts` covers discovery filtering (status, same division, own team, teamless fallback, inactive team), field mapping including `divisionName`, and team/division name resolution. The tests are pure and do not require a database.

## Extraction

The folder depends on other capabilities only through their `contracts.ts` and on Core interfaces for transactions, clock, audit, and events. To extract it, move the folder to a package, keep `voting.v1` and the event names stable, and provide the same Core interfaces.
