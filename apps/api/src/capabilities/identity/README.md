# Identity capability

HTTP boundary for the signed-in account and the Basis Auth login/logout flow.

## Ownership

- Public login start, callback, logout, session, CSRF token, and profile routes under `/api/v1/auth`.
- Request schemas for login and callback parameters in `domain/identity-schemas.ts`.
- Route-level rate limits for login, callback, logout, and profile mutations.

## Dependencies

None. Identity is the HTTP adapter over the core authentication services in `apps/api/src/authentication`: `LoginService`, `SessionService`, `TokenService`, `BearerAuthenticator`, and `AuthGuard`. It owns no database tables and has no private persistence layer.

## Permissions

- Login and callback are public.
- Session, CSRF, profile, and logout routes require a valid session cookie or bearer token.
- Mutating routes require the CSRF header and an allowed Origin when cookie-authenticated.

## Events

Identity emits no domain events. Session creation, refresh rotation, logout, and backchannel revocation are recorded by the authentication services.

## Tests

- `tests/identity-schemas.test.ts` covers request schema limits.
- `apps/api/tests/auth/*` covers login, callback state, PKCE, nonce, refresh rotation, logout, CSRF, session fixation behavior, backchannel callbacks, and organization isolation.
- `tests/e2e/01-sign-in.spec.ts` and `tests/e2e/07-logout.spec.ts` cover the browser flow.

## Extraction

Identity can be extracted with the core authentication module and the `identity` capability entry in `capabilities/index.ts`. No other capability imports its private modules.
