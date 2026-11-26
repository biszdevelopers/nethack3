# Runtime boundaries

Isolation rules for the public site, workspace, API, identity provider, database, and asset origin.

## Boundary model

```
Internet
   |
   +-- www.nethack.example     Next.js public runtime
   +-- app.nethack.example     static workspace
   +-- api.nethack.example     Fastify authority
   +-- assets.nethack.example  cookieless private files
   |
   +-- Basis Auth              external OIDC provider
   +-- PostgreSQL              private network only
```

Fastify is the authoritative security boundary. The public site and workspace are clients of the API, not authorities.

## Public Next.js runtime

The public Next.js runtime must have:

- No application database credentials.
- No Basis Auth secret.
- No session cookie.
- No administrative credentials.
- No private workspace build credentials.
- No access to private application state.

It may have only public configuration needed to render public pages and call public read-only API endpoints.

The public site must not:

- Use Next.js as the authoritative API.
- Use Server Actions for application mutations.
- Use middleware or `proxy.ts` as an authorization boundary.
- Access the application database.
- Hold private Basis Auth credentials, refresh tokens, access tokens, or signing keys.
- Cache user-specific data.
- Fetch arbitrary remote URLs on behalf of a user.
- Render authenticated workspace content.
- Expose a route that mutates application state.

All meaningful mutations go through Fastify. The public site consumes public API information only.

A compromise of the public Next.js renderer must not automatically compromise the API or database. This limits blast radius; it does not make a compromised public website harmless.

## Workspace runtime

`apps/workspace` is a static React application. Its runtime has:

- No server-side secrets.
- No database access.
- No private access tokens in JavaScript.
- No authority beyond what the API grants through the session.

The browser may hold only the host-only session cookie issued by the API. The cookie is `HttpOnly`, so application JavaScript cannot read it. Tokens remain server-side.

The workspace must not store access tokens, refresh tokens, client secrets, or private API credentials in `localStorage`, `sessionStorage`, IndexedDB, memory, or a non-HttpOnly cookie.

Authorization decisions in the workspace are presentation only. Every operation is rechecked by the API.

## API runtime

Fastify owns:

- Identity verification.
- Session management.
- Authorization.
- Organization membership checks.
- Business rules.
- Database access.
- File authorization.
- Audit records.
- Submission, judging, voting, and administrative operations.
- Background job coordination.

The API must:

- Complete the OIDC Authorization Code flow with PKCE server-side.
- Keep the Basis Auth client secret and tokens off the browser.
- Store a SHA-256 hash of the opaque session token; never store the token itself.
- Encrypt refresh tokens at rest with AES-256-GCM.
- Serialize refresh rotation per session with row locks.
- Validate every backchannel logout and revocation callback.
- Apply exact origin, CSRF, content-type, and request-size checks.
- Return a consistent `401 invalid_token` response for invalid access tokens.
- Fail closed on missing organization context or authorization data.

The API is the only writer to the nethack database.

## Basis Auth boundary

Basis Auth is a separately deployed OpenID Connect provider in front of Microsoft Entra ID.

- Nethack never shares or forwards the `basis_sso` cookie.
- Nethack never sees Microsoft tokens.
- Nethack uses a dedicated confidential client per environment.
- Development, staging, and production use separate registrations and secrets.
- The durable identity reference is `(issuer, subject)`, not email.
- Basis Auth establishes identity; nethack determines authorization.
- Basis Auth permissions may complement local checks but never replace organization-specific authorization.
- Logout, revocation, and disabled-account handling follow `SETUP_GUIDE.md`.
- Conformance testing and focused security review precede an internet-facing production launch.

## Database boundary

- PostgreSQL is reachable only from the API, workers, and migration jobs on a private network.
- The runtime role is not the table owner and does not have `BYPASSRLS`.
- Migration jobs use separate credentials.
- The public site, workspace, and asset origin have no database route.
- Connection pools are bounded and never shared across tenants with leaked session context.

## Asset origin

Uploaded private files are served from a separate cookieless origin.

- The asset origin sets no cookies and receives no session cookie.
- Files are served with a content type derived from validated metadata, never from the filename alone.
- Untrusted HTML, scripts, and executable content are never served inline.
- SVG is rejected or safely transformed.
- Downloads use authorization issued by the API and short-lived, scoped URLs or a streamed API response.
- The asset origin has a restrictive content security policy and `X-Content-Type-Options: nosniff`.
- Files are never executed inside the API process.

## Network matrix

| Source             | Allowed destination                                                       |
| ------------------ | ------------------------------------------------------------------------- |
| Browser            | Public site, workspace, API, Basis Auth redirects, asset origin           |
| Public site server | Public API read endpoints only                                            |
| Workspace          | No server runtime; browser calls the API                                  |
| API                | PostgreSQL, Basis Auth, mail service, object storage, worker coordination |
| Workers            | Same as API; no public inbound listener                                   |
| Migration job      | PostgreSQL with migration credentials                                     |
| Basis Auth         | Its own database; backchannel callbacks to registered API URLs            |
| Asset origin       | Object storage only                                                       |

No component other than the API and workers may open a database connection. No internal port is publicly exposed.

## Credentials matrix

| Credential | Allowed location | Never in |
| --- | --- | --- |
| Database runtime password | API and worker secret environment | Site, workspace, browser, logs |
| Database migration password | Migration job secret environment | API runtime, site, workspace |
| Basis Auth client secret | API secret environment | Site, workspace, browser, logs |
| Basis Auth resource secret | API secret environment and receiver | Browser, public site, logs |
| Session cookie | Browser, host-only, HttpOnly | JavaScript, URLs, logs, referrers |
| Refresh and access tokens | API database, encrypted at rest | Browser, public site, logs |
| Token encryption key | API secret manager | Database rows, repository, logs |
| Administrative credentials | API secret environment, separate role | Public site, workspace bundle |

Secret values are loaded from the environment or a secret manager, validated at startup, redacted in logs, and rotated through a documented procedure.

## Cookies

The session cookie is:

```
__Host-nethack_session
Secure
HttpOnly
SameSite=Lax
Path=/
No Domain
```

- The `__Host-` prefix requires Secure, Path=/, and no Domain.
- The cookie contains an opaque random identifier, never user data or tokens.
- The API stores only a hash of the identifier.
- The cookie is rotated on privilege change and invalidated on logout, revocation, or account disablement.
- The workspace and API deployment must keep the cookie viable. The default is same-site routing, with workspace calls to the API routed through the workspace origin. A cross-site API origin requires an ADR and `SameSite=None; Secure` with additional CSRF controls.
- The public site never receives the session cookie.

## CSRF and CORS

- Cookie-authenticated mutations require a synchronizer token and exact `Origin` validation.
- SameSite alone is not sufficient.
- State-changing requests never use GET.
- Content type is enforced for JSON and form submissions.
- The API allows credentials only for the exact workspace origin. Wildcard origins are forbidden with credentials.
- Preflight responses allow only the methods and headers actually used.
- Redirect targets are allowlisted; open redirects are forbidden.

## Content security policy

The public site and workspace have separate policies.

Required controls:

- Restrictive `default-src`.
- Restrictive `script-src` with nonces or hashes.
- `object-src 'none'`.
- `base-uri 'self'`.
- `frame-ancestors 'none'`.
- Restrictive `connect-src` limited to the API and required origins.
- Appropriate `form-action`.
- HTTPS-only production resources.
- No `unsafe-eval`.
- No arbitrary inline scripts.
- No arbitrary script origins.

Policies start in report-only mode, violations are resolved, then the policy is enforced.

## Caching

- Authenticated API responses use `Cache-Control: private, no-store`.
- The workspace does not use a shared cache for private data.
- The public site caches public content only, with explicit revalidation.
- Next.js Cache Components are disabled initially for sensitive data. Do not enable experimental shared caching without an ADR and tenant tests.
- Cache keys never omit organization or user scope where the value is private.
- No cache serves one organization's response to another.
- Published content invalidation is explicit and tested.

## Next.js containment

- Use the latest patched stable release.
- Monitor official security advisories.
- Disable SVG image optimization for untrusted content.
- Minimize image-processing attack surface.
- Do not expose private server functionality through Next.js.
- Do not put authentication in `proxy.ts`.
- Keep private application sessions off the public origin.
- Patch immediately and run security regression tests after upgrades.

A severe React client-side vulnerability can still affect the workspace. The architectural separation principally limits Next.js server-rendering and React Server Component compromise.

## Review checks

- Does the public runtime hold any private credential, cookie, or database route?
- Does the workspace bundle contain a token, secret, or server module?
- Is every mutation handled by Fastify?
- Is the session cookie host-only, HttpOnly, Secure, and SameSite as specified?
- Are CSRF and origin checks present on every cookie-authenticated mutation?
- Are authenticated responses marked private and no-store?
- Does the asset origin remain cookieless and non-executable?
- Does a new cache key include tenant scope?
- Does a deployment change preserve the cookie and origin model?
