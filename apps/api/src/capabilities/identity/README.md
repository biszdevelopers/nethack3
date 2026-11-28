# Identity capability

HTTP boundary for the signed-in account and the Basis Auth login/logout flow.

## Ownership

- Public login start, callback, logout, session, CSRF token, and profile routes under `/api/v1/auth`.
- Anonymous public profile read at `/api/v1/public/users/:userId`, limited to id, display name, avatar URL, optional validated profile theme, and creation time.
- Authenticated profile update at `PATCH /api/v1/me`, including add/remove of a PNG, JPEG, or WebP profile theme data URL up to 1 MB.
- Request schemas for login and callback parameters in `domain/identity-schemas.ts`.
- Route-level rate limits for login, callback, logout, and profile mutations.

## Dependencies

None. Identity is the HTTP adapter over the core authentication services in `apps/api/src/authentication`: `LoginService`, `SessionService`, `TokenService`, `BearerAuthenticator`, and `AuthGuard`. Profile themes live in `user_profile_themes`; the identity capability owns that table and its repository.

## Permissions

- Login and callback are public.
- The public profile read is anonymous, cached for 60 seconds, and returns 404 for an unknown user id. It never returns email, sessions, tokens, or memberships.
- Session, CSRF, profile, and logout routes require a valid session cookie or bearer token.
- Mutating routes require the CSRF header and an allowed Origin when cookie-authenticated.
- Profile theme uploads are re-validated server-side: only PNG, JPEG, or WebP data URLs whose file signature matches the declared type and whose decoded size is at most 1 MB are stored. SVG is rejected.

## Events

Identity emits no domain events. Session creation, refresh rotation, logout, and backchannel revocation are recorded by the authentication services.

## Tests

- `tests/identity-schemas.test.ts` covers request schema limits.
- `tests/profile-theme.test.ts` covers image type, signature, size, and public theme sanitization.
- `apps/api/tests/auth/*` covers login, callback state, PKCE, nonce, refresh rotation, logout, CSRF, session fixation behavior, backchannel callbacks, and organization isolation.
- `tests/e2e/01-sign-in.spec.ts`, `tests/e2e/07-logout.spec.ts`, and `tests/e2e/18-team-profile-parity.spec.ts` cover the browser flow and profile theme publishing.

## Extraction

Identity can be extracted with the core authentication module, the `user_profile_themes` table, and the `identity` capability entry in `capabilities/index.ts`. No other capability imports its private modules.
