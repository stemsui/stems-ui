import type { ElementProps, RemixNode } from '@remix-run/component'

/** How urgently screen readers announce a toast. */
export type ToastPriority = 'low' | 'high'

/**
 * Props for the toast's action button (`toast.action()`), Base UI's `actionProps`.
 *
 * `children` is the button content: a mixin can't render children, so render
 * `{toast.actionProps?.children}` inside the action button yourself. `onClick` runs on click;
 * every other entry is applied to the button as a default attribute.
 */
export type ToastActionProps = Omit<ElementProps, 'children' | 'mix' | 'onClick'> & {
  children?: RemixNode
  onClick?: (event: MouseEvent) => void
}

/** Options shared by `add()`, `update()`, and the `promise()` states. */
export interface ToastUpdateOptions<Data = any> {
  /** The title of the toast. Render it inside `toast.title()` yourself. */
  title?: RemixNode
  /** The description of the toast. Render it inside `toast.description()` yourself. */
  description?: RemixNode
  /**
   * The type of the toast (`'success'`, `'error'`, `'loading'`, …). Exposed as `data-type` on
   * every part so the toast can be styled per type.
   */
  type?: string
  /**
   * Time in ms before the toast closes on its own. `0` keeps it open. Defaults to the
   * `<toast.Context timeout>` value (5000).
   */
  timeout?: number
  /**
   * `'low'` announces the toast politely, `'high'` interrupts the screen reader.
   * @default 'low'
   */
  priority?: ToastPriority
  /** Called once when the toast starts closing. */
  onClose?: () => void
  /** Called when the toast is removed, after its exit animation finished. */
  onRemove?: () => void
  /** Props for `toast.action()`. */
  actionProps?: ToastActionProps
  /** Custom data, replaced as a whole by `update()`. */
  data?: Data
}

/** Options for `manager.add()`. */
export interface ToastAddOptions<Data = any> extends ToastUpdateOptions<Data> {
  /**
   * The toast's id. Adding a toast with an existing id updates it in place and restarts its
   * auto-dismiss timer.
   */
  id?: string
}

/** A toast in the manager's list. Objects are immutable: changes produce new objects. */
export interface ToastObject<Data = any> extends ToastUpdateOptions<Data> {
  readonly id: string
  /**
   * `'starting'` until the toast's root has rendered its enter transition, `'ending'` once it
   * was closed and is animating out. `undefined` otherwise.
   */
  readonly transitionStatus?: 'starting' | 'ending'
  /** Increments whenever the toast is updated or upserted. */
  readonly updateKey: number
  /** Present on toasts from `<toast.Context>`: the toast is beyond the provider's `limit`. */
  readonly limited?: boolean
  /** Present on toasts from `<toast.Context>`: the measured natural height in px. */
  readonly height?: number
}

/** Options for `manager.promise()`: a string is a shortcut for `{ description }`. */
export interface ToastPromiseOptions<Value, Data = any> {
  loading: string | ToastUpdateOptions<Data>
  success: string | ToastUpdateOptions<Data> | ((value: Value) => string | ToastUpdateOptions<Data>)
  error: string | ToastUpdateOptions<Data> | ((error: unknown) => string | ToastUpdateOptions<Data>)
}

/** What changed, passed to `subscribe()` listeners along with the new list. */
export type ToastManagerEvent =
  | { type: 'add'; id: string; options: ToastAddOptions }
  | { type: 'update'; id: string; options: ToastUpdateOptions }
  | { type: 'close'; id: string }
  | { type: 'remove'; id: string }
  | { type: 'enter'; id: string }

export type ToastManagerListener = (
  toasts: readonly ToastObject[],
  event: ToastManagerEvent,
) => void

/**
 * A toast store, usable anywhere (a module-level singleton, an event handler, a fetch helper).
 * Pass it to `<toast.Context toastManager>` to render its toasts.
 */
export interface ToastManager<Data = any> {
  /** The current toasts, newest first. Closed toasts stay until their exit animation ends. */
  readonly toasts: readonly ToastObject<Data>[]
  /** Adds a toast (or upserts by `id`) and returns its id. */
  add(options: ToastAddOptions<Data>): string
  /**
   * Updates a toast. Options replace the corresponding values; pass a function to derive them
   * from the current toast. Passing `timeout` restarts the auto-dismiss timer.
   */
  update(
    id: string,
    options: ToastUpdateOptions<Data> | ((toast: ToastObject<Data>) => ToastUpdateOptions<Data>),
  ): void
  /** Closes a toast, or every toast when called without an id. */
  close(id?: string): void
  /**
   * Shows a `'loading'` toast (no timeout) that turns into `'success'` or `'error'` when the
   * promise settles. Returns the same promise.
   */
  promise<Value>(promise: Promise<Value>, options: ToastPromiseOptions<Value, Data>): Promise<Value>
  /** Listens for changes. Returns an unsubscribe function. */
  subscribe(listener: ToastManagerListener): () => void
}

/** Hooks used by `<toast.Context>`; not part of the public API. */
export interface ToastManagerInternals {
  /** Removes a closed toast (after its exit animation) and calls `onRemove`. */
  remove(id: string): void
  /** Clears `transitionStatus: 'starting'` once the root has run its enter transition. */
  markEntered(id: string): void
  /**
   * Registers a renderer. Without one, closed toasts are removed right away because nothing
   * would report the end of their exit animation.
   */
  connect(): () => void
}

const internalsByManager = new WeakMap<ToastManager, ToastManagerInternals>()

export function getToastManagerInternals(manager: ToastManager): ToastManagerInternals {
  let internals = internalsByManager.get(manager)
  if (!internals) throw new Error('stems-ui/toast: not a manager from createToastManager()')
  return internals
}

let managerCount = 0

/** Creates a toast manager (Base UI's `Toast.createToastManager()`). */
export function createToastManager<Data = any>(): ToastManager<Data> {
  let prefix = `stems-toast-${++managerCount}`
  let nextId = 0
  let toasts: ToastObject<Data>[] = []
  let listeners = new Set<ToastManagerListener>()
  let renderers = 0

  function emit(event: ToastManagerEvent) {
    for (let listener of [...listeners]) listener(toasts, event)
  }

  function find(id: string) {
    return toasts.find((toast) => toast.id === id)
  }

  function replace(id: string, next: ToastObject<Data>) {
    toasts = toasts.map((toast) => (toast.id === id ? next : toast))
  }

  function remove(id: string) {
    let toast = find(id)
    if (!toast) return
    toasts = toasts.filter((item) => item.id !== id)
    toast.onRemove?.()
    emit({ type: 'remove', id })
  }

  function closeOne(toast: ToastObject<Data>) {
    if (toast.transitionStatus === 'ending') return
    replace(toast.id, { ...toast, transitionStatus: 'ending' })
    toast.onClose?.()
    emit({ type: 'close', id: toast.id })
    if (renderers === 0) remove(toast.id)
  }

  let manager: ToastManager<Data> = {
    get toasts() {
      return toasts
    },
    add(options) {
      let { id: requestedId, ...rest } = options
      let existing = requestedId === undefined ? undefined : find(requestedId)

      if (existing) {
        replace(existing.id, {
          ...existing,
          ...rest,
          // Re-adding a closing toast brings it back.
          transitionStatus:
            existing.transitionStatus === 'ending' ? undefined : existing.transitionStatus,
          updateKey: existing.updateKey + 1,
        })
        emit({ type: 'add', id: existing.id, options })
        return existing.id
      }

      let id = requestedId ?? `${prefix}-${++nextId}`
      toasts = [{ ...rest, id, transitionStatus: 'starting', updateKey: 0 }, ...toasts]
      emit({ type: 'add', id, options })
      return id
    },
    update(id, options) {
      let toast = find(id)
      if (!toast) return
      let resolved = typeof options === 'function' ? options(toast) : options
      replace(id, { ...toast, ...resolved, updateKey: toast.updateKey + 1 })
      emit({ type: 'update', id, options: resolved })
    },
    close(id) {
      if (id === undefined) {
        for (let toast of toasts) closeOne(toast)
        return
      }
      let toast = find(id)
      if (toast) closeOne(toast)
    },
    promise(promise, options) {
      let id = manager.add({ ...toOptions(options.loading), type: 'loading', timeout: 0 })

      function settle(type: 'success' | 'error', state: ToastUpdateOptions<Data>) {
        // `timeout` is always passed so the auto-dismiss timer starts (with the provider
        // default when the state doesn't set one).
        manager.update(id, { type, ...state, timeout: state.timeout })
      }

      promise.then(
        (value) => {
          let success = options.success
          settle('success', toOptions(typeof success === 'function' ? success(value) : success))
        },
        (error: unknown) => {
          let failure = options.error
          settle('error', toOptions(typeof failure === 'function' ? failure(error) : failure))
        },
      )

      return promise
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }

  internalsByManager.set(manager, {
    remove,
    markEntered(id) {
      let toast = find(id)
      if (!toast || toast.transitionStatus !== 'starting') return
      replace(id, { ...toast, transitionStatus: undefined })
      emit({ type: 'enter', id })
    },
    connect() {
      renderers++
      let connected = true
      return () => {
        if (!connected) return
        connected = false
        renderers--
      }
    },
  })

  return manager
}

function toOptions<Data>(value: string | ToastUpdateOptions<Data>): ToastUpdateOptions<Data> {
  return typeof value === 'string' ? { description: value } : value
}
