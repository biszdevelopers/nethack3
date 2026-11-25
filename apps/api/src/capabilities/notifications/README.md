# Notifications capability

Owns `notifications` and `notification_preferences`. Dependencies: `identity` (notifications are always scoped to a user; rows have no organization RLS predicate, so every query filters by `userId`).

## Routes

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/notifications?unread=true` | Caller's notifications, newest first |
| POST | `/api/v1/notifications/:notificationId/read` | Mark one notification read (idempotent) |
| POST | `/api/v1/notifications/read-all` | Mark all of the caller's notifications read |
| GET | `/api/v1/notifications/preferences` | Read email and in-app preferences |
| PATCH | `/api/v1/notifications/preferences` | Update both preferences |

Listing uses cursor pagination on `createdAt`. Missing preference rows default to `emailEnabled = true` and `inAppEnabled = true`.

## Events

Subscribed events are mapped to a single notification intent in `domain/notification-intents.ts`:

| Event                                  | Recipient                     | Kind                    |
| -------------------------------------- | ----------------------------- | ----------------------- |
| `organizations.membership.granted`     | `userId`                      | `system`                |
| `participants.registration.decided`    | `userId`                      | `registration_decision` |
| `teams.team.created`                   | `captainUserId` (unless self) | `system`                |
| `teams.invitation.created`             | `email` only                  | `team_invitation`       |
| `teams.invitation.accepted`            | `captainUserId`               | `system`                |
| `submissions.submission.reviewed`      | `userId`                      | `submission_review`     |
| `judging.assignment.created`           | `judgeUserId`                 | `judge_assignment`      |
| `voting.round.opened`                  | `userId`                      | `voting_open`           |
| `announcements.announcement.published` | none (skipped)                | -                       |

Payloads are read defensively. A missing required recipient or organization skips the event with a debug log; handlers never throw for optional shapes. Invitation emails are sent from `email` with no `userId`; all other events require a user recipient.

Event handlers enqueue `notifications.deliver` in the same transaction as the outbox consumption. Job payloads contain exactly `userId`, `email`, `organizationId`, `kind`, `title`, `body`, `linkUrl`, and `dedupeKey`. Links are absolute workspace URLs (`/`, `/competitions`, `/teams`, `/invitations?token=...`, `/submissions`, `/judging`, `/voting`).

## Delivery

The `notifications.deliver` job:

1. Reads the user's preference row (defaults allow both channels).
2. Inserts the in-app row when `inAppEnabled`, using `onConflictDoNothing` on `dedupeKey`.
3. Sends a plain-text email when an address is present, email is enabled, and `SMTP_URL` is configured.
4. Marks `emailSentAt` after a successful send.

Retries are safe for in-app rows: an existing row with `emailSentAt` set is not emailed again. Email-only invitations have no notification row to record delivery, so a retry after a successful send can resend that email.

Tokens and invitation links are never logged.
