# toggle-button

`toggleButton` wires a two-state button that can be pressed or not (`aria-pressed`). App code owns
the markup and visual styles.

Base UI equivalent: [Toggle](https://base-ui.com/react/components/toggle). It is named
`toggle-button` because Remix's `toggle` is a switch (see `stems-ui/switch`).

## Usage

```tsx
import { toggleButton } from 'stems-ui/toggle-button'

function BoldButton() {
  return () => (
    <button aria-label="Toggle bold" mix={toggleButton({ defaultPressed: true })}>
      B
    </button>
  )
}
```

Controlled:

```tsx
function BoldButton(handle: Handle) {
  let bold = false

  return () => (
    <button
      aria-label="Toggle bold"
      mix={toggleButton({
        pressed: bold,
        onPressedChange: (pressed) => {
          bold = pressed
          handle.update()
        },
      })}
    >
      B
    </button>
  )
}
```

Listen for changes on the button or any ancestor:

```tsx
<div mix={onToggleButtonChange((event) => console.log(event.value, event.pressed))}>
  <button mix={toggleButton({ value: 'bold' })}>B</button>
  <button mix={toggleButton({ value: 'italic' })}>I</button>
</div>
```

## `stems-ui/toggle-button`

- `toggleButton(options?)`: wires the button. Options (same as Base UI's `Toggle`):
  - `pressed`: controlled pressed state. The button is controlled when this is not `undefined`.
  - `defaultPressed`: initial uncontrolled state. Defaults to `false`.
  - `onPressedChange(pressed, event)`: called with the next state and the DOM event that caused
    it.
  - `disabled`: ignore interaction. A `disabled` (or `aria-disabled`) host prop works too.
  - `value`: identifies the button inside a
    [toggle button group](../toggle-button-group/README.md). Included in change events.
- `ToggleButtonChangeEvent`: bubbling `stems:toggle-button-change` event with `pressed` and
  `value`, dispatched from the button.
- `onToggleButtonChange(handler, capture?)`: typed listener mixin for `ToggleButtonChangeEvent`.

## Behavior notes

- Prefer a `<button>` host. It gets `type="button"`, native `disabled`, and native keyboard
  activation.
- Other hosts get `role="button"`, `tabIndex=0` (removed when disabled), `aria-disabled`, and
  keyboard activation.
- Inside `<toggleButtonGroup.Context>` the pressed state comes from the group (by `value`):
  `pressed` / `defaultPressed` are ignored, the group's `disabled` applies, and the buttons share
  one tab stop (`tabIndex` `0` / `-1`) moved with the arrow keys. See
  [`stems-ui/toggle-button-group`](../toggle-button-group/README.md).
- A toggle button doesn't submit a value with a form. Use `stems-ui/switch` for a form field.
- Explicit host props win (`attrs()` semantics), for example `type="submit"`.

| Key     | Action                                                 |
| ------- | ------------------------------------------------------ |
| `Space` | Toggles (native on `<button>`, keyup on other hosts)   |
| `Enter` | Toggles (native on `<button>`, keydown on other hosts) |

## Styling hooks

Boolean attributes are present (`""`) or absent. `aria-pressed` is always `"true"` or `"false"`.

| Attribute       | Present when           |
| --------------- | ---------------------- |
| `data-pressed`  | The button is pressed  |
| `data-disabled` | The button is disabled |
