# Deployment

The supported topology is conventional long-running services behind a reverse proxy. There is no serverless deployment, no Kubernetes requirement, and no service per capability.

```
internet
  -> reverse proxy (TLS, rate limits, request size limits)
     -> www       Next.js public site
     -> app       static workspace build
     -> api       Fastify authoritative API
     -> assets    cookieless file downloads through the API
  -> PostgreSQL
  -> Basis Auth (independent identity provider)
```

## Targets

- `deployment/node` — Node.js 24 runtime images and compose file.
- `deployment/bun` — Bun 1.3.14 runtime images and compose file.
- `deployment/caddy` — static workspace hosting and reverse proxy configuration.

Both targets use the same source tree, the same `bun.lock`, the same environment-variable schema, and the same application contracts. The acceptance criterion is identical behavior, not identical internals.

## Runtime commands

API:

```
node apps/api/dist/main.js       # Node
bun apps/api/dist/main.js        # Bun
node apps/api/dist/worker-main.js
bun apps/api/dist/worker-main.js
```

Public site (standalone build):

```
node apps/site/server.js
bun apps/site/server.js
```

Workspace: static files only. Serve with an SPA fallback and strict headers.

## Procedure

1. Build contracts, UI, API, workspace, and site (`bun run build`).
2. Build the target image from `deployment/<runtime>`.
3. Run the migration job once with `DATABASE_MIGRATION_URL`. Never migrate automatically on API start.
4. Start the API, worker, site, and proxy.
5. Verify `/health` and `/health/ready` on the API, and `/` on the site.
6. Run the smoke checks and the relevant E2E workflow against staging.

`deployment/README.md` contains the exact commands, volumes, limits, and rollback notes. Database backups use `scripts/backup-database.ts` and `scripts/restore-database.ts`; see `docs/operations/backups.md`.

## Security boundaries

- The public site has no database credentials, no Basis Auth client secret, no application session cookie, and no administrative credentials.
- The workspace build contains no server secrets.
- Uploaded files are served from a separate cookieless origin configured as `ASSET_ORIGIN`.
- API and asset responses never share a cache with authenticated workspace responses. Authenticated API responses are `private, no-store`.

## Rollback

Keep the previous image and migration state. API migrations are forward-only; restore from a verified backup if a destructive change must be undone. Route traffic back to the previous image before rolling back configuration. Re-run authentication and health checks after rollback.
