# Build system

Workspace layout, build order, incremental builds, and root commands for the nethack3 monorepo.

## Tooling

| Application or package | Build system             |
| ---------------------- | ------------------------ |
| Public site            | Next.js with Turbopack   |
| Workspace              | Vite                     |
| API                    | TypeScript compiler      |
| Shared UI              | TypeScript project build |
| Contracts              | TypeScript project build |
| API client             | TypeScript project build |

The repository uses Bun workspaces declared in the root `package.json` with `apps/*` and `packages/*`. `bun.lock` is the only lockfile and is committed. There is no pnpm, npm, or Yarn lockfile.

No Nx. No Turborepo. No custom build framework. Introduce a build orchestrator only when measured build-graph complexity justifies it, and record that decision in an ADR.

## Build order

```
1. Validate configuration
2. Typecheck shared contracts
3. Build shared UI
4. Build API
5. Build workspace
6. Build public site
7. Assemble deployment artifacts
8. Run deployment smoke tests
```

Dependencies flow in that order: applications consume `packages/contracts`, `packages/ui`, and `packages/api-client`; packages do not consume applications.

Parallelize independent tasks only within a measured memory budget. Do not run every application build at once on a memory-constrained machine.

## Build-time rules

- Do not bundle unnecessary packages.
- Do not compile unrelated applications when only one changes.
- Do not introduce enormous generated files.
- Avoid giant barrel imports that pull an entire package into a bundle.
- Avoid unnecessary code generation.
- Use incremental TypeScript builds with project references or equivalent explicit configuration.
- Cache dependency installation in CI.
- Cache Next.js build artifacts and framework caches.
- Avoid build-time database access.
- Do not statically generate every project in the database.
- Do not perform external network calls during ordinary compilation.
- Do not require Basis Auth, PostgreSQL, or a mail service to compile the repository.
- Avoid multiple heavyweight build systems.
- Do not run formatters, linters, migration generators, or seed scripts as part of `build`.
- Do not weaken type checking or skip a package to make a build finish.

Runtime configuration is validated at process start, not embedded at build time. Builds must be reproducible from source and the committed lockfile.

## Next.js

- `apps/site` uses the App Router and Turbopack.
- Public content uses Server Components, static rendering, SSR where request-dependent, ISR where appropriate, Suspense, and streaming.
- The build must not query the application database.
- Public pages that need live data render at request time or use statically committed content. The Next.js build performs no external network or database access for application data.
- `next.config.ts` contains only configuration justified by a requirement. No private credentials and no server-only runtime behavior.
- SVG optimization is disabled for untrusted content.
- Do not introduce a custom Next.js server unless a documented requirement makes it necessary.
- Do not enable experimental caching for authenticated or organization-specific data.

## Workspace

- `apps/workspace` is a static React application built with Vite.
- Route modules are lazy-loaded.
- The build output contains no server secrets, database credentials, or private tokens.
- The application communicates with the API through `packages/api-client`.
- The workspace build must not import from `apps/api` or any server-only module.

## API

- `apps/api` builds with the TypeScript compiler to JavaScript.
- `main.ts` is the process entry point.
- Workers use the same application code and build output, started with a different entry point or mode.
- Migrations are a separate build or task, never an automatic destructive step on API startup.
- The API build does not require a live database, Basis Auth, or network access.

## Shared packages

- `packages/contracts` builds first because both the API and frontends consume its types and schemas.
- `packages/ui` builds before applications that consume it.
- `packages/api-client` builds before the workspace and site.
- Package builds expose typed entry points; consumers import from the package entry, not source internals.
- Packages do not build applications.
- Do not add a package for a single helper or a small abstraction. The shared package set is `ui`, `contracts`, and `api-client`.

## Root scripts

The root scripts are conventions; each workspace package owns its actual scripts.

| Command                   | Behavior                                                          |
| ------------------------- | ----------------------------------------------------------------- |
| `bun run dev`             | Start required development processes and terminate them cleanly   |
| `bun run dev:site`        | Start the public site                                             |
| `bun run dev:workspace`   | Start the workspace                                               |
| `bun run dev:api`         | Start the API                                                     |
| `bun run dev:node`        | Start development under Node.js                                   |
| `bun run build`           | Build contracts, UI, API, workspace, and site in dependency order |
| `bun run build:contracts` | Build `packages/contracts`                                        |
| `bun run build:ui`        | Build `packages/ui`                                               |
| `bun run build:api`       | Build `apps/api`                                                  |
| `bun run build:workspace` | Build `apps/workspace`                                            |
| `bun run build:site`      | Build `apps/site`                                                 |
| `bun run typecheck`       | Typecheck every workspace in dependency order                     |
| `bun run lint`            | Run Oxlint over the repository                                    |
| `bun run format`          | Run Oxfmt over the repository                                     |
| `bun run format:check`    | Verify formatting without writing                                 |
| `bun run check`           | Format check, lint, typecheck, and test                           |
| `bun run verify:runtime`  | Verify Node.js and Bun runtime behavior                           |
| `bun run db:generate`     | Generate Drizzle migrations                                       |
| `bun run db:migrate`      | Apply migrations with migration credentials                       |
| `bun run db:seed`         | Seed development data                                             |

The root development command starts only the processes required for the selected task.

## Runtime-specific commands

Each application exposes explicit Node.js and Bun commands.

For Next.js in `apps/site`:

```json
{
    "scripts": {
        "dev:node": "node ./node_modules/next/dist/bin/next dev",
        "dev:bun": "bun --bun next dev",
        "build:node": "node ./node_modules/next/dist/bin/next build",
        "build:bun": "bun --bun next build",
        "start:node": "node ./node_modules/next/dist/bin/next start",
        "start:bun": "bun --bun next start"
    }
}
```

For Fastify in `apps/api`:

```json
{
    "scripts": {
        "build": "tsc -p tsconfig.build.json",
        "start:node": "node dist/main.js",
        "start:bun": "bun dist/main.js"
    }
}
```

Deployment scripts are tested against the generated Next.js artifacts and the chosen adapter. Do not assume that a development command proves production behavior.

## CI

- Install with `bun install --frozen-lockfile`.
- Cache Bun's install cache and build artifacts keyed by lockfile and source inputs.
- Run `bun run format:check`, `bun run lint`, and `bun run typecheck`.
- Run unit, integration, architecture, security, and end-to-end suites.
- Build both runtime targets where the change affects server behavior.
- Verify Node.js and Bun production starts.
- Generate an SBOM and run dependency and secret scanning.
- Fail the build on a known exploitable critical or high-severity vulnerability.
- Do not cache secrets or authenticated artifacts in shared caches.
- Do not allow a build to fetch from an unapproved host.

## Deployment artifacts

- Produce separate artifacts for the site, workspace, and API.
- The workspace is static files; the site uses a Node production build or the official Bun adapter.
- The API artifact contains compiled JavaScript and no development dependencies.
- Deployment configuration lives under `deployment/node` and `deployment/bun` with the same environment-variable schema and equivalent behavior.
- Assemble artifacts only after contracts, UI, API, workspace, and site builds succeed.
- Run smoke tests against the assembled artifacts before promotion.
- Record the exact source revision, lockfile hash, runtime version, and build commands used for an artifact.
