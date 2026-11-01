# autocomplete

A free-text input with a list of suggestions. Its value is the text itself: suggestions only fill
it in, optionally inline as you type. Equivalent of Base UI's
[Autocomplete](https://base-ui.com/react/components/autocomplete). Built on
`lib/combobox-core.ts`, shared with [`combobox`](../combobox/README.md).

Use `autocomplete` for search boxes and fields that accept any text. When the value must be one
of the items, use `combobox`.

## Usage

```tsx
import * as autocomplete from 'stems-ui/autocomplete'

let tags = ['feature', 'fix', 'bug', 'docs']

function TagSearch() {
  return () => (
    <form>
      <label for="tag">Tag</label>
      <autocomplete.Context name="tag" items={tags} mode="both" autoHighlight>
        <div mix={autocomplete.inputGroup()}>
          <input id="tag" placeholder="e.g. feature" mix={autocomplete.input()} />
          <button aria-label="Clear" mix={autocomplete.clear()}>
            ×
          </button>
        </div>
        <div mix={autocomplete.popup({ sideOffset: 4 })}>
          <div mix={autocomplete.empty()}>
            <autocomplete.EmptyText>No tags found.</autocomplete.EmptyText>
          </div>
          <div mix={autocomplete.list()}>
            <autocomplete.Collection>
              {(tag: string) => (
                <div key={tag} mix={autocomplete.item({ value: tag })}>
                  {tag}
                </div>
              )}
            </autocomplete.Collection>
          </div>
        </div>
      </autocomplete.Context>
    </form>
  )
}
```

Filtered items render like in `combobox`: pass `items` and render `<autocomplete.Collection>`
(only matches are in the DOM; groups are `{ value, items }` with a nested `Collection`), or render
static `item()`s, which are `hidden` when they don't match.

## API

### `Context` (Base UI `Autocomplete.Root`)

| Prop                                         | Default  | Notes                                                                                                              |
| -------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| `value` / `defaultValue`                     | `''`     | The text.                                                                                                          |
| `onValueChange(value, details)`              |          | `details`: `reason`, `event`, `cancel()`, `isCanceled`.                                                            |
| `mode`                                       | `'list'` | `'list'` filters; `'both'` filters and completes inline; `'inline'` completes without filtering; `'none'` neither. |
| `open` / `defaultOpen`                       | `false`  |                                                                                                                    |
| `onOpenChange(open, details)`                |          | `cancel()` keeps the state.                                                                                        |
| `onOpenChangeComplete(open)`                 |          |                                                                                                                    |
| `items`                                      |          | Flat array or groups `{ value, items }`, filtered into `filteredItems`.                                            |
| `filter(item, query, itemToString)` / `null` | contains | Case- and diacritic-insensitive "contains". `null` disables filtering.                                             |
| `limit`                                      | `-1`     | Maximum number of `filteredItems`.                                                                                 |
| `locale`                                     | runtime  |                                                                                                                    |
| `itemToStringValue`                          |          | A suggestion's text (put in the input, and filtered). Defaults to `label`, then `value`, then `String(item)`.      |
| `autoHighlight`                              | `false`  | `true`: highlight the first match while typing. `'always'`: whenever the list is shown.                            |
| `highlightItemOnHover`                       | `true`   |                                                                                                                    |
| `loopFocus`                                  | `true`   | Arrow keys loop through the input.                                                                                 |
| `onItemHighlighted(value, details)`          |          |                                                                                                                    |
| `openOnInputClick`                           | `false`  |                                                                                                                    |
| `submitOnItemClick`                          | `false`  | Submit the owning form after a suggestion is pressed or chosen with Enter.                                         |
| `modal`                                      | `false`  | Locks page scroll and makes outside content inert.                                                                 |
| `name`, `form`, `required`                   |          | Set on the input itself (it carries the value).                                                                    |
| `disabled`, `readOnly`                       | `false`  |                                                                                                                    |

`handle.context.get(autocomplete.Context)` returns `AutocompleteContextValue`: `open`,
`inputValue` (the value), `query`, `mode`, `filteredItems`, `empty`, `setInputValue()`,
`setOpen()`, `clear()`, and the `popup` / `listbox` stores.

### Parts

`input()`, `inputGroup()`, `trigger(options?)`, `clear(options?)`, `<ValueText>` (renders the
text; `children(value)`), `icon()`, `popup(options?)`, `list()`, `empty()` + `<EmptyText>`,
`status()`, `<Collection>`, `item(options?)` (`value`, `label`, `disabled`), `group()`,
`groupLabel()`, `separator()`, `arrow()`, `backdrop()`. They behave as in
[`combobox`](../combobox/README.md#parts); items have no selected state (no `itemIndicator()`).

### Events

- `stems:autocomplete-change` → `AutocompleteChangeEvent` (`value`, `reason`), from the input.
  Listener: `onAutocompleteChange(handler)`.
- `stems:autocomplete-open-change` → `AutocompleteOpenChangeEvent` (`open`, `reason`).
  Listener: `onAutocompleteOpenChange(handler)`.

## Behavior

- **Free text:** whatever is typed is the value; leaving the input never clears or rewrites it.
- **Typing** opens the popup (`input-change`) and filters (`'list'` / `'both'`); the popup stays
  open with the empty state when nothing matches.
- **Keyboard:** ArrowDown / ArrowUp open the popup and move the highlight, looping through the
  input. Enter on a highlighted suggestion fills the input and closes (no form submission unless
  `submitOnItemClick`); without a highlight, Enter is left to the form. Escape closes the popup;
  Escape on a closed popup clears the text (`escape-key`).
- **Inline completion** (`'both'` / `'inline'`): moving the highlight with the keyboard shows the
  suggestion in the input. When it starts with the typed text, the typed part is kept and the
  completed remainder is selected, so typing on replaces it. Returning the highlight to the input
  or pressing Escape restores the typed text; Enter or leaving the input keeps the completion.
  With `autoHighlight`, the first match is completed while typing (not while deleting).
- **Pointer:** pressing a suggestion fills the input and closes; focus stays in the input.

## Styling hooks

Same as [`combobox`](../combobox/README.md#styling-hooks) for the shared parts (`input`,
`inputGroup`, `trigger`, `clear`, `icon`, `popup`, `list`, `empty`, `item`, `arrow`,
`separator`), without the selection attributes. `inputGroup` has no `data-placeholder`.

Inside a field, `input`, `inputGroup` and `trigger` also get the field state attributes (`data-valid`, `data-invalid`, `data-dirty`, `data-touched`, `data-filled`, `data-focused`), and `input` gets `aria-invalid="true"` while invalid.

## Field integration

Inside `<field.Context>` the autocomplete behaves like a plain field control: the input gets the
field's control id (unless it has its own `id`), `name`, `aria-describedby` and `aria-invalid`,
and carries the validity (`required`, `pattern`, ... on the input itself). The field value is the
text (`validate` receives it), including text filled in by pressing a suggestion. Focus moving
between the input, its buttons and the popup stays inside the field. Server `errors` show until
the text changes. The field's (or an enclosing `fieldset.Context`'s) `disabled` disables it.

## Not implemented (yet)

- `keepHighlight`, `virtualized`, `grid` / `Row`, `inline` (list without a popup),
  `filteredItems` as a prop, `actionsRef`, `inputRef`.
- `limit` only applies to `items` / `Collection`.
