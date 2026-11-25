# ADR-008: Tenant cache isolation

Decision record for preventing cross-organization and cross-user cache disclosure.

## Status

accepted.

## Context

Nethack serves multiple organizations from one application and one database. Personalized and organization-scoped responses are easy to cache accidentally in a browser, a reverse proxy, a framework cache, or a shared application cache. A missing tenant dimension in a cache key can disclose one organization's data to another. Next.js shared caching and experimental cache components add another surface that must not hold private data.

## Decision

- Authenticated API responses use `Cache-Control: private, no-store`.
- The workspace does not persist private API responses in a shared cache or browser storage.
- The public site caches public content only. Public cache keys contain no user or organization scope because the content is genuinely public.
- Next.js Cache Components and experimental shared caching are disabled initially for sensitive data.
- No shared private cache is introduced without an ADR, an explicit tenant-aware key, and cross-organization tests.
- Any private cache key includes the organization identifier and, where the value is user-specific, the user identifier. A cache entry is invalidated on membership change, role change, resource ownership change, and sign-out.
- Caches are bounded, have explicit time-to-live values, and fail closed on a missing scope.
- The asset origin is cookieless and serves only content authorized by a short-lived scoped grant.
- Cache purging is an operational action with auditability. A purge never serves stale private data as a fallback.
- Public content invalidation is explicit when a competition, project, result, or announcement is published or withdrawn.

## Consequences

- Some performance optimizations are intentionally unavailable for authenticated pages.
- The default safe behavior is no caching, which is slower but cannot leak across tenants.
- Introducing a private cache requires design, tests, and an ADR rather than a configuration flag.
- Public caching remains available for the public site and public API reads.
- Cache keys, invalidation, and sign-out behavior are part of security review.
