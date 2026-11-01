# radio-group

`radioGroup` owns the selected value of a set of radios from [`stems-ui/radio`](../radio/README.md):
a single tab stop, arrow-key selection, and hidden native radios for forms. App code owns the
markup and visual styles.

Base UI equivalent: [Radio Group](https://base-ui.com/react/components/radio-group) (`RadioGroup`
and `Radio`). Like Base UI, the group and the radio are separate modules.

## Usage

```tsx
import * as radio from 'stems-ui/radio'
import * as radioGroup from 'stems-ui/radio-group'

function StorageType() {
  return () => (
    <radioGroup.Context name="storage" defaultValue="ssd">
      <div aria-labelledby="storage-label" mix={radioGroup.root()}>
        <div id="storage-label">Storage type</div>
        {['ssd', 'hdd'].map((value) => (
          <label>
            <radio.Context value={value}>
              <span class="radio" mix={radio.root()}>
                <span class="radio-indicator" mix={radio.indicator()} />
              </span>
            </radio.Context>
            {value.toUpperCase()}
          </label>
        ))}
      </div>
    </radioGroup.Context>
  )
}
```

Listen for changes on any ancestor:

```tsx
<div mix={radioGroup.onRadioGroupChange((event) => console.log(event.value))}>{/* group */}</div>
```

## `stems-ui/radio-group`

- `Context`: owns the selected value. Props (same as Base UI's `RadioGroup`):
  - `value`: the selected radio's value, or `null` for none. Controlled when not `undefined`.
  - `defaultValue`: the initially selected value (uncontrolled).
  - `onValueChange(value, event)`: called with the selected value and the DOM event that caused
    it.
  - `name`: form field name, shared by every radio's hidden input.
  - `form`: id of the form that owns the hidden inputs.
  - `disabled`: disable every radio (and the hidden inputs).
  - `readOnly`: show the selection but don't let the user change it.
  - `required`: a radio must be selected for the form to be valid (native constraint validation).
  - `orientation`: `'horizontal'` or `'vertical'`, sets `aria-orientation`. Arrow keys on both
    axes work either way, as in the WAI-ARIA APG radio group (Base UI has no such prop).
  - `handle.context.get(radioGroup.Context)` returns
    `{ value, name, form, disabled, readOnly, required, orientation }`.
- `root()`: sets `role="radiogroup"`, `aria-disabled`, `aria-readonly`, `aria-required`,
  `aria-orientation`, and `data-disabled`. Name it with `aria-label` or `aria-labelledby`.
- `RadioGroupChangeEvent`: bubbling `stems:radio-group-change` event with the selected `value`,
  dispatched from the selected radio.
- `onRadioGroupChange(handler, capture?)`: typed listener mixin for the event.

## Behavior notes

- **Focus:** the radios form one tab stop: the selected radio, or the first enabled one when
  nothing (or a disabled radio) is selected. Disabled radios are skipped.
- **Keyboard:** arrow keys move focus to the next or previous enabled radio, wrapping around, and
  select it (unless the group is read-only). Left/Right are mirrored in RTL (`dir="rtl"` read at
  key time). Space selects the focused radio. Enter does nothing (default prevented).
- **Forms:** each radio renders a hidden `<input type="radio">` with the group's `name`, `form`,
  and `required`; selecting a radio clicks it, so native `input`/`change` events fire. A
  controlled group whose owner ignores the change snaps back.
- Base UI's change `reason` is always `'none'`, so Stems doesn't pass one.
- **Field:** inside `<field.Context>` the group is the field's control. Its value (`null` until a
  radio is selected) is the field value; the field's `name` wins for the hidden radios; with
  `required`, the hidden radios report `valueMissing` until one is selected. The root gets the
  field state attributes, `aria-labelledby` (a `field.label()` outside any item),
  `aria-describedby`, and `aria-invalid`; the selected (or first enabled) radio is focused when
  the field blocks a submission. Wrap each radio in `<field.ItemContext>` to label it with a
  `field.label()` (Base UI's `Field.Item`). Moving focus between radios doesn't blur the field.
  The field's (or an enclosing `fieldset.Context`'s) `disabled` disables every radio.
- Without a `name` (on the group or the field), hidden radios are not one native group: with
  `required`, each unselected radio reports `valueMissing` to native validation of plain forms
  (inside `form.root()` and a field, only the selected radio's input is checked).

| Key                        | Action                                         |
| -------------------------- | ---------------------------------------------- |
| `ArrowDown` / `ArrowRight` | Focus and select the next radio (wraps)        |
| `ArrowUp` / `ArrowLeft`    | Focus and select the previous radio (wraps)    |
| `Space`                    | Select the focused radio                       |
| `Tab`                      | Move into / out of the group (single tab stop) |

## Styling hooks

| Part | Attribute       | Present when                                            |
| ---- | --------------- | ------------------------------------------------------- |
| root | `data-disabled` | `disabled` is set (or the field / fieldset is disabled) |

Radio and indicator attributes are listed in [`stems-ui/radio`](../radio/README.md). Inside a
field, the root also gets the field state attributes (`data-valid`, `data-invalid`,
`data-dirty`, `data-touched`, `data-filled`, `data-focused`; a Stems extra, Base UI documents only
`data-disabled` on the group) and `aria-invalid="true"` while invalid.
