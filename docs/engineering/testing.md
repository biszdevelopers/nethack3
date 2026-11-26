# Testing standards

Required test layers, capability suites, runtime matrices, negative paths, and execution commands for nethack3.

## Testing stack

| Layer               | Tool                          |
| ------------------- | ----------------------------- |
| Unit                | Vitest                        |
| Integration         | Vitest                        |
| API                 | Fastify injection             |
| End-to-end          | Playwright                    |
| Accessibility       | axe-core with Playwright      |
| Load                | k6                            |
| Architecture        | Vitest architecture checks    |
| Visual regression   | Playwright screenshots        |
| Dependency security | Vulnerability scanning        |
| Static analysis     | Oxlint and security analyzers |

## Test pyramid

The suite has more fast tests than slow tests, and each layer has a distinct purpose.

| Layer | Purpose | Speed |
| --- | --- | --- |
| Unit | Domain rules, value objects, algorithms, validation, pure transformations | Fast |
| Integration | Application operations, persistence, transactions, authorization, events, HTTP contracts | Medium |
| End-to-end | Real user journeys across the site, workspace, API, database, and identity | Slow |

Rules:

- Domain logic is tested without a database.
- Application operations are tested with a real PostgreSQL schema or a production-faithful test database, not a fake that hides constraints.
- API tests use Fastify injection and assert status, headers, body, and side effects.
- End-to-end tests use Playwright against running applications.
- A test asserts observable behavior, not private implementation details.
- A test that cannot fail for a meaningful reason is removed or rewritten.
- Coverage is reported but does not substitute for required cases.

## Capability test suites

Every capability under `apps/api/src/capabilities/<name>` owns tests in its `tests/` folder. Every capability must be independently testable and must cover:

| Area | Required coverage |
| --- | --- |
| Domain rules | Invariants, state transitions, eligibility, deadlines, ownership, uniqueness |
| Application | Each public operation, including success and failure branches |
| Contracts | Input and output schemas, compatibility, rejection of unknown or malformed input |
| Persistence | Mapping, constraints, transactions, rollback behavior |
| Authorization | Identity, organization context, membership, operation permission, ownership |
| Events | Emission, payload shape, idempotent consumption, failure isolation |
| Errors | Error category, code, message safety, correlation ID |
| Concurrency | Duplicate submissions, duplicate votes, simultaneous invitation acceptance, lost updates |

The Core has its own tests: registry validation, duplicate identifiers, missing dependencies, cycle detection, deterministic initialization order, contract registration conflicts, startup and shutdown order, and event dispatch isolation.

## Architecture tests

`tests/architecture` automates the rules that code review cannot reliably enforce.

Required checks:

- No private cross-capability imports.
- No circular dependencies in the capability graph or the module graph.
- No database access outside the owning capability or infrastructure.
- No server-only modules in browser bundles.
- No secrets or private environment variables in client code.
- No duplicate contract registrations.
- No unregistered capability dependency.
- No unexpected runtime-specific import, including `Bun.*` APIs in application logic.
- No application-to-application import.
- No deep import into another package's internals.
- No forbidden primitive, router, form, table, or state library.
- No uppercase text transform in shared styles.
- No font family other than Noto Sans Mono.
- No palette values outside the approved tokens.
- No `any`, `@ts-ignore`, or non-null assertion in application source, where static scanning can detect them.
- No Next.js server features in the workspace and no workspace code in the public site server.
- Capability folder shape conforms to `domain`, `application`, `infrastructure`, `http`, `tests`, and `index.ts`.

An architecture test fails the build. A violation cannot be waived by a comment in the test; it requires an accepted ADR.

## Dual-runtime matrix

Every significant server change passes both runtimes with the same source and the same lockfile.

| Area                    | Node.js   | Bun       |
| ----------------------- | --------- | --------- |
| Public Next.js site     | Required  | Required  |
| Workspace development   | Required  | Required  |
| Workspace static output | Supported | Supported |
| Fastify API             | Required  | Required  |
| Database operations     | Required  | Required  |
| Background workers      | Required  | Required  |
| Database migrations     | Required  | Required  |
| Authentication          | Required  | Required  |
| File processing         | Required  | Required  |

Both environments:

1. Install with Bun using the frozen lockfile.
2. Build the applications.
3. Start the public server.
4. Start Fastify.
5. Run integration tests.
6. Run end-to-end workflows.

The acceptance criterion is identical functional behavior, not identical internal implementation or benchmark numbers. If a dependency fails under either runtime, replace it or fix compatibility before release. Do not declare one runtime experimental.

## Mandatory end-to-end journey

The complete journey is tested:

1. Sign in through Basis Auth.
2. Complete onboarding.
3. Select an organization.
4. Register for a competition.
5. Create a team.
6. Invite a participant.
7. Create a project.
8. Upload files.
9. Submit the project.
10. Assign judges.
11. Evaluate projects.
12. Vote where applicable.
13. Publish results.
14. Log out.
15. Verify session invalidation.

The journey covers a real application session, an organization-aware API request, a real database write, a Nethack UI form, validation, authorization, and mobile behavior.

## Negative paths

Every important negative path is tested. Passing only the happy path is not acceptance.

| Area | Required negative cases |
| --- | --- |
| Authentication | Missing, expired, malformed, revoked, wrong-audience token; failed state; invalid nonce; reused authorization code |
| Sessions | Fixation, session invalidation, refresh rotation, refresh-token reuse, backchannel logout, disabled account |
| Authorization | Missing permission, wrong role, resource in another organization, guessed identifier, archived resource |
| Validation | Missing field, wrong type, oversized payload, unexpected field, invalid date or time zone |
| CSRF and origin | Missing or wrong CSRF token, wrong Origin, state-changing GET, wrong content type |
| XSS | Stored, reflected, and DOM payloads in names, descriptions, announcements, and rich text |
| SQL injection | Payloads in identifiers, filters, sort fields, and search terms |
| SSRF | Loopback, private address, redirect to private address, oversized response, slow response |
| Files | Wrong signature, wrong MIME type, oversize file, executable content, malicious SVG, archive traversal, decompression bomb |
| Submissions | Deadline passed, duplicate submission, invalid revision, unauthorized edit, concurrent update |
| Voting | Duplicate vote, ineligible voter, closed round, replayed ballot, concurrent vote |
| Judging | Unassigned judge, conflict of interest, score outside rubric, edited evaluation after lock |
| Administration | Organization-scoped admin acting on another organization, global privilege without grant, unaudited action |
| Pagination and filtering | Invalid cursor, oversized limit, unsupported sort, conflicting filters |
| Rate limiting | Login, invitation, upload, vote, and search bursts |

Security tests also cover stored, reflected, and DOM XSS; SQL injection; IDOR; cross-organization access; CSRF; SSRF; open redirects; session fixation; refresh-token reuse; backchannel logout; malicious uploads; duplicate voting; duplicate submissions; concurrent updates; and unauthorized administrative actions.

## Visual testing

Important components and pages are captured in:

- Desktop, tablet, and mobile viewports.
- Dark theme.
- Light theme.
- Loading states.
- Error states.
- Empty states.

Screenshots are compared after meaningful UI changes. A visual regression is not approved because the build compiles. Baselines contain real data or clearly labeled fixtures, never invented production metrics.

The component laboratory at `apps/workspace/src/pages/lab` supplies stable fixtures for component-level screenshots.

## Accessibility testing

Every page-level browser test runs axe-core. Manual checks cover:

- Keyboard navigation and focus order.
- Focus management for dialogs, menus, and route changes.
- Screen-reader labels and announcements.
- Semantic HTML and landmarks.
- Contrast in both themes.
- Form error association and summary behavior.
- Dialog behavior and return focus.
- Touch interaction and target size.
- Reduced motion.
- Zoom to 200 percent and responsive behavior.

An axe pass does not replace keyboard and screen-reader testing for new interaction patterns.

## Load testing

k6 covers:

- Public page requests under cache hit and cache miss conditions.
- Authentication callback and session validation.
- Ordinary API reads and writes.
- Submission and voting bursts within rate limits.
- Database pool saturation.
- Background worker queue growth and recovery.

Load tests run against a production-like environment with realistic data volumes. Results record throughput, error rate, p95 and p99 latency, and resource usage. A load test that only proves a development laptop can handle synthetic traffic is not evidence.

## Running tests

Root scripts from `package.json`:

| Command                     | Purpose                                                          |
| --------------------------- | ---------------------------------------------------------------- |
| `bun run test`              | All Vitest suites: unit, integration, architecture, and security |
| `bun run test:architecture` | Architecture boundary and convention checks                      |
| `bun run test:integration`  | API and persistence integration suites                           |
| `bun run test:security`     | Security negative-path suite                                     |
| `bun run test:e2e`          | Playwright end-to-end journeys                                   |
| `bun run test:visual`       | Playwright visual regression suite                               |
| `bun run test:load`         | k6 load scenarios                                                |
| `bun run verify:runtime`    | Node.js and Bun runtime verification                             |
| `bun run check`             | Format check, lint, typecheck, and Vitest                        |
| `bun run test:watch`        | Vitest watch mode during development                             |

Rules:

- `bun run check` must pass before merge.
- Runtime verification is required for changes that affect the API, authentication, database, workers, file processing, or Next.js server behavior.
- Visual and end-to-end suites run before release and for UI changes that affect shared components or critical pages.
- Tests must be deterministic. No arbitrary sleeps, no dependence on execution order, no shared mutable state between tests.
- Tests clean up their data through transactions, isolated schemas, or explicit teardown.
- A flaky test is fixed or removed with a reason; it is not skipped indefinitely.
- Do not disable a failing test to make a build pass.
