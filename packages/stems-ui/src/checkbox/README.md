# checkbox

`checkbox` wires a tickable control (`role="checkbox"`) with an indicator, a mixed state, and a
hidden checkbox for native form participation. App code owns the markup and visual styles.

Base UI equivalent: [Checkbox](https://base-ui.com/react/components/checkbox).

## Usage

```tsx
import * as checkbox from 'stems-ui/checkbox'

function TermsCheckbox() {
  return () => (
    <label class="flex items-center gap-2">
      <checkbox.Context name="terms" required>
        <span class="checkbox" mix={checkbox.root()}>
          <span class="checkbox-indicator" mix={checkbox.indicator()}>
            ✓
          </span>
        </span>
      </checkbox.Context>
      Accept terms
    </label>
  )
}
```

Sibling label with a `<span>` root: pass `id` to the Context. It goes on the hidden input, like
Base UI. With a `<button>` root, put `id` on the button instead.

```tsx
<label for="terms">Accept terms</label>
<checkbox.Context id="terms">
  <span mix={checkbox.root()}>
    <span mix={checkbox.indicator()}>✓</span>
  </span>
</checkbox.Context>
```

Inside `<checkboxGroup.Context>` the checked state comes from the group (see
[`stems-ui/checkbox-group`](../checkbox-group/README.md)), including the `parent` checkbox.

Listen for changes on the checkbox or any ancestor:

```tsx
<div mix={checkbox.onCheckboxChange((event) => console.log(event.value, event.checked))}>
  {/* checkboxes */}
</div>
```

## `stems-ui/checkbox`

- `Context`: owns the checked state and renders the hidden `<input type="checkbox">` right after
  its children. Props (same as Base UI's `Checkbox.Root`):
  - `checked`: controlled checked state. Controlled when not `undefined`. Ignored inside a group.
  - `defaultChecked`: initial uncontrolled state. Defaults to `false`. Ignored inside a group.
  - `onCheckedChange(checked, event)`: called with the next state and the DOM event that caused it.
  - `indeterminate`: show the mixed state (`aria-checked="mixed"`). Controlled by the app; clicking
    still ticks or unticks the underlying value. A `parent` checkbox computes it from its group.
  - `disabled`: ignore interaction, and disable the hidden input (so it is not submitted).
  - `readOnly`: show the state but don't let the user change it.
  - `required`: the checkbox must be ticked for the form to be valid (native constraint
    validation).
  - `name`: form field name.
  - `value`: submitted while ticked (defaults to `"on"`, like a native checkbox). Inside a group it
    identifies the checkbox; it falls back to `name`.
  - `uncheckedValue`: submitted while unticked (through an extra `<input type="hidden">`). By
    default nothing is submitted.
  - `form`: id of the form that owns the hidden inputs.
  - `id`: id of the hidden input, for `<label for>` with a non-button root.
  - `inputRef(input, signal)`: receives the hidden checkbox.
  - `parent`: inside a checkbox group with `allValues`, tick or untick every child and show the
    mixed state when some are ticked.
  - `handle.context.get(checkbox.Context)` returns
    `{ checked, indeterminate, disabled, readOnly, required }`.
- `root()`: wires the control. Sets `role="checkbox"`, `aria-checked` (`"true"`, `"false"`, or
  `"mixed"`), `aria-readonly`, `aria-required`, the state data attributes, and click and Space
  activation. On a `<button>` host it sets `type="button"` and native `disabled`; on other hosts
  `tabIndex=0` (removed when disabled) and `aria-disabled`. A parent checkbox gets
  `aria-controls` listing its children; children in a group with `allValues` get a generated `id`
  (unless they have one).
- `indicator({ keepMounted? })`: sets `aria-hidden="true"` and the same state data attributes. It
  is `hidden` while the checkbox is neither ticked nor mixed, after its exit animation (Base UI's
  `data-starting-style` / `data-ending-style` lifecycle). `keepMounted: true` keeps it visible so
  CSS can style the unticked state. (A mixin can't remove its element, so "not mounted" means
  `hidden`.)
- `CheckboxChangeEvent`: bubbling `stems:checkbox-change` event with `checked` and `value` (the
  `value` or `name` option), dispatched from the root.
- `onCheckboxChange(handler, capture?)`: typed listener mixin for `CheckboxChangeEvent`.

## Behavior notes

- **Host:** use a `<span>` (the Base UI default) or a `<button>`. `<input>` hosts are not
  supported, because the indicator needs a child element and the Context already renders the
  input.
- **Forms:** activating the root clicks the hidden checkbox, so native `input` and `change` events
  fire on it and `FormData` sees it. Controlled checkboxes whose owner ignores the change snap
  back. Focus on the hidden input (for example from browser validation) moves to the root. The
  native `indeterminate` property mirrors the mixed state.
- **Labels:** keep `<checkbox.Context>` inside a wrapping `<label>`, so the hidden input is the
  label's control. Clicking the label toggles the checkbox once. A `<span>` root isn't labelable,
  so after mount it gets `aria-labelledby` pointing at the hidden input's label (an `id` is
  generated for the label if it has none), unless the host already has `aria-label` or
  `aria-labelledby`.
- **Keyboard:** Space toggles (WAI-ARIA APG). Enter is cancelled, so it doesn't activate a
  `<button>` root or submit a form.
- Explicit host props win (`attrs()` semantics).
- Base UI's change `reason` is always `'none'`, so Stems doesn't pass one.

| Key     | Action                                               |
| ------- | ---------------------------------------------------- |
| `Space` | Toggles the checkbox (on keyup for non-button hosts) |
| `Enter` | Nothing (default prevented)                          |

## Field integration

- **Standalone:** inside `<field.Context>` the checkbox is the field's control. The hidden checkbox
  gets the field's control id (`<label mix={field.label()}>` targets it; clicking the label ticks
  the checkbox) and `name`; `required` and the field's `validate` (called with the checked state)
  run on it. The root gets `aria-labelledby` (the field label), `aria-describedby`,
  `aria-invalid`, the field state attributes, and is focused when the field blocks a form
  submission.
- **In a checkbox group:** the group is the field's control (see
  [`checkbox-group`](../checkbox-group/README.md)). Each checkbox gets the field's state
  attributes and `aria-invalid`; wrap it in `<field.ItemContext>` so a `field.label()` /
  `field.description()` inside the item label and describe it (the hidden input gets the item's
  control id). Its hidden input submits its `value` under the field's `name`.
- `disabled` also comes from the group, a `field.ItemContext`, the field, or an enclosing
  `fieldset.Context`.

## Styling hooks

Root and indicator get the same attributes. Boolean attributes are present (`""`) or absent.

| Attribute                                   | Present when                                 |
| ------------------------------------------- | -------------------------------------------- |
| `data-checked`                              | Ticked (and not mixed)                       |
| `data-unchecked`                            | Unticked (and not mixed)                     |
| `data-indeterminate`                        | Mixed state                                  |
| `data-disabled`                             | `disabled` is set (or the group is disabled) |
| `data-readonly`                             | `readOnly` is set                            |
| `data-required`                             | `required` is set                            |
| `data-starting-style` / `data-ending-style` | Indicator only: while it animates in / out   |
| `data-valid`                                | In a field: validated and valid              |
| `data-invalid`                              | In a field: invalid                          |
| `data-dirty`                                | In a field: changed from the initial value   |
| `data-touched`                              | In a field: the control lost focus once      |
| `data-filled`                               | In a field: ticked                           |
| `data-focused`                              | In a field: the control has focus            |

In a group, the field attributes describe the whole group's field (`data-filled`: any checkbox
is ticked). The root also gets `aria-invalid="true"` while the field is invalid.
