# ADR-003: Basis Auth integration

Decision record for delegated authentication and local authorization.

## Status

accepted.

## Context

Nethack needs organization-aware identity without operating a password store or an Entra ID integration itself. Basis Auth is an OpenID Connect provider in front of Microsoft Entra ID. It establishes who authenticated; it does not know nethack's organizations, competition roles, team memberships, judging assignments, or administrative privileges.

Basis Auth documentation requires downstream applications to own their browser sessions and not share the `basis_sso` cookie. Its OIDC surface is not presented as OpenID certified, so production requires conformance testing and focused security review.

## Decision

Basis Auth is the primary identity provider and is integrated as a separate service, never embedded.

- Fastify implements the OIDC Authorization Code flow with PKCE. The browser never receives the client secret, authorization code verifier, access token, refresh token, or ID token.
- The API generates state, nonce, and a PKCE verifier, persists a short-lived authentication transaction server-side, validates state on callback, exchanges the code server-to-server, and validates the ID token signature, issuer, audience, expiry, nonce, and hash.
- Nethack owns its application session with the `__Host-nethack_session` cookie.
- Tokens are stored server-side. Refresh tokens are encrypted at rest. Session identifiers are stored as SHA-256 hashes.
- Refresh rotation is serialized per session.
- Backchannel logout and access-token revocation are verified, idempotent, and applied to local sessions and token denylists.
- The durable identity reference is `(issuer, subject)`. Email is profile data and never a durable key.
- Account linking follows an explicit policy and never silently links by email.
- Basis Auth permissions may complement local authorization but never replace organization-specific resource checks.
- Development, staging, and production use separate client registrations, secrets, redirect URIs, and resource audiences.
- `SETUP_GUIDE.md` is the authoritative downstream integration contract and is updated in the same change as any integration-affecting behavior.

## Consequences

- Nethack does not store passwords or implement OIDC cryptography itself.
- Authentication availability depends on Basis Auth and Microsoft Entra ID.
- Authorization remains fully local and organization-aware.
- Token lifetimes are read from provider configuration and token responses, not hardcoded.
- Logout and revocation require backchannel endpoints and idempotent processing.
- Release includes OIDC conformance, redirect validation, PKCE, rotation, key management, callback security, account linking, and session revocation review.
