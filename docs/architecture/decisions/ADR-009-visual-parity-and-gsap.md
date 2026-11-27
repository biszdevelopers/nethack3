# ADR-009: reference composition and GSAP motion

Status: accepted.

## Context

The product specification establishes Noto Sans Mono, the neon-green, black, and white palette, and a deliberate, non-generic interface. The owner also asked for the layout density and polished interaction quality of the reference deployment at `nethack.biszweb.club`, with extensive GSAP animation.

The specification still forbids arbitrary gradients, excessive glow, glassmorphism for its own sake, random background grids, and floating decorative shapes. Reference parity therefore applies to composition, hierarchy, spacing, control quality, and motion, not to those forbidden treatments.

## Decision

- Adopt the reference layout density, header and navigation structure, card and alert treatments, and green-focused focus states.
- Keep Noto Sans Mono as the only typeface and the established green, black, white, and derived neutral palette.
- Keep the source-owned Nethack UI components and Radix interaction foundation. Restyle primitives instead of adding a second component system.
- Use solid header and surface fills. Do not use backdrop-blur glass effects, glow text shadows, decorative gradient bars, or floating blurred shapes.
- Keep scroll progress as a solid primary-color line. Hover elevation uses a restrained neutral shadow.
- Use GSAP 3.15 with ScrollTrigger and SplitText for entrance, stagger, tilt, magnetic, count-up, page-transition, and scroll-progress motion. CSS owns short overlay and hover transitions so Radix focus management stays authoritative.
- Provide motion through `@nethack/ui/motion` and mount global defaults in `NethackProvider`.
- Respect `prefers-reduced-motion`, animate transform and opacity only, and never delay content access behind motion.
- Production dependency security remains a release gate. React and Next.js stay on their latest patched releases; production advisories block release. A dev-only moderate advisory in an indirect build tool may be accepted only when fixing it requires an incompatible override.

## Consequences

- The UI package depends on GSAP; applications consume motion through shared components.
- Pages use intentional entrance states and reduced-motion behavior without decorative effects that the specification prohibits.
- Visual regression tests cover desktop, tablet, mobile, light, dark, empty, error, and loading states.
- The public site keeps a nonce-based CSP; GSAP and motion code are first-party bundled scripts.
- Noto Sans Mono, palette, accessibility, and no-invented-data rules remain in force.
