# Threat model

Status: security specification and review procedure. This document defines required properties. It does not assert that any control is implemented or verified. Verification evidence belongs in `docs/implementation/REQUIREMENT_TRACKER.md` and the release security review.

## 1. Purpose and scope

This threat model covers the nethack platform as specified in `FULL_PLAN.md`: the public Next.js site, the static React workspace, the Fastify API, the PostgreSQL database, uploaded files and the asset origin, the CI/CD and release path, and the Basis Auth and Microsoft Entra ID identity boundary.

It is a design document. It identifies what must be protected, from whom, across which boundaries, and which controls are required to reduce each risk. It also records the risks that remain after those controls.

Out of scope, except where they affect nethack:

- The internal security of Microsoft Entra ID and the Basis Auth service.
- The internal security of the hosting provider, object storage provider, and network provider.
- Compromise of a user's device or browser by malware outside nethack.
- Physical security of operator premises.
- Legal and regulatory obligations beyond the security logging and disclosure requirements referenced here.

## 2. Security objectives

The release objectives are:

- No known exploitable cross-site scripting.
- No known SQL injection.
- No broken object-level authorization.
- No cross-organization information leakage.
- No exposed tokens or secrets.
- No unprotected administrative action.
- No unsafe execution of uploaded content.
- No unnecessary runtime privilege.
- No unresolved critical or high-severity vulnerability with a known exploitation path.

These are objectives, not guarantees. A release is not secure merely because these controls are documented.

## 3. Assets

| Asset | Classification | Why it matters |
| --- | --- | --- |
| User profile data: display name, email, avatar, locale | Personal data | Identifies people and can be used for phishing or harassment |
| External identity links: `(issuer, subject)` | Identity data | Controls account access and durable account ownership |
| Sessions, CSRF tokens, access tokens, refresh tokens | Credentials | Permit impersonation, data access, and persistent account takeover |
| Organization records and settings | Confidential business data | Reveal customers, structure, and administrative configuration |
| Organization memberships and roles | Authorization data | Directly determine what a person can do |
| Competition series, editions, divisions, rules, schedules | Mixed public and confidential | Unpublished rules and schedules can affect fairness and confidentiality |
| Registrations, participant records, eligibility decisions | Personal and confidential | Contain identity, eligibility, and attendance information |
| Teams, invitations, team memberships | Confidential | Reveal relationships and allow unauthorized collaboration access |
| Projects, descriptions, repository links, project members | Confidential until published | Contain intellectual property and personal data |
| Submissions, submission versions, attachments | Highly confidential | Contain unpublished work, source code, documents, and personal data |
| Uploaded files and their metadata | Highly confidential | May contain malware, personal data, or intellectual property |
| Judging assignments, rubrics, evaluations, scores, feedback | Highly confidential | Compromise changes competition outcomes and exposes judges and participants |
| Voting rounds, ballots, votes, results | Confidential until publication | Integrity directly affects competition fairness |
| Announcements and notifications | Mixed | Can be used for phishing and reputational damage if altered |
| Audit logs | Security-critical | Provide accountability and incident evidence |
| Secrets: Basis Auth client secret, resource secret, encryption keys, database credentials, signing material | Critical | Permit broad impersonation or data access |
| Infrastructure, DNS, TLS certificates, deployment credentials | Critical | Permit outage, traffic interception, or release tampering |
| Public content integrity and platform availability | Reputational | Loss of trust, denial of service, and participant harm |

## 4. Actors

| Actor | Motivation | Capability |
| --- | --- | --- |
| Anonymous internet user | Curiosity, disruption, data theft, notoriety | Can reach public origins, send arbitrary requests, automate |
| Authenticated participant | Competitive advantage, access to others' work, retribution | Valid account, can modify requests, upload files, use multiple accounts |
| Team member | Team advantage, access to teammate or rival data | Valid session and team membership |
| Judge | Score manipulation, access to non-assigned work | Valid judge account and assignments |
| Organizer | Result manipulation, access to participant data | Valid organizer account and organization scope |
| Organization owner | Broad organization control, possible abuse | Valid owner account |
| Global administrator | Legitimate platform support or malicious insider | Platform-wide administrative authority |
| Compromised user account | Attacker using a legitimate session | Same authority as the victim until revoked |
| Malicious insider with infrastructure access | Data theft, sabotage, cover-up | Database, secret store, deployment, or log access |
| Compromised dependency or build tool | Supply-chain intrusion | Code execution in build or runtime |
| Compromised identity provider or Entra tenant | Mass impersonation | Forged assertions or tokens within provider trust |
| Automated bot or botnet | Credential stuffing, scraping, flooding | High-volume requests, distributed source addresses |
| Support or operations engineer | Legitimate maintenance or error | Elevated access through break-glass procedures |

## 5. Trust boundaries and origins

### 5.1 Three-origin boundary

The browser, the application API, and the identity provider are separate origins with separate cookies and separate trust rules.

```
+------------------------------+          +------------------------------+
| Browser                      |          | Identity origin              |
| workspace origin             |  HTTPS   | Basis Auth                   |
| app.nethack.example          |--------->| auth.example.org             |
|                              | redirect |                              |
| holds only the app session   |<---------| authorization response       |
| cookie; never holds tokens   |          |                              |
+--------------+---------------+          +--------------+---------------+
               |                                         ^
               | fetch with credentials                  | server-to-server
               | Origin: app.nethack.example             | code exchange and
               |                                         | token validation
               v                                         |
+------------------------------+                         |
| API origin                   |-------------------------+
| api.nethack.example          |
| Fastify, authorization, RLS  |
+--------------+---------------+
               |
               | private database connection
               v
      +------------------+
      | PostgreSQL       |
      | private network  |
      +------------------+

Adjacent origins, outside the three-origin core:

  www.nethack.example       public site, no session cookie, public data only
  assets.nethack.example    cookieless file origin, no session cookie
```

The boundary rules are:

- The workspace origin is untrusted input. It may render data and call the API, but it has no authority to decide identity, role, organization, or permission.
- The API origin is the authoritative security boundary. It accepts the session cookie only from the configured workspace origin, validates CSRF and Origin, and re-derives every authorization decision from the database.
- The identity origin is used only for OIDC redirects and server-to-server token exchange. The nethack API never reads, forwards, or shares the `basis_sso` cookie. The browser never receives the client secret, access token, refresh token, or encryption keys.
- The public site origin has no session cookie and no private API authority. It may use public API data and deliberately scoped caching only.
- The asset origin has no cookies, no CORS credentials, and no dynamic application behavior. It serves approved bytes only.
- PostgreSQL is reachable only from the API and worker network. Runtime credentials are not migration credentials and do not own the schema.
- CI/CD and the secret store are a separate administrative trust boundary. Compromise there is treated as a production compromise.

### 5.2 Other trust boundaries

| Boundary | Untrusted side | Trusted side | Required rule |
| --- | --- | --- | --- |
| Browser to workspace | Browser DOM, URL, storage | Workspace application | Treat all input as hostile; never trust client-side role or organization claims |
| Workspace to API | Browser requests | Fastify | Cookie session, CSRF token, exact Origin, content-type validation, rate limits |
| Public site to API | Public requests | Fastify public routes | No session authority; public response schemas; no user-specific caching |
| API to database | Application queries | PostgreSQL | Parameterized queries, least-privilege role, RLS, separate migration credentials |
| API to Basis Auth | API HTTP client | Basis Auth | TLS, exact issuer, secrets server-side, bounded timeouts |
| Basis Auth to Entra ID | External IdP | Basis Auth | Provider responsibility; nethack never sees Microsoft tokens |
| API to asset storage | API authorization result | Asset origin | Short-lived signed access or authorized streaming; cookieless origin |
| API to internal Basis API | API HTTP client | Private listener | Resource secret, `X-Basis-Resource`, loopback or private network |
| CI/CD to production | Build artifacts and secrets | Production | Pinned dependencies, SBOM, scans, signed or digest-recorded artifacts, least privilege |
| Operator to production | Administrative session | Runtime | Break-glass, audit, no shared accounts, time-bounded access |

## 6. Threat table

The categories use STRIDE: Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, and Elevation of privilege. A threat may fit more than one category; the primary category is shown.

| ID | Category | Threat | Primary mitigations | Residual risk |
| --- | --- | --- | --- | --- |
| TM-01 | Spoofing | Stolen or replayed session cookie | `__Host-nethack_session` with Secure, HttpOnly, SameSite=Lax, Path=/, no Domain; hash-only server storage; idle and absolute expiry; revocation; session regeneration; CSRF token; anomaly alerts | Malware on the user's device, stolen unlocked device, or a browser zero-day can still act as the user |
| TM-02 | Spoofing | Forged, replayed, or wrong-audience identity token | RS256 only; JWKS with bounded cache; exact issuer; audience equals client ID; expiry and nonce checks; `at_hash`; maintained OIDC library; access tokens require `typ=at+jwt`; no ID token accepted at the resource API | Compromise of Basis Auth signing keys or a library vulnerability can defeat validation |
| TM-03 | Spoofing | Account takeover through email-based account linking | Link only by `(issuer, subject)`; never silently link by email; explicit authenticated linking flow; collision handling; audit linking events | Social engineering or a compromised identity provider account can still take over a linked account |
| TM-04 | Tampering | Stored XSS through project text, profiles, announcements, comments, or filenames | React escaping; no `dangerouslySetInnerHTML`; allowlist sanitizer for rich text; Markdown raw HTML disabled; URL scheme validation; CSP with nonces; response schemas; security tests | A sanitizer bypass or browser zero-day can still execute script in the workspace origin |
| TM-05 | Tampering | Reflected or DOM XSS through URLs, search, fragments, or client-side rendering | No `innerHTML` or `eval`; safe URL parsing; no dynamic script construction; Trusted Types where supported; CSP; encoded output; tests for DOM sinks | Third-party script or a framework vulnerability can introduce a sink |
| TM-06 | Tampering | SQL injection through query parameters, sort fields, filters, or raw SQL | Drizzle parameterization; no string concatenation; parameterized raw SQL; allowlisted sort fields and filter operators; no user-controlled table names or fragments; least-privilege role; RLS as an additional layer | ORM misuse, a database extension vulnerability, or an unreviewed raw query can still inject |
| TM-07 | Information disclosure | IDOR or BOLA: a valid user accesses another user's or organization's object by changing an ID | Six-step request verification; object-level policy checks; organization-scoped repository methods; composite keys; 404 for cross-organization objects; authorization matrix tests | A new endpoint or a missed nested resource can omit a check |
| TM-08 | Information disclosure | Cross-organization leakage through APIs, database queries, exports, jobs, caches, logs, or files | Organization-scoped queries; PostgreSQL RLS; composite foreign keys; organization-prefixed storage and cache keys; worker context; scoped exports; cross-organization tests | Misconfiguration, SQL injection, or a shared-cache bug can bypass one layer |
| TM-09 | Tampering | CSRF on state-changing operations | SameSite=Lax; synchronizer token in session; `X-CSRF-Token`; exact Origin validation; Referer validation where applicable; no state-changing GET; JSON content-type enforcement; re-authentication for sensitive actions | A compromised same-site subdomain or browser bug can weaken SameSite and Origin assumptions |
| TM-10 | Information disclosure | SSRF through URL previews, webhooks, imports, or remote fetches | No arbitrary server-side URL fetching; destination allowlist; reject loopback, link-local, private, and metadata ranges; resolve and validate every address; revalidate after redirects; redirect and size limits; timeouts; restricted egress | DNS rebinding or compromise of an allowlisted host can still reach an unexpected service |
| TM-11 | Tampering | Open redirect through login return paths or provider redirect parameters | Relative-path-only `returnTo`; explicit allowlist for any absolute redirect; exact registered redirect URIs; no user-controlled provider redirect; reject scheme-relative and backslash forms | An allowlist mistake or a provider-side redirect flaw can still redirect users |
| TM-12 | Spoofing | Session fixation | Create a new session record and new cookie on successful login; never promote a pre-authentication session; rotate on privilege or membership change; bind the authorization transaction to the browser | A subdomain attacker or browser cookie-handling bug can still interfere |
| TM-13 | Spoofing | Refresh-token reuse or concurrent consumption | Refresh rotation; per-session database row lock; atomic persistence; reuse detection; revoke the session family on reuse; `invalid_grant` requires a new sign-in | A provider-side rotation defect or a lock bug can still cause reuse or false revocation |
| TM-14 | Tampering | Path traversal in file upload, storage, or download | Server-generated storage names; no user-controlled path components; organization and file IDs only; canonical path checks; no extraction to shared paths | A storage backend path bug or a future feature that accepts paths can reintroduce the risk |
| TM-15 | Denial of service | Decompression bomb or archive bomb | 25 MiB upload limit; archive entry, size, ratio, depth, and path limits; streamed inspection with hard byte counting; sandboxed worker with CPU, memory, and time limits | A parser zero-day or a crafted archive that evades limits can still exhaust resources |
| TM-16 | Tampering | SVG or other active content executes in a browser or image pipeline | Reject SVG; reject HTML, script, and executable content; strip active PDF content; serve downloads as attachments; CSP sandbox; no SVG optimization | A PDF viewer or image library vulnerability can still execute on the client |
| TM-17 | Tampering | Executable or malware upload | Allowlist of types; magic-byte validation; malware scan; quarantine; no execution in the API; approved-only download; isolated worker | Scanner evasion or a zero-day parser can still pass a malicious file |
| TM-18 | Tampering | Cache poisoning of shared or public caches | Strict cache boundaries; no shared private caching; authenticated responses use `Cache-Control: private, no-store`; no untrusted header or query key confusion; cache purge procedure | A CDN or framework cache bug can still serve a wrong response |
| TM-19 | Information disclosure | Cross-tenant cache leakage | No shared cache for personalized data; organization-scoped cache keys; cache invalidation on membership and role changes; separate public and private origins | A misconfigured cache or a new shared cache can leak data until purged |
| TM-20 | Elevation of privilege | Role or organization parameter tampering | Server-derived identity, organization, role, and permission; no trust in client claims; deny by default; role matrix; audited privileged actions; tests for every role and operation | A logic error in a policy function or a missed route check can still grant excess authority |
| TM-21 | Elevation of privilege | Global administrator abuse or accidental overreach | Separate global flag; rare and audited grants; separation of duties from judging and voting; break-glass procedure; review of administrative actions | A malicious global administrator with legitimate access can still cause harm |
| TM-22 | Tampering | Dependency or build-tool compromise | Exact pinned versions; committed lockfile; frozen installs; SBOM; dependency and container scanning; review of new packages and lifecycle scripts; advisory monitoring; emergency upgrade procedure | A maintainer compromise or a zero-day in a trusted package can still enter the build |
| TM-23 | Denial of service | Request flooding, expensive queries, or unbounded result sets | WAF and edge rate limits; API rate limits; body and upload limits; timeouts; cursor pagination with maximum page size; bounded database queries; queue and concurrency limits; per-organization quotas | A large botnet or an application-layer zero-day can still degrade service |
| TM-24 | Tampering | Race conditions in votes, submissions, registrations, or role changes | Database transactions; row locks; unique constraints; idempotency keys; state-machine checks inside the transaction; concurrency tests | Distributed retries or a missing constraint can still produce duplicate effects |
| TM-25 | Tampering | Forged or replayed backchannel logout or revocation event | HMAC-SHA256 challenge proof with the resource secret; JWKS validation; exact issuer; resource audience; `typ` checks; two-minute expiry; JTI denylist; event idempotency | Resource secret compromise or a provider signing-key compromise can defeat verification |
| TM-26 | Information disclosure | Secrets or tokens exposed in logs, errors, traces, browser bundles, or source maps | Server-only secrets; no tokens in browser storage; encrypted token storage; log redaction; standardized error responses; source-map controls; architecture tests for secret exposure | A debugging mistake or a third-party monitoring integration can still capture sensitive data |
| TM-27 | Tampering | Next.js server compromise leading to API or database access | No database credentials, identity secret, private session cookie, or administrative credential in the public runtime; no authentication in middleware; patched Next.js; SVG optimization disabled; separate origins; minimal image processing | A Next.js or React zero-day can still compromise the public site or the browser workspace |
| TM-28 | Elevation of privilege | RLS misconfiguration or runtime role with bypass privileges | Non-owner application role; no `BYPASSRLS`; `FORCE ROW LEVEL SECURITY`; transaction-local context; fail-closed function; separate migration role; catalog and pool-isolation tests | An operator or migration role can bypass RLS, and SQL injection executed as the application role can set a different context |
| TM-29 | Denial of service | Storage exhaustion through uploads or abandoned quarantines | Per-file 25 MiB limit; per-user and per-organization quotas; upload rate limits; quarantine lifecycle deletion; rejected-file purge; storage monitoring | Distributed accounts can still consume quota until limits or alerts react |
| TM-30 | Repudiation | Administrative action without reliable attribution | Per-user administrative accounts; audit records with actor, organization, action, target, correlation ID, and timestamp; append-only audit access; no shared administrator accounts | A compromised administrator account can perform actions attributed to the victim |

## 7. Threat-specific control requirements

### 7.1 Cross-site scripting

- Render all untrusted text through React text nodes. `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, and `eval`-like constructs are prohibited unless a reviewed, allowlisted sanitizer is the only path and the exception is recorded.
- Markdown rendering must disable raw HTML by default. If rich HTML is supported, it must pass an allowlist sanitizer that removes scripts, event handlers, dangerous URL schemes, embedded objects, and style-based script vectors.
- Validate URL schemes for links and images. Permit only `https`, `http` where explicitly allowed, and `mailto` where required. Reject `javascript:`, `data:` for navigations, `vbscript:`, and control-character obfuscation.
- Serve a strict Content Security Policy for both the public site and the workspace. Use nonces or hashes for required inline scripts. Do not permit `unsafe-eval`. `object-src 'none'`, `base-uri 'self'`, and `frame-ancestors 'none'` are required.
- User-uploaded SVG is rejected. User-uploaded HTML is rejected. PDFs are served as attachments from the cookieless asset origin.
- Stored, reflected, and DOM XSS payloads must exist as test fixtures in `tests/security` and as browser checks in `tests/e2e`.

### 7.2 SQL injection

- All SQL must use Drizzle's parameterized query builders or parameterized raw SQL. User input must never be concatenated into a statement, identifier, or clause.
- Sort fields, filter operators, aggregate names, and table names must come from explicit allowlists. Unknown values are rejected, not passed through.
- The runtime database role has only the DML privileges it needs. It is not the table owner, is not a superuser, and does not have `BYPASSRLS`.
- RLS is an additional layer. It does not make an injection safe, because an injected statement runs as the application role and can change the transaction-local organization context.
- SQL injection attempts and malformed filter input must be exercised in `tests/security`.

### 7.3 Authorization and object-level access

- Every protected request must verify identity, organization context, resource organization, active membership, operation permission, and competition eligibility, assignment, or ownership. See `docs/security/authorization.md`.
- A resource identifier is never a capability. Knowing or guessing an ID does not grant access. Every object lookup must be constrained by the authenticated actor's organization and relationship to the object.
- The frontend may hide actions for usability. Hiding is not a security control, and the API must enforce the same decision on every request.
- Cross-organization object access returns a not-found response where appropriate to avoid confirming the existence of another organization's resource.

### 7.4 Cross-organization isolation

- Every organization-owned row has a non-null organization identifier.
- API repositories require an organization identifier and include it in every tenant-table query, even when RLS is active.
- PostgreSQL RLS uses a transaction-local `nethack.organization_id` setting, a non-owner application role, no bypass privilege, and forced row security. See `docs/security/tenant-isolation.md`.
- Composite foreign keys and unique constraints must prevent a child row from referencing a parent in another organization.
- Caches, file storage prefixes, background jobs, exports, and audit queries must carry the organization scope. No personalized response may be cached in a shared cache.

### 7.5 CSRF, session fixation, and open redirect

- State-changing requests require a synchronizer token in addition to the session cookie. The token is bound to the session, compared in constant time, and required on `POST`, `PUT`, `PATCH`, and `DELETE`.
- Exact `Origin` validation is required for browser-originated requests. `Referer` validation is a secondary check, not a replacement.
- No state-changing operation may be performed by `GET`.
- A successful login creates a new session identifier. Pre-authentication session identifiers are never promoted.
- Login return paths are relative paths only. Absolute redirects require an explicit allowlist. The authorization callback redirect URI must match the registered value exactly.

### 7.6 SSRF and server-side fetching

- The application must not fetch arbitrary user-supplied URLs. URL previews, imports, webhooks, and remote asset fetching require an explicit destination allowlist.
- Resolve the destination and reject loopback, link-local, private, multicast, unspecified, and cloud metadata addresses. Revalidate after every redirect. Limit redirects, response size, and total time.
- Outbound network access from the API and workers is restricted at the network layer. The file-inspection worker has no outbound network access.

### 7.7 File upload and download

- The pipeline is quarantine, inspection, approval, then authorized download. No uploaded file is downloadable before approval.
- The upload limit is 25 MiB. Allowed types are an explicit allowlist. Magic bytes and container structure are validated; the declared MIME type and filename are not trusted.
- Storage names are generated. User filenames never become path components.
- SVG, HTML, scripts, executables, encrypted archives, and active PDF content are rejected. Archive central directories are inspected with entry, size, ratio, depth, and path limits.
- Uploaded content is never executed by the API. Inspection runs in an isolated worker with CPU, memory, time, filesystem, and network limits.
- Downloads are served from a separate cookieless asset origin with `X-Content-Type-Options: nosniff`, a sandboxing CSP, and attachment disposition except where a safe inline image policy is explicitly approved. See `docs/security/file-security.md`.

### 7.8 Cache isolation and cache poisoning

- Authenticated responses use `Cache-Control: private, no-store`.
- Personalized responses are never stored in a shared cache, CDN cache, or Next.js data cache. Next.js Cache Components are disabled initially, and experimental or complex shared caching is not used for sensitive data.
- Cache keys for any permitted shared cache include the organization and the authorization-relevant variant. Untrusted headers and query parameters must not be able to collide with another tenant's key.
- Public content may use static generation, incremental static regeneration, or deliberately scoped caching only after review.
- Cache purge is part of incident response when tenant leakage is suspected.

### 7.9 Privilege escalation and administration

- Roles are assigned explicitly and stored server-side. A user who administers one organization does not automatically administer another.
- Global administrator is a separate, rare, audited grant. It does not confer judging or voting authority. Competition actions by a global administrator require a break-glass grant and an audit record.
- Administrative endpoints require the same six-step verification plus an explicit administrative permission. They are rate-limited and audited.
- No shared administrator accounts. No client-provided role, permission, or organization claim is authoritative.

### 7.10 Dependency and build compromise

- Production dependencies are pinned to exact versions and installed from the committed `bun.lock` with a frozen lockfile in CI.
- New dependencies require justification and review. Lifecycle scripts are reviewed or disabled where the dependency does not require them.
- An SBOM is generated for every release. Direct and transitive dependencies, container base images, and build tools are scanned. Critical and high findings block release unless proven non-exploitable with recorded evidence.
- Next.js is kept on the latest patched stable release. SVG image optimization for untrusted content is disabled. Security advisories are monitored and patched on an emergency schedule.

### 7.11 Denial of service and resource exhaustion

- Edge and API rate limits apply to authentication, uploads, searches, exports, and other expensive operations.
- Request body, upload, JSON depth, array length, page size, and query complexity are bounded.
- Database queries are bounded and indexed for organization-scoped access. Unbounded result sets and unbounded background jobs are prohibited.
- Per-user and per-organization quotas bound storage, submissions, votes, and notification volume.
- Workers have bounded concurrency, retry limits, and dead-letter handling.

### 7.12 Backchannel and token revocation integrity

- The backchannel endpoint handles `action=test`, `logout_token`, and `action=revoke_access_token` on one endpoint.
- The test challenge is proven with HMAC-SHA256 using the current resource secret, within ten seconds, through the internal API.
- Logout and revocation tokens are validated against the current JWKS with exact issuer, resource audience, `typ`, expiry, and claim matching.
- Revoked access-token JTIs are stored with the earliest valid-after time and checked before any protected operation. Delivery retries are idempotent.

## 8. Residual risks

Residual risk is accepted only with a named owner and a review date. It is reviewed at every release and after every security incident.

| Residual risk | Why it remains | Required treatment |
| --- | --- | --- |
| Identity provider compromise | nethack trusts Basis Auth assertions and signing keys for authentication | Monitor provider advisories; validate issuer and audience strictly; support rapid session revocation; participate in provider incident response |
| Microsoft Entra ID compromise or misconfiguration | Upstream identity is outside nethack control | Rely on provider controls; restrict allowed organizations and account filters; review provider configuration |
| Browser or React zero-day | Client-side code runs in an untrusted browser | Strict CSP, no third-party scripts, prompt patching, session revocation, monitoring |
| Malicious authorized user exfiltration | A legitimate user can copy data they are permitted to see | Least privilege, audit, rate limits, export controls, watermarking where appropriate, legal controls |
| File scanner evasion | Malware detection is probabilistic | Allowlist, no execution, quarantine, attachment disposition, cookieless origin, isolated inspection |
| Supply-chain compromise | Trusted packages and build tools can be compromised | Pinning, SBOM, scanning, provenance, least-privilege CI, rapid rebuild and rotation |
| Denial of service | Internet-facing services are always exposed to volume attacks | Edge protection, quotas, graceful degradation, incident response |
| RLS or authorization misconfiguration | New tables and routes can omit controls | Automated catalog checks, architecture tests, cross-organization tests, review checklist |
| Insider with infrastructure access | Operators can bypass application controls | Least privilege, break-glass, audit, separation of duties, background checks where lawful |
| Same-site subdomain compromise | Cookies and Origin checks depend on origin discipline | `__Host-` cookies, no Domain attribute, strict subdomain ownership, HSTS, CSP |
| Social engineering and phishing | Users can be deceived outside nethack | Provider MFA, clear communication, verified domains, user education |
| Availability of Basis Auth | Sign-in depends on an external service | Health monitoring, bounded timeouts, clear recovery UX, status communication |
| Framework cache or CDN defect | Caching behavior can change between versions | No shared private caching, header tests, canary releases, cache purge procedure |

## 9. Assumptions

- Basis Auth follows the contract in `SETUP_GUIDE.md`, including PKCE, token lifetimes, refresh rotation, backchannel behavior, and error responses.
- Basis Auth is operated with patched software, protected signing keys, and a private internal listener.
- TLS is terminated correctly for all public origins. HSTS is enabled in production.
- The workspace, API, public site, and asset origin are separate hostnames with explicit CORS, cookie, CSP, and trust policies.
- The database is not publicly reachable. Runtime and migration credentials are separate.
- Operators use individual accounts and a secret manager. Shared credentials are prohibited.
- The threat model is reviewed when a new capability, origin, file type, identity flow, administrative power, or third-party integration is added.

## 10. Review triggers

Review and update this document when any of the following occurs:

- A new capability, public route, or organization-scoped resource is added.
- A new origin, subdomain, cookie, or CORS policy is introduced.
- Authentication, session, token, or account-linking behavior changes.
- A new file type, archive format, parser, or inspection tool is introduced.
- A new administrative role or break-glass procedure is added.
- A dependency with native code, a lifecycle script, or broad privilege is added.
- A security incident, penetration-test finding, or critical advisory affects a component in scope.
- At least annually, even when no change is detected.

The review must update the threat table, the residual-risk table, the security requirements, and the tests that verify the affected controls.
