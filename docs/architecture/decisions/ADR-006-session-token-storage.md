# ADR-006: Session and token storage

Decision record for opaque sessions, encrypted tokens, and serialized refresh rotation.

## Status

accepted.

## Context

Basis Auth issues access and refresh tokens that must never reach the browser. Refresh tokens rotate on every use, and concurrent use of the same token can revoke the session family. A stolen database must not yield usable refresh tokens or session identifiers. Concurrent API requests must not independently consume the same refresh token.

## Decision

Nethack owns its application session.

- The browser receives one host-only cookie: `__Host-nethack_session`, with `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, and no `Domain`.
- The cookie value is a cryptographically random opaque session identifier. It contains no user data, claims, or tokens.
- Session storage is hash-only: the API stores a SHA-256 hash of the opaque session token in PostgreSQL, never the token itself. A database read does not reveal a usable cookie value.
- Access and refresh tokens are stored server-side in the session record or a tightly controlled related record.
- Refresh tokens are encrypted at rest with AES-256-GCM; access tokens use the same authenticated encryption. Each record uses a unique initialization vector, stores the authentication tag, and records a key version for rotation. Encryption keys come from the secret manager and are never stored in the database or repository.
- The browser never receives access tokens, refresh tokens, Basis Auth client secrets, signing keys, or encryption keys.
- Idle and absolute session lifetimes are bounded and validated from configuration.
- Refresh rotation is serialized per session:
  1. Begin a transaction.
  2. Lock the session row with `SELECT ... FOR UPDATE`.
  3. Read the current encrypted refresh token.
  4. Return the current access token if another request already rotated within the skew window.
  5. Exchange the refresh token with Basis Auth while the row is locked, with a bounded provider timeout.
  6. Persist the new encrypted refresh token and expiry before releasing the lock.
  7. Commit and release waiting requests.
- Two concurrent requests never consume the same refresh token.
- A consumed or expired refresh token is treated as `invalid_grant`: clear the refresh state and require a new sign-in. Reuse that indicates compromise invalidates the session family.
- Logout invalidates the local session, revokes the provider refresh token, and processes backchannel logout idempotently.
- Session identifiers rotate on privilege change, and sessions are invalidated on account disablement.
- Tokens, authorization codes, verifiers, cookies, and secrets are never logged.

## Consequences

- Session validation requires a database read or a bounded cache with explicit invalidation.
- Database compromise does not directly expose cookie values or refresh tokens.
- Refresh is more complex and must be tested under concurrency, provider failure, and clock skew.
- The session row is locked during refresh, so provider latency affects concurrent requests for the same session; the lock is bounded by a provider timeout.
- Key rotation requires a versioned encryption format and a re-encryption or dual-read procedure.
- Backchannel logout and revocation require reachable, verified endpoints.
