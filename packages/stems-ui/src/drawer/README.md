# drawer

`drawer` is a dialog that slides in from an edge of the screen and can be swiped away. It is
built on the `stems-ui/dialog` engine, so it uses a native `<dialog>` (modal by default) and gets
the same dismissal, focus, scroll-lock, and nesting behavior. On top of that it adds pointer-event
swipe-to-dismiss, snap points, and swipe-to-open, with Base UI's attributes and CSS variables.

Base UI equivalent: [Drawer](https://base-ui.com/react/components/drawer).

## Usage

```tsx
import * as drawer from 'stems-ui/drawer'

function MoveGoal() {
  return () => (
    <drawer.Context swipeDirection="down">
      <button mix={drawer.trigger()}>Open drawer</button>
      <dialog
        class="inset-x-0 top-auto bottom-0 m-0 max-w-none w-full open:flex flex-col backdrop:bg-black/10 backdrop:opacity-[calc(1-var(--drawer-swipe-progress))] transform-[translateY(var(--drawer-swipe-movement-y))] transition-transform duration-450 data-swiping:duration-0 data-starting-style:translate-y-full data-ending-style:translate-y-full data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)]"
        mix={drawer.popup()}
      >
        <div class="h-6 cursor-grab" aria-hidden="true" />
        <div mix={drawer.content()}>
          <h2 mix={drawer.title()}>Move goal</h2>
          <p mix={drawer.description()}>Set your daily activity goal.</p>
          <button mix={drawer.close()}>Close</button>
        </div>
      </dialog>
    </drawer.Context>
  )
}
```

Position the popup with CSS so that it matches `swipeDirection`. A `<dialog>` shown with
`showModal()` gets UA insets and max sizes (`inset: 0; margin: auto; max-width/height`), so reset
the ones that don't fit, for example `top-auto m-0 max-w-none` for a bottom sheet.

## `stems-ui/drawer`

- `Context`: takes every [`dialog.Context`](../dialog/README.md) prop (`open`, `defaultOpen`,
  `onOpenChange(open, details)`, `onOpenChangeComplete`, `modal`, `disablePointerDismissal`,
  `actionsRef`), plus:
  - `swipeDirection`: `'up' | 'down' | 'left' | 'right'`. The direction a swipe dismisses the
    drawer in. Defaults to `'down'`.
  - `snapPoints`: `DrawerSnapPoint[]`. Heights a vertical drawer rests at (see
    [Snap points](#snap-points)). Ignored for `'left'` / `'right'` drawers.
  - `snapPoint` / `defaultSnapPoint` / `onSnapPointChange(snapPoint, details)`: the active snap
    point, controlled or uncontrolled. `defaultSnapPoint` defaults to `snapPoints[0]`. `details`
    has `reason` (`'swipe'`, or the close reason when closing resets the point), `event`, and
    `cancel()`.
  - `snapToSequentialPoints`: when `true`, a fast release moves at most one point instead of
    travelling further with the release velocity. Defaults to `false`.
- `trigger(options?)`, `title()`, `description()`, `close(options?)`: same as in `dialog`.
- `popup(options?)`: everything `dialog.popup()` does (`initialFocus`, `finalFocus`, state
  attributes, `--nested-dialogs`), plus the swipe gesture and the hooks below. It also sets
  `touch-action: pan-x` (or `pan-y` for horizontal drawers), so touch drags along the swipe axis
  reach the drawer. Scroll containers inside the drawer still scroll.
- `backdrop(options?)`: the dialog backdrop element plus `--drawer-swipe-progress`.
- `content()`: a region where mouse drags select text instead of swiping, as in Base UI. Touch
  and pen drags still swipe.
- `swipeArea(options?)`: an element (usually an invisible strip along a screen edge) where a swipe
  opens the drawer. Options: `swipeDirection` (the open direction; defaults to the opposite of the
  Context's `swipeDirection`) and `disabled`. Put it inside `Context`, outside the popup. See
  [Swipe to open](#swipe-to-open).
- `Provider`, `indent()`, `indentBackground()`: optional app-level parts. While any drawer inside
  `Provider` is open, `indent()` and `indentBackground()` get `data-active`. During a top-level
  drawer swipe, `indent()` also gets `--drawer-swipe-progress`.
- `onDrawerChange(handler)`: listener mixin for `DrawerChangeEvent` (`stems:drawer-change`,
  bubbles, has `open` and `reason`). A swipe dismissal or swipe-area open/close has reason
  `'swipe'`.
- `onDrawerSnapPointChange(handler)`: listener mixin for `DrawerSnapPointChangeEvent`
  (`stems:drawer-snap-point-change`, dispatched from the popup, bubbles, has `snapPoint` and
  `reason`).

## Swipe behavior

- A press on the popup starts tracking. These presses are ignored:
  - presses on `input`, `textarea`, `select`, or `[contenteditable]`;
  - presses inside `[data-swipe-ignore]`. With a value of `x` or `y`, only touch drags along that
    axis are ignored. This is Base UI's `data-base-ui-swipe-ignore`.
  - mouse presses inside `content()`.
- The drag becomes a swipe once it moves 6px along the swipe axis. It does not become a swipe if
  it moves more sideways than along the axis, or if a scroll container under the pointer can
  still scroll that way. Once the drag is a swipe, the pointer is captured, `data-swiping` is
  set, and the click that follows the drag is suppressed.
- During the swipe, `--drawer-swipe-movement-x` / `-y` follow the pointer. Movement against the
  dismiss direction is damped. `--drawer-swipe-progress` (0–1) is written to the popup, to
  `backdrop()` elements, and to the popups of parent drawers.
- When the pointer is released, the drawer is dismissed in either of these cases:
  - the swipe moved at least 40% of the popup's size;
  - the swipe moved at least 16px and was released faster than 0.5px/ms.
- On dismissal, `--drawer-swipe-strength` (0.1–1) is set from the remaining distance and the
  release speed, `data-swipe-dismiss` is set, and the drawer closes with reason `'swipe'`.
  Otherwise the variables reset to `0` and CSS animates the drawer back. If `onOpenChange`
  cancels the dismissal, the drawer also snaps back.
- `pointercancel`, for example when the browser takes over a touch to scroll, ends the swipe
  without dismissing.

## Snap points

```tsx
<drawer.Context snapPoints={['148px', 1]}>
  …
  <dialog
    class="… h-[calc(100dvh-2rem)] transform-[translateY(calc(var(--drawer-snap-point-offset)+var(--drawer-swipe-movement-y)))]"
    mix={drawer.popup()}
  >
```

- A number from 0 to 1 is a fraction of the viewport height (`documentElement.clientHeight`), a
  number above 1 is pixels, and a string is `px` or `rem` (`'148px'`, `'30rem'`). Heights are
  clamped to the popup's height, so `1` means "fully shown". Points that resolve within 1px of a
  later point are dropped.
- Snap points apply to `'down'` and `'up'` drawers. The popup is measured once it's shown (and
  again when it or the window resizes), and `--drawer-snap-point-offset` is set to how far the
  popup must move toward its closed edge to show only the active point's height (negative for
  `'up'`). Include it in the popup's transform. Before measuring, and in server HTML, it's `0px`.
- Dragging works in both directions: the popup follows the pointer, and is damped only past
  its fully open position. A drag toward "more open" on content that can still scroll (once the
  drawer is fully open) scrolls instead.
- On release, the target is the drag position plus `velocity × 300px` (velocity ≥ 0.5px/ms,
  capped at 4px/ms; skipped with `snapToSequentialPoints`, which instead advances one point on a
  fast release). The drawer settles on the closest point, or closes if the closed position is
  closer. A release toward the dismiss direction faster than 0.5px/ms closes from any point.
  These thresholds are Base UI's.
- Closing by swipe first sets the snap point to `null` (reason `'swipe'`), then closes. Any close
  resets the snap point to `defaultSnapPoint`. Cancelling either change keeps the drawer where it
  was.
- `--drawer-swipe-progress` is 0 at the most open point and 1 at the next one, so a backdrop that
  fades with progress fades out at lower points. With one snap point it behaves as without snap
  points.
- `data-expanded` is set when the active point is `1`, or resolves to the popup's full height.
- Base UI has no keyboard interaction for snap points. Control `snapPoint` from buttons inside
  the drawer to offer one (the docs demo has "Expand" / "Collapse").

## Swipe to open

```tsx
<drawer.Context swipeDirection="right">
  <div class="fixed inset-y-0 right-0 w-6" mix={drawer.swipeArea()} />
  <dialog mix={drawer.popup()}>…</dialog>
</drawer.Context>
```

- A press on the area starts tracking (mouse presses call `preventDefault()` so they don't select
  text). Once the pointer moves 6px in the open direction, more along the axis than across it,
  the drawer opens with reason `'swipe'`, and `data-swiping` is set on the area and the popup.
  `--drawer-swipe-movement-x/-y` then keep the popup under the pointer (damped past fully open),
  and `--drawer-swipe-progress` goes from 1 to 0.
- The gesture is followed with window listeners, not pointer capture, because a modal drawer
  makes the area inert as it opens.
- On release, the drawer stays open if the drag covered half the popup's size or was released
  faster than 0.1px/ms in the open direction; otherwise it closes again (reason `'swipe'`).
- The area counts as part of the drawer for outside presses, and the click that the release
  produces is swallowed, so it doesn't dismiss the drawer it just opened.
- While the drawer is open (and not being swiped open) the area has `pointer-events: none`. It
  also sets `touch-action` to allow panning across its axis only, and `role="presentation"` with
  `aria-hidden="true"`: it's a pointer shortcut, so keep a `trigger()` for keyboard and screen
  reader users.

## Styling hooks

| Part                              | Attribute / variable                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `trigger()`                       | `aria-expanded`, `data-popup-open`, `data-disabled`                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `popup()`                         | `:open`, `data-open` / `data-closed`, `data-starting-style` / `data-ending-style`, `data-nested`, `data-nested-dialog-open`, `data-swipe-direction`, `data-swiping`, `data-swipe-dismiss`, `data-nested-drawer-open`, `data-nested-drawer-swiping`, `data-expanded`, `--drawer-swipe-movement-x`, `--drawer-swipe-movement-y`, `--drawer-swipe-progress`, `--drawer-swipe-strength`, `--drawer-snap-point-offset`, `--drawer-height`, `--nested-drawers`, `--nested-dialogs`, `--drawer-frontmost-height` |
| `swipeArea()`                     | `data-open` / `data-closed`, `data-swiping`, `data-disabled`, `data-swipe-direction` (the open direction)                                                                                                                                                                                                                                                                                                                                                                                                 |
| `backdrop()`                      | `hidden`, `data-open` / `data-closed`, `data-starting-style` / `data-ending-style`, `--drawer-swipe-progress`                                                                                                                                                                                                                                                                                                                                                                                             |
| `indent()` / `indentBackground()` | `data-active`, `--drawer-swipe-progress` (`indent()` only during swipes)                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `close()`                         | `data-disabled`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

`--drawer-frontmost-height` is the height of the frontmost open drawer. It is written to the
drawers behind it in a nested stack, measured when a drawer in the stack opens or closes.

`--drawer-height` is the popup's measured height. As in Base UI it is only set while it must
stay fixed: while a nested drawer is open (so the stack can collapse to it) and while the drawer
is closing. Otherwise it's unset, so use `var(--drawer-height, auto)`.

With `modal: true`, `::backdrop` inherits the popup's `--drawer-swipe-progress`, so a backdrop
can fade during the swipe without a separate element:
`backdrop:opacity-[calc(1-var(--drawer-swipe-progress))]`.

## Detached triggers

`drawer.createHandle()` works like [`dialog.createHandle()`](../dialog/README.md#detached-triggers):
pass the handle to `<drawer.Context handle>` and to `drawer.trigger({ handle, payload })`
anywhere in the document; the `Context`'s `children` may be a function of `{ payload }`. The
handle has `isOpen`, `open(triggerId?)`, `openWithPayload(payload)`, and `close()`, and the
`Context` takes `triggerId` / `defaultTriggerId`.

## Not yet supported

- `VirtualKeyboardProvider` and `--drawer-keyboard-inset`.
- Base UI's `Viewport` part. The `<dialog>` is positioned directly in the top layer, and snap
  points resolve against the document viewport.
