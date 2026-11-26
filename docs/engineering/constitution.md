# Engineering constitution

Binding standards for every developer and coding agent working in the nethack3 repository.

## Authority

`FULL_PLAN.md` is the product and architecture source of truth. `SETUP_GUIDE.md` is the authoritative Basis Auth integration contract. This constitution condenses both into rules that apply to every change. An architecture decision record (ADR) may narrow or extend a rule; chat history, habit, and convenience may not.

The same rules apply to human-authored and agent-authored code. A change is not acceptable because tests pass, because it compiles, or because a demo looks correct.

## Quality dimensions

Five dimensions carry equal weight and must not be traded without a documented reason.

| Dimension | Requirement |
| --- | --- |
| Maintainability | An unfamiliar developer can understand and modify the code without learning a private framework |
| Extensibility | Adding a capability does not require unrelated architectural changes |
| Security | Strong boundaries, strict validation, least privilege, defense in depth |
| Performance | Excellent perceived responsiveness and low resource consumption |
| User experience | Complete, polished, consistent interface with no unfinished components |

## Non-negotiable principles

1. Understandability over cleverness.
2. Composition over inheritance.
3. Explicit dependencies over hidden dependencies.
4. Small abstractions over general-purpose frameworks.
5. Real functionality over visual demonstrations.
6. Correctness over optimistic assumptions.
7. Measured optimization over premature optimization.
8. Consistency over individual component creativity.
9. Accessibility by default.
10. Security at every trust boundary.
11. Human-readable and agent-readable code.
12. No hacks on hacks.

An abstraction must make the system simpler to understand or modify. Otherwise it does not belong.

## Architecture

- The architecture is the Nethack3 Capability Architecture.
- There is one minimal Core at `apps/api/src/core`.
- Every feature is a capability under `apps/api/src/capabilities/<name>` with a browser counterpart under `apps/workspace/src/capabilities/<name>` where the feature has a UI.
- Capabilities are registered statically in `apps/api/src/capabilities/index.ts`; there is no runtime directory scanning or dynamic loading.
- Capabilities are ordinary feature modules, not a proprietary extension framework.
- Capabilities communicate only through public contracts, domain events, and infrastructure interfaces.
- Private imports between capabilities are forbidden.
- Capabilities own their domain rules, application operations, persistence, tests, permissions, and events.
- Capabilities must be independently testable and extractable without rewriting domain logic.
- Infrastructure is replaceable and accessed behind explicit interfaces.
- The system is organization-aware from the first migration, not retrofitted later.
- There are no premature microservices, message brokers, or service-per-capability deployments.

## Applications

| Application | Path | Technology | Responsibility |
| --- | --- | --- | --- |
| Public site | `apps/site` | Next.js App Router | Public SSR, SSG, ISR, streaming, public content only |
| Workspace | `apps/workspace` | React, Vite, React Router 7 | Authenticated interaction and presentation |
| API | `apps/api` | Fastify, TypeScript | Identity, sessions, authorization, business rules, persistence |
| Identity | external | Basis Auth, Microsoft Entra | Authentication only; nethack owns authorization |
| Database | external | PostgreSQL, Drizzle | Application state; separate from the Basis Auth database |

- Fastify is the only authoritative application backend.
- The public site renders in an isolated runtime with no application authority.
- The frontend is never trusted to enforce business permissions.
- The public site consumes public API data only. It does not own sessions, database access, or mutations.
- All meaningful mutations go through Fastify.
- Nethack displays the name `nethack`, in lowercase, everywhere users can see it.

## Runtime

- Bun is the primary package manager and development runtime.
- Pin an exact stable Bun release.
- Node.js 24 or newer is an equally supported production runtime.
- Production dependencies use one source tree and one `bun.lock`.
- No Bun-only APIs in shared or application logic. `Bun.serve`, `Bun.file`, `Bun.password`, and similar interfaces are forbidden outside build scripts and tests that explicitly verify Bun behavior.
- No hidden runtime detection and no dual implementations.
- Dual-runtime CI is mandatory for changes that affect server behavior.
- Production deployment must be verified under both Node.js and Bun.

## UI

- Nethack UI lives in `packages/ui` and is the only design system.
- Nethack UI is an original React implementation with Nuxt UI-level breadth and quality.
- The public site and workspace use the same components, tokens, and interaction conventions.
- Components are source-owned inside the repository, built on Radix primitives, Tailwind CSS 4, and Tailwind Variants.
- Component APIs are designed once, documented, and consistent; the component catalog is complete.
- Every interactive component supports default, hover, focus-visible, active, disabled, loading, error where applicable, keyboard, screen-reader, mobile, dark, and light states.
- Complete component coverage is required, not a few styled primitives.

## Visual identity

- Noto Sans Mono is the only typeface. It is self-hosted with its license, in a controlled set of weights.
- The palette is neon green `#00DC82`, near black `#090909`, and white `#FFFFFF`, plus derived neutral grays and green shades.
- No blue, purple, orange, rainbow status system, or unrelated accent color.
- Dark theme is the default. A light theme uses the same palette and visual language.
- No all-caps UI text, headings, button labels, or `text-transform: uppercase`.
- No invented statistics, names, deadlines, scores, results, announcements, or placeholder production content.
- No arbitrary gradients, glow, glassmorphism, background grids, decorative shapes, icon clutter, or cards inside cards.
- Purposeful, polished, responsive design. No generic template layouts.
- Status is communicated with color and text together.

## Programming

- Java-flavored TypeScript with practical object-oriented programming.
- Classes for meaningful state and invariants; composition over inheritance.
- Constructor injection, explicit interfaces, small application services, private implementation details.
- `.tsx` is exclusively for rendering. `.ts` holds domain logic, application operations, algorithms, validation, state logic, persistence, and infrastructure.
- Strict TypeScript. No careless `any`, no `@ts-ignore`, no suppressed errors.
- Minimal abstraction, explicit dependencies, no speculative frameworks.

## Engineering tools

- Bun workspaces; no pnpm and no competing lockfile.
- Oxfmt exclusively, configured in `.oxfmtrc.json`.
- Oxlint exclusively; no ESLint and no Prettier.
- Vitest for unit and integration tests.
- Fastify injection for API integration tests.
- Playwright for end-to-end and visual tests.
- axe-core for accessibility checks.
- k6 for load tests.
- Architecture tests under `tests/architecture`.
- Security scanning and an SBOM in the release process.
- Incremental TypeScript builds and cached dependency installation.

## Security

- Secure OIDC integration with Authorization Code and PKCE, initiated and completed server-side.
- Opaque server-side sessions. The browser never receives access tokens, refresh tokens, client secrets, signing keys, or encryption keys.
- Refresh tokens are encrypted at rest; session identifiers are stored as SHA-256 hashes.
- Refresh rotation is serialized per session.
- Backchannel logout and token revocation are verified, idempotent, and tested.
- Organization data is isolated in the database, the API, and every cache.
- XSS, SQL injection, CSRF, SSRF, open redirect, clickjacking, session fixation, and malicious upload defenses are mandatory.
- Least privilege applies to database roles, service credentials, runtime users, and application permissions.
- Continuous vulnerability monitoring covers dependencies, secrets, and advisories.
- A known exploitable critical or high-severity vulnerability blocks release.

## Performance

- Minimal browser JavaScript and route-level code splitting.
- Static delivery where appropriate; no unnecessary client-side data fetching.
- Bounded database pools, request sizes, concurrency, queues, and caches.
- Efficient queries with indexes justified by real access patterns.
- Nontrivial algorithms document time complexity, auxiliary space, worst case, amortized behavior, and input-size assumptions.
- Builds must remain manageable on ordinary development machines.
- Performance targets are verified on production builds at realistic device and network conditions.

## Development philosophy

Nethack code must be human-readable, agent-readable, understandable, extensible, secure, and efficient. It contains no unnecessary abstraction, no hacks on hacks, no unfinished implementations, and no feature represented as complete before it is complete. The standard is not merely that it works; it must be pleasant to use, develop, extend, and maintain. Code is written with dignity: clear ownership, honest state, and respect for the next reader.

## Forbidden patterns

The following are review failures, not preferences.

| Area | Forbidden |
| --- | --- |
| Types | `any` to silence a problem; `@ts-ignore`; `@ts-expect-error` used to hide a real error; non-null assertions used to avoid handling absence; unsafe `as` casts on untrusted data |
| Tests | Disabling, skipping, or weakening a failing test; deleting an assertion to make CI pass; claiming coverage without executing the suite |
| Architecture | Private cross-capability imports; direct access to another capability's tables; circular dependencies; unregistered capability dependencies; global service locators |
| Abstractions | Arbitrary abstractions; unnecessary packages; `common`, `misc`, `helpers`, or `everything` packages; wrapper classes around one function; interfaces for trivial functions |
| State | Hidden global state; a state-management library without a demonstrated requirement; duplicating server state in a client store |
| Runtime | Bun-only APIs in application logic; runtime-specific branches; runtime detection; module-loader monkey-patching; native dependencies that fail on either runtime |
| Data | String-concatenated SQL; user-controlled table names, sort expressions, or SQL fragments; unbounded queries; unparameterized raw SQL |
| Security | `dangerouslySetInnerHTML` with untrusted content; `innerHTML`; `eval`; dynamic script construction; raw HTML in Markdown; `unsafe-eval` in CSP; permissive CORS |
| Next.js | Server Actions for application mutations; middleware or `proxy.ts` as an authorization boundary; database access; Basis Auth secrets; user-specific server caching; arbitrary remote fetch |
| UI | All-caps text; `text-transform: uppercase`; fonts other than Noto Sans Mono; colors outside the palette; gradients, glow, or decorative clutter; fake data; hover-only actions |
| Dependencies | Adding a dependency for a few lines of code; mixing Radix with another primitive framework; a second router, form library, or table library; floating `latest` in production |
| Operations | Build-time network or database access during ordinary compilation; destructive migrations on API startup; retries that conceal race conditions; arbitrary delays that hide synchronization problems |
| Honesty | Leaving incomplete placeholders; claiming incomplete features are complete; refactoring unrelated capabilities without approval; weakening a security control for convenience |

## Review checklist

Passing tests alone does not make a change acceptable. Every review answers these questions.

| Area | Question |
| --- | --- |
| Ownership | Does the change live in the capability that owns the behavior and data? Are browser and server parts separated? |
| Dependencies | Are dependencies explicit, acyclic, and limited to public contracts, events, or infrastructure interfaces? |
| Abstraction | Is every new abstraction necessary, smaller than the alternative, and understandable without a guide? |
| Permissions | Are user identity, organization context, resource organization, membership, operation permission, eligibility, and ownership checked server-side? |
| Validation | Are all external inputs validated with shared schemas, including bodies, query, route params, identity responses, files, and configuration? |
| Errors | Are error categories consistent, recovery guidance clear, and internal details kept out of responses? |
| Tests | Are domain rules, application operations, contracts, persistence, authorization, events, errors, and concurrency covered? |
| Negative paths | Are unauthorized, cross-organization, duplicate, expired, conflicting, and malformed requests tested? |
| Database | Are queries parameterized, organization-scoped, indexed, bounded, and free of N+1 patterns? |
| Performance | Is the change within budgets, free of unnecessary JavaScript, and efficient on ordinary hardware and networks? |
| Accessibility | Is the UI keyboard operable, labeled, focus-managed, contrast compliant, and usable on mobile? |
| Runtime | Does the change work under both Node.js and Bun without runtime-specific logic? |
| UI consistency | Does it use Nethack UI tokens and components, sentence case, real data, and complete states? |
| Documentation | Are capability README, API contracts, ADRs, and this handbook updated when behavior or decisions change? |
| Scope | Does the change avoid unrelated refactoring and unfinished placeholders? |

## Enforcement

- `bun run check` must pass before merge.
- Architecture tests enforce folder boundaries, import rules, contract registration, runtime restrictions, palette, and typography.
- Visual regression tests cover important components and pages in both themes and three viewport classes.
- Security tests cover the negative paths listed in `docs/engineering/testing.md`.
- A rule may be waived only by an accepted ADR that states the reason, the scope, and the removal condition. Convenience is not a reason.
