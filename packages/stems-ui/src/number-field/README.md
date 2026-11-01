# number-field

`number-field` is a text input for numbers. It has stepper buttons, keyboard and wheel stepping,
an optional scrub area, and locale-aware formatting and parsing.

Base UI equivalent: [Number Field](https://base-ui.com/react/components/number-field).

## Usage

```tsx
import * as numberField from 'stems-ui/number-field'

function Quantity() {
  return () => (
    <numberField.Context id="qty" name="qty" defaultValue={1} min={0} max={99}>
      <div mix={numberField.root()}>
        <label for="qty">Quantity</label>
        <div class="flex" mix={numberField.group()}>
          <button mix={numberField.decrement()}>−</button>
          <input mix={numberField.input()} />
          <button mix={numberField.increment()}>+</button>
        </div>
      </div>
    </numberField.Context>
  )
}
```

## `stems-ui/number-field`

- `<numberField.Context>` props (Base UI's `NumberField.Root` props):
  - `value` / `defaultValue`: `number | null`. `null` is an empty field.
  - `onValueChange(value, details)`:
    - `details.reason` is one of `'input-change'`, `'input-clear'`, `'input-blur'`,
      `'input-paste'`, `'keyboard'`, `'increment-press'`, `'decrement-press'`, `'wheel'`, or
      `'scrub'`.
    - `details` also has `event`, `trigger`, `direction` (`1` or `-1` when stepping),
      `cancel()`, and `isCanceled`.
  - `onValueCommitted(value, { reason, event })`:
    - Fires on blur or Enter after typing.
    - Fires on pointer release after pressing a stepper button or scrubbing (only when the value
      changed).
    - Fires with each keyboard or wheel step.
  - `min`, `max`.
  - `step` (`1`; `'any'` steps by 1 and turns off step validation), `smallStep` (`0.1`, Alt),
    `largeStep` (`10`, Shift and PageUp/PageDown).
  - `snapOnStep` (`false`), `allowOutOfRange` (`false`).
  - `format` (`Intl.NumberFormatOptions`), `locale`.
  - `allowWheelScrub` (`false`), `disabled`, `readOnly`, `required`, `name`, `form`.
  - `id`: the visible input's id, for `<label for>`.
  - `inputRef(input, signal)`: receives the hidden input.
- `numberField.root()`: state attributes only.
- `numberField.group()`: `role="group"`.
- `numberField.input()`: use an `<input>` host. It sets:
  - `type="text"`, `autocomplete="off"`, `autocorrect="off"`, `spellcheck="false"`, and
    `aria-roledescription="Number field"`.
  - `inputmode`: `decimal` when `min >= 0`, and `text` otherwise, because mobile decimal
    keypads have no minus key.
  - `value`: the formatted value. While the user types, it keeps the raw text.
  - `disabled`, `readonly`, `required`.
- `numberField.increment()` / `numberField.decrement()`:
  - Set `type="button"` (on a `<button>`), `tabindex="-1"`, `aria-controls` (the input), and
    `aria-label` (`"Increase"` / `"Decrease"`; host props win).
  - Disabled at `max` / `min`, and when the field is disabled or read-only.
- `numberField.scrubArea(options?)`: dragging the area changes the value. Options:
  - `direction`: `'horizontal'` (default) or `'vertical'`.
  - `pixelSensitivity`: pixels of movement per step (`2`).
  - `teleportDistance`: how far the virtual cursor can move from the area's center before it
    wraps around.
  - Default `style` (only when the host sets none): `touch-action: none`, `user-select: none`,
    and an `ew-resize` / `ns-resize` cursor.
- `numberField.scrubAreaCursor()`: a custom cursor element. It is `hidden` unless the user is
  scrubbing with the pointer locked. It owns `position: fixed` and a `transform` that follows
  the virtual cursor.
- Events: `stems:number-field-change` (`NumberFieldChangeEvent`: `value`, `reason`) and
  `stems:number-field-commit` (`NumberFieldCommitEvent`: `value`, `reason`). Both bubble from the
  input. Listen with `onNumberFieldChange(handler)` and `onNumberFieldCommit(handler)`.

## Behavior notes

- Typing:
  - Each parseable edit changes the value right away (`'input-change'`).
  - Emptying the field sets the value to `null` (`'input-clear'`).
  - Text that can't be parsed doesn't change the value. On blur, it reverts to the last valid
    value.
  - Blur and Enter format the text, and clamp it to `min`/`max` unless `allowOutOfRange` is set.
    Enter doesn't prevent implicit form submission. The hidden input is updated before the
    submit.
- Keydown blocks characters that can't be part of a number. Allowed characters are digits
  (including locale digits), separators, signs, `e`, `%`, currency symbols, and the format's
  affixes. A paste is rejected unless every pasted character is allowed (`'input-paste'`).
- Parsing (`lib/number.ts`):
  - Uses the locale's group and decimal separators and digits.
  - Accepts `.` as the decimal separator when the locale doesn't group with it.
  - Strips currency, percent, and unit affixes. A percent format divides by 100, like
    `Intl.NumberFormat` multiplies.
  - Accepts a leading minus sign (any Unicode minus) or accounting parentheses.
- Display: without `format`, the value is shown with `maximumFractionDigits: 20`, so typed
  decimals aren't rounded to Intl's default of 3.
- Keyboard:
  - ArrowUp and ArrowDown step by `step`. Hold Shift for `largeStep` or Alt for `smallStep`.
  - PageUp and PageDown step by `largeStep`.
  - Home and End go to `min` and `max`, when they are set.
- Stepping from an empty field starts from 0, clamped to `min`/`max`. With `snapOnStep`, the
  next value is the next multiple of the step amount (from 0) in that direction.
- Stepper buttons:
  - A pointer press steps immediately. Holding it repeats after 400 ms, then every 60 ms.
    Release commits once.
  - Keyboard or assistive-technology clicks step once.
  - The buttons prevent `mousedown`, so focus stays in the input.
- Wheel: only with `allowWheelScrub`, and only while the input is focused and hovered.
- Scrubbing:
  - Mouse and pen use the Pointer Lock API when it is available (not in Safari, like Base UI).
    Otherwise the area uses pointer capture.
  - The value follows `movementX` (or `-movementY` for `direction: 'vertical'`), one step per
    `pixelSensitivity` pixels.
  - The virtual cursor wraps around at the viewport edges, or at `teleportDistance`.
  - Focus moves to the input.
- Form participation: the Context renders a visually hidden `<input type="number">` after its
  children. It has `aria-hidden` and `tabindex="-1"`, and carries `name`, `value`, `min`, `max`,
  `required`, and `step`, so native validation (`valueMissing`, `rangeOverflow`, ...) works.
  - The `step` attribute is only set when `min` is set. Otherwise it is `step="any"`, like
    Base UI.
  - When validation focuses the hidden input, focus moves to the visible input.
- Field: inside `<field.Context>` the number field is the field's control. The visible input
  gets the field's control id (unless `id` is set, which the field then follows), so
  `<label mix={field.label()}>` targets it, plus `aria-describedby` and `aria-invalid`; it is
  focused when the field blocks a submission. The hidden `<input type="number">` gets the
  field's `name` and is the validity element (`valueMissing`, `rangeUnderflow`,
  `rangeOverflow`, `stepMismatch`); `validate` receives the number (or `null`). On blur the typed
  text is committed before the field validates (`validationMode="onBlur"`). The field's (or an
  enclosing `fieldset.Context`'s) `disabled` disables it.
- Server rendering uses the runtime locale. Pass `locale` when the server and browser may
  differ.

## Styling hooks

All parts (`root`, `group`, `input`, `increment`, `decrement`, `scrubArea`, `scrubAreaCursor`):

| Attribute                     | Values                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| `data-disabled`               | Present when the field is disabled. On the stepper buttons, it is also present at `max` / `min`. |
| `data-readonly`               | Present when the field is read-only.                                                             |
| `data-required`               | Present when the field is required.                                                              |
| `data-scrubbing`              | Present while scrubbing.                                                                         |
| `data-valid` / `data-invalid` | In a field: validated and valid / invalid.                                                       |
| `data-dirty`                  | In a field: the value changed from the initial value.                                            |
| `data-touched`                | In a field: the input lost focus once.                                                           |
| `data-filled`                 | In a field: the value is not `null`.                                                             |
| `data-focused`                | In a field: the input has focus.                                                                 |

No CSS variables are set.
