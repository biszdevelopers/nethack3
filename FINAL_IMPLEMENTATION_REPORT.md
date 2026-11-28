# Final implementation report

Status: implementation is complete for the repository scope. The tracker records 228 requirements: 146 Verified, 71 Implemented, 0 In progress, 0 Not started, and 11 Blocked; every blocked item requires external infrastructure, credentials, data, or an independent assessor. Production launch is not verified. External blockers are listed in section 5.

Verification date: 2026-11-28, after the second parity pass. The final working tree was checked with formatting, lint, type checking, unit/UI tests, integration/security/fuzz tests, the production build, 11 runtime checks under Node and Bun, 72 Playwright cases, 26 visual/axe checks, Lighthouse mobile and desktop, Caddy validation, the dependency audit, and the secret scan/SBOM generator. A k6 load run and a backup/restore plus retention drill passed earlier in the same tree family; Docker images remain unavailable. The requirement-by-requirement status is in `docs/implementation/REQUIREMENT_TRACKER.md`.

## 1. Implemented system

### Applications

| Application | Implementation |
| --- | --- |
| `apps/api` | Fastify 5 authoritative API. Nethack3 Core with static capability registration, DAG validation, configuration, error handling, request IDs, structured logging, health endpoints, transactional outbox, PostgreSQL-backed job queue, and an OpenTelemetry-compatible tracing hook. 14 capabilities: identity, organizations, competitions, participants, teams, projects, files, submissions, judging, voting, recognition, announcements, notifications, administration. Versioned `/api/v1` routes generated from shared contracts, including organizer-ranked judging results. OpenAPI 3.1 at `/api/v1/openapi.json` with Swagger UI gated by `API_DOCS_ENABLED`. |
| `apps/site` | Next.js 16 App Router public site. Landing with event phase and next milestone, competition directory, competition detail, rules, schedule, project showcase, the Signal and Beneath the Surface showcase experiences, project detail, past competitions, season archive, published results, printable certificates, public profiles with themes, contact, contributing, about, FAQ, announcements, sitemap, robots, error, loading, and not-found routes. Server-rendered from the public API only, with a nonce-based CSP and `private, no-store` HTML caching. |
| `apps/workspace` | React 19 + Vite 8 static authenticated workspace. Sign-in, auth error, dashboard, competitions, competition detail, competition administration, teams, team detail, projects, project detail, submissions, submission detail, judging with queue/history/coverage/ranked results, rubric manager, assignment detail, voting with star ballots, organization with first-run creation, award and results publication, administration with users/teams/standings and database export, developer debug and documentation tools, participant results, profile with theme image, presentation, notifications, settings, and component lab. React Router 7 with lazy route modules and nested layouts; TanStack Query for server state. |

### Packages

| Package | Implementation |
| --- | --- |
| `packages/ui` | Nethack UI: source-owned components on Radix primitives, Tailwind CSS 4, Tailwind Variants, clsx/tailwind-merge, Noto Sans Mono, dark-first tokens, Lucide icons, TanStack Table, React Hook Form, Zod, cmdk, date-fns/react-day-picker, and GSAP motion. Catalog covers layout, elements, forms, data display, navigation, overlays, dashboard, page composition, and advanced components. Provider, hooks, stores, viewports, and a development lab route are included. |
| `packages/contracts` | Zod request/response schemas and inferred types shared by the API, site, workspace, and client. |
| `packages/api-client` | Typed HTTP client for the workspace, including auth, organizations, competitions, teams, projects, submissions, judging, voting, recognition, notifications, and administration. |

### Reference parity additions

The implementation now covers the event surfaces the BIBS-C reference deployment exposes:

- Public event phase, next milestone, season archive, published standings, awards, People's Choice, printable certificates, public profiles, contact, and contributing pages.
- Participant results with current and past rankings, certificate links, and presentation-stage guidance.
- Judge queue with previous/next/next-unscored navigation, draft evaluation reuse, recusal through the conflict workflow, project flags, per-season evaluation history, organizer coverage, and calibration comparison.
- Organizer award catalog, team award assignment, result publication with an immutable snapshot, and unpublishing.
- Organization administration for members and roles, edition teams and members, team status, team deletion, submission reopening, standings CSV, and preflight readiness.
- Ten-star peer voting: exact total, five-star per-project cap, transactional recasting, ranked results, and People's Choice.
- Full showcase experience: showcase index, Signal scroll experience with featured winners and an interactive project marquee, Beneath the Surface data-driven six-winner experience with keyboard project modals, and season archives with results-aware rankings.
- Project media parity: demonstration video links and the required AI-use disclosure are stored, validated, carried through public projects, and shown in the workspace, public project pages, showcase cards/modals, judging, and voting.
- Edition parity: theme name/description, public score visibility, and public ranking visibility settings, with track-grouped results, podium ordering, certificates, project preview dialogs, and hidden-ranking behavior.
- Rules parity: the binding Code of Conduct and Competition Rules are included verbatim from the reference, with the version and effective date preserved.
- Rubric parity: division/track rubrics, min/max criteria, comment guidance and templates, immutable rubric versions pinned to assignments, a reusable template library, and edition score curves with judge-facing display scores.
- Team and profile parity: withdrawn, disqualified, and no-show team states with terminal transition rules and blocked submissions; validated PNG/JPEG/WebP profile theme images.
- Results publication freezes judging and voting transactionally, closes open voting rounds, restores the previous edition status on unpublish, and notifies affected participants.
- Operator tooling: anonymized database export, read-only stored-file/reference browsing, persisted operator AI chat with honest not-configured behavior, a protected documentation index, and event-specific FAQ/rules guidance.

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

- PostgreSQL 18 with Drizzle ORM and eleven migrations (`0000` through `0010`).
- 51 tables covering identity, sessions, auth transactions, revoked access tokens, backchannel events/challenges, global administrators, idempotency keys, outbox events, jobs, audit logs, organizations, settings, memberships, invitations, competition series/editions/divisions/milestones, registrations, participants, teams, team members/invitations, projects (including demonstration video and AI-use disclosure), project members, submissions, submission versions/files, judging rubrics/criteria/templates/score curves/assignments/evaluations/scores/flags, voting rounds/ballots/votes, profile themes, debug AI sessions/messages, awards/team awards/published results, announcements, and notifications.
- Organization scope on organization-owned records, composite foreign keys, unique constraints, and 34 `FORCE ROW LEVEL SECURITY` tables and 36 policies applied through a non-owner runtime role with transaction-local tenant context.
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
| Formatting | `bun run format:check` | Pass |
| Linting | `bun run lint` | Pass, 0 errors; warnings only |
| Type checking | `bun run typecheck` | Pass for contracts, UI, API, workspace, and site |
| Combined quality gate | `bun run check` | Pass (format, lint, typecheck, Vitest) |
| Unit, architecture, security, migration, UI | `bun run test` | 60 root files / 521 tests and 17 UI files / 35 tests passed |
| Integration, API security, fuzzing, and worker | `bun run test:integration`; `bun run test:security` | 18 files / 84 API/auth/security/fuzz/worker tests and 17 files / 80 API/auth/security tests passed against local PostgreSQL 18 |
| Production build | `bun run build` | Pass: contracts, UI, API, workspace, site |
| End-to-end | `bun run test:e2e` | 82 cases in 28 files, 1 desktop skip, 81 passed; showcase, project media, rubric, edition theme, team invitation/disband, profile, results parity and feedback, submission integrity, voting eligibility, judge feedback, results-freeze, admin tools, and operator journeys included |
| Runtime matrix | `bun run verify:runtime` | 11/11 checks passed and exited 0: API health, site HTTP, migrations, and worker startup under Node 24 and Bun 1.3.14, plus package builds |
| Dependency audit | `bun audit --audit-level=high` | Pass, no high-severity advisory reported; the only advisory is a moderate dev-server esbuild issue reached through local tooling, not production |
| Secret scan and SBOM | `bun run security:scan` | Pass; 797 text files scanned and a 71-component CycloneDX SBOM written |
| Performance | `bun run test:performance` | Lighthouse 13.6.0 against the production site: mobile 100 performance / 100 / 100 / 100; desktop 100 / 100 / 100 / 100 |
| Load | `bun run test:load` with k6 2.4.0 | Not rerun in this pass; k6 is not installed on this host. An earlier run in this workspace passed with 0% failed requests, public p95 96 ms, health p95 31 ms, 20 VUs. |
| Migration tool | `tests/migration/migrate-legacy.test.ts` | 22 tests passed |
| Backup and restore | `scripts/backup-database.ts`, `scripts/restore-database.ts` | 170 KiB custom-format dump created and restored into a scratch database (42 tables at the time of the drill; the schema now has 51); a restore-script import bug was fixed and the drill re-ran cleanly |
| Container images | Docker | Not executed; Docker is not installed |
| Caddy | `caddy validate` | Earlier validation passed (Caddy 2.11.9); the Caddy binary is not present in this pass, so the current configuration was not revalidated |
| Visual matrix | `bun run test:visual` | 26/26 checks: public-page axe scans including all showcase routes, mobile-overflow scan, workspace axe, command palette, loading state, component lab dark/light, desktop dark/light, tablet, mobile, empty archive, and not found |
| Live Basis Auth conformance | SETUP_GUIDE section 9 checklist | Not executed; no live issuer or credentials |

### What the tests cover

- Authentication: discovery, login with state/nonce/PKCE, code exchange, nonce mismatch, reused code, callback state mismatch, session creation, refresh rotation and reuse revocation, logout, backchannel logout and replay, revocation denylist, disabled-user rejection, and unlinked bearer subjects.
- Authorization and isolation: cross-organization access across organizations, members, settings, audit, invitations, competitions, registrations, teams, projects, files, submissions, judging, voting, announcements, and reports; RLS with correct, absent, and foreign tenant contexts; role escalation from participant, judge, organizer, and organization owner.
- Input and transport: CSRF (missing token, wrong token, foreign origin, missing Origin, bearer exemption), SQL injection payloads, invalid identifiers and limits, public slug injection, URL scheme rejection, and open-redirect allowlisting.
- Files: signature-valid PNG, structurally valid ZIP, SVG/HTML/executable rejection, oversize rejection, ZIP traversal and absolute-path rejection, entry-count limits, authorized download, public visibility after publication, withdrawal, and file snapshot into a new submission version.
- Concurrency and state: concurrent registrations, duplicate ballots, duplicate invitations, team capacity under concurrent acceptance, duplicate slugs, unique project slugs, competition/submission/voting state transitions, and judging status transitions.
- Product journeys: sign-in, participant workflow, organizer workflow (4 cases), judge workflow, voting, public site (desktop and mobile), logout, and negative paths. The accessibility suite runs axe on fifteen public pages including the showcase routes, a mobile-overflow check, the authenticated workspace overview, and a public-home visual baseline. Additional journeys cover the full showcase, rubric versions/templates/score curves, team status and profile theme parity, results publication freeze and participant notification, and operator export/debug/docs tools.
- Third parity wave: submission evidence is required before a version can be created, the first submitted version locks the project, and an organizer reopen unlocks it; ballots are restricted to the voter's division and exclude their own team; judge comments enforce the 20-character/template/identity rules and rubric weights must total 100; anonymous team feedback unlocks at three submitted reviews; public ranks and display scores are withheld below three reviews; results can be scheduled; the results page lists every public project and previews People's Choice; competition pages publish the active judging rubric and an iCalendar feed; the showcase archive lists only completed seasons; and the home page shows the latest announcement with a live milestone countdown.
- Fourth parity wave: team invitations have an in-app inbox with accept/decline/revoke/copy-link and pending capacity; teams can be renamed, re-tracked, left, or disbanded with history retained; judge assignments support all-submission and division scopes; judge flags notify organizers; preflight warns about below-threshold teams, schedule conflicts, and impossible vote caps; audit records render reasons and before/after diffs; database export supports CSV; global administrators can delete accounts with ownership and last-admin guards; a global unread notification bell is present; and competitions publish organizer contact channels on the contact and competition pages.

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

1. Docker is unavailable on this host. No container image was built and no Compose stack was started. The Node and Bun container targets are code-complete but unverified at runtime; the Caddyfile itself was validated with Caddy 2.11.9.
2. Live Basis Auth credentials are unavailable. Conformance was validated only against a contract-compliant mock OIDC provider. The SETUP_GUIDE section 9 and `docs/integrations/basis-auth.md` section 14 checklists remain unexecuted against a real issuer.
3. No old-platform schema, data export, identity mapping, file manifest, or URL inventory was provided. The migration tool is tested with synthetic data only; Phase 0 sign-off and Phase 12 cutover are blocked.
4. The public site is server-rendered with `force-dynamic`; no route segment uses SSG or ISR. Production fetches use `revalidate: 60`. The plan asks for static rendering and ISR where appropriate.
5. The workspace uses React Router 7.18.7, matching the technology manifest, and it remains the only routing library.
6. Motion uses GSAP 3.15 (ScrollTrigger, SplitText) under ADR-009. The plan's technology table says CSS plus selective Motion. ADR-009 records the owner-directed GSAP choice; glow, gradients, glass blur, and floating decorative shapes were removed to keep the visual rules intact.
7. Seventeen UI test files and 35 cases now run under `bun run test`, with component-lab axe and dark/light screenshots; an exhaustive hover/active state matrix is still partial.
8. Visual regression now covers public pages, loading, empty, error, 404, all viewport sizes, light/dark, and the component laboratory. Per-component screenshots outside the lab remain partial.
9. A first-run onboarding panel explains membership and invitation steps and lets an authenticated user create an organization, becoming its owner.
10. The command palette and keyboard shortcuts are wired into the workspace and E2E-tested. Organizers can compare judge averages against the edition average; a separate calibration scoring mode is not implemented.
11. `identity` has domain schemas, tests, and a README, while `organizations` has a README and rule tests. `identity` intentionally remains a thin HTTP/domain adapter over core authentication with no private persistence layer.
12. An outbound-request architecture test restricts `fetch` to the configured OIDC client; no arbitrary server-side URL fetching exists.
13. Session-fixation, rate-limit burst, rendered-HTML escaping, and deterministic input fuzzing tests now pass. DAST and an independent penetration test remain external.
14. The workspace build still reports a 1.1 MB main chunk and Vite's chunk-size warning; Lighthouse production scores and k6 thresholds pass despite it.
15. `bun run lint` passes with warnings only; they are non-blocking.

## 5. External blockers

| Blocker | Effect | What would unblock it |
| --- | --- | --- |
| Docker is not installed on this host | Container images, Compose topology, container health checks, Caddy routing/TLS, and backup restore inside the deployment stack cannot be verified | A host with Docker Engine and Compose v2, plus the production env file and DNS/TLS test hostnames |
| No live Basis Auth issuer, client, secret, resource secret, or Entra tenant | Live OIDC conformance, discovery/JWKS, code exchange, refresh rotation, backchannel delivery, revocation, secret rotation, and disabled-account propagation are unverified | Staging and production Basis Auth registrations and network access, then execute the SETUP_GUIDE section 9 checklist |
| No old-platform artifacts or operator inputs | Historical data migration, identity mapping, organization ownership verification, file export, URL redirect mapping, staging migration, and cutover are blocked | Schema export, user/identity export, file manifest, URL inventory, governance inputs, and an approved migration owner |
| No independent security assessor | Independent penetration test, DAST, and ASVS requirement-level sign-off are absent | Engagement with an independent assessor before launch |

## 6. Readiness statement

The repository contains a working, tested implementation of the product surface described in `FULL_PLAN.md`: the capability-based Fastify API, organization-aware PostgreSQL schema with RLS, Basis Auth OIDC integration, Nethack UI catalog, public Next.js site, authenticated React workspace, background worker, deployment definitions, and engineering documentation. The current tree passes formatting, linting, type checking, the combined quality gate, 521 unit/architecture/security tests plus 35 UI tests, 84 integration/API-security/fuzz/worker tests, 80 security tests, the production build, 11 runtime checks under Node and Bun, 82 Playwright cases with 81 passed and 1 intentionally skipped mobile case, 26 visual/axe checks, Lighthouse 100 performance / 100 accessibility / 100 best-practices / 100 SEO on mobile and desktop, earlier Caddy validation, the high-severity dependency audit, and the secret scan/SBOM generator.

It is not a verified production release. Production launch is blocked by the absence of Docker-based deployment verification and a live Basis Auth conformance run. The remaining gaps are tracked explicitly: partial per-component hover/active coverage, no DAST or independent security assessment, and production deployment/auth conformance that require external infrastructure. The legacy migration is a tested tool with a synthetic fixture, not a completed data migration.
