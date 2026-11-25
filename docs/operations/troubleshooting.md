# Troubleshooting

## Sign-in failures

The sign-in page shows recovery guidance. The browser receives only a reason code; technical details stay in the server log.

| Reason | Meaning | Action |
| --- | --- | --- |
| `login_cancelled` | The user declined at the identity provider | Start again when ready |
| `login_expired` | The login transaction expired (10 minutes) | Start a new attempt |
| `login_failed` | Code exchange or ID token validation failed | Check provider registration, redirect URI, client secret, and clock |
| `account_disabled` | Local account is disabled | Organizer restores access |
| `account_link_required` | Email already belongs to a different external identity | Resolve the identity conflict; automatic linking by email is intentionally refused |

Provider error codes `14001`–`14501` and `2400` are documented in `docs/integrations/basis-auth.md`.

## 401 versus 403

- `401 authentication_required` — no valid application session.
- `401 invalid_token` — bearer access token failed signature, issuer, audience, `typ`, expiry, revocation, or user-status checks.
- `403 forbidden` — authenticated but not permitted: wrong organization, role, ownership, eligibility, or CSRF/Origin failure.

Never reveal whether an unauthorized resource exists.

## CSRF or Origin failures

Session-authenticated mutations require an exact `Origin` equal to the workspace or API origin and an `X-CSRF-Token` matching the session. Browsers omit `Origin` on some non-browser clients; those requests are rejected. Bearer-token requests are exempt from CSRF because they do not rely on cookies.

## Cookies

The session cookie is `__Host-nethack_session`: `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, no `Domain`. A browser will only accept it when the API origin is secure (HTTPS, or localhost in development). Renaming or adding a Domain breaks the prefix rules.

## Database errors

- `new row violates row-level security policy` — the transaction did not set `nethack.organization_id`, or the row belongs to another organization.
- Cross-organization queries return no rows by design. Do not disable RLS to debug; inspect the transaction context instead.
- Migrations must run with the owner/migration credential. The runtime role cannot create schemas or alter tables.

## Job queue

Jobs progress `pending -> running -> completed`, with retries back to `pending` and terminal `dead` after `max_attempts`. A stalled `running` job is eligible again after its lease expires. Inspect `jobs` and `outbox_events` for `last_error`; do not delete rows to force progress.

## Rate limiting

The API applies per-IP limits. `429 rate_limited` includes `Retry-After`. The reverse proxy should also enforce perimeter limits. Do not raise limits to conceal a client retry loop.

## Public site

The public site reads only public API routes. A 404 on a competition or project means it is not published, or the slug is wrong. The API's RLS public predicates hide drafts and unpublished records; this is expected.

## Caching

- Authenticated API responses: `Cache-Control: private, no-store`.
- Public API responses: short public cache with revalidation.
- Public site HTML: `private, no-store` because the CSP nonce changes per request.
- Asset downloads: private files no-store; public approved files may be cached on the asset origin.

If stale private data appears, treat it as a security incident: purge proxy/CDN caches and review cache keys and authorization.
