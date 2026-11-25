# nethack — agent instructions

The authoritative product and engineering specification is `FULL_PLAN.md` (ignored by Git, present locally). `SETUP_GUIDE.md` is the authoritative Basis Auth downstream contract. Read both before changing architecture, authentication, security, or deployment behavior.

## Product

- User-facing product name: `nethack`, always lowercase. Never display `nethack3`.
- Internal codename: `nethack3`.
- Architecture: Nethack3 Capability Architecture (NCA).
- UI: Nethack UI, an original React design system owned in `packages/ui`.

## Repository

```
apps/api        Fastify authoritative API, capabilities, workers, migrations
apps/site       Next.js public site (SSR, no private data, no database)
apps/workspace  React + Vite authenticated workspace (static build)
packages/ui     Nethack UI components, tokens, hooks, providers
packages/contracts  Zod request/response schemas and inferred types
packages/api-client Typed HTTP client for the workspace
database/       Drizzle migrations (generated) and SQL policies
deployment/     Node and Bun container deployment targets
tests/          architecture, integration, security, visual, e2e, load
docs/           engineering handbook, architecture, security, operations
```

The Core is `apps/api/src/core`. It owns capability registration, static composition, dependency validation, lifecycle, configuration, contracts, events, logging, error handling, and health. It must not acquire competition business logic.

## Non-negotiable rules

1. Every feature is a capability under `apps/api/src/capabilities/<name>/` with `domain/`, `application/`, `infrastructure/`, `http/`, `tests/`, `index.ts`, and `README.md`.
2. Capabilities are registered statically in `capabilities/index.ts` with explicit `dependencies`. No runtime folder scanning, dynamic loading, service locator, or hidden global state.
3. Capabilities communicate only through public contracts (`capabilities/<name>/contracts.ts`), domain events through the transactional outbox, or injected infrastructure interfaces. Never import another capability's private modules or tables.
4. The Core stays small. Every abstraction must make the system simpler; otherwise delete it.
5. `.tsx` is only for rendering. Domain, application, persistence, validation, hooks without JSX, and API communication live in `.ts`.
6. Java-flavored TypeScript: classes for meaningful state and invariants, constructor injection, composition, explicit interfaces, small services. No deep inheritance, artificial factories, singleton managers, or one-function wrapper classes.
7. Strict TypeScript is mandatory. No `any`, `@ts-ignore`, `@ts-expect-error`, non-null assertions, or suppressed compiler errors. Validate untrusted input with Zod. Handle important state transitions exhaustively.
8. Naming: kebab-case files, PascalCase types/classes/components, camelCase functions/variables, snake_case database identifiers, UPPER_SNAKE_CASE environment variables.
9. Formatting is Oxfmt only (`.oxfmtrc.json`). Linting is Oxlint only (`.oxlintrc.json`). Never add ESLint, Prettier, or a competing formatter. Never run pnpm.
10. Bun is the package manager and primary development runtime. Node.js 24 is an equally supported production runtime. Application code must not use Bun-only APIs, runtime-specific branches, or separate implementations. `bun.lock` is the only lockfile.
11. Security is designed, not patched on: validate at trust boundaries, parameterize all SQL, enforce organization scope and role checks on every protected request, keep tokens server-side, use `__Host-nethack_session`, and never trust the frontend.
12. Tests are part of the feature: unit, API/integration, security, architecture, accessibility, visual, E2E, and runtime verification. Do not disable or weaken a test to get a green run.
13. Documentation must describe the implemented system. Do not document planned behavior as if it exists.
14. Do not leave placeholders, TODOs, stub handlers, invented data, or fake statistics. Empty states are real UI; fixture data belongs only in opt-in development seeds and tests.
15. No private credentials in the Next.js runtime, the static workspace, or client JavaScript. The public site talks only to public API routes.

## UI rules

- Noto Sans Mono exclusively, self-hosted. No other typeface.
- Palette: `#00DC82`, `#090909`, `#FFFFFF`, derived neutral grays and greens only. No other colors.
- Dark theme is the default; light mode uses the same palette.
- No all-caps UI text, no `text-transform: uppercase`, no uppercase utility classes.
- No gradients, glow, glassmorphism, random decorative shapes, fake stats, Lorem Ipsum, or invented content.
- Small consistent radii, 1px borders, 4px spacing scale, 36–44px controls, focus-visible states, keyboard operation, screen-reader labels, reduced-motion respect.
- Source-owned components in `packages/ui`; Radix is the only interaction primitive foundation.

## Commands

```
bun install --frozen-lockfile
bun run dev                 # api + workspace + site, Bun runtime
bun run dev:node            # api built and run on Node, site on Node
bun run build               # contracts, ui, api, workspace, site
bun run typecheck
bun run lint
bun run format:check
bun run test                # unit + architecture (Vitest under Node)
bun run test:integration    # API/database integration tests
bun run test:security
bun run test:e2e
bun run verify:runtime      # Node and Bun production builds + health
bun run check               # format, lint, typecheck, unit/architecture tests
```

Vitest runs under Node because Vitest 5 worker pools are incompatible with Bun 1.3 on Windows. Application runtime verification still executes the API and site under both Node and Bun.

## Capability checklist

Before declaring a capability complete:

- Domain rules are explicit and unit tested.
- Application operations own transactions and emit audit records/events.
- Persistence uses parameterized Drizzle queries with organization scope.
- Routes validate input, authenticate, establish organization context, authorize, call the operation, and serialize with response schemas.
- Contract is documented and typed; dependencies declared.
- Permissions, events, tables, and extraction procedure documented in its README.
- Tests cover success, unauthorized, cross-organization, and failure paths.

## Forbidden patterns

Adding `any` or compiler suppressions; disabling failing tests; arbitrary abstractions or packages; duplicated business logic; monkey-patching dependencies; hidden global state; circular dependencies; retries that conceal race conditions; delays that hide synchronization bugs; incomplete placeholders presented as complete; unrelated refactors; weakening security for convenience; reading another capability's tables; fetching arbitrary URLs server-side; storing tokens in the browser.
