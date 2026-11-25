# Participants capability

Owns competition registrations and participant records: who requested to compete, the organizer decision, waitlist state, withdrawal, and the participant row that other capabilities use for eligibility and team association.

## Dependencies

- `competitions` (`competitions.v1`) for edition existence, status, schedule, and division ownership, and for edition names in events.
- Organizations (`organizations.v1`) for organization names in events and the participant overview. `organizations` is reached through the declared `competitions -> organizations` chain.
- Core services: database transactions, clock, audit log, transactional outbox.

## Public contracts

`participants.v1` (`PARTICIPANTS_CONTRACT`). Every method runs inside `database.transaction({ organizationId })` so RLS exposes draft editions and the registration rows in the tenant scope.

| Method | Behavior |
| --- | --- |
| `getRegistration(organizationId, editionId, userId)` | Registration id, status, requested division, and participant id when approved. |
| `isApprovedParticipant(organizationId, editionId, userId)` | True when a participant row exists. |
| `countApprovedParticipants(organizationId, editionId)` | Count of participant rows for the edition. |
| `setParticipantTeam(organizationId, editionId, userId, teamId)` | Sets or clears the participant team reference; throws not found when no participant row exists. |

## Tables

Owned writes: `registrations`, `participants`.

Reads: `users` for display name and email. `competition_editions` is read only to lock the edition row (`SELECT ... FOR UPDATE`) around registration-window and capacity checks, and that locked state is used only for concurrency control.

## Routes and permissions

All routes require authentication. `x-nethack-organization-id` establishes the organization context. The edition must belong to that organization.

| Method | Route | Permission |
| --- | --- | --- |
| POST | `/api/v1/competitions/:editionId/registrations` | Active organization member |
| GET | `/api/v1/competitions/:editionId/registrations` | Owner or organizer |
| POST | `/api/v1/competitions/:editionId/registrations/:registrationId/decision` | Owner or organizer |
| DELETE | `/api/v1/competitions/:editionId/registrations/me` | Active organization member, own registration |
| GET | `/api/v1/me/participations` | Authenticated user |

## Rules

- Registration is accepted only while the edition status is `registration_open`. When registration open/close timestamps exist, the current time must fall inside the window.
- The `(editionId, userId)` unique constraint prevents duplicates; a violation is returned as `409 conflict`.
- Registration starts as `pending`. When approved capacity is reached it starts as `waitlisted` instead. Approval is always an organizer decision; organization settings are not consulted here.
- Decisions are allowed from `pending` or `waitlisted` only. Approving twice, deciding an approved registration, or re-deciding a rejected/withdrawn one is a conflict. Rejecting or waitlisting updates only the registration.
- Approval inserts the `participants` row in the same transaction and re-checks capacity under the edition row lock.
- Withdrawal is allowed from `pending`, `approved`, or `waitlisted`. A participant attached to a team must leave the team first; team membership is owned by the teams capability and is not modified here. Withdrawal deletes the participant row and marks the registration `withdrawn`.
- `/me/participations` reads one organization at a time with tenant context, then resolves edition and organization labels through the public contracts.

## Audit and events

Audited actions:

- `participant.registration.requested`
- `participant.registration.decided`
- `participant.registration.withdrawn`

Published events:

- `participants.registration.requested`
- `participants.registration.decided`

Both carry `{ userId, email, registrationId, organizationId, editionId, editionName, organizationName, status }`. `email` is the registrant email from `users` or the authenticated profile.

## Tests

`tests/registration-rules.test.ts` covers registration eligibility by status and window, initial pending/waitlisted state, decision transitions, capacity, and withdrawal rules. The tests are pure and do not require a database.

## Extraction

The folder depends on competitions only through `competitions.v1` and on Core interfaces. To extract it, move `apps/api/src/capabilities/participants` to a package, keep the contract and event names stable, and provide the same Core interfaces. No other capability imports its domain, application, infrastructure, or HTTP files.
