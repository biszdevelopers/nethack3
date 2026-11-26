# Performance standards

Performance targets, measurement rules, algorithmic documentation, and resource budgets for nethack3.

## Position

Performance is a design requirement, not a final optimization phase. Nethack must be usable on ordinary school laptops, mid-range phones, slower connections, higher-latency networks, and modest hosting hardware. Navigating a competition must not require a powerful computer.

## Targets

These are initial targets, subject to measurement on production builds.

| Metric                   | Target        |
| ------------------------ | ------------- |
| LCP                      | ≤ 2.5 seconds |
| INP                      | ≤ 200 ms      |
| CLS                      | ≤ 0.1         |
| Cached public TTFB       | ≤ 800 ms      |
| Ordinary API p95         | ≤ 200 ms      |
| Ordinary API p99         | ≤ 500 ms      |
| Lighthouse performance   | 95+ target    |
| Lighthouse accessibility | 100 target    |
| Animation                | 60 FPS target |

Measure at realistic device and network conditions. A desktop development machine on a fast local network is not sufficient evidence.

## Measurement method

- Measure production builds, not development servers.
- Use Chrome DevTools performance traces, Lighthouse CI, Playwright timing, and server metrics.
- Record LCP, INP, CLS, and TTFB from field-like conditions: mid-range mobile emulation, 4x CPU throttling where appropriate, and a throttled network profile.
- Measure public pages with cold and warm caches separately. Cached public TTFB is a separate target from origin-rendered TTFB.
- Measure API latency at the Fastify boundary and include database time. Report p50, p95, and p99 per route group, not a single global number.
- Measure database query time and row counts for changed queries. A fast endpoint with an N+1 query pattern is not acceptable.
- Load tests use k6 against a production-like environment with realistic data volumes and concurrency.
- Bundle measurements record initial route JavaScript, shared chunks, font files, and images.
- Animation measurements use the browser performance panel and verify no long tasks or layout thrash.
- A performance claim includes the environment, data volume, concurrency, and command used to reproduce it.
- Regressions are compared against the previous accepted measurement, not against an unrecorded impression.

## Frontend budgets

- Minimal initial JavaScript. Route-level code splitting for the workspace; Server Components and static rendering for public content.
- No unused component code in an initial route.
- No entire icon library import; import individual Lucide icons.
- One charting approach. Do not load multiple charting libraries for the same page.
- One self-hosted font family with a controlled weight set and only critical preloads.
- No unnecessary third-party scripts. Any third-party script requires a documented purpose, a privacy review, and a loading strategy.
- No duplicated server state in client stores.
- No client-side data fetching where server rendering provides the data.
- No unnecessary providers or global context updates.
- Images are optimized, dimensioned, and lazy-loaded below the fold.
- Public pages define explicit cache and revalidation behavior. Authenticated pages are not cached publicly.
- CSS stays component-scoped through utilities and tokens; no enormous global stylesheet.
- Respect reduced motion and avoid continuous background animation.

## React budgets

- Use `useTransition`, `useDeferredValue`, `useOptimistic`, Suspense, and lazy loading where they solve a real interaction problem.
- Do not memoize every component.
- Do not use effects to synchronize derivable values.
- Do not introduce a state-management framework without a requirement.
- Keep list rendering keyed and bounded. Virtualize when measurement justifies it.
- Avoid layout shifts from fonts, images, skeletons, and late-arriving data. Reserve space.

## API budgets

- Bounded database connection pools with explicit limits.
- Request body limits, route timeouts, and bounded concurrency.
- Explicit response serialization with Fastify response schemas.
- Cursor pagination with a maximum page size; no unbounded result sets.
- Efficient queries, no N+1 patterns, and indexes justified by real access patterns.
- No repeated validation of the same payload at multiple layers.
- Avoid unnecessary object transformations and redundant database round trips.
- Avoid excessive logging on hot paths; log structured events with levels.
- Background work is bounded, idempotent, and leased. No unbounded queue growth.
- Caches are bounded, scoped, and invalidated deliberately. Authenticated responses use `Cache-Control: private, no-store`.

## Algorithmic complexity

Every nontrivial algorithm documents:

- Time complexity.
- Auxiliary memory complexity.
- Worst-case behavior.
- Expected or amortized behavior where relevant.
- Input-size assumptions.

Documentation lives next to the implementation in a `.ts` file and, for architectural algorithms, in the relevant architecture document. The Core dependency resolver documents its topological resolution in `docs/architecture/core.md` and in `apps/api/src/core/dependency-resolver.ts`: O(V+E) time and O(V+E) space for V capabilities and E dependency edges.

Prefer:

- Indexed lookups and database indexes.
- `Map` and `Set` for membership and lookup.
- Streaming for large outputs.
- Cursor pagination.
- Efficient sorting with a defined comparator.
- Avoiding redundant calculations.
- Bounded data structures.

Do not sacrifice clarity to save a negligible amount of computation. A linear scan of five team members is reasonable. A linear scan of every submission in an organization is not.

## Database budgets

- Index foreign keys and common organization-scoped filters.
- Use composite indexes for organization-scoped access.
- Use explicit ordering for deterministic pagination.
- Inspect execution plans for new query shapes.
- Bound connection pools and statement timeouts.
- Avoid unbounded joins that multiply rows.
- Avoid loading large text or binary columns for list views.
- Use transactions for multi-step writes and enforce invariants with constraints.

## Animation budgets

- CSS transitions first. Motion only when justified.
- Animate transforms and opacity; avoid layout-affecting properties.
- No expensive blur effects on scrolling surfaces.
- No continuous background animation.
- No JavaScript animation loop where CSS can do the work.
- Respect `prefers-reduced-motion`.
- Target 60 FPS on representative devices and verify no dropped frames during common interactions.

## Build budgets

- Manageable build times on ordinary development machines.
- Incremental TypeScript builds.
- Cached dependency installation and Next.js build artifacts.
- No compilation of unrelated applications when one changes.
- No enormous generated files.
- No build-time network or database access during ordinary compilation.
- Parallelize only within a measured memory budget.

## Review and enforcement

- A performance-sensitive change includes measurement or a reasoned argument why it cannot regress a target.
- New dependencies are evaluated for bundle and runtime cost.
- New queries include an index decision and an expected row count.
- New algorithms include complexity documentation.
- Performance regressions block merge when they exceed an accepted target or lack justification.
- Targets are reviewed when production measurements show that an initial number is unrealistic. Changing a target requires an ADR, not a silent edit.


## Motion budget

GSAP motion is part of the reference-aligned interface and is measured like any other performance feature.

- Animate transform and opacity only. Never animate layout properties during scroll.
- One timeline per section; revert timelines on unmount and route changes.
- SplitText is limited to primary headings and reverted after use.
- ScrollTrigger work is scoped to visible sections; no continuous background animation loops.
- Tilt and magnetic effects are pointer-only, bounded to a few pixels or degrees, and disabled on touch and reduced motion.
- Entrance motion must not delay readable content by more than 800 ms.
- Record a performance trace for the landing page and workspace dashboard on a mid-range profile; any long task over 50 ms caused by motion is a defect.
