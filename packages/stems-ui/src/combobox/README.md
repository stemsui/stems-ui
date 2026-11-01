# combobox

A text input that filters a list of items to pick one value, or several (shown as chips) with
`multiple`. Equivalent of Base UI's [Combobox](https://base-ui.com/react/components/combobox).
Built on `lib/combobox-core.ts` (shared with [`autocomplete`](../autocomplete/README.md)), which
composes `lib/popup.ts` (open state, top-layer popup, dismissal, positioning) and `lib/listbox.ts`
in virtual-focus mode (value, items, highlight).

Use `combobox` when the value must be one of the items. For free text with suggestions, use
`autocomplete`; for a button without text entry, use `select`.

## Usage

```tsx
import * as combobox from 'stems-ui/combobox'

let fruits = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
]

function FruitCombobox() {
  return () => (
    <form>
      <label for="fruit">Fruit</label>
      <combobox.Context name="fruit" required items={fruits}>
        <div mix={combobox.inputGroup()}>
          <input id="fruit" placeholder="Pick a fruit" mix={combobox.input()} />
          <button aria-label="Clear" mix={combobox.clear()}>
            ×
          </button>
          <button aria-label="Show fruits" mix={combobox.trigger()}>
            <span mix={combobox.icon()}>▾</span>
          </button>
        </div>
        <div mix={combobox.popup({ sideOffset: 4 })}>
          <div mix={combobox.empty()}>
            <combobox.EmptyText>No fruit found.</combobox.EmptyText>
          </div>
          <div mix={combobox.list()}>
            <combobox.Collection>
              {(fruit: (typeof fruits)[number]) => (
                <combobox.ItemContext key={fruit.value} value={fruit}>
                  <div mix={combobox.item()}>
                    {fruit.label}
                    <span mix={combobox.itemIndicator()}>✓</span>
                  </div>
                </combobox.ItemContext>
              )}
            </combobox.Collection>
          </div>
        </div>
      </combobox.Context>
    </form>
  )
}
```

### Rendering filtered items

Two ways, which can be mixed:

1. **`items` + `Collection`** (Base UI's `items` prop with a render-function `List` /
   `Collection`): pass the data to `Context`, and render `<combobox.Collection>{(item) => …}`.
   It re-renders with `filteredItems` as the text changes, so only matching items are in the DOM.
   Grouped data (`[{ value: 'Fruits', items: [...] }]`) renders groups; pass each group's
   `items` to a nested `Collection`. `filteredItems` is also on the context value
   (`handle.context.get(combobox.Context).filteredItems`) for custom rendering. `limit` applies
   here.
2. **Static items**: render every `item()` yourself. Items that don't match are `hidden`
   automatically (by their `label` option or text content), and `group()`s whose items are all
   hidden are hidden too.

Pass `items` whenever you can: it gives the selected label (input text, `ValueText`) in the
server-rendered HTML, and filtering and the empty state are known on the server.

Items are compared by value. Base UI passes the item itself (`value={fruit}`); a primitive value
(`value="apple"`) whose `items` entry is `{ value: 'apple', label: 'Apple' }` also works.

### Multiple selection with chips

```tsx
<combobox.Context multiple name="languages" items={languages}>
  <div mix={combobox.chips()}>
    <combobox.ValueText>
      {(values: string[]) =>
        values.map((value) => (
          <span key={value} mix={combobox.chip({ value })}>
            {value}
            <button aria-label={`Remove ${value}`} mix={combobox.chipRemove()}>
              ×
            </button>
          </span>
        ))
      }
    </combobox.ValueText>
    <input mix={combobox.input()} />
  </div>
  <div mix={combobox.popup()}>…</div>
</combobox.Context>
```

Listen for changes with the callbacks or the bubbling events:

```tsx
<combobox.Context
  onValueChange={(value, details) => console.log(value, details.reason)}
  onInputValueChange={(text, details) => console.log(text, details.reason)}
>…

<div mix={combobox.onComboboxChange((event) => console.log(event.value, event.reason))}>…</div>
```

## API

### `Context` (Base UI `Combobox.Root`)

Owns the state and renders the form input(s) after its children.

| Prop                                         | Default     | Notes                                                                                                                                         |
| -------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `value` / `defaultValue`                     | `null`      | An item or `null`; an array with `multiple`.                                                                                                  |
| `onValueChange(value, details)`              |             | `details`: `reason`, `event`, `cancel()`, `isCanceled`.                                                                                       |
| `inputValue` / `defaultInputValue`           | label       | The text. Uncontrolled, it follows the selected item's label until edited.                                                                    |
| `onInputValueChange(text, details)`          |             | `details`: `reason`, `event`, `isItemPress` (multiple: cleared by an item press), `cancel()`.                                                 |
| `open` / `defaultOpen`                       | `false`     |                                                                                                                                               |
| `onOpenChange(open, details)`                |             | `cancel()` keeps the state (e.g. cancel `'item-press'` closes to pick several items in a row).                                                |
| `onOpenChangeComplete(open)`                 |             | After the enter / exit animation.                                                                                                             |
| `multiple`                                   | `false`     |                                                                                                                                               |
| `items`                                      |             | Flat array or groups `{ value, items }`. Filtered into `filteredItems`; used for labels.                                                      |
| `filter(item, query, itemToString)` / `null` | contains    | Case- and diacritic-insensitive "contains" (`Intl.Collator`, `sensitivity: 'base'`). `null` disables filtering. `containsText()` is exported. |
| `limit`                                      | `-1`        | Maximum number of `filteredItems`.                                                                                                            |
| `locale`                                     | runtime     | Locale of the default filter.                                                                                                                 |
| `itemToStringLabel` / `itemToStringValue`    |             | Text for the input, chips, and filter / string for the form. Objects with `label` / `value` keys work without them.                           |
| `isItemEqualToValue`                         | `Object.is` |                                                                                                                                               |
| `autoHighlight`                              | `false`     | Highlight the first match while typing.                                                                                                       |
| `highlightItemOnHover`                       | `true`      |                                                                                                                                               |
| `loopFocus`                                  | `true`      | Arrow keys loop through the input (past the last item the highlight clears; the next ArrowDown highlights the first).                         |
| `onItemHighlighted(value, details)`          |             | `details.reason`: `'keyboard'` \| `'pointer'` \| `'none'`.                                                                                    |
| `openOnInputClick`                           | `true`      |                                                                                                                                               |
| `modal`                                      | `false`     | Locks page scroll and makes content outside the popup and the input group inert. Focus stays in the input.                                    |
| `name`, `form`, `autoComplete`, `required`   |             | Form participation (hidden inputs).                                                                                                           |
| `disabled`, `readOnly`                       | `false`     | `readOnly` keeps the popup closed.                                                                                                            |

Change reasons (`details.reason`, Base UI's): `input-change`, `input-clear`, `input-press`,
`trigger-press`, `item-press`, `list-navigation`, `escape-key`, `outside-press`, `focus-out`,
`clear-press`, `chip-remove-press`, `none`.

`handle.context.get(combobox.Context)` returns `ComboboxContextValue`: `open`, `value`,
`selectedValues`, `hasValue`, `inputValue`, `query`, `items`, `filteredItems`,
`flatFilteredItems`, `empty`, `labelOf(value)`, `stringValue(value)`, `setValue()`,
`setInputValue()`, `setOpen()`, `clear()`, plus the underlying `popup` and `listbox` stores.

### Parts

| Part                       | Element  | Options / notes                                                                                                           |
| -------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------- |
| `input()`                  | `input`  | The combobox. Its `value` is driven by `inputValue`: don't set `value` on the host.                                       |
| `inputGroup()`             | `div`    | Wraps the input and buttons; the popup is positioned against it (else `chips()`, else the input).                         |
| `trigger(options?)`        | `button` | `disabled`. Toggles the popup, keeps focus in the input, `tabIndex={-1}`.                                                 |
| `clear(options?)`          | `button` | `disabled`, `keepMounted`. `hidden` while there is nothing to clear.                                                      |
| `value()` + `<ValueText>`  | (text)   | `placeholder`, `children(value)`. Labels joined with `", "`, or render chips with a function child.                       |
| `icon()`                   | any      |                                                                                                                           |
| `popup(options?)`          | `div`    | `side`, `align`, `sideOffset`, `alignOffset`, `collisionPadding`, `arrowPadding`, `anchor`, `initialFocus`, `finalFocus`. |
| `list()`                   | `div`    |                                                                                                                           |
| `empty()` + `<EmptyText>`  | `div`    | A live region that stays rendered; `EmptyText` renders its children only while nothing matches.                           |
| `status()`                 | `div`    | A polite live region (loading, result counts).                                                                            |
| `<Collection>`             | —        | `children(item, index)`, `items` (defaults to `filteredItems`).                                                           |
| `<ItemContext>`            | —        | `value`, `label`, `disabled`. Required for `itemIndicator()`.                                                             |
| `item(options?)`           | `div`    | `value`, `label` (filter / label text; defaults to the text content), `disabled`.                                         |
| `itemIndicator(options?)`  | any      | `keepMounted`.                                                                                                            |
| `group()` / `groupLabel()` | `div`    |                                                                                                                           |
| `separator()`              | `div`    | The generic `stems-ui/separator` mixin.                                                                                   |
| `chips()`                  | `div`    | Container of the chips and the input.                                                                                     |
| `chip(options)`            | any      | `value` (required: Base UI infers it from the chip's index), `disabled`.                                                  |
| `chipRemove(options?)`     | `button` | `value` (defaults to the enclosing chip's), `disabled`.                                                                   |
| `arrow()`, `backdrop()`    | `div`    |                                                                                                                           |

Base UI's `Portal` and `Positioner` have no Stems equivalent: the popup is shown in the top layer
where it is rendered, and the positioner options go to `popup()`. Base UI's `Label` (for the
input-inside-popup pattern) isn't provided: label the input with a native `<label for>`.

### Events

- `stems:combobox-change` → `ComboboxChangeEvent` (`value`, `reason`), from the input. Listener:
  `onComboboxChange(handler)`.
- `stems:combobox-input-change` → `ComboboxInputChangeEvent` (`inputValue`, `reason`). Listener:
  `onComboboxInputChange(handler)`.
- `stems:combobox-open-change` → `ComboboxOpenChangeEvent` (`open`, `reason`). Listener:
  `onComboboxOpenChange(handler)`.

## Behavior

- **Focus** stays in the input. The highlighted item is announced with `aria-activedescendant`;
  items, the trigger, the clear button, and the popup background prevent `mousedown` so pressing
  them doesn't blur the input.
- **Typing** opens the popup (`input-change`) and filters. With no match the popup stays open
  and `empty()` shows its content (`data-empty` on the popup and list, `data-list-empty` on the
  input). Typing clears the highlight, or highlights the first match with `autoHighlight`.
  Clearing the text clears the value (single, `input-clear`).
- **Keyboard:** ArrowDown / ArrowUp open the popup (highlighting the selected item, else the
  first / last) and move the highlight, skipping disabled items and looping through the input.
  Enter presses the highlighted item (without a highlight it's left to the form). Escape closes.
  Home / End move the caret. Alt+ArrowUp closes.
- **Single:** pressing an item selects it, puts its label in the input, and closes. While the
  input shows the selected label every item is listed. When the popup closes or the input loses
  focus, the text resets to the selected label (or empty): a combobox can't keep free text — use
  `autocomplete` for that.
- **Multiple:** pressing an item toggles it, clears the text, and closes (when the input is
  outside the popup; cancel the `'item-press'` close in `onOpenChange` to keep picking).
  Backspace in the empty input removes the last chip; ArrowLeft at the start of the input focuses
  the last chip. On a chip: ArrowLeft / ArrowRight move between chips and back to the input,
  Backspace / Delete remove it, typing returns to the input.
- **Pointer:** clicking the input opens the popup (`openOnInputClick`), the trigger toggles it,
  pressing outside closes it. Presses on the input group and chips don't dismiss.
- **Forms:** the provider renders a visually hidden `<input>` carrying `name`, the value string,
  `required`, `disabled`, `form`, `autoComplete`; with `multiple`, one `<input type="hidden">`
  per value. Focusing it (e.g. an invalid submit) focuses the combobox input.
- **Input inside the popup** (Base UI's pattern with the trigger as the form control): the input
  is focused when the popup opens and the popup is positioned against the trigger.

## Styling hooks

| Part          | Data attributes                                                                                                              | CSS variables                                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| input         | `data-popup-open`, `data-popup-side`, `data-list-empty`, `data-disabled`, `data-readonly`, `data-required`; `aria-expanded`  |                                                                                                      |
| inputGroup    | `data-popup-open`, `data-popup-side`, `data-list-empty`, `data-disabled`, `data-readonly`, `data-placeholder`                |                                                                                                      |
| trigger       | `data-popup-open`, `data-list-empty`, `data-placeholder`, `data-disabled`, `data-readonly`, `data-required`; `aria-expanded` |                                                                                                      |
| clear         | `data-visible`, `data-popup-open`, `data-disabled`, `data-starting-style` / `data-ending-style`                              |                                                                                                      |
| value         | `data-placeholder`                                                                                                           |                                                                                                      |
| icon          | `data-popup-open`                                                                                                            |                                                                                                      |
| popup         | `data-open` / `data-closed`, `data-side`, `data-align`, `data-empty`, `data-starting-style` / `data-ending-style`            | `--anchor-width`, `--anchor-height`, `--available-width`, `--available-height`, `--transform-origin` |
| list          | `data-empty`                                                                                                                 |                                                                                                      |
| empty         | `data-empty` (Stems extra)                                                                                                   |                                                                                                      |
| item          | `data-selected`, `data-highlighted`, `data-disabled`; `aria-selected`; `hidden` when filtered out                            |                                                                                                      |
| itemIndicator | `data-selected`, `data-starting-style` / `data-ending-style`                                                                 |                                                                                                      |
| chip          | `data-disabled`                                                                                                              |                                                                                                      |
| chipRemove    | `data-disabled`                                                                                                              |                                                                                                      |
| arrow         | `data-open` / `data-closed`, `data-side`, `data-align`, `data-uncentered`                                                    |                                                                                                      |
| separator     | `data-orientation`                                                                                                           |                                                                                                      |

Inside a field, `input`, `inputGroup` and `trigger` also get the field state attributes (`data-valid`, `data-invalid`, `data-dirty`, `data-touched`, `data-filled`, `data-focused`), and `input` gets `aria-invalid="true"` while invalid.

## Field integration

Inside `<field.Context>` the combobox is the field's control:

- The input gets the field's control id (unless it has its own `id`, which the field then
  follows), so `<label mix={field.label()}>` targets it, plus `aria-describedby` (the field's
  descriptions and visible errors) and `aria-invalid`. It is focused when the field blocks a form
  submission.
- The field value is the combobox value (an array with `multiple`); `validate` receives it. The
  field's `name` wins for the form input(s). `required` validates on the visually hidden input
  (`valueMissing` while nothing is selected).
- Focus moving between the input, the input group, chips, the trigger and clear buttons, and the
  popup stays inside the field: `data-touched` (and `validationMode="onBlur"`) waits until focus
  leaves the widget.
- Server `errors` show until the value changes. The field's (or an enclosing
  `fieldset.Context`'s) `disabled` disables the combobox. Typing (without changing the value)
  doesn't change the field.

## Not implemented (yet)

- `virtualized`, `grid` / `Row`, `inline` (list without a popup), `createItems()`,
  `filteredItems` as a prop (use `filter` or render your own filtered list), `actionsRef`,
  `inputRef`, `data-anchor-hidden`, `data-pressed`, chip `data-highlighted`.
- `limit` only applies to `items` / `Collection`, not to static items.
- Static items are filtered by their text content after hydration; give them a `label` (or use
  `items`) to filter in server HTML.
