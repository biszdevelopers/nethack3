# Security requirements

Status: security specification. These are required controls and verification
obligations. Their presence in this document does not mean they are implemented
or verified. A control is verified only when the named test or review has been
executed and its evidence is recorded.

## 1. Standard and verification model

### 1.1 Baseline

nethack must use OWASP Application Security Verification Standard 5.0.0 as its
baseline. The target is:

- Level 2 across the application.
- Level 3 for identity, organization isolation, file handling, and privileged
  administration.

ASVS is a verification standard, not a checklist to be copied into code. Each
applicable requirement must be assessed against the actual implementation,
recorded with a result, and supported by evidence. Requirements that do not
apply must be marked not applicable with a reason.

### 1.2 ASVS chapter coverage

| ASVS 5.0 chapter | Baseline | Additional nethack scope |
| --- | --- | --- |
| V1 Encoding and Sanitization | Level 2 | Level 3 review for rich text and file names |
| V2 Validation and Business Logic | Level 2 | Competition state, deadlines, duplicate votes, duplicate submissions |
| V3 Web Frontend Security | Level 2 | Public site and workspace CSP, DOM sinks, postMessage, third-party scripts |
| V4 API and Web Service | Level 2 | Fastify routes, BOLA, mass assignment, content types, rate limits |
| V5 File Handling | Level 2 | Level 3 for upload, quarantine, inspection, archive, download, asset origin |
| V6 Authentication | Level 2 | Level 3 for Basis Auth, account linking, recovery, disabled accounts |
| V7 Session Management | Level 2 | Level 3 for cookie attributes, fixation, rotation, revocation, CSRF |
| V8 Authorization | Level 2 | Level 3 for organization isolation, object-level checks, privileged administration |
| V9 Self-contained Tokens | Level 2 | Level 3 for access-token validation, `typ`, audience, JTI denylist |
| V10 OAuth and OpenID Connect | Level 2 | Level 3 for authorization code, PKCE, nonce, ID token, refresh rotation, backchannel |
| V11 Cryptography | Level 2 | Level 3 for token encryption, key versioning, key rotation |
| V12 Secure Communication | Level 2 | TLS, HSTS, secure internal calls |
| V13 Configuration | Level 2 | Level 3 for production secrets, debug settings, administrative exposure |
| V14 Data Protection | Level 2 | Level 3 for tenant data, tokens, files, backups, logs |
| V15 Secure Coding and Architecture | Level 2 | Capability boundaries, dependency rules, no hidden authority |
| V16 Security Logging and Error Handling | Level 2 | Level 3 for privileged administration and security events |
| V17 WebRTC | Out of scope | nethack does not provide WebRTC functionality |

The exact ASVS requirement identifiers, level, result, evidence, tester, and
date must be recorded in the security verification worksheet for each release.
A chapter-level statement is not a substitute for requirement-level evidence.

### 1.3 Level 3 scope

The following areas must be verified at Level 3, in addition to the Level 2
baseline:

| Level 3 area | Controls in this document | Required evidence |
| --- | --- | --- |
| Identity | SEC-AUTH-01 through SEC-AUTH-13; SEC-ADMIN-02 | Provider-double integration tests, live issuer checklist, OIDC conformance review, independent assessment |
| Organization isolation | SEC-AUTHZ-01 through SEC-AUTHZ-11 | Cross-organization security tests, RLS integration and pool-isolation tests, composite-constraint tests |
| File handling | SEC-FILE-01 through SEC-FILE-10 | Malicious-file fixtures, inspection-worker isolation tests, download-header tests, independent file-handling review |
| Privileged administration | SEC-ADMIN-01 through SEC-ADMIN-04; SEC-LOG-01 through SEC-LOG-04 | Authorization matrix tests, audit-event tests, break-glass exercises, periodic access review |

A control that appears in more than one area must be verified once per area
where the evidence required by each area differs. Level 3 is not satisfied by a
code inspection alone.

Controls in section 2 are Level 2 unless they fall within one of the Level 3
areas above. The Level 3 designation adds verification depth and evidence
requirements; it does not replace the Level 2 baseline.

### 1.4 Verification suites

| Suite | Responsibility | Typical evidence |
| --- | --- | --- |
| `tests/security` | Adversarial and negative tests against running code and helpers | XSS fixtures, SQL injection attempts, BOLA/IDOR, CSRF, SSRF, open redirect, session fixation, refresh reuse, malicious files, rate limits |
| `tests/architecture` | Static and structural checks over source, configuration, and dependency graph | Forbidden sinks, raw SQL, secret exposure, client role trust, unscoped repositories, runtime boundaries, RLS configuration, dependency policy |
| `tests/integration` | Fastify injection and real PostgreSQL, worker, and provider-double tests | Auth flow, ID token validation, session storage, refresh concurrency, RLS, backchannel, file pipeline, headers, response schemas |
| `tests/e2e` | Playwright browser flows across real origins | Login, logout, cookie attributes, CSRF in a browser, stored XSS rendering, cross-organization navigation, file upload/download, administrative flows |
| `tests/visual` | Visual regression and state coverage | Must not be used as security evidence except for visible security states such as error and empty states |

Controls that are verified by CI or an operational review rather than one of the
four application suites name that evidence explicitly. The four application
suites remain mandatory for application behavior. A CI result or review does not
replace a missing application test for a control that is exercised at runtime.

Tests must run under both supported runtimes where the code under test is
runtime-neutral. Authentication, database, worker, and API tests must run under
Node.js and Bun as required by `FULL_PLAN.md` section 5.

## 2. Control requirements

Each control below is mandatory. The verification column names the suite that
must contain the check; the exact test case names are recorded with the
evidence.

### 2.1 Identity and session

| ID | Requirement | Control | Verification |
| --- | --- | --- | --- |
| SEC-AUTH-01 | Discovery and keys are trustworthy and bounded | HTTPS discovery; issuer from configuration; JWKS cached about five minutes; unknown `kid` triggers a bounded refresh; stale keys rejected; timeouts and size limits | `tests/integration` provider-double discovery and JWKS rotation; `tests/security` malformed discovery and key confusion |
| SEC-AUTH-02 | Login uses authorization code with PKCE | Independent random state, nonce, and verifier; S256 only; server-side transaction with ten-minute expiry; state hash stored; verifier encrypted; transaction bound to the browser; one-time consumption | `tests/integration` login transaction lifecycle; `tests/security` state mismatch, expired transaction, verifier mismatch |
| SEC-AUTH-03 | Code exchange is confidential and single-use | Server-to-server exchange within sixty seconds; HTTP Basic for the confidential client; no body secret; exact redirect URI if sent; reused code fails with `invalid_grant` | `tests/integration` code exchange; `tests/security` code reuse, wrong verifier, wrong client authentication |
| SEC-AUTH-04 | ID token validation covers all required checks | RS256 only; exact issuer; audience equals client ID; expiry and not-before with bounded clock skew; nonce equality; `at_hash`; `sub` present; no `none` or HMAC algorithms | `tests/integration` ID token matrix; `tests/security` forged issuer, wrong audience, expired token, wrong nonce, algorithm confusion |
| SEC-AUTH-05 | Session cookie is hardened | `__Host-nethack_session`; Secure; HttpOnly; SameSite=Lax; Path=/; no Domain; opaque high-entropy value; not in URLs or logs; new session on login | `tests/e2e` browser cookie attributes; `tests/security` fixation and cookie injection attempts; `tests/architecture` cookie construction |
| SEC-AUTH-06 | Session storage is hash-only | Only a hash of the session identifier is stored; CSRF token hash stored; tokens encrypted; no plaintext session or token in the database | `tests/integration` database inspection; `tests/architecture` schema and query checks |
| SEC-AUTH-07 | Token encryption is authenticated and versioned | AES-256-GCM; unique 96-bit IV per encryption; 128-bit tag; AAD binds session and token kind; key version stored; old versions decrypt during rotation; no keys in the database or logs | `tests/integration` encryption and key rotation; `tests/security` tampered ciphertext; `tests/architecture` key handling |
| SEC-AUTH-08 | Refresh rotation is serialized | Per-session database row lock; read, exchange, persist, and expiry update in one critical section; waiting requests use the new token; reuse revokes the session family; `invalid_grant` clears refresh state and requires sign-in | `tests/integration` concurrent refresh; `tests/security` refresh reuse; `tests/architecture` no lock-free refresh path |
| SEC-AUTH-09 | Logout, revocation, and backchannel cover all required behaviors | Local logout; provider logout; refresh revocation; backchannel logout; backchannel access-token revocation; session invalidation; disabled-account handling; idempotent callbacks; `tokens_valid_after` enforcement; JTI denylist | `tests/integration` logout and backchannel; `tests/security` forged and replayed events; `tests/e2e` logout and invalidation |
| SEC-AUTH-10 | Invalid tokens use the standard response | Missing, expired, malformed, revoked, wrong-issuer, wrong-audience, and wrong-`typ` access tokens return `401` with `WWW-Authenticate: Bearer error="invalid_token"` and `{"error":"invalid_token","error_description":"Invalid access token"}`; missing scope or permission returns `403` | `tests/integration` token rejection matrix; `tests/security` response consistency |
| SEC-AUTH-11 | Account linking uses the durable identity | Link only by `(issuer, subject)`; email is profile data; no silent email link; explicit authenticated linking; collision and disabled-account handling; audit | `tests/integration` account linking; `tests/security` email collision and takeover attempts |
| SEC-AUTH-12 | Authentication abuse is bounded | Rate limits for login initiation, callback, token exchange, refresh, and logout; bounded request size and timeouts; no secrets in diagnostics; user-facing recovery guidance | `tests/security` auth abuse; `tests/e2e` error recovery; load test in operations |
| SEC-AUTH-13 | Browser never receives provider tokens or secrets | Client secret, access token, refresh token, verifier, and encryption keys stay server-side; no token in local storage, session storage, URLs, HTML, source maps, or logs | `tests/architecture` browser bundle and source scan; `tests/e2e` network and storage inspection |

### 2.2 Authorization and tenant isolation

| ID | Requirement | Control | Verification |
| --- | --- | --- | --- |
| SEC-AUTHZ-01 | Every protected request runs the six-step check | Identity, organization context, resource organization, active membership, operation permission, and competition eligibility, assignment, or ownership are checked server-side in that order; see `docs/security/authorization.md` | `tests/security` authorization matrix; `tests/integration` route-level checks; `tests/architecture` route handler pattern |
| SEC-AUTHZ-02 | Roles follow the documented matrix | Owner, organizer, judge, participant, and global administrator permissions match the matrix; deny by default; no implicit inheritance; separation of duties | `tests/security` role matrix; `tests/integration` role changes; `tests/e2e` visible action coverage |
| SEC-AUTHZ-03 | Frontend is never trusted | Client-provided role, permission, organization, user, owner, status, or price is untrusted; server re-derives from the session and database; hiding a control is not authorization | `tests/architecture` client trust scan; `tests/security` parameter tampering |
| SEC-AUTHZ-04 | Object IDs are not capabilities | Every resource lookup is constrained by organization and relationship; cross-organization access returns not found where appropriate; no unscoped `getById` on tenant tables | `tests/security` BOLA and IDOR; `tests/architecture` repository signatures |
| SEC-AUTHZ-05 | Global administration is separate and audited | Global administrator is a separate grant; rare; reviewed; cannot judge or vote without a separate role and assignment; break-glass actions are time-bounded and audited | `tests/integration` global admin; `tests/e2e` admin flows; audit review |
| SEC-AUTHZ-06 | RLS is enabled and enforced | Non-owner application role; no `BYPASSRLS`; `FORCE ROW LEVEL SECURITY`; transaction-local `nethack.organization_id`; fail-closed context function; explicit policies for select, insert, update, and delete | `tests/integration` RLS; `tests/architecture` catalog and migration checks |
| SEC-AUTHZ-07 | Pooled connections do not leak tenant context | Transaction-local settings only; context reset at commit or rollback; checkout assertion; concurrent interleaving test on one pool | `tests/integration` pool isolation and concurrency |
| SEC-AUTHZ-08 | Composite constraints prevent cross-organization parents | Tenant tables have non-null organization ID; composite unique `(id, organization_id)`; child foreign keys include organization ID; unique constraints include organization ID | `tests/integration` constraint attempts; `tests/architecture` schema checks |
| SEC-AUTHZ-09 | Mutations recheck authorization transactionally | Authorization for state changes is re-evaluated inside the transaction; row locks or constraints prevent time-of-check to time-of-use races; state machines enforce allowed transitions | `tests/integration` concurrency and state transitions; `tests/security` forged state |
| SEC-AUTHZ-10 | Caches do not cross tenants | Authenticated responses use `private, no-store`; no shared private cache; organization-scoped cache keys; purge on membership or role change | `tests/architecture` cache usage; `tests/integration` cache headers; `tests/e2e` organization switch |
| SEC-AUTHZ-11 | Jobs, events, exports, and logs preserve organization scope | Outbox and job records carry organization ID; workers set the tenant context; exports and reports filter by organization; audit queries are scoped | `tests/integration` worker and export isolation; `tests/architecture` job enqueue patterns |
| SEC-AUTHZ-12 | Administrative actions are protected | Administrative routes require identity, organization context where applicable, explicit administrative permission, rate limits, and audit; no route is protected only by a hidden UI link | `tests/integration` admin authorization; `tests/security` unauthorized admin; `tests/e2e` admin navigation |

### 2.3 Browser, frontend, and API

| ID | Requirement | Control | Verification |
| --- | --- | --- | --- |
| SEC-WEB-01 | Dangerous DOM sinks are prohibited | No `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`, or dynamic script construction without a reviewed exception and sanitizer | `tests/architecture` sink scan; code review |
| SEC-WEB-02 | Rich text is sanitized | Markdown raw HTML disabled by default; allowlist sanitizer for supported HTML; removal of scripts, event handlers, dangerous URLs, embedded objects, and style-based vectors | `tests/security` stored, reflected, and DOM XSS fixtures; `tests/e2e` rendered content |
| SEC-WEB-03 | CSP is strict and enforced | Separate public and workspace policies; restrictive `default-src` and `script-src`; nonces or hashes; no `unsafe-eval`; `object-src 'none'`; `base-uri 'self'`; `frame-ancestors 'none'`; restrictive `connect-src` and `form-action`; HTTPS in production | `tests/integration` header tests; `tests/e2e` CSP violation checks; report-only to enforce transition recorded |
| SEC-WEB-04 | URL schemes are validated | Links and images permit only approved schemes; `javascript:`, `vbscript:`, unsafe `data:`, and obfuscated schemes are rejected; redirects are not driven by user input | `tests/security` URL scheme fixtures; `tests/e2e` navigation |
| SEC-WEB-05 | CSRF defenses are layered | SameSite=Lax; synchronizer token bound to session; `X-CSRF-Token` required for mutations; exact Origin; Referer as secondary; JSON content type; no state-changing GET; re-authentication for sensitive actions | `tests/security` CSRF; `tests/e2e` cross-origin form posts; `tests/integration` Origin handling |
| SEC-WEB-06 | Clickjacking is prevented | `frame-ancestors 'none'`; `X-Frame-Options: DENY` as defense in depth; no framing of authenticated pages | `tests/integration` headers; `tests/e2e` frame attempt |
| SEC-WEB-07 | Open redirects are prevented | `returnTo` is a relative path only; absolute redirects use an explicit allowlist; reject scheme-relative, backslash, control-character, and encoded variants; provider redirect URI exact | `tests/security` open redirect; `tests/integration` login return handling |
| SEC-WEB-08 | CORS is explicit | Only the workspace origin may send credentialed requests; exact origin allowlist; no wildcard with credentials; preflight methods and headers are minimal; public API CORS is separate | `tests/integration` CORS matrix; `tests/architecture` configuration |
| SEC-WEB-09 | Security headers are consistent | HSTS in production; `X-Content-Type-Options: nosniff`; `Referrer-Policy`; `Permissions-Policy`; no server or framework version disclosure; cache headers as specified | `tests/integration` header tests; deployment configuration review |
| SEC-API-01 | SQL is parameterized | Drizzle query builders or parameterized raw SQL; no concatenation; allowlisted sort, filter, aggregate, and table names; least-privilege runtime role | `tests/security` SQL injection; `tests/architecture` raw SQL scan |
| SEC-API-02 | Inputs and outputs are validated | Zod validates body, query, params, external identity responses, file metadata, configuration, and responses; strict objects reject unknown fields; response schemas prevent field disclosure | `tests/integration` contract tests; `tests/architecture` schema coverage |
| SEC-API-03 | Errors do not leak internals | Consistent error categories; no stack traces, SQL, paths, tokens, or secrets; correlation ID returned; diagnostic detail logged privately | `tests/integration` error responses; `tests/security` malformed input |
| SEC-API-04 | SSRF is prevented | No arbitrary fetch; destination allowlist; loopback, private, link-local, metadata, and multicast addresses rejected; resolved IP validated; redirects revalidated and bounded; response size and time limits; restricted egress | `tests/security` SSRF matrix; `tests/architecture` fetch usage |
| SEC-API-05 | Resource use is bounded | Body, JSON depth, array length, upload, page size, query complexity, timeout, and concurrency limits; cursor pagination; bounded result sets | `tests/security` oversized input and rate limits; load tests; `tests/integration` limits |
| SEC-API-06 | Critical operations are idempotent and concurrency-safe | Idempotency keys for critical mutations; database transactions; unique constraints; row locks; duplicate votes and submissions rejected | `tests/integration` concurrency and idempotency; `tests/security` duplicate requests |
| SEC-API-07 | Authenticated responses are not cached | `Cache-Control: private, no-store`; no personalized data in shared caches; Next.js Cache Components disabled initially; public content caching is deliberate and scoped | `tests/integration` header tests; `tests/e2e` tenant switch; cache configuration review |
| SEC-API-08 | Sensitive data is not logged | Tokens, codes, secrets, verifiers, cookies, passwords, and file contents are never logged; IP addresses are hashed where stored; structured logs include correlation IDs | `tests/architecture` logging scan; `tests/integration` log capture |

### 2.4 File handling

| ID | Requirement | Control | Verification |
| --- | --- | --- | --- |
| SEC-FILE-01 | Files follow the quarantine pipeline | Authorized upload to quarantine; inspection; approval; authorized download; statuses `quarantined`, `scanning`, `approved`, `rejected`, `deleted`; no download before approval | `tests/integration` lifecycle; `tests/e2e` upload and download; `tests/security` status bypass |
| SEC-FILE-02 | Types are allowlisted and magic-checked | Explicit allowed MIME and extension list; magic bytes and container structure validated; declared type and filename not trusted; mismatch rejected | `tests/security` type confusion and polyglot fixtures |
| SEC-FILE-03 | Size is bounded | 25 MiB per file and per upload request; enforced before and during streaming; chunked uploads counted; oversized requests rejected with `413` | `tests/security` oversized upload; `tests/integration` body limit |
| SEC-FILE-04 | Storage names are generated | No user-controlled path components; organization and file IDs only; original filename stored as metadata; download header filename sanitized and encoded | `tests/security` path traversal and Unicode filename; `tests/integration` storage key |
| SEC-FILE-05 | Archives are inspected safely | ZIP only; entry, total size, per-entry size, compression ratio, path length, and nesting limits; absolute paths, `..`, backslashes, symlinks, hardlinks, encryption, and nested archives rejected; no extraction in the API | `tests/security` archive traversal and bomb fixtures; `tests/integration` inspector limits |
| SEC-FILE-06 | Active and executable content is rejected | SVG, HTML, scripts, executables, encrypted archives, and PDF JavaScript, launch actions, embedded files, and encryption rejected or stripped; images decoded and re-encoded; metadata stripped | `tests/security` SVG, HTML, executable, and active PDF fixtures |
| SEC-FILE-07 | Inspection is isolated | Separate worker process; non-root; read-only filesystem; CPU, memory, time, and process limits; no inbound network; no outbound network; no shell; no execution of uploaded bytes | `tests/architecture` worker isolation; `tests/integration` resource limits; deployment review |
| SEC-FILE-08 | Downloads are safe | Separate cookieless asset origin; short-lived signed access or authorized streaming; server-derived `Content-Type`; `nosniff`; sandboxing CSP; `Content-Disposition: attachment` except approved safe images; no cookies on asset origin | `tests/integration` download headers; `tests/e2e` asset request; `tests/security` header bypass |
| SEC-FILE-09 | File authorization is object-level | Upload and download permissions are checked against the organization and owning resource; cross-organization file access denied; signed URL expiry and scope enforced | `tests/security` file BOLA; `tests/integration` signed access |
| SEC-FILE-10 | Storage is bounded and cleaned | Per-user and per-organization quotas; upload rate limits; quarantine and rejected-file lifecycle deletion; orphan cleanup; storage alerts | `tests/integration` cleanup jobs; operations review |

### 2.5 Administration, logging, and monitoring

| ID | Requirement | Control | Verification |
| --- | --- | --- | --- |
| SEC-ADMIN-01 | Administrative power is scoped | Organization owner powers are limited to that organization; organizer powers are competition-scoped; no cross-organization administration by default | `tests/security` admin matrix; `tests/integration` organization scope |
| SEC-ADMIN-02 | Global administration is rare and reviewable | Separate grant table; reason; grantor; timestamp; periodic review; no shared accounts; no implicit judging or voting authority | `tests/integration` grant lifecycle; audit review |
| SEC-ADMIN-03 | Break-glass access is controlled | Time-bounded; explicit reason; strong authentication; audit; notification; post-use review; cannot be used to submit evaluations or votes | `tests/integration` break-glass; audit review |
| SEC-ADMIN-04 | Security events are audited | Login success and failure, logout, revocation, role change, membership change, file approval and rejection, administrative action, export, and configuration change recorded with actor, organization, action, target, timestamp, and correlation ID | `tests/integration` audit events; `tests/e2e` critical flows |
| SEC-LOG-01 | Audit records are append-only | Runtime role cannot update or delete audit rows; retention policy; restricted read access; export for investigation | `tests/architecture` privileges; `tests/integration` mutation attempt |
| SEC-LOG-02 | Logs are redacted | No tokens, codes, secrets, verifiers, cookies, passwords, file bytes, or full personal data; IP hashed where stored | `tests/architecture` logging scan; `tests/integration` capture |
| SEC-LOG-03 | Detection exists for high-risk events | Alerts for authentication failure spikes, refresh reuse, backchannel failures, cross-organization authorization failures, file scanner hits, mass downloads, administrative changes, and dependency advisories | Operations review; incident-response exercise |
| SEC-LOG-04 | Log integrity and retention are defined | Central collection; clock synchronization; access control; retention consistent with policy; integrity protection; no secret data in third-party analytics | Operations review; configuration inspection |

### 2.6 Supply chain and release

| ID | Requirement | Control | Verification |
| --- | --- | --- | --- |
| SEC-SC-01 | Dependencies are pinned and locked | Exact production versions; committed `bun.lock`; frozen installs in CI; no floating `latest` in production; no second package manager | `tests/architecture` dependency policy; CI check |
| SEC-SC-02 | An SBOM exists for every release | CycloneDX JSON or SPDX document covering direct and transitive application dependencies and container operating-system packages | CI artifact check; release review |
| SEC-SC-03 | Dependencies and artifacts are scanned | Dependency, container, secret, static-analysis, and configuration scans run in CI; results are retained | CI security jobs; release review |
| SEC-SC-04 | Critical and high findings block release | No known exploitable critical or high-severity vulnerability ships; see section 4 | Release gate; security sign-off |
| SEC-SC-05 | Secrets are scanned and managed | Secret scanning in source and CI; secrets only in the deployment secret store; no secrets in repository, images, logs, or browser bundles; rotation procedure exists | `tests/architecture` secret scan; CI; incident-response review |
| SEC-SC-06 | New dependencies are reviewed | Justification; maintenance status; license; transitive impact; lifecycle scripts; native code; known advisories; removal of unused packages | Dependency review record |
| SEC-SC-07 | Next.js is contained and patched | Latest patched stable release; advisories monitored; SVG image optimization disabled for untrusted content; unnecessary image-processing surface removed; no database credentials, identity secret, private cookie, or administrative credential in the public runtime; no authentication in middleware; security regressions tested after upgrades | `tests/architecture` runtime boundary; configuration review; header tests; upgrade checklist |
| SEC-SC-08 | Release artifacts are identifiable | Build digest recorded; artifact and SBOM retained; deployment references the reviewed artifact; provenance or signing is recommended and required where the deployment platform supports it | Release record |
| SEC-SC-09 | Runtime privilege is minimal | Non-root containers; read-only filesystem where practical; restricted network; CPU and memory limits; separate credentials; no public internal ports; graceful shutdown; health checks | Deployment review; runtime verification |
| SEC-SC-10 | Runtime isolation is enforced | Public Next.js has no database credentials, Basis Auth client secret, private session cookie, administrative API credentials, or workspace build credentials; it does not use Server Actions for application mutations, middleware as an authorization boundary, or database access; the static workspace has no server-side secrets, database access, private access tokens in JavaScript, or authority beyond the session; Fastify remains the only authoritative backend | `tests/architecture` runtime boundary; environment audit; `tests/e2e` browser storage and network inspection |

### 2.7 Operations and assurance

| ID | Requirement | Control | Verification |
| --- | --- | --- | --- |
| SEC-OPS-01 | Database roles are separated | Runtime role is not owner, not superuser, no `BYPASSRLS`, no DDL; migration role is separate and not used at runtime | `tests/architecture` catalog check; deployment review |
| SEC-OPS-02 | Transport is protected | TLS for all public and internal HTTP; HSTS in production; certificate monitoring; no insecure callback URLs except localhost development | Configuration review; header tests |
| SEC-OPS-03 | Backups are protected and restorable | Encrypted backup storage; retention; access control; restoration tests; no secrets in backup metadata | Operations test; restoration record |
| SEC-OPS-04 | Incident response is exercised | Documented severity, containment, credential rotation, evidence, disclosure, and review; at least one tabletop or exercise per release cycle | `docs/security/incident-response.md`; exercise record |
| SEC-OPS-05 | Independent assessment occurs before launch | External penetration test and focused review of authentication, authorization, tenant isolation, and file handling; findings remediated or risk-accepted with evidence | Assessment report; remediation record |
| SEC-OPS-06 | OIDC conformance is tested | OpenID Foundation conformance or an equivalent documented test for authorization code, PKCE, ID token, refresh, logout, and backchannel behavior | Conformance report; `docs/security/authentication.md` release gate |

## 3. Test-suite obligations

### 3.1 tests/security

The suite must contain, at minimum:

- Stored, reflected, and DOM XSS fixtures for profiles, project text,
  announcements, filenames, and rich text.
- SQL injection attempts against every filter, sort, search, and identifier
  parameter.
- BOLA and IDOR attempts for every resource type, including nested resources
  and files.
- Cross-organization access attempts using valid sessions from another
  organization.
- CSRF attempts with missing, wrong, replayed, and cross-session tokens.
- SSRF attempts against loopback, private, link-local, metadata, redirect, and
  DNS-rebinding style destinations.
- Open redirect attempts through login return paths and provider redirect
  parameters.
- Session fixation and cookie injection attempts.
- Refresh-token reuse and concurrent refresh attempts.
- Backchannel forgery, replay, wrong-audience, wrong-issuer, wrong-`typ`, and
  expired-token attempts.
- Malicious upload fixtures: path traversal names, archive bombs, encrypted
  archives, symlinks, SVG, HTML, executables, polyglots, MIME mismatches,
  oversized files, and active PDF content.
- Duplicate voting and duplicate submission attempts.
- Unauthorized administrative actions and role escalation attempts.

### 3.2 tests/architecture

The suite must contain, at minimum:

- No forbidden DOM sinks, `eval`, dynamic script construction, or unsafe HTML
  rendering.
- No string-concatenated SQL or unparameterized raw SQL.
- No unscoped tenant repository method or query.
- No client-provided role, permission, or organization claim used as
  authority.
- No server-only secret, private token, database client, or administrative
  credential in a browser bundle.
- No `BYPASSRLS`, session-level tenant setting, or runtime DDL credential.
- No wildcard credentialed CORS, insecure cookie, or missing security header
  configuration.
- No floating production dependency, second lockfile, or unreviewed lifecycle
  script.
- No secret in logs, source maps, fixtures, or repository files.
- No auth logic in public-site middleware.

### 3.3 tests/integration

The suite must contain, at minimum:

- Login transaction lifecycle, callback validation, code exchange, and ID token
  validation against a provider double.
- Session creation, storage inspection, expiry, revocation, and cookie
  attributes.
- Token encryption, key versioning, and rotation.
- Refresh concurrency with real database locks.
- Logout, backchannel proof, logout token, revocation token, denylist, and
  `tokens_valid_after`.
- Standard `401 invalid_token` and `403` responses.
- RLS with the runtime role: missing context, cross-organization select,
  insert, update, delete, and pool isolation.
- Composite foreign keys and organization-scoped unique constraints.
- Route-level authorization for every role and operation.
- Cache headers, CORS, CSP, and download headers.
- File pipeline transitions and inspection-worker limits.
- Error responses without internal detail.

### 3.4 tests/e2e

The suite must contain, at minimum:

- Sign in through Basis Auth, including cancellation and failure recovery.
- Cookie attributes and absence of tokens in browser storage, URLs, or HTML.
- Logout and session invalidation.
- Organization selection and cross-organization navigation attempts.
- Role-appropriate visible actions and server-side rejection of hidden actions.
- Stored XSS rendering attempts.
- File upload, quarantine, approval, authorized download, and rejected file
  behavior.
- Administrative flows and audit visibility.
- CSRF attempts from a cross-origin page.
- Asset-origin requests without cookies or credentials.

## 4. Release-blocking vulnerability rule

### 4.1 Severity

| Severity | Definition | Release effect |
| --- | --- | --- |
| Critical | CVSS 9.0-10.0, or active exploitation with severe impact: remote code execution, authentication bypass, mass data exposure, signing-key compromise | Blocks release without exception |
| High | CVSS 7.0-8.9, or a lower-scored issue with a demonstrated exploitation path to sensitive data, privilege escalation, or service compromise | Blocks release without exception |
| Medium | CVSS 4.0-6.9, limited impact or significant preconditions | Must have an owner, remediation date, and documented risk decision before release |
| Low | CVSS 0.1-3.9, informational, defense-in-depth improvement | May ship with a tracked remediation item |

A finding is evaluated on exploitability, not score alone. A high-severity
finding with no reachable path may be documented as non-exploitable only with
evidence and security-owner approval. A low-severity finding with an active
exploitation path is treated as high.

### 4.2 Blocking rule

A release must not ship when any of the following is true:

- A known exploitable critical or high-severity vulnerability exists in nethack
  code, a production dependency, a container base image, or production
  configuration.
- A critical or high-severity finding is suppressed, ignored, or excluded from
  a scanner without a recorded false-positive analysis.
- Authentication, authorization, tenant isolation, file handling, or
  administrative controls have an unresolved failure in the release security
  suite.
- The SBOM is missing, incomplete, or does not match the deployed artifact.
- Required secret scanning or dependency scanning did not run for the release
  candidate.
- A required rotation or revocation procedure cannot be executed during the
  release window.

### 4.3 Exceptions

There is no severity downgrade by convenience. A critical or high finding may
be released only when:

1. The finding is proven to be a false positive, with the scanner rule, version,
   and evidence recorded.
2. The affected code or feature is removed from the release.
3. A compensating control fully blocks the exploitation path and is tested, and
   the security owner records a time-bounded acceptance.

The acceptance must name the risk owner, the affected versions, the
compensating control, the detection method, the expiry date, and the
remediation plan.

### 4.4 Emergency patching

A critical or high advisory affecting production triggers the emergency
procedure in `docs/security/incident-response.md`. The patch is built from the
committed lockfile, scanned, tested, deployed through the normal release path,
and followed by a post-incident review. If the vendor has no patch, the
affected feature is disabled or isolated until a safe version is available.

## 5. SBOM, scanning, and release evidence

### 5.1 SBOM

Every release candidate must produce an SBOM that:

- Uses CycloneDX JSON (1.5 or later) or SPDX (2.3 or later).
- Includes direct and transitive application dependencies.
- Includes container base-image and operating-system packages for every
  deployed image.
- Records package names, versions, licenses, and dependency relationships.
- Is generated from the locked dependency graph and the built image, not from a
  hand-maintained list.
- Is stored immutably with the release artifact and referenced by digest.
- Is retained for at least as long as the release is supported and according to
  the incident-evidence retention policy.

### 5.2 Required scans

| Scan | Scope | Gate |
| --- | --- | --- |
| Dependency vulnerability | Direct and transitive production and development dependencies | Critical and high block; medium tracked |
| Container image | Base image and installed operating-system packages | Critical and high block |
| Secret scanning | Repository history, working tree, CI logs, build artifacts | Any verified secret blocks and triggers rotation |
| Static analysis | TypeScript, React, Fastify, SQL, and configuration | Critical and high block; security-relevant rules reviewed |
| Dynamic analysis | Running staging environment, authentication, authorization, files, headers | Critical and high block |
| Configuration and infrastructure | Deployment manifests, TLS, headers, database roles, network exposure | Critical and high block |
| License | Production dependencies | Copyleft or unknown license requires review |

### 5.3 Dependency policy

- Use exact versions in production.
- Commit `bun.lock` and install with `--frozen-lockfile` in CI.
- Remove unused packages.
- Review new packages for maintenance, popularity, ownership, transitive
  weight, lifecycle scripts, native code, and known advisories.
- Review transitive dependency changes in lockfile diffs.
- Monitor advisories continuously and subscribe to automated alerts.
- Keep an emergency upgrade procedure with a tested rollback.
- Never patch a dependency by editing files inside `node_modules` or by
  monkey-patching at runtime.

### 5.4 Release evidence

The release record must contain:

- The commit, lockfile hash, artifact digest, and SBOM digest.
- The results of every required scan.
- The executed security suite results, including the environment and runtime.
- The ASVS worksheet result and any not-applicable justification.
- Any accepted risk with owner, reason, compensating control, and expiry.
- The rollback plan and the previous deployable artifact.
- The names of the people who approved the release.

A release is not approved because the build passes. It is approved when the
required evidence exists and the blocking conditions are false.

## 6. Verification and reporting

- Every control in section 2 must have at least one executed check before it is
  marked verified.
- A test that only asserts a configuration value is not sufficient for a
  runtime control unless the configuration is the control.
- Security tests must fail when the control is removed. A test that passes
  against a deliberately broken implementation is not evidence.
- Findings must be recorded with severity, affected asset, reproduction,
  evidence, remediation, owner, and status.
- The requirement tracker is updated only after execution. File presence is not
  verification.
- Independent penetration testing and focused review of authentication,
  authorization, tenant isolation, and file handling are required before
  launch.
- The threat model, this document, and the test suites are reviewed together
  after every incident and at every release cycle.
