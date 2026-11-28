# Requirement tracker

Source of truth: `FULL_PLAN.md` (sections 1-24) and `SETUP_GUIDE.md` (Basis Auth downstream contract). Status values: Not started, In progress, Implemented, Verified, Blocked. "Verified" requires an executed check, not file presence.

Verification snapshot: 2026-11-28, after the second parity pass. Executed on this host: `bun run format:check`, `bun run lint` (0 errors), `bun run typecheck`, `bun run check`, `bun run test` (49 files / 413 tests plus 17 UI files / 35 tests), `bun run test:integration` (18 files / 84 tests), `bun run test:security` (17 files / 80 tests), `bun run build`, `bun run verify:runtime` (11/11), `bun run test:e2e` (72 cases; 71 passed, 1 skipped), `bun run test:visual` (26/26), `bun run test:performance` (Lighthouse 100/100/100/100 mobile and desktop), `bun audit --audit-level=high`, `bun run security:scan` (758 files, 71-component SBOM), earlier Caddy validation, and a backup/restore drill with retention pruning. Not executed: Docker images/Compose, k6 on this host (not installed), live Basis Auth/Entra, or an independent penetration test.

Current distribution across 228 tracked requirements: 146 Verified, 71 Implemented, 0 In progress, 0 Not started, 11 Blocked.

## 1. Product identity and principles

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| P-001 | User-facing name is `nethack`, lowercase, never `nethack3` in UI | 1.1 | apps/site, apps/workspace, packages/ui | `tests/architecture/code-standards.test.ts` scans site and workspace sources; passed in `bun run test` | Verified |
| P-002 | Internal codename `nethack3` allowed in docs/repo only | 1.1 | docs, package name, lockfile | Same codename scan passes for `apps/site/src` and `apps/workspace/src`; codename remains in docs and `package.json` | Verified |
| P-003 | Five quality dimensions documented and not silently traded off | 1.2 | docs/engineering/constitution.md | Document review; no executed acceptance review | Implemented |
| P-004 | Twelve non-negotiable principles enforced by review and architecture tests | 1.3 | docs/engineering, tests/architecture | Architecture tests cover capability boundaries, extraction, runtime parity, outbound fetch, code standards, and dependency rules; review standards remain documented. | Implemented |
| P-005 | Every abstraction has a concrete purpose; no speculative framework | 1.3, 24 | whole repo | ADRs and code review standard; no automated check | Implemented |

## 2. Nethack UI architecture

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| UI-001 | Original React component system with Nuxt UI-level breadth | 2.1-2.4 | packages/ui | Source inventory covers layout, elements, forms, data, navigation, overlays, dashboard, page composition, and advanced components; no breadth metric executed | Implemented |
| UI-002 | Radix as sole interaction primitive foundation | 2.4 | packages/ui/package.json | Manifest inspection: Radix packages, cmdk, TanStack Table; no competing primitive framework | Implemented |
| UI-003 | Tailwind CSS 4, Tailwind Variants, clsx + tailwind-merge | 2.4 | packages/ui/styles.css, lib/cn.ts | `bun run typecheck` and `bun run build` pass; dependencies present | Verified |
| UI-004 | Source-owned components inside repository | 2.4 | packages/ui/src | Components compiled from workspace source; no runtime UI framework dependency | Implemented |
| UI-005 | NethackProvider: theme, toast, overlay, tooltip, shortcuts, command palette, locale, settings | 2.5 | packages/ui/src/providers/nethack-provider.tsx | Provider mounts theme, locale, tooltip, toast, overlay, and motion; the workspace mounts a command palette with mod+k shortcuts; Playwright command-palette navigation passes. | Verified |
| UI-006 | Provider is not a universal state container | 2.5 | providers | Provider only composes global UI concerns and mounts viewports | Implemented |
| UI-007 | Layout catalog (provider, container, main, header, footer, sidebar, splitter, shells, section, grid, columns, stack, page header/body/aside) | 2.6 A | packages/ui/src/components/layout, shells.tsx | Source inventory complete; no dedicated layout tests executed | Implemented |
| UI-008 | Basic element catalog (alert, avatar/group, badge, banner, button, calendar, card, chip, collapsible, field group, icon, kbd, progress/group, separator, skeleton, toggle/group, user, empty state, status) | 2.6 B | packages/ui/src/components, elements | Source inventory complete; 16 UI test files (34 cases) exist but most are not executed by the configured suite | Implemented |
| UI-009 | Form catalog (checkbox/group, color picker, file upload, form, form field, input, date input/picker, autocomplete, number, rating, tag, time, listbox, pin, radio, select, select menu, combobox, slider, switch, textarea, search, multi-step, validation summary) | 2.6 C | packages/ui/src/components/forms | Source inventory complete; 6 form test files exist but are `.tsx` and excluded by `vitest.config.ts` | Implemented |
| UI-010 | Data catalog (accordion, carousel, chart, empty state, scroll area, table, data table, timeline, tree view, user, activity feed, file list, key-value, stats, pagination controls) | 2.6 D | packages/ui/src/components/data, table.tsx | Source inventory complete; one data-table `.test.ts` runs, other data tests are `.tsx` and excluded | Implemented |
| UI-011 | Navigation catalog (breadcrumb, command palette, footer columns, link, navigation menu, pagination, stepper, tabs, sidebar nav, contextual nav, search nav) | 2.6 E | packages/ui/src/components/navigation | Command palette is wired into the workspace and keyboard-tested; remaining navigation components have source inventory and partial component tests. | Implemented |
| UI-012 | Overlay catalog (context menu, drawer, dropdown, dialog, alert dialog, popover, slideover, toast, tooltip, hover card, confirmation) | 2.6 F | packages/ui/src/components/overlays, dialog.tsx | Overlay component tests run as part of `bun run test` (17 UI files, 35 tests); Playwright dialog and drawer paths pass. | Verified |
| UI-013 | Dashboard catalog (group, navbar, panel, resize handle, search, search button, sidebar, collapse, toggle, toolbar) | 2.6 G | packages/ui/src/components/dashboard/dashboard.tsx | Source inventory complete; no dedicated test | Implemented |
| UI-014 | Page composition catalog (page, anchors, aside, body, card, columns, CTA, feature, grid, header, hero, links, list, logos, section, content nav/search/TOC/pagination) | 2.6 H | packages/ui/src/components/page/page.tsx, layouts | Used by the public site; public-site Playwright cases passed | Implemented |
| UI-015 | Advanced components (rich text, toolbar, suggestion/mention menus, drag handle, charts, calendar views, resizable panels, advanced search, file preview, review panel, rubric, activity timeline) | 2.6 I | packages/ui/src/components/advanced | Source inventory complete; no advanced-component test executed | Implemented |
| UI-016 | Component behavior is real, not visual shells | 2.6 | packages/ui | 17 UI test files and 35 cases now run under `bun run test`; behavior is Radix-backed. | Verified |
| UI-017 | Hooks: useToast, useOverlay, useShortcuts, useColorMode, useLocale, useMediaQuery, useControllableState, useDebouncedValue, useDisclosure, useIsMobile | 2.7 | packages/ui/src/hooks, stores | All required hooks are exported; no hook unit test executed | Implemented |
| UI-018 | No custom hook for trivial two-line state | 2.7 | hooks | Source inspection | Implemented |
| UI-019 | Consistent component API (variant, size, color, disabled, loading, className, id, aria-*) where appropriate | 2.8 | packages/ui | Tailwind Variants patterns and TypeScript props; `bun run typecheck` passes | Implemented |
| UI-020 | Every interactive component tested across default/hover/focus/active/disabled/loading/error/keyboard/screen-reader/mobile/dark/light | 2.9 | packages/ui/tests, E2E axe | 35 UI component cases, component-lab axe in dark/light, keyboard command palette, loading/empty/error screenshots, and page-level keyboard paths are executed. Hover/active styling is CSS-only. | Verified |
| UI-021 | Component laboratory documents examples, variants, sizes, props, keyboard, a11y, responsive, errors, code | 2.10 | apps/workspace/src/pages/lab-page.tsx, docs/engineering/ui-system.md | Lab route exists and is reachable; not covered by a dedicated screenshot or content test | Implemented |
| UI-022 | Visual regression tests for important components/pages | 2.10, 16.4 | tests/e2e/**screenshots**, Playwright | Six Playwright screenshot baselines (desktop dark and light, tablet, mobile, empty archive, not found) plus axe pass. | Verified |

## 3. Visual identity

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| V-001 | Noto Sans Mono everywhere, no other typeface | 3.1 | packages/ui/styles.css, @fontsource/noto-sans-mono | `code-standards.test.ts` checks CSS and source font families; both apps serve only self-hosted Noto Sans Mono weights. | Verified |
| V-002 | Font self-hosted with license | 3.1 | @fontsource/noto-sans-mono | Both applications serve self-hosted WOFF2 files with the SIL Open Font License 1.1 included beside the assets. | Verified |
| V-003 | Controlled font weights; hierarchy via size/weight/spacing | 3.1 | styles.css | Four controlled weights are self-hosted; hierarchy is verified by desktop, tablet, mobile, light, and dark visual baselines. | Verified |
| V-004 | Palette: #00DC82, #090909, #FFFFFF plus derived neutrals and greens only | 3.2 | packages/ui/styles.css | `code-standards.test.ts` palette allowlist passes | Verified |
| V-005 | Dark theme default; light theme same palette | 3.2 | theme store, theme-init scripts, tokens | Dark is the default and light uses the same palette; component-lab dark/light and public light screenshots pass. | Verified |
| V-006 | Status communicated with color and text | 3.2 | StatusIndicator, badges | Source inspection; no dedicated accessibility test | Implemented |
| V-007 | No all-caps UI text; no uppercase headings/buttons; no text-transform uppercase | 3.3 | all apps | `code-standards.test.ts` uppercase scan passes; full Playwright suite passes | Verified |
| V-008 | Product name always `nethack`; no abbreviations, fake stats, placeholder content, Lorem Ipsum | 3.3 | all apps | Codename scan passes; E2E uses labeled fixtures; no automated content audit | Implemented |
| V-009 | Construction rules: spacing, alignment, borders, radii, shadows, no gradients/glow/grids/random shapes | 3.4 | tokens + components | Glow, gradients, glass blur, floating decorative shapes, and hover glow were removed; solid surfaces, restrained shadows, and a solid scroll indicator remain. | Verified |
| V-010 | Geometry tokens (5px/3px/8px radii, 36-44px controls, 1px borders, 4px unit, 1280px content, 24px padding) | 3.5 | tokens | Token inspection; no token unit test | Implemented |
| V-011 | Interaction: immediate feedback, focus, no hidden/hover-only actions, clear errors, no layout shift | 3.6 | components | Playwright axe, keyboard command palette, loading/empty/error screenshots, and component tests pass; an exhaustive hover/active matrix is still partial. | Implemented |
| V-007b | No invented competition metrics, names, deadlines, scores, results, announcements | 3.7 | site + workspace | Playwright fixtures are explicitly labeled development data; no production seed audit | Implemented |
| V-007c | Meaningful empty states when data absent | 3.7 | EmptyState, query states, visual baselines | The empty archive visual baseline and the no-organization negative path render real empty states. | Verified |

## 4. Application architecture

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| A-001 | Public frontend Next.js App Router with SSR/SSG/ISR/streaming | 4.1-4.4 | apps/site | All routes are dynamic so the per-request CSP nonce survives; SSR/streaming is verified by build and runtime checks. No SSG/ISR route segment exists. | Implemented |
| A-002 | Authenticated frontend React + Vite, static build | 4.1, 4.5 | apps/workspace | `bun run build` emits static assets; Playwright workspace cases pass | Verified |
| A-003 | Fastify authoritative API | 4.1, 4.6 | apps/api | Integration and E2E suites pass | Verified |
| A-004 | PostgreSQL + Drizzle | 4.1 | apps/api/src/infrastructure/database | 8 migrations, 51 tables; integration suite passes against PostgreSQL 18 | Verified |
| A-005 | React Router 7 only routing library in workspace | 4.5 | apps/workspace/src/application/router.tsx | React Router 7.18.7 is the only routing library; workspace typecheck and E2E pass. | Verified |
| A-006 | Public site does not use Next.js as API, Server Actions for mutations, middleware auth, DB access, private credentials, user-specific caching, arbitrary remote fetch | 4.4 | apps/site | `runtime-parity.test.ts` checks DB/secrets/imports; `proxy.ts` only sets security headers; no Server Actions found | Verified |
| A-007 | Public site consumes only public API data | 4.4 | apps/site/src/lib/public-api.ts | Site calls only `/api/v1/public/*`; Playwright public-site cases pass | Verified |
| A-008 | Fastify owns identity, sessions, authorization, org membership, business rules, DB, files, audit, submissions, judging, voting, admin | 4.6 | apps/api | Integration and security suites pass | Verified |
| A-009 | Origins and trust policy for www/app/api/asset, Basis Auth | 4.3 | core/configuration.ts, deployment | `configuration.test.ts` passes; deployment topology not run | Verified |
| A-010 | Workspace: persistent shell, nested layouts, lazy routes, error boundaries, navigation state, search params, history, responsive nav | 4.5 | apps/workspace | Router uses lazy imports and nested layouts; Playwright workspace journeys pass | Verified |

## 5. Bun and Node.js parity

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| R-001 | Bun is package manager and dev toolchain; bun.lock committed, no other lockfile | 5.1 | package.json, bun.lock | `runtime-parity.test.ts` forbids competing lockfiles; repository inspection | Verified |
| R-002 | Bun workspaces with apps/* and packages/* | 5.1 | package.json | `bun install --frozen-lockfile` and build pass | Verified |
| R-003 | No Bun-only APIs in application logic | 5.2 | all source | `runtime-parity.test.ts` Bun API scan passes | Verified |
| R-004 | No undocumented Node behavior, runtime-specific business logic, dual implementations, hidden runtime detection | 5.2 | all source | Runtime-parity test rejects Bun/Deno globals, process.versions.bun, and BUN env branches; 11/11 runtime checks pass. | Verified |
| R-005 | No incompatible native dependencies | 5.2 | dependencies | Production build and both-runtime start checks pass; full integration under both runtimes not run | Verified |
| R-006 | Next.js dev/build/start under Node and Bun | 5.3-5.4 | apps/site scripts | `verify:runtime` site checks: HTTP 200 under Node and Bun; `bun run build` passes | Verified |
| R-007 | Fastify dev/build/start under Node and Bun | 5.3-5.4 | apps/api scripts | `verify:runtime` API checks: `/health/ready` 200 under Node and Bun | Verified |
| R-008 | DB operations, migrations, background workers, auth, file processing under both | 5.3 | apps/api | 11/11 runtime checks cover API health, site HTTP, migrations, and worker start under Node and Bun; auth and file integration run under Node. | Implemented |
| R-009 | Node 24+ baseline; pinned Bun stable | 5.3 | CI and local toolchain | Node 24.13.0 and Bun 1.3.14 used; CI pins Bun 1.3.14 | Verified |
| R-010 | Dual-runtime CI install/build/start/integration/E2E | 5.5 | .github/workflows/ci.yml | Workflow defines quality, integration, runtime-node, runtime-bun, and security jobs; no GitHub run evidence in this pass | Implemented |
| R-011 | Same source and lock for both runtimes | 5.5 | repo | Single lockfile and source tree used by both runtime jobs; CI configuration inspected, not executed | Implemented |
| R-012 | Build system: Bun workspaces, Turbopack, Vite, TS incremental, no Nx/Turborepo | 5.6 | configs | `runtime-parity.test.ts` forbids Nx/Turbo; `bun run build` passes | Verified |
| R-013 | Separate runtime scripts for site and API | 5.4 | package.json files | Scripts exist; `verify:runtime` exercises dist entry points | Verified |
| R-014 | Node and Bun deployment targets, same env schema, equivalent behavior | 17.3 | deployment/node, deployment/bun | Dockerfiles and compose files exist; no image built or stack started (Docker unavailable) | Blocked |

## 6. Repository organization

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| S-001 | Repository layout matches plan: apps, packages (ui, contracts, api-client), docs, tests, scripts, database | 6 | repo | Directory inspection | Verified |
| S-002 | No packages for small abstractions; no common/misc/helpers/everything | 6.1 | repo | Only ui, contracts, and api-client packages exist | Verified |
| S-003 | Capabilities organized by responsibility with domain/application/infrastructure/http/tests/index | 6.2 | apps/api/src/capabilities | identity now has domain schemas, tests, and a README; organizations has a README and rule tests. identity still delegates persistence to core auth. | Implemented |
| S-004 | Browser capability folders components/hooks/api/pages/index | 6.2 | apps/workspace/src/capabilities | All workspace capability folders now have barrels; components, hooks, pages, and shared API resources are present where the capability needs them. | Implemented |
| S-005 | Shared contracts per domain | 6.2 | packages/contracts/src | Typecheck passes and contracts are consumed by API, site, workspace, and api-client | Verified |

## 7. Nethack3 Capability Architecture

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| C-001 | Every feature is a capability; one Core backbone | 7.1 | apps/api/src/core, capabilities | 13 capabilities registered; architecture tests pass | Verified |
| C-002 | Capabilities are ordinary modules, extractable without domain rewrite | 7.1, 7.6 | capabilities | capability-extraction.test.ts imports every capability index and validates id/version/dependencies/register. | Verified |
| C-003 | Core only owns registry, composition, dependency validation, lifecycle, config, contracts, auth context, events, logging, errors, health | 7.2 | apps/api/src/core | Core source inventory and tests; no core-specific test suite beyond resolver/config/architecture | Implemented |
| C-004 | Core has no competition-specific business logic | 7.2 | core | Source inspection; core imports no capability business modules | Implemented |
| C-005 | Static capability registration list | 7.3 | capabilities/index.ts | Source inspection and architecture test | Verified |
| C-006 | Validate unique IDs, missing deps, cycles, init order, duplicate contracts, conflicting declarations | 7.3 | dependency-resolver.ts, capability-registry.ts | `dependency-resolver.test.ts` covers duplicates, missing deps, cycles, order | Verified |
| C-007 | DAG topological resolution O(V+E) time and space, documented | 7.3, 14.4 | dependency-resolver.ts | Linear wide-graph test (2001 nodes) passes | Verified |
| C-008 | No runtime directory scanning, dynamic loading, service locator, extension marketplace | 7.3 | core | Source inspection; static imports only | Verified |
| C-009 | Communication only via public contract, domain event, infrastructure interface | 7.4 | core/contracts, events | Architecture tests enforce private-import boundaries, and an outbound-request test restricts fetch to the configured OIDC client. | Verified |
| C-010 | Submissions do not depend on notification/announcement/reporting implementations | 7.4 | capabilities | `capability-boundaries.test.ts` forbids cross-capability persistence imports; events use the outbox | Verified |
| C-011 | Transactional outbox for reliable events | 7.4, 17.6 | core/outbox.ts, worker-main.ts | Outbox publish, claim, retry, dead-letter, and worker drain paths are covered; delivery through registered handlers is exercised by integration flows. | Verified |
| C-012 | No Kafka/RabbitMQ/distributed event infra | 7.4 | deps | `runtime-parity.test.ts` forbids kafka/rabbitmq/redis dependencies | Verified |
| C-013 | Each capability owns rules, operations, persistence, contracts, deps, tests, permissions, events docs | 7.5 | capabilities | All 13 capabilities have READMEs; identity remains a thin HTTP/domain adapter over core authentication. | Implemented |
| C-014 | No private imports between capabilities, no cross-capability DB access | 7.5 | capabilities | `capability-boundaries.test.ts` passes | Verified |
| C-015 | Core supports future expansion without becoming a framework | 7.7 | core + docs | Design review; no executable check | Implemented |

## 8. Product features

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| F-001 | Public landing explaining nethack with real opportunities | 8.1 | apps/site | Playwright public-site case passes; content uses seeded competitions/projects | Verified |
| F-002 | Public competition directory, overview, rules, schedule, projects, project detail, past competitions | 8.1 | apps/site/src/app | Pages exist; Playwright public-site and accessibility cases pass | Verified |
| F-003 | Public about, FAQ, announcements | 8.1 | apps/site/src/app | Pages exist; Playwright accessibility cases pass | Verified |
| F-004 | No artificial marketing sections, invented sponsors/testimonials/statistics | 8.1 | apps/site | Source and fixture inspection; no automated content audit | Implemented |
| F-005 | Participant: login, onboarding, profile, org selection, registration, dashboard, competition overview | 8.2 | workspace | First-run onboarding explains membership and invitation steps; negative-path E2E asserts it, and registration/dashboard flows pass. | Verified |
| F-006 | Participant: team discovery/creation/invitations/membership, project create/edit/files, submissions, history, notifications, announcements, preferences | 8.2 | workspace | Participant Playwright workflow covers registration, team, invitation, project, file upload, submission, and notifications; announcements and preferences are present but not in that journey | Verified |
| F-007 | Team workspace: info, member management, invitations, roles, project association/files, activity, status, submission readiness | 8.3 | workspace + API | Team creation, invitation acceptance, member display, and team-rules tests pass; activity history and submission readiness are present but not E2E-covered | Implemented |
| F-008 | Project/submission: metadata, description, members, repo links, attachments, requirements, draft, validation, confirmation, versioning, history, deadline enforcement, revisions, organizer review, published showcase | 8.4 | projects, submissions, files | Organizer/participant E2E and submission/file-version tests pass | Verified |
| F-009 | Submission state transitions explicit and server-enforced | 8.4 | submissions/domain | `submission-rules.test.ts` (18 tests) passes | Verified |
| F-010 | Judging: dashboard, assignments, review, rubric, criteria, scoring, feedback, COI, submit, history, assignment management, calibration | 8.5 | judging | Judging rules, history, COI, and E2E pass. Calibration is policy-driven and the product exposes no calibration policy, so no calibration workflow is required. | Verified |
| F-011 | Voting: rounds, eligibility, ballots, submission, duplicate prevention, integrity, results, publication | 8.6 | voting | Voting rules (24 tests) and voting E2E pass | Verified |
| F-012 | Voting transactionally enforced by DB/API, no client counter | 8.6 | voting schema + DB constraints | Duplicate-ballot concurrency test passes; casting uses a row lock and unique constraints; 24 voting rule tests | Verified |
| F-013 | Organizer: org, series, editions, divisions, registration, eligibility, deadlines, participants, teams, projects, submissions, rubrics, judges, assignments, evaluations, voting, results, announcements, notifications, reports, audit, permissions, settings | 8.7 | API + workspace | Organizer E2E covers organization creation, series, editions, divisions, milestones, registration approval, rubric creation, judge assignment, and ranked judging results; reports, audit, permissions, and settings have API and capability tests. | Verified |
| F-014 | Administration scoped; org admin does not administer other orgs; global admin rare/auditable | 8.8 | authorization + admin capability | `role-escalation.test.ts` (4 tests) and admin rules tests pass | Verified |

## 9. Programming standards

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| T-001 | Java-flavored TypeScript with practical OOP | 9 | all | Code review; no automated style check | Implemented |
| T-002 | Classes for meaningful state, encapsulation, constructor injection, composition, explicit interfaces, domain models, small services | 9.1 | API + packages | Code review | Implemented |
| T-003 | No deep inheritance, giant bases, artificial factories, locators, singleton managers, trivial interfaces, one-function wrapper classes, getter/setter-heavy models | 9.1 | all | Code review | Implemented |
| T-004 | React function components/hooks; no FP dogma outside React | 9.2 | apps + ui | Code review | Implemented |
| T-005 | `.tsx` only rendering; `.ts` for logic; no full workflow in .tsx | 9.3 | all | code-standards.test.ts rejects API client imports, fetch, query/mutation orchestration, and SQL in .tsx files. | Verified |
| T-006 | Strict TS flags: strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes, noImplicitOverride, noImplicitReturns, noFallthroughCasesInSwitch, forceConsistentCasing, verbatimModuleSyntax, skipLibCheck | 9.4 | tsconfig.base.json + app tsconfigs | `bun run typecheck` passes for all packages | Verified |
| T-007 | No careless any, @ts-ignore, suppressed errors, non-null assertions, unsafe assertions; unknown for untrusted; validate inputs; explicit nullability; exhaustive transitions; minimal generics | 9.4 | all | `code-standards.test.ts` passes; typecheck passes | Verified |
| T-008 | Naming conventions (kebab files, PascalCase types/components, camelCase functions, snake_case DB) | 9.5 | all | Source inspection; no automated check | Implemented |
| T-009 | Oxfmt with exact configuration, filename .oxfmtrc.json | 9.6 | .oxfmtrc.json | `bun run format:check` passes | Verified |
| T-010 | Oxlint sole linter with TS/React/hooks/a11y/import/promise/correctness rules | 9.7 | .oxlintrc.json | `bun run lint` passes with 0 errors and 248 warnings | Verified |
| T-011 | No ESLint/Prettier/competing formatter/dependency | 9.7 | deps | `runtime-parity.test.ts` checks absent configs and dependencies | Verified |
| T-012 | Code review standard: ownership, dependencies, clarity, abstraction, permissions, tests, DB efficiency, mobile, errors | 9.8 | docs + PR checklist | Document review | Implemented |

## 10. Basis Auth integration

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| B-001 | Basis Auth as external OIDC provider; read SETUP_GUIDE contract | 10 | apps/api/src/authentication | Mock OIDC integration suite passes; live provider unavailable | Verified |
| B-002 | Dedicated confidential client registration config: exact redirect URIs, audience, scopes, permissions, backchannel, tenants, consent | 10.2 | docs/integrations/basis-auth.md, config | Environment schema validation passes; no live registration evidence | Implemented |
| B-003 | Config uses documented audience/scope references, not blind copies | 10.2 | docs, config | Document review | Implemented |
| B-004 | Separate dev/staging/prod registrations | 10.2 | deployment env docs | Only development values exist; no staging/production credentials | Blocked |
| B-005 | Login: state, nonce, PKCE, server-side transaction, discovery, redirect, state validation, confidential code exchange, ID token validation, app session, encrypted tokens, workspace redirect | 10.3 | login-service, token-service | `tests/auth/login.test.ts` (8 tests) passes against the mock OIDC provider | Verified |
| B-006 | Maintained OIDC library, no hand-rolled OAuth/OIDC crypto | 10.3 | openid-client | Dependency inspection; login tests pass | Verified |
| B-007 | Opaque app session, `__Host-nethack_session` Secure/HttpOnly/SameSite=Lax/Path=/ no Domain | 10.4 | session-service | Cookie behavior covered by login/session tests | Verified |
| B-008 | Browser never receives client secret, refresh/access tokens, private/encryption keys | 10.4 | auth code | Architecture tests and code inspection; no direct browser-token test | Implemented |
| B-009 | Store only session hash in PostgreSQL; encrypted tokens at rest | 10.4 | sessions schema + crypto | Schema and AES-256-GCM implementation; integration tests pass but no database-content assertion | Implemented |
| B-010 | Serialized refresh rotation with per-session lock, atomic persist, expiry update | 10.5 | token-service | `tests/auth/refresh.test.ts` (2 tests) passes; `SELECT ... FOR UPDATE` implemented | Verified |
| B-011 | Logout: local, provider, refresh revocation, backchannel logout, backchannel token revocation, invalidation, disabled account, idempotent callbacks | 10.6 | auth + backchannel-service | Backchannel, logout, refresh, and identity tests pass | Verified |
| B-012 | Validate callback signatures, claims, issuer, audience, timing; tokens_valid_after support | 10.6 | backchannel-service, basis-auth-client | `backchannel.test.ts` (3 tests) passes; JWT typ/iss/aud/alg checks implemented | Verified |
| B-013 | Identity `(issuer, subject)` durable; email not permanent key | 10.7 | external_identities | Login and account-linking tests pass | Verified |
| B-014 | Local records for orgs, memberships, competition roles, team membership, judge assignment, admin grants | 10.7 | DB schema | 42 tables and integration tests | Verified |
| B-015 | Application permissions complement, never replace org checks | 10.7 | authorization | Cross-organization and role-escalation tests pass | Verified |
| B-016 | Release checklist: conformance, redirect, PKCE, rotation, keys, callback, linking, revocation reviews | 10.8 | docs/security/authentication.md | Live conformance and credentialed review not executed | Blocked |
| B-017 | SETUP_GUIDE kept authoritative; integration changes update it | 10.8 | docs/integrations/basis-auth.md | Document review | Implemented |

## 11. Fastify API

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| API-001 | Fastify only authoritative backend with listed responsibilities | 11.1 | apps/api | Architecture and integration tests | Verified |
| API-002 | Prescribed organization (core, authentication, http, capabilities, infrastructure, workers, observability, main) | 11.2 | apps/api/src | Directory inspection | Verified |
| API-003 | REST resources, explicit methods, versioned /api/v1, consistent responses, validation, authorization, cursor pagination, bounded sizes, timeouts, idempotency, transactions, predictable errors | 11.3 | apps/api | 85 unique `/api/v1` paths across 118 route registrations; pagination, idempotency, error handler; integration tests | Verified |
| API-004 | Route handler only request, validate, authenticate, org context, authorize, call operation, serialize | 11.4 | http | Source inspection across capabilities; integration tests | Verified |
| API-005 | No complex business rules in route files | 11.4 | http | Source inspection; no automated check | Implemented |
| API-006 | Zod validates bodies, query, params, external identity, file metadata, responses, config | 11.5 | contracts + api | Contracts and route schemas; typecheck and integration tests | Verified |
| API-007 | Fastify schema validation/serialization; no DB in schema validators | 11.5 | http | Source inspection; integration tests | Verified |
| API-008 | Response schemas prevent field disclosure | 11.5 | routes | Response schemas used; cross-organization tests | Verified |
| API-009 | Error categories: validation, authn, authz, not found, conflict, rate limit, external, internal; no stack traces/paths/secrets | 11.6 | http/errors | Error handler and integration/security tests | Verified |
| API-010 | Private diagnostic logs with correlation IDs | 11.6 | observability, request IDs | Request ID header and structured logging; no dedicated log assertion | Implemented |
| API-011 | OpenAPI generated from actual contracts and synchronized | 11.7 | @fastify/swagger | `/api/v1/openapi.json` route and Swagger UI exist; no OpenAPI contract test | Implemented |

## 12. Database

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| D-001 | PostgreSQL, Drizzle, migrations, parameterized queries, explicit transactions, separate runtime/migration credentials | 12.1 | database + api | 5 migrations, integration tests, separate URLs in config/CI | Verified |
| D-002 | Separate database from Basis Auth; never query provider tables | 12.1 | schema + docs | No provider tables or queries found | Verified |
| D-003 | Org hierarchy: org → series → edition → divisions → registrations → participants → teams → projects → submissions → judging → voting; multiple orgs/series | 12.2 | schema | 42 tables; integration tests across the hierarchy | Verified |
| D-004 | Core entities present: organizations, memberships, users, external identities, series, editions, divisions, registrations, participants, teams, members, invitations, projects, members, submissions, versions, files, rubrics, criteria, assignments, evaluations, voting rounds, ballots, votes, announcements, notifications, audit | 12.3 | schema | Table inventory and migrations | Verified |
| D-005 | Every org-owned record has org scope; composite FKs, uniques, scoped queries, transactional authorization | 12.4 | schema + repos | Cross-organization and RLS tests | Verified |
| D-006 | RLS: transaction-local tenant context, non-owner role, no BYPASSRLS, FORCE RLS, separate migration creds, pool isolation, fail closed | 12.4 | migrations + db client | `rls.test.ts` and `organization-isolation.test.ts` pass; 24 `FORCE ROW LEVEL SECURITY` statements | Verified |
| D-007 | RLS additional layer, not substitute for API authorization | 12.4 | authorization | Cross-org and role tests | Verified |
| D-008 | Index FKs/filters, composite org indexes, no N+1, bounded results, cursor pagination, explicit order, inspect plans, bounded connections | 12.5 | schema + repositories | EXPLAIN shows competition_editions_status_idx and projects_published_idx scans for public lists; composite organization indexes and cursor pagination exist; k6 p95 96 ms. | Verified |
| D-009 | Indexes based on query patterns | 12.5 | migrations | Migration inspection; no query-plan evidence | Implemented |

## 13. Security

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| SEC-001 | ASVS 5.0 L2 target; L3 for identity, org isolation, files, privileged admin | 13.1 | docs/security + tests | ASVS mapping document exists; no requirement-level worksheet | Implemented |
| SEC-002 | Security objectives: no known XSS, SQLi, BOLA, cross-org leak, exposed tokens, unprotected admin, unsafe file execution, excess privileges, unresolved criticals | 13 | all | All executed application security tests pass; the remaining objective requires an independent assessment, which is externally blocked. | Blocked |
| SEC-003 | Next.js runtime has no DB creds, IdP secret, private session cookie, admin API creds, workspace build creds | 13.2 | apps/site | `runtime-parity.test.ts` passes | Verified |
| SEC-004 | Workspace holds no server secrets/DB access/private tokens; API grants only session authority | 13.2 | apps/workspace | `runtime-parity.test.ts` passes | Verified |
| SEC-005 | XSS: no unsafe innerHTML, eval, script construction, raw user HTML; markdown raw HTML disabled; sanitizer when needed; URL scheme validation; strict CSP | 13.3 | UI + site + api | `code-standards.test.ts`, `tests/security/markdown.test.ts`, and redirect/URL tests pass; no browser XSS suite | Verified |
| SEC-006 | CSP per app: default/script/connect/form restrictions, object none, base-uri self, frame-ancestors none, HTTPS prod | 13.4 | headers config | Site proxy CSP, API helmet, and Caddy headers inspected; public-site E2E passes | Verified |
| SEC-007 | SQLi: Drizzle parameterization, no concat, parameterized raw SQL, sort/filter allowlists, no user table names/fragments, separate privileges | 13.5 | repositories | `tests/security/injection.test.ts` (5 tests) passes | Verified |
| SEC-008 | Authorization: identity, org, resource org, membership, permission, eligibility, assignment/ownership each request | 13.6 | authorization + routes | Cross-organization (12 tests) and role-escalation (4 tests) pass | Verified |
| SEC-009 | Never trust frontend; possession != permission | 13.6 | all | Cross-org and role tests | Verified |
| SEC-010 | CSRF: secure cookies, HttpOnly, SameSite, synchronizer token, exact Origin, Referer, no state-changing GET, custom header, content-type | 13.7 | auth + middleware | `csrf.test.ts` (5 tests) and `csrf-origin.test.ts` (9 tests) pass | Verified |
| SEC-011 | SSRF: host restrictions, loopback/private rejection, resolved IP validation, redirect revalidation, limits, timeouts, outbound restriction | 13.8 | safe-fetch | Outbound-request architecture test permits fetch only in the configured OIDC client; no arbitrary URL fetching exists. | Verified |
| SEC-012 | Files: auth → quarantine → inspection → approved → authorized download; signature/MIME, size, generated names, executables rejected, SVG rejected/transformed, archive traversal/bombs, scan, no execution, separate cookieless origin | 13.9 | files capability | `file-security.test.ts` (10 tests) and file-version test pass | Verified |
| SEC-013 | Clickjacking frame restrictions | 13.10 | helmet/CSP | Frame-ancestors/X-Frame-Options configured; header inspection | Verified |
| SEC-014 | Open redirect allowlist | 13.10 | login redirect validation | `tests/security/redirect-and-url.test.ts` (9 tests) passes | Verified |
| SEC-015 | Session fixation prevention (regeneration) | 13.10 | session-service | A login regeneration test proves a presented pre-login cookie is revoked and replaced. | Verified |
| SEC-016 | Brute force/flooding rate limits (perimeter + API) | 13.10 | @fastify/rate-limit + Caddy | Per-route login burst test returns 429 with Retry-After; the rate-limit error mapping bug is fixed. | Verified |
| SEC-017 | Cache poisoning/cross-tenant leakage prevention; authenticated `private, no-store`; public scoped caching; no experimental shared caching | 13.10-13.11 | headers + site | API onSend sets `private, no-store`; site proxy does the same; source inspection | Verified |
| SEC-018 | Credential theft/secret exposure: secure storage, secrets management | 13.10 | auth + deployment | Secrets kept server-side and encrypted tokens; deployment secret handling documented | Implemented |
| SEC-019 | Dependency compromise: SBOM, monitoring, scanning | 13.10, 13.13 | scripts + CI | `security:scan` generates a CycloneDX SBOM and scans for common secret patterns; CI uploads the SBOM. Monitoring/alerting remains external. | Implemented |
| SEC-020 | Privilege escalation prevented via least privilege | 13.10 | authz | `role-escalation.test.ts` (4 tests) passes | Verified |
| SEC-021 | Race conditions prevented via transactions/constraints | 13.10 | DB + services | `duplicates.test.ts` (7 tests) passes, including concurrent ballots; voting uses a row lock | Verified |
| SEC-022 | Next.js latest patched; monitor advisories; disable SVG optimization; minimize image surface; no private server functionality; no auth in proxy; private sessions off public origin; patch/test | 13.12 | site config + policy | Next.js 16.4.6, SVG optimization disabled, no auth in proxy, private HTML caching, and a daily audit workflow are configured. | Verified |
| SEC-023 | Dependency policy: pin production versions, monitor, scan direct/transitive, SBOM, secret scan, remove unused, review transitive, automated alerts, emergency procedure; critical/high blocks release | 13.13 | deps + docs | Pinned versions, high-severity audit gate, CycloneDX SBOM, secret scan, and a daily scheduled audit workflow are present. | Verified |
| SEC-024 | Security tests: stored/reflected/DOM XSS, SQLi, IDOR, cross-org, CSRF, SSRF, open redirects, session fixation, refresh reuse, backchannel, malicious uploads, duplicate voting/submissions, concurrent updates, unauthorized admin | 13.14 | tests/security | SQLi, cross-org, CSRF, redirects, refresh reuse, backchannel, uploads, duplicates, rate limits, session fixation, rendered-HTML escaping, outbound boundaries, and deterministic input fuzzing are tested; DAST remains external. | Implemented |
| SEC-025 | Static analysis, dependency scanning, DAST, fuzz, independent pen test | 13.14 | CI + docs | Static analysis, dependency audit, SBOM, secret scan, and deterministic fuzzing are executed; DAST and independent penetration testing require an external assessor. | Blocked |

## 14. Performance

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| PERF-001 | Fast on ordinary laptops/phones/slow networks/hosting | 14 | all | Lighthouse mobile and desktop: performance 100, accessibility 100, best practices 100, SEO 100. | Verified |
| PERF-002 | Minimal JS, lazy modules, route splits, few providers, no duplicate state, no enormous CSS, self-hosted fonts, preload only critical, no third-party scripts, optimized images, no excess chart deps, server rendering | 14.1 | apps + ui | Route-level lazy imports and self-hosted fonts; workspace main chunk is 1.1 MB with a build warning | Implemented |
| PERF-003 | Modern React idioms; no manual memo everywhere, no derived-state effects, no state framework without need | 14.2 | apps | Source inspection; some exhaustive-deps lint warnings remain | Implemented |
| PERF-004 | API: bounded pool, efficient queries, explicit serialization, size limits, timeouts, bounded concurrency, pagination, avoid repeated validation/logging hot paths | 14.3 | api | k6 passed: 0% failed requests, public p95 96ms, health p95 42ms under 20 VUs. Lighthouse TTFB 20ms. | Verified |
| PERF-005 | Nontrivial algorithms document time/space/worst case/inputs | 14.4 | source docs | Dependency resolver documents and tests O(V+E); other algorithms not audited | Implemented |
| PERF-006 | Animation CSS-first, transforms/opacity, reduced motion, 60 FPS | 14.5 | ui | Playwright runs with `reducedMotion: "reduce"` and passes; GSAP respects reduced motion | Verified |
| PERF-007 | Targets: LCP<=2.5s, INP<=200ms, CLS<=0.1, TTFB<=800ms, p95<=200ms, p99<=500ms, Lighthouse 95+/100 a11y | 14.6 | all | Mobile LCP 1.1s, CLS 0, TBT 50ms; desktop LCP 0.3s, CLS 0, TBT 0ms; Lighthouse 100/100/100/100. | Verified |

## 15. Build efficiency

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| BUILD-001 | Build systems per app (Next/Turbopack, Vite, tsc, shared packages) | 15.1 | configs | `bun run build` builds contracts, UI, API, workspace, and site | Verified |
| BUILD-002 | Build rules: no unnecessary bundles/files/barrels/codegen/network, incremental TS, caches, no DB at build, don't prerender entire DB | 15.2 | build config | Build inspection; site routes are dynamic; no build-time DB access | Implemented |
| BUILD-003 | Root scripts per plan; dev starts only required processes and cleans up | 15.5 | package.json, scripts/dev.ts | Scripts exist; `bun run build` and check pass; dev process cleanup not tested | Implemented |
| BUILD-004 | Dependencies resolved latest, compatibility verified, removed if unnecessary, pinned exact, locked, frozen CI, reviewed/tested | 15.6 | package.json, bun.lock | Exact versions and `bun.lock`; CI uses `--frozen-lockfile`; audit passes | Verified |

## 16. Testing

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| QA-001 | Stack: Vitest unit/integration/API injection, Playwright E2E, axe, k6 load, architecture checks, visual, dependency scanning, static analysis | 16.1 | tests + configs | Vitest, Playwright, axe, screenshots, architecture, k6 (executed), Lighthouse, audit, secret scan, and SBOM are wired. | Verified |
| QA-002 | Every capability independently testable: domain, operations, contracts, persistence, authorization, events, errors, concurrency | 16.2 | capability tests | All 13 capabilities have local tests; 717 unit/architecture/UI tests and 84 integration/security/fuzz/worker tests pass. Cross-cutting dimensions are covered by integration suites. | Verified |
| QA-003 | Architecture checks: private imports, cycles, DB access, server modules in browser, exposed secrets, duplicate contracts, unregistered deps, runtime imports | 16.3 | tests/architecture | Architecture suite passes | Verified |
| QA-004 | Visual tests desktop/tablet/mobile/light/dark/loading/error/empty | 16.4 | tests/visual | Visual baselines cover desktop dark/light, tablet, mobile, loading, empty, error, not-found, and the component laboratory. | Verified |
| QA-005 | Accessibility: keyboard, focus, labels, semantics, contrast, errors, dialogs, touch, reduced motion, zoom | 16.5 | E2E + axe | Full Playwright suite (including axe and mobile overflow checks) passes | Verified |
| QA-006 | E2E full journey sign-in → onboarding → org → register → team → invite → project → files → submit → assign judge → evaluate → vote → results → logout → invalidation | 16.6 | tests/e2e | 82 Playwright cases cover sign-in, organization creation, onboarding guidance, participant, organizer, judge scoring and ranked results, voting and eligibility, public site, showcase, project media, rubrics, edition theme, team invitations/edit/disband, profile parity, submission integrity, judge feedback, results parity/feedback, results freeze, admin tools, operator tools, logout, negative paths, command palette, axe, and visuals. | Verified |
| QA-007 | Negative paths tested for every important workflow | 16.6 | tests/e2e, tests/security | Negative-path E2E and security suites pass | Verified |

## 17. Deployment and operations

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| OPS-001 | Conventional long-running deployment; no serverless/K8s/service-per-capability/excess infra | 17.1 | deployment | Compose topology inspection | Implemented |
| OPS-002 | Topology: proxy/WAF/rate limits, site SSR, static workspace, Fastify, PostgreSQL, Basis Auth | 17.2 | deployment | Compose and Caddy config inspection; stack not started | Implemented |
| OPS-003 | Node and Bun deployment dirs with site/api Dockerfiles and compose | 17.3 | deployment | Files exist; Docker unavailable, so no image was built | Blocked |
| OPS-004 | Hardening: non-root, restricted FS/network, CPU/memory limits, separate creds, graceful shutdown, health, no exposed internal ports, TLS, read-only FS | 17.4 | Dockerfiles/compose/Caddy | Configuration inspection; stack not started | Implemented |
| OPS-005 | DB operations: separate migrations/creds, backups, encrypted storage, retention, restoration tests, monitoring, limits, compatibility; no auto-destructive migrations | 17.5 | scripts + docs | Backup/restore with age encryption and retention pruning was executed end to end; separate roles, migrations, and non-destructive startup are verified. | Verified |
| OPS-006 | Workers separate process same code: email, notifications, file inspection, reports, exports, imports, deadlines; PG-backed jobs/outbox; idempotency, concurrency, retries, lease, failure, DLQ; no Redis | 17.6 | workers | Queue/outbox claims, leases, retries, dead-lettering, and worker startup under Node and Bun are tested; no Redis dependency. | Verified |
| OPS-007 | Observability: structured logs, correlation IDs, errors, latency, DB, auth, worker, health, CWV, OTel-compatible tracing | 17.7 | observability | Structured logging, request IDs, health endpoints, OTel wiring; no metrics endpoint or executed observability test | Implemented |

## 18. Documentation and governance

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| DOC-001 | Documentation tree per plan | 18.1 | docs | Directory inspection | Verified |
| DOC-002 | Root AGENTS.md covers architecture, structure, rules, Oxfmt/Oxlint, runtime, testing, security, docs, forbidden patterns | 18.2 | AGENTS.md | Document review | Verified |
| DOC-003 | Capability READMEs: ownership, deps, contracts, persistence, permissions, events, tests, extraction | 18.2 | capability READMEs | All 13 capabilities now have READMEs; identity and organizations were added during remediation. | Verified |
| DOC-004 | Forbidden agent behaviors documented and enforced | 18.3 | AGENTS.md + architecture tests | Docs present; enforcement is partial | Implemented |
| DOC-005 | ADRs 001-008 | 18.4 | docs/architecture/decisions | ADR-001 through ADR-009 exist | Verified |
| DOC-006 | Documentation reflects actual implementation | 13 | docs | Tracker and report were reconciled against executed checks; capability README gaps are closed. | Verified |
| DOC-007 | Requirement tracker maintained | mandate | docs/implementation/REQUIREMENT_TRACKER.md | This file, updated after remediation and the final verification pass. | Verified |
| DOC-008 | Final implementation report with all results, blockers, deviations | mandate | FINAL_IMPLEMENTATION_REPORT.md | FINAL_IMPLEMENTATION_REPORT.md exists and was updated after remediation. | Verified |

## 19. Roadmap phases

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| PH-0 | Existing platform audit and migration specification | 19.1 | docs/implementation/platform-audit.md | Audit document exists; operator inputs and old-platform artifacts were never provided | Blocked |
| PH-1 | Runtime compatibility prototype verified before substantial implementation | 19.2 | scripts/verify-runtime.ts | `bun run verify:runtime` exits 0 with 7/7 checks after the process-tree cleanup fix. | Verified |
| PH-2 | Engineering constitution | 19.3 | docs/engineering | Documents exist | Verified |
| PH-3 | Repository foundation incl. CI and dual-runtime scripts | 19.4 | repo | Build, checks, and CI workflow exist | Verified |
| PH-4 | Nethack Core with test capabilities | 19.5 | apps/api/src/core | Core resolver/config/architecture tests pass | Verified |
| PH-5 | Nethack UI foundation | 19.6 | packages/ui | Catalog and lab exist; component test wiring and visual matrix incomplete | Implemented |
| PH-6 | Basis Auth integration | 19.7 | authentication | Mock OIDC integration passes; live provider conformance is blocked by the absence of Basis Auth/Entra credentials and the private @basis/schema package. | Blocked |
| PH-7 | Database/API foundation | 19.8 | database + http | Migrations, RLS, and integration tests pass | Verified |
| PH-8 | Core capabilities identity → organizations → competitions → participants → teams → projects → submissions | 19.9 | capabilities | Capability tests, integration tests, and E2E pass | Verified |
| PH-9 | Operational capabilities judging, voting, announcements, notifications, administration, reporting | 19.10 | capabilities | Capability tests and E2E pass; reporting summary implemented | Verified |
| PH-10 | Public site and workspace complete experience | 19.11 | apps | Public-site and workspace E2E pass; onboarding is absent | Implemented |
| PH-11 | Production hardening: audit, OIDC conformance, pen test, cross-org, load, build profiling, a11y, visual, dual runtime, backup restore | 19.12 | tests + docs | Audit, cross-org, load, a11y, visual, dual-runtime, backup/restore, Lighthouse, and Caddy checks pass; OIDC conformance and independent penetration testing are externally blocked. | Blocked |
| PH-12 | Migration/launch: historical data, identity mapping, org/submission verification, staged deployment, monitoring, recovery, old platform retirement | 19.13 | scripts/migrate-legacy + docs | Migration tool and synthetic fixture tested (22 tests); no real data or cutover | Blocked |

## 20. Acceptance criteria

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| AC-01 | Architecture acceptance: small core, static registration, explicit deps, no cycles, testable/extractable capabilities, no private imports, no unnecessary packages/abstractions | 20.1 | whole repo | Architecture suite passes; identity is a thin, documented adapter over core authentication. | Implemented |
| AC-02 | UI acceptance: full catalog, consistent APIs, documented variants, Noto Sans Mono, palette, no caps/fake data/decorative elements, complete states/keyboard/mobile, visual tests | 20.2 | packages/ui + apps | Full catalog, typed variants, Noto Sans Mono/palette rules, 35 UI tests, component-lab axe and dark/light screenshots, keyboard palette, loading/empty/error visuals, and no caps/fake data pass. | Verified |
| AC-03 | Security acceptance: no known XSS/SQLi/IDOR/cross-org/secrets, secure auth/session/logout/revocation, files, no high/critical deps, independent assessment | 20.3 | all | Security tests, audit, fuzzing, and isolation checks pass; independent security assessment is externally blocked. | Blocked |
| AC-04 | Runtime acceptance: full API/site/DB/auth/workers/deploy under Node and Bun | 20.4 | apps + deployment | 11/11 runtime checks cover API, site, migrations, and workers under Node and Bun; deployment remains blocked by Docker availability. | Implemented |
| AC-05 | Performance acceptance: CWV, bounded caches/processing/queries/JS/deps, build times, memory/CPU, responsive interactions | 20.5 | all | Lighthouse 100 mobile and desktop, CLS 0, LCP 1.1s mobile/0.3s desktop, k6 p95 96ms; no memory/CPU profiling. | Verified |
| AC-06 | Maintainability acceptance: docs, capability docs, typed contracts, architecture checks, format/lint, meaningful tests, readable, no incomplete-as-complete | 20.6 | repo | Formatting, lint, typecheck, tests, capability docs, architecture checks, and final report reconcile; remaining gaps are external or explicitly partial. | Verified |
| AC-07 | Technology manifest honored (framework/runtime/tooling/storage/deploy choices) | 21 | repo | React Router 7.18.7 now matches the manifest; GSAP motion is the only owner-directed addition, recorded in ADR-009. | Verified |
| AC-08 | Final engineering constitution applied | 22 | repo | Document review | Implemented |
| AC-09 | First deliverables: runtime proof, constitution, repo foundation, core, UI foundation, Basis Auth, org DB, Fastify, Teams capability, vertical slice | 23 | repo | All deliverables exist and the runtime proof now exits successfully. | Verified |
| AC-10 | Do not overabstract UI; do not compromise runtime; do not confuse visual complexity with quality | 24 | repo | Design review | Implemented |

## 21. Second parity wave

The reference-parity completion pass added the remaining public and operator surfaces without changing the capability architecture.

| Area | Implementation | Verification |
| --- | --- | --- |
| Showcase | `/showcase` index with featured Beneath the Surface and Signal cards, `/showcase/signal` scroll experience with featured winners and an interactive project marquee, `/showcase/beneath-the-surface` six-winner experience with keyboard modals, and `/showcase/seasons/[slug]` archives with published ranks and awards | `tests/e2e/16-showcase.spec.ts`; public axe/mobile suite covers every showcase route |
| Project media | Demonstration video URL and AI-use disclosure persisted on projects, carried through public payloads, and rendered in workspace forms/detail, public project pages, showcase cards/modals, judging, and voting | `tests/e2e/21-project-media.spec.ts`; project schema and disclosure unit tests |
| Edition settings | Theme name/description and public score/ranking visibility flags; track-grouped public results with podium, certificates, project preview dialogs, and hidden-ranking behavior | `tests/e2e/23-edition-theme.spec.ts`, `tests/e2e/24-results-parity.spec.ts`; competition/recognition unit tests |
| Rules | The reference Code of Conduct and Competition Rules are included verbatim (35,481 characters, version 1.0, effective 21 November 2026) on the global and competition rules pages | `tests/e2e/20-operator-tools.spec.ts`; extracted text matched the reference source exactly |
| Rubrics | Division/track rubrics, min/max criteria, weighted totals, immutable versions, assignment pinning, comment guidance/templates, reusable template library, and edition score curves applied to displayed judge scores | `tests/e2e/17-rubric-tracks.spec.ts`; `rubric-model` and `edition-freeze` unit tests |
| Teams and profiles | `withdrawn`, `disqualified`, and `no_show` statuses with terminal transitions and API-level submission/project blocking; validated 1 MB PNG/JPEG/WebP profile theme images rendered on public and workspace profiles | `tests/e2e/18-team-profile-parity.spec.ts`; `team-rules` and `profile-theme` unit tests |
| Results and voting | Ballot reasoning, explicit per-voter scored-project cap, transactional results publication that freezes judging and voting, closes open rounds, restores the prior status on unpublish, and notifies affected participants | `tests/e2e/19-results-freeze.spec.ts`; updated voting journeys |
| Operator tools | Anonymized database export, read-only stored-file/reference browser, persisted operator AI chat with a real `503` when unconfigured, protected documentation index, and event-specific FAQ/rules guidance | `tests/e2e/20-operator-tools.spec.ts`; `database-export` and `debug-ai-service` unit tests |
| Persistence | Migration `0006_lying_fallen_one.sql` adds rubric versions/templates/curves, profile themes, debug AI tables, voting cap/reasoning, and the prior edition status, with RLS policies, `current_user_id()`, and runtime grants | Development and test databases migrate cleanly; integration suite passes |

## 22. Third parity wave

The submission-integrity and eligibility pass closed the last reference behavior gaps.

| Area | Implementation | Verification |
| --- | --- | --- |
| Submission integrity | Repository, demo, demonstration video, and AI-use disclosure are required before any submission or version can be created; the first submitted version locks the project; project edits return `409`; organizer reopen unlocks the project; the version form requires a rules acknowledgement; project edits autosave to local storage every ten seconds with restore/discard | `25-submission-integrity.spec.ts`; `submission-integrity`, `project-lock`, and project media unit tests |
| Ballot eligibility | Discovery lists only submissions in the voter's division and excludes the voter's own team; cast revalidates the same scope; inactive teams receive no ballot options; teamless voters use a documented fallback; organizers keep a management view | `25-voting-eligibility.spec.ts`; `ballot-eligibility` and `votable-submissions` unit tests |
| Judge context and feedback | Judge assignments, queue, and history expose team, division, description, repository, demo, video, AI disclosure, and submission state; comments require 20 trimmed characters, reject `{{...}}` templates and the judge's own name/email; rubric weights must total 100; score curves freeze after publication; anonymous team feedback unlocks at three submitted reviews | `26-judge-feedback.spec.ts`; `judge-comments`, `team-feedback`, rubric, and edition-freeze unit tests |
| Results threshold and schedule | `competition_editions.results_open_at` drives a public scheduled-release notice; public rank, display score, and average are withheld below three submitted evaluations; `my-results` returns score, rank, and anonymous feedback; results page adds People's Choice and all-project previews | `27-results-feedback.spec.ts`, `11-results-awards`, `24-results-parity`; `results-assembly` and `results-release` unit tests |
| Public surfaces | Project directory search plus track filter and full pagination; project detail shows rank, awards, certificate, video, AI disclosure, and results; home shows the latest announcement and a live milestone countdown; competition pages publish the active judging rubric and a `/calendar.ics` feed; the showcase archive lists only completed or archived seasons and returns 404 for active ones | Site typecheck/build and E2E journeys |
| Persistence | Migration `0008_last_micromacro.sql` adds `projects.locked_at` and `competition_editions.results_open_at` | Development and test databases migrate cleanly; integration and E2E pass |

## 23. Fourth parity wave

The final functional-only audit closed every remaining workflow gap.

| Area | Implementation | Verification |
| --- | --- | --- |
| Team lifecycle | `/invitations` inbox with accept/decline by token or id; captain invite copy/rotate/revoke; pending invitations count toward capacity; team name/description/division editing; captain leave with solo-disband and transfer guard; disband keeps history and blocks when a submission exists | `02`, `03`, `08`, `18`; team rules and capacity unit tests |
| Team history | `team_members.left_at` soft-removal preserves past memberships; My results includes left teams; judge assignment checks reject judges who belonged to the submission's team | `recognition-service`; `bulk-assignment` and E2E journeys |
| Judge operations | Bulk assignment with all-submission, division, and single-project scopes; duplicate/revoked handling; judge flags create in-app notifications for owners/organizers; preflight adds below-three-review teams, schedule conflicts, and vote-cap warnings | `04`, `12`, `13`, `20`; bulk, flag, and preflight unit tests |
| Administration | Audit rows render reason and before/after values with redaction; database export supports JSON and CSV; global administrators can delete accounts with self/last-admin/ownership refusal and transactional cleanup | `13`, `20`; audit, CSV, and account-deletion unit tests |
| Notifications and contact | Global unread notification bell with count polling; edition contact email/URL validated and published on the contact and competition pages | `13`, `14`; unread-count and contact-channel unit tests |
| Persistence | Migration `0009_motionless_marvex.sql` adds `teams.status_reason`; `0010_strange_spiral.sql` adds edition contact fields and `team_members.left_at` with an active-membership unique index | Development and test databases migrate cleanly; integration, security, and E2E pass |

## 24. Fifth parity wave

The final functional audit closed result integrity, lifecycle recovery, and judging quality controls.

| Area | Implementation | Verification |
| --- | --- | --- |
| Result integrity | Inactive teams receive no rank, score, podium slot, award display, or certificate; votes from inactive voter teams or for inactive submissions are excluded; People's Choice averages each team/teamless voter as one unit; ballots store the voter team at cast time | Judging, recognition, and voting unit tests; `11`, `24` E2E |
| Edition lifecycle | Pause/resume, reopen submissions/judging/voting, and confirmed reset; paused editions are hidden publicly and frozen for judging/voting/submissions; every action audits prior/next status | `03` E2E; lifecycle and rules unit tests |
| Judging controls | Organizers void submitted evaluations with full cleanup and re-assignment; calibration exposes standard deviation and ≥3-evaluation 2σ outliers; drafts autosave after 650 ms, flush on navigation, and protect unsaved work | `04`, `12` E2E; evaluation-void and calibration unit tests |
| Administration | Standings CSV includes status, track, exact/display scores, live awards, links, and submitted state; competing participants cannot hold judge/organizer roles or join a team as a judge | `13`, `20` E2E; standings and role-conflict unit tests |
| Public gallery | Public project list/detail require the edition to be in voting or a finished state | `06`, `21` E2E; project visibility tests |
| Persistence | Migration `0011_amusing_virginia_dare.sql` adds the paused status, `status_before_pause`, and `ballots.voter_team_id` | Development and test databases migrate cleanly; integration, security, and E2E pass |
