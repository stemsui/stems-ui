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

- One subpath export per widget: `import * as dialog from 'stems-ui/dialog'`. Single-part widgets may
  export a single mixin (`import { separator } from 'stems-ui/separator'`).
- Shape (the same idioms `@remix-run/ui` uses):
  - `Context`: provider component holding shared state (`<dialog.Context>`).
  - Part mixins, applied to app-owned markup: `dialog.trigger()`, `dialog.popup()`.
  - Bubbling events: an `Event` subclass plus an `on<Widget><Change>(handler)` mixin helper. Event type
    strings are namespaced `stems:<widget>-<change>` (Remix uses `rmx:`).
- State: support both controlled (`value` + `onValueChange`) and uncontrolled (`defaultValue`).
- Props set via `attrs()` are **defaults**: explicit host props win. Don't override host props unless
  correctness requires it (and document it).
- Native first: `<dialog>`, the popover API, native inputs plus hidden inputs for forms, `inert`.
- Import from `@remix-run/component` (as `@remix-run/ui` does), never from `remix`.
- Never import `@remix-run/ui`. Composite widgets build on Stems' own lower-level modules
  (tooltip on `stems-ui/popover`, select on `stems-ui/listbox`).
- Porting from `@remix-run/ui` (MIT) is encouraged. A ported file starts with:

  ```ts
  // Portions adapted from @remix-run/ui <version> (packages/ui/src/<file>),
  // Copyright (c) Shopify Inc. Licensed under the MIT License.
  ```

  Then change the API freely to match Stems conventions and fix the gaps listed in
  `coverage.json`.

- Each module has `src/<module>/README.md` in the same format as `@remix-run/ui` READMEs: usage,
  API list, behavior notes, styling hooks.

### Styling hooks (data attributes)

Prefer Remix's existing attribute names. When a Base UI state has no Remix equivalent, use Base UI's
name: `data-orientation`, `data-disabled`, `data-open` / `data-closed`, `data-checked` /
`data-unchecked`, `data-pressed`, `data-highlighted`. Boolean data attributes are present-or-absent,
except where Remix already uses `"true"`/`"false"` (see `docs/audit.md` §12).

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
