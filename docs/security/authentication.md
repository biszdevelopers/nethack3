# Authentication

Status: authentication specification and release procedure. These are required
behaviors. No behavior in this document is verified by the existence of the
document or by the presence of code. The release gate in section 14 must be
executed and recorded.

## 1. Scope

This document defines how nethack authenticates people through Basis Auth, how
it creates and stores its own browser session, how it refreshes and revokes
tokens, and how it verifies access tokens at the API.

It does not define what an authenticated person may do. That is
`docs/security/authorization.md`. It does not replace the downstream contract in
`SETUP_GUIDE.md`; that guide is authoritative for Basis Auth behavior.

Basis Auth is an OpenID Connect provider in front of Microsoft Entra ID.
nethack never sees Microsoft tokens. The browser authenticates through Basis
Auth, and the nethack API creates its own session. The `basis_sso` cookie is
never read, forwarded, reused, or shared.

## 2. Registration model

Use a dedicated confidential client for nethack. Register separately for
development, staging, and production. Never reuse a client, secret, redirect
URI, or resource audience across environments.

The registration must specify:

- Application name and client ID.
- Client secret, stored only server-side.
- Exact redirect URI, for example `https://api.nethack.example/auth/callback`.
  The URI must match character for character.
- The resource audience, for example `devconnect://nethack.bisz.dev` as a
  starting reference pending operator confirmation.
- Allowed scopes, including the nethack API scope, for example `nethack.access`
  as a starting reference pending operator confirmation.
- Permission definitions and first-login defaults for the client.
- Backchannel logout and access-token revocation receiver URL, for example
  `https://api.nethack.example/auth/backchannel`.
- Allowed Microsoft organizations and account filters.
- Consent requirements.

The audience and scope values above come from the example in `FULL_PLAN.md`
section 10.2. They are starting references, not production values. Confirm the
final registration with the Basis Auth operator.

## 3. Configuration

The authentication integration must use the following environment variables.
Secrets are provided through the deployment secret store and are never
committed, logged, or sent to the browser.

| Variable | Required | Meaning |
| --- | --- | --- |
| `BASIS_AUTH_ISSUER` | Yes | Exact issuer URL, for example `https://auth.example.org` |
| `BASIS_AUTH_CLIENT_ID` | Yes | Registered confidential client ID |
| `BASIS_AUTH_CLIENT_SECRET` | Yes | Confidential client secret |
| `BASIS_AUTH_RESOURCE` | Yes | Registered resource audience used in authorization and token validation |
| `BASIS_AUTH_RESOURCE_SECRET` | Yes for backchannel and internal API use | Resource secret used for webhook proof and internal API authentication |
| `BASIS_AUTH_REDIRECT_URI` | Yes | Exact registered callback URI |
| `BASIS_AUTH_INTERNAL_URL` | Only when calling the internal API | Private or loopback base URL for the Basis Auth internal listener |

Validation requirements:

- `BASIS_AUTH_ISSUER` and `BASIS_AUTH_REDIRECT_URI` must be absolute URLs.
  Production must use HTTPS. Plain HTTP is permitted only for local
  development on loopback.
- `BASIS_AUTH_REDIRECT_URI` must be registered exactly and must not contain a
  fragment. It must not be derived from request headers.
- `BASIS_AUTH_CLIENT_SECRET` and `BASIS_AUTH_RESOURCE_SECRET` must be treated as
  credentials with the same care as database passwords.
- Configuration is validated at startup. The process must fail to start when a
  required value is missing or malformed.
- Separate registrations and secrets are required for each environment.

## 4. Discovery and key handling

1. Fetch `/.well-known/openid-configuration` from the configured issuer over
   HTTPS.
2. Require the discovery document's issuer to equal the configured issuer.
   Reject a mismatch.
3. Require the authorization, token, JWKS, and logout endpoints to be
   HTTPS URLs in production.
4. Fetch `/oauth/jwks` and cache the signing keys for about five minutes.
5. On an unknown `kid`, refresh the JWKS at most once per short interval and
   then reject the token if the key is still unknown.
6. Bound discovery and JWKS requests with timeouts and response-size limits.
7. Do not follow arbitrary redirects during discovery or JWKS retrieval.
8. Never accept a JWKS URL supplied by a request or by token content.

The cache is a performance control, not a trust decision. A key that is no
longer in the current JWKS must not be used to validate new tokens after the
cache expires.

## 5. Login initiation

1. The browser starts login at the nethack API, not at Basis Auth directly.
2. Generate independent cryptographically secure values for `state`, `nonce`,
   and the PKCE verifier.
3. The verifier must be 43 to 128 characters from `[A-Za-z0-9._~-]`.
4. Compute `code_challenge = base64url(SHA-256(verifier))`.
5. Persist a server-side authentication transaction with:
   - a hash of `state`;
   - the `nonce`;
   - the encrypted verifier;
   - a ten-minute expiry;
   - the requested return path;
   - an IP hash for risk analysis.
6. Bind the transaction to the browser with a short-lived cookie, for example
   `__Host-nethack_auth`, with `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`,
   no `Domain`, and a ten-minute `Max-Age`. The cookie contains a random
   transaction identifier, not the verifier or tokens.
7. Validate the return path before storing it. Accept only a relative path.
   Reject absolute URLs, scheme-relative URLs, backslashes, control characters,
   and encoded variants that could become an open redirect.
8. Redirect to the authorization endpoint with the parameters below.

```text
client_id=<client-id>
response_type=code
redirect_uri=<exact-registered-uri>
scope=openid profile email offline_access nethack.access
resource=<resource-audience>
state=<random>
nonce=<random>
code_challenge=<base64url-sha256-of-verifier>
code_challenge_method=S256
```

Rules:

- Include `openid` always.
- Include exactly one `resource`. Omit it only when the client has exactly one
  registered resource and the operator documents that behavior.
- Include `offline_access` only when a refresh token is required. nethack
  requires refresh tokens for its session model.
- Use `code_challenge_method=S256`. Do not use `plain`.
- Do not add arbitrary parameters or copy values from the request.
- The authorization request expires after ten minutes.

## 6. Callback and code exchange

1. On callback, compare `state` with the stored transaction before doing
   anything else.
2. Compare the browser transaction cookie with the transaction record using a
   constant-time comparison.
3. Reject a missing, expired, consumed, or mismatched transaction.
4. Treat `error=access_denied` as a cancellation. Do not retry automatically.
5. Exchange the code from the server within sixty seconds.
6. Use HTTP Basic authentication for the confidential client:

```bash
curl -u '<client-id>:<client-secret>' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'grant_type=authorization_code' \
  --data-urlencode 'code=<authorization-code>' \
  --data-urlencode 'code_verifier=<original-verifier>' \
  --data-urlencode 'redirect_uri=<exact-registered-uri>' \
  https://auth.example.org/oauth/token
```

Rules:

- Do not send the client secret in the request body for authorization-code or
  refresh grants.
- Include `redirect_uri` only if it was included in the authorization request,
  and then it must match exactly.
- The authorization code is single-use and has a sixty-second lifetime.
- A reused, expired, or verifier-mismatched code fails with `invalid_grant`.
  Treat that as a failed login and restart the flow.
- Do not log the code, verifier, client secret, or raw token response.
- Mark the transaction consumed atomically before creating a session. A
  concurrent callback for the same transaction must fail.

## 7. ID token validation

Use a maintained OpenID Connect or JWT library. Do not implement signature
verification, JWKS parsing, or claim validation by hand.

Validate all of the following:

- Signature algorithm is exactly `RS256`. Reject `none`, HMAC algorithms, and
  algorithm confusion.
- The signing key is selected from the current JWKS by `kid` and is a signing
  key.
- Exact issuer match against `BASIS_AUTH_ISSUER`.
- Audience equals the nethack client ID. If `aud` is an array, it must contain
  the client ID. If `azp` is present with multiple audiences, it must equal the
  client ID.
- `exp` is in the future, `iat` is not unreasonably in the future, and `nbf` is
  satisfied when present. Allow at most sixty seconds of clock skew.
- `nonce` equals the value stored for this authentication transaction.
- `at_hash` is present and valid when the provider includes it, or is checked
  by the library.
- `sub` is present and non-empty.
- The token is not accepted if any required claim is missing or malformed.

Do not use the ID token as an access token. Do not send the ID token to a
resource API. Do not use email as the durable account key.

## 8. Account linking

- The durable external identity is `(issuer, subject)`.
- On first successful login, create or resolve the local user and store the
  external identity pair.
- If an external identity already exists, load the linked local user.
- If the local user is disabled, reject the login and do not create a session.
- Never silently link an existing local account by matching email.
- If an email matches an existing account but the external identity is not
  linked, require an explicit authenticated linking flow. Record an audit event.
- If the same `(issuer, subject)` is linked to a different user, fail closed and
  require operator review.
- Email, display name, and avatar are profile data. They may be updated from the
  provider but are not identity keys.
- Account linking and unlinking are audited. Unlinking requires a verified
  recovery path.

## 9. Session creation and cookie

Create a new application session only after the ID token is validated and the
account is resolved and active.

Cookie contract:

```text
Set-Cookie: __Host-nethack_session=<opaque-value>; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=<remaining-seconds>
```

Requirements:

- Cookie name is exactly `__Host-nethack_session`.
- `Secure` is always set. Production requires HTTPS.
- `HttpOnly` is always set.
- `SameSite=Lax`.
- `Path=/`.
- No `Domain` attribute. The `__Host-` prefix requires this.
- The value is an opaque, high-entropy random identifier, at least 256 bits.
- The session identifier is never placed in a URL, HTML, JavaScript, logs, or
  error messages.
- Create a new session identifier on successful login. Never promote a
  pre-authentication session.
- Rotate the session identifier on a privilege or membership change that
  affects authority.
- Set the cookie with the same attributes when clearing it, with `Max-Age=0`.
- Do not set any provider cookie from the nethack API.

The workspace and API must be same-site under the same registrable domain for a
`SameSite=Lax` session cookie to be sent on credentialed API requests. If they
are deployed on different registrable domains, the cookie policy and CSRF model
must be redesigned and reviewed before deployment.

Initial session lifetimes:

- Idle timeout: 12 hours, based on server-side last-use time.
- Absolute timeout: 30 days, aligned with the maximum refresh-token lifetime.
- The cookie `Max-Age` must not exceed the remaining absolute session lifetime.
- Expired or revoked sessions are rejected even if the browser still sends the
  cookie.

## 10. Session storage

Store only what is required, and never store a usable bearer value in plaintext.

- Store a SHA-256 hash of the session identifier in `sessions.token_hash`, with
  a unique index.
- Store a hash of the CSRF token in `sessions.csrf_hash`.
- Store access and refresh tokens encrypted.
- Store the token encryption key version in `sessions.token_key_version`.
- Store access and refresh expiry timestamps.
- Store an IP hash and user agent for risk analysis, not as a hard
  authentication factor.
- Store `revoked_at` and `revoked_reason`.
- Do not store the client secret, PKCE verifier, authorization code, or ID token
  in the session record.
- Expired authentication transactions and revoked sessions are purged by a
  scheduled job.

## 11. CSRF and session fixation

- Every state-changing request requires the session CSRF token in
  `X-CSRF-Token`, in addition to the session cookie.
- The CSRF token is returned by the authenticated session endpoint, kept in
  frontend memory, and never placed in a cookie or URL.
- Compare the supplied token with the stored hash in constant time.
- Validate the exact `Origin` for browser-originated state changes. Validate
  `Referer` as a secondary check.
- Require a JSON content type for JSON mutations. Reject form-encoded mutations
  unless the endpoint explicitly supports them.
- No state-changing operation may be performed by `GET`.
- A login creates a new session. A logout destroys the server-side session
  before responding.
- A session identifier observed before login is never accepted after login.

## 12. Token encryption

Access and refresh tokens are encrypted at rest with AES-256-GCM.

- Key length is 256 bits.
- Use a unique 96-bit random IV for every encryption.
- Use a 128-bit authentication tag.
- Bind the ciphertext to context with additional authenticated data, for
  example `nethack:session:<session-id>:access` and
  `nethack:session:<session-id>:refresh`.
- Store the key version with the ciphertext. The version selects the key from a
  server-side key ring.
- Never store encryption keys in the database, repository, logs, or browser.
- Decrypt only in the server process that needs the token. Do not return
  plaintext tokens to the browser.
- On decryption failure, treat the session as invalid, revoke it, and log a
  security event without the ciphertext.
- Key rotation: add a new key version, write new encryptions with the new
  version, decrypt old versions during the transition, re-encrypt on use or in
  a batch, and remove the old key only after every record is migrated and the
  maximum session lifetime has passed.
- If a key is suspected compromised, revoke affected sessions, rotate the key,
  and require re-authentication. Do not attempt to preserve sessions encrypted
  with the compromised key.

## 13. Refresh-token rotation

Basis Auth refresh tokens rotate on every use. A consumed or expired token
revokes the session family. Two concurrent requests must never independently
consume the same refresh token.

Required algorithm:

1. Begin a database transaction and select the session row with
   `SELECT ... FOR UPDATE`. Set a bounded lock timeout.
2. Re-read the session inside the lock. Reject revoked, expired, or disabled
   sessions.
3. If the access token is still valid for the operation, use it and release the
   lock. Do not refresh unnecessarily.
4. Otherwise, decrypt the current refresh token.
5. Call the token endpoint with the same client authentication,
   `grant_type=refresh_token`, and the current refresh token.
6. Persist the new encrypted refresh token, the new encrypted access token, the
   new expiries, the key version, and the last-use time before releasing the
   lock.
7. Commit, then release the lock. Waiting requests re-read the committed row and
   use the new token or access token.
8. Schedule the next refresh from the new `expires_in` value.

Rules:

- Hold the row lock across the provider exchange so no second request can read
  the old token and consume it independently.
- Bound the provider call and the lock wait. On lock timeout, return a temporary
  failure with `Retry-After`; do not fall back to the old token.
- Refresh before expiry, leaving room for clock skew and retries. Use the
  earlier of five minutes before expiry or twenty percent of the token lifetime
  remaining.
- Read the actual lifetime from the token response `expires_in` or the JWT
  `exp`. Do not hardcode a lifetime that the provider can change.
- When the resource has no valid saved backchannel URL, the provider caps the
  access-token lifetime at 10 minutes. Do not assume the configured default in
  that case.
- On `invalid_grant`, clear refresh state, revoke the local session, and require
  a new sign-in. Do not retry with the same token.
- On a network timeout or provider `5xx`, the result is ambiguous. Do not
  blindly retry with the old token in a way that can trigger reuse detection.
  Re-read the session under the lock. If the token is unchanged and the access
  token is still valid, continue with the access token. If the token is
  unchanged and the access token is expired, return a temporary failure and let
  the operation retry under a fresh lock. If the outcome still cannot be
  determined, clear the session and require sign-in.
- Never log the refresh token, access token, or token response.
- A refresh failure must not silently extend the session. If the access token is
  expired and refresh cannot succeed, return `401` and require sign-in.

## 14. Release gate: verification checklist

Run this checklist against the target issuer before declaring the
authentication integration complete. Every item is release-blocking until it
has been executed and recorded. Use staging first, then production.

- [ ] Discovery and JWKS are reachable from the app and API networks.
- [ ] Login completes with `openid`, state, nonce, and PKCE.
- [ ] Callback rejects mismatched state and an invalid verifier.
- [ ] Code exchange succeeds once; a reused code fails with `invalid_grant`.
- [ ] ID token validates issuer, audience, signature, expiry, nonce, and hash.
- [ ] App creates its own session; no `basis_sso` sharing.
- [ ] API accepts a valid token for the exact resource audience.
- [ ] API rejects a token with the wrong audience, missing scope, or missing
      permission.
- [ ] API returns the standard `401 invalid_token` response for revoked,
      expired, and malformed tokens.
- [ ] For a resource without a backchannel URL, sign-in succeeds and each
      applicable grant returns `expires_in` equal to the JWT's `exp - iat`, at
      most 600 seconds.

For resources with a backchannel receiver:

- [ ] Backchannel `action=test` verification succeeds and saves the URL.
- [ ] Logout ends the app session and terminates the matching user's API
      sessions through `logout_token`.
- [ ] A revoked access token is denied after the delivered revocation event.

For all resources:

- [ ] Refresh rotates the token and a reused token forces re-authentication.
- [ ] Disabled users cannot sign in and existing tokens are rejected as
      configured.
- [ ] Unregistered resources, scopes, and redirect URIs fail closed with the
      documented codes.
- [ ] Sign-in failures show recovery guidance. Technical details are available
      in the browser's developer console.
- [ ] After a scope-table upgrade, existing registered scopes can still be
      requested for their original audiences.
- [ ] A resource editor can set, change, and clear an Entra scope mapping and
      read back the saved value.

The checklist must also be rerun after any contract change, dependency upgrade
that affects OIDC, key rotation, or incident that touches authentication.

## 15. Contract review checklist

An update to Basis Auth is a contract review, not a dependency bump. Review the
following before changing integration code:

- [ ] Client ID, client secret, and redirect URIs still match the environment.
- [ ] Resource audience and scopes are still registered and allowed.
- [ ] Permission catalog, defaults, and grants are still valid.
- [ ] Access and ID token validation still checks issuer, audience, algorithm,
      `typ`, expiry, nonce, and `at_hash`.
- [ ] Access-token lifetime assumptions (caches, refresh thresholds, clock skew)
      still hold.
- [ ] Standard `invalid_token` response is unchanged.
- [ ] Backchannel receiver still verifies `logout_token` and
      `revocation_token` with the current JWKS and types.
- [ ] Access-token denylist is still keyed by `jti` and honors `valid_after`.
- [ ] Every resource webhook URL is still verified and reachable from Basis
      Auth.
- [ ] Internal API callers still send `X-Basis-Resource` and the current secret.
- [ ] Management callers still send a valid actor token in
      `X-Basis-Actor-Token`.
- [ ] Local account linking still uses `sub`, never email.

## 16. Logout and revocation

### 16.1 Local and provider logout

1. The browser sends an authenticated, CSRF-protected logout request.
2. Mark the local session revoked in the database and clear the session cookie.
3. Best-effort revoke the refresh token at Basis Auth.
4. Build the current provider logout URL and return it to the browser for
   navigation. Do not trust a user-supplied logout URL.
5. Local logout succeeds even if the provider call fails. Record the provider
   failure and retry according to the provider contract.
6. Logout is idempotent for the same session.

### 16.2 Backchannel receiver

Register at least one receiver URL that handles three event types on the same
endpoint:

1. `action=test` webhook verification.
2. `logout_token` user logout.
3. `action=revoke_access_token` access-token revocation.

A resource may have multiple receiver URLs. Each URL is verified separately and
receives logout and access-token revocation events. Without a valid saved URL,
the API receives neither event and a signed token remains acceptable until it
expires.

### 16.3 Test challenge proof

When a receiver URL is saved, Basis Auth posts form-encoded `action=test`, a
one-time `nonce`, and a `challenge`.

1. Return `202 Accepted` immediately.
2. Compute the challenge hash with HMAC-SHA256 using the current resource
   secret as the key and the challenge as the message, hex-encoded.
3. Send the proof to the internal API within ten seconds:

```js
import { createHmac } from "node:crypto";

const challengeHash = createHmac("sha256", resourceSecret)
  .update(challenge, "utf8")
  .digest("hex");

await fetch(new URL("/internal/backchannel/validate", internalUrl), {
  method: "POST",
  headers: {
    Authorization: `Bearer ${resourceSecret}`,
    "X-Basis-Resource": encodeURIComponent(audience),
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ nonce, challenge_hash: challengeHash }),
});
```

| Response | Meaning |
| --- | --- |
| `200 {"status":"successful"}` | Accepted and consumed |
| `400 invalid_request` | Bad input, wrong audience, unknown or used nonce, bad hash |
| `401 unauthorized` | Resource credentials missing or invalid |
| `408 timeout` | Challenge expired; save the URL again |

The previous URL list remains active if verification fails. Clearing the list
takes effect immediately.

### 16.4 Logout token validation

When a user logs out, every configured receiver gets form-encoded
`logout_token`. Verify it against the current JWKS and require:

- `alg=RS256`.
- `typ=logout+jwt`.
- Exact issuer.
- The nethack resource audience.
- A valid expiry. Logout tokens live two minutes.
- `sub` is present.
- The `http://schemas.openid.net/event/backchannel-logout` event is present.

Then end the local sessions for that `(issuer, sub)` and return `200` or `204`.
Record the event idempotently. A repeated delivery must not fail or create a
duplicate side effect.

### 16.5 Access-token revocation validation

When an access token is replaced by refresh or explicitly revoked, every
configured receiver gets form-encoded:

```text
action=revoke_access_token
jti=<token-id>
valid_after=<unix-seconds>
revocation_token=<signed-jwt>
```

Verify `revocation_token` with the current JWKS and require:

- `alg=RS256`.
- `typ=at-revocation+jwt`.
- Exact issuer.
- The nethack resource audience.
- A valid expiry. Revocation tokens live two minutes.
- `access_token_jti` and `valid_after` match the form fields.

Store the JTI in a denylist and reject matching access JWTs at or after
`valid_after`. Use the signed `access_token_expires_at` claim when present to
expire the entry, and allow for verifier clock tolerance. Delivery can retry, so
keep the earliest valid-after time per JTI. Return `200` or `204` after
persisting.

## 17. Access-token validation at the API

The nethack API is a resource server. Every protected API request must validate
the access token:

- `alg=RS256` against the current JWKS.
- `typ=at+jwt`.
- Exact issuer.
- Audience equals `BASIS_AUTH_RESOURCE`.
- `exp` and `nbf` with bounded clock skew.
- `sub` and `jti` present.
- Required scopes and permissions for the operation.
- JTI is not denylisted at or after `valid_after`.
- The user is not disabled and the token is not at or before
  `tokens_valid_after` when immediate revocation checking is enabled.

Never accept an ID token at the API. Never trust an unverified `aud`, `iss`, or
`typ`. Never use the access token as proof of organization membership or
authorization; those are local decisions.

Invalid tokens produce the standard response:

```http
HTTP/1.1 401
WWW-Authenticate: Bearer error="invalid_token"
Content-Type: application/json

{"error":"invalid_token","error_description":"Invalid access token"}
```

Missing scope or permission produces `403`, not `401`. Cookie-based application
endpoints may use their existing session error code with the same description
and status. Keep rejection reasons in server-side logs and never include tokens,
codes, secrets, verifiers, or raw cookies in logs or responses.

### 17.1 Immediate revocation

Local JWT validation reflects permission and disablement changes only when
tokens expire. With the default lifetime, that is within sixty minutes. For
immediate revocation:

- Implement `loadTokenSubject` against the internal user endpoint and fail
  closed.
- Reject disabled users.
- Reject tokens whose `iat` is at or before the returned `tokensValidAfter`
  barrier.
- Cache the result only for a short, bounded time. On provider error or missing
  data, reject the request.
- In addition, implement the JTI denylist from section 16.5.

`tokens_valid_after` is the immediate-revocation barrier. It is not a substitute
for local organization authorization.

## 18. Error handling and diagnostics

- Login failures show recovery guidance. Technical detail is available in the
  browser console as a diagnostic code, never as a token or secret.
- Provider error codes are mapped to stable nethack failure codes such as
  `login_cancelled`, `login_expired`, `login_failed`, `account_disabled`, and
  `account_link_required`.
- Do not expose provider internals, stack traces, raw responses, or secrets to
  the browser.
- Log correlation IDs, provider error codes, and high-level reasons privately.
- Never log authorization codes, access tokens, refresh tokens, ID tokens,
  client secrets, resource secrets, PKCE verifiers, raw cookies, or token
  endpoint payloads.
- Rate-limit login initiation, callback, token exchange, refresh, and logout.
- Alert on repeated state mismatches, invalid verifier attempts, refresh reuse,
  disabled-account login attempts, and unusual callback volume.

## 19. Production readiness review

Before an internet-facing production launch, complete and record:

- OpenID Foundation conformance testing or an equivalent documented test.
- Review of authorization and redirect validation.
- Review of PKCE implementation and verifier handling.
- Review of refresh-token rotation and reuse handling.
- Review of key management, encryption, and rotation.
- Review of callback security, including state, nonce, and transaction binding.
- Review of account linking and collision handling.
- Review of session revocation, logout, and backchannel behavior.
- Independent security assessment of the authentication boundary.

Basis Auth's own documentation states that its OIDC surface is not presented as
OpenID certified. nethack must not treat provider claims of compatibility as a
substitute for this review.

## 20. Operational notes

- Keep provider call timeouts short and bounded. Do not hold request handlers
  open indefinitely for a slow identity provider.
- Treat provider unavailability as an authentication failure, not as an
  authorization bypass.
- Monitor login success rate, failure codes, refresh latency, refresh failures,
  backchannel delivery, JWKS age, denylist size, and `401`/`403` rates.
- Keep the previous application version deployable until a full login, refresh,
  logout, and revocation cycle passes in the target environment.
- Rotate the client secret and resource secret according to
  `docs/security/incident-response.md` and the sequences in `SETUP_GUIDE.md`
  sections 10.4 and 10.5.
- Keep `SETUP_GUIDE.md` authoritative. When Basis Auth changes endpoints,
  claims, lifetimes, revocation, or registration rules, update the guide and
  this document in the same change.
