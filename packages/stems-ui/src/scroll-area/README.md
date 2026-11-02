# scroll-area

`scroll-area` is a native scroll container with custom scrollbars. The viewport scrolls natively
(wheel, touch, keyboard, find-in-page, scroll anchoring all keep working); the native scrollbars
are hidden and replaced by styleable tracks and thumbs that stay in sync.

Base UI equivalent: [Scroll Area](https://base-ui.com/react/components/scroll-area). Behavior is
adapted from Base UI 1.9.0 (MIT).

## Usage

```tsx
import * as scrollArea from 'stems-ui/scroll-area'

function Tags() {
  return () => (
    <scrollArea.Context>
      <div class="scroll-area" mix={scrollArea.root()}>
        <div class="viewport" mix={scrollArea.viewport()}>
          <div mix={scrollArea.content()}>{/* long content */}</div>
        </div>
        <div class="scrollbar" mix={scrollArea.scrollbar()}>
          <div class="thumb" mix={scrollArea.thumb()} />
        </div>
        <div class="scrollbar" mix={scrollArea.scrollbar({ orientation: 'horizontal' })}>
          <div class="thumb" mix={scrollArea.thumb({ orientation: 'horizontal' })} />
        </div>
        <div mix={scrollArea.corner()} />
      </div>
    </scrollArea.Context>
  )
}
```

Size the root and give the viewport `height: 100%` (or a fixed size); give vertical scrollbars a
width and horizontal ones a height.

## `stems-ui/scroll-area`

- `<scrollArea.Context>`: owns the measured state.
  - `overflowEdgeThreshold`: pixels that must be scrolled past an edge before its
    `data-overflow-*` attribute applies. A number for every edge or
    `{ xStart, xEnd, yStart, yEnd }`. Defaults to `0`.
  - Context value (`handle.context.get(scrollArea.Context)`): `state` (a live, read-only
    `ScrollAreaState`: `hovering`, `scrolling`, `scrollingX`, `scrollingY`, `hasOverflowX`,
    `hasOverflowY`, `overflowXStart`, `overflowXEnd`, `overflowYStart`, `overflowYEnd`,
    `cornerHidden`) and `measure()`, which re-measures after changes no observer can see.
- `scrollArea.root()`: groups the parts. `role="presentation"`, `position: relative` (host
  `style` can override), tracks hover.
- `scrollArea.viewport()`: the scroll container. `overflow: scroll` and `scrollbar-width: none`
  (host `style` can override). Focusable (`tabindex="0"`) while it can scroll, `-1` otherwise,
  unless the host sets `tabIndex`.
- `scrollArea.content()`: optional wrapper inside the viewport. `role="presentation"`,
  `min-width: fit-content`. Its size is observed, so content growth updates the scrollbars. Without
  it only viewport resizes are observed (call `measure()` yourself).
- `scrollArea.scrollbar(options?)`
  - `orientation`: `'vertical'` (default) or `'horizontal'`.
  - `keepMounted`: keep the scrollbar visible when its axis doesn't overflow. Defaults to `false`.
- `scrollArea.thumb(options?)`
  - `orientation`: the orientation of its scrollbar. Without it the thumb reads it from its
    scrollbar after mounting, so pass it on horizontal thumbs for correct server-rendered markup.
- `scrollArea.corner()`: fills the corner where both scrollbars meet.
- Types: `ScrollAreaContextProps`, `ScrollAreaContextValue`, `ScrollAreaState`,
  `ScrollAreaScrollbarOptions`, `ScrollAreaThumbOptions`, `ScrollAreaOrientation`,
  `OverflowEdgeThreshold`, `OverflowEdges`.

There are no change events: Base UI's scroll area has no change callbacks. Listen to the
viewport's native `scroll` event if you need one.

## Behavior notes

- **Scrolling** stays native. Keyboard scrolling (arrows, Page Up/Down, Home/End, Space) works when
  the viewport has focus; it is in the tab order only while it can scroll, as in Base UI.
- **Thumbs** are dragged with pointer capture. Dragging disables CSS scroll snapping until release
  (like native scrollbars). A move without the primary button ends a drag whose release got lost.
- **Pressing the track** jumps so the thumb centers on the pointer, then keeps dragging from there
  (Base UI's behavior; it does not page).
- **Wheel over a scrollbar** scrolls the viewport (the scrollbar sits outside it), and chains to
  the page at an edge.
- `data-scrolling` is set for user scrolls only (wheel, touch, keyboard, pointer, thumb drags), not
  for programmatic `scrollTop` changes, and clears 500 ms after the last scroll.
- `data-hovering` is set on scrollbars while a mouse or pen is over the root (not touch).
- **RTL:** the horizontal thumb, overflow edges, and track presses follow `getDirection(viewport)`
  (nearest `dir`, `<DirectionProvider>`, or computed `direction`). Scrollbars and the corner use
  logical `inset-inline-*` positions, so they flip with the layout.
- **No overflow:** scrollbars get `hidden` (Base UI doesn't render them; a mixin can't remove its
  host). The corner is `hidden` unless both axes overflow. `hidden` needs a stylesheet that
  doesn't override it (Tailwind's preflight makes `[hidden]` `display: none !important`).
- **Measuring** runs after hydration and whenever the viewport or `content()` resizes, or the
  viewport scrolls. Scroll updates write attributes, CSS variables and the thumb `transform`
  straight to the DOM instead of re-rendering, so scrolling never re-renders your content. Mixin
  renders read the same state, so app re-renders agree with the DOM.
- **Server rendering:** nothing is measured. Scrollbars and the corner render `hidden`, thumbs
  `visibility: hidden`, the viewport `tabindex="-1"`, and corner/thumb size variables `0px`.
  The overflow variables are unset, so `var(--scroll-area-overflow-y-end, 40px)` fallbacks apply
  until hydration.
- Like Base UI, the four `--scroll-area-overflow-*` variables are registered as non-inherited
  (`CSS.registerProperty`, skipped in Safari) so deep subtrees don't restyle on every scroll.
  Children opt in with `--scroll-area-overflow-y-start: inherit`.
- **Native scrollbars** are hidden with `scrollbar-width: none` (Chromium, Firefox, Safari 18.2+).
  Older Safari also needs `.viewport::-webkit-scrollbar { display: none }` in your stylesheet
  (the registry component adds `[&::-webkit-scrollbar]:hidden`).
- Not implemented from Base UI: waiting for transform animations inside the viewport before
  re-measuring (call `measure()` after such an animation).

## Styling hooks

Shared attributes (on `root`, `viewport`, `content` and `scrollbar`):

| Attribute               | Description                                                           |
| ----------------------- | --------------------------------------------------------------------- |
| `data-has-overflow-x`   | Present when the content is wider than the viewport.                  |
| `data-has-overflow-y`   | Present when the content is taller than the viewport.                 |
| `data-overflow-x-start` | Present when there is overflow on the inline-start side.              |
| `data-overflow-x-end`   | Present when there is overflow on the inline-end side.                |
| `data-overflow-y-start` | Present when there is overflow above.                                 |
| `data-overflow-y-end`   | Present when there is overflow below.                                 |
| `data-scrolling`        | Present while the user scrolls (per axis on `scrollbar` and `thumb`). |

| Part        | Attribute / variable                                        | Description                                        |
| ----------- | ----------------------------------------------------------- | -------------------------------------------------- |
| `root`      | `--scroll-area-corner-width`, `--scroll-area-corner-height` | The corner size (`0px` without a corner).          |
| `viewport`  | `--scroll-area-overflow-{x,y}-{start,end}`                  | Distance from each edge in pixels (non-inherited). |
| `scrollbar` | `data-orientation`                                          | `vertical` or `horizontal`.                        |
| `scrollbar` | `data-hovering`                                             | Present while the pointer is over the root.        |
| `scrollbar` | `--scroll-area-thumb-height` / `--scroll-area-thumb-width`  | The thumb length for its orientation.              |
| `scrollbar` | `hidden`                                                    | Its axis doesn't overflow (not `keepMounted`).     |
| `thumb`     | `data-orientation`, `data-scrolling`                        | As on its scrollbar.                               |
| `corner`    | `hidden`                                                    | Fewer than two scrollbars are needed.              |

A common pattern from Base UI's docs:

```css
.scrollbar {
  opacity: 0;
  transition: opacity 150ms;
  pointer-events: none;
}
.scrollbar[data-hovering],
.scrollbar[data-scrolling] {
  opacity: 1;
  pointer-events: auto;
}
.scrollbar[data-scrolling] {
  transition-duration: 0ms;
}

.viewport {
  mask-image: linear-gradient(
    to bottom,
    transparent 0,
    black min(40px, var(--scroll-area-overflow-y-start)),
    black calc(100% - min(40px, var(--scroll-area-overflow-y-end, 40px))),
    transparent 100%
  );
}
```
