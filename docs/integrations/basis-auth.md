# Basis Auth integration

Status: downstream integration contract summary and operating requirements. This document does not assert that the integration is implemented or verified. `SETUP_GUIDE.md` is the authoritative downstream contract. If this summary and the guide disagree, the guide wins, and this document must be corrected in the same change.

## 1. Authority and scope

Basis Auth is an OpenID Connect provider in front of Microsoft Entra ID. It is a separate service, not a package embedded in nethack. Users authenticate through Microsoft; nethack never sees Microsoft tokens.

This document summarizes what nethack needs from Basis Auth:

- Endpoints and token behavior.
- Environment configuration.
- Authorization-code and PKCE flow.
- Refresh rotation.
- Scopes versus permissions.
- Backchannel logout and access-token revocation.
- Internal API authentication.
- Error codes and failure handling.
- Account linking.
- Verification and update procedures.

Detailed nethack authentication controls are in `docs/security/authentication.md`. Detailed authorization rules are in `docs/security/authorization.md`.

## 2. Integration model

Use a backend-for-frontend. The Fastify API owns the client secret, PKCE verifier, authorization code exchange, tokens, and application session. The browser receives only the short-lived authorization code and the nethack session cookie. The browser never receives a Basis Auth token or secret.

The browser session is owned by nethack. Never read, reuse, forward, or share the `basis_sso` cookie and never forward Basis Auth tokens to another service.

```
Browser
   |
   v
nethack workspace
   |
   v
nethack Fastify API
   |
   | Authorization Code + PKCE
   v
Basis Auth
   |
   v
Microsoft Entra ID
```

## 3. Endpoints

| Endpoint                                | Use                                            |
| --------------------------------------- | ---------------------------------------------- |
| `GET /.well-known/openid-configuration` | Discovery                                      |
| `GET /oauth/authorize`                  | Authorization code + PKCE                      |
| `POST /oauth/token`                     | Code, refresh, and client-credentials exchange |
| `GET /oauth/jwks`                       | Public RS256 keys                              |
| `GET/POST /oauth/userinfo`              | Profile claims for a user access token         |
| `POST /oauth/revoke`                    | Revoke a refresh token or access token         |
| `GET/POST /oauth/logout`                | End the shared Basis Auth SSO session          |
| `GET /health`                           | Build and database identity diagnostics        |

Internal listener endpoints, used only by trusted services:

| Endpoint | Use |
| --- | --- |
| `POST /internal/backchannel/validate` | Webhook challenge proof |
| `GET /internal/users/:userId` | Profile, `disabled`, and `tokensValidAfter` |
| `GET /internal/users/:userId/picture` | Profile picture bytes |
| `PATCH /internal/users/:userId` | User update; caller audience must be listed in `INTERNAL_USER_WRITE_RESOURCES_JSON` |
| `POST /internal/users/:userId/logout` | Deliver a logout token for the caller's own audience |
| `/internal/management`, `/internal/applications`, `/internal/resources` | Management routes; require portal resource credential and actor token |

## 4. Token contract

| Artifact | Behavior |
| --- | --- |
| Authorization request | Expires after 10 minutes; requires `openid`, state, nonce, and S256 PKCE |
| Authorization code | Single-use, opaque, 60-second lifetime |
| ID token | RS256 JWT, audience is the client ID, 10-minute lifetime |
| User access token | RS256 JWT, `typ=at+jwt`, audience is one resource, default 60 minutes (`ACCESS_TOKEN_LIFETIME_MS`) |
| Refresh token | Opaque, rotates on every use, expires 30 days after original issue, only with `offline_access` |
| Client-credentials token | Confidential clients only; no user identity, permissions, ID token, or refresh token |

A user access token contains `sub`, `client_id`, `scope`, `permissions`, `gty`, `jti`, `iat`, `exp`, `iss`, and `aud`. `permissions` is always a string array. It is not an OAuth scope and must not be requested as one.

When the resource has no valid saved backchannel URL, the access-token lifetime is the lesser of `ACCESS_TOKEN_LIFETIME_MS` and 10 minutes. This applies to code exchange, refresh, and client credentials. Use the token response `expires_in` or the JWT `exp` to determine expiry. Adding or clearing URLs affects newly issued tokens. Previously issued tokens keep their signed expiry.

The stable user key is the Basis Auth `sub`. Email is profile data and can change. Do not use email as a durable foreign key across the nethack database.

## 5. Environment variable schema

| Variable | Required | Format | Purpose and validation |
| --- | --- | --- | --- |
| `BASIS_AUTH_ISSUER` | Yes | Absolute HTTPS URL; plain HTTP only for loopback development | Exact issuer. Must equal the discovery `issuer` and the token `iss` |
| `BASIS_AUTH_CLIENT_ID` | Yes | Registered client identifier | Identifies the confidential client; must match the registration and ID token audience |
| `BASIS_AUTH_CLIENT_SECRET` | Yes for the confidential client | Secret string from the operator | Server-side only; never sent to the browser; used with HTTP Basic for code and refresh grants |
| `BASIS_AUTH_RESOURCE` | Yes | Registered resource audience, for example `devconnect://nethack.bisz.dev` as a starting reference | Sent as `resource` in the authorization request and required as the access-token audience |
| `BASIS_AUTH_RESOURCE_SECRET` | Yes when using backchannel or internal API | Secret string from the operator; shown once | Signs the webhook challenge and authenticates internal API calls |
| `BASIS_AUTH_INTERNAL_URL` | Only when calling the internal API | Absolute loopback or private URL | Base URL for the internal listener; never expose it publicly |
| `BASIS_AUTH_REDIRECT_URI` | Yes | Absolute HTTPS URL; plain HTTP only for loopback development | Exact registered callback URI; must not be derived from request headers or contain a fragment |

Rules:

- Validate every variable at startup and fail to start when a required value is missing or malformed.
- Use separate values for development, staging, and production. Never reuse a client, secret, redirect URI, or resource across environments.
- Store secrets in the deployment secret store. Do not commit them, put them in images, print them in logs, or expose them to the public site.
- Do not send a body client secret for authorization-code or refresh grants. Use HTTP Basic for the confidential client.
- Public clients have no secret. nethack must use a confidential client.
- The provider stores only a scrypt hash of the client secret and shows the value once. Losing the value requires a rotation.
- Keep the internal listener on loopback or a protected private network. Treat the resource secret as a credential.

## 6. Registration references for nethack

`FULL_PLAN.md` section 10.2 gives the following as starting references, not production values:

```text
resource audience: devconnect://nethack.bisz.dev
application scope: nethack.access
```

Confirm the final values with the Basis Auth operator before production. Register a dedicated confidential client with:

- Exact redirect URI, for example `https://api.nethack.example/auth/callback`.
- Resource audience and allowed scopes.
- Permission definitions and first-login defaults.
- Backchannel logout and revocation receiver, for example `https://api.nethack.example/auth/backchannel`.
- Allowed Microsoft organizations and account filters.
- Consent requirements.

The authorization request starts with:

```text
scope=openid profile email offline_access nethack.access
resource=devconnect://nethack.bisz.dev
```

Use `offline_access` because nethack needs refresh tokens. Request the smallest scope set that the application actually uses. The permission catalog is separate from the scope list and must be confirmed with the operator. The guide's examples such as `nethack.Projects.read` and `nethack.Projects.all` illustrate exact and namespace grants; they are not a substitute for the registered catalog.

Backchannel URLs must use HTTPS or `http://localhost`, with no credentials or fragment. A resource may register multiple valid URLs. Every configured URL receives logout and access-token revocation events and is verified separately.

Resource secrets: every registered resource has one. Existing resources created before the secret migration temporarily use `sk-1`; rotate them immediately with the operator procedure. A new resource secret is shown once. Store it only in the secret store and distribute it to every caller before retiring the old value.

## 7. Login and callback flow

1. The browser initiates login through the Fastify API.
2. Generate independent random `state`, `nonce`, and a PKCE verifier.
3. Persist the short-lived authentication transaction server-side. It expires after 10 minutes.
4. Fetch discovery and JWKS. Cache them for about five minutes.
5. Redirect to `/oauth/authorize` with `response_type=code`, `code_challenge_method=S256`, the exact redirect URI, one resource, and the required scopes.
6. Basis Auth delegates human login to Microsoft Entra ID.
7. On callback, validate state and the browser transaction binding before doing anything else.
8. Exchange the code server-to-server within 60 seconds using HTTP Basic for the confidential client and the original verifier.
9. Validate the ID token: RS256, exact issuer, audience equal to the client ID, expiry, nonce, and `at_hash`.
10. Create the nethack application session. Never reuse the Basis Auth cookie.
11. Store encrypted tokens server-side. Never send them to the browser.
12. Redirect to the validated workspace return path.

Handle `error=access_denied` as a cancellation. Do not retry automatically. Treat `invalid_grant` on code exchange as a failed login and restart the flow.

## 8. Refresh rotation

- Refresh before expiry, leaving room for clock skew and retries.
- Use the same client authentication, `grant_type=refresh_token`, and the current refresh token.
- Each success returns a new refresh token and consumes the old one. Persist it before another request can use the session.
- Serialize refresh per session with a database row lock. Never let two concurrent requests consume the same token.
- Reuse of a consumed or expired token revokes the whole session family. Treat `invalid_grant` as "clear refresh state and require a new sign-in".
- Refresh uses the resource's current backchannel configuration to determine the new access token lifetime. Schedule the next refresh from the new `expires_in`.
- On a timeout or provider `5xx`, do not blindly retry with the old token. The result is ambiguous. Re-read the session and retry only under the bounded procedure in `docs/security/authentication.md`.

## 9. Scopes and permissions

| Concept | Meaning | Where granted |
| --- | --- | --- |
| OAuth scope | API capability; appears in `scope` | Resource definition and client `resourceScopes` |
| Permission | App-scoped user entitlement; appears in `permissions` | Client permission catalog and user grants |
| Identity scope | `openid`, `profile`, `email`, `offline_access` | Always available |

Rules:

- Request the smallest scope set the app uses.
- A permission is not an OAuth scope. Never request a permission as a scope.
- A permission grant belongs to one client. Another client does not inherit it.
- An exact grant such as `nethack.Projects.read` covers that permission. A stored `nethack.Projects.all` covers every current and future permission below that namespace.
- Removing a definition does not bulk-edit users. Stale grants are pruned on the user's next login.
- Access tokens are not rewritten when a grant changes. Fetch a new token or wait for refresh or expiry.
- External permissions may complement nethack authorization. They never replace organization-specific resource checks.
- `BOOTSTRAP_PERMISSION_GRANTS_JSON` is an operator seeding mechanism, not an application runtime API.

## 10. Backchannel behavior

Register one receiver endpoint that handles three event types:

1. `action=test` webhook verification.
2. `logout_token` user logout.
3. `action=revoke_access_token` access-token revocation.

A resource may register multiple URLs. Every configured URL receives logout and access-token revocation events, and each URL is verified separately. Without a valid saved URL, the API receives neither event and can continue accepting a signed token until it expires. The resource registration CLI reports the 10-minute cap when registering a resource without callbacks or clearing its callbacks.

### 10.1 Test challenge

When each URL is saved, Basis Auth posts form-encoded `action=test`, a one-time `nonce` (43-character base64url), and a `challenge` (43-character base64url).

1. Return `202 Accepted` immediately.
2. Compute `challenge_hash` = HMAC-SHA256 with the current resource secret as key and the challenge as message, hex-encoded (64 characters).
3. Send the proof to the internal API within 10 seconds:

```js
import { createHmac } from "node:crypto";

const challengeHash = createHmac("sha256", resourceSecret).update(challenge, "utf8").digest("hex");

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

| Response                      | Meaning                                                    |
| ----------------------------- | ---------------------------------------------------------- |
| `200 {"status":"successful"}` | Accepted and consumed                                      |
| `400 invalid_request`         | Bad input, wrong audience, unknown or used nonce, bad hash |
| `401 unauthorized`            | Resource credentials missing or invalid                    |
| `408 timeout`                 | Challenge expired; save the URL again                      |

The previous URL list stays active if verification fails. Clearing the list takes effect immediately.

### 10.2 Logout token

Verify against `/oauth/jwks` and require:

- `alg=RS256`.
- `typ=logout+jwt`.
- Exact issuer.
- The nethack resource audience.
- Valid expiry. Logout tokens live two minutes.
- `sub`.
- The `http://schemas.openid.net/event/backchannel-logout` event.

End the matching local sessions and return `200` or `204`.

### 10.3 Access-token revocation

The form contains:

```text
action=revoke_access_token
jti=<token-id>
valid_after=<unix-seconds>
revocation_token=<signed-jwt>
```

Verify `revocation_token` with `/oauth/jwks` and require:

- `alg=RS256`.
- `typ=at-revocation+jwt`.
- Exact issuer.
- The nethack resource audience.
- Valid expiry. Revocation tokens live two minutes.
- `access_token_jti` and `valid_after` match the form fields.

Store the JTI in a denylist and reject matching access JWTs at or after `valid_after`. Use the signed `access_token_expires_at` claim when present to expire the entry, and allow for verifier clock tolerance. Delivery can retry, so keep the earliest valid-after time per JTI. Return `200` or `204` after persisting. The Basis Auth service setting `ACCESS_TOKEN_REVOCATION_GRACE_SECONDS` defaults to `0` and bounds how far ahead `valid_after` may be; do not silently accept a value beyond the documented grace.

### 10.4 Immediate user revocation

`GET /internal/users/:userId` returns profile plus `disabled` and `tokensValidAfter`. Reject disabled users. Reject tokens whose `iat` is at or before the `tokensValidAfter` barrier. Cache the result only for a short, bounded time and fail closed on provider error. This is the `tokens_valid_after` mechanism. It does not replace local organization authorization.

## 11. Internal API authentication

Every internal request authenticates as a resource:

```http
Authorization: Bearer <resource-secret>
X-Basis-Resource: <URL-encoded resource audience>
```

Management routes under `/internal/management`, `/internal/applications`, and `/internal/resources` also require the portal resource credential and a user access token:

```http
X-Basis-Actor-Token: Bearer <user-access-token>
```

Rules:

- Keep the internal listener on loopback or a protected private network.
- Never expose the internal listener through the public proxy.
- Treat the resource secret as a credential. Rotate it according to `SETUP_GUIDE.md` section 10.5.
- Do not reuse a resource secret across resources or environments.
- `PATCH /internal/users/:userId` requires the caller's audience to be listed in `INTERNAL_USER_WRITE_RESOURCES_JSON`.

## 12. Error codes

| Code | Meaning | Fix |
| --- | --- | --- |
| `14001` | Client not registered | Check the client ID and environment |
| `14002` | Client disabled | Ask the operator to re-enable it |
| `14003` | Public client sent a secret | Use PKCE and no secret |
| `14004` | Confidential secret invalid or missing | Use HTTP Basic and the current secret |
| `14005` | Client has no organizations | Link an organization |
| `14100` | Redirect URI missing or unregistered | Compare character for character |
| `14401` | Scope not allowed | Align resource scopes, client scopes, and request |
| `14407` | Resource not registered | Register the audience |
| `14429` | Unsupported response type | Send `response_type=code` |
| `14501` | Resource not registered for this client | Add the audience to the client |
| `2400` | Interaction missing or expired | Restart authorization |

Other common failures:

- `invalid_grant` on code exchange: code expired, was consumed, or the verifier is wrong. Restart the flow.
- `invalid_grant` on refresh: the token was already rotated or the session was revoked. Clear state and require sign-in.
- `401 invalid_token` at the API: wrong audience, wrong issuer, expired, revoked, malformed, or not `typ=at+jwt`. Log the reason server-side only.
- `403 insufficient_scope` or `insufficient_permissions`: the token is valid but lacks the required grant. Fix registration or user grants.
- Webhook verification fails: challenge hash, secret, audience, nonce, or the 10-second window is wrong. Save the URL again for a fresh nonce.
- Logout returns `409`: the resource has no stored callback. Register and verify one.
- Logout returns `502`: the receiver was unreachable or did not return `200` or `204`.
- Microsoft login errors (`5004xx`): upstream Entra failures mapped by the provider. Check the documented Microsoft error tables in the Basis Auth repository before changing integration code.

## 13. Account linking

- Link local accounts only by `(issuer, subject)`.
- Store `issuer`, `subject`, and the linked local user identifier in a unique record.
- Email, display name, and avatar are profile data. They may change and are not durable identity keys.
- Never silently link an existing local account by matching email.
- If an email matches but the external identity is not linked, require an explicit authenticated linking flow and audit it.
- If the same `(issuer, subject)` is linked to a different local user, fail closed and require operator review.
- Reject login for a disabled local user and do not create a session.
- Audit linking, unlinking, collision, and disabled-account outcomes.

## 14. Verification checklist

Run against the target issuer before declaring the integration complete. Every item is release-blocking until it has been executed and recorded. Use staging first, then production.

- [ ] Discovery and JWKS are reachable from the app and API networks.
- [ ] Login completes with `openid`, state, nonce, and PKCE.
- [ ] Callback rejects mismatched state and an invalid verifier.
- [ ] Code exchange succeeds once; a reused code fails with `invalid_grant`.
- [ ] ID token validates issuer, audience, signature, expiry, nonce, and hash.
- [ ] App creates its own session; no `basis_sso` sharing.
- [ ] API accepts a valid token for the exact resource audience.
- [ ] API rejects a token with the wrong audience, missing scope, or missing permission.
- [ ] API returns the standard `401 invalid_token` response for revoked, expired, and malformed tokens.
- [ ] For a resource without a backchannel URL, sign-in succeeds and each applicable grant returns `expires_in` equal to the JWT's `exp - iat`, at most 600 seconds.

For resources with a backchannel receiver:

- [ ] Backchannel `action=test` verification succeeds and saves the URL.
- [ ] Logout ends the app session and terminates the matching user's API sessions through `logout_token`.
- [ ] A revoked access token is denied after the delivered revocation event.

For all resources:

- [ ] Refresh rotates the token and a reused token forces re-authentication.
- [ ] Disabled users cannot sign in and existing tokens are rejected as configured.
- [ ] Unregistered resources, scopes, and redirect URIs fail closed with the documented codes.
- [ ] Sign-in failures show recovery guidance. Technical details are available in the browser's developer console.
- [ ] After a scope-table upgrade, existing registered scopes can still be requested for their original audiences.
- [ ] A resource editor can set, change, and clear an Entra scope mapping and read back the saved value.

## 15. Updating the integration when Basis Auth changes

An update is a contract review, not a dependency bump. The issuer URL may stay the same while claims, lifetimes, revocation behavior, or registration rules change.

### 15.1 Detect contract changes

Review the diff since the integration was last verified:

```bash
git log --oneline <last-verified-commit>..origin/main
git diff <last-verified-commit>..origin/main -- README.md examples/ src/config.ts src/oauth/ src/internal/
```

Focus on:

- Endpoints and discovery metadata.
- Token claims, `typ` values, lifetimes, and JWT algorithms.
- Authorization requirements: PKCE, nonce, resource, scopes.
- Refresh rotation and revocation behavior.
- Backchannel logout and revocation event formats.
- Client and resource registration fields and defaults.
- Error codes and rejection responses.
- New required resource configuration such as webhook URLs.

Also compare against the live issuer, because it may run ahead of the local code:

```bash
curl -s https://auth.example.org/.well-known/openid-configuration
curl -s https://auth.example.org/oauth/jwks
```

### 15.2 Contract review checklist

- [ ] Client ID, client secret, and redirect URIs still match the environment.
- [ ] Resource audience and scopes are still registered and allowed.
- [ ] Permission catalog, defaults, and grants are still valid.
- [ ] Access and ID token validation still checks issuer, audience, algorithm, `typ`, expiry, nonce, and `at_hash`.
- [ ] Access-token lifetime assumptions (caches, refresh thresholds, clock skew) still hold.
- [ ] Standard `invalid_token` response is unchanged.
- [ ] Backchannel receiver still verifies `logout_token` and `revocation_token` with the current JWKS and types.
- [ ] Access-token denylist is still keyed by `jti` and honors `valid_after`.
- [ ] Every resource webhook URL is still verified and reachable from Basis Auth.
- [ ] Internal API callers still send `X-Basis-Resource` and the current secret.
- [ ] Management callers still send a valid actor token in `X-Basis-Actor-Token`.
- [ ] Local account linking still uses `sub`, never email.

### 15.3 Apply the update

1. Update application configuration and secrets first, then deploy code that accepts both old and new behavior when the contract changes.
2. If token validation changed, deploy API changes before the issuer starts issuing the new format.
3. If token lifetimes changed, adjust refresh thresholds and cache TTLs.
4. If revocation or logout changed, deploy the receiver before enabling the feature for the resource.
5. Re-run the section 14 checklist in staging, then production.
6. Keep the previous application version deployable until a full login, refresh, logout, and revocation cycle passes.

### 15.4 Secret rotation

- Client secret: follow `SETUP_GUIDE.md` section 10.4 and `docs/security/incident-response.md` section 7.1. The old secret is invalid immediately unless the operator keeps both, so expect a brief auth outage if there is no overlap.
- Resource secret: follow `SETUP_GUIDE.md` section 10.5 and `docs/security/incident-response.md` section 7.2. Update the backchannel receiver and internal API callers first, verify webhook re-verification and internal calls, then retire the old value.
- If the client ID changes, update the app, backchannel receiver, bootstrap grants, and every `applicationId` reference. Remove the old client ID from seed configuration so a restart does not recreate it.

### 15.5 Roll back

Keep the previous application deployment and both old and new credentials available during the change window when the provider supports overlap. If validation fails:

1. Route new logins back to the previous application version.
2. Stop accepting the new token shape at the API.
3. Do not translate or re-sign tokens between versions.
4. Restore the previous client or resource configuration with the operator.
5. Re-run the checklist after the rollback.

## 16. Operational notes

- Bound discovery, JWKS, token, userinfo, and internal API calls with timeouts and response-size limits.
- Do not retry token exchange blindly. Code exchange is single-use and refresh is rotating. Use the bounded procedures in `docs/security/authentication.md`.
- Monitor discovery age, JWKS age, login success and failure codes, refresh latency and failures, backchannel delivery, denylist size, and `401`/`403` rates.
- Never log tokens, codes, secrets, verifiers, raw cookies, or token-endpoint payloads.
- Keep the internal listener private. Do not proxy it through the public edge.
- Keep `SETUP_GUIDE.md` authoritative. When endpoints, claims, `typ` values, lifetimes, revocation, backchannel behavior, scopes, permissions, registration, internal API authentication, error codes, or the example integration change, update the guide and this document in the same change.
