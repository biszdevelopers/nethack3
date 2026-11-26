# React standards

Component model, state ownership, data flow, performance, and accessibility rules for `apps/site`, `apps/workspace`, and `packages/ui`.

## Component model

- React uses function components and hooks exclusively. No class components.
- Files remain kebab-case (`team-card.tsx`); exported components are PascalCase (`TeamCard`). One primary component per file; small private subcomponents may share the file when they are not reused.
- Props are a named `interface` or `type` ending in `Props`, exported when consumers need it.
- Components render presentation. Domain rules, permission decisions, validation, and persistence live in `.ts` modules or the API.
- Components do not import database code, server-only modules, secrets, or Node built-ins.
- Use composition through `children` and slots instead of boolean props that switch between unrelated layouts.
- Do not create a wrapper component that only forwards props and adds no behavior.
- Do not spread unknown props onto DOM elements. Forward only documented props plus `className`, `id`, and applicable `aria-*`.
- A component that needs DOM access accepts a `ref` and forwards it to the single meaningful element.

## State ownership

State lives at the lowest level that needs it.

| State kind | Owner |
| --- | --- |
| Ephemeral UI state | The component or nearest common parent |
| Form values and validation | React Hook Form, with a Zod resolver |
| Server state | TanStack Query in `apps/workspace`; server rendering in `apps/site` |
| URL-driven state | React Router search parameters in the workspace; route segments in the site |
| Theme, locale, toasts, overlays | `NethackProvider` and its dedicated hooks |
| Cross-page client state | A capability-level context or query cache, only with a documented need |

Rules:

- Do not copy server data into component state unless the user is editing it.
- Do not synchronize derived values with effects. Compute them during render.
- Do not lift state higher than the nearest common owner.
- Do not put transient form state in a global store.
- Do not introduce Redux, Zustand, MobX, Jotai, Recoil, or another state library without an ADR showing that local state, URL state, TanStack Query, and context are insufficient.
- Context is for stable, widely consumed values, not for high-frequency updates. Split contexts by concern and memoize provider values.
- A provider exists only for a documented global concern. Do not turn `NethackProvider` into a universal state container.
- Use `useControllableState` for components that support both controlled and uncontrolled use.
- Keep state machines explicit for multi-step flows such as submissions and onboarding.

## Data fetching

- The workspace uses the typed client in `packages/api-client` and TanStack Query for caching, invalidation, and request lifecycle.
- Query keys include organization and resource identity. Never share a cache entry across organizations.
- Mutations invalidate or update the exact affected queries. Do not invalidate the entire cache.
- Authenticated responses are not persisted to shared browser storage.
- The public site fetches public API data on the server. It does not fetch private data and does not proxy authenticated requests.
- Do not fetch in an effect when a route loader, server component, or query hook can own the request.
- Do not duplicate a request across sibling components; share the query.
- Handle loading, empty, error, and success states explicitly. No component may render only the happy path.
- Abort or ignore stale responses on unmount and route change.

## Effects

- An effect synchronizes with an external system: DOM APIs, subscriptions, timers, or analytics. It is not a general computation mechanism.
- If a value can be derived from props or state, derive it during render.
- If an event caused the change, handle it in the event handler.
- Every effect declares complete dependencies and returns cleanup for subscriptions, observers, and timers.
- Do not use effects to mirror props into state.
- Do not use layout effects unless measurement before paint is required.
- Avoid effects that depend on unstable object or function identities.
- Do not suppress the exhaustive-deps rule without a comment explaining the invariant.

## Performance idioms

- Use `useTransition` for non-urgent state updates that would otherwise block typing or navigation.
- Use `useDeferredValue` for expensive derived rendering such as filtering a large table.
- Use `useOptimistic` for reversible UI updates where the server remains authoritative.
- Use `Suspense` and lazy route modules to split large features.
- Route-level code splitting is mandatory in the workspace. The public site uses Server Components, static rendering, and streaming where appropriate.
- Use stable keys from server identifiers. Array index keys are allowed only for static lists that never reorder.
- Virtualize long tables and lists with TanStack Table or a dedicated virtualization layer when measurement shows a need.
- Do not manually memoize every component. Apply `memo`, `useMemo`, and `useCallback` only after a measured or structurally obvious problem.
- Do not create objects, arrays, or inline components inside render paths that feed memoized children without need.
- Use React Compiler only where its benefit is demonstrated and verified; do not rely on it to excuse incorrect code.
- Avoid unnecessary providers and duplicated state.
- Respect reduced-motion preferences. Animate transforms and opacity, not layout properties.
- Keep bundles small: no entire icon library import, no duplicate charting stack, no unused component code in an initial route.

## Forms

- Use React Hook Form with the Zod resolver and shared schemas from `packages/contracts`.
- Every field has a visible label, a stable `id`, and an accessible description when needed.
- Validation errors appear next to the field and in a summary for long forms.
- Server validation errors map back to fields by stable code.
- Disable submission only while submitting, not as the primary validation mechanism.
- Preserve user input on failure.
- Confirm destructive actions with the confirmation dialog pattern.
- Multi-step forms keep state in one form owner and validate each step before advancing.
- Never trust client validation for business rules.

## Routing and layouts

- `apps/workspace` uses React Router 7 exclusively: persistent dashboard shell, nested layouts, lazy route modules, route-level error boundaries, search parameters, and browser history.
- No second routing library.
- `apps/site` uses the Next.js App Router with route groups, persistent layouts, loading and error boundaries, metadata, and prefetching.
- Protected workspace routes render based on the server-issued session, but the API remains the authorization boundary.
- Do not encode authorization decisions in route configuration alone.

## Accessibility

Accessibility is a default requirement, not a later audit.

- Use semantic HTML before ARIA: `button`, `a`, `form`, `label`, `table`, `dialog`, `nav`, `main`, `header`, `footer`.
- Every interactive element is keyboard reachable and operable.
- Visible focus indicators are never removed.
- Every control has an accessible name. Icon-only buttons require an `aria-label`.
- Use `aria-describedby` for help text and errors, and `aria-invalid` for invalid fields.
- Manage focus on route change, dialog open and close, and dynamic content insertion.
- Dialogs, menus, popovers, and comboboxes use Radix primitives and their focus-management behavior.
- No hover-only actions. Actions are available by keyboard, touch, and pointer.
- Do not communicate status by color alone; pair color with text or an icon plus label.
- Respect `prefers-reduced-motion`.
- Maintain contrast in both themes and at 200 percent zoom.
- Touch targets are at least 44px where the interaction is primary.
- Test with a screen reader for new interaction patterns.
- Run axe checks on new pages and components.

## Component conventions

- Props follow the Nethack UI API standards in `docs/engineering/ui-system.md`.
- Class names merge with `cn` (clsx plus tailwind-merge). Do not concatenate Tailwind classes manually.
- Styling comes from tokens and component variants, not ad hoc hex values or spacing.
- Loading states use the shared skeleton, spinner, or button loading behavior.
- Empty states use the shared empty state component with a clear next action.
- Error states are recoverable where recovery exists.
- Every component must render correctly in dark and light themes and at mobile widths.
- No fake data in a component example or production page. Labeled fixtures belong in the component laboratory and tests.

## Testing

- Component tests use Testing Library and user-event, not implementation details.
- Test behavior and accessible names, not CSS classes or internal state.
- Cover keyboard operation for menus, dialogs, tabs, and forms.
- Add visual regression coverage for important components and composed pages.
- Add an axe check to every page-level test.
- A component is not complete until its default, hover, focus-visible, active, disabled, loading, error, keyboard, screen-reader, mobile, dark, and light states have been exercised.

## Review checks

- Is state owned at the right level, without duplication or unnecessary globals?
- Are loading, empty, error, and success states all present?
- Is the component keyboard operable and labeled?
- Does it use Nethack UI tokens and components rather than local styling inventions?
- Does it avoid unnecessary effects, memoization, and providers?
- Is server data fetched through the typed client with organization-aware query keys?
- Does the route split code and preserve the persistent shell?
- Does the UI show real data or a real empty state?
