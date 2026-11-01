# toast

`toast` renders short, temporary notifications from a toast manager: stacking, expand on hover
or focus, auto-dismiss timers that pause, swipe to dismiss, enter/exit transitions, and screen
reader announcements. App code owns the markup and visual styles.

Base UI equivalent: [Toast](https://base-ui.com/react/components/toast).

## Usage

Create a manager anywhere (a module-level singleton works well), render its toasts once, and add
toasts from event handlers, actions, or plain functions:

```tsx
import type { Handle } from '@remix-run/component'
import * as toast from 'stems-ui/toast'

export const toastManager = toast.createToastManager()

export function Toasts() {
  return () => (
    <toast.Context toastManager={toastManager} timeout={5000} limit={3}>
      <ToastList />
    </toast.Context>
  )
}

function ToastList(handle: Handle) {
  let context = handle.context.get(toast.Context)

  return () => (
    <div class="fixed right-6 bottom-6 w-[356px]" mix={toast.viewport()}>
      {context.toasts.map((item) => (
        <div key={item.id} class="toast" mix={toast.root({ toast: item })}>
          <div mix={toast.content({ toast: item })}>
            <h2 mix={toast.title({ toast: item })}>{item.title}</h2>
            <p mix={toast.description({ toast: item })}>{item.description}</p>
            {item.actionProps ? (
              <button mix={toast.action({ toast: item })}>{item.actionProps.children}</button>
            ) : null}
            <button aria-label="Close" mix={toast.close({ toast: item })}>
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// Anywhere:
toastManager.add({ title: 'Saved', description: 'Your changes were saved.', type: 'success' })
```

Components below `<toast.Context>` re-render when the toasts change, so `context.toasts` is
always current (Base UI's `useToastManager()`). The context also exposes `add`, `update`,
`close`, and `promise`, so a provider without a `toastManager` works too.

Mixins can't render children, so the title, description, and action label are rendered by the
app (`{item.title}`), and parts that should be absent (no description, no action) are simply not
rendered.

## `stems-ui/toast`

### Manager

`createToastManager()` returns a framework-agnostic store (Base UI's `Toast.createToastManager()`):

- `add(options) → id`: adds a toast, newest first. Passing an existing `id` updates that toast in
  place (incrementing `updateKey`) and restarts its timer.
- `update(id, options | (toast) => options)`: replaces the given values (`data` is replaced as a
  whole). Passing `timeout` restarts the timer.
- `close(id?)`: closes a toast, or all toasts. The toast gets `transitionStatus: 'ending'`, its
  `onClose` runs, and it stays in the list until its root's exit animation finishes; then it is
  removed and `onRemove` runs. Without a mounted `<toast.Context>`, closed toasts are removed
  right away.
- `promise(promise, { loading, success, error })`: shows a `type: 'loading'` toast without a
  timeout, then updates it to `'success'` or `'error'` (with the default timeout) when the
  promise settles. Each state is a string (shortcut for `{ description }`), an options object, or
  (for `success` / `error`) a function of the result. Returns the same promise.
- `subscribe(listener) → unsubscribe`: `listener(toasts, event)` with `event.type` one of `add`,
  `update`, `close`, `remove`, `enter`.
- `toasts`: the current list.

Toast options (`add`, `update`, promise states):

| Option        | Type               | Notes                                                        |
| ------------- | ------------------ | ------------------------------------------------------------ |
| `id`          | `string`           | `add` only. Upserts.                                         |
| `title`       | `RemixNode`        | Labels the toast (`aria-labelledby`).                        |
| `description` | `RemixNode`        | Describes the toast (`aria-describedby`).                    |
| `type`        | `string`           | `data-type` on every part.                                   |
| `timeout`     | `number`           | ms; `0` keeps it open. Defaults to the provider's `timeout`. |
| `priority`    | `'low' \| 'high'`  | Polite or assertive announcement. Default `'low'`.           |
| `actionProps` | `ToastActionProps` | `children`, `onClick(event)`, and extra button attributes.   |
| `onClose`     | `() => void`       | Runs once when the toast starts closing.                     |
| `onRemove`    | `() => void`       | Runs after the exit animation, when it leaves the list.      |
| `data`        | `Data`             | Custom data (`createToastManager<Data>()`).                  |

Toast objects also carry `updateKey`, `transitionStatus` (`'starting' | 'ending' | undefined`),
and, when read from the context, `limited` and `height`.

### Parts

- `Context`: provider. Subscribes to the manager and owns timers, the limit, the expanded state,
  and announcements.
  - `toastManager`: `ToastManager`. Defaults to a manager created by the provider.
  - `timeout`: `number`. Default auto-dismiss time in ms. Defaults to `5000`.
  - `limit`: `number`. Toasts beyond it get `data-limited` and `inert` (they stay mounted so they
    can animate). Defaults to `3`.
- `viewport()`: the container. Sets `role="region"`, `aria-label="Notifications"` (override with
  your own `aria-label`), `tabIndex=-1`, and `data-expanded` while hovered or focused.
- `root({ toast, swipeDirection? })`: one toast. Sets `role="dialog"` (`"alertdialog"` for
  `priority: 'high'`), `aria-modal="false"`, `aria-labelledby` / `aria-describedby` (when the
  toast has a title / description), `tabIndex=0`, `inert` when limited, the data attributes and
  CSS variables below, and swipe handling.
  - `swipeDirection`: `'up' | 'down' | 'left' | 'right'` or an array. Defaults to
    `['down', 'right']`.
- `content({ toast })`: optional wrapper for the toast's contents, for hiding the contents of
  toasts behind the frontmost one.
- `title({ toast })`, `description({ toast })`: set the `id`s the root points at, and
  `data-type`.
- `action({ toast })`: applies `toast.actionProps` (attributes and `onClick`), `type="button"`,
  `data-type`. It doesn't close the toast; call `close(id)` from `onClick` if it should.
- `close({ toast })`: closes the toast on click. Give it an accessible name.

`title()`, `description()`, `content()`, `action()`, and `close()` can be called without options;
`action()` and `close()` then find their toast from the enclosing root at click time, but
`title()` / `description()` can't link the root's labels without `{ toast }`.

## Behavior notes

- **List rendering and exit animations.** A closed toast stays in `context.toasts` with
  `transitionStatus: 'ending'`, so the app keeps rendering it (keyed by `id`). The root renders
  `data-ending-style`, waits for its CSS transitions and animations (`element.getAnimations()`),
  then removes the toast from the manager; the next render drops the element. A closing toast
  keeps its `--toast-index` / `--toast-offset-y` while the rest of the stack moves. Closed toasts
  whose root isn't rendered are removed right away. Re-adding the same `id` while it's closing
  brings it back.
- **Enter transition.** New toasts render with `data-starting-style`; it is removed on the next
  frame so CSS transitions from it. Toasts already in the manager during server rendering are
  rendered with `data-starting-style` and animate in after hydration.
- **Timers** start when the provider mounts and pause while the viewport is hovered (mouse/pen)
  or contains focus, while the window is blurred or the tab hidden, and while a toast is being
  swiped. They resume with the remaining time.
- **Stacking.** Index 0 is the newest toast. `--toast-offset-y` is the sum of the heights of the
  toasts in front of it (add gaps in CSS with `--toast-index`). Heights are measured unclamped
  (with `height: auto`) on insert and whenever the toast is updated.
- **Swipe to dismiss.** Pointer down on the root (not on buttons, links, inputs, or elements with
  `data-swipe-ignore`), then drag. The gesture locks to the axis of the first movement; movement
  in a disallowed direction is dampened. Releasing past 40px (or a quick flick) in an allowed
  direction closes the toast with `data-swipe-direction` set and the movement variables kept, so
  CSS can animate it out from where it was released; otherwise the variables reset to `0px`.
  Add `touch-action: none` to roots so touch drags aren't taken by scrolling.
- **Keyboard.** F6 moves focus to the viewport (when it has toasts) and F6 again returns focus to
  where it was. Tab moves through toasts and their buttons. There is no Escape handling.
- **Announcements.** While a provider is mounted, two visually hidden live regions are appended
  to `<body>`: `role="status"` / `aria-live="polite"` and `role="alert"` /
  `aria-live="assertive"`. Each added toast, and each update that changes its title or
  description, appends "title. description" to the region matching its priority (string values;
  other nodes use the rendered text). Persistent regions are announced more reliably than a live
  region inserted along with its content.
- **No portal.** Render the viewport where you want it (usually at the end of `<body>`) and
  position it with `position: fixed`. Base UI's `Portal` has no equivalent; anchored toasts
  (`Positioner`, `Arrow`, `positionerProps`) aren't implemented.
- CSS variables are written to the element's `style` after each render (and on insert), so they
  aren't in server HTML. Use fallbacks in formulas: `var(--toast-index, 0)`.

## Styling hooks

| Part                              | Attribute / variable       | Notes                                                   |
| --------------------------------- | -------------------------- | ------------------------------------------------------- |
| viewport                          | `data-expanded`            | Hovered or focused.                                     |
| viewport                          | `--toast-frontmost-height` | Height of the frontmost toast, in px.                   |
| root                              | `data-type`                | The toast's `type`.                                     |
| root                              | `data-expanded`            | The viewport is expanded.                               |
| root                              | `data-limited`             | Beyond the provider's `limit` (also `inert`).           |
| root                              | `data-swiping`             | A swipe gesture is in progress.                         |
| root                              | `data-swipe-direction`     | `up` / `down` / `left` / `right`, set when swiped away. |
| root                              | `data-starting-style`      | Entering.                                               |
| root                              | `data-ending-style`        | Closing; removed from the DOM after its animations end. |
| root                              | `--toast-index`            | Position in the stack, 0 is frontmost.                  |
| root                              | `--toast-offset-y`         | Sum of the heights in front, in px.                     |
| root                              | `--toast-height`           | Measured natural height, in px.                         |
| root                              | `--toast-swipe-movement-x` | Horizontal swipe movement, in px.                       |
| root                              | `--toast-swipe-movement-y` | Vertical swipe movement, in px.                         |
| content                           | `data-behind`              | Not the frontmost toast.                                |
| content                           | `data-expanded`            | The viewport is expanded.                               |
| title, description, action, close | `data-type`                | The toast's `type`.                                     |
