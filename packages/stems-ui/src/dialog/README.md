# dialog

`dialog` turns a native `<dialog>` element into a Base UI–style dialog: trigger wiring, modal and
non-modal modes, enter/exit transitions, Escape and outside-press dismissal through the shared
dismiss stack, focus management, scroll lock, and nested-dialog state. App code owns the markup
and styles.

Base UI equivalent: [Dialog](https://base-ui.com/react/components/dialog).

## Usage

```tsx
import * as dialog from 'stems-ui/dialog'

function EditProfile() {
  return () => (
    <dialog.Context>
      <button mix={dialog.trigger()}>Edit profile</button>
      <dialog
        class="m-auto rounded-xl p-6 open:grid backdrop:bg-black/10 data-starting-style:opacity-0 data-ending-style:opacity-0 transition-opacity"
        mix={dialog.popup()}
      >
        <h2 mix={dialog.title()}>Edit profile</h2>
        <p mix={dialog.description()}>Make changes to your profile here.</p>
        <input name="name" />
        <button mix={dialog.close()}>Close</button>
      </dialog>
    </dialog.Context>
  )
}
```

Control the state with `open` and `onOpenChange`, or let the context own it with `defaultOpen`.
Listen for bubbling changes on the popup or an ancestor:

```tsx
<div mix={dialog.onDialogChange((event) => console.log(event.open, event.reason))}>…</div>
```

Base UI's `Portal` and `Viewport` parts have no Stems equivalent: the `<dialog>` is rendered where
the app puts it and escapes clipping and stacking through the browser's top layer.

## `stems-ui/dialog`

- `Context`: provider that owns the open state.
  - `open`: `boolean`. Controlled open state.
  - `defaultOpen`: `boolean`. Initial uncontrolled state. Defaults to `false`.
  - `onOpenChange(open, details)`: called before the state changes. `details` has `reason`,
    `event`, `trigger`, `cancel()`, and `isCanceled`. Calling `details.cancel()` keeps the
    current state, and no change event is dispatched.
  - `onOpenChangeComplete(open)`: called after the enter or exit animation has finished.
  - `modal`: `true | false | 'trap-focus'`. Defaults to `true`.
    - `true`: `showModal()`. The page is inert, Tab is trapped, page scroll is locked
      (`lib/scroll-lock.ts`), and `aria-modal="true"` is set.
    - `'trap-focus'`: `show()`, with Tab trapped inside the popup. The page stays scrollable and
      clickable.
    - `false`: `show()`. Nothing is trapped. Focus moving outside the popup closes it (reason
      `'focus-out'`).
  - `disablePointerDismissal`: `boolean`. Outside presses (and focus moving outside, for
    non-modal dialogs) don't close the dialog. Escape still does. The value is read when the
    dialog opens. Defaults to `false`.
  - `actionsRef`: `{ current }` object. Receives `{ open(), close() }` (reason
    `'imperative-action'`).
- `trigger(options?)`: the open button. Sets `type="button"`, `aria-haspopup="dialog"`,
  `aria-expanded`, and `aria-controls`. Pressing it toggles the dialog (reason
  `'trigger-press'`). Non-`<button>` hosts get `role="button"`, `tabIndex`, and Enter/Space
  activation.
  - `disabled`: `boolean`. Sets native `disabled` (or `aria-disabled`) and ignores presses.
- `popup(options?)`: the `<dialog>` element. Sets `id`, `aria-labelledby`, `aria-describedby`,
  `aria-modal` (modal only), and the state attributes and variables below. The host must be a
  `<dialog>`.
  - `initialFocus`: where focus goes when the dialog opens. The default is the first
    `[autofocus]` or tabbable element, or the popup itself when the dialog was opened by touch.
    - `false`: leave focus where the browser put it.
    - An element: focus it.
    - A CSS selector: focus the first match inside the popup. Remix has no refs, so this
      replaces Base UI's `RefObject`.
    - A function `(interactionType) => element | boolean | null | void`: return an element to
      focus, `true` or `null` for the default, or `false` / `undefined` to leave focus alone.
  - `finalFocus`: where focus goes after the dialog closes. Takes the same values as
    `initialFocus`, but selectors are resolved in the document. The default is the trigger that
    opened the dialog, or else the element that was focused before it opened. Focus is only moved
    if it was still inside the dialog (or on `<body>`), so an outside press onto another control
    keeps focus there. With `false`, Stems doesn't move focus, but the
    browser's own `dialog.close()` may still return focus to the element that was focused before
    the dialog opened.
- `backdrop(options?)`: an optional separate backdrop element. It gets `hidden` while the dialog
  is closed and while its exit animation runs, and presses on it count as outside presses. See
  "Backdrops" below.
  - `forceRender`: `boolean`. Render the backdrop even when the dialog is nested. Defaults to
    `false` (Base UI hides nested backdrops).
- `title()`: labels the popup. Sets a generated `id`.
- `description()`: describes the popup. Sets a generated `id`.
- `close(options?)`: a button that closes the dialog (reason `'close-press'`). Same host handling
  as `trigger()`, including `disabled`.
- `onDialogChange(handler)`: listener mixin for `DialogChangeEvent` (`stems:dialog-change`,
  bubbles, dispatched from the popup, has `open` and `reason`).

Change reasons: `'trigger-press'`, `'outside-press'`, `'escape-key'`, `'close-press'`,
`'focus-out'`, `'imperative-action'`, `'close-watcher'`, `'none'`. `'close-watcher'` is a Stems
addition: it covers close requests that aren't an Escape key press, such as the Android back
gesture.

## Detached triggers

Base UI's `createHandle()`: triggers can live anywhere in the document, outside the `Context`,
linked by a handle. Each trigger can pass a `payload`, so one dialog can serve many triggers with
different data.

```tsx
import * as dialog from 'stems-ui/dialog'

let editUser = dialog.createHandle<{ id: string; name: string }>()

// Anywhere, e.g. in each table row:
<button mix={dialog.trigger({ handle: editUser, payload: user })}>Edit</button>

// Once, elsewhere:
<dialog.Context handle={editUser}>
  {({ payload }) => (
    <dialog mix={dialog.popup()}>
      <h2 mix={dialog.title()}>Edit {payload?.name}</h2>
    </dialog>
  )}
</dialog.Context>
```

- `createHandle<Payload>()` returns the handle. Pass it to the `Context` (`handle` prop, read
  once) and to each detached `trigger({ handle, payload })` (read on the trigger's first
  render). `Payload` types `payload` in the `Context`'s children function.
- Detached triggers register with the handle, so they behave like triggers inside the
  `Context`: `aria-expanded`, `aria-controls`, and `data-popup-open` follow the dialog, focus
  returns to the trigger that opened it, and (for non-modal dialogs) presses on any trigger
  count as inside.
- The payload is `{ payload }` in a children render function (re-run each time the `Context`
  renders) and `payload` on the context value. It's the active trigger's `payload`, or the one
  given to `openWithPayload()`. A children function only works with JSX (`createElement`
  rejects function children).
- Handle methods: `isOpen`, `open(triggerId?)` (optionally associated with the trigger with
  that `id`), `openWithPayload(payload)` (no trigger; focus returns to the element focused
  before opening), and `close()`, all with reason `'imperative-action'`. They act on the mounted
  `Context` and are ignored while none is mounted.
- `Context` props `triggerId` (controlled, pair with `open`; store `details.trigger?.id` from
  `onOpenChange`) and `defaultTriggerId` pick the active trigger by element `id`.
- Detached triggers aren't re-rendered by the `Context`; they update their state attributes
  directly when it renders. On the server nothing is shared, so a detached trigger renders
  closed and without `aria-controls`.
- The same handle type works for `stems-ui/alert-dialog` and `stems-ui/drawer`, which export
  their own `createHandle()`.

## Behavior notes

- **Native `<dialog>`.** A closed dialog stays in the DOM and is hidden by the UA stylesheet
  (`dialog:not([open]) { display: none }`). Display classes must therefore be gated on the open
  state, for example `open:grid` instead of `grid`. The server renders the state attributes, but
  it does not render the `open` attribute: a modal dialog can only be shown with `showModal()`,
  so a `defaultOpen` dialog appears once the page hydrates.
- **Transitions.** On open, the dialog is shown in the same commit that adds
  `data-starting-style`, and the attribute is removed on the next frame. On close, `data-closed`
  and `data-ending-style` are set, and `dialog.close()` only runs after the popup's own CSS
  transitions and animations have finished. Reopening during the exit cancels it.
- **Escape.** Escape goes through `lib/dismiss-layer.ts`. The stack cancels the `keydown`, so the
  browser never sends its own close request. This was verified in Chromium with real key
  presses. The dialog's `cancel` event is always cancelled as well. If a close request still
  arrives without an Escape `keydown` (Android back, `CloseWatcher`), it closes the dialog only
  when the dialog is the topmost layer (reason `'close-watcher'`). A popover or menu inside the
  dialog closes first, because it registered its layer later.
- **Outside presses.** The page behind a modal dialog is inert, so presses land on the
  `<dialog>` element itself. A press outside the dialog's border box (the `::backdrop`) is an
  outside press. A press inside it, including on padding, is not. Presses on a `backdrop()`
  element are always outside presses. The trigger and nested dialogs count as inside.
- **Native closes.** If the `<dialog>` closes without Stems (`<form method="dialog">`, or app code
  calling `dialog.close()`), the state follows with reason `'none'`. If the owner cancels that
  change or keeps the dialog controlled open, the dialog is shown again.
- **Focus.** `modal: true` and `'trap-focus'` wrap Tab and Shift+Tab inside the popup. Nested
  open dialogs handle their own Tab.
- **Nested dialogs.** A `Context` inside another dialog's `Context` is nested. This includes
  alert dialogs and drawers. The child popup gets `data-nested`. The parent popup gets
  `data-nested-dialog-open` and `--nested-dialogs` (the depth of the open chain inside it) while
  a child is open. These clear as soon as the child starts closing. Escape and outside presses
  close only the innermost dialog.
- Explicit host props win (`attrs()` semantics). Keep the generated popup, title, and
  description ids so the ARIA links stay intact. A host `id` on `title()` / `description()` is
  picked up when the part first renders.

## Backdrops

A sibling element can't sit between a top-layer `<dialog>` and its `::backdrop`, so there are two
ways to draw a backdrop:

- **`::backdrop` (recommended for modal dialogs).** Style it with Tailwind's `backdrop:` variant on
  the popup. It shares the popup's state attributes, for example
  `data-open:backdrop:animate-in data-closed:backdrop:animate-out`. In current browsers
  `::backdrop` also inherits the popup's custom properties. The exit wait only tracks the
  popup's own animations, so keep backdrop animations no longer than the popup's. Hide the
  backdrops of nested dialogs with `data-nested:backdrop:bg-transparent`.
- **`backdrop()` element.** Use this for non-modal dialogs that want a visible scrim, or for Base
  UI parity. Render it before the `<dialog>`, for example as `fixed inset-0`. It is not in the top
  layer, so make sure no ancestor clips it. Under a modal dialog it sits beneath the
  `::backdrop`.

## Styling hooks

| Part         | Attribute / variable                                                                                                                                       |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `trigger()`  | `aria-expanded`, `data-popup-open`, `data-disabled`                                                                                                        |
| `popup()`    | `:open` / `[open]`, `data-open` / `data-closed`, `data-starting-style` / `data-ending-style`, `data-nested`, `data-nested-dialog-open`, `--nested-dialogs` |
| `backdrop()` | `hidden`, `data-open` / `data-closed`, `data-starting-style` / `data-ending-style`                                                                         |
| `close()`    | `data-disabled`                                                                                                                                            |

## Not yet supported

- `actionsRef.unmount()` and `details.preventUnmountOnClose()`. The popup is app-owned markup and
  is never unmounted, and Stems always waits for CSS animations before closing.
- `details.allowPropagation()`.
