# Coverage audit: Base UI 1.9.0 vs `@remix-run/ui` 0.13.0

Checked 2026-11-01. Sources:

- Remix: the published `@remix-run/ui@0.13.0` tarball, `src/` folder. All paths below are
  relative to `package/src/`. Line numbers are from that version.
- Remix runtime: `@remix-run/component@1.1.0`, `src/`.
- Base UI: `https://base-ui.com/react/components/<slug>.md` (API reference tables).

Legend:

- **✅** Remix supports it. **⚠️** Partial, or only works with app code. **❌** Missing.
- Verdict **R**: Remix covers it well enough that Stems only adds styles.
- Verdict **R+**: Remix has the base, but Stems must add behavior (listed below).
- Verdict **S**: Stems builds it, on top of Remix primitives where possible.

> `coverage.json` is the machine-readable form of this file. If the two disagree, fix both.

---

## 0. Summary

| Base UI         | Stems        | Remix module           | Verdict | Main reason                                                                  |
| --------------- | ------------ | ---------------------- | ------- | ---------------------------------------------------------------------------- |
| Accordion       | accordion    | `accordion`            | **R**   | Complete for styling. Minor gaps: orientation, `hiddenUntilFound`            |
| Collapsible     | collapsible  | `accordion`            | **R+**  | Thin adapter over a one-item accordion                                       |
| Popover         | popover      | `popover` + `anchor`   | **R+**  | No trigger ARIA, no open state, no `role`, scroll lock is always on          |
| Menu            | menu         | `menu`                 | **R+**  | Always closes on select, no loop, no managed checkbox/radio state, no groups |
| Context Menu    | context-menu | `menu.contextTrigger`  | **R+**  | Same gaps as Menu, plus no long-press                                        |
| Select          | select       | `select`               | **R+**  | Uncontrolled only, single only, no `required`, no groups                     |
| Combobox        | combobox     | `combobox`             | **R+**  | Uncontrolled only, strict match only, `startsWith` filter, no empty state    |
| Tabs            | tabs         | `tabs`                 | **R+**  | Automatic activation only, no orientation, no indicator                      |
| Switch          | switch       | `toggle`               | **R**   | Complete. Use the native-input host for forms                                |
| Autocomplete    | autocomplete | (`listbox`, `popover`) | **S**   | Combobox clears free text on blur, so it can't be reused                     |
| Menubar         | menubar      | (`menu`)               | **S**   | Coordinates several `menu.Context`s                                          |
| Everything else | —            | —                      | **S**   | See §11                                                                      |

What differs from the starting guess (`PLAN.md` §2): **popover, menu, context-menu and tabs
move from R to R+**, and **collapsible moves from S to R+**. Details are in each section.

---

## 1. How Remix primitives work (affects every section)

- **Shape.** Each widget has a `Context` provider component, part mixins (`trigger()`,
  `list()`, …), and a bubbling `Event` subclass (`rmx:*-change`). State lives in the provider
  (`handle.context.set(...)`). Mixins read it with `handle.context.get(Provider)`.
- **`attrs()` only sets defaults.** If the host already sets a prop, the host value wins
  (`@remix-run/component src/runtime/mixins/attrs-mixin.ts:10-13`). So Stems can override any
  ARIA or data attribute that a Remix part sets with `attrs()`. Example: set `aria-selected`
  on a `listbox.option` host to build multi-select (§6).
  **Exception:** `toggle()` builds its props with `createElement` and _overrides_ `role`,
  `aria-checked`, and so on (`toggle.ts:116-146`).
- **Reading context.** Stems components can call `handle.context.get(menu.Context)` and so on
  to read live state such as `isOpen`, `activeId` and `displayedLabel`. The select README does
  this on purpose (`select/README.md:15-19`). For the other widgets the context types are
  internal, so this works but isn't a stable API.
- **Overlays use the native Popover API.** `popover.surface()` sets `popover="manual"` and
  calls `showPopover()`/`hidePopover()` (`popover.ts:94-103`). Surfaces render in the top
  layer, so no Portal is needed. Positioning is inline `position: fixed` (`anchor.ts:938-941`).
- **No transition-state attributes.** No Remix primitive sets `data-starting-style` or
  `data-ending-style`. Enter animations use CSS `@starting-style` on `:popover-open`. Exit
  animations use `transition-behavior: allow-discrete`. Menu and select wait for that CSS
  transition before they finish closing (`lib/wait-for-css-transition.ts`, used at
  `menu.tsx:420-422`, `select.tsx:223`, `combobox.tsx:370-372`). Components that mount and
  unmount can use `animateEntrance`/`animateExit` from `@remix-run/ui/animation`.
- **No RTL support.** Arrow keys are physical everywhere: `tabs.ts:299-309`,
  `menu.tsx:1022-1035`. Placements are physical too (`left`/`right`, `anchor.ts:1-13`).
  There is no direction context.
- **Values are strings.** Every value is a `string` (or `string | null`). There is no
  `isItemEqualToValue` and no object values.
- **SSR.** `popover.anchor`, `focusOnShow` and `focusOnHide` are `{ ssr: false }`
  (`popover.ts:66,155,165`).

---

## 2. Accordion → `@remix-run/ui/accordion` — verdict **R**

| Base UI                                                          | Remix                                                                                                              | Evidence                           |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| Root / Item / Header / Trigger / Panel                           | ✅ `Context`, `ItemContext`, `root()`, `item()`, `trigger()`, `content()`. The header is app markup (`<h3>`)       | `accordion.tsx:458-465`, README:86 |
| `value` / `defaultValue` / `onValueChange`                       | ✅ Controlled and uncontrolled                                                                                     | `accordion.tsx:143-175, 194-229`   |
| `multiple`                                                       | ✅ `type="multiple"` (a different prop name)                                                                       | `accordion.tsx:97-102`             |
| Single mode, can collapse                                        | ✅ `collapsible` (default `true`). Locked items get `aria-disabled`                                                | `accordion.tsx:216, 345, 411`      |
| `disabled` (root and item)                                       | ✅ Uses native `disabled` on the trigger                                                                           | `accordion.tsx:343, 399, 414`      |
| `Item.onOpenChange`                                              | ❌ Only the root `onValueChange` and the bubbling `AccordionChangeEvent`                                           | `accordion.tsx:26-45`              |
| `orientation`                                                    | ❌ Only ArrowUp/Down are handled                                                                                   | `accordion.tsx:421-439`            |
| `loopFocus`                                                      | n/a. Deprecated in Base UI 1.9 (roving focus was removed per APG). Remix still moves focus with arrows and wraps   | `accordion.tsx:248-252`            |
| `keepMounted`                                                    | ⚠️ Panels always stay mounted, with `inert` and `aria-hidden` but **not** `hidden`. CSS must hide closed panels    | `accordion.tsx:450-454`            |
| `hiddenUntilFound`                                               | ❌                                                                                                                 | —                                  |
| Panel `role="region"`                                            | ❌ Not set (`aria-labelledby` is set)                                                                              | `accordion.tsx:449-455`            |
| `--accordion-panel-height/width`                                 | ❌ No size measurement. Use CSS `interpolate-size` or a grid-rows trick, or add it in Stems                        | —                                  |
| `data-open`, `data-panel-open`, `data-index`, `data-orientation` | ⚠️ `data-state="open\|closed"` on item, trigger and content. `data-disabled` on root and item. `data-type` on root | `accordion.tsx:373-386, 413, 452`  |
| `data-starting-style` / `data-ending-style`                      | ❌                                                                                                                 | —                                  |

**Gaps (all small):** horizontal orientation, `hiddenUntilFound`, panel `role="region"`,
a panel size CSS variable, `Item.onOpenChange`.
**Verdict R.** The theme can hide closed panels with
`[data-state=closed]{display:none}`, or animate them in CSS. Ask upstream for the rest (§13).

---

## 3. Collapsible → accordion adapter — verdict **R+**

Base UI Collapsible is one trigger plus one panel, with a boolean `open`. Remix has no
collapsible module, but a one-item `accordion.Context` (single mode, `collapsible`) gives the
same ARIA (`aria-expanded`, `aria-controls`) and `data-state`.

| Base UI                                                   | Via accordion                                       | Evidence              |
| --------------------------------------------------------- | --------------------------------------------------- | --------------------- |
| `open` / `defaultOpen` / `onOpenChange` (boolean)         | ⚠️ Needs an adapter: `value = open ? 'item' : null` | `accordion.tsx:89-95` |
| `disabled`                                                | ✅                                                  | `accordion.tsx:343`   |
| Trigger `data-panel-open`, Panel `data-open/closed`       | ⚠️ `data-state`                                     | as in §2              |
| `keepMounted` / `hiddenUntilFound` / panel size variables | ❌ / ❌ / ❌                                        | as in §2              |

Side effect: the arrow-key handlers do nothing useful with one item, but they do no harm.
**Stems adds** `stems-ui/collapsible`, a ~30-line wrapper that maps boolean props to accordion
props.

---

## 4. Popover → `@remix-run/ui/popover` (+ `anchor`) — verdict **R+**

| Base UI part / prop                                                       | Remix                                                                                                                                               | Evidence                         |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Root `open` / `onOpenChange`                                              | ⚠️ The surface is **controlled only**: `surface({ open, onHide })`. There is no `defaultOpen` and no open-on-click. The app wires the trigger click | `popover.ts:41-47`, README:12-31 |
| Trigger (`aria-expanded`, `aria-haspopup`, `aria-controls`)               | ❌ `popover.anchor()` only registers the positioning target. It sets **no ARIA**                                                                    | `popover.ts:54-67`               |
| Trigger `openOnHover`, `delay`, `closeDelay`                              | ❌                                                                                                                                                  | —                                |
| Popup `role="dialog"`, Title, Description                                 | ❌ No role and no labelling                                                                                                                         | `popover.ts:102-144`             |
| Close part                                                                | ⚠️ The app calls its own close handler                                                                                                              | README:49                        |
| `initialFocus` / `finalFocus`                                             | ✅ `focusOnShow()` / `focusOnHide()`, plus `restoreFocusOnHide`                                                                                     | `popover.ts:120-126, 148-166`    |
| Escape and outside-click dismissal                                        | ✅ `onHide({ reason: 'escape-key' \| 'outside-click' })`. Outside clicks are stopped from propagating by default                                    | `popover.ts:128-143`             |
| `modal` (default `false`)                                                 | ⚠️ **Scroll lock is always on** whenever any surface opens. There is no focus trap and no outside-pointer blocking                                  | `popover.ts:113`                 |
| Backdrop                                                                  | ❌ The top layer has `::backdrop`, but only for `showModal`/`popover`. There's no styled part and no state attributes                               | —                                |
| Positioner `side` / `align`                                               | ⚠️ A combined `placement` with 12 physical values. No logical start/end in RTL                                                                      | `anchor.ts:1-13`                 |
| `sideOffset` / `alignOffset`                                              | ✅ `offset`, `offsetX`, `offsetY` (numbers or functions)                                                                                            | `anchor.ts:52-65`                |
| `collisionAvoidance` (flip/shift)                                         | ⚠️ Flips to the opposite side only, then clamps to the viewport                                                                                     | `anchor.ts:528-595, 845-920`     |
| `collisionPadding` / `collisionBoundary`                                  | ❌ Hardcoded to 16px, viewport only                                                                                                                 | `anchor.ts:67`                   |
| `sticky`, `disableAnchorTracking`, `positionMethod`                       | ❌ / ❌ (always polls with rAF) / ⚠️ chosen automatically                                                                                           | `anchor.ts:743, 949-960`         |
| Virtual anchor                                                            | ✅ `AnchorPoint {x,y,width,height}`                                                                                                                 | `anchor.ts:33-47`                |
| Arrow                                                                     | ❌                                                                                                                                                  | —                                |
| `--anchor-width/height`, `--available-width/height`, `--transform-origin` | ❌ Sets inline `max-width`/`max-height` instead                                                                                                     | `anchor.ts:818-821`              |
| `data-side`, `data-align`                                                 | ⚠️ `data-anchor-placement="bottom-start"` (combined)                                                                                                | `anchor.ts:781`                  |
| `data-open` / `data-closed`, trigger `data-popup-open`                    | ❌ Use `:popover-open` in CSS                                                                                                                       | —                                |
| `data-starting-style` / `data-ending-style`                               | ❌ Use `@starting-style`                                                                                                                            | —                                |
| Viewport (animated content swap), `handle`/multiple triggers              | ❌                                                                                                                                                  | —                                |
| Inset alignment / align to an inner element                               | ✅ Remix extra: `inset`, `relativeTo`                                                                                                               | `anchor.ts:55-58`                |

**Stems must add** (in `stems-ui/popover`, as a thin wrapper):

- Open state with `defaultOpen`, `open` and `onOpenChange`.
- A trigger mixin that sets `aria-expanded`, `aria-haspopup="dialog"`, `aria-controls` and
  `data-popup-open`, and toggles open on click.
- `role="dialog"` and `aria-labelledby`/`aria-describedby` from Title/Description parts.
- `data-open`/`data-closed` and `data-side`/`data-align`, split from `data-anchor-placement`.
- An Arrow part.

`modal={false}` (no scroll lock) **can't** be done on top of `popover.surface`, because the lock
is unconditional. Either ask upstream for an option (§13), or have Stems use `anchor()`
directly for non-modal popovers.

---

## 5. Menu → `@remix-run/ui/menu` — verdict **R+**

| Base UI part / prop                                                        | Remix                                                                                                              | Evidence                           |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| Root, Trigger, Positioner+Popup, Item                                      | ✅ `Context`, `trigger()`, `popover()`, `list()`, `item()`                                                         | `menu.tsx:1284-1290`               |
| Root `open` / `defaultOpen` / `onOpenChange`                               | ❌ Open state is internal only (`let open`). No callback                                                           | `menu.tsx:244, 293-331`            |
| Trigger ARIA                                                               | ✅ `aria-haspopup="menu"`, `aria-expanded`, `aria-controls`                                                        | `menu.tsx:786-791`                 |
| Trigger `openOnHover`, `delay`, `closeDelay`                               | ❌ (only submenus open on hover)                                                                                   | `menu.tsx:776-830`                 |
| Keyboard opening: ArrowDown→first, ArrowUp→last, Enter/Space→list          | ✅                                                                                                                 | `menu.tsx:809-827`                 |
| `loopFocus` (default `true`)                                               | ❌ Navigation **stops at the ends**                                                                                | `menu.tsx:491-510`, README:93      |
| `orientation`                                                              | ❌ Vertical only                                                                                                   | `menu.tsx:995-1015`                |
| Typeahead, item `label`                                                    | ✅ `searchValue` / `label`                                                                                         | `menu.tsx:517-534, 1046-1048`      |
| `highlightItemOnHover`, `onItemHighlighted`                                | ⚠️ Always highlights on hover. No callback                                                                         | `menu.tsx:1110-1116`               |
| Item `closeOnClick`                                                        | ❌ **Every activation closes the whole tree** (Base UI defaults checkbox/radio items to `closeOnClick=false`)      | `menu.tsx:584`                     |
| Item `disabled`                                                            | ✅ `aria-disabled`. Skipped by navigation and not focusable                                                        | `menu.tsx:1102, 261-263`           |
| CheckboxItem `checked` / `defaultChecked` / `onCheckedChange`              | ⚠️ `type:'checkbox'` + `checked` is **app-controlled**. The new state arrives in `MenuSelectEvent.item.checked`    | `menu.tsx:551-571, 1092-1101`      |
| RadioGroup / RadioItem `value` / `onValueChange`                           | ⚠️ `type:'radio'`. No group concept: the app sets `checked` on each item                                           | `menu.tsx:68-76`                   |
| Item indicators (Checkbox/Radio)                                           | ❌ The app renders them from `aria-checked`                                                                        | —                                  |
| Group / GroupLabel                                                         | ❌ The app writes `role="group"` markup                                                                            | —                                  |
| Separator                                                                  | ❌ The app writes `role="separator"` markup                                                                        | —                                  |
| LinkItem                                                                   | ❌                                                                                                                 | —                                  |
| Submenu (SubmenuRoot/SubmenuTrigger)                                       | ✅ Nested `Context` + `submenuTrigger()`, with hover aim. Opens with ArrowRight, closes with ArrowLeft             | `menu.tsx:1136-1282`               |
| Submenu `delay` / `closeDelay` / `openOnHover`                             | ⚠️ Fixed 300ms delay. Always opens on hover                                                                        | `menu.tsx:21, 1188-1202`           |
| `closeParentOnEsc`                                                         | ⚠️ Escape always closes the whole tree                                                                             | `menu.tsx:1036-1040`               |
| `modal` (default `true`)                                                   | ⚠️ Scroll lock is always on (inherited from popover). No outside-pointer blocking                                  | `popover.ts:113`                   |
| Positioner                                                                 | ⚠️ Through `trigger(anchorOptions)` (default `bottom-start`). Same limits as §4                                    | `menu.tsx:798-801`                 |
| Menu.Input / Clear / Empty / FilterProvider (filterable menus, new in 1.9) | ❌                                                                                                                 | —                                  |
| Viewport, Backdrop, Arrow, `handle`                                        | ❌                                                                                                                 | —                                  |
| `data-open/closed`, trigger `data-popup-open`/`data-pressed`               | ❌ (use `:popover-open` and `[aria-expanded=true]`)                                                                | —                                  |
| `data-highlighted`                                                         | ✅ `"true"` or absent                                                                                              | `menu.tsx:1104, 1214`              |
| `data-checked` / `data-unchecked`                                          | ❌ Use `[aria-checked=true]`                                                                                       | —                                  |
| Remix extras                                                               | `data-menu-flash` (60ms selection flash), `data-close-animation="none"`, `data-menu-submenu`, `data-submenu-state` | `menu.tsx:20, 914-917, 1103, 1213` |

**Stems must add:**

- `stems-ui/menu` parts for RadioGroup, CheckboxItem and their indicators. They keep the
  checked/value state and listen to `onMenuSelect`.
- Group/GroupLabel and Separator parts (markup and ARIA only).
- A LinkItem part.

**Needs upstream (§13):** `closeOnClick`, `loopFocus`, controlled `open` with
`onOpenChange`, `openOnHover` on the root trigger, and RTL arrow keys.

---

## 6. Context Menu → `menu.contextTrigger()` — verdict **R+**

| Base UI                               | Remix                                                                | Evidence           |
| ------------------------------------- | -------------------------------------------------------------------- | ------------------ |
| Opens at the pointer on right-click   | ✅ Uses a virtual `AnchorPoint`                                      | `menu.tsx:876-881` |
| Keyboard (ContextMenu key, Shift+F10) | ✅ Anchors to the trigger rect                                       | `menu.tsx:882-901` |
| Long press on touch                   | ❌                                                                   | —                  |
| Trigger `data-popup-open`             | ❌ (`aria-expanded` is set, which is unusual on a non-button region) | `menu.tsx:864-869` |
| Positioner `align='start'` and so on  | ⚠️ `placement: 'bottom-start'` + flip                                | `menu.tsx:849-855` |
| Everything else                       | Same as §5                                                           | —                  |

**Stems adds:** long press, a `data-popup-open` alias, and the §5 parts. It shares
`stems-ui/menu`.

---

## 7. Select → `@remix-run/ui/select` — verdict **R+**

| Base UI part / prop                                                      | Remix                                                                                                                                             | Evidence                                            |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Root, Trigger, Value, Popup, List, Item, hidden input                    | ✅ `Context`, `trigger()`, `popover()` (inside a `popover.Context`), `list()`, `option()`, `hiddenInput()`. The value is `context.displayedLabel` | `select.tsx:483-488`, README:15-40                  |
| `value` / `onValueChange`                                                | ❌ **Uncontrolled only**: `defaultValue` + bubbling `SelectChangeEvent`                                                                           | `select.tsx:56-63, 188-195`                         |
| `open` / `defaultOpen` / `onOpenChange`                                  | ❌ Internal state machine                                                                                                                         | `select.tsx:65, 113-154`                            |
| Value `placeholder`                                                      | ⚠️ `defaultLabel` is required. **Quirk:** with `defaultValue`, the trigger still shows `defaultLabel` until the user commits a new value          | `select.tsx:341-346`, README:86                     |
| `multiple`                                                               | ❌ `ListboxValue = string \| null`                                                                                                                | `listbox.ts:13`                                     |
| `name`                                                                   | ✅ through `hiddenInput()`                                                                                                                        | `select.tsx:474-480`                                |
| `required`, `readOnly`, `form`, `autoComplete`                           | ❌                                                                                                                                                | `select.tsx:56-63`                                  |
| `disabled` (root), item `disabled`                                       | ✅ / ✅                                                                                                                                           | `select.tsx:398, 476`, `listbox.ts:332-335`         |
| Items as `{label, value}` objects, `itemToString*`, `isItemEqualToValue` | ❌ Strings only                                                                                                                                   | `listbox.ts:298-304`                                |
| Group / GroupLabel / Separator / Label                                   | ❌                                                                                                                                                | —                                                   |
| ItemText / ItemIndicator                                                 | ❌ App markup (`[aria-selected=true]`)                                                                                                            | —                                                   |
| ScrollUpArrow / ScrollDownArrow                                          | ❌                                                                                                                                                | —                                                   |
| `alignItemWithTrigger` (default `true`)                                  | ⚠️ **Always on and can't be changed.** Anchor is `left` + `inset` + `relativeTo` the selected option                                              | `select.tsx:128-134, 136-148`                       |
| Popup min-width = trigger width                                          | ✅                                                                                                                                                | `select.tsx:120-126`                                |
| Typeahead (closed trigger and open list)                                 | ✅ Closed-trigger typeahead **selects immediately**                                                                                               | `select.tsx:233-246, 406-408`, `listbox.ts:291-293` |
| Keyboard: Arrows, Home/End, Enter/Space                                  | ✅ Arrows wrap at the end (`next`) but not at the start (`previous`)                                                                              | `listbox.ts:206-237, 264-289`                       |
| Tab while open                                                           | ⚠️ `preventDefault()` and highlights the first option, so Tab doesn't leave the list                                                              | `listbox.ts:273-276`                                |
| `modal` (default `true`)                                                 | ⚠️ Scroll lock only                                                                                                                               | `popover.ts:113`                                    |
| `data-selected` / `data-highlighted`                                     | ⚠️ `aria-selected`, `data-highlighted="true\|false"` (note: **always present**)                                                                   | `listbox.ts:331-333`                                |
| Trigger `data-popup-open`, `data-placeholder`, field attributes          | ❌ (`aria-expanded` is set)                                                                                                                       | `select.tsx:393-399`                                |
| Remix extras                                                             | `data-select-flash` on the chosen option; `labelSwapDelayMs`                                                                                      | `select.tsx:22, 373`                                |

Also: the trigger sets `aria-describedby` to the selected option id (`select.tsx:397`), which
is unusual. Watch it in screen-reader tests.

**Stems must add:**

- `stems-ui/select` wrapper parts: Value with placeholder, Group/Label, ItemIndicator, and
  `data-placeholder`/`data-popup-open` aliases.
- `required` and `readOnly`. Add these to the hidden input plus `aria-required`, or ask
  upstream.

Controlled `value` and `open` can't be added from outside, because the state machine is
closed. Ask upstream for both.

**Multiple** → `stems-ui/select-multiple` (S, phase 3). Build it on `listbox` + `popover`:
keep a `string[]` and override each option's `aria-selected` on the host (`attrs` defaults
lose to host props; see §1). Retire it if upstream ships `multiple`.

---

## 8. Combobox → `@remix-run/ui/combobox` — verdict **R+**

| Base UI part / prop                                                    | Remix                                                                                                                             | Evidence                           |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Root, Input, Popup, List, Item, hidden input                           | ✅ `Context`, `input()`, `popover()`, `list()`, `option()`, `hiddenInput()`                                                       | `combobox.tsx:905-910`             |
| `value` / `onValueChange`                                              | ❌ Uncontrolled only (`defaultValue`) + `ComboboxChangeEvent`. Also `ref` → `ComboboxHandle` (read state, `open()`, `close()`)    | `combobox.tsx:59-76, 607-632`      |
| `inputValue` / `defaultInputValue` / `onInputValueChange`              | ❌ **Quirk:** the initial input text is set to the `defaultValue` _value_ string, not its label                                   | `combobox.tsx:688-692`             |
| `open` / `onOpenChange` / `openOnInputClick`                           | ⚠️ Internal. Clicking the input opens it                                                                                          | `combobox.tsx:775-781`             |
| Free text (no commit required)                                         | ❌ **Blur clears any text that doesn't match exactly**                                                                            | `combobox.tsx:527-531`, README:107 |
| `filter` / `useFilter` / locale                                        | ❌ Hardcoded, case-insensitive `startsWith` on `label`/`searchValue`                                                              | `combobox.tsx:124-133`             |
| Filtering applied                                                      | ✅ Non-matching options get `hidden`                                                                                              | `combobox.tsx:886-889`             |
| Empty state                                                            | ❌ **The popup closes when nothing matches**, so `Combobox.Empty` can't be built                                                  | `combobox.tsx:429-431, 510-520`    |
| `autoHighlight`, `loopFocus`, `limit`, `virtualized`, `grid`, `inline` | ❌ / ⚠️ (wraps at the end only) / ❌ / ❌ / ❌ / ❌                                                                               | `listbox.ts:216-224`               |
| `multiple` + Chips / Chip / ChipRemove                                 | ❌                                                                                                                                | —                                  |
| Trigger (button), Clear, Icon, InputGroup                              | ❌                                                                                                                                | —                                  |
| Group / GroupLabel / Separator / Status / Collection                   | ❌                                                                                                                                | —                                  |
| ItemIndicator                                                          | ❌ App markup                                                                                                                     | —                                  |
| `required` / `readOnly` / `form`                                       | ❌ (`name` and `disabled` only)                                                                                                   | `combobox.tsx:70-76`               |
| Input ARIA                                                             | ✅ `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, `autocomplete="off"` | `combobox.tsx:756-767`             |
| Keyboard: ArrowDown/Up open + navigate, Enter selects, Escape          | ✅                                                                                                                                | `combobox.tsx:785-820`             |
| Focus stays in the input while clicking an option                      | ✅                                                                                                                                | `combobox.tsx:890-894`             |
| `data-popup-open`, `data-list-empty`, `data-selected`                  | ❌ / ❌ / ⚠️ `aria-selected`                                                                                                      | —                                  |
| Remix extras                                                           | `data-surface-visible` (input), `data-show-reason="hint\|nav"` (popup), `data-combobox-flash`                                     | `combobox.tsx:763, 835, 734`       |

**Stems must add** (in `stems-ui/combobox`, as wrapper parts): Trigger and Clear buttons
driven by `ComboboxHandle.open()`/`close()`, Group/Label, ItemIndicator, and state-attribute
aliases.

**Needs upstream:** controlled `value`/`inputValue`, a pluggable `filter`, an option to keep
the popup open with an empty list, and `required`.
**Multiple/chips** → `stems-ui/combobox-multiple` (S, phase 3), built on `listbox` +
`popover` + `anchor`.

---

## 9. Tabs → `@remix-run/ui/tabs` — verdict **R+**

| Base UI part / prop                                               | Remix                                                                                                              | Evidence                         |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| Root / List / Tab / Panel                                         | ✅ `Context`, `root()`, `list()`, `tab({name})`, `panel({name})`                                                   | `tabs.ts:350-354`                |
| `value` / `defaultValue` / `onValueChange`                        | ✅ `activeTab` / `defaultActiveTab` / `onActiveTabChange`. If neither is set, the first enabled tab becomes active | `tabs.ts:42-48, 96-107, 184-190` |
| `null` value (no active tab)                                      | ⚠️ Uncontrolled mode picks the first enabled tab automatically                                                     | `tabs.ts:187-189`                |
| `activateOnFocus` (default **`false`**, i.e. manual)              | ❌ **Always automatic**: arrow keys focus _and_ activate                                                           | `tabs.ts:169-173`                |
| `loopFocus` (default `true`)                                      | ✅ Always wraps                                                                                                    | `tabs.ts:161-166`                |
| `orientation`, `aria-orientation`                                 | ❌ Left/Right and Up/Down are both handled. No `aria-orientation`                                                  | `tabs.ts:299-309, 251-254`       |
| RTL                                                               | ❌ ArrowLeft always means "previous"                                                                               | `tabs.ts:306-308`                |
| Tab `disabled`                                                    | ✅ native `disabled` (not focusable)                                                                               | `tabs.ts:266, 281`               |
| Panel `keepMounted`                                               | ⚠️ Always mounted, with `hidden` + `inert`                                                                         | `tabs.ts:342-344`                |
| Panel `tabIndex=0` (APG)                                          | ❌                                                                                                                 | `tabs.ts:339-346`                |
| Indicator + `--active-tab-*` variables                            | ❌                                                                                                                 | —                                |
| `data-activation-direction`                                       | ⚠️ `TabsChangeEvent` has `previousActiveTab`, but there's no attribute                                             | `tabs.ts:59-70`                  |
| `data-active` / `data-orientation` / `data-index` / `data-hidden` | ⚠️ `data-state="active\|inactive"` on tab and panel, `aria-selected`. Root `data-disabled`                         | `tabs.ts:239, 279-280, 341`      |

**Stems must add:** a `stems-ui/tabs` Indicator part. It measures the active tab
(`[aria-selected=true]` inside the list) and writes `--active-tab-left/top/width/height`
with a ResizeObserver. Optionally add `data-activation-direction`, derived from
`onTabsChange`.

**Needs upstream:** manual activation, `orientation` with `aria-orientation`, and RTL.
Without manual activation the behavior is valid APG but doesn't match Base UI's default.
That's acceptable for phase 1.

---

## 10. Switch → `@remix-run/ui/toggle` — verdict **R**

| Base UI part / prop                                 | Remix                                                                   | Evidence                 |
| --------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------ |
| Root                                                | ✅ `toggle()` on `<input type=checkbox>` (native) or on any custom host | `toggle.ts:60-186`       |
| Thumb                                               | ⚠️ App markup or a pseudo-element. No part                              | —                        |
| `checked` / `defaultChecked` / `onCheckedChange`    | ✅ + bubbling `ToggleChangeEvent`                                       | `toggle.ts:68-108`       |
| `disabled` / `readOnly` / `required`                | ✅ Native attributes on an input; `aria-*` on custom hosts              | `toggle.ts:116-128`      |
| `name` / `value` / `form`                           | ✅ **Native input host only.** A custom host doesn't submit             | `toggle.ts:125-126, 144` |
| `uncheckedValue`                                    | ❌                                                                      | —                        |
| `inputRef`                                          | ✅                                                                      | `toggle.ts:151-155`      |
| `role="switch"`, `aria-checked`                     | ✅ (overrides host props, see §1)                                       | `toggle.ts:118, 129`     |
| Space toggles; Enter on custom hosts                | ✅ Space. Enter only through the native `<button>` click                | `toggle.ts:173-180`      |
| `data-checked` / `data-unchecked`                   | ⚠️ `data-state="checked\|unchecked"`                                    | `toggle.ts:145`          |
| `data-disabled/readonly/required`, field attributes | ❌ Use `:disabled`/`[aria-disabled]`                                    | —                        |

**Verdict R.** Stems uses the native-input host (`appearance:none` + `::before` thumb) so
forms work without extra code. `uncheckedValue` and Field validity attributes come with Field
in phase 3.

---

## 11. Components Remix doesn't cover — verdict **S**

"Builds on" lists the Remix pieces each one can reuse. Pieces marked _(lib)_ live in Remix's
unexported `lib/` folder. Stems keeps a copy until Remix exports them (§13).

| Base UI               | Stems               | Phase | Builds on                                                                | Notes                                                                                                                                                                            |
| --------------------- | ------------------- | ----- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Button                | button              | 1     | —                                                                        | `focusableWhenDisabled` → `aria-disabled` + click guard. `data-disabled`                                                                                                         |
| Input                 | input               | 1     | —                                                                        | Field state attributes come in phase 3                                                                                                                                           |
| Separator             | separator           | 1     | —                                                                        | `role=separator`, `aria-orientation`, `data-orientation`                                                                                                                         |
| Avatar                | avatar              | 1     | `animation`                                                              | Image loading status → `data-loading`/`data-error`. Fallback `delay`                                                                                                             |
| Progress              | progress            | 1     | —                                                                        | `role=progressbar`, `data-complete`/`data-indeterminate`/`data-progressing`, `Intl.NumberFormat`                                                                                 |
| Meter                 | meter               | 1     | —                                                                        | `role=meter`, `aria-valuetext`                                                                                                                                                   |
| Dialog                | dialog              | 2     | _(lib)_ scroll-lock                                                      | Native `<dialog>.showModal()` gives the focus trap and inert background. Add `data-open`, nested-dialog count, Title/Description ids                                             |
| Alert Dialog          | alert-dialog        | 2     | dialog                                                                   | `role=alertdialog`, no outside dismiss                                                                                                                                           |
| Drawer                | drawer              | 2     | dialog, `animation` (spring)                                             | Swipe-to-dismiss, snap points, swipe variables. Biggest phase-2 item                                                                                                             |
| Tooltip               | tooltip             | 2     | `anchor`, _(lib)_ hover-aim                                              | Don't use `popover.surface`: it locks scroll and handles clicks outside. Use `anchor()` + `popover="hint"`/`manual`. Provider delay group                                        |
| Preview Card          | preview-card        | 2     | `anchor`, _(lib)_ hover-aim, _(lib)_ outside-click                       | Hover/focus open with delays (600/300ms)                                                                                                                                         |
| Toast                 | toast               | 2     | `animation` (`animateEntrance`/`animateExit`, `animateLayout`), `anchor` | Manager, stacking, swipe, `aria-live` region. No overlap with Remix                                                                                                              |
| Field                 | field               | 3     | —                                                                        | Label/Control/Description/Error ids, constraint validation, `data-valid/invalid/dirty/touched/filled/focused`                                                                    |
| Fieldset              | fieldset            | 3     | —                                                                        | Native `<fieldset>`/`<legend>`                                                                                                                                                   |
| Form                  | form                | 3     | field                                                                    | `errors`, `validationMode`, `onFormSubmit`                                                                                                                                       |
| Checkbox              | checkbox            | 3     | —                                                                        | Can't reuse `toggle`: `role="switch"` is hardcoded (`toggle.ts:129`). Add `indeterminate` and `parent`                                                                           |
| Checkbox Group        | checkbox-group      | 3     | checkbox                                                                 | `allValues`, parent checkbox                                                                                                                                                     |
| Radio Group           | radio-group         | 3     | —                                                                        | Roving tabindex. Arrow keys check the radio                                                                                                                                      |
| Toggle (aria-pressed) | toggle-button       | 3     | —                                                                        | `pressed`/`defaultPressed`/`onPressedChange`, `data-pressed`                                                                                                                     |
| Toggle Group          | toggle-button-group | 3     | toggle-button                                                            | `multiple`, `orientation`, `loopFocus`, roving tabindex                                                                                                                          |
| Number Field          | number-field        | 3     | —                                                                        | Steps, `Intl` format/parse, scrub area, wheel                                                                                                                                    |
| Slider                | slider              | 3     | —                                                                        | Multiple thumbs, pointer capture, `thumbAlignment`, `minStepsBetweenValues`                                                                                                      |
| OTP Field             | otp-field           | 3     | —                                                                        | `length`, `mask`, paste distribution, `autoSubmit`                                                                                                                               |
| Select (multiple)     | select-multiple     | 3     | `listbox`, `popover`, `anchor`                                           | See §7                                                                                                                                                                           |
| Combobox (multiple)   | combobox-multiple   | 3     | `listbox`, `popover`, `anchor`                                           | Chips. See §8                                                                                                                                                                    |
| Autocomplete          | autocomplete        | 4     | `listbox`, `popover`, `anchor`                                           | Free-text input. Can't wrap `combobox` (blur clears text, `combobox.tsx:527-531`)                                                                                                |
| Menubar               | menubar             | 4     | `menu`                                                                   | Roving focus across `menu.trigger()`s, switching menus on hover while one is open, Left/Right between menus. Needs controllable menu `open` (§13) or reads `menu.Context.isOpen` |
| Navigation Menu       | navigation-menu     | 4     | `popover`/`anchor`, _(lib)_ hover-aim                                    | Shared Viewport with size variables, `data-activation-direction`, links                                                                                                          |
| Toolbar               | toolbar             | 4     | —                                                                        | Roving tabindex, `focusableWhenDisabled`. Can host toggle-button-group and menu triggers                                                                                         |
| Scroll Area           | scroll-area         | 4     | —                                                                        | Custom scrollbars, overflow-edge attributes/variables                                                                                                                            |
| Direction Provider    | direction-provider  | 5     | —                                                                        | Stems context + `dir`. **Remix primitives ignore it** (§1), so ask upstream                                                                                                      |
| CSP Provider          | csp-provider        | 5     | —                                                                        | See below                                                                                                                                                                        |

**About CSP:** the Remix runtime's client styles use `adoptedStyleSheets`, which inline-style
CSP doesn't block (`@remix-run/component src/style/stylesheet.ts:103-111`). But SSR emits
`<style data-rmx-style>` tags **without a nonce** (`src/server/stream.ts:1455-1463`). A Stems
CSP provider can only nonce styles that Stems emits itself. The real fix is upstream.

`mergeProps` / `useRender`: **n/a**. Remix's `mix` arrays and `attrs()` defaults cover prop
merging and element replacement natively.

### Remix-only modules (no Base UI counterpart)

- `listbox`: a standalone option list (single value, `aria-activedescendant` pattern).
  It's the base for select, combobox and the Stems multi-value variants.
- `anchor`: imperative positioning. It's the base for tooltip, preview card and navigation
  menu.
- `animation`: entrance/exit/layout mixins plus spring/tween. It fills the role of Base UI's
  `data-starting-style`/`data-ending-style` for content that mounts and unmounts.

---

## 12. Remix data attributes and conventions

Styled components target these. Use the exact values: some attributes are `"true"`/absent,
others are `"true"`/`"false"`.

### Data attributes

| Attribute               | Values                                    | Set on                                                 | Source                                  |
| ----------------------- | ----------------------------------------- | ------------------------------------------------------ | --------------------------------------- |
| `data-state`            | `open` / `closed`                         | accordion item, trigger, content                       | `accordion.tsx:385, 413, 452`           |
| `data-state`            | `active` / `inactive`                     | tab, tab panel                                         | `tabs.ts:82-84, 280, 341`               |
| `data-state`            | `checked` / `unchecked`                   | toggle (switch) host                                   | `toggle.ts:145`                         |
| `data-disabled`         | `""` / absent                             | accordion root and item, tabs root                     | `accordion.tsx:374, 384`, `tabs.ts:239` |
| `data-type`             | `single` / `multiple`                     | accordion root                                         | `accordion.tsx:375`                     |
| `data-highlighted`      | `"true"` / **absent**                     | menu item, submenu trigger                             | `menu.tsx:1104, 1214`                   |
| `data-highlighted`      | `"true"` / **`"false"`**                  | listbox option (select, combobox)                      | `listbox.ts:333`                        |
| `data-anchor-placement` | one of 12 placements, after flipping      | any anchored surface (popover, menu, select, combobox) | `anchor.ts:781`                         |
| `data-menu-flash`       | `"true"` / absent, for 60ms               | the menu item just activated                           | `menu.tsx:20, 1103`                     |
| `data-close-animation`  | `"none"` / absent                         | menu popover (when closing instantly)                  | `menu.tsx:915`                          |
| `data-menu-submenu`     | `"true"` / absent                         | submenu popover                                        | `menu.tsx:916`                          |
| `data-submenu-state`    | `dismissing` / `selecting` / absent       | submenu trigger                                        | `menu.tsx:1213`                         |
| `data-select-flash`     | `"true"`, for 60ms                        | the chosen select option                               | `select.tsx:373`, `listbox.ts:179-183`  |
| `data-combobox-flash`   | `"true"`, for 60ms                        | the chosen combobox option                             | `combobox.tsx:734`                      |
| `data-surface-visible`  | `"true"` / absent                         | combobox input                                         | `combobox.tsx:763`                      |
| `data-show-reason`      | `hint` (typing) / `nav` (keyboard/click)  | combobox popover                                       | `combobox.tsx:835`                      |
| `data-listbox-flash`    | default flash attribute for raw `listbox` | listbox option                                         | `listbox.ts:181`                        |

### ARIA and native attributes

| Part                             | Attributes                                                                                                                                                                           | Source                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| accordion trigger                | `aria-expanded`, `aria-controls`, `aria-disabled` (locked open), `disabled`, `id`                                                                                                    | `accordion.tsx:409-416`                      |
| accordion content                | `aria-labelledby`, `aria-hidden` + `inert` when closed, `id` (no `role`, no `hidden`)                                                                                                | `accordion.tsx:449-455`                      |
| tabs list / tab / panel          | `role=tablist` (+`aria-disabled`); `role=tab`, `aria-selected="true\|false"`, `aria-controls`, roving `tabIndex`, `disabled`; `role=tabpanel`, `aria-labelledby`, `hidden` + `inert` | `tabs.ts:251-254, 277-286, 339-346`          |
| switch                           | `role=switch`; native `checked`/`disabled`/`required`/`readOnly` on inputs; `aria-checked/disabled/readonly/required` + `tabIndex=0` on custom hosts                                 | `toggle.ts:116-146`                          |
| popover surface                  | `popover="manual"` only. Use `:popover-open` for open state                                                                                                                          | `popover.ts:103`                             |
| menu trigger / contextTrigger    | `aria-haspopup=menu`, `aria-expanded`, `aria-controls`, `id`                                                                                                                         | `menu.tsx:786-791, 864-869`                  |
| menu list                        | `role=menu`, `tabIndex=-1`, `aria-label` or `aria-labelledby` (trigger)                                                                                                              | `menu.tsx:955-961`                           |
| menu item                        | `role=menuitem\|menuitemcheckbox\|menuitemradio`, `tabIndex=-1`, `aria-checked`, `aria-disabled`                                                                                     | `menu.tsx:1088-1102`                         |
| submenu trigger                  | `role=menuitem`, `aria-haspopup=menu`, `aria-expanded`, `aria-controls`                                                                                                              | `menu.tsx:1205-1212`                         |
| listbox list / option            | `role=listbox`, `tabIndex=-1`; `role=option`, `aria-selected="true\|false"`, `aria-disabled="true\|false"`                                                                           | `listbox.ts:256-259, 328-333`                |
| select trigger                   | `aria-haspopup=listbox`, `aria-expanded`, `aria-controls`, `aria-describedby`=selected option, `disabled`                                                                            | `select.tsx:393-399`                         |
| select list                      | `id`, `aria-activedescendant`                                                                                                                                                        | `select.tsx:458-461`                         |
| combobox input                   | `role=combobox`, `aria-autocomplete=list`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, `aria-haspopup=listbox`, `autocomplete=off`                                    | `combobox.tsx:756-767`                       |
| combobox option                  | `hidden` when filtered out                                                                                                                                                           | `combobox.tsx:889`                           |
| hidden inputs (select, combobox) | `type=hidden`, `name`, `value`, `disabled`                                                                                                                                           | `select.tsx:474-480`, `combobox.tsx:872-878` |

### Mapping to Base UI's selectors

Stems themes should use the left column. Optionally, Stems wrappers can also set the Base UI
names, so Base UI-style CSS (shadcn ports) works without changes.

| Base UI selector                                                    | Remix equivalent                                                                   |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `[data-open]` / `[data-closed]` (popups)                            | `:popover-open` / `:not(:popover-open)`                                            |
| `[data-open]` (accordion item/panel), `[data-panel-open]` (trigger) | `[data-state=open]`                                                                |
| `[data-active]` (tab)                                               | `[data-state=active]` or `[aria-selected=true]`                                    |
| `[data-checked]` (switch)                                           | `[data-state=checked]` or `:checked`                                               |
| `[data-checked]` (menu checkbox/radio item)                         | `[aria-checked=true]`                                                              |
| `[data-selected]` (select/combobox item)                            | `[aria-selected=true]`                                                             |
| `[data-highlighted]`                                                | menu: `[data-highlighted]`. **listbox: `[data-highlighted=true]`**                 |
| `[data-disabled]` (items)                                           | `[aria-disabled=true]` or `:disabled`                                              |
| `[data-popup-open]` (triggers)                                      | `[aria-expanded=true]`                                                             |
| `[data-side=top]`                                                   | `[data-anchor-placement^=top]`                                                     |
| `[data-starting-style]`                                             | `@starting-style { … }` inside `:popover-open`                                     |
| `[data-ending-style]`                                               | transition with `allow-discrete` on `:not(:popover-open)`. Menu/select wait for it |

---

## 13. Requests for upstream

Ordered by how much Stems code each one would remove.

1. **Export the `lib/` helpers** as public subpaths, e.g. `@remix-run/ui/outside-click`,
   `scroll-lock`, `typeahead`, `hover-aim`, `keydown`, `wait-for-css-transition`,
   `flash-attribute`. They exist in `dist/lib/` but `package.json` `exports` leaves them out.
   Without them, Stems must copy them for dialog (scroll lock), tooltip, preview card and
   navigation menu (hover aim), radio group, toolbar and toggle group (typeahead,
   keydown), and Autocomplete (outside click).
2. **Popover: make scroll lock optional** (`modal?: boolean`, default `false` to match
   Base UI). It's currently unconditional (`popover.ts:113`), which makes `popover.surface`
   unusable for tooltip, preview card, or non-modal popovers.
3. **Popover trigger mixin**: `popover.trigger()` that sets `aria-expanded`,
   `aria-haspopup`, `aria-controls`, and toggles open. Also `role="dialog"` with title and
   description wiring on the surface. Every app now repeats this, and `anchor()` sets no
   ARIA (`popover.ts:54-67`).
4. **Controlled values and open state** on select (`value`/`onValueChange`,
   `open`/`onOpenChange`), combobox (`value`, `inputValue`, `open`), and menu
   (`open`/`onOpenChange`). The internal state machines (`select.tsx:65`, `menu.tsx:244`,
   `combobox.tsx:169`) can't be driven from outside. Menubar needs a controllable menu
   `open`.
5. **`multiple` in `listbox`** (`ListboxValue` → `string | string[]`, `listbox.ts:13`), then
   in select and combobox. That would retire `select-multiple`/`combobox-multiple`.
6. **Menu `closeOnClick`** per item (keep checkbox/radio menus open, `menu.tsx:584`), **menu
   `loopFocus`** (`menu.tsx:491-510`), **root trigger `openOnHover`**, and configurable
   submenu delay (`menu.tsx:21`).
7. **Tabs:** `activateOnFocus` (manual activation), `orientation` → `aria-orientation`
   and axis-specific arrows (`tabs.ts:298-323`), and panel `tabIndex=0`.
8. **Direction:** a `dir` context (or read `closest('[dir]')`) for RTL arrow keys in tabs,
   menu and accordion, and logical `start`/`end` placements in `anchor`.
9. **Anchor:** `collisionPadding` (hardcoded to 16, `anchor.ts:67`), an arrow element
   position, and CSS variables (`--anchor-width`, `--available-height`) in addition to or
   instead of inline `max-*` (`anchor.ts:818-821`). Also split `data-side` and `data-align`.
10. **Combobox:** a pluggable `filter` (now `startsWith`, `combobox.tsx:124-133`), an option
    to keep the popup open with an empty list (`combobox.tsx:429, 510`) for an Empty part,
    and an opt-out of "clear on non-matching blur" (`combobox.tsx:527-531`). The last one
    would let Autocomplete reuse combobox.
11. **Form integration:** `required`, `readOnly` and `form` on select and combobox hidden
    inputs. `uncheckedValue` on toggle.
12. **SSR style nonce:** a `nonce` option for `<style data-rmx-style>` emitted by
    `@remix-run/component` (`server/stream.ts:1462`). This is what a CSP provider needs.
13. **Accordion:** `orientation`, `hiddenUntilFound`, panel `role="region"`, and a panel
    height variable for animation.
14. **Consistent state attributes:** `data-highlighted` is `"true"`/absent in menu but
    `"true"`/`"false"` in listbox (`menu.tsx:1104` vs `listbox.ts:333`). Use one convention.
    Also consider `data-open` on overlay surfaces for CSS that doesn't use `:popover-open`.
15. **Bugs and quirks to report:**
    - The combobox initial input text uses the `defaultValue` _value_ instead of its label
      (`combobox.tsx:690`).
    - Select shows `defaultLabel` even when `defaultValue` matches an option
      (`select.tsx:343`).
    - Tab inside an open listbox is swallowed (`listbox.ts:273-276`).
    - The select trigger's `aria-describedby` points at the selected option
      (`select.tsx:397`).
