# drawer

`drawer` is a dialog that slides in from an edge of the screen and can be swiped away. It is
built on the `stems-ui/dialog` engine, so it uses a native `<dialog>` (modal by default) and gets
the same dismissal, focus, scroll-lock, and nesting behavior. On top of that it adds pointer-event
swipe-to-dismiss, with Base UI's swipe attributes and CSS variables.

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
- `trigger(options?)`, `title()`, `description()`, `close(options?)`: same as in `dialog`.
- `popup(options?)`: everything `dialog.popup()` does (`initialFocus`, `finalFocus`, state
  attributes, `--nested-dialogs`), plus the swipe gesture and the hooks below. It also sets
  `touch-action: pan-x` (or `pan-y` for horizontal drawers), so touch drags along the swipe axis
  reach the drawer. Scroll containers inside the drawer still scroll.
- `backdrop(options?)`: the dialog backdrop element plus `--drawer-swipe-progress`.
- `content()`: a region where mouse drags select text instead of swiping, as in Base UI. Touch
  and pen drags still swipe.
- `Provider`, `indent()`, `indentBackground()`: optional app-level parts. While any drawer inside
  `Provider` is open, `indent()` and `indentBackground()` get `data-active`. During a top-level
  drawer swipe, `indent()` also gets `--drawer-swipe-progress`.
- `onDrawerChange(handler)`: listener mixin for `DrawerChangeEvent` (`stems:drawer-change`,
  bubbles, has `open` and `reason`). A swipe dismissal has reason `'swipe'`.

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

## Styling hooks

| Part                              | Attribute / variable                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `trigger()`                       | `aria-expanded`, `data-popup-open`, `data-disabled`                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `popup()`                         | `:open`, `data-open` / `data-closed`, `data-starting-style` / `data-ending-style`, `data-nested`, `data-nested-dialog-open`, `data-swipe-direction`, `data-swiping`, `data-swipe-dismiss`, `data-nested-drawer-open`, `data-nested-drawer-swiping`, `--drawer-swipe-movement-x`, `--drawer-swipe-movement-y`, `--drawer-swipe-progress`, `--drawer-swipe-strength`, `--drawer-snap-point-offset` (always `0px`), `--nested-drawers`, `--nested-dialogs`, `--drawer-frontmost-height` |
| `backdrop()`                      | `hidden`, `data-open` / `data-closed`, `data-starting-style` / `data-ending-style`, `--drawer-swipe-progress`                                                                                                                                                                                                                                                                                                                                                                        |
| `indent()` / `indentBackground()` | `data-active`, `--drawer-swipe-progress` (`indent()` only during swipes)                                                                                                                                                                                                                                                                                                                                                                                                             |
| `close()`                         | `data-disabled`                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

`--drawer-frontmost-height` is the height of the frontmost open drawer. It is written to the
drawers behind it in a nested stack, measured when a drawer in the stack opens or closes.

With `modal: true`, `::backdrop` inherits the popup's `--drawer-swipe-progress`, so a backdrop
can fade during the swipe without a separate element:
`backdrop:opacity-[calc(1-var(--drawer-swipe-progress))]`.

## Not yet supported

- Snap points (`snapPoints`, `snapPoint`, `defaultSnapPoint`, `onSnapPointChange`,
  `snapToSequentialPoints`, `data-expanded`). `--drawer-snap-point-offset` is always `0px`.
- `SwipeArea` (swipe to open).
- `--drawer-height`. It is not set, so styles should fall back with
  `var(--drawer-height, auto)`.
- `VirtualKeyboardProvider` and `--drawer-keyboard-inset`.
- Base UI's `Viewport` part. The `<dialog>` is positioned directly in the top layer.
- Detached triggers (`createHandle`), the same as in dialog.
