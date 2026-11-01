# preview-card

`preview-card` shows a preview of a link's destination when the link is hovered or focused with
the keyboard. The card opens in the top layer after a delay, can be hovered, and never takes
focus. App code owns the markup and visual styles.

Base UI equivalent: [Preview Card](https://base-ui.com/react/components/preview-card) (shadcn/ui
calls it Hover Card).

## Usage

```tsx
import * as previewCard from 'stems-ui/preview-card'

function Mention() {
  return () => (
    <previewCard.Context>
      <a href="https://github.com/remix-run" mix={previewCard.trigger()}>
        @remix-run
      </a>
      <div
        class="w-64 rounded-lg bg-white p-4 shadow-md transition-[opacity,scale] origin-(--transform-origin) data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0"
        mix={previewCard.popup({ sideOffset: 8 })}
      >
        Remix – build better websites.
      </div>
    </previewCard.Context>
  )
}
```

The card is a visual enhancement for sighted mouse and keyboard users: screen readers only see
the link, and the card doesn't open on touch. Keep everything in it available on the linked
page.

Control the state with `open` and `onOpenChange(open, details)`, or let the context own it with
`defaultOpen`. Listen for bubbling changes on the trigger or an ancestor:

```tsx
<div mix={previewCard.onPreviewCardChange((event) => console.log(event.open, event.reason))}>…</div>
```

### Differences from Base UI

- **No Portal, no Positioner element.** The popup is shown in the top layer with
  `popover="manual"` + `showPopover()`. Base UI's Positioner props are options of `popup()`,
  and the positioner's data attributes and CSS variables are set on the popup element.
- **Render the card outside inline text containers** like `<p>`: the popup is usually a `<div>`,
  which can't be a child of a paragraph (the HTML parser would move it). Use a `<div>` or
  `<span>` wrapper.
- Because the card is rendered where you put it (not portaled to the end of `<body>`), links
  inside it follow the trigger in Tab order while it's open.
- `createHandle()` / detached triggers / payloads, `triggerId`, the Viewport part, `actionsRef`,
  inline-rect anchoring for wrapped links, `--positioner-*` / `--popup-*` variables,
  `data-anchor-hidden`, `collisionAvoidance`, `collisionBoundary`, `sticky`, `positionMethod`,
  and `disableAnchorTracking` are not supported.
- The popup element always stays in the DOM (closed popups get `hidden`).

## `stems-ui/preview-card`

- `Context`: provider that owns the open state (Base UI's `PreviewCard.Root`). Read it in
  components with `handle.context.get(previewCard.Context)` (`open`, `openReason`,
  `setOpen(open, { reason })`, `activeTrigger`, `side`, `align`, …).
  - `open`: `boolean`. Controlled open state.
  - `defaultOpen`: `boolean`. Initial uncontrolled state. Defaults to `false`.
  - `onOpenChange(open, details)`: called before the state changes. `details` has `reason`,
    `event`, `trigger`, and `cancel()` (keeps the current state).
  - `onOpenChangeComplete(open)`: called after the enter or exit animation finished.
- `trigger(options?)`: the link (`<a href>`). Renders `data-popup-open`; doesn't change the
  link's role, ARIA, or press behavior.
  - `delay`: `number`. How long to wait before opening on hover or keyboard focus, in ms.
    Defaults to `600`.
  - `closeDelay`: `number`. How long to wait before closing after the pointer leaves, in ms.
    Defaults to `300`.
- `popup(options?)`: the card (Base UI's Positioner + Popup). Sets `id`, `popover="manual"`,
  `tabIndex={-1}`, `hidden` while closed, and the attributes and variables below. No role (Base
  UI doesn't announce it). Never moves focus.
  - `side`: `'top' | 'bottom' | 'left' | 'right' | 'inline-start' | 'inline-end'`. Defaults to
    `'bottom'`. Flips to the opposite side when it doesn't fit.
  - `align`: `'start' | 'center' | 'end'`. Defaults to `'center'`.
  - `sideOffset`, `alignOffset`: `number | (data) => number`. Default `0`.
  - `collisionPadding`: `number | { top, right, bottom, left }`. Defaults to `5`.
  - `arrowPadding`: `number`. Defaults to `5`.
  - `anchor`: `HTMLElement | { x, y, width?, height? } | () => …`.
- `arrow()`: an element inside the popup that points at the anchor (inline `position: absolute`
  plus `left` or `top`; add `overflow: visible` to the popup).
- `backdrop()`: an optional overlay shown in the top layer beneath the card
  (`popover="manual"`, `role="presentation"`). Style it to cover the viewport.
- `onPreviewCardChange(handler)`: listener mixin for `PreviewCardChangeEvent`
  (`stems:preview-card-change`, bubbles from the active trigger, has `open` and `reason`).

### Change reasons

`'trigger-hover'`, `'trigger-focus'` (keyboard focus and blur), `'outside-press'`,
`'escape-key'`, `'focus-out'` (focus left the card), and `'none'` (state changed through the
controlled `open` prop).

## Behavior notes

- **Hover:** opens after `delay` (mouse and pen only, not touch). Leaving the link closes the
  card after `closeDelay`, unless the pointer moves onto the card (or toward it, via
  hover-aim).
- **Keyboard focus:** opens after `delay` when the link matches `:focus-visible` (Tab), not when
  a pointer press focused it. Blur closes it unless focus moved into the card.
- **Press:** pressing the link follows it; the card doesn't toggle.
- **Escape** closes the card through the shared dismiss-layer stack and stops the event, so a
  card inside a popover or dialog closes without closing its container. An outside press closes
  it too.
- **Focus** never moves into or out of the card.

## Styling hooks

| Part     | Attribute             | Values / notes                                                   |
| -------- | --------------------- | ---------------------------------------------------------------- |
| trigger  | `data-popup-open`     | present while open (on the trigger that opened it)               |
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
