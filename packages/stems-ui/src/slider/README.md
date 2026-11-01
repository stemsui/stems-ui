# slider

`slider` lets the user pick a value, or a range of values, by dragging thumbs along a track.

Base UI equivalent: [Slider](https://base-ui.com/react/components/slider).

## Usage

```tsx
import * as slider from 'stems-ui/slider'

function PriceRange() {
  return () => (
    <slider.Context defaultValue={[20, 80]} name="price" minStepsBetweenValues={5}>
      <div mix={slider.root()}>
        <span mix={slider.label()}>Price</span>
        <output mix={slider.value()}>
          <slider.ValueText />
        </output>
        <div class="relative flex touch-none items-center py-3" mix={slider.control()}>
          <div class="h-1 w-full bg-muted" mix={slider.track()}>
            <div class="h-full bg-primary" mix={slider.indicator()} />
          </div>
          <span
            class="size-4 rounded-full bg-white"
            aria-label="Minimum price"
            mix={slider.thumb({ index: 0 })}
          />
          <span
            class="size-4 rounded-full bg-white"
            aria-label="Maximum price"
            mix={slider.thumb({ index: 1 })}
          />
        </div>
      </div>
    </slider.Context>
  )
}
```

## `stems-ui/slider`

- `<slider.Context>` props (Base UI's `Slider.Root` props):
  - `value` / `defaultValue`: `number | number[]`. An array makes a range slider with one thumb
    per value. `defaultValue` defaults to `min`.
  - `onValueChange(value, details)`: `details` has `reason` (`'track-press' | 'drag' |
'keyboard'`), `event`, `trigger`, `activeThumbIndex`, `cancel()`, and `isCanceled`.
  - `onValueCommitted(value, { reason, event })`: fires on pointer release (only when the value
    changed) and after each keyboard step.
  - `min` (`0`), `max` (`100`), `step` (`1`, with `min` as the origin), `largeStep` (`10`),
    `minStepsBetweenValues` (`0`).
  - `orientation`: `'horizontal'` (default) or `'vertical'`.
  - `thumbAlignment`: `'center'` (default) or `'edge'` (`'edge-client-only'` is treated as
    `'edge'`).
  - `thumbCollisionBehavior`: `'push'` (default), `'swap'`, or `'none'`.
  - `disabled`, `name`, `form`, `format` (`Intl.NumberFormatOptions`), `locale`.
- `slider.root()`: `role="group"`, `aria-labelledby` pointing at `label()` when there is one.
- `slider.label()`: sets the `id` that the root and thumbs point at. Clicking it focuses the
  first enabled thumb.
- `slider.value()`: the host for the value text (use an `<output>`). Sets `aria-live="off"`
  and `for` (the thumb ids).
- `<slider.ValueText>`: renders the formatted values, joined with an en dash for ranges, as a
  text node. Pass a function child to customize it: `{(formattedValues, values) => …}`.
- `slider.control()`: the interactive area. Handles pointer presses and drags.
- `slider.track()`: the track. Defaults to `style="position: relative"` unless the host sets
  `style`.
- `slider.indicator()`: the filled range. Owns its inline position and size.
- `slider.thumb(options?)`: a focusable `role="slider"` element. It sets `aria-valuenow`,
  `aria-valuemin`, `aria-valuemax`, `aria-valuetext`, `aria-orientation`, and `tabindex`, and it
  owns its inline position. Options:
  - `index`: the index of the thumb's value. Without it, thumbs are numbered in render order.
    Pass it when thumbs render conditionally or out of order.
  - `disabled`: disables this thumb only.
  - `getAriaLabel(index)`, `getAriaValueText(formattedValue, value, index)`.
- Events: `stems:slider-change` (`SliderChangeEvent`: `value`, `reason`, `activeThumbIndex`)
  and `stems:slider-commit` (`SliderCommitEvent`: `value`, `reason`). Both bubble from the
  control. Listen with `slider.onSliderChange(handler)` and `slider.onSliderCommit(handler)`.

## Behavior notes

- **Thumbs are `role="slider"` elements, not nested `<input type="range">`.** Base UI nests a
  visually hidden range input in each thumb. A Remix mixin can't add children to its host, so
  Stems follows the WAI-ARIA slider pattern. Because of this, the `'input-change'` change reason
  never occurs, and the thumbs aren't labelable with `<label for>` (use `label()`,
  `aria-label`, or `aria-labelledby`). Browsers turn assistive-technology increment and
  decrement actions into arrow-key events for ARIA sliders.
- Form participation: when `name` is set, the Context renders one `<input type="hidden">` per
  thumb after its children. For a range slider, read the values with `FormData.getAll(name)`.
- Keyboard (on a thumb):
  - ArrowRight and ArrowUp increase the value. ArrowLeft and ArrowDown decrease it.
  - In RTL horizontal sliders, ArrowLeft increases the value and ArrowRight decreases it.
  - Shift+arrow and PageUp/PageDown step by `largeStep`.
  - Home and End go to `min` and `max`. In a range slider, they stop at the neighbor thumb.
  - Keyboard steps never pass the neighbor thumb (minus `minStepsBetweenValues`).
- Pointer:
  - Pressing the control moves the closest thumb to the press. If thumbs overlap, a press
    above them picks the last thumb and a press below picks the first, so they can be pulled
    apart.
  - Pressing a thumb grabs it without making it jump.
  - Dragging uses pointer capture on the control and sets `data-dragging` after the first move.
    Focus moves to the dragged thumb.
- Collisions during drags follow `thumbCollisionBehavior`:
  - `'push'` moves neighbor thumbs along.
  - `'swap'` lets the thumb pass its neighbor; focus follows the moved thumb.
  - `'none'` stops the thumb at its neighbor.
- Positioning is pure CSS, so it is correct in server HTML:
  - `center` alignment: `inset-inline-start: P%` (vertical sliders: `bottom: P%`) with
    `translate: -50% -50%`.
  - `edge` alignment translates the thumb by `-P%` of its own size. This keeps it inside the
    control without measuring it.
  - The control must be the thumbs' containing block (`position: relative`). Give it
    `touch-action: none` so touch drags don't scroll the page.
- RTL: server HTML assumes LTR. Each thumb checks its direction once mounted, and the thumbs
  re-render if the direction is RTL.
- Formatting:
  - The default `aria-valuetext` follows Base UI: `"<value> start range"` and
    `"<value> end range"` for range sliders, and the formatted value when `format` is set.
  - Formatting uses the runtime locale on both the server and the client. Pass `locale` when
    the two may differ.
- Labels:
  - Thumbs rendered after `label()` get `aria-labelledby` in server HTML.
  - The root, and any parts rendered before `label()`, get it after hydration.
- Field: inside `<field.Context>` the slider is the field's control. Its value (a number, or
  an array for a range) is the field value (`validate` receives it); the field's `name` wins for
  the hidden inputs and its (or an enclosing `fieldset.Context`'s) `disabled` disables the
  slider. Thumbs get `aria-labelledby` (the slider's `label()`, else the field label),
  `aria-describedby` (the field's descriptions and visible errors) and `aria-invalid`; the root
  gets the field's control id, so a `field.label()` click focuses the first enabled thumb, which
  is also focused when the field blocks a submission. Moving focus between thumbs doesn't blur
  the field. Like Base UI, there is no `required`, so the slider has no native validity element:
  validate with `validate`.

## Styling hooks

All parts (`root`, `label`, `value`, `control`, `track`, `indicator`, `thumb`):

| Attribute                     | Values                                                |
| ----------------------------- | ----------------------------------------------------- |
| `data-orientation`            | `horizontal` or `vertical`.                           |
| `data-dragging`               | Present while a thumb is being dragged.               |
| `data-disabled`               | Present when the slider (or thumb) is disabled.       |
| `data-valid` / `data-invalid` | In a field: validated and valid / invalid.            |
| `data-dirty`                  | In a field: the value changed from the initial value. |
| `data-touched`                | In a field: focus left the slider once.               |
| `data-focused`                | In a field: a thumb has focus.                        |

`thumb` also has `data-index` (its value index). The active thumb (the last one focused or
moved) gets `z-index: 1`. No CSS variables are set.
