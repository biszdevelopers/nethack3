# ADR-002: Site and workspace separation

Decision record for separate public and authenticated frontend runtimes.

## Status

accepted.

## Context

The public site needs server-side rendering, static generation, incremental regeneration, streaming, and search-engine visibility. The authenticated workspace needs rich interaction without server-side rendering of private application state. Putting both responsibilities in one Next.js application would give the public rendering runtime authority over authenticated sessions and private data, expanding the blast radius of a rendering or React Server Component compromise.

## Decision

Nethack has three application runtimes:

| Runtime   | Implementation          | Responsibility                                          |
| --------- | ----------------------- | ------------------------------------------------------- |
| Public    | Next.js App Router      | Public content, SSR, SSG, ISR, streaming                |
| Workspace | React with Vite, static | Authenticated interaction and presentation              |
| API       | Fastify                 | Identity, sessions, authorization, business rules, data |

The public site uses Server Components, static rendering where possible, SSR for request-dependent public pages, and ISR where appropriate. It consumes public API data only.

The workspace is a static application with React Router 7, a persistent dashboard shell, nested layouts, lazy route modules, and route-level error boundaries. It has no server runtime, no database access, and no secrets.

Fastify is the only authoritative backend. All mutations go through Fastify. The public site does not use Server Actions for application mutations, middleware as an authorization boundary, database access, or private Basis Auth credentials.

The two frontends share `packages/ui`, `packages/contracts`, and `packages/api-client`. There is no separate design system.

## Consequences

- A public Next.js compromise does not automatically grant API or database authority.
- Private application state is never server-rendered by the public site.
- The repository has two frontend build pipelines and two content security policies.
- The workspace cannot rely on server-side data loading; it uses the typed API client and TanStack Query.
- Public and authenticated routes have distinct caching, cookie, and origin policies.
- Shared components must work in both Next.js server rendering and the Vite browser build.
