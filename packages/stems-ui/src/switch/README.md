# switch

`switch` wires an on/off control (`role="switch"`) with a thumb and a hidden checkbox for native
form participation. App code owns the markup and visual styles.

Base UI equivalent: [Switch](https://base-ui.com/react/components/switch).

> Remix's `@remix-run/ui/toggle` is a switch. Stems calls it `switch` and uses `toggle-button` for
> Base UI's Toggle (an `aria-pressed` button).

## Usage

```tsx
import * as switch_ from 'stems-ui/switch'

function NotificationsSwitch() {
  return () => (
    <label class="flex items-center gap-2">
      <switch_.Context name="notifications" defaultChecked>
        <span class="switch" mix={switch_.root()}>
          <span class="switch-thumb" mix={switch_.thumb()} />
        </span>
      </switch_.Context>
      Notifications
    </label>
  )
}
```

`switch` is a reserved word, so import the module as a namespace with another name (`switch_`).

Sibling label, with a native button root:

```tsx
<label for="airplane">Airplane mode</label>
<switch_.Context>
  <button id="airplane" mix={switch_.root()}>
    <span mix={switch_.thumb()} />
  </button>
</switch_.Context>
```

Sibling label, with a `<span>` root: pass `id` to the Context. It goes on the hidden input, like
Base UI.

```tsx
<label for="airplane">Airplane mode</label>
<switch_.Context id="airplane">
  <span mix={switch_.root()}>
    <span mix={switch_.thumb()} />
  </span>
</switch_.Context>
```

Listen for changes on the switch or any ancestor:

```tsx
<div mix={switch_.onSwitchChange((event) => console.log(event.checked))}>{/* switches */}</div>
```

## `stems-ui/switch`

- `Context`: owns the checked state and renders the hidden `<input type="checkbox">` right after
  its children. Props (same as Base UI's `Switch.Root`):
  - `checked`: controlled checked state. The switch is controlled when this is not `undefined`.
  - `defaultChecked`: initial uncontrolled state. Defaults to `false`.
  - `onCheckedChange(checked, event)`: called with the next state and the DOM event that caused it.
  - `disabled`: ignore interaction, and disable the hidden input (so it is not submitted).
  - `readOnly`: show the state but don't let the user change it.
  - `required`: the switch must be on for the form to be valid (native constraint validation).
  - `name`: form field name.
  - `value`: submitted when on. Defaults to `"on"`, like a native checkbox.
  - `uncheckedValue`: submitted when off (through an extra `<input type="hidden">`). By default
    nothing is submitted when off.
  - `form`: id of the form that owns the hidden inputs.
  - `id`: id of the hidden input, for `<label for>` with a non-button root.
  - `inputRef(input, signal)`: receives the hidden checkbox.
  - `handle.context.get(switch_.Context)` returns `{ checked, disabled, readOnly, required }`.
- `root()`: wires the control. Sets `role="switch"`, `aria-checked`, `aria-readonly`,
  `aria-required`, the state data attributes, and click and keyboard activation. On a `<button>`
  host it sets `type="button"` and native `disabled`. On other hosts it sets `tabIndex=0` (removed
  when disabled) and `aria-disabled`.
- `thumb()`: sets the same state data attributes as the root.
- `SwitchChangeEvent`: bubbling `stems:switch-change` event with `checked`, dispatched from the
  root.
- `onSwitchChange(handler, capture?)`: typed listener mixin for `SwitchChangeEvent`.

## Behavior notes

- **Host:** use a `<span>` (the Base UI default) or a `<button>`. `<input>` hosts are not
  supported, because the thumb needs a child element and the Context already renders the input.
- **Forms:** activating the root clicks the hidden checkbox, so native `input` and `change` events
  fire on it and `FormData` sees it. Controlled switches whose owner ignores the change snap back.
  Focus on the hidden input (for example from browser validation) moves to the root.
- **Labels:** keep `<switch_.Context>` inside a wrapping `<label>`, so the hidden input is the
  label's control. Clicking the label toggles the switch once. A `<span>` root isn't labelable, so
  after mount the root gets `aria-labelledby` pointing at the hidden input's label (an `id` is
  generated for the label if it has none). This is skipped when the host already has `aria-label`
  or `aria-labelledby`. A `<button>` root is named by its label natively.
- **Field:** inside `<field.Context>` the switch is the field's control. The hidden checkbox gets
  the field's control id (so `<label mix={field.label()}>` targets it, and clicking it toggles the
  switch) and the field's `name`; `required` and the field's `validate` (called with the checked
  state) run on it. The root gets `aria-labelledby` (the field label, also on a `<button>` root),
  `aria-describedby` (descriptions and visible errors), `aria-invalid`, the field state
  attributes, and is focused when the field blocks a form submission. Server `errors` show until
  the switch is toggled. The field's (or an enclosing `fieldset.Context`'s) `disabled` disables it.
- Explicit host props win (`attrs()` semantics).

| Key     | Action                                                     |
| ------- | ---------------------------------------------------------- |
| `Space` | Toggles the switch (on keyup for non-button hosts)         |
| `Enter` | Toggles the switch (native on `<button>`, keydown on span) |

## Styling hooks

Root and thumb get the same attributes. Boolean attributes are present (`""`) or absent.

| Attribute        | Present when                               |
| ---------------- | ------------------------------------------ |
| `data-checked`   | The switch is on                           |
| `data-unchecked` | The switch is off                          |
| `data-disabled`  | `disabled` is set                          |
| `data-readonly`  | `readOnly` is set                          |
| `data-required`  | `required` is set                          |
| `data-valid`     | In a field: validated and valid            |
| `data-invalid`   | In a field: invalid                        |
| `data-dirty`     | In a field: changed from the initial state |
| `data-touched`   | In a field: the root lost focus once       |
| `data-filled`    | In a field: the switch is on               |
| `data-focused`   | In a field: the root has focus             |

The root also gets `aria-invalid="true"` while the field is invalid.
