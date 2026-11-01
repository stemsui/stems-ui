# select

A button that opens a list of options to pick one value, or several with `multiple`. Equivalent
of Base UI's [Select](https://base-ui.com/react/components/select). Built on `lib/popup.ts` (open
state, top-layer popup, dismissal, positioning) and `lib/listbox.ts` (value, options, highlight,
keyboard, typeahead).

## Usage

```tsx
import * as select from 'stems-ui/select'

let fruits = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
]

function FruitSelect() {
  return () => (
    <form>
      <select.Context name="fruit" required items={fruits} defaultValue="banana">
        <div mix={select.label()}>Fruit</div>
        <button mix={select.trigger()}>
          <span mix={select.value()}>
            <select.ValueText placeholder="Pick a fruit" />
          </span>
          <span mix={select.icon()}>▾</span>
        </button>
        <div mix={select.popup()}>
          <div mix={select.scrollUpArrow()}>▴</div>
          <div mix={select.list()}>
            <div mix={select.group()}>
              <div mix={select.groupLabel()}>Fruits</div>
              {fruits.map((fruit) => (
                <select.ItemContext value={fruit.value}>
                  <div mix={select.item()}>
                    <span mix={select.itemText()}>{fruit.label}</span>
                    <span mix={select.itemIndicator()}>✓</span>
                  </div>
                </select.ItemContext>
              ))}
            </div>
          </div>
          <div mix={select.scrollDownArrow()}>▾</div>
        </div>
      </select.Context>
    </form>
  )
}
```

Multiple selection: the value is an array, the popup stays open while items are toggled, and
`ValueText` joins the labels with `", "` (or pass a render function):

```tsx
<select.Context multiple name="languages" defaultValue={['js', 'ts']}>
  …
  <span mix={select.value()}>
    <select.ValueText>{(value: string[]) => `${value.length} selected`}</select.ValueText>
  </span>
  …<div mix={select.popup({ alignItemWithTrigger: false })}>…</div>
</select.Context>
```

Listen for changes with the callback or the bubbling event:

```tsx
<select.Context onValueChange={(value, details) => console.log(value, details.reason)}>…

<div mix={select.onSelectChange((event) => console.log(event.value, event.reason))}>…</div>
```

## API

### `Context` (Base UI `Select.Root`)

Owns the state and renders the form input(s) after its children (Base UI renders its hidden input
in `Root` too).

| Prop                                      | Default     | Notes                                                                                                                              |
| ----------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `value` / `defaultValue`                  | `null`      | A value or `null`; an array with `multiple`. Values may be any type (compared with `isItemEqualToValue`).                          |
| `onValueChange(value, details)`           |             | `details`: `reason` (`'item-press'` \| `'list-navigation'` \| `'none'`), `event`, `cancel()`, `isCanceled`.                        |
| `multiple`                                | `false`     |                                                                                                                                    |
| `open` / `defaultOpen`                    | `false`     |                                                                                                                                    |
| `onOpenChange(open, details)`             |             | Base UI reasons: `trigger-press`, `outside-press`, `escape-key`, `item-press`, `focus-out`, `list-navigation`, `none`. `cancel()`. |
| `onOpenChangeComplete(open)`              |             | After the enter / exit animation.                                                                                                  |
| `modal`                                   | `true`      | Locks scroll, makes outside content inert, traps focus. `'trap-focus'` or `false` to relax.                                        |
| `name`, `form`, `autoComplete`            |             | Form participation.                                                                                                                |
| `required`                                | `false`     | Native constraint validation; an invalid submit focuses the trigger.                                                               |
| `disabled`, `readOnly`                    | `false`     | `readOnly` keeps the popup closed and ignores typeahead.                                                                           |
| `items`                                   |             | `{ value: label }`, `[{ value, label }]`, or groups `[{ items: [...] }]`. Used for the value label, **including in server HTML**.  |
| `itemToStringLabel` / `itemToStringValue` |             | Label for display / string for the form. Objects with `label` / `value` keys work without them.                                    |
| `isItemEqualToValue`                      | `Object.is` |                                                                                                                                    |
| `highlightItemOnHover`                    | `true`      |                                                                                                                                    |
| `loopFocus`                               | `false`     | Stems extra: wrap keyboard navigation.                                                                                             |
| `onItemHighlighted(value, details)`       |             | Stems extra.                                                                                                                       |

`handle.context.get(select.Context)` returns `SelectContextValue`: `open`, `value`,
`selectedValues`, `hasValue`, `labelOf(value)`, `stringValue(value)`, `setValue()`, `setOpen()`,
plus the underlying `store` (popup) and `listbox`.

### Parts

| Part                                                    | Element  | Options                                                                                                                                                    |
| ------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label()`                                               | any      | Labels the trigger and list (`aria-labelledby`); a press focuses the trigger without opening.                                                              |
| `trigger(options?)`                                     | `button` | `disabled`.                                                                                                                                                |
| `value()`                                               | `span`   | Host for `ValueText`.                                                                                                                                      |
| `<ValueText>`                                           | (text)   | `placeholder`, `children(value)`. Renders the label(s); no element of its own.                                                                             |
| `icon()`                                                | any      |                                                                                                                                                            |
| `popup(options?)`                                       | `div`    | `alignItemWithTrigger` (`true`), `side`, `align`, `sideOffset`, `alignOffset`, `collisionPadding`, `arrowPadding`, `anchor`, `initialFocus`, `finalFocus`. |
| `list()`                                                | `div`    | Without it, the popup becomes the listbox (after hydration).                                                                                               |
| `<ItemContext>`                                         | —        | `value`, `label`, `disabled`. Required for `itemIndicator()`; `item()` inside it reads its options from it.                                                |
| `item(options?)`                                        | `div`    | `value`, `label` (typeahead / display text), `disabled`.                                                                                                   |
| `itemText()`                                            | any      | The item's text: used as its label instead of the full text content.                                                                                       |
| `itemIndicator(options?)`                               | any      | `keepMounted`.                                                                                                                                             |
| `group()` / `groupLabel()`                              | `div`    |                                                                                                                                                            |
| `separator()`                                           | `div`    | The generic `stems-ui/separator` mixin.                                                                                                                    |
| `scrollUpArrow(options?)` / `scrollDownArrow(options?)` | `div`    | `keepMounted`. Scroll the list while hovered (not on touch).                                                                                               |
| `arrow()`, `backdrop()`                                 | `div`    |                                                                                                                                                            |

Base UI's `Portal` and `Positioner` have no Stems equivalent: the popup is shown in the top layer
where it is rendered, and the positioner options go to `popup()`.

### Events

- `stems:select-change` → `SelectChangeEvent` (`value`, `reason`), from the trigger. Listener:
  `onSelectChange(handler)`.
- `stems:select-open-change` → `SelectOpenChangeEvent` (`open`, `reason`). Listener:
  `onSelectOpenChange(handler)`.

## Behavior

- **Keyboard (trigger):** Enter, Space, ArrowDown open (highlighting the selected item, else the
  first); ArrowUp opens on the selected item, else the last. Typing selects the next matching
  item without opening (single selection; Space continues a search in progress).
- **Keyboard (list):** ArrowDown / ArrowUp, Home / End (disabled items are skipped; no wrap
  unless `loopFocus`), Enter / Space select, typing highlights the next match (repeat a letter to
  cycle), Escape closes, Tab closes and moves to the next tabbable after the trigger.
- **Single:** pressing an item selects it and closes the popup; focus returns to the trigger.
  **Multiple:** pressing toggles it and the popup stays open.
- **Focus:** items get real DOM focus (`tabIndex={-1}`); `data-highlighted` follows focus and
  the pointer. Opening with the pointer and no value focuses the list.
- **Positioning:** with `alignItemWithTrigger` (default) the popup overlaps the trigger so the
  selected item (or the first item) lines up with the value text, and `data-side` is `"none"`. It
  falls back to regular placement (`side` / `align`, default below) when opened by touch or when
  the trigger is within 20px of the top or bottom of the viewport. The mode is decided once per
  opening.
- **Forms:** the provider renders a visually hidden `<input>` carrying `name`, the value,
  `required`, `disabled`, `form`, `autoComplete`; with `multiple`, one `<input type="hidden">` per
  value (and the unnamed validation input). Focusing the input (e.g. an invalid submit) focuses
  the trigger.
- **Labels:** `ValueText` shows, in order: `items`, `itemToStringLabel`, the registered item's
  `label` / item text, an object value's `label`, the string value. Items register on the client,
  so pass `items` (or `itemToStringLabel`) for a correct label in server-rendered HTML; without it
  the server renders the raw value and the label appears after hydration.

## Styling hooks

| Part          | Data attributes                                                                                                           | CSS variables                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| trigger       | `data-popup-open`, `data-pressed`, `data-placeholder`, `data-disabled`, `data-readonly`, `data-required`; `aria-expanded` |                                                                                                      |
| value         | `data-placeholder`                                                                                                        |                                                                                                      |
| icon          | `data-popup-open`                                                                                                         |                                                                                                      |
| popup         | `data-open` / `data-closed`, `data-side` (`none` when aligned), `data-align`, `data-starting-style` / `data-ending-style` | `--anchor-width`, `--anchor-height`, `--available-width`, `--available-height`, `--transform-origin` |
| item          | `data-selected`, `data-highlighted`, `data-disabled`; `aria-selected`                                                     |                                                                                                      |
| itemIndicator | `data-selected`, `data-starting-style` / `data-ending-style`                                                              |                                                                                                      |
| scroll arrows | `data-direction` (`up` / `down`), `data-visible`, `data-side`                                                             |                                                                                                      |
| arrow         | `data-open` / `data-closed`, `data-side`, `data-align`, `data-uncentered`                                                 |                                                                                                      |
| backdrop      | `data-open` / `data-closed`, `data-starting-style` / `data-ending-style`                                                  |                                                                                                      |
| separator     | `data-orientation`                                                                                                        |                                                                                                      |

Scroll arrows without their own `position` become `position: sticky` overlays (with a negative
margin, so showing them doesn't shift the items) inside the scrolling element, or
`position: absolute` when placed outside it. Style `top: 0` / `bottom: 0`.

Inside a field, the trigger also gets `data-valid`, `data-invalid`, `data-dirty`, `data-touched`,
`data-filled`, `data-focused`, and `aria-invalid="true"` while invalid.

## Field integration

Inside `<field.Context>` the select is the field's control:

- The trigger gets the field's control id (unless it has its own `id`, which the field then
  follows), so `<label mix={field.label()}>` targets it; it is `aria-labelledby` the `select.label()`
  or else the field label, and `aria-describedby` the field's descriptions and visible errors.
  A native `<label>` click also activates the trigger (opens the popup); use a non-`<label>` host
  (or `select.label()`) to only focus it.
- The field's `name` wins for the hidden input(s). `required` and the field's `validate`
  (called with the value) run on the visually hidden input; the trigger is focused when the field
  blocks a form submission. Server `errors` show until the value changes.
- Focus moving between the trigger and the popup stays inside the field: `data-focused` stays and
  `data-touched` (and `validationMode="onBlur"`) waits until focus leaves both.
- The field's (or an enclosing `fieldset.Context`'s) `disabled` disables the select.

## Not implemented (yet)

- Press-drag-release selection (open on pointer down, select on pointer up), `actionsRef`,
  `inputRef`, the trigger's `data-popup-side`, `disableAnchorTracking`, `collisionAvoidance`.
- Item-aligned mode doesn't grow the popup while scrolling like Base UI; the list scrolls inside
  the aligned popup.
- Browser autofill writing into the hidden input isn't read back.
