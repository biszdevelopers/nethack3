# Voting capability

Owns voting rounds, ballots, and votes. Organizers create rounds for a competition edition, control the round lifecycle, and read results. Eligible members cast one ballot per round. The capability never counts votes on the client; vote integrity is enforced by the API and the database.

## Dependencies

- `organizations` (`organizations.v1`) for the organization name used in round events.
- `competitions` (`competitions.v1`) to confirm the edition belongs to the organization.
- `participants` (`participants.v1`) to require an approved registration for the participant role.
- `submissions` (`submissions.v1`) for submission titles, edition membership, and votable status.
- `teams` (`teams.v1`) for team names on the votable-submission discovery list.
- Core services: database transactions, clock, audit log, transactional outbox.

## Public contracts

`voting.v1` (`VOTING_CONTRACT`):

| Method | Behavior |
| --- | --- |
| `listRounds(organizationId, editionId)` | All rounds of the edition, in an organization-scoped transaction. |
| `getPublishedResults(organizationId, editionId)` | Results for published rounds only. Counts come from grouped SQL over `votes`; titles from `submissions.v1`. |

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
| POST | `/api/v1/voting-rounds/:roundId/ballot` | Eligible voter while the round is `open` and inside the window |
| GET | `/api/v1/voting-rounds/:roundId/results` | Owner or organizer always; other members only when `published` |
| GET | `/api/v1/competitions/:editionId/results` | Owner or organizer for all rounds; other members only for published rounds |

## Rules

- Round transitions are allowlisted: `draft -> open`, `open -> closed`, `closed -> published`. Anything else is a `409 conflict`. Repeating a status is also a conflict.
- Opening validates `opensAt`/`closesAt` ordering and rejects a window that has already ended.
- A ballot is accepted only while the round is `open` and `now` is inside `opensAt`/`closesAt`.
- Eligibility: the caller's active organization role must be listed in `eligibleRoles`. `owner` counts as `organizer`. A caller whose effective role is `participant` must also have an approved registration for the edition; `judge` and `organizer` need no registration.
- Selection rules: unique submission IDs, between 1 and `maxSelections`, all belonging to the round's edition, and in a votable status (`submitted`, `under_review`, `changes_requested`, `accepted`). `draft`, `rejected`, `disqualified`, and `withdrawn` are rejected.
- Casting locks the round row with `SELECT ... FOR UPDATE`, re-checks the window, inserts the ballot and its votes in one transaction, and relies on the `(round, user)` and `(round, user, submission)` unique constraints as the final defense. A second ballot is a `409 conflict`.
- Results count votes with one grouped query per round, ordered by votes descending then project title ascending, limited to 200 entries. `totalBallots` is the real ballot count; `publishedAt` is null until the round is published. Team names are not resolved on results, so `teamName` is null.
- Votable-submission discovery returns only submissions in the ballot's votable set, mapped to `{ id, projectTitle, summary, teamId, teamName }`. Team names are resolved through `teams.v1` once per distinct team in the filtered result set; a missing team yields a null name. The endpoint is authenticated and relies on the server default `Cache-Control: private, no-store`.

## Audit and events

Audited: `voting.round.created`, `voting.round.opened`, `voting.round.closed`, `voting.round.published`, `voting.ballot.cast`. Ballot audit metadata contains the edition and the number of selections, never the selected submissions or vote contents.

Published events: `voting.round.opened`, `voting.round.closed`, `voting.round.published`, each with `{ organizationId, organizationName, editionId, roundId, roundName }`.

## Tests

`tests/voting-rules.test.ts` covers every allowed and forbidden transition, schedule and window validation, selection rules, eligibility (including owner-as-organizer and participant approval), result visibility, and votable submission statuses. `tests/votable-submissions.test.ts` covers discovery filtering, field mapping, and team-name resolution. The tests are pure and do not require a database.

## Extraction

The folder depends on other capabilities only through their `contracts.ts` and on Core interfaces for transactions, clock, audit, and events. To extract it, move the folder to a package, keep `voting.v1` and the event names stable, and provide the same Core interfaces.
