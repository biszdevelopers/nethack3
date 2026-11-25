# Core

Responsibilities, composition, lifecycle, contracts, events, and dependency validation for `apps/api/src/core`.

## Purpose

The Core is the only backbone of the API. It composes capabilities and provides shared technical plumbing. It contains no competition-specific business logic and no feature-specific rules.

## Responsibilities

The Core owns only:

- Capability registry.
- Static composition.
- Dependency validation.
- Initialization and shutdown.
- Configuration.
- Public contract registration.
- Common authorization context.
- Event dispatching.
- Logging.
- Error handling.
- Health reporting.

It does not own organizations, competitions, participants, teams, projects, submissions, judging, voting, announcements, notifications, administration, or file policy. Those belong to capabilities.

## Source layout

```
apps/api/src/core/
|-- application.ts          process composition and lifecycle
|-- capability-registry.ts  registration, validation, contract lookup
|-- dependency-resolver.ts  topological ordering and cycle detection
|-- event-dispatcher.ts     in-process dispatch and outbox coordination
`-- configuration.ts        typed environment configuration
```

The HTTP boundary lives in `apps/api/src/http`, authentication in `apps/api/src/authentication`, shared technical implementations in `apps/api/src/infrastructure`, and background processing in `apps/api/src/workers`.

## Capability definition

A capability exposes one definition from its `index.ts`.

```ts
interface CapabilityDefinition {
    readonly id: CapabilityId;
    readonly dependencies: readonly CapabilityId[];
    readonly contracts: readonly ContractRegistration[];
    readonly events: readonly EventName[];
    register(context: CapabilityContext): void | Promise<void>;
    start?(): void | Promise<void>;
    stop?(): void | Promise<void>;
}
```

Rules:

- `id` is unique, stable, and lowercase.
- `dependencies` lists direct dependencies only. Transitive dependencies are resolved by the Core.
- `contracts` declares every token the capability provides.
- `events` declares every event the capability publishes.
- `register` wires repositories, application operations, route handlers, and event consumers. It does not perform I/O against external services.
- `start` begins background work owned by the capability. It must be safe to call once.
- `stop` stops new work, drains in-flight work within a bound, and releases resources. It must be idempotent.
- A capability does not reach into another capability's context or fields.

`CapabilityContext` provides request-independent collaborators:

- Typed configuration.
- Logger.
- Clock.
- Database transaction runner.
- Event publisher.
- Public contract resolver.
- Identifier generator.

The context is created by the Core and passed explicitly. There is no global service locator and no module-level mutable registry.

## Configuration

`configuration.ts` defines a Zod schema for the environment and returns a typed configuration object.

- Validation happens once at process start.
- Missing required values, malformed URLs, invalid lifetimes, and unsafe defaults fail startup.
- Secrets have no development fallback in production.
- Configuration is read through the typed object, not through scattered `process.env` access.
- The same environment schema is used for Node.js and Bun, API and workers.
- Values that affect security, lifetimes, origins, or limits are validated and bounded.
- Configuration values are never logged in full. Secret fields are redacted.

## Dependency validation

`dependency-resolver.ts` resolves the capability graph before any capability starts.

Algorithm:

1. Build a `Map` from capability identifier to definition.
2. Reject duplicate identifiers.
3. Build an adjacency list of dependency edges and an indegree map.
4. Reject a dependency that is not registered.
5. Enqueue capabilities with indegree zero in static declaration order.
6. Process the queue, decrementing dependents' indegree and appending newly ready capabilities.
7. If the processed count is less than the capability count, report the remaining nodes as a cycle.
8. Return the topological order.

Complexity:

- Time: O(V+E), where V is the number of capabilities and E is the number of dependency edges.
- Auxiliary space: O(V+E) for the maps, adjacency list, indegree map, and queue.
- Worst case: a complete acyclic graph still visits each node and edge once. A cycle is detected without recursion, so deep graphs cannot overflow the call stack.
- Input-size assumption: V and E are small and bounded by the statically registered set. The algorithm remains linear if that set grows.

Determinism:

- Declaration order breaks ties for zero-indegree capabilities.
- Startup follows the returned order.
- Shutdown follows the reverse order.
- The same source produces the same order on every run and runtime.

Failure behavior:

- Duplicate identifier, missing dependency, cycle, duplicate contract token, or conflicting declaration prevents startup.
- The error names the offending capability and the conflicting identifier.
- No partial application is served after a composition failure.

## Lifecycle

```
1. Load and validate configuration
2. Construct infrastructure (pool, clock, logger, mail, storage)
3. Build the capability registry from the static list
4. Validate identifiers, dependencies, contracts, and declarations
5. Resolve topological order
6. Register capabilities in dependency order
7. Start capabilities in dependency order
8. Start HTTP server or worker loop
9. Report ready
10. On shutdown: stop accepting work
11. Drain in-flight requests and jobs within a bound
12. Stop capabilities in reverse order
13. Flush and close the outbox writer
14. Close infrastructure and database pool
15. Report stopped
```

Rules:

- Startup is all-or-nothing. If a capability fails to register or start, already-started capabilities stop in reverse order and the process exits non-zero.
- Shutdown is graceful and bounded. The process does not hang indefinitely on a stuck dependency.
- Signal handlers are installed once by `application.ts`, not by individual capabilities.
- Workers use the same composition with a worker entry point instead of an HTTP listener.
- Migrations are not run automatically on every API start.
- Readiness reflects database connectivity and required infrastructure, not merely that the process is alive.

## Public contracts

A public contract is the only synchronous interface a capability exposes to another capability.

- Contract types live in `packages/contracts` when they cross the API boundary or are shared with the browser.
- Server-only contracts live in the providing capability's `index.ts` and use explicit input and output types.
- Contract tokens are unique. The registry rejects duplicate registration.
- A contract returns domain results or typed errors, never database rows or Drizzle query builders.
- A contract does not expose another capability's internal entities.
- A contract documents its authorization expectations. The caller must still pass an authorization context; the provider verifies it.
- Contract calls run inside the caller's transaction only when the provider explicitly supports it. Otherwise the caller must accept a separate transaction and design for it.

Example: submissions asks files to authorize and record a file reference. Submissions does not read the files table.

## Authorization context

The Core defines the request-scoped context that capabilities receive after authentication.

```
AuthorizationContext
|-- actorUserId
|-- externalIssuer and externalSubject (when needed for linking)
|-- sessionIdHash
|-- requestId
|-- organizationId (when the route is organization-scoped)
`-- granted permissions for this request
```

Rules:

- The context is created by the authentication and HTTP layers after session validation.
- It is request-scoped and never stored globally.
- Client-supplied organization identifiers are untrusted until membership and resource ownership are verified.
- The Core carries the context; capabilities enforce their own permissions.
- Organization membership and role rules belong to the organizations capability, not to Core.
- A missing organization context on an organization-scoped operation fails closed.

## Events

`event-dispatcher.ts` provides in-process dispatch and coordinates the transactional outbox.

Event shape:

```ts
interface DomainEvent<TType extends EventName, TPayload> {
    readonly id: string;
    readonly type: TType;
    readonly occurredAt: string;
    readonly organizationId: string | null;
    readonly actorUserId: string | null;
    readonly payload: TPayload;
    readonly correlationId: string;
}
```

Rules:

- Events are named `<capability>.<past-tense-fact>`.
- The producer writes the event to the outbox in the same database transaction as the state change.
- The dispatcher delivers committed events to registered consumers.
- Delivery is at least once. Consumers are idempotent and deduplicate by event identifier.
- Consumer failures are recorded and retried with bounded backoff. They do not roll back the producer's transaction.
- A consumer failure does not prevent other consumers from receiving the event.
- Handler registration is explicit. There is no event-name wildcard that hides dependencies.
- Event payloads are validated before dispatch.
- Events do not carry secrets, tokens, passwords, or unrestricted personal data.
- No Kafka, RabbitMQ, or external broker until the outbox and PostgreSQL-backed queue are demonstrably insufficient.

## Infrastructure interfaces

Capabilities access shared technical services through narrow interfaces, never concrete clients.

| Interface       | Responsibility                                              |
| --------------- | ----------------------------------------------------------- |
| `Database`      | Transaction runner and scoped query access                   |
| `Clock`         | Current time, injectable for tests and deadline logic        |
| `Mailer`        | Outbound email delivery                                      |
| `FileStorage`   | Object storage operations behind file policy                 |
| `Logger`        | Structured, correlated logging                               |
| `IdGenerator`   | Stable identifier generation                                |

Implementations live in `apps/api/src/infrastructure`. A capability may use only the interfaces it declares. Domain code receives no database client, HTTP request, or framework object.

## Logging and errors

- Logging is structured and includes request or job correlation identifiers.
- Logs record safe identifiers and outcomes, never tokens, cookies, secrets, passwords, authorization codes, or raw file contents.
- Domain errors carry a stable code and a user-safe message.
- The HTTP layer maps error categories to status codes and the shared error response shape.
- Unexpected errors are logged with stack traces privately and returned as a generic internal failure.
- The Core does not catch and swallow errors to keep a capability running in an undefined state.

## Health

Health reporting distinguishes liveness from readiness.

- Liveness reports that the process is running and the event loop is responsive.
- Readiness reports configuration validity, database connectivity, and required infrastructure.
- Health output does not reveal credentials, connection strings, internal hostnames, or dependency versions to unauthenticated callers.
- A failed readiness check removes the instance from rotation; it does not attempt destructive recovery.

## Explicit non-goals

- Runtime directory scanning.
- Dynamic code loading or a plugin marketplace.
- A global service locator.
- Business logic in Core.
- A custom framework layered over Fastify.
- Distributed transactions between capabilities.
- Automatic destructive migrations on startup.

## Review checks

- Does the change belong in Core, or does it encode feature behavior?
- Is a capability registered statically with explicit dependencies?
- Is the graph still acyclic and deterministically ordered?
- Does integration use a public contract, event, or infrastructure interface?
- Is request context scoped correctly and never global?
- Are events transactional and consumers idempotent?
- Does startup fail closed on invalid composition?
- Does shutdown stop producers before closing infrastructure?
