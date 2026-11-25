# Announcements capability

Owns `announcements`. Dependencies: `organizations` (uses the public `organizations.v1` contract for organization names and public slug lookup).

## Routes

| Method | Path                                                  | Access                          |
| ------ | ----------------------------------------------------- | ------------------------------- |
| GET    | `/api/v1/organizations/:organizationId/announcements` | Any active member               |
| POST   | `/api/v1/organizations/:organizationId/announcements` | Owner or organizer              |
| POST   | `/api/v1/announcements/:announcementId/publish`       | Owner or organizer (org header) |
| PATCH  | `/api/v1/announcements/:announcementId`               | Owner or organizer (org header) |
| GET    | `/api/v1/public/announcements?organization=<slug>`    | Anonymous                       |

Drafts (`published_at is null`) are listed only for owners and organizers. Requests without an organization in the path use the `x-nethack-organization-id` header, matching the core guard.

`bodyMarkdown` is stored as plain text input. The API never renders or sanitizes HTML; any rendering must treat it as untrusted Markdown.

## Behavior

- Creating with `publish: true` sets `publishedAt` immediately.
- Publishing is idempotent: an already published announcement is returned without emitting another event. `published_at` is only set once.
- PATCH changes `title`, `bodyMarkdown`, or `visibility`. It does not unpublish.
- DELETE is not implemented because announcements have no deleted state.
- Every mutation writes an audit record (`announcement.created`, `announcement.updated`, `announcement.published`).
- Published announcements emit `announcements.announcement.published` with `{ announcementId, title, organizationId, organizationName, visibility }`.
- Public listing returns only `visibility = public` rows with a non-null `publishedAt`; tenant row-level security enforces the same predicate.
- Public responses use `Cache-Control: public` with a short max-age. All authenticated responses rely on the server default `private, no-store`.

## Contract

`announcements.v1` exposes `listPublished(organizationId, { limit })` for read-only consumers. `publish` uses `organizations.v1` for the organization name in the event payload, and public listings resolve `organization=<slug>` through `organizations.v1`.
