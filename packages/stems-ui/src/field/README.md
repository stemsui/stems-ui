# field

`field` gives a form control a label, descriptions, and validation (native constraint validation
plus a custom `validate` function), and exposes the field's state as data attributes on every
part.

Base UI equivalent: [Field](https://base-ui.com/react/components/field).

## Usage

```tsx
import * as field from 'stems-ui/field'

;<field.Context name="email" validationMode="onBlur">
  <div mix={field.root()}>
    <label mix={field.label()}>Email</label>
    <input type="email" required mix={field.control()} />
    <p mix={field.description()}>We never share it.</p>
    <div mix={field.error({ match: 'valueMissing' })}>Enter your email.</div>
    <div mix={field.error({ match: 'typeMismatch' })}>
      <field.Validity>{(state) => state.error}</field.Validity>
    </div>
  </div>
</field.Context>
```

Custom validation (sync or async):

```tsx
<field.Context
  name="username"
  validationMode="onChange"
  validationDebounceTime={300}
  validate={async (value) => ((await isTaken(value)) ? 'That name is taken' : null)}
>
  …
</field.Context>
```

Any Stems control integrates with a field the same way `field.control()` does (`input`, and the
controls built on `lib/field-control.ts`): put it inside `<field.Context>` and it gets the
field's id, name, disabled state, ARIA wiring, and validation.

## `stems-ui/field`

- `<field.Context>` (Base UI `Field.Root` props)
  - `name`: identifies the field in a form. Wins over the control's `name`. Keys `form.Context`
    `errors`.
  - `disabled`: disables the field and its control. Wins over the control's `disabled`. An
    enclosing `fieldset.Context` with `disabled` also disables it.
  - `invalid`: forces the invalid state (for external validation libraries).
  - `dirty`, `touched`: control those states (for external libraries).
  - `validate(value, formValues)`: custom validation, run after native constraints pass. Return
    a message (or an array of messages) when invalid; `null`, `''`, `[]` or nothing when valid.
    May return a promise. Errors are applied with `setCustomValidity()`.
  - `validationMode`: `'onSubmit'` (default; validate on form submit, then on every change),
    `'onBlur'` (on blur, and on change while invalid), `'onChange'` (on every change). Wins over
    `form.Context`'s `validationMode`.
  - `validationDebounceTime`: debounce for `'onChange'` validation, in ms. Default `0`.
  - `actionsRef`: `{ current }` or a callback receiving `{ validate() }`.
- `field.root()`: the field's root element (any element; Base UI renders a `<div>`).
- `field.label()`: on a `<label>` host, sets `for` to the control's id. Clicking a non-`<label>`
  host, or the label of a non-labelable control (a `<span role="switch">`), focuses the control.
- `field.description()`: a description. Referenced by the control's `aria-describedby`.
- `field.error(options?)`: an error message, `hidden` unless it matches.
  - `match`: omitted → shown when the field is invalid; a `ValidityState` key (`'valueMissing'`,
    `'typeMismatch'`, `'patternMismatch'`, `'tooShort'`, `'tooLong'`, `'rangeUnderflow'`,
    `'rangeOverflow'`, `'stepMismatch'`, `'badInput'`, `'customError'`) → shown when invalid for
    that reason (`'customError'` covers `validate` and server errors); `'valid'` → shown when
    valid; `true` / `false` → always / never.
- `field.control(options?)`: the field's native `<input>`, `<textarea>` or `<select>`. This is
  the **same mixin** as `input()` from `stems-ui/input` (Base UI's `Field.Control` and `Input`
  are the same component too). Use one or the other on an element, not both. Options: `value`,
  `defaultValue`, `onValueChange(value, event)`, `disabled`.
- `<field.ItemContext disabled?>` (Base UI `Field.Item`): one item of a checkbox group or radio
  group. A `field.label()` / `field.description()` inside it labels / describes the item's control
  (the `checkbox.Context` or `radio.Context` inside it): `<label for>` targets the item's control
  id, the control gets `aria-labelledby` / `aria-describedby`. `disabled` disables the item's
  control (the field's `disabled` wins). `handle.context.get(field.ItemContext)` returns
  `{ state, disabled, controlId, labelId, describedBy }`.
- `field.item()`: the item's element (Base UI renders a `<div>`): the field state attributes, with
  `data-disabled` including the item's `disabled`.

  ```tsx
  <field.Context name="storage">
    <radioGroup.Context>
      <div aria-label="Storage" mix={radioGroup.root()}>
        <field.ItemContext>
          <div mix={field.item()}>
            <label mix={field.label()}>
              <radio.Context value="ssd">
                <span mix={radio.root()} />
              </radio.Context>
              SSD
            </label>
            <p mix={field.description()}>Faster</p>
          </div>
        </field.ItemContext>
      </div>
    </radioGroup.Context>
  </field.Context>
  ```

- `<field.Validity>{(state) => …}</field.Validity>`: renders content from the field's validity,
  like Base UI's `Field.Validity`. `state`: `{ validity, errors, error, value, initialValue,
transitionStatus }`. `validity` has the `ValidityState` flags plus `valid: boolean | null`.

Reading state: descendants can call `handle.context.get(field.Context)` for
`{ name, disabled, touched, dirty, valid, filled, focused, state, validity, validationMode,
controlId, labelId, validate() }`.

## Behavior notes

- `valid` is `null` until the field is validated, so neither `data-valid` nor `data-invalid` is
  rendered before the first validation (unless `invalid` or server errors apply).
- Native constraints (`required`, `pattern`, `min`, `type="email"`…) run first; `validate` runs
  only when they pass. Custom errors are set with `setCustomValidity()`, so `:invalid` and
  `form.checkValidity()` agree with the field.
- Inside a plain `<form>` (without `form.root()`), the browser's own validation still runs on
  submit; the root listens for the control's `invalid` event and shows the field's errors.
- Async `validate` results never block a submission. Stale async results are ignored.
- Errors use `data-starting-style` / `data-ending-style`: an error that stops matching stays
  shown until its exit animation finishes. The control's `aria-describedby` drops it at once.
- Error messages are app content (a mixin can't render children). Render text, or
  `<field.Validity>` to show the current messages.
- Ids: the control gets `<fieldId>-control` unless it has its own `id`, which the label then
  follows. On the server, ids of parts that render after the control (descriptions, errors)
  can't be in its `aria-describedby` yet. The field fixes it right after hydration.
- Host props win over the field: a host `name`, `disabled`, `id`, or `aria-describedby` on the
  control replaces the field's value.
- Inside a `field.ItemContext`, `field.label()` and `field.description()` label and describe the
  item's control instead of the field's (an item of an outer field doesn't capture the parts of a
  field nested inside it). Errors always belong to the field.

## Styling hooks

All parts (`root`, `label`, `description`, `error`, `item`, the control):

| Attribute       | Values                                                 |
| --------------- | ------------------------------------------------------ |
| `data-disabled` | Present when the field is disabled.                    |
| `data-valid`    | Present when the field was validated and is valid.     |
| `data-invalid`  | Present when the field is invalid.                     |
| `data-touched`  | Present after the control lost focus once.             |
| `data-dirty`    | Present when the value differs from the initial value. |
| `data-filled`   | Present when the control has a value.                  |
| `data-focused`  | Present while the control has focus.                   |

`error` also has `data-starting-style` / `data-ending-style` while it animates in or out. The
control has `aria-invalid="true"` while invalid.
