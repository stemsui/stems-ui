# input

`input` wires a native `<input>` with controlled/uncontrolled value handling and Base UI's state
data attributes.

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

## `stems-ui/input`

- `input(options?)`
  - `value`: the value. Use when controlled. The owner must re-render with the next value.
  - `defaultValue`: the initial value. Use when uncontrolled.
  - `onValueChange(value, event)`: called on every user edit (`input` event).
  - `disabled`: sets the native `disabled` attribute. Falls back to the host's `disabled` prop.
- `onInputChange(handler)`: listens for `stems:input-change` (`InputChangeEvent`, with `value`),
  which bubbles from the input after every user edit.

## Behavior notes

- Explicit host props win: a host `value` or `defaultValue` takes precedence over the options.
- `data-dirty` compares against the value from the first render.
- Base UI only sets `data-focused`, `data-touched`, `data-dirty`, and `data-filled` inside
  `Field.Root`. Stems sets them on a standalone input too, since they cost nothing and are useful
  for styling. `data-valid` / `data-invalid` will come from Field (Phase 3), which will feed this
  mixin through a Context.
- State changes between renders (focus, blur, typing) are written to the node directly instead of
  re-rendering the host.

## Styling hooks

| Attribute       | Values                                                 |
| --------------- | ------------------------------------------------------ |
| `data-disabled` | Present when the input is disabled.                    |
| `data-focused`  | Present while the input has focus.                     |
| `data-touched`  | Present after the input has lost focus once.           |
| `data-dirty`    | Present when the value differs from the initial value. |
| `data-filled`   | Present when the value is not empty.                   |
