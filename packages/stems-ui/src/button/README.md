# button

`button` wires a host element as an accessible button: native `<button>` defaults, button
semantics for other hosts, and a disabled state that can stay focusable.

Base UI equivalent: [Button](https://base-ui.com/react/components/button).

## Usage

```tsx
import { on } from 'remix/component'
import { button } from 'stems-ui/button'

function SaveButton(handle: Handle) {
  let saving = false

  return () => (
    <button
      mix={[
        button({ disabled: saving, focusableWhenDisabled: true }),
        on('click', async () => {
          saving = true
          await handle.update()
          // ...
        }),
      ]}
    >
      {saving ? 'Saving…' : 'Save'}
    </button>
  )
}
```

A non-`<button>` host:

```tsx
<div mix={button()}>Button that can contain complex children</div>
```

## `stems-ui/button`

- `button(options?)`
  - `disabled`: ignore user interaction. Falls back to the host's `disabled` prop. Defaults to
    `false`.
  - `focusableWhenDisabled`: keep the button focusable while disabled. The host gets
    `aria-disabled="true"` instead of the native `disabled` attribute, and activation is blocked.
    Defaults to `false`.
  - `nativeButton`: whether the host is a native `<button>`. Defaults to `true` for `<button>`
    hosts and `false` otherwise.

## Behavior notes

- Native `<button>` hosts get `type="button"` unless `type` is set (Base UI: submit buttons must
  set `type="submit"` explicitly).
- Non-native hosts get `role="button"` and `tabIndex` (`0`, or `-1` when disabled and not
  `focusableWhenDisabled`). They activate (dispatch `click`) on Enter `keydown` and Space `keyup`,
  like a native button. Space `keydown` is prevented so the page does not scroll. Keys from
  descendants are ignored.
- When the browser can't block activation itself (non-native hosts, or `focusableWhenDisabled`),
  a capture-phase `click` listener calls `preventDefault()` and `stopImmediatePropagation()`, so
  `on('click')` handlers on the host and ancestors don't run and forms are not submitted. Enter and
  Space `keydown` are prevented too.
- With `focusableWhenDisabled`, pass `disabled` as an option, not as the host `disabled` prop: a
  host `disabled` attribute always removes the button from the tab order.
- Explicit host props win (`attrs()` semantics).
- Don't use `button()` on links. Style the `<a>` like a button instead (the registry exports
  `buttonVariants()` for this).

| Key   | Action (non-native hosts)          |
| ----- | ---------------------------------- |
| Enter | Activates the button on `keydown`. |
| Space | Activates the button on `keyup`.   |

## Styling hooks

| Attribute       | Values                               |
| --------------- | ------------------------------------ |
| `data-disabled` | Present when the button is disabled. |
