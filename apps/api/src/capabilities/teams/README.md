# Teams capability

Version `1.0.0`. Dependencies: `competitions`, `participants`. Organization names come from the public `organizations.v1` contract, reached through the declared `competitions -> organizations` chain (same convention as `participants`). Disbanding reads `submissions.v1` lazily through the contract registry because `submissions` already depends on `teams`; declaring it here would form a cycle.

Owns team formation for a competition edition: team records, membership, captaincy, email invitations, and the team activity feed. All database access runs through `database.transaction({ organizationId })` so row-level security sees an organization context.

## Routes

All routes require authentication (`AuthGuard`). Except for invitation acceptance, routes read the organization from the `x-nethack-organization-id` header and require the caller to be an active member of it.

| Method | Path | Access | Response |
| --- | --- | --- | --- |
| GET | `/api/v1/competitions/:editionId/teams` | active organization member | `listResponseSchema(teamSchema)` |
| POST | `/api/v1/competitions/:editionId/teams` | approved participant, no team in edition, registration open | `teamSchema` (201) |
| GET | `/api/v1/teams/:teamId` | active organization member | `teamDetailSchema` |
| PATCH | `/api/v1/teams/:teamId` | captain or owner/organizer | `teamDetailSchema` |
| POST | `/api/v1/teams/:teamId/invitations` | captain only | `teamInvitationCreatedSchema` (201) |
| POST | `/api/v1/teams/:teamId/invitations/:invitationId/link` | captain only | `teamInvitationLinkSchema` |
| DELETE | `/api/v1/teams/:teamId/invitations/:invitationId` | captain only; pending invitations only | 204 |
| POST | `/api/v1/team-invitations/accept` | authenticated invitee with matching email | `teamInvitationAcceptanceSchema` |
| POST | `/api/v1/team-invitations/:invitationId/accept` | authenticated invitee with matching email | `teamInvitationAcceptanceSchema` |
| POST | `/api/v1/team-invitations/:invitationId/decline` | authenticated invitee with matching email | 204 |
| GET | `/api/v1/me/team-invitations` | active organization member | `listResponseSchema(myTeamInvitationSchema)` |
| DELETE | `/api/v1/teams/:teamId` | captain or owner/organizer; disbands the team | 204 |
| DELETE | `/api/v1/teams/:teamId/members/:userId` | captain or owner/organizer; non-captain self-removal allowed | 204 |
| POST | `/api/v1/teams/:teamId/captain` | current captain or owner/organizer | 204 |
| POST | `/api/v1/teams/:teamId/leave` | team member; a solo captain disbands the team | 204 |
| GET | `/api/v1/me/teams` | active organization member | `listResponseSchema(teamSchema)` |
| GET | `/api/v1/teams/:teamId/activity` | team member only | `listResponseSchema(auditLogSchema)` |

Invitation routes also require `x-nethack-organization-id`, because `team_invitations` is protected by organization-scoped row-level security and the invitation cannot be located before an organization context is set. The header is only used as the RLS scope; the invitation's own organization and the caller's email are still verified.

## Rules

- One team per participant per edition. Creation and acceptance lock the participant's `registrations` row (`SELECT ... FOR UPDATE`) and re-check `team_members` joined to `teams` inside the transaction. `participants.team_id` is kept in sync through the participants contract.
- Division team-size limits override edition limits per field. The resolved maximum is stored on the team (`max_members`) at creation and when the division changes. `status: "ready"` requires the resolved minimum and maximum.
- Team statuses are `forming`, `ready`, `withdrawn`, `disqualified`, `no_show`, and `disbanded`. Only `forming` and `ready` can change status; the other values are terminal. `disqualified` and `no_show` are organizer-only. A terminal status requires a trimmed reason of 5 to 500 characters, stored in `teams.status_reason` and returned as `statusReason`; returning to `forming` or `ready` clears it. Inactive teams reject updates, invitations, invitation acceptance, captain transfers, and readiness, while members may still leave.
- Captaincy is always a team membership. Transfers update `teams.captain_user_id` and both `team_members.role` rows in one transaction. A captain with other members cannot leave until captaincy is transferred; a solo captain leaves by disbanding.
- Invitations use a 32-byte random token; only its SHA-256 hash is stored. Tokens expire after 7 days. The raw token and relative `/invitations?token=...` link are returned once when an invitation is created and again when the captain rotates the link for a pending invitation.
- Pending, unexpired invitations reserve roster seats: creating an invitation requires `members + pending invitations < maxMembers`. Expired invitations are reported and treated as expired; they cannot be accepted, declined, revoked, or have their link rotated. Re-inviting the same email reuses the existing row with a fresh token and expiry.
- Disbanding keeps the team row and history: the status becomes `disbanded`, pending invitations are revoked, every member row is removed, and participants are detached. A team with any submission cannot be disbanded.
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

`TeamsContract` (`teams.v1`) exposes `getTeam`, `listEditionTeams`, `listEditionTeamsWithMembers`, `isTeamMember`, `getTeamForUser`, `countTeams`, `updateTeamStatus`, and `deleteTeam`. Each opens its own organization-scoped transaction and reports `memberCount` from `team_members`; team summaries include `statusReason`.

Administration methods (`updateTeamStatus`, `deleteTeam`) take a `{ userId, ip }` actor and assume authorization was already established. `updateTeamStatus` also takes the status reason and rejects terminal statuses without a valid one. Both enforce organization and edition scope, audit as `team.updated` / `team.deleted`, and never expose invitation tokens.
