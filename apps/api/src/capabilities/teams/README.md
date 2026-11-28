# Teams capability

Version `1.0.0`. Dependencies: `competitions`, `participants`. Organization names come from the public `organizations.v1` contract, reached through the declared `competitions -> organizations` chain (same convention as `participants`).

Owns team formation for a competition edition: team records, membership, captaincy, email invitations, and the team activity feed. All database access runs through `database.transaction({ organizationId })` so row-level security sees an organization context.

## Routes

All routes require authentication (`AuthGuard`). Except for invitation acceptance, routes read the organization from the `x-nethack-organization-id` header and require the caller to be an active member of it.

| Method | Path | Access | Response |
| --- | --- | --- | --- |
| GET | `/api/v1/competitions/:editionId/teams` | active organization member | `listResponseSchema(teamSchema)` |
| POST | `/api/v1/competitions/:editionId/teams` | approved participant, no team in edition, registration open | `teamSchema` (201) |
| GET | `/api/v1/teams/:teamId` | active organization member | `teamDetailSchema` |
| PATCH | `/api/v1/teams/:teamId` | captain or owner/organizer | `teamDetailSchema` |
| POST | `/api/v1/teams/:teamId/invitations` | captain only | `teamInvitationSchema` (201) |
| POST | `/api/v1/team-invitations/accept` | authenticated invitee with matching email | `teamInvitationAcceptanceSchema` |
| DELETE | `/api/v1/teams/:teamId/members/:userId` | captain or owner/organizer; non-captain self-removal allowed | 204 |
| POST | `/api/v1/teams/:teamId/captain` | current captain or owner/organizer | 204 |
| POST | `/api/v1/teams/:teamId/leave` | non-captain team member | 204 |
| GET | `/api/v1/me/teams` | active organization member | `listResponseSchema(teamSchema)` |
| GET | `/api/v1/teams/:teamId/activity` | team member only | `listResponseSchema(auditLogSchema)` |

`POST /api/v1/team-invitations/accept` also requires `x-nethack-organization-id`, because `team_invitations` is protected by organization-scoped row-level security and the invitation cannot be located by token before an organization context is set. The header is only used as the RLS scope; the invitation's own organization and the caller's email are still verified.

## Rules

- One team per participant per edition. Creation and acceptance lock the participant's `registrations` row (`SELECT ... FOR UPDATE`) and re-check `team_members` joined to `teams` inside the transaction. `participants.team_id` is kept in sync through the participants contract.
- Division team-size limits override edition limits per field. The resolved maximum is stored on the team (`max_members`) at creation and when the division changes. `status: "ready"` requires the resolved minimum and maximum.
- Captaincy is always a team membership. Transfers update `teams.captain_user_id` and both `team_members.role` rows in one transaction. Removing or leaving as captain is rejected until captaincy is transferred.
- Invitations use a 32-byte random token; only its SHA-256 hash is stored. Tokens expire after 7 days and are delivered through the outbox event, never in the API response.
- PostgreSQL unique violations (`23505`) are mapped to `ConflictError` (team name, duplicate invitation, duplicate membership).
- Members list is visible to team members and owners/organizers. Invitations are visible only to the captain and owners/organizers. Member emails are never returned by the team list.
- Administration operations assume the caller is already an owner/organizer. A team with members cannot be deleted; the team row is locked, member rows are counted, and deletion refuses instead of removing members. Callers must also confirm through `submissions.v1` that the team has no submission.

## Domain events

- `teams.team.created` — team, organization, captain id/email.
- `teams.invitation.created` — invitation id, team, organization, email, raw token, role, expiry.
- `teams.invitation.accepted` — team, organization, captain user id.
- `teams.member.removed` — team, organization, removed user id (also emitted on leave).

Every mutation writes an `audit_logs` row with `entity_type = "team"` and `entity_id = teamId`; the activity route pages those rows.

## Contract

`TeamsContract` (`teams.v1`) exposes `getTeam`, `listEditionTeams`, `listEditionTeamsWithMembers`, `isTeamMember`, `getTeamForUser`, `countTeams`, `updateTeamStatus`, and `deleteTeam`. Each opens its own organization-scoped transaction and reports `memberCount` from `team_members`.

Administration methods (`updateTeamStatus`, `deleteTeam`) take a `{ userId, ip }` actor and assume authorization was already established. They enforce organization and edition scope, audit as `team.updated` / `team.deleted`, and never expose invitation tokens.
