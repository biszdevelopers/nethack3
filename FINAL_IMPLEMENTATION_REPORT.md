# Final implementation report

Status: implementation is substantially complete for the repository scope; production launch is not verified. External blockers are listed in section 5.

Verification date: 2026-11-26, after the remediation pass. The final working tree was checked with formatting, lint, type checking, unit/UI tests, integration/security tests, the production build, runtime verification under Node and Bun, the full Playwright suite, the dependency audit, the secret scan/SBOM generator, and a backup/restore drill. The requirement-by-requirement status is in `docs/implementation/REQUIREMENT_TRACKER.md`.

## 1. Implemented system

### Applications

| Application | Implementation |
| --- | --- |
| `apps/api` | Fastify 5 authoritative API. Nethack3 Core with static capability registration, DAG validation, configuration, error handling, request IDs, structured logging, health endpoints, transactional outbox, PostgreSQL-backed job queue, and an OpenTelemetry-compatible tracing hook. 13 capabilities: identity, organizations, competitions, participants, teams, projects, files, submissions, judging, voting, announcements, notifications, administration. 85 unique `/api/v1` paths across 118 route registrations. OpenAPI 3.1 at `/api/v1/openapi.json` with Swagger UI gated by `API_DOCS_ENABLED`. |
| `apps/site` | Next.js 16 App Router public site. Landing, competition directory, competition detail, rules, schedule, project showcase, project detail, past competitions, about, FAQ, announcements, sitemap, robots, error, loading, and not-found routes. Server-rendered from the public API only, with a nonce-based CSP and `private, no-store` HTML caching. |
| `apps/workspace` | React 19 + Vite 8 static authenticated workspace. Sign-in, auth error, dashboard, competitions, competition detail, competition administration, teams, team detail, projects, project detail, submissions, submission detail, judging, assignment detail, voting, organization, administration, notifications, settings, and component lab. React Router 8 with lazy route modules and nested layouts; TanStack Query for server state. |

### Packages

| Package | Implementation |
| --- | --- |
| `packages/ui` | Nethack UI: source-owned components on Radix primitives, Tailwind CSS 4, Tailwind Variants, clsx/tailwind-merge, Noto Sans Mono, dark-first tokens, Lucide icons, TanStack Table, React Hook Form, Zod, cmdk, date-fns/react-day-picker, and GSAP motion. Catalog covers layout, elements, forms, data display, navigation, overlays, dashboard, page composition, and advanced components. Provider, hooks, stores, viewports, and a development lab route are included. |
| `packages/contracts` | Zod request/response schemas and inferred types shared by the API, site, workspace, and client. |
| `packages/api-client` | Typed HTTP client for the workspace, including auth, organizations, competitions, teams, projects, submissions, judging, voting, notifications, and administration. |

### Authentication

Basis Auth is integrated as an external OIDC provider in front of Microsoft Entra ID:

- Authorization code + PKCE (S256), independent state and nonce, and a server-side login transaction with a 10-minute TTL.
- ID token validation with the maintained `openid-client` library, exact issuer, client audience, RS256, expiry, nonce, and clock tolerance.
- Nethack-owned opaque session cookie `__Host-nethack_session` (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, no `Domain`). Only a session hash is stored; access and refresh tokens are AES-256-GCM encrypted at rest with key versioning.
- Serialized refresh rotation using `SELECT ... FOR UPDATE` on the session row, atomic token replacement, reuse detection, and session revocation on `invalid_grant`.
- Backchannel endpoint for `action=test` HMAC proof, `logout_token` verification (`typ=logout+jwt`), and access-token revocation (`typ=at-revocation+jwt`) with a JTI denylist honoring `valid_after`.
- Account linking by `(issuer, subject)`; email is profile data. Login is rejected when an email collision would require account linking.
- CSRF synchronizer token, exact Origin checks, and per-route login/callback rate limits.

All of this was exercised against a contract-compliant mock OIDC provider, not a live Basis Auth deployment.

### Database

- PostgreSQL 18 with Drizzle ORM and five migrations (`0000` through `0004`).
- 42 tables covering identity, sessions, auth transactions, revoked access tokens, backchannel events/challenges, global administrators, idempotency keys, outbox events, jobs, audit logs, organizations, settings, memberships, invitations, competition series/editions/divisions/milestones, registrations, participants, teams, team members/invitations, projects, project members, submissions, submission versions/files, judging rubrics/criteria/assignments/evaluations/scores, voting rounds/ballots/votes, announcements, and notifications.
- Organization scope on organization-owned records, composite foreign keys, unique constraints, and 24 `FORCE ROW LEVEL SECURITY` policies applied through a non-owner runtime role with transaction-local tenant context.
- Separate runtime and migration credentials, parameterized queries, cursor pagination, idempotency records for critical mutations, and audit records for privileged operations.

### Deployment and operations

- `deployment/node` and `deployment/bun` Dockerfiles and Compose files for PostgreSQL, API, worker, one-shot migration, site, and Caddy.
- Non-root/read-only containers, dropped capabilities where applicable, resource limits, internal database network, health checks, and Caddy TLS/security headers.
- Database backup and restore scripts (`scripts/backup-database.ts`, `scripts/restore-database.ts`), a local PostgreSQL helper, a runtime verification script, and a legacy migration CLI.
- Documentation for architecture, engineering standards, security, operations, Basis Auth, the migration specification, and a platform audit.

## 2. Verification results

All results below were executed on this host unless marked otherwise.

| Gate | Command or evidence | Result |
| --- | --- | --- |
| Formatting | `bun run format:check` | Pass, 618 files |
| Linting | `bun run lint` | Pass, 0 errors; warnings only |
| Type checking | `bun run typecheck` | Pass for contracts, UI, API, workspace, and site |
| Combined quality gate | `bun run check` | Pass (format, lint, typecheck, Vitest) |
| Unit, architecture, security, migration, UI | `bun run test` | 28 root files / 286 tests and 17 UI files / 35 tests passed |
| Integration, API security, and worker | `bun run test:integration`; `bun run test:security` | 17 files / 81 API/auth/security/worker tests and 15 static security tests passed against local PostgreSQL 18 |
| Production build | `bun run build` | Pass: contracts, UI, API, workspace, site |
| End-to-end | `bun run test:e2e` | 34 cases in 9 files, 1 desktop skip, 33 passed; accessibility/visual spec 16/16 |
| Runtime matrix | `bun run verify:runtime` | 7/7 checks passed and exited 0: API health 200 and site HTTP 200 under Node 24 and Bun 1.3.14, plus package builds |
| Dependency audit | `bun audit --audit-level=high` | Pass, no high-severity advisory reported |
| Secret scan and SBOM | `bun run security:scan` | Pass across 625 text files; 71-component CycloneDX SBOM written and uploaded by CI |
| Migration tool | `tests/migration/migrate-legacy.test.ts` | 22 tests passed |
| Backup and restore | `scripts/backup-database.ts`, `scripts/restore-database.ts` | 170 KiB custom-format dump created and restored into a scratch database with 42 tables; a restore-script import bug was fixed and the drill re-ran cleanly |
| Container images | Docker | Not executed; Docker is not installed |
| Load tests | k6 | Not executed; k6 is not installed |
| Visual matrix | `bun run test:visual` | 16/16 checks: seven public-page axe scans, mobile-overflow scan, workspace axe, command palette, and six screenshot baselines (desktop dark/light, tablet, mobile, empty archive, not found) |
| Live Basis Auth conformance | SETUP_GUIDE section 9 checklist | Not executed; no live issuer or credentials |

### What the tests cover

- Authentication: discovery, login with state/nonce/PKCE, code exchange, nonce mismatch, reused code, callback state mismatch, session creation, refresh rotation and reuse revocation, logout, backchannel logout and replay, revocation denylist, disabled-user rejection, and unlinked bearer subjects.
- Authorization and isolation: cross-organization access across organizations, members, settings, audit, invitations, competitions, registrations, teams, projects, files, submissions, judging, voting, announcements, and reports; RLS with correct, absent, and foreign tenant contexts; role escalation from participant, judge, organizer, and organization owner.
- Input and transport: CSRF (missing token, wrong token, foreign origin, missing Origin, bearer exemption), SQL injection payloads, invalid identifiers and limits, public slug injection, URL scheme rejection, and open-redirect allowlisting.
- Files: signature-valid PNG, structurally valid ZIP, SVG/HTML/executable rejection, oversize rejection, ZIP traversal and absolute-path rejection, entry-count limits, authorized download, public visibility after publication, withdrawal, and file snapshot into a new submission version.
- Concurrency and state: concurrent registrations, duplicate ballots, duplicate invitations, team capacity under concurrent acceptance, duplicate slugs, unique project slugs, competition/submission/voting state transitions, and judging status transitions.
- Product journeys: sign-in, participant workflow, organizer workflow (4 cases), judge workflow, voting, public site (desktop and mobile), logout, and negative paths. The accessibility suite runs axe on seven public pages, a mobile-overflow check, the authenticated workspace overview, and a public-home visual baseline.

## 3. Verified security posture

Verified by executed tests:

- No cross-organization disclosure in the tested resource families.
- RLS fails closed without tenant context and for a foreign tenant.
- CSRF and Origin enforcement on cookie-authenticated unsafe requests.
- Parameterized-query behavior under SQL-injection-shaped input.
- File signature, archive, size, and download authorization controls.
- Duplicate registration, ballot, invitation, and team-capacity constraints.
- Organization-scoped administration and global-administrator protection.
- Refresh-token reuse revokes the session; backchannel logout and revocation are processed.
- No high-severity dependency advisory under the configured audit gate.

Not verified:

- Live OpenID Foundation conformance, live discovery/JWKS, Microsoft Entra delegation, live backchannel delivery, client/resource secret rotation, and provider-side account disablement.
- Independent penetration test, DAST, and fuzzing. SBOM generation and secret scanning now run in CI.
- Browser-level stored/reflected/DOM XSS execution suite. Rendered-HTML escaping, outbound-request boundaries, session-fixation, and rate-limit burst tests pass.
- ASVS requirement-level worksheet with tester, date, and evidence for each applicable control.

## 4. Known limitations and deviations

1. Docker is unavailable on this host. No container image was built, no Compose stack was started, and the Caddy configuration was not validated by a Caddy binary. The Node and Bun container targets are code-complete but unverified at runtime.
2. Live Basis Auth credentials are unavailable. Conformance was validated only against a contract-compliant mock OIDC provider. The SETUP_GUIDE section 9 and `docs/integrations/basis-auth.md` section 14 checklists remain unexecuted against a real issuer.
3. No old-platform schema, data export, identity mapping, file manifest, or URL inventory was provided. The migration tool is tested with synthetic data only; Phase 0 sign-off and Phase 12 cutover are blocked.
4. The public site is server-rendered with `force-dynamic`; no route segment uses SSG or ISR. Production fetches use `revalidate: 60`. The plan asks for static rendering and ISR where appropriate.
5. The workspace uses React Router 8.5.3. The plan names React Router 7. React Router remains the only routing library.
6. Motion uses GSAP 3.15 (ScrollTrigger, SplitText) under ADR-009. The plan's technology table says CSS plus selective Motion. ADR-009 documents the change, including glow utilities and a scroll-progress gradient that narrow the plan's no-glow/no-gradient wording.
7. Seventeen UI test files and 35 cases now run under `bun run test`, but the exhaustive per-component state matrix is still incomplete.
8. Visual regression now has six page-level baselines plus axe scans; loading-state capture and component-level visual coverage remain incomplete.
9. A first-run onboarding panel now explains membership and invitation steps, but the workspace does not expose organization creation.
10. The command palette and keyboard shortcuts are wired into the workspace and E2E-tested. Judge calibration is still not implemented.
11. `identity` now has domain schemas, tests, and a README, while `organizations` has a README and rule tests. `identity` intentionally remains a thin HTTP/domain adapter over core authentication with no private persistence layer.
12. An outbound-request architecture test restricts `fetch` to the configured OIDC client; no arbitrary server-side URL fetching exists. A reusable SSRF utility is not needed because no feature accepts arbitrary URLs.
13. Session-fixation, rate-limit burst, and rendered-HTML escaping tests now pass. DAST, fuzzing, and an independent penetration test remain external.
14. No performance measurement was executed: no Lighthouse, Core Web Vitals, k6 throughput, or query-plan evidence. The workspace build still reports a 1.1 MB main chunk and Vite's chunk-size warning.
15. `bun run lint` passes with warnings only; they are non-blocking.

## 5. External blockers

| Blocker | Effect | What would unblock it |
| --- | --- | --- |
| Docker is not installed on this host | Container images, Compose topology, container health checks, Caddy routing/TLS, and backup restore inside the deployment stack cannot be verified | A host with Docker Engine and Compose v2, plus the production env file and DNS/TLS test hostnames |
| No live Basis Auth issuer, client, secret, resource secret, or Entra tenant | Live OIDC conformance, discovery/JWKS, code exchange, refresh rotation, backchannel delivery, revocation, secret rotation, and disabled-account propagation are unverified | Staging and production Basis Auth registrations and network access, then execute the SETUP_GUIDE section 9 checklist |
| No old-platform artifacts or operator inputs | Historical data migration, identity mapping, organization ownership verification, file export, URL redirect mapping, staging migration, and cutover are blocked | Schema export, user/identity export, file manifest, URL inventory, governance inputs, and an approved migration owner |
| No independent security assessor | Independent penetration test, DAST, fuzzing, and ASVS requirement-level sign-off are absent | Engagement with an independent assessor before launch |
| k6 is not installed | Load, burst, pool-saturation, and queue-growth tests are unexecuted | Install k6 and run against a production-like environment |
| No Caddy binary | The Caddyfile is unvalidated outside a container | `caddy validate --config deployment/caddy/Caddyfile` on a host with Caddy |

## 6. Readiness statement

The repository contains a working, tested implementation of the product surface described in `FULL_PLAN.md`: the capability-based Fastify API, organization-aware PostgreSQL schema with RLS, Basis Auth OIDC integration, Nethack UI catalog, public Next.js site, authenticated React workspace, background worker, deployment definitions, and engineering documentation. The current tree passes formatting, linting, type checking, the combined quality gate, 321 unit/architecture/security/UI tests, 81 integration/API-security/worker tests, the production build, runtime verification under Node and Bun, the full Playwright suite, the high-severity dependency audit, the secret scan/SBOM generator, and a backup/restore drill.

It is not a verified production release. Production launch is blocked by the absence of Docker-based deployment verification and a live Basis Auth conformance run. The remaining gaps are tracked explicitly: incomplete per-component visual/state coverage, no loading-state screenshot baseline, no load or Lighthouse/Core Web Vitals measurement, no DAST/fuzzing or independent security assessment, no judge calibration, no organization-creation flow, and production deployment/auth conformance that require external infrastructure. The legacy migration is a tested tool with a synthetic fixture, not a completed data migration.
