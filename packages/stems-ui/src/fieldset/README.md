# fieldset

`fieldset` groups related fields under a shared legend, and disables them together.

Base UI equivalent: [Fieldset](https://base-ui.com/react/components/fieldset).

## Usage

```tsx
import * as field from 'stems-ui/field'
import * as fieldset from 'stems-ui/fieldset'

;<fieldset.Context disabled={locked}>
  <fieldset mix={fieldset.root()}>
    <legend mix={fieldset.legend()}>Billing address</legend>
    <field.Context name="street">
      <label mix={field.label()}>Street</label>
      <input mix={field.control()} />
    </field.Context>
  </fieldset>
</fieldset.Context>
```

## `stems-ui/fieldset`

- `<fieldset.Context>`
  - `disabled`: disables the fieldset and every field inside it (through `field.Context`, so
    custom controls such as switches are disabled too, not only native inputs). Nested
    `fieldset.Context`s inherit it. Default `false`.
- `fieldset.root()`: the root. On a native `<fieldset>` it sets `disabled`. On any other element it
  sets `role="group"` and `aria-disabled`. It sets `aria-labelledby` to the legend's id unless the
  legend is a native `<legend>` inside a native `<fieldset>`, which already names it.
- `fieldset.legend()`: the legend. Gets an id (or keeps its own) and `data-disabled`. Use a native
  `<legend>` as the fieldset's first child, or any element (Base UI renders a `<div>`).

Descendants can read `{ disabled, legendId }` with `handle.context.get(fieldset.Context)`.

## Behavior notes

- `disabled` belongs to the Context, not to the host: a host `disabled` prop on the `<fieldset>`
  disables native controls but isn't seen by the fields inside.
- A non-native legend is only known after it renders, so server HTML has no `aria-labelledby` for
  it. It's added right after hydration. Prefer a native `<legend>`.

## Styling hooks

| Part     | Attribute       | Values                                 |
| -------- | --------------- | -------------------------------------- |
| `root`   | `data-disabled` | Present when the fieldset is disabled. |
| `legend` | `data-disabled` | Present when the fieldset is disabled. |
