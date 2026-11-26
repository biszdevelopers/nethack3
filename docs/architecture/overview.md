# Architecture overview

System context, application boundaries, and the structural rules of the Nethack3 Capability Architecture.

## System context

```
Browser
   |
   +--> www.nethack.example      Next.js public site (SSR, SSG, ISR)
   |
   +--> app.nethack.example      Static React workspace (Vite)
   |          |
   |          v
   +--> api.nethack.example      Fastify API (authority)
              |
              +--> PostgreSQL (nethack database)
              +--> Basis Auth (OIDC) --> Microsoft Entra ID
              +--> mail, file storage, workers

Private files: separate cookieless asset origin
```

Basis Auth is an independent service with its own database. Nethack never queries or modifies Basis Auth tables. Nethack determines authorization; Basis Auth only establishes identity.

## Applications

| Application | Path | Runtime | Owns |
| --- | --- | --- | --- |
| Public site | `apps/site` | Next.js App Router | Public content rendering, metadata, public cache policy |
| Workspace | `apps/workspace` | React, Vite, browser | Authenticated presentation, interaction, client-side navigation |
| API | `apps/api` | Fastify, Node.js or Bun | Identity verification, sessions, authorization, business rules, persistence, workers |
| UI | `packages/ui` | Browser | Shared design system, tokens, primitives, components, hooks, providers |
| Contracts | `packages/contracts` | Isomorphic | Zod schemas, request and response types, shared domain literals |
| API client | `packages/api-client` | Browser or server | Typed HTTP communication with the API |

The Core lives inside `apps/api/src/core`. It is not a separate package initially. Capabilities live inside `apps/api/src/capabilities` and `apps/workspace/src/capabilities`.

## Structural rules

1. There is one Core and it contains no competition-specific business logic.
2. Capabilities are ordinary modules registered statically in `apps/api/src/capabilities/index.ts`.
3. Capability dependencies form a directed acyclic graph.
4. Capabilities communicate through public contracts, domain events, and infrastructure interfaces only.
5. No capability imports another capability's private files.
6. No capability reads or writes another capability's tables.
7. The public site has no authority over the authenticated application.
8. The workspace has no server-side secrets, database access, or private tokens.
9. Fastify is the only authoritative backend and the only writer to the nethack database.
10. Every organization-owned record carries an organization scope.
11. Shared packages are limited to `ui`, `contracts`, and `api-client`.
12. No premature microservices, message broker, or service per capability.

## Trust boundaries

| Boundary | Rule |
| --- | --- |
| Browser to workspace | Static assets only; no secrets; UI cannot enforce authorization |
| Workspace to API | Session cookie plus CSRF protection; exact origin allowlist; API validates every request |
| Browser to public site | Public content only; no session cookie; no authenticated data |
| Public site to API | Public read-only endpoints; no private credentials |
| API to basis Auth | Server-to-server OIDC with PKCE; client secret and tokens never reach the browser |
| API to PostgreSQL | Runtime role with least privilege; separate migration role; organization context enforced |
| API to files | Quarantine, inspection, approved storage, authorized download |
| API to external services | Restricted hosts, timeouts, bounded responses, no arbitrary SSRF |

## Repository layout

```
apps/
  site/        Next.js public application
  workspace/   React and Vite authenticated application
  api/         Fastify application, Core, capabilities, infrastructure, workers
packages/
  ui/          Nethack UI components, primitives, hooks, providers, tokens
  contracts/   Zod schemas and shared types per capability
  api-client/  Typed API client
docs/
  architecture/
  engineering/
  security/
  capabilities/
  integrations/
  operations/
tests/
  architecture/
  integration/
  security/
  visual/
  e2e/
database/      Migrations and database assets
scripts/       Development, runtime verification, and operational scripts
```

## API structure

```
apps/api/src/
  core/             application, registry, dependency resolver, events, configuration
  authentication/   Basis Auth client, discovery, login, session, token, backchannel
  capabilities/     identity, organizations, competitions, participants, teams,
                    projects, submissions, judging, voting, announcements,
                    notifications, administration, files
  http/             routes, middleware, errors, schemas
  infrastructure/   database, storage, email, logging, clock
  workers/          background jobs and outbox consumers
  observability/    logging, metrics, tracing, health
  main.ts
```

## Documentation map

| Document | Subject |
| --- | --- |
| `docs/architecture/capability-architecture.md` | Capability model, static registration, catalog, extraction |
| `docs/architecture/core.md` | Core responsibilities, lifecycle, contracts, events |
| `docs/architecture/dependency-rules.md` | Allowed imports and enforcement |
| `docs/architecture/data-ownership.md` | Table ownership, tenant isolation, migrations |
| `docs/architecture/runtime-boundaries.md` | Runtime isolation, credentials, cookies, caching |
| `docs/architecture/decisions/` | Accepted architecture decision records |
| `docs/engineering/constitution.md` | Binding engineering rules |

## Non-goals

- A general-purpose plugin marketplace or runtime extension system.
- Serverless functions as the primary architecture.
- Kubernetes or service-per-capability deployment before measured need.
- A shared database with Basis Auth.
- Server-side rendering of private workspace state.
- A universal client state container.
- A second design system for the public site.
- Distributed event infrastructure before the transactional outbox is insufficient.
