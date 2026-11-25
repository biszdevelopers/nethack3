# ADR-007: Nethack UI

Decision record for an original, source-owned React design system.

## Status

accepted.

## Context

Nethack needs Nuxt UI-level component breadth, consistency, accessibility, and developer experience. Nuxt UI is Vue-only and cannot be imported into React. Its source is MIT licensed, but copying its implementation, proprietary assets, documentation, or distinctive branding would produce a counterfeit rather than a product design system. The public site and workspace must not diverge into two component libraries.

## Decision

Nethack UI is an original React design system in `packages/ui`.

- It is built on Radix UI primitives, Tailwind CSS 4, and Tailwind Variants, with clsx and tailwind-merge for class composition.
- Components are source-owned inside the repository. There is no third-party design framework at runtime.
- Radix is the only primitive foundation. Base UI, Ariakit, React Aria Components, and overlapping frameworks are not mixed in.
- The public site and workspace consume the same tokens, components, hooks, and interaction conventions.
- The component catalog in `docs/engineering/ui-system.md` is the required coverage list.
- Every component has one documented API, typed variants, complete states, keyboard behavior, and accessibility support.
- The visual identity is Noto Sans Mono exclusively, with `#00DC82`, `#090909`, and `#FFFFFF`, dark theme by default.
- There is no all-caps UI text, fake data, decorative clutter, arbitrary gradient, or unrelated accent color.
- A development-only component laboratory in `apps/workspace/src/pages/lab` documents examples, variants, sizes, props, keyboard behavior, accessibility, responsive behavior, states, and code.
- Visual regression and accessibility tests cover important components and composed pages in both themes and three viewport classes.

## Consequences

- The project owns component defect fixes, API evolution, and accessibility behavior.
- Component breadth is a long-term maintenance commitment, not a one-time scaffold.
- The design system must resist becoming an internal framework; a button remains a button, and a dialog does not require five unrelated providers.
- Shared components must work under Next.js server rendering and the Vite browser build.
- Visual and accessibility regressions block UI changes.
- Third-party primitives may be replaced behind the owned component source without changing application call sites.
