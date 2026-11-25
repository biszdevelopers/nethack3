# Projects capability

Owns project metadata, project membership, publication state, and the public project showcase. Depends on `organizations`, `competitions`, `participants`, and `teams`.

## Layers

- `domain/project-rules.ts` — visibility, edit/publish permissions, slug generation, edition gating.
- `application/project-service.ts` — use cases and response mapping.
- `infrastructure/project-repository.ts` — Drizzle queries, tenant-scoped through `database.transaction({ organizationId })`.
- `http/project-routes.ts` — Fastify routes and validation.
- `contracts.ts` — the fixed `projects.v1` contract consumed by `files` and later `submissions`.

## Routes

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/projects` | Organization header required. Filters `editionId`, `teamId`, `mine`; cursor pagination on `created_at`. Organizers see the whole organization, everyone else sees owned, member, or team projects. |
| POST | `/api/v1/projects` | Approved participant registration for the edition; optional team must belong to the edition and the caller must be a team member. |
| GET | `/api/v1/projects/:projectId` | Team members and project members may read. `submissions` is always `[]`; submission data belongs to the submissions capability. |
| PATCH | `/api/v1/projects/:projectId` | Project owner, project member with role `owner`, or organization owner/organizer. |
| POST | `/api/v1/projects/:projectId/publish` | Project owner or organizer. Edition must not be `draft`, `registration_open`, or `archived`. Emits `projects.project.published`. |
| GET/POST | `/api/v1/projects/:projectId/members` | List members or add an approved participant / team member by email. |
| GET | `/api/v1/public/projects` | No auth. RLS public predicates plus explicit published/showcase filters. |
| GET | `/api/v1/public/projects/:slug` | No auth. Slug is unique per organization, so a cross-organization collision resolves to the most recently published project. |

## Data ownership

Project detail deliberately does not query `submissions` or `submission_versions`. The `submissions` capability serves that data through its own contract/routes. Team names and eligibility are read through the `teams` contract; edition state through `competitions`; registrations through `participants`.

## Security notes

- Every authenticated read and write runs inside a transaction that sets the organization context, so RLS applies in addition to API authorization.
- Public reads use `database.db` without tenant context, which leaves only the RLS public predicates active.
- Project slugs are `slugified-title-xxxxxx`; the database unique constraint on `(organization_id, slug)` is the final authority.
- All mutations are audited with `audit_logs` rows inside the same transaction.
