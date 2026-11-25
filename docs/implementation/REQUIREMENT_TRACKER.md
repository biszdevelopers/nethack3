# Requirement tracker

Source of truth: `FULL_PLAN.md` (2776 lines, sections 1-24) and `SETUP_GUIDE.md`
(Basis Auth downstream contract). Status values: Not started, In progress,
Implemented, Verified, Blocked. "Verified" requires an executed check, not file
presence.

## 1. Product identity and principles

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| P-001 | User-facing name is `nethack`, lowercase, never `nethack3` in UI | 1.1 | apps/site, apps/workspace, packages/ui | `tests/architecture/branding.test.ts` scans rendered shells and source strings | Not started |
| P-002 | Internal codename `nethack3` allowed in docs/repo only | 1.1 | docs, package name | Architecture test | Not started |
| P-003 | Five quality dimensions documented and not silently traded off | 1.2 | docs/engineering/constitution.md | Review of docs + ADRs | Not started |
| P-004 | Twelve non-negotiable principles enforced by review and architecture tests | 1.3 | docs/engineering, tests/architecture | Architecture suite | Not started |
| P-005 | Every abstraction has a concrete purpose; no speculative framework | 1.3, 24 | whole repo | ADRs + code review checklist | Not started |

## 2. Nethack UI architecture

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| UI-001 | Original React component system with Nuxt UI-level breadth | 2.1-2.4 | packages/ui | Component catalog + tests | Not started |
| UI-002 | Radix as sole interaction primitive foundation | 2.4 | packages/ui/package.json | Architecture test: no competing primitive libs | Not started |
| UI-003 | Tailwind CSS 4, Tailwind Variants, clsx + tailwind-merge | 2.4 | packages/ui/styles.css, lib/cn.ts | Typecheck + visual tests | Not started |
| UI-004 | Source-owned components inside repository | 2.4 | packages/ui/src/components | Architecture test | Not started |
| UI-005 | NethackProvider: theme, toast, overlay, tooltip, shortcuts, command palette, locale, settings | 2.5 | packages/ui/src/providers | Unit tests + lab | Not started |
| UI-006 | Provider is not a universal state container | 2.5 | providers | Code review + docs | Not started |
| UI-007 | Layout catalog (provider, container, main, header, footer, sidebar, splitter, shells, section, grid, columns, stack, page header/body/aside) | 2.6 A | packages/ui/src/components/layout | Catalog lab + tests | Not started |
| UI-008 | Basic element catalog (alert, avatar/group, badge, banner, button, calendar, card, chip, collapsible, field group, icon, kbd, progress/group, separator, skeleton, toggle/group, user, empty state, status) | 2.6 B | packages/ui/src/components | Catalog lab + tests | Not started |
| UI-009 | Form catalog (checkbox/group, color picker, file upload, form, form field, input, date input/picker, autocomplete, number, rating, tag, time, listbox, pin, radio, select, select menu, combobox, slider, switch, textarea, search, multi-step, validation summary) | 2.6 C | packages/ui/src/components/forms | Catalog lab + form tests | Not started |
| UI-010 | Data catalog (accordion, carousel, chart, empty state, scroll area, table, data table, timeline, tree view, user, activity feed, file list, key-value, stats, pagination controls) | 2.6 D | packages/ui/src/components/data | Catalog lab + tests | Not started |
| UI-011 | Navigation catalog (breadcrumb, command palette, footer columns, link, navigation menu, pagination, stepper, tabs, sidebar nav, contextual nav, search nav) | 2.6 E | packages/ui/src/components/navigation | Catalog lab + tests | Not started |
| UI-012 | Overlay catalog (context menu, drawer, dropdown, dialog, alert dialog, popover, slideover, toast, tooltip, hover card, confirmation) | 2.6 F | packages/ui/src/components/overlays | Catalog lab + tests | Not started |
| UI-013 | Dashboard catalog (group, navbar, panel, resize handle, search, search button, sidebar, collapse, toggle, toolbar) | 2.6 G | packages/ui/src/components/dashboard | Catalog lab + tests | Not started |
| UI-014 | Page composition catalog (page, anchors, aside, body, card, columns, CTA, feature, grid, header, hero, links, list, logos, section, content nav/search/TOC/pagination) | 2.6 H | packages/ui/src/layouts | Site/workspace usage + tests | Not started |
| UI-015 | Advanced components (rich text, toolbar, suggestion/mention menus, drag handle, charts, calendar views, resizable panels, advanced search, file preview, review panel, rubric, activity timeline) | 2.6 I | packages/ui/src/components/advanced | Catalog lab + tests | Not started |
| UI-016 | Component behavior is real, not visual shells | 2.6 | packages/ui | Interaction tests | Not started |
| UI-017 | Hooks: useToast, useOverlay, useShortcuts, useColorMode, useLocale, useMediaQuery, useControllableState, useDebouncedValue, useDisclosure, useIsMobile | 2.7 | packages/ui/src/hooks | Unit tests | Not started |
| UI-018 | No custom hook for trivial two-line state | 2.7 | hooks | Code review | Not started |
| UI-019 | Consistent component API (variant, size, color, disabled, loading, className, id, aria-*) where appropriate | 2.8 | packages/ui | Type-level tests + docs | Not started |
| UI-020 | Every interactive component tested across default/hover/focus/active/disabled/loading/error/keyboard/screen-reader/mobile/dark/light | 2.9 | packages/ui/tests, tests/visual | Vitest + Playwright + axe | Not started |
| UI-021 | Component laboratory documents examples, variants, sizes, props, keyboard, a11y, responsive, errors, code | 2.10 | apps/workspace/src/pages/lab, docs/engineering/ui-system.md | Lab route + screenshots | Not started |
| UI-022 | Visual regression tests for important components/pages | 2.10, 16.4 | tests/visual | Playwright screenshots | Not started |

## 3. Visual identity

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| V-001 | Noto Sans Mono everywhere, no other typeface | 3.1 | packages/ui/styles.css, font asset | Architecture test + computed-style E2E | Not started |
| V-002 | Font self-hosted with license | 3.1 | @fontsource/noto-sans-mono | Package license + build output | Not started |
| V-003 | Controlled font weights; hierarchy via size/weight/spacing | 3.1 | styles.css | Visual review | Not started |
| V-004 | Palette: #00DC82, #090909, #FFFFFF plus derived neutrals and greens only | 3.2 | packages/ui/styles.css | Architecture test scans hex colors | Not started |
| V-005 | Dark theme default; light theme same palette | 3.2 | theme provider + tokens | Theme tests | Not started |
| V-006 | Status communicated with color and text | 3.2 | status badge/indicator | a11y tests | Not started |
| V-007 | No all-caps UI text; no uppercase headings/buttons; no text-transform uppercase | 3.3 | all apps | Architecture test + E2E computed styles | Not started |
| V-008 | Product name always `nethack`; no abbreviations, fake stats, placeholder content, Lorem Ipsum | 3.3 | all apps | Architecture test + content review | Not started |
| V-009 | Construction rules: spacing, alignment, borders, radii, shadows, no gradients/glow/grids/random shapes | 3.4 | tokens + components | Visual review + tests | Not started |
| V-010 | Geometry tokens (5px/3px/8px radii, 36-44px controls, 1px borders, 4px unit, 1280px content, 24px padding) | 3.5 | tokens | Token unit test | Not started |
| V-011 | Interaction: immediate feedback, focus, no hidden/hover-only actions, clear errors, no layout shift | 3.6 | components | Interaction/a11y tests | Not started |
| V-007b | No invented competition metrics, names, deadlines, scores, results, announcements | 3.7 | site + workspace | Seed review + public API data checks | Not started |
| V-007c | Meaningful empty states when data absent | 3.7 | components + pages | E2E empty-state tests | Not started |

## 4. Application architecture

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| A-001 | Public frontend Next.js App Router with SSR/SSG/ISR/streaming | 4.1-4.4 | apps/site | Build + runtime tests | Not started |
| A-002 | Authenticated frontend React + Vite, static build | 4.1, 4.5 | apps/workspace | Build + E2E | Not started |
| A-003 | Fastify authoritative API | 4.1, 4.6 | apps/api | Integration tests | Not started |
| A-004 | PostgreSQL + Drizzle | 4.1 | apps/api/src/infrastructure/database | Migration + integration tests | Not started |
| A-005 | React Router 7 only routing library in workspace | 4.5 | apps/workspace/src/application | Architecture test | Not started |
| A-006 | Public site does not use Next.js as API, Server Actions for mutations, middleware auth, DB access, private credentials, user-specific caching, arbitrary remote fetch | 4.4 | apps/site | Architecture test | Not started |
| A-007 | Public site consumes only public API data | 4.4 | apps/site/src/lib/public-api.ts | Architecture test | Not started |
| A-008 | Fastify owns identity, sessions, authorization, org membership, business rules, DB, files, audit, submissions, judging, voting, admin | 4.6 | apps/api | Integration + security tests | Not started |
| A-009 | Origins and trust policy for www/app/api/asset, Basis Auth | 4.3 | config + deployment | Config validation tests | Not started |
| A-010 | Workspace: persistent shell, nested layouts, lazy routes, error boundaries, navigation state, search params, history, responsive nav | 4.5 | apps/workspace | E2E | Not started |

## 5. Bun and Node.js parity

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| R-001 | Bun is package manager and dev toolchain; bun.lock committed, no other lockfile | 5.1 | package.json, bun.lock | CI check + architecture test | Not started |
| R-002 | Bun workspaces with apps/* and packages/* | 5.1 | package.json | Install + build | Not started |
| R-003 | No Bun-only APIs in application logic | 5.2 | all source | Architecture test scans for Bun.* runtime APIs | Not started |
| R-004 | No undocumented Node behavior, runtime-specific business logic, dual implementations, hidden runtime detection | 5.2 | all source | Architecture tests | Not started |
| R-005 | No incompatible native dependencies | 5.2 | dependencies | Both-runtime verification | Not started |
| R-006 | Next.js dev/build/start under Node and Bun | 5.3-5.4 | apps/site scripts | Executed runtime verification | Not started |
| R-007 | Fastify dev/build/start under Node and Bun | 5.3-5.4 | apps/api scripts | Executed runtime verification | Not started |
| R-008 | DB operations, migrations, background workers, auth, file processing under both | 5.3 | apps/api | Integration suite under both runtimes | Not started |
| R-009 | Node 24+ baseline; pinned Bun stable | 5.3 | package.json engines, .tool-versions | Runtime check | Not started |
| R-010 | Dual-runtime CI install/build/start/integration/E2E | 5.5 | .github/workflows | CI config + local execution | Not started |
| R-011 | Same source and lock for both runtimes | 5.5 | repo | CI | Not started |
| R-012 | Build system: Bun workspaces, Turbopack, Vite, TS incremental, no Nx/Turborepo | 5.6 | configs | Architecture test | Not started |
| R-013 | Separate runtime scripts for site and API | 5.4 | package.json files | Executed | Not started |
| R-014 | Node and Bun deployment targets, same env schema, equivalent behavior | 17.3 | deployment/node, deployment/bun | Smoke scripts + documented limitation if Docker unavailable | Not started |

## 6. Repository organization

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| S-001 | Repository layout matches plan: apps, packages (ui, contracts, api-client), docs, tests, scripts, database | 6 | repo | Architecture test | Not started |
| S-002 | No packages for small abstractions; no common/misc/helpers/everything | 6.1 | repo | Architecture test | Not started |
| S-003 | Capabilities organized by responsibility with domain/application/infrastructure/http/tests/index | 6.2 | apps/api/src/capabilities | Architecture test | Not started |
| S-004 | Browser capability folders components/hooks/api/pages/index | 6.2 | apps/workspace/src/capabilities | Architecture test | Not started |
| S-005 | Shared contracts per domain | 6.2 | packages/contracts/src | Typecheck | Not started |

## 7. Nethack3 Capability Architecture

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| C-001 | Every feature is a capability; one Core backbone | 7.1 | apps/api/src/core | Architecture tests | Not started |
| C-002 | Capabilities are ordinary modules, extractable without domain rewrite | 7.1, 7.6 | capabilities | Capability READMEs + no private imports test | Not started |
| C-003 | Core only owns registry, composition, dependency validation, lifecycle, config, contracts, auth context, events, logging, errors, health | 7.2 | apps/api/src/core | Code review + architecture test | Not started |
| C-004 | Core has no competition-specific business logic | 7.2 | core | Architecture test | Not started |
| C-005 | Static capability registration list | 7.3 | capabilities/index.ts | Unit test | Not started |
| C-006 | Validate unique IDs, missing deps, cycles, init order, duplicate contracts, conflicting declarations | 7.3 | dependency-resolver.ts, capability-registry.ts | Unit tests incl. cycle | Not started |
| C-007 | DAG topological resolution O(V+E) time and space, documented | 7.3, 14.4 | dependency-resolver.ts | Unit test + docs | Not started |
| C-008 | No runtime directory scanning, dynamic loading, service locator, extension marketplace | 7.3 | core | Architecture test | Not started |
| C-009 | Communication only via public contract, domain event, infrastructure interface | 7.4 | core/contracts, events | Architecture test | Not started |
| C-010 | Submissions do not depend on notification/announcement/reporting implementations | 7.4 | capabilities | Architecture test | Not started |
| C-011 | Transactional outbox for reliable events | 7.4, 17.6 | infrastructure/outbox, workers | Integration test | Not started |
| C-012 | No Kafka/RabbitMQ/distributed event infra | 7.4 | deps | Dependency test | Not started |
| C-013 | Each capability owns rules, operations, persistence, contracts, deps, tests, permissions, events docs | 7.5 | capabilities | Capability tests + READMEs | Not started |
| C-014 | No private imports between capabilities, no cross-capability DB access | 7.5 | capabilities | Architecture test | Not started |
| C-015 | Core supports future expansion without becoming a framework | 7.7 | core + docs | Design review | Not started |

## 8. Product features

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| F-001 | Public landing explaining nethack with real opportunities | 8.1 | apps/site | E2E + content review | Not started |
| F-002 | Public competition directory, overview, rules, schedule, projects, project detail, past competitions | 8.1 | apps/site/src/app | E2E | Not started |
| F-003 | Public about, FAQ, announcements | 8.1 | apps/site/src/app | E2E | Not started |
| F-004 | No artificial marketing sections, invented sponsors/testimonials/statistics | 8.1 | apps/site | Content review test | Not started |
| F-005 | Participant: login, onboarding, profile, org selection, registration, dashboard, competition overview | 8.2 | workspace | E2E | Not started |
| F-006 | Participant: team discovery/creation/invitations/membership, project create/edit/files, submissions, history, notifications, announcements, preferences | 8.2 | workspace | E2E | Not started |
| F-007 | Team workspace: info, member management, invitations, roles, project association/files, activity, status, submission readiness | 8.3 | workspace + API | E2E | Not started |
| F-008 | Project/submission: metadata, description, members, repo links, attachments, requirements, draft, validation, confirmation, versioning, history, deadline enforcement, revisions, organizer review, published showcase | 8.4 | projects, submissions | Integration + E2E | Not started |
| F-009 | Submission state transitions explicit and server-enforced | 8.4 | submissions/domain | Unit tests | Not started |
| F-010 | Judging: dashboard, assignments, review, rubric, criteria, scoring, feedback, COI, submit, history, assignment management, calibration | 8.5 | judging | Integration + E2E | Not started |
| F-011 | Voting: rounds, eligibility, ballots, submission, duplicate prevention, integrity, results, publication | 8.6 | voting | Integration + E2E | Not started |
| F-012 | Voting transactionally enforced by DB/API, no client counter | 8.6 | voting schema + DB constraints | Concurrency test | Not started |
| F-013 | Organizer: org, series, editions, divisions, registration, eligibility, deadlines, participants, teams, projects, submissions, rubrics, judges, assignments, evaluations, voting, results, announcements, notifications, reports, audit, permissions, settings | 8.7 | API + workspace | E2E | Not started |
| F-014 | Administration scoped; org admin does not administer other orgs; global admin rare/auditable | 8.8 | authorization + admin capability | Security tests | Not started |

## 9. Programming standards

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| T-001 | Java-flavored TypeScript with practical OOP | 9 | all | Code review | Not started |
| T-002 | Classes for meaningful state, encapsulation, constructor injection, composition, explicit interfaces, domain models, small services | 9.1 | API + packages | Code review | Not started |
| T-003 | No deep inheritance, giant bases, artificial factories, locators, singleton managers, trivial interfaces, one-function wrapper classes, getter/setter-heavy models | 9.1 | all | Architecture/code review | Not started |
| T-004 | React function components/hooks; no FP dogma outside React | 9.2 | apps + ui | Code review | Not started |
| T-005 | `.tsx` only rendering; `.ts` for logic; no full workflow in .tsx | 9.3 | all | Architecture test | Not started |
| T-006 | Strict TS flags: strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes, noImplicitOverride, noImplicitReturns, noFallthroughCasesInSwitch, forceConsistentCasing, verbatimModuleSyntax, skipLibCheck | 9.4 | tsconfig.base.json + app tsconfigs | Typecheck | Not started |
| T-007 | No careless any, @ts-ignore, suppressed errors, non-null assertions, unsafe assertions; unknown for untrusted; validate inputs; explicit nullability; exhaustive transitions; minimal generics | 9.4 | all | Architecture test + typecheck | Not started |
| T-008 | Naming conventions (kebab files, PascalCase types/components, camelCase functions, snake_case DB) | 9.5 | all | Architecture test | Not started |
| T-009 | Oxfmt with exact configuration, filename .oxfmtrc.json | 9.6 | .oxfmtrc.json | format:check | Not started |
| T-010 | Oxlint sole linter with TS/React/hooks/a11y/import/promise/correctness rules | 9.7 | .oxlintrc.json | lint executed | Not started |
| T-011 | No ESLint/Prettier/competing formatter/dependency | 9.7 | deps | Architecture test | Not started |
| T-012 | Code review standard: ownership, dependencies, clarity, abstraction, permissions, tests, DB efficiency, mobile, errors | 9.8 | docs + PR checklist | Review checklist | Not started |

## 10. Basis Auth integration

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| B-001 | Basis Auth as external OIDC provider; read SETUP_GUIDE contract | 10 | apps/api/src/authentication | Docs + tests | Not started |
| B-002 | Dedicated confidential client registration config: exact redirect URIs, audience, scopes, permissions, backchannel, tenants, consent | 10.2 | docs/integrations/basis-auth.md, config | Config validation | Not started |
| B-003 | Config uses documented audience/scope references, not blind copies | 10.2 | docs | Review | Not started |
| B-004 | Separate dev/staging/prod registrations | 10.2 | deployment env docs | Deployment review | Not started |
| B-005 | Login: state, nonce, PKCE, server-side transaction, discovery, redirect, state validation, confidential code exchange, ID token validation, app session, encrypted tokens, workspace redirect | 10.3 | login-service, token-service | Integration test with mock IdP + live checklist | Not started |
| B-006 | Maintained OIDC library, no hand-rolled OAuth/OIDC crypto | 10.3 | openid-client | Dependency test | Not started |
| B-007 | Opaque app session, `__Host-nethack_session` Secure/HttpOnly/SameSite=Lax/Path=/ no Domain | 10.4 | session-service | Cookie tests | Not started |
| B-008 | Browser never receives client secret, refresh/access tokens, private/encryption keys | 10.4 | auth code | Security tests | Not started |
| B-009 | Store only session hash in PostgreSQL; encrypted tokens at rest | 10.4 | sessions schema + crypto | DB inspection test | Not started |
| B-010 | Serialized refresh rotation with per-session lock, atomic persist, expiry update | 10.5 | token-service | Concurrency test | Not started |
| B-011 | Logout: local, provider, refresh revocation, backchannel logout, backchannel token revocation, invalidation, disabled account, idempotent callbacks | 10.6 | auth + backchannel-service | Integration tests | Not started |
| B-012 | Validate callback signatures, claims, issuer, audience, timing; tokens_valid_after support | 10.6 | backchannel-service | Unit + integration tests | Not started |
| B-013 | Identity `(issuer, subject)` durable; email not permanent key | 10.7 | external_identities | DB test | Not started |
| B-014 | Local records for orgs, memberships, competition roles, team membership, judge assignment, admin grants | 10.7 | DB schema | Integration | Not started |
| B-015 | Application permissions complement, never replace org checks | 10.7 | authorization | Security tests | Not started |
| B-016 | Release checklist: conformance, redirect, PKCE, rotation, keys, callback, linking, revocation reviews | 10.8 | docs/security/authentication.md | Checklist + final report | Not started |
| B-017 | SETUP_GUIDE kept authoritative; integration changes update it | 10.8 | docs/integrations/basis-auth.md | Review | Not started |

## 11. Fastify API

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| API-001 | Fastify only authoritative backend with listed responsibilities | 11.1 | apps/api | Architecture test | Not started |
| API-002 | Prescribed organization (core, authentication, http, capabilities, infrastructure, workers, observability, main) | 11.2 | apps/api/src | Architecture test | Not started |
| API-003 | REST resources, explicit methods, versioned /api/v1, consistent responses, validation, authorization, cursor pagination, bounded sizes, timeouts, idempotency, transactions, predictable errors | 11.3 | apps/api | API tests | Not started |
| API-004 | Route handler only request, validate, authenticate, org context, authorize, call operation, serialize | 11.4 | http | Review + architecture test | Not started |
| API-005 | No complex business rules in route files | 11.4 | http | Architecture test | Not started |
| API-006 | Zod validates bodies, query, params, external identity, file metadata, responses, config | 11.5 | contracts + api | Tests | Not started |
| API-007 | Fastify schema validation/serialization; no DB in schema validators | 11.5 | http | Architecture test | Not started |
| API-008 | Response schemas prevent field disclosure | 11.5 | routes | Leak tests | Not started |
| API-009 | Error categories: validation, authn, authz, not found, conflict, rate limit, external, internal; no stack traces/paths/secrets | 11.6 | http/errors | Error tests | Not started |
| API-010 | Private diagnostic logs with correlation IDs | 11.6 | observability | Log tests | Not started |
| API-011 | OpenAPI generated from actual contracts and synchronized | 11.7 | @fastify/swagger | OpenAPI test | Not started |

## 12. Database

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| D-001 | PostgreSQL, Drizzle, migrations, parameterized queries, explicit transactions, separate runtime/migration credentials | 12.1 | database + api | Migration + config tests | Not started |
| D-002 | Separate database from Basis Auth; never query provider tables | 12.1 | schema + docs | Architecture test | Not started |
| D-003 | Org hierarchy: org → series → edition → divisions → registrations → participants → teams → projects → submissions → judging → voting; multiple orgs/series | 12.2 | schema | Integration | Not started |
| D-004 | Core entities present: organizations, memberships, users, external identities, series, editions, divisions, registrations, participants, teams, members, invitations, projects, members, submissions, versions, files, rubrics, criteria, assignments, evaluations, voting rounds, ballots, votes, announcements, notifications, audit | 12.3 | schema | Schema test | Not started |
| D-005 | Every org-owned record has org scope; composite FKs, uniques, scoped queries, transactional authorization | 12.4 | schema + repos | Isolation tests | Not started |
| D-006 | RLS: transaction-local tenant context, non-owner role, no BYPASSRLS, FORCE RLS, separate migration creds, pool isolation, fail closed | 12.4 | migrations + db client | RLS integration tests | Not started |
| D-007 | RLS additional layer, not substitute for API authorization | 12.4 | authorization | Security tests | Not started |
| D-008 | Index FKs/filters, composite org indexes, no N+1, bounded results, cursor pagination, explicit order, inspect plans, bounded connections | 12.5 | schema + repositories | EXPLAIN checks + load test | Not started |
| D-009 | Indexes based on query patterns | 12.5 | migrations | Review | Not started |

## 13. Security

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| SEC-001 | ASVS 5.0 L2 target; L3 for identity, org isolation, files, privileged admin | 13.1 | docs/security + tests | Mapping document | Not started |
| SEC-002 | Security objectives: no known XSS, SQLi, BOLA, cross-org leak, exposed tokens, unprotected admin, unsafe file execution, excess privileges, unresolved criticals | 13 | all | Security suite + final report | Not started |
| SEC-003 | Next.js runtime has no DB creds, IdP secret, private session cookie, admin API creds, workspace build creds | 13.2 | apps/site | Architecture test + env audit | Not started |
| SEC-004 | Workspace holds no server secrets/DB access/private tokens; API grants only session authority | 13.2 | apps/workspace | Architecture test | Not started |
| SEC-005 | XSS: no unsafe innerHTML, eval, script construction, raw user HTML; markdown raw HTML disabled; sanitizer when needed; URL scheme validation; strict CSP | 13.3 | UI + site + api | Security tests + CSP headers | Not started |
| SEC-006 | CSP per app: default/script/connect/form restrictions, object none, base-uri self, frame-ancestors none, HTTPS prod | 13.4 | headers config | Header tests | Not started |
| SEC-007 | SQLi: Drizzle parameterization, no concat, parameterized raw SQL, sort/filter allowlists, no user table names/fragments, separate privileges | 13.5 | repositories | Security tests + architecture test | Not started |
| SEC-008 | Authorization: identity, org, resource org, membership, permission, eligibility, assignment/ownership each request | 13.6 | authorization + routes | BOLA/IDOR tests | Not started |
| SEC-009 | Never trust frontend; possession != permission | 13.6 | all | Security tests | Not started |
| SEC-010 | CSRF: secure cookies, HttpOnly, SameSite, synchronizer token, exact Origin, Referer, no state-changing GET, custom header, content-type | 13.7 | auth + middleware | CSRF tests | Not started |
| SEC-011 | SSRF: host restrictions, loopback/private rejection, resolved IP validation, redirect revalidation, limits, timeouts, outbound restriction | 13.8 | safe-fetch | SSRF tests | Not started |
| SEC-012 | Files: auth → quarantine → inspection → approved → authorized download; signature/MIME, size, generated names, executables rejected, SVG rejected/transformed, archive traversal/bombs, scan, no execution, separate cookieless origin | 13.9 | files capability | File security tests | Not started |
| SEC-013 | Clickjacking frame restrictions | 13.10 | helmet/CSP | Header test | Not started |
| SEC-014 | Open redirect allowlist | 13.10 | login redirect validation | Redirect tests | Not started |
| SEC-015 | Session fixation prevention (regeneration) | 13.10 | session-service | Test | Not started |
| SEC-016 | Brute force/flooding rate limits (perimeter + API) | 13.10 | @fastify/rate-limit + Caddy | Rate-limit tests | Not started |
| SEC-017 | Cache poisoning/cross-tenant leakage prevention; authenticated `private, no-store`; public scoped caching; no experimental shared caching | 13.10-13.11 | headers + site | Header tests | Not started |
| SEC-018 | Credential theft/secret exposure: secure storage, secrets management | 13.10 | auth + deployment | Review | Not started |
| SEC-019 | Dependency compromise: SBOM, monitoring, scanning | 13.10, 13.13 | scripts + CI | Scan outputs | Not started |
| SEC-020 | Privilege escalation prevented via least privilege | 13.10 | authz | Security tests | Not started |
| SEC-021 | Race conditions prevented via transactions/constraints | 13.10 | DB + services | Concurrency tests | Not started |
| SEC-022 | Next.js latest patched; monitor advisories; disable SVG optimization; minimize image surface; no private server functionality; no auth in proxy; private sessions off public origin; patch/test | 13.12 | site config + policy | Config tests + audit | Not started |
| SEC-023 | Dependency policy: pin production versions, monitor, scan direct/transitive, SBOM, secret scan, remove unused, review transitive, automated alerts, emergency procedure; critical/high blocks release | 13.13 | deps + docs | audit output | Not started |
| SEC-024 | Security tests: stored/reflected/DOM XSS, SQLi, IDOR, cross-org, CSRF, SSRF, open redirects, session fixation, refresh reuse, backchannel, malicious uploads, duplicate voting/submissions, concurrent updates, unauthorized admin | 13.14 | tests/security | Executed suite | Not started |
| SEC-025 | Static analysis, dependency scanning, DAST, fuzz, independent pen test | 13.14 | CI + docs | Reports + documented external limitation | Not started |

## 14. Performance

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| PERF-001 | Fast on ordinary laptops/phones/slow networks/hosting | 14 | all | Lighthouse + load test | Not started |
| PERF-002 | Minimal JS, lazy modules, route splits, few providers, no duplicate state, no enormous CSS, self-hosted fonts, preload only critical, no third-party scripts, optimized images, no excess chart deps, server rendering | 14.1 | apps + ui | Bundle analysis | Not started |
| PERF-003 | Modern React idioms; no manual memo everywhere, no derived-state effects, no state framework without need | 14.2 | apps | Code review | Not started |
| PERF-004 | API: bounded pool, efficient queries, explicit serialization, size limits, timeouts, bounded concurrency, pagination, avoid repeated validation/logging hot paths | 14.3 | api | Load test | Not started |
| PERF-005 | Nontrivial algorithms document time/space/worst case/inputs | 14.4 | source docs | Architecture test | Not started |
| PERF-006 | Animation CSS-first, transforms/opacity, reduced motion, 60 FPS | 14.5 | ui | Reduced-motion tests | Not started |
| PERF-007 | Targets: LCP<=2.5s, INP<=200ms, CLS<=0.1, TTFB<=800ms, p95<=200ms, p99<=500ms, Lighthouse 95+/100 a11y | 14.6 | all | Measured report | Not started |

## 15. Build efficiency

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| BUILD-001 | Build systems per app (Next/Turbopack, Vite, tsc, shared packages) | 15.1 | configs | Build output | Not started |
| BUILD-002 | Build rules: no unnecessary bundles/files/barrels/codegen/network, incremental TS, caches, no DB at build, don't prerender entire DB | 15.2 | build config | Build audit | Not started |
| BUILD-003 | Root scripts per plan; dev starts only required processes and cleans up | 15.5 | package.json, scripts/dev.ts | Executed | Not started |
| BUILD-004 | Dependencies resolved latest, compatibility verified, removed if unnecessary, pinned exact, locked, frozen CI, reviewed/tested | 15.6 | package.json, bun.lock | Audit | Not started |

## 16. Testing

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| QA-001 | Stack: Vitest unit/integration/API injection, Playwright E2E, axe, k6 load, architecture checks, visual, dependency scanning, static analysis | 16.1 | tests + configs | Executed | Not started |
| QA-002 | Every capability independently testable: domain, operations, contracts, persistence, authorization, events, errors, concurrency | 16.2 | capability tests | Executed | Not started |
| QA-003 | Architecture checks: private imports, cycles, DB access, server modules in browser, exposed secrets, duplicate contracts, unregistered deps, runtime imports | 16.3 | tests/architecture | Executed | Not started |
| QA-004 | Visual tests desktop/tablet/mobile/light/dark/loading/error/empty | 16.4 | tests/visual | Executed baselines | Not started |
| QA-005 | Accessibility: keyboard, focus, labels, semantics, contrast, errors, dialogs, touch, reduced motion, zoom | 16.5 | E2E + axe | Executed | Not started |
| QA-006 | E2E full journey sign-in → onboarding → org → register → team → invite → project → files → submit → assign judge → evaluate → vote → results → logout → invalidation | 16.6 | tests/e2e | Executed | Not started |
| QA-007 | Negative paths tested for every important workflow | 16.6 | tests | Executed | Not started |

## 17. Deployment and operations

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| OPS-001 | Conventional long-running deployment; no serverless/K8s/service-per-capability/excess infra | 17.1 | deployment | Review | Not started |
| OPS-002 | Topology: proxy/WAF/rate limits, site SSR, static workspace, Fastify, PostgreSQL, Basis Auth | 17.2 | deployment | Compose/Caddy configs | Not started |
| OPS-003 | Node and Bun deployment dirs with site/api Dockerfiles and compose | 17.3 | deployment | Files + local runtime verification (Docker unavailable if so) | Not started |
| OPS-004 | Hardening: non-root, restricted FS/network, CPU/memory limits, separate creds, graceful shutdown, health, no exposed internal ports, TLS, read-only FS | 17.4 | Dockerfiles/compose/Caddy | Config review | Not started |
| OPS-005 | DB operations: separate migrations/creds, backups, encrypted storage, retention, restoration tests, monitoring, limits, compatibility; no auto-destructive migrations | 17.5 | scripts + docs | Backup/restore script execution | Not started |
| OPS-006 | Workers separate process same code: email, notifications, file inspection, reports, exports, imports, deadlines; PG-backed jobs/outbox; idempotency, concurrency, retries, lease, failure, DLQ; no Redis | 17.6 | workers | Worker tests under both runtimes | Not started |
| OPS-007 | Observability: structured logs, correlation IDs, errors, latency, DB, auth, worker, health, CWV, OTel-compatible tracing | 17.7 | observability | Metrics/log tests | Not started |

## 18. Documentation and governance

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| DOC-001 | Documentation tree per plan | 18.1 | docs | File check | Not started |
| DOC-002 | Root AGENTS.md covers architecture, structure, rules, Oxfmt/Oxlint, runtime, testing, security, docs, forbidden patterns | 18.2 | AGENTS.md | Review | Not started |
| DOC-003 | Capability READMEs: ownership, deps, contracts, persistence, permissions, events, tests, extraction | 18.2 | capability READMEs | File check | Not started |
| DOC-004 | Forbidden agent behaviors documented and enforced | 18.3 | AGENTS.md + architecture tests | Tests | Not started |
| DOC-005 | ADRs 001-008 | 18.4 | docs/architecture/decisions | File check | Not started |
| DOC-006 | Documentation reflects actual implementation | 13 | docs | Final review | Not started |
| DOC-007 | Requirement tracker maintained | mandate | docs/implementation | This file | In progress |
| DOC-008 | Final implementation report with all results, blockers, deviations | mandate | docs/implementation/FINAL_IMPLEMENTATION_REPORT.md | Final review | Not started |

## 19. Roadmap phases

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| PH-0 | Existing platform audit and migration specification | 19.1 | docs/implementation/platform-audit.md | Document | Not started |
| PH-1 | Runtime compatibility prototype verified before substantial implementation | 19.2 | scripts/verify-runtime.ts | Executed matrix | Not started |
| PH-2 | Engineering constitution | 19.3 | docs/engineering | Documents | Not started |
| PH-3 | Repository foundation incl. CI and dual-runtime scripts | 19.4 | repo | Build + CI | Not started |
| PH-4 | Nethack Core with test capabilities | 19.5 | apps/api/src/core | Unit tests | Not started |
| PH-5 | Nethack UI foundation | 19.6 | packages/ui | Catalog + tests | Not started |
| PH-6 | Basis Auth integration | 19.7 | authentication | Tests + checklist | Not started |
| PH-7 | Database/API foundation | 19.8 | database + http | Tests | Not started |
| PH-8 | Core capabilities identity → organizations → competitions → participants → teams → projects → submissions | 19.9 | capabilities | Tests + E2E | Not started |
| PH-9 | Operational capabilities judging, voting, announcements, notifications, administration, reporting | 19.10 | capabilities | Tests + E2E | Not started |
| PH-10 | Public site and workspace complete experience | 19.11 | apps | E2E | Not started |
| PH-11 | Production hardening: audit, OIDC conformance, pen test, cross-org, load, build profiling, a11y, visual, dual runtime, backup restore | 19.12 | tests + docs | Reports | Not started |
| PH-12 | Migration/launch: historical data, identity mapping, org/submission verification, staged deployment, monitoring, recovery, old platform retirement | 19.13 | scripts/migrate-legacy + docs | Dry-run migration + documented limitation | Not started |

## 20. Acceptance criteria

| ID | Requirement | Plan section | Implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| AC-01 | Architecture acceptance: small core, static registration, explicit deps, no cycles, testable/extractable capabilities, no private imports, no unnecessary packages/abstractions | 20.1 | whole repo | Architecture suite | Not started |
| AC-02 | UI acceptance: full catalog, consistent APIs, documented variants, Noto Sans Mono, palette, no caps/fake data/decorative elements, complete states/keyboard/mobile, visual tests | 20.2 | packages/ui + apps | Vitest/Playwright/axe | Not started |
| AC-03 | Security acceptance: no known XSS/SQLi/IDOR/cross-org/secrets, secure auth/session/logout/revocation, files, no high/critical deps, independent assessment | 20.3 | all | Security suite + audit + documented independent-test limitation | Not started |
| AC-04 | Runtime acceptance: full API/site/DB/auth/workers/deploy under Node and Bun | 20.4 | apps + deployment | Runtime verification | Not started |
| AC-05 | Performance acceptance: CWV, bounded caches/processing/queries/JS/deps, build times, memory/CPU, responsive interactions | 20.5 | all | Measurements | Not started |
| AC-06 | Maintainability acceptance: docs, capability docs, typed contracts, architecture checks, format/lint, meaningful tests, readable, no incomplete-as-complete | 20.6 | repo | Checks | Not started |
| AC-07 | Technology manifest honored (framework/runtime/tooling/storage/deploy choices) | 21 | repo | Dependency audit | Not started |
| AC-08 | Final engineering constitution applied | 22 | repo | Review | Not started |
| AC-09 | First deliverables: runtime proof, constitution, repo foundation, core, UI foundation, Basis Auth, org DB, Fastify, Teams capability, vertical slice | 23 | repo | Executed | Not started |
| AC-10 | Do not overabstract UI; do not compromise runtime; do not confuse visual complexity with quality | 24 | repo | Review | Not started |
