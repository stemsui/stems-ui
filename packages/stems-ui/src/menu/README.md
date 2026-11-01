<!-- Adapted from @remix-run/ui 0.13.0 (packages/ui/src/menu/README.md). MIT License, Copyright (c) 2025 Shopify Inc. -->

# menu

`menu` wires a trigger button to a popup list of actions: menu roles, keyboard navigation with
typeahead, highlight on hover, checkbox and radio items, submenus, and the popover machinery
(top layer, positioning, dismissal, focus, enter/exit animation hooks). App code owns the markup
and visual styles.

Base UI equivalent: [Menu](https://base-ui.com/react/components/menu). Context menus are
[`stems-ui/context-menu`](../context-menu/README.md), which shares every part below.

## Usage

```tsx
import * as menu from 'stems-ui/menu'

let itemClass =
  'flex px-3 py-1.5 outline-none data-highlighted:bg-gray-100 data-disabled:opacity-50'

function ViewMenu(handle: Handle) {
  let sort = 'date'
  return () => (
    <menu.Context>
      <button mix={menu.trigger()}>View</button>
      <div
        class="min-w-40 rounded-md bg-white p-1 shadow-md data-starting-style:opacity-0 data-ending-style:opacity-0 transition-opacity"
        mix={menu.popup({ align: 'start', sideOffset: 4 })}
      >
        <div class={itemClass} mix={menu.item({ value: 'reload' })}>
          Reload
        </div>
        <div class="my-1 h-px bg-gray-200" mix={menu.separator()} />

        <menu.CheckboxItemContext defaultChecked>
          <div class={itemClass} mix={menu.checkboxItem()}>
            <span mix={menu.checkboxItemIndicator()}>✓</span> Word wrap
          </div>
        </menu.CheckboxItemContext>

        <menu.RadioGroupContext
          value={sort}
          onValueChange={(value) => {
            sort = String(value)
            void handle.update()
          }}
        >
          <div mix={menu.radioGroup()}>
            <div mix={menu.groupLabel()}>Sort by</div>
            <menu.RadioItemContext value="date">
              <div class={itemClass} mix={menu.radioItem()}>
                <span mix={menu.radioItemIndicator()}>•</span> Date
              </div>
            </menu.RadioItemContext>
            <menu.RadioItemContext value="name">
              <div class={itemClass} mix={menu.radioItem()}>
                <span mix={menu.radioItemIndicator()}>•</span> Name
              </div>
            </menu.RadioItemContext>
          </div>
        </menu.RadioGroupContext>

        <menu.SubmenuContext>
          <div class={itemClass} mix={menu.submenuTrigger()}>
            Zoom ›
          </div>
          <div class="rounded-md bg-white p-1 shadow-md" mix={menu.popup()}>
            <div class={itemClass} mix={menu.item({ value: 'zoom-in' })}>
              Zoom in
            </div>
            <div class={itemClass} mix={menu.item({ value: 'zoom-out' })}>
              Zoom out
            </div>
          </div>
        </menu.SubmenuContext>

        <a class={itemClass} href="/settings" mix={menu.linkItem()}>
          Settings
        </a>
      </div>
    </menu.Context>
  )
}
```

Listen for activations anywhere above the items:

```tsx
<div mix={menu.onMenuSelect((event) => console.log(event.kind, event.value, event.checked))}>…</div>
```

### Differences from Base UI

- **No Portal, no Positioner element.** The popup is shown in the top layer with
  `popover="manual"`; Base UI's Positioner props are options of `popup()` and the positioner's
  data attributes / CSS variables are set on the popup.
- **Item state lives in providers.** A mixin can't provide context to its children, so the
  stateful items are split like `accordion.ItemContext`: `CheckboxItemContext` (Base UI
  CheckboxItem's `checked` / `defaultChecked` / `onCheckedChange`) + `checkboxItem()`,
  `RadioGroupContext` (RadioGroup's `value` / `defaultValue` / `onValueChange`) +
  `radioGroup()`, `RadioItemContext` (RadioItem's `value`) + `radioItem()`. The indicators read
  the nearest item provider.
- **Submenus must be rendered inside the parent's popup** (in the DOM): `SubmenuContext` =
  Base UI `SubmenuRoot`.
- **Indicators always stay in the DOM** (`hidden` while unchecked). `keepMounted` keeps them
  visible instead.
- `MenuSelectEvent` (`stems:menu-select`) is a Stems extra (Remix had `onMenuSelect`); items
  accept a `value` option reported by it.
- Not supported: filterable menus (`Menu.FilterProvider` / `Input` / `Clear` / `Empty` /
  `List`), the Viewport part, `createHandle()` / detached triggers / payloads, `actionsRef`,
  `defaultTriggerId` / `triggerId`, `data-instant`, `--positioner-width/height`, the
  `'sibling-open'` / `'cancel-open'` reasons (a sibling opening reports `'none'`), opening on
  pointer down with press-drag-release selection, and outside-pointer blocking beyond `inert`.

## `stems-ui/menu`

### Providers

- `Context` (Base UI `Menu.Root`): owns the open state. Read it with
  `handle.context.get(menu.Context)` (`open`, `setOpen(open, { reason })`, `close()`,
  `highlighted`, `store`, …).
  - `open` / `defaultOpen` / `onOpenChange(open, details)`: `details` has `reason`, `event`,
    `trigger`, `cancel()`.
  - `onOpenChangeComplete(open)`: after the enter / exit animation.
  - `modal`: `true` (default) | `false` | `'trap-focus'`. `true` locks page scroll and makes
    outside content `inert`. A menu opened by hovering its trigger is never modal.
  - `loopFocus`: `boolean`, default `true`. Arrow keys wrap at the ends.
  - `orientation`: `'vertical'` (default) | `'horizontal'`. Which arrows move between items.
  - `disabled`: disables the trigger.
  - `highlightItemOnHover`: `boolean`, default `true`.
  - `onItemHighlighted(item | undefined, { reason: 'keyboard' | 'pointer' | 'none', event, label })`.
- `SubmenuContext` (Base UI `Menu.SubmenuRoot`): same props except `modal` (submenus are never
  modal), plus `closeParentOnEsc` (default `false`: Escape closes only the submenu).
- `CheckboxItemContext`: `checked` / `defaultChecked` (default `false`) /
  `onCheckedChange(checked, details)` (`details.cancel()` vetoes), `disabled`.
- `RadioGroupContext`: `value` / `defaultValue` / `onValueChange(value, details)`, `disabled`.
- `RadioItemContext`: `value` (required), `disabled`.

### Mixins

- `trigger(options?)`: `type="button"`, `id`, `aria-haspopup="menu"`, `aria-expanded`,
  `aria-controls`. Options: `disabled`, `openOnHover`, `delay` (default `100`), `closeDelay`
  (default `0`).
- `popup(options?)`: `role="menu"`, `aria-labelledby` (the trigger), `aria-orientation` when
  horizontal, `popover="manual"`, `tabIndex={-1}`, `hidden` while closed. Options: `side`
  (default `'bottom'`; submenus `'inline-end'`), `align` (default `'center'`; submenus
  `'start'`), `sideOffset`, `alignOffset`, `collisionPadding`, `arrowPadding`, `anchor`,
  `initialFocus`, `finalFocus` (see [popover](../popover/README.md)).
- `arrow()`, `backdrop()`: as in popover.
- `item(options?)`: `role="menuitem"`, `tabIndex={-1}`. Options: `label` (typeahead text,
  defaults to the text content), `disabled`, `closeOnClick` (default `true`), `value`.
- `linkItem(options?)`: for an `<a href>`. Options: `label`, `closeOnClick` (default `false`).
- `checkboxItem(options?)`: `role="menuitemcheckbox"`, `aria-checked`. Options: `label`,
  `closeOnClick` (default `false`), `value`.
- `checkboxItemIndicator(options?)` / `radioItemIndicator(options?)`: `aria-hidden`; `hidden`
  once unchecked (after its exit animation) unless `keepMounted`.
- `radioGroup()`: `role="group"`.
- `radioItem(options?)`: `role="menuitemradio"`, `aria-checked`. Options: `label`,
  `closeOnClick` (default `false`).
- `group()`: `role="group"`, `aria-labelledby` its `groupLabel()` (set after hydration).
- `groupLabel()`: an `id` for the enclosing group.
- `separator(options?)`: the generic [`stems-ui/separator`](../separator/README.md) mixin.
- `submenuTrigger(options?)`: `role="menuitem"`, `aria-haspopup="menu"`, `aria-expanded`,
  `aria-controls`. Options: `label`, `disabled`, `openOnHover` (default `true`), `delay`
  (default `100`), `closeDelay` (default `0`).

### Events

- `MenuChangeEvent` (`stems:menu-change`, `onMenuChange(handler)`): bubbles from the active
  trigger (a submenu's from its submenu trigger) with `open` and `reason`.
- `MenuSelectEvent` (`stems:menu-select`, `onMenuSelect(handler)`): bubbles from an activated
  item, after checkbox / radio state changed, with `item` (the element), `kind` (`'item'` |
  `'checkbox-item'` | `'radio-item'` | `'link-item'`), `label`, `value` (the radio value; the
  `href` for links), `checked`, and `closeOnClick`. It is cancelable: `preventDefault()` keeps
  the menu open.

Change reasons: `'trigger-press'`, `'trigger-hover'`, `'outside-press'`, `'escape-key'`,
`'item-press'`, `'list-navigation'`, `'focus-out'`, `'imperative-action'`, `'none'`.

## Behavior notes

- **Opening:** a pointer press on the trigger focuses the popup with nothing highlighted;
  Enter / Space / ArrowDown focus the first enabled item, ArrowUp the last.
- **Keyboard in the popup:** ArrowDown / ArrowUp (ArrowRight / ArrowLeft when horizontal,
  mirrored in RTL) move between enabled items, wrapping with `loopFocus`; Home / End; printable
  keys typeahead (repeat a letter to cycle); Enter / Space activate (they call the item's
  `click()`); Escape closes the topmost menu; Tab closes the whole tree and moves focus past
  the trigger (Shift+Tab to the trigger).
- **Submenus:** ArrowRight (ArrowLeft in RTL), Enter, or Space on a submenu trigger opens the
  submenu and focuses its first item; ArrowLeft (ArrowRight in RTL) closes it and refocuses
  the trigger. Hovering opens it after `delay` without moving focus; the pointer can cross
  sibling items on its way to the submenu (hover aim). A press on the trigger opens it (and keeps
  a hover-opened submenu open). Highlighting another parent item closes it. Escape closes only
  the submenu unless `closeParentOnEsc`. Opening a submenu closes its open siblings; closing a
  menu closes its submenus.
- **Activation:** `item()` closes the whole tree by default (reason `'item-press'`);
  checkbox, radio and link items stay open unless `closeOnClick`. Focus returns to the trigger.
- **Highlight:** items get real DOM focus. `data-highlighted` follows focus and pointer moves
  (not touch). When the pointer leaves an item for a non-item, the highlight clears and focus
  moves to the popup (a keyboard highlight is kept).
- **Dismissal:** shared dismiss-layer stack. Pressing inside the parent closes an open
  submenu; pressing outside closes the tree. With `modal` (the default) everything outside the
  popup is `inert`, so pressing the trigger is an outside press.
- Closed popups and unchecked indicators get `hidden` in server HTML; `aria-checked`,
  `data-checked` / `data-unchecked`, and `data-disabled` are correct before hydration.

## Styling hooks

| Part                               | Attribute / variable                                               | Values / notes                                                         |
| ---------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| trigger                            | `data-popup-open`, `data-pressed`                                  | present while open                                                     |
| trigger                            | `data-disabled`                                                    | present when disabled                                                  |
| popup                              | `data-open` / `data-closed`                                        | open state                                                             |
| popup                              | `data-starting-style` / `data-ending-style`                        | enter / exit transition                                                |
| popup, arrow                       | `data-side`                                                        | `top` `bottom` `left` `right` `inline-start` `inline-end` (final side) |
| popup, arrow                       | `data-align`                                                       | `start` `center` `end`                                                 |
| popup                              | `--anchor-width`, `--anchor-height`                                | trigger size                                                           |
| popup                              | `--available-width`, `--available-height`                          | space to the viewport edges                                            |
| popup                              | `--transform-origin`                                               | for scale animations                                                   |
| arrow                              | `data-uncentered`, `data-open` / `data-closed`                     |                                                                        |
| backdrop                           | `data-open` / `data-closed`, presence attrs                        |                                                                        |
| item, link, sub-trigger            | `data-highlighted`                                                 | present while highlighted                                              |
| item, checkbox, radio, sub-trigger | `data-disabled`                                                    | present when disabled                                                  |
| checkbox / radio item              | `data-checked` / `data-unchecked`                                  | checked state (also `aria-checked`)                                    |
| indicators                         | `data-checked` / `data-unchecked`, `data-disabled`, presence attrs |                                                                        |
| radio group                        | `data-disabled`                                                    | present when disabled                                                  |
| sub-trigger                        | `data-popup-open`                                                  | present while its submenu is open                                      |
| separator                          | `data-orientation`                                                 | `horizontal` / `vertical`                                              |
