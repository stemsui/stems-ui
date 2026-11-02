# tooltip

`tooltip` shows a short visual hint when an element is hovered or focused with the keyboard. The
popup opens in the top layer, never takes focus, and closes on Escape, press, blur, or pointer
leave. App code owns the markup and visual styles.

Base UI equivalent: [Tooltip](https://base-ui.com/react/components/tooltip).

## Usage

```tsx
import * as tooltip from 'stems-ui/tooltip'

function Toolbar() {
  return () => (
    <tooltip.Provider>
      <tooltip.Context>
        <button aria-label="Bold" mix={tooltip.trigger()}>
          <BoldIcon />
        </button>
        <div
          class="rounded bg-black px-2 py-1 text-xs text-white transition-opacity data-starting-style:opacity-0 data-ending-style:opacity-0 data-instant:transition-none"
          mix={tooltip.popup({ sideOffset: 6 })}
        >
          <span class="size-2 rotate-45 bg-black data-[side=top]:-bottom-1" mix={tooltip.arrow()} />
          Bold
        </div>
      </tooltip.Context>
      {/* more tooltip.Context blocks share the provider's delays */}
    </tooltip.Provider>
  )
}
```

Tooltips are visual hints for sighted mouse and keyboard users. They don't open on touch. Give
the trigger an accessible name (`aria-label`) that matches the tooltip text, and use a
[popover](../popover/README.md) with `openOnHover` for content people must be able to reach
(infotips).

Control the state with `open` and `onOpenChange(open, details)`, or let the context own it with
`defaultOpen`. Listen for bubbling changes on the trigger or an ancestor:

```tsx
<div mix={tooltip.onTooltipChange((event) => console.log(event.open, event.reason))}>…</div>
```

### Differences from Base UI

- **No Portal, no Positioner element.** The popup is shown in the top layer with
  `popover="manual"` + `showPopover()`. Base UI's Positioner props are options of `popup()`,
  and the positioner's data attributes and CSS variables are set on the popup element.
- **`role="tooltip"`** is set on the popup. Like Base UI, the trigger gets no
  `aria-describedby`: the trigger's own label is the accessible name, so the hint isn't announced
  twice.
- The trigger gets no `type`, role, or `aria-*`: it keeps its own semantics (it may be a submit
  button, a link, …). `disabled` doesn't disable the element itself.
- The Viewport part, `actionsRef`,
  `--positioner-*` / `--popup-*` variables, `data-anchor-hidden`, `collisionAvoidance`,
  `collisionBoundary`, `sticky`, `positionMethod`, and `disableAnchorTracking` are not supported.
  Several triggers inside one `Context` share a tooltip (it anchors to the one that opened it).
- The popup element always stays in the DOM (closed popups get `hidden`).

## `stems-ui/tooltip`

- `Provider`: shares hover delays between the tooltips inside it (Base UI's
  `Tooltip.Provider`). Once one tooltip is open, or for `timeout` ms after it closed, hovering
  another trigger opens its tooltip with no delay and closes the previous one at once (reason
  `'none'`). Both get `data-instant="delay"` so they can skip their animations.
  - `delay`: `number`. Hover-open delay for triggers that don't set one.
  - `closeDelay`: `number`. Hover-close delay for triggers that don't set one.
  - `timeout`: `number`. Defaults to `400`.
- `Context`: provider that owns one tooltip's open state (Base UI's `Tooltip.Root`). Read it in
  components with `handle.context.get(tooltip.Context)` (`open`, `openReason`, `instant`,
  `setOpen(open, { reason })`, `activeTrigger`, `side`, `align`, …).
  - `open`: `boolean`. Controlled open state.
  - `defaultOpen`: `boolean`. Initial uncontrolled state. Defaults to `false`.
  - `onOpenChange(open, details)`: called before the state changes. `details` has `reason`,
    `event`, `trigger`, and `cancel()` (keeps the current state).
  - `onOpenChangeComplete(open)`: called after the enter or exit animation finished.
  - `disabled`: `boolean`. Triggers don't open the tooltip; an open tooltip closes with reason
    `'disabled'`.
  - `disableHoverablePopup`: `boolean`. Close as soon as the pointer leaves the trigger, even
    toward the popup. Defaults to `false` (the popup can be hovered; moving toward it keeps it
    open).
  - `trackCursorAxis`: `'none' | 'x' | 'y' | 'both'`. Position the popup at the cursor along
    that axis while the pointer is over the trigger. `'both'` also disables the hoverable popup.
    Defaults to `'none'`.
- `trigger(options?)`: the element the tooltip describes.
  - `delay`: `number`. Hover-open delay in ms. Defaults to the provider's `delay`, else `600`;
    `0` while the provider's group is active.
  - `closeDelay`: `number`. Hover-close delay in ms. Defaults to the provider's `closeDelay`,
    else `0`.
  - `closeOnClick`: `boolean`. Close when the trigger is pressed. Defaults to `true`.
  - `disabled`: `boolean`. Don't open from this trigger (renders `data-trigger-disabled`).
- `popup(options?)`: the tooltip (Base UI's Positioner + Popup). Sets `id`, `role="tooltip"`,
  `popover="manual"`, `tabIndex={-1}`, `hidden` while closed, and the attributes and variables
  below. Never moves focus.
  - `side`: `'top' | 'bottom' | 'left' | 'right' | 'inline-start' | 'inline-end'`. Defaults to
    `'top'`. Flips to the opposite side when it doesn't fit.
  - `align`: `'start' | 'center' | 'end'`. Defaults to `'center'`.
  - `sideOffset`, `alignOffset`: `number | (data) => number`. Default `0`.
  - `collisionPadding`: `number | { top, right, bottom, left }`. Defaults to `5`.
  - `arrowPadding`: `number`. Defaults to `5`.
  - `anchor`: `HTMLElement | { x, y, width?, height? } | () => …`. Position against something
    other than the trigger (overrides `trackCursorAxis`).
- `arrow()`: an element inside the popup that points at the anchor. Gets inline
  `position: absolute` plus `left` (top/bottom sides) or `top` (left/right sides). The UA popover
  style `overflow: auto` clips an arrow placed outside the popup box: add `overflow: visible`.
- `onTooltipChange(handler)`: listener mixin for `TooltipChangeEvent` (`stems:tooltip-change`,
  bubbles from the active trigger, has `open` and `reason`).

### Change reasons

`'trigger-hover'`, `'trigger-focus'` (keyboard focus and blur), `'trigger-press'`,
`'outside-press'`, `'escape-key'`, `'disabled'`, and `'none'` (closed because a sibling in the
provider opened, or state changed through the controlled `open` prop).

## Detached triggers

Base UI's `createHandle()`: triggers can live anywhere in the document, outside the `Context`,
linked by a handle. Each trigger can pass a `payload`, so one popup can serve many triggers with
different data.

```tsx
import * as tooltip from 'stems-ui/tooltip'

let people = tooltip.createHandle<{ name: string }>()

// Anywhere, e.g. in a table row:
<button mix={tooltip.trigger({ handle: people, payload: { name: 'Ada' } })}>Ada</button>
<button mix={tooltip.trigger({ handle: people, payload: { name: 'Grace' } })}>Grace</button>

// Elsewhere:
<tooltip.Context handle={people}>
  {({ payload }) => <div mix={tooltip.popup()}>{payload?.name}</div>}
</tooltip.Context>
```

- `createHandle<Payload>()` returns the handle. Pass it to the `Context` (`handle` prop, read
  once) and to each detached `trigger({ handle, payload })` (read on the trigger's first
  render). `Payload` types `payload` in the `Context`'s children function.
- Detached triggers register with the handle, so they behave like triggers inside the
  `Context`: `data-popup-open` follows the tooltip, hover and focus open it from any trigger, the popup anchors to the active trigger, focus returns to it, and a
  press on another trigger counts as inside (it moves the popup instead of dismissing it).
- The active trigger's `payload` is `{ payload }` in a children render function (re-run each
  time the `Context` renders) and `payload` on the context value
  (`handle.context.get(tooltip.Context).payload`). It's `undefined` until a trigger has been
  active, and stays while the popup animates out. A children function only works with JSX
  (`createElement` rejects function children). `payload` also works on triggers inside the
  `Context`.
- Handle methods: `isOpen`, `open(triggerId?)` (opens, or moves an open popup, to the trigger
  with that `id`; reason `'imperative-action'`), `close()`. They act on the mounted `Context`
  and are ignored while none is mounted. A remounted `Context` starts fresh.
- `Context` props `triggerId` (controlled, pair with `open`; store `details.trigger?.id` from
  `onOpenChange`) and `defaultTriggerId` pick the active trigger by element `id`.
- Detached triggers aren't re-rendered by the `Context`; they update their state attributes
  directly when it renders. On the server nothing is shared (a handle is usually a module-level
  singleton), so a detached trigger renders closed and without `aria-controls`; it gets
  `aria-controls` once the `Context` mounts in the browser.

## Behavior notes

- **Hover:** opens after `delay` (mouse and pen only; touch never opens a tooltip). Leaving the
  trigger closes it after `closeDelay`, unless the pointer moves onto the popup (or toward it,
  via hover-aim) and the popup is hoverable.
- **Keyboard focus:** opens immediately when the trigger matches `:focus-visible` (Tab), not
  when a pointer press focused it. Blur closes it, unless focus moved into the popup or another
  trigger of the same tooltip.
- **Press:** closes the tooltip (`closeOnClick`) and cancels a pending hover open. Focus and
  pointer stay on the trigger without reopening it until the pointer leaves or the trigger blurs.
- **Escape** closes the tooltip through the shared dismiss-layer stack and stops the event, so a
  tooltip inside a popover or dialog closes without closing its container. An outside press
  closes it too.
- **Focus** never moves into or out of the tooltip.
- **`data-instant`:** `'focus'` when opened by keyboard focus, `'dismiss'` after closing with
  Escape or a press, `'delay'` while moving between tooltips of a provider group. Use it to skip
  transitions (`data-instant:transition-none`).
- Closed popups get `hidden` in server HTML. Classes that set `display` (e.g. `inline-flex`)
  override `hidden` unless your CSS hides `[hidden]` with `!important` (Tailwind's preflight
  does).

## Styling hooks

| Part    | Attribute               | Values / notes                                                   |
| ------- | ----------------------- | ---------------------------------------------------------------- |
| trigger | `data-popup-open`       | present while open (on the trigger that opened it)               |
| trigger | `data-trigger-disabled` | present when the trigger or the tooltip is disabled              |
| popup   | `data-open`             | present when open                                                |
| popup   | `data-closed`           | present when closed (also while animating out)                   |
| popup   | `data-side`             | final side: `top` \| `bottom` \| `left` \| `right` \| `inline-*` |
| popup   | `data-align`            | `start` \| `center` \| `end`                                     |
| popup   | `data-instant`          | `delay` \| `dismiss` \| `focus`: skip the animation              |
| popup   | `data-starting-style`   | present on the first frame of opening                            |
| popup   | `data-ending-style`     | present while animating out                                      |
| popup   | `hidden`                | present when closed and not animating                            |
| arrow   | `data-side`             | same as the popup                                                |
| arrow   | `data-align`            | same as the popup                                                |
| arrow   | `data-instant`          | same as the popup                                                |
| arrow   | `data-uncentered`       | present when the arrow can't point at the anchor's center        |
| arrow   | `data-open`             | present when open                                                |
| arrow   | `data-closed`           | present when closed                                              |

| Part  | CSS variable         | Value                                                      |
| ----- | -------------------- | ---------------------------------------------------------- |
| popup | `--anchor-width`     | the anchor's width in px                                   |
| popup | `--anchor-height`    | the anchor's height in px                                  |
| popup | `--available-width`  | space available on the final side, in px                   |
| popup | `--available-height` | space available on the final side, in px                   |
| popup | `--transform-origin` | the anchor point relative to the popup (for scale/zoom-in) |
