# input

`input` wires a native `<input>` (or `<textarea>` / `<select>`) with controlled/uncontrolled
value handling and Base UI's state data attributes. Inside a `field.Context` it is the field's
control.

Base UI equivalent: [Input](https://base-ui.com/react/components/input).

## Usage

```tsx
import { input } from 'stems-ui/input'

// Uncontrolled
;<input aria-label="Name" mix={input({ defaultValue: 'Ada' })} />

// Controlled
function NameField(handle: Handle) {
  let name = ''
  return () => (
    <input
      aria-label="Name"
      mix={input({
        value: name,
        onValueChange(value) {
          name = value
          void handle.update()
        },
      })}
    />
  )
}
```

Inside a field:

```tsx
import * as field from 'stems-ui/field'

;<field.Context name="email" validationMode="onBlur">
  <label mix={field.label()}>Email</label>
  <input type="email" required mix={input()} />
  <div mix={field.error()}>Enter a valid email.</div>
</field.Context>
```

## `stems-ui/input`

- `input(options?)`
  - `value`: the value. Use when controlled. The owner must re-render with the next value.
  - `defaultValue`: the initial value. Use when uncontrolled.
  - `onValueChange(value, event)`: called on every user edit (`input` event).
  - `disabled`: sets the native `disabled` attribute. Falls back to the host's `disabled` prop.
    An enclosing `field.Context` (or `fieldset.Context`) with `disabled` also disables it.
- `onInputChange(handler)`: listens for `stems:input-change` (`InputChangeEvent`, with `value`),
  which bubbles from the input after every user edit.

## Behavior notes

- Explicit host props win: a host `value` or `defaultValue` takes precedence over the options.
- `data-dirty` compares against the value from the first render.
- Base UI only sets `data-focused`, `data-touched`, `data-dirty`, and `data-filled` inside
  `Field.Root`. Stems sets them on a standalone input too, since they cost nothing and are useful
  for styling.
- **Inside a `field.Context`** the field owns the state: the input renders the field's state
  attributes (adding `data-valid` / `data-invalid` once validated), the field's control `id`
  (the `<label>`'s `for` target), `name`, `disabled`, `aria-invalid`, and `aria-describedby`
  (descriptions and visible errors), and it reports focus, blur and edits to the field for
  validation. `field.control()` is this same mixin: use one or the other, not both.
- Standalone, state changes between renders (focus, blur, typing) are written to the node directly
  instead of re-rendering the host. Inside a field, the field re-renders its parts.

## Styling hooks

| Attribute       | Values                                                 |
| --------------- | ------------------------------------------------------ |
| `data-disabled` | Present when the input is disabled.                    |
| `data-focused`  | Present while the input has focus.                     |
| `data-touched`  | Present after the input has lost focus once.           |
| `data-dirty`    | Present when the value differs from the initial value. |
| `data-filled`   | Present when the value is not empty.                   |
| `data-valid`    | Inside a field: present when validated and valid.      |
| `data-invalid`  | Inside a field: present when invalid.                  |
