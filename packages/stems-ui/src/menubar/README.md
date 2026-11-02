# menubar

`menubar` turns a row (or column) of [`stems-ui/menu`](../menu/README.md) menus into an
application menu bar: the triggers become `role="menuitem"` items with one roving tab stop, the
arrow keys move between them and between open menus, and hovering another trigger while a menu is
open switches to it. App code owns the markup and visual styles.

Base UI equivalent: [Menubar](https://base-ui.com/react/components/menubar).

## Usage

```tsx
import * as menu from 'stems-ui/menu'
import * as menubar from 'stems-ui/menubar'

function AppMenu() {
  return () => (
    <menubar.Context>
      <div aria-label="Application" mix={menubar.root()}>
        <menu.Context>
          <button mix={menu.trigger()}>File</button>
          <div mix={menu.popup({ sideOffset: 4 })}>
            <div mix={menu.item()}>New tab</div>
            <menu.SubmenuContext>
              <div mix={menu.submenuTrigger()}>Share</div>
              <div mix={menu.popup()}>
                <div mix={menu.item()}>Email link</div>
              </div>
            </menu.SubmenuContext>
          </div>
        </menu.Context>
        <menu.Context>
          <button mix={menu.trigger()}>Edit</button>
          <div mix={menu.popup({ sideOffset: 4 })}>
            <div mix={menu.item()}>Undo</div>
          </div>
        </menu.Context>
      </div>
    </menubar.Context>
  )
}
```

Every `menu.Context` rendered inside `menubar.Context` (not inside another menu) joins the
menubar. Everything else about the menus (items, checkbox and radio items, groups, submenus,
events, controlled `open`) works as in `stems-ui/menu`.

## `stems-ui/menubar`

- `Context`: owns the menubar state. Props (Base UI `Menubar`):
  - `orientation`: `'horizontal'` (default; Left/Right between triggers, mirrored in RTL) or
    `'vertical'` (Up/Down; menus open to the inline-end side).
  - `loopFocus`: wrap arrow-key focus at the ends. Defaults to `true`.
  - `modal`: defaults to `true`. While a menu is open, page scroll is locked and content outside
    the menubar is inert; the menubar stays interactive so other triggers can be hovered and
    pressed. It replaces the `modal` prop of the menus inside (which is ignored).
  - `disabled`: disable every menu.
  - `handle.context.get(menubar.Context)` returns
    `{ orientation, loopFocus, modal, disabled, hasSubmenuOpen }`.
- `root()`: `role="menubar"`, `aria-orientation`, `data-orientation`, `data-modal`, and
  `data-has-submenu-open` while a menu is open. Name it with `aria-label` or `aria-labelledby`.
  Can be called without arguments.

What changes for a `menu.trigger()` in a menubar: it gets `role="menuitem"` and a roving
`tabIndex`, the menubar's `disabled` applies, and its popup defaults to `side: 'bottom'`,
`align: 'start'` (`side: 'inline-end'` in a vertical menubar). The trigger keeps its
`aria-haspopup`, `aria-expanded`, `aria-controls`, `data-popup-open`, and `data-pressed`.

## Behavior notes

- **Focus:** the triggers form one tab stop: the trigger of the open menu, else the last focused
  trigger, else the first enabled one. Disabled triggers are skipped.
- **Pointer:** pressing a trigger toggles its menu. While a menu is open, hovering another
  trigger focuses it and opens its menu (the hovered menu then stays open when the pointer
  leaves it, like a native menubar). Pressing outside closes the menu.
- **Keyboard on a trigger:** Left / Right (horizontal) or Up / Down (vertical) move between the
  triggers, Home / End go to the first / last. When a menu is open, moving to another trigger
  opens that trigger's menu (focus stays on the trigger). ArrowDown / ArrowUp (horizontal) or the
  inline-end arrow (vertical) open the menu and focus its first / last item; Enter and Space open
  it with the first item focused.
- **Keyboard in an open menu (horizontal menubar):** Left / Right open the previous / next menu
  and focus its first item, unless a submenu uses the key (Right on a submenu trigger opens the
  submenu, Left in a submenu closes it; Right on an item of a submenu moves to the next menubar
  menu, as in the WAI-ARIA menubar pattern). In a vertical menubar, the inline-start arrow closes
  the menu. Escape closes the menu and returns focus to its trigger; Tab closes it and moves on.
- **Change reasons:** a menu opened by switching reports `'list-navigation'` (arrow keys in a
  menu), `'trigger-focus'` (arrow keys on a trigger), or `'trigger-hover'`; the menu it replaces
  closes with `'none'` (Base UI reports `'sibling-open'`, which `lib/popup.ts` doesn't have).
- **Server rendering:** the root renders before its menus, so a menu that starts open
  (`defaultOpen`) is reflected in the root's `data-has-submenu-open` only after hydration.
- Base UI's `Portal` part has no Stems equivalent: popups are shown in the top layer where they
  are rendered.

| Key                        | On a trigger (horizontal)                 | In an open menu (horizontal) |
| -------------------------- | ----------------------------------------- | ---------------------------- |
| `ArrowRight` / `ArrowLeft` | Next / previous trigger (mirrored in RTL) | Next / previous menu         |
| `ArrowDown` / `ArrowUp`    | Open, focus the first / last item         | Next / previous item         |
| `Home` / `End`             | First / last trigger                      | First / last item            |
| `Enter` / `Space`          | Open, focus the first item                | Activate the item            |
| `Escape`                   | –                                         | Close, focus the trigger     |

## Styling hooks

| Part    | Attribute               | Present when / value                |
| ------- | ----------------------- | ----------------------------------- |
| root    | `data-orientation`      | `"horizontal"` or `"vertical"`      |
| root    | `data-modal`            | `modal` is `true` (the default)     |
| root    | `data-has-submenu-open` | One of the menubar's menus is open  |
| trigger | `data-popup-open`       | Its menu is open                    |
| trigger | `data-pressed`          | Its menu is open                    |
| trigger | `data-disabled`         | The menu or the menubar is disabled |

The popups and items have the `stems-ui/menu` hooks (`data-open` / `data-closed`, `data-side`,
`data-highlighted`, ...).
