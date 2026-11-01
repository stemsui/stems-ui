# otp-field

`otp-field` is a one-time-code input. It is made of one `<input>` per character slot.

Base UI equivalent: [OTP Field](https://base-ui.com/react/components/otp-field).

## Usage

```tsx
import * as otpField from 'stems-ui/otp-field'

function VerificationCode() {
  return () => (
    <div>
      <label for="code">Verification code</label>
      <otpField.Context id="code" name="code" length={6}>
        <div class="flex gap-2" mix={otpField.root()}>
          {Array.from({ length: 6 }, (_, index) => (
            <input
              class="size-10 text-center"
              aria-label={index === 0 ? undefined : `Character ${index + 1} of 6`}
              mix={otpField.input({ index })}
            />
          ))}
        </div>
      </otpField.Context>
    </div>
  )
}
```

## `stems-ui/otp-field`

- `<otpField.Context>` props (Base UI's `OTPField.Root` props):
  - `length` (required): the number of slots.
  - `value` / `defaultValue`: `string`. The value is normalized, then clamped to `length`.
  - `onValueChange(value, details)`: `details` has `reason` (`'input-change' | 'input-clear' |
'input-paste' | 'keyboard'`), `event`, `trigger`, `cancel()`, and `isCanceled`.
  - `onValueComplete(value, { reason, event })`: fires when the value becomes complete. It also
    fires when a complete code is pasted into a field that is already complete.
  - `onValueInvalid(attemptedText, { reason, event })`: fires when typed or pasted characters
    are rejected.
  - `validationType`: `'numeric'` (default), `'alpha'`, `'alphanumeric'`, or `'none'`.
  - `normalizeValue(value)`: runs after filtering. Its result is filtered again. It must be
    idempotent.
  - `mask`: slots become `type="password"`.
  - `inputMode`: defaults to `numeric` for numeric codes and `text` otherwise.
  - `autoComplete`: `'one-time-code'` on the first slot. Other slots get `off`.
  - `autoSubmit`: submits the owning form (`requestSubmit()`) when the value becomes complete.
  - `disabled`, `readOnly`, `required`, `name`, `form`.
  - `id`: the first slot's id. Later slots use `{id}-2`, `{id}-3`, ...
- `otpField.root()`: `role="group"` with the state attributes.
- `otpField.input(options?)`: a slot (use an `<input>` host). It sets `id`, `type`,
  `inputmode`, `autocomplete`, `autocorrect="off"`, `autocapitalize="off"`,
  `spellcheck="false"`, `value` (the slot's character), `tabindex`, `disabled`, and `readonly`.
  - `index`: the slot's position. Without it, slots are numbered in render order.
- `otpField.separator(options?)`: `role="separator"` with `aria-orientation` and
  `data-orientation` (`orientation`, default `'horizontal'`).
- `normalizeOTPValue(text, validationType, length, normalizeValue?)`: the filter, for use
  outside a Context. It returns `{ value, rejected }`.
- Events: `stems:otp-field-change` (`OTPFieldChangeEvent`: `value`, `reason`) and
  `stems:otp-field-complete` (`OTPFieldCompleteEvent`: `value`). Both bubble. Listen with
  `onOTPFieldChange(handler)` and `onOTPFieldComplete(handler)`.

## Behavior notes

- Tab order: only the slot that takes the next character (the first empty slot, or the last
  slot when the code is complete) has `tabindex="0"`. Tab enters and leaves the field in one
  step.
- Focus: focusing a slot past the first empty one moves focus back to the first empty slot.
  Focusing or clicking a slot selects its character, so typing replaces it.
- Typing a character moves focus to the next slot.
  - When a slot ends up with two characters (typed next to an unselected character), the new
    character wins.
  - When a slot receives several characters (autofill of `one-time-code`, IME), they fill the
    slots from there.
- Rejected characters call `onValueInvalid` and are dropped. Whitespace is always ignored.
- Paste:
  - A code at least `length` long replaces the whole value.
  - A shorter code is inserted at the focused slot.
  - Focus moves to the slot after the pasted text.
- Keyboard:
  - Backspace on a filled slot deletes its character. The characters after it shift left.
  - Backspace on an empty slot deletes the previous character and moves focus there.
  - Delete removes the slot's character. The characters after it shift left.
  - ArrowLeft and ArrowRight move between slots, flipped in RTL.
  - Home goes to the first slot. End goes to the first empty slot (or the last slot).
- The value is a contiguous string with no gaps. Deleting in the middle shifts later
  characters left.
- Form participation: the Context renders a visually hidden `<input>` after its children. It
  has `aria-hidden` and `tabindex="-1"`, and carries `name`, the whole value, `required`, and
  `pattern="[\s\S]{length}"`, so a partial code fails validation. When validation focuses it,
  focus moves to the first empty slot.
- Labelling, as in Base UI: point a `<label for>` at the Context `id` (the first slot), and give
  the other slots an `aria-label`.
- Known gaps:
  - Select-all across slots (Ctrl/Cmd+A, then Backspace) isn't supported.
  - On Android virtual keyboards, Backspace in an empty slot may not fire `keydown`, so focus
    doesn't move back.

## Field integration

Inside `<field.Context>` the OTP field is the field's control. The first slot gets the field's
control id (unless `id` is set, which the field then follows), so `<label mix={field.label()}>`
targets it, and the root is `aria-labelledby` the field label. Slots get `aria-describedby` and
`aria-invalid`. The hidden input gets the field's `name` and is the validity element:
`valueMissing` with `required`, `patternMismatch` for an incomplete code. The first empty slot is
focused when the field blocks a submission. Focus leaving the slots marks the field touched. The
field's (or an enclosing `fieldset.Context`'s) `disabled` disables it.

## Styling hooks

`root` and `input`:

| Attribute                     | Values                                                        |
| ----------------------------- | ------------------------------------------------------------- |
| `data-complete`               | Present when every slot is filled.                            |
| `data-filled`                 | Root: at least one character. Slot: the slot has a character. |
| `data-focused`                | Present while any slot has focus.                             |
| `data-disabled`               | Present when the field is disabled.                           |
| `data-readonly`               | Present when the field is read-only.                          |
| `data-required`               | Present when the field is required.                           |
| `data-valid` / `data-invalid` | In a field: validated and valid / invalid.                    |
| `data-dirty`                  | In a field: the value changed from the initial value.         |
| `data-touched`                | In a field: focus left the slots once.                        |

`separator` has `data-orientation`. No CSS variables are set.
