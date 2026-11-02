# toggle-button-group

`toggleButtonGroup` shares a pressed-values array between toggle buttons from
[`stems-ui/toggle-button`](../toggle-button/README.md), in single or multiple mode, with roving
focus. App code owns the markup and visual styles.

Base UI equivalent: [Toggle Group](https://base-ui.com/react/components/toggle-group). It is named
`toggle-button-group` because Remix's `toggle` is a switch.

## Usage

```tsx
import { toggleButton } from 'stems-ui/toggle-button'
import * as toggleButtonGroup from 'stems-ui/toggle-button-group'

function Alignment() {
  return () => (
    <toggleButtonGroup.Context defaultValue={['left']}>
      <div aria-label="Text alignment" mix={toggleButtonGroup.root()}>
        <button aria-label="Align left" mix={toggleButton({ value: 'left' })}>
          L
        </button>
        <button aria-label="Align center" mix={toggleButton({ value: 'center' })}>
          C
        </button>
        <button aria-label="Align right" mix={toggleButton({ value: 'right' })}>
          R
        </button>
      </div>
    </toggleButtonGroup.Context>
  )
}
```

Several pressed at once: `<toggleButtonGroup.Context multiple>`.

## `stems-ui/toggle-button-group`

- `Context`: owns the pressed values. Props (same as Base UI's `ToggleGroup`):
  - `value`: pressed button values. Controlled when not `undefined`.
  - `defaultValue`: initially pressed values (uncontrolled). Defaults to `[]`.
  - `onValueChange(value, event)`: called with the next value and the DOM event that caused it.
  - `multiple`: allow several pressed buttons. Defaults to `false`: pressing a button releases
    the others, and pressing the pressed one releases it (value `[]`).
  - `disabled`: disable every button.
  - `orientation`: `'horizontal'` (default; Left/Right, mirrored in RTL) or `'vertical'`
    (Up/Down).
  - `loopFocus`: wrap arrow-key focus at the ends. Defaults to `true`.
  - `handle.context.get(toggleButtonGroup.Context)` returns
    `{ value, multiple, disabled, orientation, loopFocus }`.
- `root()`: sets `role="group"`, `data-orientation`, `data-disabled`, and `data-multiple`. Name it
  with `aria-label` or `aria-labelledby`.
- `ToggleButtonGroupChangeEvent`: bubbling `stems:toggle-button-group-change` event with the next
  `value`, dispatched from the button that changed. The button also dispatches its own
  `stems:toggle-button-change`.
- `onToggleButtonGroupChange(handler, capture?)`: typed listener mixin for the event.

## Behavior notes

- `toggleButton({ value })` inside the Context reads and updates the group: its own `pressed` /
  `defaultPressed` are ignored, `onPressedChange` still fires, and the group's `disabled` applies.
  Give every button a `value`; a button without one gets a generated id as its value.
- **Focus:** the buttons form one tab stop: the last focused button, or the first enabled one.
  Arrow keys (and Home/End) move focus without pressing; Space and Enter press. Disabled buttons
  are skipped.
- Toggle buttons don't submit form values. Like Base UI's ToggleGroup, the group is not a Field
  control, but an enclosing `<fieldset.Context disabled>` disables it.
- Base UI's change `reason` is always `'none'`, so Stems doesn't pass one.

| Key                        | Action                                               |
| -------------------------- | ---------------------------------------------------- |
| `ArrowRight` / `ArrowLeft` | Next / previous button (horizontal; mirrored in RTL) |
| `ArrowDown` / `ArrowUp`    | Next / previous button (vertical)                    |
| `Home` / `End`             | First / last enabled button                          |
| `Space` / `Enter`          | Press or release the focused button                  |

## Styling hooks

| Part   | Attribute          | Present when / value                |
| ------ | ------------------ | ----------------------------------- |
| root   | `data-orientation` | `"horizontal"` or `"vertical"`      |
| root   | `data-disabled`    | `disabled` is set                   |
| root   | `data-multiple`    | `multiple` is set                   |
| button | `data-pressed`     | The button is pressed               |
| button | `data-disabled`    | The button or the group is disabled |

## Inside a toolbar

When a toggle button group is placed inside a `toolbar.Context`, it hands arrow-key navigation to
the toolbar so the whole toolbar has one tab stop. Add `toolbar.item()` (or `toolbar.button()`) to
each toggle button's `mix` so it joins the toolbar's roving focus.
