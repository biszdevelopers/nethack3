# ADR-001: Capability architecture

Decision record for the single-Core, statically registered capability model.

## Status

accepted.

## Context

Nethack must expand across organizations, competition series, divisions, judging models, and voting systems without repeating the maintenance problems of the previous platform. The architecture must be understandable to new developers, independently testable, and extractable later without rewriting domain behavior. It must not become a general-purpose framework or a premature microservice system.

## Decision

Every feature is a capability under `apps/api/src/capabilities/<name>`, with a browser counterpart under `apps/workspace/src/capabilities/<name>` where the feature has a UI.

There is one Core at `apps/api/src/core` that owns only registry, static composition, dependency validation, lifecycle, configuration, contract registration, common authorization context, events, logging, errors, and health.

Capabilities are registered explicitly in `apps/api/src/capabilities/index.ts`. There is no runtime directory scanning, dynamic code loading, service locator, or extension marketplace.

Capabilities integrate through exactly three mechanisms:

1. Public contracts for synchronous operations that need a result.
2. Domain events for facts other capabilities react to.
3. Infrastructure interfaces for shared technical services.

Capability dependencies form a directed acyclic graph, validated at startup and resolved with topological ordering in O(V+E) time and space. Capabilities own their domain rules, application operations, persistence, tests, permissions, and events. Private cross-capability imports and cross-capability table access are forbidden.

Reliable events use a PostgreSQL transactional outbox. No message broker or service-per-capability deployment is introduced before measured need.

## Consequences

- New features have a predictable home and cannot silently depend on unrelated internals.
- The Core stays small and contains no competition-specific behavior.
- Cross-capability workflows require explicit contracts or events, which adds deliberate design work.
- A capability can move to `packages/capability-<name>` or a separate service without rewriting its domain layer.
- Architecture tests must enforce folder shape, import boundaries, dependency declarations, and table ownership.
- Distributed transactions are avoided by keeping capabilities in one process until extraction is justified.
