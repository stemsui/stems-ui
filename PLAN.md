# Stems UI — Plan

Accessible UI for Remix 3. The goal is to cover all of Base UI, with shadcn-style
styled components on top.

**Core principle: Stems owns its entire API.** Every headless primitive lives in
`stems-ui`. We do **not** depend on `@remix-run/ui`. We use it as the reference for how to
write idiomatic Remix 3 components (mixins, `Context`, bubbling events, native-first
markup) and, where useful, port its MIT-licensed code with attribution. The only runtime
dependency is Remix's component model (`@remix-run/component`).

> Changed on Nov 1, 2026. The original plan built on `@remix-run/ui` and aimed to shrink
> as Remix grew. We switched to full ownership because `@remix-run/ui` is unstable (0.x),
> its APIs have gaps we'd have to wrap anyway (see `docs/audit.md`), and we want one
> consistent API across all components.

---

## 1. Starting point (checked Nov 1, 2026)

| Package          | Version | Notes                                                                                                                  |
| ---------------- | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| `remix`          | 3.1.0   | Component model in `remix/component` (`Handle`, `mix`, `on`, `ref`, `attrs`, `css`, `createMixin`, `TypedEventTarget`) |
| `@remix-run/ui`  | 0.13.0  | Headless, **unstable**, versioned independently, not re-exported by `remix`                                            |
| `@base-ui/react` | 1.9.0   | Reference for coverage and behavior (MIT)                                                                              |

Remix's shape, which Stems follows (our APIs are our own, but idiomatic in the same way):

```tsx
import * as menu from '@remix-run/ui/menu'

;<menu.Context label="Project actions">
  <button mix={[triggerStyle, menu.trigger()]} type="button">
    Actions
  </button>
  <div mix={[popoverStyle, menu.popover()]}>
    <div mix={[listStyle, menu.list()]}>
      <div mix={[itemStyle, menu.item({ name: 'rename' })]}>Rename</div>
    </div>
  </div>
</menu.Context>
```

- A `Context` provider per widget, mixins for each part, and bubbling `Event` subclasses
  (`onMenuSelect`, `onTabsChange`, …).
- Usually supports controlled (`value` + `onValueChange`) and uncontrolled (`defaultValue`)
  state, but not everywhere: select and combobox are uncontrolled only (see `docs/audit.md`).
- Native platform first: popover API, native checkbox for switches, hidden inputs for forms.
- App code owns markup and styles.

Remix's useful internals (`lib/outside-click`, `scroll-lock`, `typeahead`, `hover-aim`,
`keydown`) are **not exported**. We'll need our own copies at first, and we should ask
Remix to export them.

---

## 2. Coverage

Stems builds all 37 Base UI components (plus multi-value select and combobox). Where
`@remix-run/ui` has an equivalent, it is a **reference implementation**: read it first,
port what's good (with attribution), and fix the gaps the audit found. `docs/audit.md` has
the evidence; `coverage.json` tracks each component (phase, reference module, gaps to fix,
progress).

| Remix reference                         | Components                                                                |
| --------------------------------------- | ------------------------------------------------------------------------- |
| Good reference (port mostly as-is)      | Accordion, Switch (Remix `toggle`)                                        |
| Partial reference (port, then fix gaps) | Popover, Menu, Context Menu, Select, Combobox, Tabs, Collapsible          |
| No reference                            | Everything else (30), including Autocomplete, multi-value Select/Combobox |
| n/a                                     | `mergeProps`, `useRender` (`mix={[...]}` arrays and `attrs()` cover them) |

Shared internals also have references in Remix's unexported `lib/` (outside-click,
scroll-lock, typeahead, hover-aim, keydown) and in `anchor` (positioning).

Gaps in the Remix references that Stems must fix:

- **Popover is R+, not R.** `popover.anchor()` sets no ARIA on the trigger, and the surface
  has no dialog role or open state. Scroll lock is always on, so non-modal popovers (Base
  UI's default) can't be built on `popover.surface` today.
- **Menu and context menu are R+.** Every item activation closes the whole menu, so
  checkbox and radio menus can't stay open. Focus doesn't loop, there's no external
  open-state control, and no groups, separators or link items. Checked state is the app's
  job.
- **Tabs are R+.** They always activate on focus (Base UI defaults to manual activation),
  and have no orientation, RTL or indicator.
- **Select and combobox have bigger gaps than "single value only".** They're uncontrolled
  only, have no `required`, and the combobox filter is a fixed "starts with" match. The
  combobox also clears text that doesn't match an option on blur, so Autocomplete must be
  built separately.
- **Checkbox can't reuse Remix `toggle`**, because it hardcodes `role="switch"`.
- **No transition attributes** (`data-starting-style` / `data-ending-style`). Styled
  overlays animate with `:popover-open` and `@starting-style` instead.
- **CSP needs an upstream change:** Remix's server-rendered `<style>` tags carry no nonce.
- **CSS trap:** `data-highlighted` is `"true"`/absent on menu items but `"true"`/`"false"`
  on listbox options. Always target `[data-highlighted=true]`.

`docs/audit.md` §13 lists 15 upstream requests. They no longer block anything, but
they're still worth sharing with the Remix team as feedback.

---

## 3. Architecture

pnpm monorepo:

```
stems-ui/
  packages/
    stems-ui/          # headless primitives (published to npm), e.g. `stems-ui/dialog`
    registry/          # styled component sources + registry.json (shadcn format)
  apps/
    docs/              # Remix 3 docs + playground; also serves registry JSON at /r/*.json
  tests/
    parity/            # (planned) behavior contracts run against OUR and REMIX's primitives
```

### Layer 1: `stems-ui` (headless)

- One entry point per widget: `import * as dialog from 'stems-ui/dialog'`.
- Same API shape as Remix: `dialog.Context`, `dialog.trigger()`, `dialog.popup()`,
  `dialog.close()`, `onDialogOpenChange(...)`.
- Only peer dependency: `@remix-run/component`. No dependency on `@remix-run/ui`.
- Composite widgets build on Stems' own lower-level primitives (tooltip on
  `stems-ui/popover`, select on `stems-ui/listbox`), mirroring how Remix layers its own.
- State lives in data attributes (`data-open`, `data-disabled`, `data-highlighted`, …) so
  CSS and Tailwind can style it. Match Remix's attribute names where they exist.

### Layer 2: registry (styled, shadcn-like)

- Copied into the user's project, not installed as a dependency: `npx shadcn add @stemsui/dialog`
  (users map the `@stemsui` namespace to our registry URL in `components.json`). The shadcn
  CLI works as-is; one-time app setup is in `docs/installation.md`.
- **Tailwind v4 + shadcn's CSS variable tokens** (`--background`, `--primary`, `--ring`,
  …). That way existing shadcn themes (including tweakcn and the shadcn theme gallery) work
  without changes. This is the biggest selling point of the styled layer.
- Each styled component imports its behavior from `stems-ui/*` only.
- Visual parity target: shadcn's Base UI style variant.

### Layer 3: docs (built with Remix 3)

- One page per component: demo, anatomy, API, keyboard table.
- The coverage table in §2 is generated from `coverage.json`, so it can't go stale.

---

## 4. Conventions

- **Naming:** use Base UI's component names for coverage, and Remix's verbs and nouns
  for API shape. Where they clash, follow Remix and document the mapping. The main clash
  is `toggle`: Remix's `toggle` is Base UI's Switch, so Base UI's Toggle becomes
  **`toggle-button`** (the WAI-ARIA APG name) and Toggle Group becomes
  **`toggle-button-group`**. Use these names everywhere, including the registry.
- **Native first:** `<dialog>`, the popover API, native inputs plus hidden inputs for
  forms, `inert`, CSS anchor positioning when it's ready.
- **Forms work without JS where possible.** It fits Remix's server-first model.
- **Accessibility contract per component:** ARIA pattern (APG reference), keyboard map,
  focus management, all written down before implementation.
- **No React-isms:** no hooks, no render props. State is plain variables plus `handle.update()`.

---

## 5. Relationship with Remix

- **Reference, not dependency.** `@remix-run/ui` shows how the Remix team writes
  components; we follow its idioms so Stems feels native.
- **Porting is allowed and encouraged.** It's MIT. Ported files keep a header crediting
  `remix-run/remix` (path + version) and the MIT notice; see `CONVENTIONS.md`.
- **Watch upstream.** A periodic check of `@remix-run/ui` releases (changelog + diff of
  the modules we ported from) catches bug fixes and new ideas worth adopting.
- **Give back.** Share the audit's findings and upstream requests with the Remix team.
  Contributions upstream are welcome but optional.

---

## 6. Testing

- `remix test` (what `@remix-run/ui` itself uses): `*.test.browser.tsx` for primitives in a
  real browser, `*.test.e2e.ts` for the docs app. It runs Playwright underneath. Tests run
  from the repo root (the browser harness must sit under the cwd, and pnpm's store is at the
  root). Accessibility scans with axe-core are still to be wired in.
- Keyboard/ARIA contracts derived from WAI-ARIA APG and Base UI's behavior. Base UI and
  `@remix-run/ui` are both MIT, so porting their test cases is fine with attribution.
- Server-render snapshot per component (Remix renders on the server first).
- Visual regression screenshots for the styled registry (light and dark).

---

## 7. Phases

### Phase 0: Foundations ✅ (Nov 1, 2026)

- [x] Scaffold the monorepo (pnpm, TS 7, Tailwind v4, `remix test` + Playwright, Changesets, Prettier).
- [x] Remix 3 docs app rendering a styled Remix `menu` (`apps/docs`), with an e2e test.
- [x] Detailed audit: `docs/audit.md` + `coverage.json`.
- [x] `CONVENTIONS.md`.
- [x] Registry pipeline proven end to end: in a fresh `remix new` app,
      `npx shadcn add @stemsui/theme @stemsui/separator @stemsui/dropdown-menu` installs
      working components that type-check, render and respond to keyboard and pointer.
- [x] First headless module: `stems-ui/separator` (+ browser tests).
- [ ] Claim names: npm package `stems-ui`, npm org `@stemsui`, GitHub org `stemsui`, domain. **(you)**
- [ ] Reach out to the Remix team (Discord or a GitHub discussion), leading with the audit's
      upstream requests. **(you)**

What Phase 0 taught us:

- **Imports in user apps go through Node subpath imports (`#app/*`).** Remix has no
  bundler aliases, but `package.json` `imports` work in Node and in the asset server, and
  the shadcn CLI rewrites to them **with** `.ts`/`.tsx` extensions. Users must drop
  `rewriteRelativeImportExtensions` from the starter `tsconfig.json` (TS2877 otherwise).
- **Registry sources import each other via `#stems/...`**, so the docs app runs them
  directly. The build rewrites those imports to `@/registry/stems/...` for shadcn.
- **Workspace packages need an asset-server mount** (`packages: '../../packages'`) because
  they resolve outside the app.
- `stems-ui` isn't published yet, so local install tests use
  `STEMS_UI_SPEC=file:<tarball>` in the registry build.

Follow-ups:

- A `@stemsui/init` registry item (or a docs CLI snippet) that automates the setup steps
  in `docs/installation.md`.
- `stems-ui` dev workflow: the docs app serves `stems-ui/dist`, so run
  `pnpm --filter stems-ui dev` (tsc watch) while working on primitives.
- Theme: `registry.json`'s `css` (base layer) duplicates `theme.css`'s `@layer base`;
  generate it if it grows.
- CI (GitHub Actions): install, build, typecheck, test, format check. ✅ (`.github/workflows/ci.yml`)

### Phase 1: Internals + simple components ✅ (Nov 1, 2026)

- [x] Internals ported from `@remix-run/ui` 0.13.0 with their tests: `anchor` (public as
      `stems-ui/anchor`), `lib/` keydown, typeahead, outside-click, scroll-lock, hover-aim,
      wait-for-css-transition, flash-attribute.
- [x] New internals: `lib/direction.ts` (RTL), `lib/roving-focus.ts` (composite keyboard
      navigation), `lib/presence.ts` (mount/unmount transitions with
      `data-starting-style` / `data-ending-style`, for Phase 2 overlays),
      `lib/collapsible-panel.ts` (shared collapsible/accordion panel).
- [x] Headless + styled + docs: Button, Input, Label (styled only), Separator, Avatar,
      Progress, Meter, Switch, Toggle Button, Collapsible, Accordion, Tabs.
- [x] Theme ships `tw-animate-css` + `shadcn/tailwind.css` like `shadcn init`, so shadcn
      classes copy over unchanged.
- [x] Verified in a fresh `remix new` app via `shadcn add` (tabs, accordion, switch, button).
- [ ] Replace the temporary `@remix-run/ui/menu` dependency in the registry's dropdown-menu
      (moves to Phase 2 with `stems-ui/menu`).

Status: 11 of 39 components have headless + styled versions; 249 tests. Remaining
differences from Base UI per component are in `coverage.json` (`openGaps`). Remix runtime
pitfalls found along the way are in `CONVENTIONS.md`.

### Phase 2: Popups and overlays ✅ (Nov 1, 2026)

- [x] Shared foundation: `lib/dismiss-layer.ts` (one Escape / outside-press stack per document,
      so nested popups close in order), `lib/tabbable.ts`, `lib/popup.ts` (popup store, trigger,
      top-layer surface with positioning, presence, dismissal, modal focus trap + scroll lock),
      `lib/focus-trap.ts`, `lib/dialog-root.ts` (native `<dialog>` engine), `lib/swipe.ts`,
      `lib/menu.tsx`, `lib/delay-group.ts`, `lib/toast-manager.ts`.
- [x] Popover, Menu (submenus, checkbox/radio items, per-item `closeOnClick`, loop focus),
      Context Menu (right click, long press, Shift+F10), Tooltip (delay groups), Preview Card,
      Dialog (nested, modal / non-modal / trap-focus), Alert Dialog, Drawer (swipe to dismiss),
      Toast (manager + Sonner-style `toast()` helper).
- [x] The registry's dropdown-menu now uses `stems-ui/menu`; **no package depends on
      `@remix-run/ui` any more**.
- [x] Verified with real keyboard and pointer input in Chromium (each agent), a sweep of every
      docs page for errors, and a fresh `remix new` app installing dropdown-menu, dialog,
      toast and tooltip via `shadcn add`.

Status: 20 of 39 components done; 512 tests. Open gaps per component are in `coverage.json`
(notably: drawer snap points, detached triggers / `createHandle`, filterable menu, anchored
toasts). Escape routing for native `<dialog>` relies on Chromium honoring a cancelled Escape
`keydown`; check Firefox and Safari before 1.0.

### Phase 3: Forms and listboxes ✅ (Nov 1, 2026)

- [x] Field, Fieldset, Form, with `lib/field-control.ts`: the contract every control uses to
      join a Field (labelling, descriptions, validity state attributes, native +
      custom validation, focus on invalid submit, server errors that clear on change). Forms
      still submit natively without JS. `Field.Item` for per-item labels in groups.
- [x] Checkbox (indeterminate, parent "select all"), Checkbox Group, Radio Group + Radio,
      Toggle Button Group (`lib/checkable.ts` shared with Switch).
- [x] Slider (range, push/swap collisions, edge alignment, pure-CSS positioning),
      Number Field (locale parsing, hold-to-repeat, wheel, scrub), OTP Field (paste/autofill,
      masking, auto-submit).
- [x] `lib/listbox.ts` (roving or virtual focus), Select (single and multiple, item aligned
      over the trigger), Combobox (filtering, empty state, chips for multiple), Autocomplete
      (free text, inline completion), sharing `lib/combobox-core.ts`.
- [x] Every control integrated with Field; verified end to end in a fresh `remix new` app
      (field, form, select, combobox, checkbox, slider, input via `shadcn add`).

Status: 34 of 39 Base UI components done (select-multiple and combobox-multiple are the
`multiple` option); 936 tests. Remix bugs found are in `docs/upstream-issues.md` (notably: a
child component's growing array output is inserted after the parent's later siblings).

### Phase 4: Composite and navigation

- Toolbar, Menubar, Navigation Menu, Scroll Area.

### Phase 5: 1.0

- Direction (RTL), CSP review, full docs, theming guide, blocks/examples.

---

## 8. Decisions

### Made

1. **Package names:** headless primitives publish as unscoped `stems-ui`. Anything else
   goes under the `@stemsui` npm org, and the GitHub org is `stemsui`.
2. **Registry styling:** Tailwind v4 + shadcn CSS variable tokens. `css()` mixin variants
   may come later.
3. **Base UI Toggle / Toggle Group** → `toggle-button` / `toggle-button-group`.
4. **License:** MIT.
5. **Registry item names follow shadcn** (e.g. `dropdown-menu`), except where they clash
   with Remix (decision 3).
6. **Own the full headless layer.** No dependency on `@remix-run/ui`; it's a reference and a
   source of MIT code to port.
7. **Headless API shape: `Context` + mixins** (Remix-native: `<menu.Context>` plus
   `mix={menu.item()}` on app-owned markup). The registry provides the component-style API
   (`<DropdownMenuItem>`); no separate headless component-parts layer.
8. **Porting strategy: port, then reshape.** Copy `@remix-run/ui` source (accordion, toggle,
   tabs, popover, anchor, menu, listbox, select, combobox, and the `lib/` helpers) with
   attribution, along with their tests, then change the API to Stems conventions and fix the
   gaps in `coverage.json`.

### Open

6. **How much to upstream:** depends on the Remix team's appetite.
7. **Registry host / domain** for the public `@stemsui` namespace URL.
