# navigation-menu

`navigation-menu` builds a site navigation bar. Its triggers open panels of links in one shared
popup. The popup stays open while the user moves between items and morphs to each panel's size.
App code owns the markup and visual styles.

Base UI equivalent: [Navigation Menu](https://base-ui.com/react/components/navigation-menu).

## Usage

```tsx
import * as navigationMenu from 'stems-ui/navigation-menu'

function SiteNav() {
  return () => (
    <navigationMenu.Context>
      <nav mix={navigationMenu.root()}>
        <ul class="flex" mix={navigationMenu.list()}>
          <navigationMenu.ItemContext value="docs">
            <li>
              <button mix={navigationMenu.trigger()}>
                Docs <span mix={navigationMenu.icon()}>▾</span>
              </button>
              <navigationMenu.Content class="p-2 data-starting-style:opacity-0 data-ending-style:opacity-0">
                <a href="/docs/intro" mix={navigationMenu.link({ active: true })}>
                  Introduction
                </a>
                <a href="/docs/install" mix={navigationMenu.link()}>
                  Installation
                </a>
              </navigationMenu.Content>
            </li>
          </navigationMenu.ItemContext>
          <li>
            <a href="/blog" mix={navigationMenu.link()}>
              Blog
            </a>
          </li>
        </ul>

        <div
          class="h-(--positioner-height) w-(--positioner-width)"
          mix={navigationMenu.popup({ sideOffset: 8 })}
        >
          <div class="h-(--popup-height) w-(--popup-width) rounded-lg bg-white shadow transition-[width,height]">
            <navigationMenu.Viewport class="relative size-full overflow-hidden" />
          </div>
        </div>
      </nav>
    </navigationMenu.Context>
  )
}
```

Control the open item with `value` and `onValueChange(value, details)`, or let the context own it
with `defaultValue`. Listen for bubbling changes on any ancestor:

```tsx
<div mix={navigationMenu.onNavigationMenuChange((event) => console.log(event.value, event.reason))}>
  …
</div>
```

### Content goes into the viewport (no portals)

Base UI moves each item's `Content` into the popup's `Viewport` with a React portal. Stems has no
portals, and moving DOM nodes the reconciler owns would break later updates. So:

- `<navigationMenu.Content>` is a **component**, not a mixin. Declare it inside its item, where it
  reads naturally. It renders nothing there. It registers its props and children with the root.
- `<navigationMenu.Viewport>` is a **component** too. It renders every registered content as a
  `<div>` child of the viewport element, with the content mixin applied. Inactive contents stay
  in the DOM with `hidden`.

What this means:

- **Server HTML has every link**, inside the viewport (Base UI needs `keepMounted` for this).
  Hydration matches, and Remix owns every node.
- **Render the viewport after the items** (in render order) so the server HTML includes the
  contents. The registry's `NavigationMenu` renders it last. On the client, a viewport rendered
  first catches up with one extra render.
- **When the declaring component re-renders**, the viewport re-renders. Changed children or props
  show up in the viewport.
- **Context inside the content comes from the viewport's position.** That is under the root
  `Context`, but not under the item's `ItemContext`. A nested `navigationMenu.Context` inside a
  content still finds its parent menu.

### Popup, positioner and the size morph

`popup()` is Base UI's Positioner and Popup in one top-layer element (`popover="manual"`). The
visible box is the **viewport's parent**. That can be the popup element itself, or an element
between the popup and the viewport, as in Base UI's Popup. When the user switches items while
the menu is open, these steps run:

1. The entering content renders with `data-starting-style`. The exiting content gets
   `data-ending-style`, `inert`, and inline `position: absolute; top: 0; left: 0`, so it leaves
   the flow.
2. The new size is measured. `--positioner-width` and `--positioner-height` jump to it on the
   popup element, so `anchor()` positions the popup for its final size. `--popup-width` and
   `--popup-height` start at the old size of the visible box. On the next frame they change to
   the new size, so a CSS `transition` on the box's `width` and `height` animates the change.
3. When the box's transitions finish, all four variables go back to `fit-content`. Later content
   changes then apply directly.

When the popup is not morphing, the variables are `fit-content`, not Base UI's `auto`. A
`[popover]` element is `position: fixed; inset: 0`, so `width: auto` would make it as wide as the
viewport until it is positioned. The size variables are inherited, so you can set them on the
popup element and use them on the box inside it. With a single element, size it with
`--popup-width` and `--popup-height`. Do not transition `top` / `left` in that case: `anchor()`
reads the size while it animates, so the position would lag behind.

### Differences from Base UI

- **No Portal or Positioner element.** `popup()` is one element in the top layer. Base UI's
  Positioner props are options of `popup()`.
- **`Content` and `Viewport` are components** (see above). `keepMounted` is not needed: contents
  are always mounted.
- **The Item part is the `ItemContext` provider.** Put it around your `<li>`. The `<li>` needs no
  mixin.
- **Nested menus:** put a `navigationMenu.Context` inside a content. It gets `data-nested`.
  - It can have its own popup (opened to the side), or only a `List` and an inline `Viewport`.
  - An inline nested menu morphs the parent's popup when it switches items.
  - Nested popups close when the parent switches or closes.
  - Escape closes the innermost popup first.
- **Hover close with an inline viewport.** A menu without a popup never closes on hover. Its
  items only switch.
- **Not supported:** `actionsRef` / `preventUnmountOnClose`, `data-instant`, and `aria-owns`
  re-parenting. Also `collisionAvoidance`, `collisionBoundary`, `sticky`, `positionMethod`, and
  `disableAnchorTracking`.
- Base UI's Popup renders `<nav>`. Here you choose the element.
- **Custom content `id`.** The trigger's `aria-controls` uses it after the first client render.
  Server HTML has the generated id.

## `stems-ui/navigation-menu`

- `Context`: the provider that owns the open item. Read it with
  `handle.context.get(navigationMenu.Context)`. It has `value`, `open`, `orientation`, `nested`,
  `activationDirection`, `openReason`, `setValue(value, { reason?, event? })`, and `close()`.
  - `value`: `string | null`. Controlled open item. `null` closes the menu.
  - `defaultValue`: `string | null`. Initial uncontrolled item. Defaults to `null`.
  - `onValueChange(value, details)`: called before the value changes. `details` has `reason`,
    `event`, `trigger`, and `cancel()`.
  - `onOpenChangeComplete(open)`: called after the popup's enter or exit animation finished.
  - `delay`: `number`. Hover-open delay in ms. Defaults to `50`.
  - `closeDelay`: `number`. Hover-close delay in ms. Defaults to `50`.
  - `orientation`: `'horizontal'` (default) | `'vertical'`.
- `ItemContext`: one item (Base UI `Item`).
  - `value`: `string`. Defaults to a generated id.
- `root()`: the root element, usually `<nav>`. Sets `data-orientation` and `data-nested`. Handles
  focus-out.
- `list()`: the item list, usually `<ul>`. Sets `data-orientation`. Handles arrow keys.
- `trigger(options?)`: the item's button. Sets `type="button"`, `aria-expanded`, and
  `aria-controls` (the content's id). Sets `data-popup-open`, `data-pressed` (open, and not just
  hovered), and `data-disabled`. A non-`<button>` host gets `role="button"`, `tabIndex`, and
  Enter/Space handling.
  - `disabled`: `boolean`. The trigger ignores presses and hover. It stays focusable and gets
    `aria-disabled`.
- `icon()`: an icon inside the trigger. Sets `aria-hidden` and `data-popup-open`.
- `link(options?)`: a plain `<a>`, in the list or in a content.
  - `active`: `boolean`. Adds `aria-current="page"` and `data-active`.
  - `closeOnClick`: `boolean`. Closes the menu (reason `'link-press'`). Defaults to `false`.
- `<Content {...divProps}>`: the item's content. Rendered as a `<div>` inside the viewport (see
  above). Has `id`, `hidden`, `data-open` / `data-closed`, `data-activation-direction`, and the
  presence attributes.
- `<Viewport {...divProps} />`: the clipping viewport. Renders the contents, and a visually
  hidden focus guard at each end.
- `popup(options?)`: the shared popup. Sets `id`, `popover="manual"`, `tabIndex={-1}`, `hidden`
  while closed, and the attributes and variables below. It never moves focus when it opens.
  - Options: `side` (default `'bottom'`), `align` (default `'center'`), `sideOffset`,
    `alignOffset`, `collisionPadding` (default `5`), `arrowPadding`, and `anchor`. These are the
    same as `stems-ui/popover`'s `popup()`.
- `arrow()`: points at the active trigger. Same as `stems-ui/popover`.
- `backdrop()`: an optional overlay in the top layer, below the popup.
- `onNavigationMenuChange(handler)`: a listener for `NavigationMenuChangeEvent`
  (`stems:navigation-menu-change`). The event bubbles from the trigger. It has `value`,
  `previousValue`, and `reason`.

### Change reasons

- `'trigger-press'`
- `'trigger-hover'`
- `'outside-press'`
- `'list-navigation'` (ArrowDown, or ArrowRight in a vertical menu)
- `'focus-out'`
- `'escape-key'`
- `'link-press'`
- `'imperative-action'` (`setValue` / `close`)
- `'none'` (a parent menu closed this nested one)

## Behavior notes

- **Navigation, not a menu.** There are no `menu` or `menuitem` roles. Triggers are buttons with
  `aria-expanded` and `aria-controls`. Links are plain `<a>` elements.
- **Hover (mouse and pen; touch is ignored):**
  - Entering a trigger opens it after `delay`.
  - While the menu is open, entering another trigger switches to it right away.
  - A hover-opened menu closes `closeDelay` ms after the pointer leaves the triggers and popup.
    Moving toward the popup keeps it open (`lib/hover-aim.ts`).
- **Press:** toggles the item, or switches to it. A press within 500 ms of a hover-open keeps the
  menu open (Base UI's "patient click"). After that, hover no longer closes the menu.
- **Keyboard:**
  - In the list, the arrow keys move between the top-level triggers and links. They wrap, and
    Home/End go to the first and last. Horizontal menus use Left/Right (mirrored in RTL).
    Vertical menus use Up/Down.
  - ArrowDown opens the trigger's item and focuses its first link. In a vertical menu, use
    ArrowRight (ArrowLeft in RTL).
  - Up/Down move between the links in a content.
  - Escape closes and returns focus to the trigger.
- **Tab order:** the popup renders after the list, so these rules keep the order logical.
  - Tab from an open trigger goes into its content.
  - Tab from the last link in the content goes to the element after the trigger.
  - Shift+Tab from the first link goes back to the trigger.
  - Focus guards skip the popup when the user tabs into it from elsewhere.
  - The menu closes (reason `'focus-out'`) when focus leaves the root and the popup.
- **Dismissal:** this uses the shared dismiss-layer stack. An outside press closes the menu. The
  triggers count as inside.
- **Closing:** the content stays shown (`data-open`) while the popup animates out. It is hidden
  instantly afterward.
- **Activation direction:** when the user switches items while the menu is open,
  `data-activation-direction` on every content is `left` / `right` (horizontal) or `up` / `down`
  (vertical). The value compares the trigger positions. It is cleared when the menu opens
  fresh.

## Styling hooks

| Part     | Attribute                   | Values / notes                                    |
| -------- | --------------------------- | ------------------------------------------------- |
| root     | `data-orientation`          | `horizontal` \| `vertical`                        |
| root     | `data-nested`               | present on a nested menu                          |
| list     | `data-orientation`          | `horizontal` \| `vertical`                        |
| trigger  | `aria-expanded`             | `"true"` \| `"false"`                             |
| trigger  | `data-popup-open`           | present while its item is open                    |
| trigger  | `data-pressed`              | present while open, unless only hovered open      |
| trigger  | `data-disabled`             | present when disabled                             |
| icon     | `data-popup-open`           | present while its item is open                    |
| link     | `data-active`               | present with `active` (`aria-current="page"`)     |
| content  | `data-open` / `data-closed` | whether it's the shown content                    |
| content  | `data-activation-direction` | `left` \| `right` \| `up` \| `down`               |
| content  | `data-starting-style`       | present on the first frame of entering            |
| content  | `data-ending-style`         | present while exiting (also `inert`, absolute)    |
| content  | `hidden`                    | present when not shown and not animating          |
| viewport | `data-orientation`          | `horizontal` \| `vertical`                        |
| popup    | `data-open` / `data-closed` | open state                                        |
| popup    | `data-side` / `data-align`  | final placement                                   |
| popup    | `data-starting-style`       | present on the first frame of opening             |
| popup    | `data-ending-style`         | present while animating out                       |
| arrow    | `data-side` / `data-align`  | same as the popup; `data-uncentered`, `data-open` |
| backdrop | `data-open` / `data-closed` | plus the presence attributes                      |

| Part  | CSS variable                                 | Value                                                              |
| ----- | -------------------------------------------- | ------------------------------------------------------------------ |
| popup | `--popup-width` / `--popup-height`           | the visible box's size: animates between items, else `fit-content` |
| popup | `--positioner-width` / `--positioner-height` | the final size during a morph, else `fit-content`                  |
| popup | `--anchor-width` / `--anchor-height`         | the active trigger's size in px                                    |
| popup | `--available-width` / `--available-height`   | space available on the final side, in px                           |
| popup | `--transform-origin`                         | the active trigger relative to the popup                           |
