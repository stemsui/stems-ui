# Conventions

How Stems UI code is written. Stems owns its API, but it should feel native to Remix 3.
`@remix-run/ui` is our style reference (not a dependency): when in doubt about an idiom, look at how
it does things.

## Naming

| Layer                 | Naming source                                       | Example                              |
| --------------------- | --------------------------------------------------- | ------------------------------------ |
| Coverage / docs       | Base UI component names                             | "Toggle Group"                       |
| Headless (`stems-ui`) | kebab-case module per widget; Remix verbs and nouns | `stems-ui/toggle-button-group`       |
| Registry (styled)     | shadcn/ui item and export names                     | `dropdown-menu` → `DropdownMenuItem` |

Clashes with Remix win, and get documented:

- Remix `toggle` is a **switch**, so Base UI Toggle → `toggle-button` and Toggle Group →
  `toggle-button-group`, everywhere, including the registry (not shadcn's `toggle`).

## Headless modules (`packages/stems-ui`)

### Module shape

- One subpath export per widget, imported as a namespace: `import * as tabs from 'stems-ui/tabs'`.
  Single-part widgets may export a single mixin (`import { separator } from 'stems-ui/separator'`).
  `package.json` exports are pattern-based (`./*` → `dist/*.js`), so new modules need no export
  edits. `src/lib/*` is internal and blocked from import.
- Parts follow **Base UI's part names**, camelCased: Base UI `Tabs.Root`, `Tabs.List`, `Tabs.Tab`,
  `Tabs.Indicator`, `Tabs.Panel` → `tabs.Context` (state) + mixins `tabs.root()`, `tabs.list()`,
  `tabs.tab()`, `tabs.indicator()`, `tabs.panel()`.
- `Context` is a provider component that owns shared state and receives the root options
  (`<tabs.Context defaultValue="a" orientation="vertical">`). The root element's mixin is `root()`
  when the widget has a root element. Widgets with per-item state use an extra provider named after
  the part (`accordion.ItemContext`).
- Use `createMixin` from `@remix-run/component`; return `attrs({...})` (and `on(...)`, `ref(...)`)
  descriptors from the mixin's render function, as `@remix-run/ui` does.

### Options and state

- **Option names follow Base UI's prop names** for that part: `value` / `defaultValue` /
  `onValueChange`, `checked` / `defaultChecked` / `onCheckedChange`, `open` / `defaultOpen` /
  `onOpenChange`, `pressed` / `defaultPressed` / `onPressedChange`, `disabled`, `readOnly`,
  `required`, `name`, `form`, `orientation`, `loopFocus`, `activateOnFocus`, etc. Defaults match
  Base UI's defaults unless there's a documented reason.
- Support controlled **and** uncontrolled state for every stateful value. Controlled when the
  controlled option is not `undefined`.
- Change callbacks receive the next value first: `onValueChange(value, event?)`. They also dispatch a
  bubbling event (below), so consumers can listen either way.
- Explicit host props win over mixin defaults (`attrs()` semantics). Don't override host props unless
  correctness requires it, and document when you do.

### Events

- One `Event` subclass per change, `bubbles: true`, type string `stems:<widget>-<change>`
  (e.g. `stems:tabs-change`), with the new state as readonly fields.
- Export a typed listener helper: `onTabsChange(handler)` built on `on(...)`, as `@remix-run/ui`
  does. Augment `HTMLElementEventMap` for the event type.

### Styling hooks

- **Data attributes follow Base UI's documented attributes for that part** (check the "Data
  attributes" tables at `https://base-ui.com/react/components/<name>.md`), e.g. `data-checked` /
  `data-unchecked`, `data-disabled`, `data-readonly`, `data-required`, `data-orientation`,
  `data-active` / `data-selected`, `data-open` / `data-closed`, `data-panel-open`, `data-pressed`,
  `data-highlighted`, `data-starting-style` / `data-ending-style`. This makes shadcn's Base UI styles
  portable to Stems.
- Boolean data attributes are **present (empty string) or absent**, never `"true"`/`"false"`.
- CSS variables also follow Base UI (`--collapsible-panel-height`, `--active-tab-width`, ...).
- State attributes must be correct in the **server-rendered** HTML, not only after hydration.

### Platform

- Native first: `<dialog>`, the popover API, native `<input>`s (or hidden inputs) for form
  participation, `inert`, `hidden="until-found"`.
- Keyboard handling that uses ArrowLeft/ArrowRight reads direction from `lib/direction.ts`
  (`getDirection`, `horizontalArrowStep`) at event time, so RTL works via `dir="rtl"`.
- Reuse internals in `src/lib/` (`keydown`, `typeahead`, `outside-click`, `scroll-lock`,
  `hover-aim`, `wait-for-css-transition`, `direction`) and `src/anchor.ts`.

### Popups and overlays (Phase 2+)

- **Top layer, no portals.** Popups render where the app puts them and escape clipping and
  z-index through the platform: `popover="manual"` + `showPopover()`/`hidePopover()` for
  anchored popups (popover, menu, tooltip, preview card, select), native `<dialog>` with
  `showModal()` (modal) or `show()` (non-modal) for dialogs. Base UI's `Portal` part has no
  Stems equivalent; document that.
- **Dismissal goes through `lib/dismiss-layer.ts`.** Register a layer when a popup opens,
  unregister when it closes. Never add your own document-level Escape or outside-click
  listeners: the stack makes nested popups (a popover in a dialog, a submenu in a menu) close in
  the right order. Use `contains` to treat the trigger as inside. For native `<dialog>`,
  `preventDefault()` its `cancel` event and let the stack decide.
- **Mount/unmount transitions use `lib/presence.ts`** (`data-starting-style` /
  `data-ending-style`, waits for CSS animations before hiding). Popup parts expose Base UI's
  `data-open` / `data-closed` plus the presence attributes, and positioned parts expose
  `data-side` / `data-align` and Base UI's CSS variables (`--anchor-width`,
  `--anchor-height`, `--available-width`, `--available-height`, `--transform-origin`) where
  `anchor.ts` can provide them.
- **Positioning uses `src/anchor.ts`.** Options follow Base UI's Positioner props (`side`,
  `align`, `sideOffset`, `alignOffset`, `collisionPadding`…) mapped onto `anchor()`; extend
  `anchor.ts` if needed (it's ours now) and keep its tests passing.
- **Focus:** `lib/tabbable.ts` (`getTabbableElements`, `focusFirst`). Restore focus to the
  trigger on close unless the close was an outside press onto another focusable element.
- **Scroll lock:** `lib/scroll-lock.ts`, only for modal popups (Base UI's `modal` option).

### Dependencies and porting

- Import from `@remix-run/component` (as `@remix-run/ui` does), never from `remix`.
- Never import `@remix-run/ui`. Composite widgets build on Stems' own lower-level modules
  (tooltip on `stems-ui/popover`, select on `stems-ui/listbox`).
- Porting from `@remix-run/ui` (MIT) is encouraged; their tagged source (with tests) is the
  reference. A ported file starts with:

  ```ts
  // Adapted from @remix-run/ui 0.13.0 (packages/ui/src/<file>).
  // https://github.com/remix-run/remix - Copyright (c) 2025 Shopify Inc. MIT License.
  ```

  Then change the API freely to match these conventions and fix the gaps listed in
  `coverage.json`. Ported tests are renamed to `*.test.browser.ts(x)` and import from
  `remix/assert` and `remix/test`.

### Remix runtime pitfalls (learned in Phase 1)

- **Optional mixin arguments shift.** Remix calls a mixin's render function as
  `(...args, props)`, so `foo()` with no arguments puts the host props in the first parameter.
  Never write `(options = {}, props) => …`; use `splitOptions` from `lib/collapsible-panel.ts`
  (or check the argument count) and test the no-argument call.
- **Pass `aria-*` values as strings.** The server renderer writes `true` as a bare attribute and
  drops `false`, while the client writes `"true"`/`"false"`. Use `'true'`/`'false'`.
- **Don't call a mixin's own `handle.update()`.** It can re-render the mixin with stale arguments
  after its owner re-rendered. Re-render through the Context provider's handle, or write DOM
  attributes directly.
- **Read `handle.signal` during setup or render only**, and capture it. Reading it later throws,
  and the scheduler swallows the error.
- **A mixin can't remove its element.** Options like Base UI's `keepMounted` belong in the styled
  registry component (which can choose not to render children) or are documented as no-ops.
- **`hidden="until-found"` keeps the box laid out** (it uses `content-visibility`). Collapse any
  explicit size when a panel finishes closing.
- **Test globs:** `src/tabs*` also matches the `src/tabs/` README folder and reports a bogus
  "Directory import" failure. Use `src/tabs.test*`.

### Documentation

- Each module has `src/<module>/README.md`: one-line summary, Base UI equivalent link, usage,
  API (Context props + each mixin's options), behavior notes (keyboard map, focus), and a
  "Styling hooks" table (data attributes + CSS variables per part).

## Registry (`packages/registry`)

- Source lives in `src/ui/*.tsx`, `src/lib/*.ts`, `src/styles/theme.css`.
- Import shared registry files through `#stems/...` with explicit extensions
  (`#stems/lib/utils.ts`). The build rewrites them to `@/registry/stems/...` so shadcn can map them
  to user aliases.
- Import Remix APIs from `remix/component` (what users have installed), behavior from
  `stems-ui/*`.
- Every styled component:
  - is a Remix component (`Handle<Props<'tag'> & Options>`),
  - spreads remaining host props, merges `class` with `cn()`, and appends the caller's `mix` after the
    behavior mixin: `mix={[menu.item(opts), mix]}`,
  - sets `data-slot="<item>-<part>"` like shadcn,
  - styles state through ARIA and data attributes (`aria-expanded:`, `data-[highlighted=true]:`), not
    JS-computed classes.
- Visual target: shadcn/ui's Base UI style. Theme tokens are shadcn's CSS variables.

## Tests

- `remix test` for everything. Browser tests are `*.test.browser.tsx`, e2e tests `*.test.e2e.ts`.
- Run from the repo root (`pnpm test`). The browser harness must live under the cwd, and pnpm's
  store is at the root.
- Each headless module: a browser test covering ARIA, keyboard, focus, and controlled/uncontrolled
  state. Behavior contracts are derived from WAI-ARIA APG and Base UI (MIT; attribute when porting).

## Code style

- Prettier: no semicolons, single quotes, 100 columns (same as Remix).
- `let` by default, as in Remix source.
- Explicit `.ts`/`.tsx` extensions in relative and `#` imports.
