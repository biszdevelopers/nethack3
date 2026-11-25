# Coding standards

Language, object design, file separation, naming, errors, comments, dependencies, and commits for nethack3.

## Language and paradigm

Nethack uses Java-flavored TypeScript with practical object-oriented programming. Code must be readable, explicit, and structured. It must avoid both functional-programming dogma and Java ceremony that adds no value.

Use:

- Classes for meaningful state and invariants.
- Encapsulation with private fields.
- Constructor injection for collaborators.
- Composition instead of inheritance.
- Explicit interfaces at architectural boundaries.
- Domain models that express business rules.
- Small application services with one operation each.
- Clear object ownership.
- Straightforward functions for calculations and transformations.

Avoid:

- Deep inheritance and giant base classes.
- Artificial factories and abstract factories with one implementation.
- Global service locators and singleton managers.
- An interface for every trivial function.
- Classes that only wrap one function.
- Getter and setter pairs with no behavior.
- Point-free programming, deep pipelines, excessive currying, monadic abstractions.
- Reducers for every state change and immutable-data frameworks used by habit.
- Higher-order wrappers that obscure a simple call.

A class is justified when it protects an invariant, owns state, or groups a cohesive operation. Otherwise use a function.

## File separation

| Extension | Contains                                                                                                                                              |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.tsx`    | Components, JSX, layout, visual composition, presentation state wiring, event-handler invocation                                                       |
| `.ts`     | Domain logic, application operations, algorithms, API communication, hooks without JSX, validation, state logic, persistence, infrastructure, workers |

A `.tsx` file must not become the home of an entire business workflow. A component prepares data for display, renders it, and forwards user intent. Calculations, validation, permission decisions, and persistence belong in `.ts` modules.

Hooks that contain no JSX live in `.ts` files. Hooks that return JSX are components and follow component naming.

## Naming

| Item                  | Convention       | Example                              |
| --------------------- | ---------------- | ------------------------------------ |
| Files                 | kebab-case       | `team-invitation-service.ts`         |
| Classes               | PascalCase       | `TeamInvitationService`              |
| Types                 | PascalCase       | `TeamMembership`                     |
| Interfaces            | PascalCase       | `TeamRepository`                     |
| Functions             | camelCase        | `createTeam`                         |
| Variables             | camelCase        | `activeMembership`                   |
| Components            | PascalCase       | `TeamMembers`                        |
| Database tables       | snake_case       | `team_invitations`                   |
| Database columns      | snake_case       | `organization_id`                    |
| Environment variables | UPPER_SNAKE_CASE | `BASIS_AUTH_CLIENT_ID`               |

Additional rules:

- Folders are kebab-case.
- Test files match the subject and end in `.test.ts` or `.test.tsx`.
- Boolean names read as predicates: `isLoading`, `canInvite`, `hasSubmitted`.
- Acronyms in identifiers keep normal word casing: `organizationId`, not `organizationID`; `BasisAuthClient`, not `BASISAUTHClient`.
- Names describe domain meaning. Avoid `data`, `item`, `manager`, `util`, `helper`, and `process` when a domain noun exists.
- Database identifiers use snake_case without quoted mixed-case names.

## Object-oriented rules

- Keep constructors free of I/O. Resolve dependencies before constructing the object.
- Inject collaborators through the constructor or an explicit context; never import a concrete database, mailer, clock, or storage client inside domain code.
- Depend on the narrowest interface the object needs.
- Make invalid states unrepresentable where practical: required constructor parameters, readonly fields, validated value objects.
- Expose behavior, not internal collections. Return copies or read-only views when callers must not mutate state.
- Keep application services thin: authorize, load, apply a domain rule, persist, emit, return.
- Domain objects decide business invariants. Route handlers and React components do not.
- Prefer a discriminated union over a class hierarchy for closed variants.
- Do not create a class solely to hold constants; use a module.

## Functions and modules

- One exported operation per application file where the file is named after the operation, such as `create-team.ts`.
- Functions do one thing and have a name that says what it does.
- Keep parameter lists small. Use an options object when a call would otherwise have more than three positional parameters of the same type.
- Avoid boolean flag parameters that switch behavior; provide two named functions or a typed options object.
- Avoid output parameters and mutable module-level state.
- Do not use exceptions for ordinary control flow.
- Avoid deep nesting. Extract a named step when a function needs more than three levels.
- Exported application and domain functions declare explicit return types. Local callbacks may rely on inference.
- Use `readonly` for data that must not change after construction.
- Prefer `Map` and `Set` for membership and lookup.

## Async and concurrency

- Use `async` and `await`; do not mix callback and promise styles.
- Every promise is awaited or intentionally handled. Floating promises are forbidden outside explicit background work.
- Use `Promise.all` only for independent operations. Do not parallelize operations that share a transaction or depend on ordering.
- Bound concurrency for bulk work. Do not launch an unbounded number of promises.
- Serialize operations that mutate the same session, ballot, submission, or other contended record.
- Rely on database constraints and transactions for correctness. Retries and delays must not conceal a race condition.
- Propagate cancellation where an operation can outlive its request.
- Never use an arbitrary timeout as a synchronization mechanism.

## Error handling

Use one error taxonomy across the API.

| Category                    | Meaning                                                      | HTTP status |
| --------------------------- | ------------------------------------------------------------ | ----------- |
| Validation                  | Input fails schema or domain validation                      | 400         |
| Authentication              | Missing, expired, revoked, or malformed credentials          | 401         |
| Authorization               | Authenticated but not permitted                              | 403         |
| Not found                   | Resource absent or not visible to this caller                | 404         |
| Conflict                    | State transition, uniqueness, deadline, or concurrency clash | 409         |
| Rate limited                | Request budget exhausted                                     | 429         |
| External dependency failure | Basis Auth, mail, storage, or another dependency failed      | 502 or 503  |
| Internal failure            | Unexpected defect                                            | 500         |

Rules:

- Throw typed application errors with a stable code, a user-safe message, and optional field details.
- Translate errors once at the HTTP boundary in `apps/api/src/http/errors`. Route handlers do not format errors individually.
- Never expose stack traces, database messages, internal file paths, SQL, tokens, cookies, secrets, or identity-provider internals to a client.
- Log diagnostic detail privately with a correlation ID, operation name, and safe identifiers.
- Fail closed on authorization, tenant context, signature verification, and configuration validation.
- Handle expected absence explicitly with `null` or a typed result; do not throw for a normal "not found" branch when the caller must branch on it.
- Do not catch an error only to log and rethrow it at every layer. Log where the error is handled.
- Do not use empty catch blocks.
- Clean up resources with `try/finally` or an explicit scope manager.
- External calls have timeouts, bounded retries with backoff only for transient failures, and no retry for validation or authorization failures.
- Idempotency is enforced for critical mutations such as submissions, votes, invitations, and payment-like external effects.

## Comments

Default to no comments. Add a comment only when the reason cannot be expressed by names, types, or structure.

Allowed comments:

- One line explaining a non-obvious invariant, workaround, security decision, or algorithmic bound.
- A documented public contract where a consumer needs behavior that types cannot express.
- A deferred-limit note in the form `shortcut: <limit>, <when to upgrade>`.

Forbidden comments:

- Narration of what the next line does.
- Commented-out code.
- Changelog comments and author tags.
- TODO comments without an owner and a concrete condition.
- JSDoc that repeats parameter names and types.
- Comments that contradict the code.

Nontrivial algorithms document time complexity, auxiliary space, worst case, amortized behavior, and input-size assumptions near the implementation and, where architectural, in `docs/architecture/core.md`.

## Validation

- Validate at every trust boundary with Zod schemas from `packages/contracts`.
- Treat external data as `unknown` until parsed.
- Validate request bodies, query parameters, route parameters, headers used for decisions, file metadata, identity-provider responses, configuration, and external API responses.
- Use Fastify schema validation and response serialization. Response schemas prevent accidental disclosure of internal fields.
- Do not execute database queries inside schema validation.
- Domain invariants are checked in domain code after syntactic validation. Schema validation does not replace business rules.
- Reject unknown fields where silent acceptance would hide a client error or security issue.
- Normalize and bound strings, arrays, pagination limits, and numeric ranges before use.

## Dependencies

1. Resolve initial versions with `@latest`, then verify compatibility.
2. Remove dependencies that are not used.
3. Pin exact versions in production.
4. Commit `bun.lock`; CI installs with `bun install --frozen-lockfile`.
5. Never add a dependency for a few lines of code that the platform or an existing package already provides.
6. Never add a second library for a problem already solved in the repository: one router (React Router 7), one form layer (React Hook Form with Zod), one table layer (TanStack Table), one primitive foundation (Radix UI), one styling system (Tailwind CSS 4 with Tailwind Variants).
7. Review transitive changes and test upgrades.
8. Patch security vulnerabilities immediately.
9. Never leave production dependencies floating on `latest`.
10. A new runtime dependency requires a sentence in the change description explaining what it replaces or why existing code is insufficient.
11. No native dependency that fails under either supported runtime.
12. Do not monkey-patch a dependency.

## Formatting and linting

- Oxfmt is the only formatter and uses `.oxfmtrc.json`.
- Oxlint is the only linter and uses `.oxlintrc.json`.
- Do not add ESLint, Prettier, or a competing formatter.
- Run `bun run format` and `bun run lint` before review.
- Do not reformat unrelated files in the same change.
- Generated files are excluded from formatting and review noise.

## Commit conventions

Use Conventional Commits in American English.

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:

| Type       | Use                                                  |
| ---------- | ---------------------------------------------------- |
| `feat`     | New user-visible or API behavior                     |
| `fix`      | Defect correction                                    |
| `docs`     | Documentation only                                   |
| `refactor` | Behavior-preserving restructuring                    |
| `test`     | Tests or fixtures only                               |
| `perf`     | Measured performance improvement                     |
| `build`    | Build system, dependencies, or packaging             |
| `ci`       | Continuous integration configuration                 |
| `chore`    | Maintenance with no product behavior change          |
| `security` | Security hardening or vulnerability remediation      |

Rules:

- Subject is imperative, lowercase after the colon, and at most 72 characters.
- Scope is a capability, package, or application: `teams`, `ui`, `api`, `site`, `workspace`, `contracts`, `build`.
- Body explains why, not what the diff already shows.
- Reference the requirement or issue identifier when one exists.
- Breaking changes use a `!` after the type or scope and a `BREAKING CHANGE:` footer.
- No emojis, no decorative prefixes, no all-caps subjects.
- One logical change per commit. Do not mix refactoring with behavior changes unless the refactor is required to make the change safe.
- Commits must leave the repository buildable and testable.

Examples:

```
feat(teams): add invitation acceptance with organization checks
fix(auth): serialize refresh rotation per session
docs(architecture): record tenant cache isolation decision
```
