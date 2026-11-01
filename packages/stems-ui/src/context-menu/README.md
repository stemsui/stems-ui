# context-menu

`context-menu` opens a menu at the pointer when an area is right-clicked or long-pressed. It is
`stems-ui/menu` with a different root and trigger: every item, group, and submenu part is the
same.

Base UI equivalent: [Context Menu](https://base-ui.com/react/components/context-menu).

## Usage

```tsx
import * as contextMenu from 'stems-ui/context-menu'

function FileRow() {
  return () => (
    <contextMenu.Context>
      <div tabIndex={0} class="select-none" mix={contextMenu.trigger()}>
        report.pdf
      </div>
      <div class="rounded-md bg-white p-1 shadow-md" mix={contextMenu.popup()}>
        <div mix={contextMenu.item({ value: 'rename' })}>Rename</div>
        <div mix={contextMenu.item({ value: 'delete' })}>Delete</div>
      </div>
    </contextMenu.Context>
  )
}
```

### Module split

Base UI exports `ContextMenu.Root` + `ContextMenu.Trigger` plus all Menu parts under the
`ContextMenu` namespace, so Stems does the same: `stems-ui/context-menu` exports its own
`Context` and `trigger()` and re-exports every `stems-ui/menu` part (`popup`, `item`,
`checkboxItem`, `RadioGroupContext`, `SubmenuContext`, `submenuTrigger`, …). Mixing parts
from either module works, since both share one implementation.

### Differences from Base UI

- Same as [menu](../menu/README.md) (no Portal / Positioner, item providers, no filtering).
- **Keyboard opening** (Shift+F10, the ContextMenu key) is a Stems addition: the menu opens at
  the area's bottom-left corner with the first item focused.
- `modal` defaults to `false` so a right click elsewhere in the area repositions the open
  menu. Opening a context menu closes any other open context menu.
- A right click outside every trigger area doesn't dismiss the menu, because the dismiss layer
  only handles left-button presses. The browser's native menu opens on top instead.

## `stems-ui/context-menu`

- `Context` (Base UI `ContextMenu.Root`): same props as `menu.Context` (`open` /
  `defaultOpen` / `onOpenChange`, `onOpenChangeComplete`, `loopFocus`, `orientation`,
  `disabled`, `highlightItemOnHover`, `onItemHighlighted`), with `modal` defaulting to `false`.
- `trigger()` (Base UI `ContextMenu.Trigger`): the area. No ARIA is added (make it focusable
  with `tabIndex={0}` for keyboard access).
  - `contextmenu` (right click): `preventDefault()`, opens at `{ clientX, clientY }` with the
    popup focused. Right-clicking again while open repositions it.
  - Touch long press (500ms, cancelled by moving more than 10px or lifting): opens at the touch
    point. The `touchend` that follows is canceled so the compatibility click doesn't close it.
  - Shift+F10 / ContextMenu key: opens at the area's bottom-left corner, focusing the first
    item.
- `popup(options?)`: as in menu, but positioned against the pointer. Defaults to `side:
'bottom'`, `align: 'start'`. The native context menu is suppressed inside the popup.
- Every other part: see [menu](../menu/README.md).
- `ContextMenuChangeEvent` (`stems:context-menu-change`, `onContextMenuChange(handler)`):
  bubbles from the popup with `open` and `reason` (`'trigger-press'` when opened).
  `MenuSelectEvent` / `onMenuSelect` as in menu.

## Behavior notes

- Focus: when the menu closes, focus returns to the element that was focused when it opened
  (`finalFocus` overrides this).
- Keyboard, typeahead, submenus, activation, and dismissal work as in menu.

## Styling hooks

| Part    | Attribute                         | Values / notes                           |
| ------- | --------------------------------- | ---------------------------------------- |
| trigger | `data-popup-open`, `data-pressed` | present while the menu is open           |
| popup … | see menu                          | `data-side` / `data-align` vs. the point |
