# UI system

Nethack UI architecture, design tokens, component APIs, required catalog, and verification rules for `packages/ui`.

## One design system

`packages/ui` is the only component source for `apps/site` and `apps/workspace`. There is no separate public-site design system and no separate workspace design system. Both applications consume the same tokens, components, hooks, and interaction conventions.

Nethack UI is an original React implementation with Nuxt UI-level breadth and quality. It is not a Nuxt UI clone, does not copy proprietary assets or documentation, and does not use Nuxt UI at runtime.

## Layers

| Layer                   | Responsibility                                                             | Location                          |
| ----------------------- | -------------------------------------------------------------------------- | --------------------------------- |
| Visual foundation       | Tokens, typography, color, spacing, radii, elevation                      | `packages/ui/src/tokens`, `packages/ui/styles.css` |
| Interaction foundation  | Accessibility, keyboard behavior, focus management, states                 | `packages/ui/src/primitives`      |
| Component library       | Inputs, tables, menus, overlays, feedback, display                        | `packages/ui/src/components`      |
| Application patterns    | Forms, dashboards, shells, page composition                               | `packages/ui/src/layouts`, `packages/ui/src/components` |
| Global provider         | Theme, toasts, overlays, tooltips, shortcuts, command palette, locale     | `packages/ui/src/providers`       |

## Technology foundation

| Concern                 | Choice                                          |
| ----------------------- | ----------------------------------------------- |
| UI framework            | React                                           |
| Interaction primitives  | Radix UI                                        |
| Styling                 | Tailwind CSS 4                                  |
| Typed variants          | Tailwind Variants                               |
| Class merging           | clsx plus tailwind-merge                        |
| Icons                   | Lucide React                                    |
| Tables                  | TanStack Table                                  |
| Forms                   | React Hook Form                                 |
| Validation              | Zod                                             |
| Dates                   | React Day Picker plus date-fns                  |
| Command palette         | cmdk                                            |
| Animation               | CSS first; Motion only when justified           |
| Font                    | Noto Sans Mono, self-hosted                     |

Radix is the only primitive framework. Do not add Base UI, Ariakit, React Aria Components, or a second overlapping primitive system. Components are owned in this repository; no third-party design framework is a runtime dependency.

## Typography

Noto Sans Mono is the only typeface. No exceptions.

It applies to the public site, workspace, forms, tables, navigation, buttons, dialogs, charts, tooltips, notifications, documentation, error pages, and loading screens.

Rules:

- Self-host the font through `@fontsource/noto-sans-mono` or an equivalent self-hosted asset in `packages/ui`.
- Include the license in the repository and in distributed build artifacts where required.
- Ship a controlled set of weights. Do not load unused weights or styles.
- Provide glyph coverage for supported languages, including CJK where required, while retaining the Noto Sans Mono family.
- Preload only the critical font resources. Do not preload every weight.
- Hierarchy comes from size, weight, line height, spacing, contrast, and content structure.
- Never introduce a second font to create hierarchy.
- Use tabular numerals where alignment matters, such as tables, scores, and deadlines.

## Color

| Token              | Value     | Use                                                    |
| ------------------ | --------- | ------------------------------------------------------ |
| Primary green      | `#00DC82` | Primary actions, focus, selected state, live status    |
| Near black         | `#090909` | Default dark background and primary text on light      |
| White              | `#FFFFFF` | Primary text on dark and light surfaces                |

Permitted derived colors are neutral grays derived from black and white, and darker or lighter shades of the same green. Every derived value belongs to a named token.

Forbidden:

- Random blue, purple, orange, pink, cyan, or yellow accents.
- A rainbow status system.
- Unrelated accent colors for decoration.
- Color as the only carrier of status, error, or success.

Dark theme is the default. A light theme uses the same palette and visual language, with contrast checked independently. Status is always communicated with color and text together.

Required semantic tokens include background, surface, elevated surface, border, muted border, foreground, muted foreground, primary, primary foreground, focus ring, danger, warning, success, and disabled. Components consume semantic tokens, not raw palette values.

## Geometry and spacing

| Token                      | Initial value |
| -------------------------- | ------------- |
| Base radius                | 5px           |
| Small radius               | 3px           |
| Large surface radius       | 8px           |
| Control height             | 36–40px       |
| Comfortable control height | 44px          |
| Standard border            | 1px           |
| Standard spacing unit      | 4px           |
| Main content maximum width | 1280px        |
| Standard page padding      | 24px desktop  |

These are starting tokens, not arbitrary restrictions. Components use a small, consistent scale. Do not introduce one-off spacing, radii, or border values.

Visual construction rules:

- Consistent spacing and alignment.
- Restrained borders and minimal shadows.
- No arbitrary gradients, excessive glow, glassmorphism, background grids, or floating decorative shapes.
- No cards inside cards without a structural reason.
- No arbitrary left-side accent bars.
- No unnecessary iconography or decorative labels.
- No excessive empty space and no crowded information density.
- No layout shifts during loading or interaction.

## Interaction rules

- Immediate feedback for every action.
- Clear focus indicators that are never removed.
- No hidden functionality and no hover-only actions.
- Predictable controls with consistent button hierarchy.
- Consistent confirmation behavior for destructive actions.
- Clear, specific error messages with recovery guidance.
- No unnecessary animation; respect reduced motion.
- Keyboard accessibility for every interaction.
- No state-changing action on hover alone.
- Loading, disabled, and error states look intentional, not broken.

## Copy and content rules

- No all-caps UI text, headings, or button labels.
- No `text-transform: uppercase`.
- Prefer sentence case or lowercase.
- The product name is always `nethack`, lowercase. Never display `nethack3`.
- No random abbreviations in user-facing copy.
- No fake statistics, attendance, submission totals, team counts, participant names, deadlines, judging scores, results, or announcements.
- No Lorem Ipsum, placeholder production content, or decorative text that communicates nothing.
- Use real data or clearly labeled design fixtures in the component laboratory.
- When a page has no data, show a well-designed empty state with a truthful explanation and a next action where one exists.
- Do not fill an empty screen with arbitrary cards.

## Global provider

`NethackProvider` coordinates only genuinely global UI behavior:

- Theme configuration and color mode.
- Toast notifications.
- Dialog and overlay management.
- Tooltip infrastructure.
- Keyboard shortcuts.
- Command palette.
- Locale configuration.
- Global UI settings.

It is not a universal state container. It does not hold server data, form state, or capability business state. Every provider registered inside it has a documented reason to exist.

## Hooks

The shared hooks are ordinary `.ts` files in `packages/ui/src/hooks`.

| Hook                   | Responsibility                      |
| ---------------------- | ----------------------------------- |
| `useToast`             | Consistent notifications            |
| `useOverlay`           | Programmatic overlays               |
| `useShortcuts`         | Keyboard shortcuts                  |
| `useColorMode`         | Theme selection                     |
| `useLocale`            | Locale preferences                  |
| `useMediaQuery`        | Responsive behavior                 |
| `useControllableState` | Controlled and uncontrolled components |
| `useDebouncedValue`    | Appropriate input debouncing        |
| `useDisclosure`        | Open and closed state               |
| `useIsMobile`          | Responsive interaction decisions    |

Do not create a custom hook for a two-line state operation. Do not create a hook that only renames a React built-in.

## Component API conventions

Component APIs are designed once and documented in the component laboratory. They follow a predictable shape without forcing every property onto every component.

```tsx
<Button
    variant="solid"
    color="primary"
    size="md"
    loading={isSubmitting}
    disabled={!isValid}
>
    Save changes
</Button>
```

Common properties, where the component's responsibility supports them:

| Property    | Meaning                                                              |
| ----------- | -------------------------------------------------------------------- |
| `variant`   | Visual treatment such as solid, soft, outline, ghost, or link        |
| `color`     | Semantic intent such as primary, neutral, danger, or success         |
| `size`      | A named size from the shared scale                                   |
| `disabled`  | Prevents interaction and communicates the reason where needed        |
| `loading`   | Preserves layout and announces busy state                            |
| `className` | Consumer layout hook; merged last through `cn`                       |
| `id`        | Stable element identifier for labels and descriptions                |
| `aria-*`    | Accessibility attributes, forwarded to the meaningful element        |

Rules:

- Do not add a variant that exists only to make one screen look different.
- Do not accept arbitrary style props, raw CSS objects, or hex colors.
- Do not expose internal state or implementation types in props.
- Use discriminated unions for mutually exclusive props.
- Prefer composition over a large configuration object.
- Support controlled and uncontrolled use through `useControllableState` where both are meaningful.
- Forward refs to the single meaningful DOM element.
- Loading preserves dimensions to prevent layout shift.
- Disabled controls remain focusable when users need to discover why they are disabled; otherwise use `aria-disabled` with an explanation.
- Every component exposes a data attribute for visual testing, such as `data-slot="button"`.
- Component source stays readable: primitives, tokens, and variants, not an internal framework.

## Component catalog

The following catalog is the required coverage list. Every entry must exist with real behavior, not a visual shell. Some entries appear in more than one group because the plan assigns them multiple roles; one implementation may satisfy both entries and must be documented accordingly in the laboratory.

### A. Layout components

- App provider.
- Container.
- Main.
- Header.
- Footer.
- Sidebar.
- Splitter.
- Page shell.
- Content shell.
- Dashboard shell.
- Responsive navigation shell.
- Section.
- Grid.
- Columns.
- Stack.
- Page header.
- Page body.
- Page aside.

### B. Basic elements

- Alert.
- Avatar.
- Avatar group.
- Badge.
- Banner.
- Button.
- Calendar.
- Card.
- Chip.
- Collapsible.
- Field group.
- Icon.
- Keyboard shortcut indicator.
- Progress.
- Progress group.
- Separator.
- Skeleton.
- Toggle.
- Toggle group.
- User display.
- Empty state.
- Status indicator.

### C. Form components

- Checkbox.
- Checkbox group.
- Color picker.
- File upload.
- Form.
- Form field.
- Input.
- Date input.
- Date picker.
- Autocomplete.
- Number input.
- Rating input.
- Tag input.
- Time input.
- Listbox.
- Pin input.
- Radio group.
- Select.
- Select menu.
- Combobox.
- Slider.
- Switch.
- Textarea.
- Search input.
- Multi-step form.
- Validation summary.

### D. Data components

- Accordion.
- Carousel.
- Chart.
- Empty state.
- Scroll area.
- Table.
- Data table.
- Timeline.
- Tree view.
- User display.
- Activity feed.
- File list.
- Key-value display.
- Statistics display.
- Pagination controls.

### E. Navigation components

- Breadcrumb.
- Command palette.
- Footer columns.
- Link.
- Navigation menu.
- Pagination.
- Stepper.
- Tabs.
- Sidebar navigation.
- Contextual navigation.
- Search navigation.

### F. Overlay components

- Context menu.
- Drawer.
- Dropdown menu.
- Dialog.
- Alert dialog.
- Popover.
- Slideover.
- Toast.
- Tooltip.
- Hover card.
- Confirmation dialog.

### G. Dashboard components

- Dashboard group.
- Dashboard navbar.
- Dashboard panel.
- Dashboard resize handle.
- Dashboard search.
- Dashboard search button.
- Dashboard sidebar.
- Dashboard sidebar collapse.
- Dashboard sidebar toggle.
- Dashboard toolbar.

### H. Page composition components

- Page.
- Page anchors.
- Page aside.
- Page body.
- Page card.
- Page columns.
- Page call to action.
- Page feature.
- Page grid.
- Page header.
- Page hero.
- Page links.
- Page list.
- Page logos.
- Page section.
- Content navigation.
- Content search.
- Table of contents.
- Content pagination.

### I. Advanced components

- Rich-text editor.
- Editor toolbar.
- Editor suggestion menu.
- Editor mention menu.
- Editor drag handle.
- Chart visualizations.
- Calendar views.
- Resizable panels.
- Advanced search.
- File preview.
- Submission review panel.
- Evaluation rubric.
- Activity timeline.

Specialized components for unrelated product features, such as AI-chat interfaces or pricing-plan displays, are not required and must not be added merely to imitate another catalog.

## Completeness matrix

Every interactive component is verified in all applicable states.

| State or check        | Requirement                                                                 |
| --------------------- | --------------------------------------------------------------------------- |
| Default               | Renders with real content and correct tokens                                |
| Hover                 | Visible feedback; no action is available only on hover                      |
| Focus-visible         | Visible focus ring; keyboard focus order is logical                         |
| Active                | Pressed or selected state is distinct                                       |
| Disabled              | Non-interactive, announced as disabled, reason available                    |
| Loading               | Busy state announced; layout does not shift                                 |
| Error                 | Error is described in text, associated with the field or region, recoverable where possible |
| Keyboard              | All operations reachable and operable; Escape, Enter, Space, arrows as appropriate |
| Screen reader         | Accessible name, role, value, state, and description are correct            |
| Mobile                | Touch targets, overflow, gestures, and responsive layout work               |
| Dark theme            | Contrast and token behavior verified                                        |
| Light theme           | Contrast and token behavior verified                                        |

Component group coverage:

| Group                  | Required coverage                                                       |
| ---------------------- | ----------------------------------------------------------------------- |
| Layout                 | Responsive shells, overflow, landmarks, navigation state               |
| Basic elements         | All states, both themes, long content, empty content                    |
| Forms                  | Validation, error summary, disabled, loading, keyboard submission      |
| Data                   | Empty, loading, error, sorting, pagination, long cells, mobile overflow |
| Navigation             | Active route, keyboard, collapsed and expanded states                   |
| Overlays               | Focus trap, Escape, outside interaction, scroll lock, return focus      |
| Dashboard              | Resize, collapse, persistence, small viewport                           |
| Page composition       | Content structure, anchors, responsive columns                          |
| Advanced               | Real workflows, autosave or explicit save, permissions, previews        |

## Component laboratory

The component laboratory is a development-only route in `apps/workspace` at `apps/workspace/src/pages/lab`. It documents:

- Component examples.
- Variants and sizes.
- Props and types.
- Keyboard behavior.
- Accessibility information.
- Responsive behavior.
- Loading, error, and empty states.
- Code examples.

The laboratory makes the complete design system inspectable without navigating the product. It uses labeled fixtures, never fake production data. It does not introduce a heavyweight documentation stack without a demonstrated need.

## Accessibility

- Use semantic HTML before ARIA.
- Every component has an accessible name and correct role.
- Focus is visible and managed on open, close, and route change.
- Dialogs and menus trap focus while open and return focus on close.
- Form errors are announced and associated with their fields.
- Tables have headers, captions where useful, and keyboard navigation.
- Charts provide a text alternative and a data table or summary.
- No color-only status.
- Contrast meets WCAG 2.2 AA in both themes.
- Touch targets are at least 44px for primary interactions.
- Motion respects `prefers-reduced-motion`.
- Zoom to 200 percent does not break layout or hide actions.

## Visual and interaction testing

- Playwright screenshots cover desktop, tablet, and mobile.
- Both dark and light themes are captured.
- Loading, error, and empty states are captured for important components.
- Screenshots are compared after meaningful UI changes; a compiling build does not approve a visual regression.
- axe-core runs on laboratory pages and application pages.
- Keyboard tests cover dialogs, menus, tabs, comboboxes, tables, and forms.
- Mobile tests cover navigation, drawers, and touch targets.
- No visual baseline is accepted with fake data or unfinished states.
