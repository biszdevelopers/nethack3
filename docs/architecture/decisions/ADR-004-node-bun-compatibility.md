# ADR-004: Node.js and Bun compatibility

Decision record for a Bun-first toolchain with equal Node.js production support.

## Status

accepted.

## Context

Bun is the preferred package manager, development toolchain, and runtime. Node.js remains the broadest production runtime and supports the full Next.js feature set. Supporting only one runtime would either slow development or exclude valid deployments. General compatibility claims are not sufficient evidence for a specific dependency combination.

## Decision

- Bun is the primary package manager and development runtime.
- Pin an exact stable Bun release.
- Node.js 24 or newer is an equally supported production runtime.
- Both use the same source tree, same application contracts, same environment-variable schema, and one committed `bun.lock`.
- There is no pnpm and no competing lockfile.
- Application logic uses standard TypeScript, ESM, Node-compatible APIs, and Web APIs.
- Bun-only interfaces such as `Bun.serve`, `Bun.file`, and `Bun.password` are forbidden in application modules. They may appear in build scripts or tests that explicitly verify Bun behavior.
- No hidden runtime detection, runtime-specific business logic, dual implementations, or runtime-specific database, authentication, or API behavior.
- Every significant server change passes dual-runtime CI: install, build, start the public server, start Fastify, run integration tests, and run end-to-end workflows under both runtimes.
- Production deployment provides `deployment/node` and `deployment/bun` targets with equivalent behavior.
- A dependency that fails under either runtime is replaced or fixed before release. Neither runtime is declared experimental.

## Consequences

- The team maintains two verified deployment paths.
- Dependency selection includes runtime compatibility as a review criterion.
- Native dependencies and module-loader assumptions are rejected early.
- Build and test time increases, but runtime regressions are caught before release.
- Runtime-specific optimization is not a goal; identical functional behavior is.
