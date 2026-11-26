# Dependency rules

Allowed dependency directions, forbidden imports, and automated enforcement across applications, packages, and capabilities.

## Dependency direction

```
apps/site        apps/workspace
      \            /
       packages/ui, packages/contracts, packages/api-client
                     ^
                     |
                  apps/api
                     |
        core, capabilities, infrastructure, workers

external: Basis Auth, PostgreSQL, mail, file storage
```

Dependencies point inward toward domain code and shared contracts. Framework and infrastructure details sit at the edges.

## Application rules

| From | May depend on | Must not depend on |
| --- | --- | --- |
| `apps/site` | `packages/ui`, `packages/contracts`, `packages/api-client`, Next.js, React | `apps/api`, `apps/workspace`, server internals of the API |
| `apps/workspace` | `packages/ui`, `packages/contracts`, `packages/api-client`, React, Vite | `apps/api`, `apps/site`, database, Node server modules |
| `apps/api` | `packages/contracts`, its own core, capabilities, infrastructure, workers | `apps/site`, `apps/workspace`, `packages/ui` |
| `packages/ui` | React, Radix, Tailwind, UI utilities | `apps/*`, `packages/contracts`, `packages/api-client` |
| `packages/contracts` | Zod | `apps/*`, `packages/ui`, `packages/api-client`, database |
| `packages/api-client` | `packages/contracts`, standard fetch APIs | `apps/*`, `packages/ui`, database, server secrets |

`packages/ui` is a design system, not a domain layer. It must not know about competitions, teams, submissions, or API routes.

`packages/contracts` is isomorphic. It must not import Node built-ins, database clients, React, or environment configuration.

`packages/api-client` may be used in the browser and in server-side public rendering. It cannot carry private credentials in browser builds.

## Core rules

- `apps/api/src/core` may depend on `packages/contracts` and on interfaces it owns.
- Core composition (`apps/api/src/core/application.ts`) may receive infrastructure implementations from `main.ts`.
- Core must not import a concrete capability. `main.ts` imports the static capability list from `apps/api/src/capabilities/index.ts` and passes it to the application factory.
- `apps/api/src/capabilities/index.ts` is the only composition list. It imports capability definitions, nothing else.
- Core defines lifecycle and registry types. It does not contain feature behavior.

## Capability rules

A capability may depend on:

- Its own `domain`, `application`, `infrastructure`, `http`, and `tests` folders.
- `packages/contracts` for shared schemas and types.
- Core types and infrastructure interfaces.
- The public `index.ts` of a capability listed in its `dependencies`.
- Framework types required by its HTTP layer.

A capability must not depend on:

- Another capability's `domain`, `application`, `infrastructure`, `http`, or `tests` files.
- Another capability's database tables.
- A concrete infrastructure client when an interface exists.
- Core internals that are not part of the composition contract.
- Another capability through a relative path that bypasses `index.ts`.
- A global service locator, module-level singleton registry, or ambient request context.

Examples:

```ts
// Allowed: declared dependency through the public entry point
import { organizationsContract } from "../organizations/index.js";

// Forbidden: private import into another capability
import { OrganizationRepository } from "../organizations/infrastructure/organization-database.js";

// Forbidden: reading another capability's table
database.select().from(teamsTable);

// Allowed: event integration without a compile-time dependency
events.publish("submissions.approved", payload);
```

## Dependency declaration

- A capability declares direct dependencies in its `CapabilityDefinition`.
- A dependency that is not declared is a composition error, even if the import would otherwise resolve.
- Transitive dependencies are not listed; the resolver computes them.
- A declared dependency that is unused is removed. Declarations describe real needs.
- The graph must remain acyclic. An apparent cycle usually means a missing event or an incorrectly placed responsibility.
- When two capabilities need each other's data, one owns the fact and publishes an event; the other keeps a projection or queries through a public contract without a reverse dependency.

## Data access rules

- Only the owning capability's `infrastructure` may query its tables.
- Shared read models are not a license to query another capability's tables. A read model is owned by the capability that maintains it.
- Joins across capability-owned tables are forbidden in application queries. Use a public contract, an event-maintained projection, or a database view owned by one capability with an explicit contract.
- Migrations may reference tables across capabilities for foreign keys. Runtime code may not.
- Cross-capability foreign keys are allowed when they enforce referential integrity; they do not grant read or write access.
- Audit reads may span organizations only through the administration capability's public contract with an explicit global permission.

## Package rules

- Import from a package entry point: `@nethack/ui`, `@nethack/contracts`, `@nethack/api-client`.
- Do not import `packages/ui/src/components/button` from an application.
- Do not create a fourth shared package for a helper, type, or utility. Shared packages are limited to `ui`, `contracts`, and `api-client`.
- Do not create `common`, `misc`, `helpers`, or `everything` packages.
- A package must not import an application.
- A package must not import another package's internal source files.

## Runtime-specific imports

- Application logic must not import `Bun` globals, `bun:*` modules, or Bun-only APIs.
- Server code must not import browser-only globals.
- Browser code must not import `node:*`, database clients, or server configuration.
- Tests may use runtime-specific APIs only in a test that explicitly verifies that runtime and is excluded from the other runtime's suite.
- Build scripts may use Bun APIs because they run only under Bun.

## Enforcement

`tests/architecture` validates the rules before merge.

Required checks:

1. Parse imports across `apps` and `packages` and build a module graph.
2. Reject imports that cross a capability boundary except through `index.ts`.
3. Reject cycles in the module graph and the capability declaration graph.
4. Reject application-to-application imports.
5. Reject package-internal imports from applications.
6. Reject `apps/api` or server-only modules in browser entry graphs.
7. Reject `packages/ui`, `packages/contracts`, and `packages/api-client` dependencies outside their allowed set.
8. Reject direct table access outside the owning capability by scanning repository and query files for table identifiers.
9. Reject undeclared capability dependencies by comparing imports and contract usage with `CapabilityDefinition.dependencies`.
10. Reject Bun-only APIs in application source.
11. Reject forbidden libraries: a second router, form library, table library, primitive framework, or state manager.
12. Reject deep imports that bypass package exports.
13. Reject `any`, `@ts-ignore`, and non-null assertions in application source where static scanning can detect them.
14. Reject server secrets and private environment variables in client bundles.

The architecture suite uses a graph traversal over V modules and E import edges. Import graph analysis is O(V+E) in time and space. It runs on every change and fails the build on violation.

## Exception process

A rule may be waived only by an accepted ADR in `docs/architecture/decisions/`. The ADR states:

- The rule being waived.
- The concrete need.
- The scope and duration.
- The removal condition.
- The architecture test change required to enforce the exception.

A comment in code, a lint suppression, or a review approval is not an exception.
