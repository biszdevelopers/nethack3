# Deployment

Two interchangeable container targets, one source tree, one `bun.lock`, one environment schema.

```
Internet
   |
 Caddy  :80/:443   automatic HTTPS, security headers, body limits
   |-- www.nethack.example    -> site:3000    Next.js SSR
   |-- app.nethack.example    -> /srv/workspace (static workspace, SPA fallback)
   |-- api.nethack.example    -> api:3002     Fastify API
   `-- assets.nethack.example -> api:3002     cookieless asset responses

api/worker/migrate -> postgres:5432 (backend network only)
api/worker         -> /data/storage volume (uploaded files)
```

Both targets share the repository, lockfile and environment variables. Only the runtime base image, user name and start commands differ:

|  | Node target | Bun target |
| --- | --- | --- |
| Runtime base | `node:24-bookworm-slim` | `oven/bun:1.3.14-alpine` |
| Build base (both) | `oven/bun:1.3.14-alpine`, `bun install --frozen-lockfile` | same |
| API | `node apps/api/dist/main.js` | `bun apps/api/dist/main.js` |
| Worker | `node apps/api/dist/worker-main.js` | `bun apps/api/dist/worker-main.js` |
| Migration | `node apps/api/dist/migrate.js` | `bun apps/api/dist/migrate.js` |
| Site | `node apps/site/server.js` | `bun apps/site/server.js` |

## Prerequisites

- Docker Engine with Compose v2 (not installed on the machine this was authored on; see Verification).
- DNS A/AAAA records for `www`, `app`, `api`, `assets` pointing at the Docker host.
- Ports 80 and 443 reachable from the internet, or a reverse proxy in front.
- A PostgreSQL 18 instance. The compose file runs one, but `DATABASE_URL`/`DATABASE_MIGRATION_URL` may point at a managed instance instead.
- An app database role for runtime and an owner role for migrations/backups.

Create the non-owner runtime role once, before the first migration:

```sql
CREATE ROLE nethack_app LOGIN PASSWORD 'replace-with-app-password';
GRANT CONNECT ON DATABASE nethack TO nethack_app;
GRANT USAGE ON SCHEMA public TO nethack_app;
ALTER DEFAULT PRIVILEGES FOR ROLE nethack IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nethack_app;
```

`DATABASE_URL` uses `nethack_app`. `DATABASE_MIGRATION_URL` uses the owner role (`nethack` in the compose bootstrap). Never swap them.

## Configure

```sh
cd deployment
cp .env.production.example .env.production
# edit every placeholder; generate SESSION_ENCRYPTION_KEYS as described in the file
```

`.env.production` is git-ignored. Compose reads it two ways:

- `--env-file .env.production` supplies values for compose interpolation (`POSTGRES_PASSWORD`, build origins).
- `env_file: ../.env.production` injects runtime variables into `api`, `worker` and `migrate`. `api` and `worker` explicitly blank `DATABASE_MIGRATION_URL` and `POSTGRES_PASSWORD`, so owner credentials exist only in the one-shot `migrate` service.

The `site` container intentionally does not receive the env file: it only gets `PORT`, `HOSTNAME`, `PUBLIC_API_ORIGIN` and `WORKSPACE_ORIGIN`, so database and auth secrets are not present in the Next.js process. The `caddy` container receives no application secrets.

## Build and run

Node target:

```sh
docker compose --env-file deployment/.env.production -f deployment/node/compose.yaml build
docker compose --env-file deployment/.env.production -f deployment/node/compose.yaml up -d postgres
docker compose --env-file deployment/.env.production -f deployment/node/compose.yaml --profile migrate run --rm migrate
docker compose --env-file deployment/.env.production -f deployment/node/compose.yaml up -d
```

Bun target: identical commands with `deployment/bun/compose.yaml`.

The API never runs migrations on startup. The `migrate` service is behind the `migrate` profile, runs once, and exits; `up -d` does not start it.

## Workers

`worker` uses the API image with the worker entrypoint. Run one or more replicas; job leases make concurrency safe. It shares the `storage-data` volume with the API.

## Health checks

| Service | Check |
| --- | --- |
| `postgres` | `pg_isready` |
| `api` | `GET /health/ready` (includes database connectivity), in the image `HEALTHCHECK` |
| `site` | `GET /` |
| `worker` | process liveness (`process.kill(1, 0)`) |
| `caddy` | admin API `GET http://127.0.0.1:2019/config/`; verify routing with `curl -I https://www.nethack.example` |

```sh
docker compose --env-file deployment/.env.production -f deployment/node/compose.yaml ps
docker compose --env-file deployment/.env.production -f deployment/node/compose.yaml logs -f api worker caddy
```

## TLS

Caddy obtains and renews certificates automatically through ACME. Requirements:

- ports 80 and 443 are reachable and DNS resolves to this host;
- `deployment/caddy/Caddyfile` contains the real hostnames (it ships with `*.nethack.example` placeholders);
- the ACME account email in the Caddyfile global block is valid.

HTTPS-only settings (`__Host-` session cookie, HSTS) mean authentication does not work over plain HTTP. For localhost smoke testing:

1. map `www.nethack.example`, `app.nethack.example`, `api.nethack.example`, `assets.nethack.example` to `127.0.0.1` in the hosts file;
2. optionally publish Caddy as `8080:80` instead of `80:80` and use the commented localhost block at the bottom of the Caddyfile;
3. browsers will reject the `__Host-` cookie over plain HTTP, so use local hostnames with Caddy's local CA or a development TLS setup for auth flows.

## Backups and restore

Scripts use `pg_dump`/`pg_restore`/`psql` from `PATH`, or from `PG_BIN`. They require `DATABASE_MIGRATION_URL`, never print it, and run under Node 24 (type stripping) or Bun.

```sh
export DATABASE_MIGRATION_URL='postgres://nethack:...@db-host:5432/nethack'
export BACKUP_DIR=/var/backups/nethack

node scripts/backup-database.ts
node scripts/restore-database.ts /var/backups/nethack/nethack-2026-11-25T20-00-00-000Z.dump
```

- Backups are timestamped custom-format dumps (`--compress=9`) written through a `.partial` file and renamed on success.
- Tables use `FORCE ROW LEVEL SECURITY`, so the backup role must be a superuser or have `BYPASSRLS`; otherwise `pg_dump` fails or omits rows. The compose bootstrap owner is a superuser.
- Restore refuses a non-empty target unless `--force` is passed, then runs `pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error`.
- Optional `age` encryption: set `BACKUP_AGE_RECIPIENT` and `AGE_BIN`; the plaintext dump is removed after encryption. Restore with `BACKUP_AGE_IDENTITY`. Tested end to end with age 1.3.2 (170 KiB encrypted dump, 42-table restore).
- Retention is automated by `bun run db:prune-backups`, controlled by `BACKUP_RETENTION_DAYS` and `BACKUP_RETENTION_MINIMUM`.
- The compose database is not published on the host. Run backups from a host or sidecar with network access to PostgreSQL. For a managed database, point `DATABASE_MIGRATION_URL` at it directly.
- Test restores against a scratch database before relying on a dump.

## Hardening notes

- API, worker, site and Caddy run with read-only root filesystems, `no-new-privileges`, tmpfs `/tmp` and CPU/memory limits. PostgreSQL is writable by necessity.
- Only Caddy publishes ports. PostgreSQL is attached to an `internal: true` network; API/worker need the frontend network for Basis Auth, SMTP and OTLP.
- Uploads live on the `storage-data` volume mounted at `/data/storage`; `STORAGE_ROOT` must stay in sync with that mount.
- Caddy strips `Cookie` before proxying to the API on the assets host and strips `Set-Cookie` from asset responses. `Content-Disposition` and `X-Content-Type-Options: nosniff` are preserved/set.
- There is no authentication at the reverse proxy; the API and Basis Auth own authentication.

## Verification performed

Docker is not installed on the authoring host, so **no container image was built and no compose stack was started**. The following was verified directly:

- `bun install --frozen-lockfile --production` in an isolated temporary copy of the manifests and lockfile: **passed**, 566 packages; `apps/api/node_modules/fastify`, the `@nethack/contracts` workspace symlink and `packages/contracts/node_modules/zod` are present, so the API runtime copy layout in both Dockerfiles matches Bun's workspace install layout.
- `bun run --cwd packages/contracts build`: **passed**, `packages/contracts/dist/index.js` produced.
- `bun run --cwd packages/ui build`: **passed** on the final run, `packages/ui/dist` produced.
- `bun run --cwd apps/api build`: **passed**, `apps/api/dist` produced.
- `bun run --cwd apps/workspace build`: **passed**, `apps/workspace/dist` and the Caddy static asset tree produced.
- `bun run --cwd apps/site build` with `PUBLIC_API_ORIGIN=http://localhost:3002`, `WORKSPACE_ORIGIN=http://localhost:5173`: **passed**, dynamic App Router routes and the proxy compiled.
- Both compose files parse as YAML; anchors resolve and the service set is `postgres, api, worker, migrate, site, caddy`.
- `node scripts/backup-database.ts --help`, `node scripts/restore-database.ts --help`, and their missing-argument/missing-environment failure paths were executed successfully.
- Backup and restore were exercised end to end against a local PostgreSQL 18 instance: a 170 KiB custom-format dump was created, restored into a freshly created scratch database (42 tables), verified, and the scratch database was dropped. The non-empty-target guard refused the same dump against the migrated development database without modifying it.
- `bun run verify:runtime` passed all seven checks: API health 200 and site HTTP 200 under Node 24 and Bun, plus contracts, UI, and API builds.
- Caddy 2.11.9 validated the configuration: `caddy validate --config deployment/caddy/Caddyfile --adapter caddyfile` returned `Valid configuration`.
- k6 passed the checked-in load scenarios against the API with 0% failed requests and p95 96 ms for public reads.
- Lighthouse 13.6.0 reported 100 for performance, accessibility, best practices, and SEO on mobile and desktop production builds.
- `bun run db:prune-backups` applies `BACKUP_RETENTION_DAYS` and `BACKUP_RETENTION_MINIMUM`; it was exercised against synthetic dumps.
