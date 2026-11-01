<!-- Adapted from @remix-run/ui 0.13.0 (packages/ui/src/popover/README.md). MIT License, Copyright (c) 2025 Shopify Inc. -->

# popover

`popover` wires a trigger button to an anchored popup that opens in the top layer, with
dismissal, focus management, and enter/exit animation hooks. App code owns the markup and
visual styles.

Base UI equivalent: [Popover](https://base-ui.com/react/components/popover).

## Usage

```tsx
import * as popover from 'stems-ui/popover'

function Notifications() {
  return () => (
    <popover.Context>
      <button mix={popover.trigger()}>Notifications</button>
      <div
        class="w-72 rounded-md bg-white p-4 shadow-md transition-[opacity,scale] duration-150 origin-(--transform-origin) data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0"
        mix={popover.popup({ side: 'bottom', align: 'start', sideOffset: 8 })}
      >
        <h2 mix={popover.title()}>Notifications</h2>
        <p mix={popover.description()}>You are all caught up.</p>
        <button mix={popover.close()}>Close</button>
      </div>
    </popover.Context>
  )
}
```

Control the state with `open` and `onOpenChange(open, details)`, or let the context own it with
`defaultOpen`. Listen for bubbling changes on the trigger or an ancestor:

```tsx
<div mix={popover.onPopoverChange((event) => console.log(event.open, event.reason))}>…</div>
```

### Differences from Base UI

- **No Portal, no Positioner element.** The popup is shown in the top layer with
  `popover="manual"` + `showPopover()`, so it escapes `overflow` and `z-index` wherever it is in
  the DOM. Base UI's Positioner props are options of `popup()`, and the positioner's data
  attributes and CSS variables are set on the popup element.
- **Render nested popovers inside their parent's popup** (in the DOM), so presses and focus
  inside the child count as inside the parent.
- `--positioner-width` / `--positioner-height` / `--popup-width` / `--popup-height`, the
  Viewport part, `createHandle()` / detached triggers / payloads, `actionsRef`,
  `collisionAvoidance`, `collisionBoundary`, `sticky`, `positionMethod`, and
  `disableAnchorTracking` are not supported. Collision handling flips to the opposite side and
  clamps to the viewport; an oversized popup gets an inline `max-width` / `max-height`.
- The popup element always stays in the DOM (closed popups get `hidden`). The registry
  component decides whether to render children while closed.

## `stems-ui/popover`

- `Context`: provider that owns the open state. Read it in components with
  `handle.context.get(popover.Context)` (`open`, `openReason`, `setOpen(open, { reason })`,
  `activeTrigger`, `side`, `align`, …).
  - `open`: `boolean`. Controlled open state.
  - `defaultOpen`: `boolean`. Initial uncontrolled state. Defaults to `false`.
  - `onOpenChange(open, details)`: called before the state changes. `details` has `reason`,
    `event`, `trigger`, and `cancel()` (keeps the current state).
  - `onOpenChangeComplete(open)`: called after the enter or exit animation finished.
  - `modal`: `false` (default) | `true` | `'trap-focus'`. `true` locks page scroll, traps
    focus, makes everything outside the popup (and backdrop) `inert`, and sets
    `aria-modal="true"`. `'trap-focus'` only traps focus.
- `trigger(options?)`: the toggle button. Sets `type="button"`, `aria-haspopup="dialog"`,
  `aria-expanded`, `aria-controls`, and native `disabled`. Non-`<button>` hosts get
  `role="button"`, `tabIndex`, `aria-disabled`, and Enter/Space activation. Several triggers
  may share one popover: the popup anchors to (and returns focus to) the one that opened it, and
  pressing another trigger while open moves it there.
  - `disabled`: `boolean`.
  - `openOnHover`: `boolean`. Also open when hovered (reason `'trigger-hover'`). A hover-opened
    popover closes when the pointer leaves the trigger and popup (moving toward the popup keeps
    it open), doesn't move focus, and stays open once the trigger is pressed.
  - `delay`: `number`. Hover-open delay in ms. Defaults to `300`.
  - `closeDelay`: `number`. Hover-close delay in ms. Defaults to `0`.
- `popup(options?)`: the popup (Base UI's Positioner + Popup). Sets `id`, `role="dialog"`,
  `popover="manual"`, `tabIndex={-1}`, `aria-labelledby` / `aria-describedby` (from `title()` /
  `description()`), `hidden` while closed, and the attributes and variables below.
  - `side`: `'top' | 'bottom' | 'left' | 'right' | 'inline-start' | 'inline-end'`. Defaults to
    `'bottom'`. Flips to the opposite side when it doesn't fit.
  - `align`: `'start' | 'center' | 'end'`. Defaults to `'center'`. `start` / `end` follow the
    text direction on the top and bottom sides.
  - `sideOffset`: `number | (data) => number`. Gap between anchor and popup. Defaults to `0`.
  - `alignOffset`: `number | (data) => number`. Shift along the alignment axis (away from the
    aligned edge). Defaults to `0`. Offset functions receive `{ side, align, anchor, positioner }`
    sizes like Base UI's.
  - `collisionPadding`: `number | { top, right, bottom, left }`. Space kept from the viewport
    edges. Defaults to `5`.
  - `arrowPadding`: `number`. Minimum distance between the arrow and the popup edges. Defaults
    to `5`.
  - `anchor`: `HTMLElement | { x, y, width?, height? } | () => …`. Position against something
    other than the trigger.
  - `initialFocus`: `boolean | string | HTMLElement | (interactionType) => …`. Defaults to the
    first `[autofocus]` or tabbable element, else the popup itself (also when opened by touch).
    `false` doesn't move focus; a string is a selector inside the popup.
  - `finalFocus`: same shape. Defaults to the trigger. `false` leaves focus alone.
- `arrow()`: an element inside the popup that points at the anchor. Gets inline
  `position: absolute` plus `left` (top/bottom sides) or `top` (left/right sides); offset it
  across the edge with CSS, e.g. `data-[side=bottom]:top-[-6px]`. Note the UA popover style
  `overflow: auto` clips an arrow placed outside the popup box: add `overflow: visible`.
- `backdrop()`: an optional overlay, shown in the top layer just below the popup
  (`popover="manual"`, `role="presentation"`). Style it to cover the viewport (`fixed inset-0
size-full`, and reset the UA popover `margin`, `border`, `padding`, `background`). Pressing it
  is an outside press.
- `title()` / `description()`: label and describe the popup. Generated ids unless the host has
  its own `id`.
- `close()`: a button inside the popup that closes it (reason `'close-press'`).
- `onPopoverChange(handler)`: listener mixin for `PopoverChangeEvent` (`stems:popover-change`,
  bubbles from the active trigger, has `open` and `reason`).

### Change reasons

`'trigger-press'`, `'trigger-hover'`, `'outside-press'`, `'escape-key'`, `'close-press'`,
`'focus-out'`, and `'none'` (state changed through the controlled `open` prop).

## Behavior notes

- **Opening:** the popup renders `data-open` and `data-starting-style` without `hidden`, then
  `showPopover()` runs, the popup is positioned against the trigger (`stems-ui/anchor`), the
  dismiss layer is registered, and focus moves in (`initialFocus`). `data-starting-style` is
  removed on the next frame.
- **Closing:** `data-closed` and `data-ending-style` are rendered, the dismiss layer and modal
  state are released, and focus is restored right away. Once the popup's CSS transitions and
  animations finish, `hidePopover()` runs and `hidden` is rendered. Reopening mid-close reverses.
- **Dismissal** uses the shared dismiss-layer stack: Escape closes only the topmost popup; an
  outside press closes every popup it is outside of (a press inside a parent closes its
  children). The triggers count as inside, so pressing the trigger toggles.
- **Focus-out:** a non-modal popover closes (reason `'focus-out'`) when keyboard focus moves
  outside the popup and its triggers. Focus moved by a pointer press counts as an outside press
  instead.
- **Focus restore:** on close, focus returns to the trigger (or `finalFocus`) if it was inside
  the popup or was lost to `<body>`, unless the popup closed through focus-out or an outside
  press on another focusable element.
- **Keyboard:** Enter / Space on the trigger toggle; Escape closes; Tab moves through the
  popup's content in DOM order (with `modal`, Tab and Shift+Tab wrap inside the popup).
- Closed popups get `hidden` in server HTML. With JavaScript disabled the popup stays hidden
  (it needs `showPopover()`). Classes that set `display` (e.g. `flex`) override `hidden` unless
  your CSS hides `[hidden]` with `!important` (Tailwind's preflight does).
- Explicit host props win (`attrs()` semantics). A custom popup `id` is supported; the triggers
  pick it up after the first render.

## Styling hooks

| Part     | Attribute             | Values / notes                                                   |
| -------- | --------------------- | ---------------------------------------------------------------- |
| trigger  | `data-popup-open`     | present while open (on the trigger that opened it)               |
| trigger  | `data-disabled`       | present when disabled                                            |
| trigger  | `aria-expanded`       | `"true"` \| `"false"`                                            |
| popup    | `data-open`           | present when open                                                |
| popup    | `data-closed`         | present when closed (also while animating out)                   |
| popup    | `data-side`           | final side: `top` \| `bottom` \| `left` \| `right` \| `inline-*` |
| popup    | `data-align`          | `start` \| `center` \| `end`                                     |
| popup    | `data-starting-style` | present on the first frame of opening                            |
| popup    | `data-ending-style`   | present while animating out                                      |
| popup    | `hidden`              | present when closed and not animating                            |
| arrow    | `data-side`           | same as the popup                                                |
| arrow    | `data-align`          | same as the popup                                                |
| arrow    | `data-uncentered`     | present when the arrow can't point at the anchor's center        |
| arrow    | `data-open`           | present when open                                                |
| arrow    | `data-closed`         | present when closed                                              |
| backdrop | `data-open`           | present when open                                                |
| backdrop | `data-closed`         | present when closed                                              |
| backdrop | `data-starting-style` | present on the first frame of opening                            |
| backdrop | `data-ending-style`   | present while animating out                                      |

| Part  | CSS variable         | Value                                                      |
| ----- | -------------------- | ---------------------------------------------------------- |
| popup | `--anchor-width`     | the anchor's width in px                                   |
| popup | `--anchor-height`    | the anchor's height in px                                  |
| popup | `--available-width`  | space available on the final side, in px                   |
| popup | `--available-height` | space available on the final side, in px                   |
| popup | `--transform-origin` | the anchor point relative to the popup (for scale/zoom-in) |
