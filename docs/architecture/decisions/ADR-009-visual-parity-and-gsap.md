# ADR-009: nethack visual parity and GSAP motion

Status: accepted.

## Context

The product specification establishes Noto Sans Mono, a neon green, black, and white palette, and a deliberate, non-generic interface. The current nethack deployment at `nethack.biszweb.club` defines the target presentation language: dark neutral surfaces, a sticky translucent header, pill navigation, glow typography, soft tinted alerts, and motion-rich transitions. The product owner requested full stylistic and functional parity with that deployment and extensive GSAP animation without compromising the earlier requirements.

## Decision

- Adopt the reference layout density, header and navigation patterns, card and alert treatments, glow hierarchy, and green-focused focus states.
- Keep Noto Sans Mono as the only typeface and keep the established green, black, white, and derived neutral palette. Do not import the reference site's fonts, assets, or Nuxt UI code.
- Keep the existing Nethack UI component source and Radix interaction foundation. Restyle the primitives to the reference visual language rather than adding a second component system.
- Use GSAP 3.15 with ScrollTrigger and SplitText for entrance, stagger, tilt, magnetic, parallax, count-up, page-transition, and scroll-progress motion. CSS remains responsible for short overlay and hover transitions so Radix focus management stays authoritative.
- Provide motion through `@nethack/ui/motion` and mount global defaults in `NethackProvider`.
- Respect `prefers-reduced-motion`, animate transform and opacity only, and keep motion from delaying content access.
- Production dependency security remains a release gate. React and Next.js stay on their latest patched releases; production advisories block release. A dev-only moderate advisory in an indirect build tool may be accepted only when fixing it requires an incompatible override.

## Consequences

- The UI package depends on GSAP; applications consume motion through shared components.
- Authoring pages requires intentional entrance states and reduced-motion behavior.
- Visual regression tests must cover the reference-aligned default, light, mobile, loading, empty, and error states.
- The public site keeps a nonce-based CSP; GSAP and motion code are first-party bundled scripts.
- The visual rules for Noto Sans Mono, palette, accessibility, and no-invented-data remain in force.
