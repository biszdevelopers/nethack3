# Development

## Prerequisites

- Node.js 24 or newer.
- Bun 1.3.14 (pinned; the only package manager).
- PostgreSQL 14 or newer. PostgreSQL 18 is the tested version.

## Install

```
bun install --frozen-lockfile
```

The repository uses a single `bun.lock`. Do not create a second lockfile or use pnpm.

## Local PostgreSQL

Any PostgreSQL instance works. For an isolated project-local cluster:

```
initdb -D .data/pg -U nethack --pwfile=.data/pw.txt --auth-host=scram-sha-256
pg_ctl -D .data/pg -l .data/pg.log start
createdb -h 127.0.0.1 -p 55432 -U nethack nethack
createdb -h 127.0.0.1 -p 55432 -U nethack nethack_test
```

Create the runtime role without superuser or `BYPASSRLS` and grant connection:

```
CREATE ROLE nethack_app LOGIN PASSWORD '...' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
GRANT CONNECT ON DATABASE nethack, nethack_test TO nethack_app;
ALTER DEFAULT PRIVILEGES FOR ROLE nethack IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nethack_app;
```

`.data/` is ignored. Do not commit local data directories or `.env`.

## Configuration

Copy `.env.example` to `.env` and set:

- `DATABASE_URL` — runtime role.
- `DATABASE_MIGRATION_URL` — owner role used only by migrations and the development seed.
- `SESSION_ENCRYPTION_KEYS` — comma-separated 32-byte base64 keys; the first key encrypts new secrets. Required in production.
- `BASIS_AUTH_*` — see `docs/integrations/basis-auth.md`.
- Origins — API, workspace, site, assets. All HTTPS in production.

Production validation rejects the development client secret, insecure origins, insecure provider HTTP, and missing encryption keys.

## Database

```
bun run --cwd apps/api db:generate   # after schema changes
bun run --cwd apps/api db:migrate    # owner credential
bun run --cwd apps/api db:seed       # opt-in development fixtures; refuses production
```

The seed creates an organization named `Example Workspace (development fixture)` and three fixture identities (`fixture-organizer`, `fixture-participant`, `fixture-judge`) that a test identity provider can issue. Never seed production.

## Run

```
bun run dev          # API, workspace, and site
bun run dev:node     # API built and started with Node, site with Node
```

The development script builds shared packages when their `dist` output is missing and terminates all child processes cleanly.

## Checks

```
bun run format:check
bun run lint
bun run typecheck
bun run test                 # unit, architecture, security unit tests
bun run test:integration     # real PostgreSQL and mock identity provider
bun run test:e2e
bun run verify:runtime       # Node and Bun production builds and health
bun run check
```

Vitest executes under Node because Vitest 5 worker pools are incompatible with Bun 1.3 on Windows. Runtime verification still runs the actual API and site under both runtimes.

## Conventions

Read `AGENTS.md` and `docs/engineering/constitution.md`. Use Oxfmt and Oxlint only. Do not add dependencies without a concrete requirement. Do not disable tests. Do not leave placeholders. Commit messages use conventional commits in American English.
