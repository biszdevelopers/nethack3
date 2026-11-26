# TypeScript standards

Compiler configuration, type-safety rules, and boundary handling for all nethack3 packages and applications.

## Compiler configuration

Every TypeScript project extends `tsconfig.base.json`. The mandatory strictness options are:

```json
{
    "compilerOptions": {
        "strict": true,
        "noUncheckedIndexedAccess": true,
        "exactOptionalPropertyTypes": true,
        "noImplicitOverride": true,
        "noImplicitReturns": true,
        "noFallthroughCasesInSwitch": true,
        "forceConsistentCasingInFileNames": true,
        "verbatimModuleSyntax": true,
        "skipLibCheck": true
    }
}
```

No application, package, test, or tool configuration may weaken these options. Build configurations may add options; they may not remove or relax these.

| Option | Consequence in this repository |
| --- | --- |
| `strict` | No implicit `any`, strict null checks, strict function types, strict property initialization |
| `noUncheckedIndexedAccess` | Indexed reads and `array[index]` produce `T \| undefined`; handle absence instead of asserting |
| `exactOptionalPropertyTypes` | `property?: string` does not accept `undefined`; use `string \| undefined` where absence is explicit |
| `noImplicitOverride` | Subclass members that override a base member declare `override` |
| `noImplicitReturns` | Every code path in a function with a return value returns explicitly |
| `noFallthroughCasesInSwitch` | Switch cases end in `break`, `return`, or `throw` |
| `forceConsistentCasingInFileNames` | Imports match file casing exactly; required for Linux builds and case-sensitive containers |
| `verbatimModuleSyntax` | Type-only imports use `import type`; no type imports are emitted as runtime imports |
| `skipLibCheck` | Declaration files from dependencies are not typechecked; application code still is |

Projects target ES2023 and use `module` and `moduleResolution` NodeNext, `isolatedModules`, and `resolveJsonModule`. Relative ESM imports use the emitted `.js` specifier, consistent with NodeNext.

## No escape hatches

The following are forbidden in application, package, and test code:

```ts
// Forbidden
const value: any = input;
// @ts-ignore
someUntypedCall(input);
const id = maybeId!;
const user = data as User;
```

Rules:

- No `any`. If a type is genuinely unknown, use `unknown` and narrow it.
- No `@ts-ignore`.
- No `@ts-expect-error` to hide a real mismatch. A deliberate compile-time assertion test may use it only with a comment explaining the expected error and must remain in a test file.
- No non-null assertion `!` to avoid handling absence. Restructure with a guard, a default, or an explicit invariant check.
- No unsafe type assertion on untrusted data. Parse with a schema and return a typed value.
- No double assertion through `unknown` to force a cast.
- No `Function`, `Object`, `{}`, or `object` as a stand-in for a real type.
- No `// eslint-disable` or equivalent suppression. Oxlint findings are fixed or explicitly configured at the repository level with a documented reason.
- Do not widen a type only to make an error disappear.
- Do not export a type as `any` through a public contract.

`as const` and `satisfies` are allowed and encouraged when they preserve precise types without changing runtime behavior.

A narrow assertion is permitted only when TypeScript cannot express a runtime-verified invariant, for example after a parser has validated the shape. It must be adjacent to the validation, use the narrowest possible type, and be justified by the validator. Prefer a type guard or a schema result.

## Untrusted data

- All request bodies, query strings, route parameters, headers, file metadata, environment variables, identity-provider responses, and external API responses enter as `unknown`.
- Parse with Zod schemas from `packages/contracts` or a local schema module.
- Use the parsed output, not the original value.
- Do not validate and then cast back to the input type.
- Distinguish absent, `null`, and empty values explicitly.
- Treat database rows as typed by Drizzle but still enforce domain invariants in domain code.

## Null and absence

- Prefer `T | null` for a value that exists but may be absent, and `T | undefined` for an omitted property or missing lookup.
- Do not use both for the same concept in one contract.
- `exactOptionalPropertyTypes` means an optional property is either absent or a value; if a caller passes `undefined`, the type must say so.
- Handle array access explicitly because of `noUncheckedIndexedAccess`.
- Do not use truthiness checks for numbers, strings, or identifiers where `0` or `""` is valid.
- Return early for absent values instead of nesting the rest of a function.

## Unions and state

- Model closed states with discriminated unions and a literal `status` or `kind` field.
- Handle every variant with a `switch` and an exhaustiveness check:

```ts
function assertNever(value: never): never {
    throw new Error(`Unhandled variant: ${JSON.stringify(value)}`);
}
```

- Submission, registration, judging, and voting state transitions use explicit unions. Do not represent state with several independent booleans.
- Use exhaustive handling for important state transitions and API error categories.
- Do not add a default branch that silently accepts an unknown state.

## Interfaces, types, and generics

- Use `interface` for object contracts that may be implemented or extended.
- Use `type` for unions, intersections, mapped types, and aliases of primitives.
- Public capability contracts, repository interfaces, and infrastructure interfaces are named and exported from the capability or core entry point.
- Prefer a concrete type over a generic when only one type is used.
- Avoid generic programming that exists only to demonstrate flexibility.
- Avoid conditional types, recursive type-level computation, and decorator-style metaprogramming unless a documented need cannot be met otherwise.
- Do not create a type parameter that appears once.
- Keep utility types shallow and readable.

## Imports and modules

- Use ESM only.
- Type-only imports use `import type`.
- Import from a package entry point (`@nethack/contracts`, `@nethack/ui`, `@nethack/api-client`) rather than deep internal paths from another package.
- Relative imports within a capability are allowed; across capabilities they are not.
- Do not create barrel files that re-export an entire application. Package entry points and capability `index.ts` files are the only intended barrels.
- No circular imports. Architecture tests enforce the import graph.
- Server-only modules must never be imported by browser code. Keep database, Node built-ins, and secrets out of modules reachable from `apps/site` client components or `apps/workspace`.

## Functions and API shape

- Exported domain and application functions declare explicit return types.
- Public contracts accept a single typed input object when the operation has more than one meaningful field.
- Return domain results or typed errors, not ad hoc object shapes.
- Do not return database rows directly from a capability's public contract. Map to a contract type so persistence changes do not leak.
- Do not expose `Date` objects across the API boundary; use ISO 8601 strings from `packages/contracts`.
- Use `readonly` arrays and properties in contract types where mutation is not part of the contract.

## Enums and constants

- Prefer string literal unions over TypeScript `enum` for API and domain values.
- Use a `const` object with `as const` when a runtime lookup is needed.
- Database enums must match the contract literals and are changed through migrations.
- No magic numbers in business rules. Name the value and state its unit.

## Tests and type tests

- Tests are typechecked under the same strict configuration.
- Fixtures use the real contract types. Do not cast a partial object into a contract type.
- Test factories return fully valid objects and allow explicit overrides.
- Negative type tests are rare and live beside the type they protect.
- A test must not weaken strictness to construct data.

## Review checks

- Does the change introduce `any`, a suppression, a non-null assertion, or an unsafe cast?
- Are external values parsed before use?
- Are optional and nullable values handled explicitly?
- Is every union variant handled?
- Does a public contract expose a persistence or framework type?
- Does the import graph remain acyclic and within package entry points?
- Does the code typecheck with the repository configuration, not a local override?
