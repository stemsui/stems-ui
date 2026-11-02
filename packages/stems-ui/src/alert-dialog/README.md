# alert-dialog

`alert-dialog` is a dialog that requires a response. It is always modal (`showModal()`) and has
`role="alertdialog"`. Outside presses never close it, but Escape does. It is built on the same
engine as `stems-ui/dialog`.

Base UI equivalent: [Alert Dialog](https://base-ui.com/react/components/alert-dialog).

## Usage

```tsx
import * as alertDialog from 'stems-ui/alert-dialog'

function DeleteAccount() {
  return () => (
    <alertDialog.Context>
      <button mix={alertDialog.trigger()}>Delete account</button>
      <dialog class="m-auto open:grid backdrop:bg-black/10" mix={alertDialog.popup()}>
        <h2 mix={alertDialog.title()}>Are you absolutely sure?</h2>
        <p mix={alertDialog.description()}>This action cannot be undone.</p>
        <button mix={alertDialog.close()}>Cancel</button>
        <button mix={alertDialog.close()}>Delete</button>
      </dialog>
    </alertDialog.Context>
  )
}
```

## `stems-ui/alert-dialog`

The parts, options, behavior, and styling hooks are the same as in
[`stems-ui/dialog`](../dialog/README.md), with these differences:

- `Context` takes `open`, `defaultOpen`, `onOpenChange(open, details)`,
  `onOpenChangeComplete(open)`, and `actionsRef`. It has no `modal` or `disablePointerDismissal`
  props: the alert dialog is always modal, and outside presses never dismiss it.
- `popup(options?)` sets `role="alertdialog"` and `aria-modal="true"`. The default initial focus
  is the first tabbable element, so put the least destructive action (Cancel) first.
- Outside presses, whether on `::backdrop` or on a `backdrop()` element, do nothing. They also
  stop the dismiss walk, so a dialog underneath stays open. Escape closes the alert dialog
  (reason `'escape-key'`).
- `onAlertDialogChange(handler)` is the listener mixin for `AlertDialogChangeEvent`
  (`stems:alert-dialog-change`, bubbles, dispatched from the popup, has `open` and `reason`).
- Exported types are prefixed `AlertDialog…`, for example `AlertDialogPopupOptions` and
  `AlertDialogChangeDetails`.

An alert dialog nested in a dialog (or a dialog nested in an alert dialog) takes part in the
same nesting: `data-nested`, `data-nested-dialog-open`, and `--nested-dialogs`.

## Detached triggers

`alertDialog.createHandle()` works like [`dialog.createHandle()`](../dialog/README.md#detached-triggers):
pass the handle to `<alertDialog.Context handle>` and to `alertDialog.trigger({ handle,
payload })` anywhere in the document; the `Context`'s `children` may be a function of
`{ payload }`. The handle has `isOpen`, `open(triggerId?)`, `openWithPayload(payload)`, and
`close()`, and the `Context` takes `triggerId` / `defaultTriggerId`.

## Styling hooks

| Part         | Attribute / variable                                                                                                                                                  |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `trigger()`  | `aria-expanded`, `data-popup-open`, `data-disabled`                                                                                                                   |
| `popup()`    | `role="alertdialog"`, `:open`, `data-open` / `data-closed`, `data-starting-style` / `data-ending-style`, `data-nested`, `data-nested-dialog-open`, `--nested-dialogs` |
| `backdrop()` | `hidden`, `data-open` / `data-closed`, `data-starting-style` / `data-ending-style`                                                                                    |
| `close()`    | `data-disabled`                                                                                                                                                       |
