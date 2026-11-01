# radio

`radio` wires one radio button (`role="radio"`) inside a
[`stems-ui/radio-group`](../radio-group/README.md), with an indicator and a hidden
`<input type="radio">` for forms. App code owns the markup and visual styles.

Base UI equivalent: [Radio](https://base-ui.com/react/components/radio) (`Radio.Root`,
`Radio.Indicator`).

## Usage

```tsx
import * as radio from 'stems-ui/radio'
import * as radioGroup from 'stems-ui/radio-group'

;<radioGroup.Context name="storage">
  <div aria-label="Storage" mix={radioGroup.root()}>
    <label>
      <radio.Context value="ssd">
        <span mix={radio.root()}>
          <span mix={radio.indicator()} />
        </span>
      </radio.Context>
      SSD
    </label>
  </div>
</radioGroup.Context>
```

Sibling label: pass `id` to `<radio.Context>` for a `<span>` root (it goes on the hidden input),
or put `id` on a `<button>` root.

## `stems-ui/radio`

- `Context`: per-radio provider. Must be inside `<radioGroup.Context>`. Renders the hidden
  `<input type="radio">` right after its children. Props (same as Base UI's `Radio.Root`):
  - `value` (required): identifies the radio and is submitted while it is selected.
  - `disabled`: ignore interaction. Defaults to the group's `disabled`.
  - `readOnly`: don't let the user select it. Defaults to the group's `readOnly`.
  - `required`: defaults to the group's `required`.
  - `id`: id of the hidden input, for `<label for>` with a non-button root.
  - `inputRef(input, signal)`: receives the hidden radio.
  - `handle.context.get(radio.Context)` returns `{ value, checked, disabled, readOnly, required }`.
- `root()`: sets `role="radio"`, `aria-checked`, the roving `tabIndex` (`0` for the group's tab
  stop, `-1` otherwise, removed when disabled), the state data attributes, and click, Space, and
  arrow-key handling. On a `<button>` host it sets `type="button"` and native `disabled`; on other
  hosts `aria-disabled`. A `<span>` root gets `aria-labelledby` pointing at its hidden input's
  label after mount (unless it already has `aria-label` / `aria-labelledby`).
- `indicator({ keepMounted? })`: sets `aria-hidden="true"` and the state data attributes. It is
  `hidden` while the radio isn't selected (after its exit animation) unless `keepMounted` is set.

Base UI's `nativeButton` / `render` props map to choosing a `<button>` host for `root()`.

## Styling hooks

Root and indicator get the same attributes. Boolean attributes are present (`""`) or absent.

| Attribute                                   | Present when                                                 |
| ------------------------------------------- | ------------------------------------------------------------ |
| `data-checked`                              | The radio is selected                                        |
| `data-unchecked`                            | The radio is not selected                                    |
| `data-disabled`                             | The radio or its group is disabled                           |
| `data-readonly`                             | The radio or its group is read-only                          |
| `data-required`                             | The radio or its group is required                           |
| `data-starting-style` / `data-ending-style` | Indicator only: while it animates in / out                   |
| `data-valid` / `data-invalid`               | In a field: the group's field is valid / invalid             |
| `data-dirty` / `data-touched`               | In a field: the group's value changed / focus left the group |
| `data-filled`                               | In a field: the group has a selected radio                   |
| `data-focused`                              | In a field: focus is inside the group                        |

Inside a `<field.ItemContext>`, the radio's hidden input gets the item's control id, the root is
`aria-labelledby` the item's `field.label()` and `aria-describedby` its `field.description()`, and
the item's `disabled` disables the radio. `role="radio"` doesn't support `aria-invalid`; the
radio group gets it.
