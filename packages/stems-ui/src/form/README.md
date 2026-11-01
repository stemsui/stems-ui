# form

`form` wires a native `<form>` to its fields: it validates every field on submit, blocks invalid
submissions and focuses the first invalid control, and shows errors returned by the server on
the matching fields.

Base UI equivalent: [Form](https://base-ui.com/react/components/form).

## Usage

```tsx
import * as field from 'stems-ui/field'
import * as form from 'stems-ui/form'

// `errors` typically comes from the server action's result, keyed by field name.
;<form.Context errors={actionResult?.errors}>
  <form method="post" action="/signup" mix={form.root()}>
    <field.Context name="username">
      <label mix={field.label()}>Username</label>
      <input required mix={field.control()} />
      <div mix={field.error()}>
        <field.Validity>{(state) => state.error}</field.Validity>
      </div>
    </field.Context>
    <button type="submit">Sign up</button>
  </form>
</form.Context>
```

Handling the submission on the client instead:

```tsx
<form.Context
  errors={errors}
  onFormSubmit={async (values) => {
    errors = await save(values) // e.g. { username: 'Taken' }
    void handle.update()
  }}
>
  …
</form.Context>
```

## `stems-ui/form`

- `<form.Context>` (Base UI `Form` props)
  - `errors`: `{ [fieldName]: string | string[] }`, typically returned by the server. Each
    named field shows its errors (as `customError`, `aria-invalid`, `data-invalid`) until its
    value changes. Passing a new `errors` object shows all of its errors again.
  - `onClearErrors(errors)`: called with the remaining errors when a field clears its errors
    because its value changed.
  - `validationMode`: default for the fields inside: `'onSubmit'` (default), `'onBlur'`,
    `'onChange'`. A field's own `validationMode` wins.
  - `onFormSubmit(values, { reason: 'none', event })`: called with the named fields' values
    when a valid form is submitted. Providing it calls `preventDefault()`, so the browser and
    Remix navigation don't submit the form.
  - `actionsRef`: `{ current }` or a callback receiving `{ validate(name?) }`, which validates
    all fields or the fields named `name`.
- `form.root()`: the native `<form>`.
- `onFormSubmit(handler)`: listens for `stems:form-submit` (`FormSubmitEvent` with `values`),
  dispatched from the form when a submission passes validation.

Descendants can read `{ errors, validationMode, submitAttempted, validate(name?), getValues() }`
with `handle.context.get(form.Context)`.

## Behavior notes

- **Server-first.** The server-rendered `<form>` has no `novalidate`, so without JavaScript the
  browser's constraint validation runs and the form submits to its `action` as usual. Render
  `errors` from the action's result and the fields show them in the server HTML. Once hydrated,
  `form.root()` sets `noValidate` (unless the host sets `noValidate` itself) and validation
  moves to Stems: field errors instead of browser bubbles.
- On submit, every field validates (marking it submitted, so `'onSubmit'` fields re-validate on
  change after that). When any field is invalid the native event is `preventDefault()`ed, its
  propagation stops (`on('submit')` handlers mixed in after `form.root()` only see valid
  submissions), and the first invalid control in document order is focused.
- Controls that are not inside a `field.Context` are still checked with native validation: an
  invalid one blocks the submission and shows the browser's message (`reportValidity()`).
- Without `onFormSubmit`, a valid submission continues natively (and Remix navigation handles it).
- External `errors` never block a submission: the server validates again.
- Async `validate` functions never block a submission.

## Styling hooks

`form.root()` adds no attributes. Style fields through `field`'s data attributes.
