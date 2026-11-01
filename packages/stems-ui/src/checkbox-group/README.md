# checkbox-group

`checkboxGroup` shares one `string[]` value between a set of checkboxes from
[`stems-ui/checkbox`](../checkbox/README.md), and drives an optional parent ("select all")
checkbox. App code owns the markup and visual styles.

Base UI equivalent: [Checkbox Group](https://base-ui.com/react/components/checkbox-group).

## Usage

```tsx
import * as checkbox from 'stems-ui/checkbox'
import * as checkboxGroup from 'stems-ui/checkbox-group'

function Apples() {
  return () => (
    <checkboxGroup.Context defaultValue={['fuji']}>
      <div aria-labelledby="apples" mix={checkboxGroup.root()}>
        <div id="apples">Apples</div>
        {['fuji', 'gala'].map((value) => (
          <label>
            <checkbox.Context name="apple" value={value}>
              <span mix={checkbox.root()}>
                <span mix={checkbox.indicator()}>✓</span>
              </span>
            </checkbox.Context>
            {value}
          </label>
        ))}
      </div>
    </checkboxGroup.Context>
  )
}
```

Parent checkbox: list every child value in `allValues` and add a checkbox with `parent`.

```tsx
<checkboxGroup.Context value={value} onValueChange={setValue} allValues={['fuji', 'gala']}>
  <div aria-labelledby="apples" mix={checkboxGroup.root()}>
    <label id="apples">
      <checkbox.Context parent>
        <span mix={checkbox.root()} />
      </checkbox.Context>
      All apples
    </label>
    {/* child checkboxes with value="fuji" / value="gala" */}
  </div>
</checkboxGroup.Context>
```

## `stems-ui/checkbox-group`

- `Context`: owns the group value. Props (same as Base UI's `CheckboxGroup`):
  - `value`: ticked checkbox values. Controlled when not `undefined`.
  - `defaultValue`: initially ticked values (uncontrolled). Defaults to `[]`.
  - `onValueChange(value, event)`: called with the next value and the DOM event that caused it.
  - `allValues`: every child value. Needed for a `parent` checkbox.
  - `disabled`: disable every checkbox in the group.
  - `handle.context.get(checkboxGroup.Context)` returns `{ value, allValues, disabled }`.
- `root()`: sets `role="group"` and `data-disabled`. Name it with `aria-label` or
  `aria-labelledby`.
- `CheckboxGroupChangeEvent`: bubbling `stems:checkbox-group-change` event with the next `value`,
  dispatched from the checkbox that changed.
- `onCheckboxGroupChange(handler, capture?)`: typed listener mixin for the event.

## Behavior notes

- A checkbox inside the group is identified by its `value` option (falling back to `name`). Its
  own `checked` / `defaultChecked` are ignored. A checkbox with neither `value` nor `name` stays
  standalone.
- Each ticked checkbox submits its own hidden input (`name=value`), so give them a shared `name`
  for form submission.
- **Parent checkbox:** ticked when every value in `allValues` is ticked, mixed when some are. Like
  Base UI, clicking it cycles mixed → all → none → back to the selection the user last made with
  the child checkboxes (or toggles all/none when that selection was empty or complete). Disabled
  children keep their state. Values outside `allValues` are preserved. The parent gets
  `aria-controls` listing the children's ids; children without an `id` get a generated one.
- A checkbox reads the nearest group. Base UI's "nested parent checkbox" example (a parent
  checkbox that is also a child of an outer group) is not covered or tested yet.
- Base UI's change `reason` is always `'none'`, so Stems doesn't pass one.

## Field integration

Inside `<field.Context>` the group is the field's control, like Base UI's `CheckboxGroup` in a
`Field.Root`:

```tsx
<field.Context name="protocols" validate={(value) => (value.length ? null : 'Pick one')}>
  <div id="protocols-label" mix={field.label()}>
    Protocols
  </div>
  <checkboxGroup.Context>
    <div mix={checkboxGroup.root()}>
      {['http', 'ssh'].map((value) => (
        <field.ItemContext>
          <div mix={field.item()}>
            <checkbox.Context value={value}>
              <span mix={checkbox.root()} />
            </checkbox.Context>
            <label mix={field.label()}>{value}</label>
          </div>
        </field.ItemContext>
      ))}
    </div>
  </checkboxGroup.Context>
  <div mix={field.error()}>…</div>
</field.Context>
```

- The field value is the array of ticked values (`validate` receives it; `onFormSubmit` values
  have it under the field's `name`). Each ticked checkbox's hidden input submits its `value` under
  the field's `name`.
- `required` goes on individual checkboxes: the first unticked required checkbox is the field's
  validity element (`valueMissing`), and it is focused when the field blocks a submission
  (otherwise the first enabled checkbox is).
- The root gets the field state attributes, `aria-labelledby` (a `field.label()` outside any
  item), and `aria-describedby` (the field's descriptions and visible errors). `role="group"` has
  no `aria-invalid`, so each checkbox gets it.
- `field.ItemContext` labels and describes one checkbox (Base UI's `Field.Item`).
- Focus moving between the group's checkboxes doesn't blur the field: `data-touched` (and
  `validationMode="onBlur"`) waits until focus leaves the group.
- The field's (or an enclosing `fieldset.Context`'s) `disabled` disables every checkbox.

## Styling hooks

| Part | Attribute       | Present when                                            |
| ---- | --------------- | ------------------------------------------------------- |
| root | `data-disabled` | `disabled` is set (or the field / fieldset is disabled) |

Checkboxes inside the group expose their usual attributes (`data-checked`, `data-indeterminate`,
...). Inside a field, the root and every checkbox also get the field state attributes
(`data-valid`, `data-invalid`, `data-dirty`, `data-touched`, `data-filled`, `data-focused`); Base
UI documents only `data-disabled` on the group, the others are a Stems extra.
