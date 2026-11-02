/**
 * Detached triggers (Base UI's `createHandle()`): a handle links a popup's `Context` with
 * triggers rendered anywhere in the document, outside that `Context`.
 *
 * - `createPopupHandle(kind)` makes the handle. Pass it to the `Context` (`handle` prop) and to
 *   each detached trigger (`trigger({ handle, payload })`).
 * - The `Context` attaches its context value and an imperative controller with
 *   `handle._state.attach()`. Only one root is attached at a time (the last one mounted);
 *   unmounting detaches it. Each mount starts from fresh state.
 * - Trigger registries (`handle._state.shared(key, init)`) live on the handle, so detached
 *   triggers registered before the root mounts (or across remounts) are seen by the root's
 *   store: focus return, `aria-controls`, positioning against the active trigger, and "the
 *   trigger counts as inside" for dismissal all work as for triggers inside the `Context`.
 * - A detached trigger is not rendered by the `Context`, so it can't re-render with it. The
 *   `Context` calls `handle._state.notify()` on every render, and detached triggers write their
 *   state attributes (`aria-expanded`, `data-popup-open`, …) directly to the DOM.
 * - `createTriggerBinding()` gives a trigger mixin a context value that resolves, at access time,
 *   to the attached root's value (when the trigger has a `handle`), the enclosing `Context`, or an
 *   inert closed fallback. Trigger behaviors register lazily (on first use, after the first
 *   render has bound the handle).
 *
 * On the server nothing is shared or attached: a handle is usually a module-level singleton and
 * server signals never abort, so per-request state would leak between requests. Detached
 * triggers render their closed state on the server.
 */

import type { MixinHandle } from '@remix-run/component'

const IS_SERVER = typeof document === 'undefined'

/** Imperative control a root attaches to its handle. */
export interface PopupHandleController {
  readonly isOpen: boolean
  /** Opens, associated with the registered trigger whose `id` is `triggerId` (if any). */
  open(triggerId: string | null): void
  close(): void
  /** Opens with a payload and no trigger (dialogs only). */
  openWithPayload?(payload: unknown): void
}

/** @internal */
export interface PopupHandleState {
  /** The attached root's context value, or `null`. */
  readonly value: object | null
  readonly controller: PopupHandleController | null
  /** A value shared by every root and trigger using the handle (not shared on the server). */
  shared<T>(key: string, init: () => T): T
  /** Attaches a root until `signal` aborts. */
  attach(value: object, controller: PopupHandleController, signal: AbortSignal): void
  /** Calls `listener` (in a microtask) after the attached root renders or (de)attaches. */
  subscribe(listener: () => void, signal: AbortSignal): void
  /** Schedules the listeners. */
  notify(): void
}

/**
 * Links a popup's `Context` with detached triggers (Base UI's `Handle`). `Payload` types the
 * triggers' `payload`. Imperative methods take effect only while a `Context` using the handle is
 * mounted; calls made while none is attached are ignored.
 */
export interface PopupHandle<Payload = unknown, Kind extends string = string> {
  /** Which widget the handle belongs to. */
  readonly kind: Kind
  /** Whether the popup is open (`false` while no `Context` is attached). */
  readonly isOpen: boolean
  /**
   * Opens the popup, associated with the trigger whose `id` is `triggerId` (it becomes the
   * active trigger: anchor, focus return, payload). Call from event handlers, not during render.
   */
  open(triggerId?: string | null): void
  /** Closes the popup. */
  close(): void
  /** @internal */
  readonly _state: PopupHandleState
  /** @internal Type-only: carries `Payload`. */
  readonly _payload?: Payload
}

/** The state of a handle: what a `Context` children render function receives. */
export interface PopupPayloadState<Payload = unknown> {
  /** The active trigger's `payload` (or the one passed to `openWithPayload`). */
  readonly payload: Payload | undefined
}

/** `children` of a `Context` that supports payloads: nodes, or a function of the payload. */
export type PopupPayloadChildren<Node, Payload = unknown> =
  Node | ((state: PopupPayloadState<Payload>) => Node)

/** Calls a children render function with the payload. */
export function resolvePayloadChildren<Node>(
  children: PopupPayloadChildren<Node> | undefined,
  payload: unknown,
): Node | undefined {
  return typeof children === 'function'
    ? (children as (state: PopupPayloadState) => Node)({ payload })
    : children
}

export function createPopupHandle<Payload, Kind extends string>(
  kind: Kind,
): PopupHandle<Payload, Kind> {
  let value: object | null = null
  let controller: PopupHandleController | null = null
  let sharedValues = new Map<string, unknown>()
  let listeners = new Set<() => void>()
  let scheduled = false

  let state: PopupHandleState = {
    get value() {
      return value
    },
    get controller() {
      return controller
    },
    shared(key, init) {
      if (IS_SERVER) return init()
      if (!sharedValues.has(key)) sharedValues.set(key, init())
      return sharedValues.get(key) as ReturnType<typeof init>
    },
    attach(nextValue, nextController, signal) {
      if (IS_SERVER) return
      value = nextValue
      controller = nextController
      state.notify()
      signal.addEventListener('abort', () => {
        if (value !== nextValue) return
        value = null
        controller = null
        state.notify()
      })
    },
    subscribe(listener, signal) {
      if (IS_SERVER || signal.aborted) return
      listeners.add(listener)
      signal.addEventListener('abort', () => listeners.delete(listener))
    },
    notify() {
      if (IS_SERVER || scheduled) return
      scheduled = true
      queueMicrotask(() => {
        scheduled = false
        for (let listener of [...listeners]) listener()
      })
    },
  }

  return {
    kind,
    get isOpen() {
      return controller?.isOpen ?? false
    },
    open(triggerId = null) {
      controller?.open(triggerId)
    },
    close() {
      controller?.close()
    },
    _state: state,
  }
}

// ---------------------------------------------------------------------------------------------
// Trigger binding

export interface TriggerBinding<Value extends object> {
  /**
   * The context value the trigger works against, resolved on every property access: the
   * attached root of the bound handle, else the enclosing `Context`, else an inert fallback.
   */
  readonly context: Value
  /** The resolved context value right now (for identity comparisons). */
  readonly current: Value
  /** The bound handle (after the first render), if any. */
  readonly handle: PopupHandle<unknown> | undefined
  /** Whether the trigger is bound to a handle (and so not re-rendered by the `Context`). */
  readonly detached: boolean
  /**
   * Call at the top of the trigger mixin's render function, before using any behavior that
   * registers the trigger. The first call wins: a trigger's `handle` can't change later.
   * `refresh` runs after the attached root renders, so it can write state attributes.
   */
  bind(handle: PopupHandle<unknown> | undefined, refresh: () => void): void
}

/**
 * Builds a trigger's context binding. `inside` is the enclosing `Context`'s value (or
 * `undefined`); `fallback(handle)` builds the inert value used while no root is attached (its
 * registration methods should register with the handle's shared registry).
 */
export function createTriggerBinding<Value extends object>(
  mixin: MixinHandle<any>,
  inside: Value | undefined,
  fallback: (handle: PopupHandle<unknown> | undefined) => Value,
  pin?: (resolve: () => Value) => Partial<Record<PropertyKey, unknown>>,
): TriggerBinding<Value> {
  let signal = mixin.signal
  let bound = false
  let boundHandle: PopupHandle<unknown> | undefined
  // Per handle: a fallback built before `bind()` (e.g. read during setup) must not keep
  // registering triggers outside the handle's registry.
  let fallbacks = new Map<PopupHandle<unknown> | undefined, Value>()

  function resolve(): Value {
    if (boundHandle) {
      let attached = boundHandle._state.value as Value | null
      if (attached) return attached
    } else if (inside) {
      return inside
    }
    let value = fallbacks.get(boundHandle)
    if (!value) fallbacks.set(boundHandle, (value = fallback(boundHandle)))
    return value
  }

  let context = forward(resolve, pin?.(resolve))

  return {
    context,
    get current() {
      return resolve()
    },
    get handle() {
      return boundHandle
    },
    get detached() {
      return boundHandle !== undefined
    },
    bind(handle, refresh) {
      if (bound) return
      bound = true
      if (!handle) return
      boundHandle = handle
      handle._state.subscribe(refresh, signal)
    },
  }
}

/**
 * A stand-in object whose properties read from `resolve()` at access time (methods are bound to
 * the resolved object). `pinned` properties always return the given values (e.g. a nested
 * forwarded store, so code that captures `context.store` keeps resolving).
 */
export function forward<Value extends object>(
  resolve: () => Value,
  pinned: Partial<Record<PropertyKey, unknown>> = {},
): Value {
  return new Proxy({} as Value, {
    get(_target, key) {
      if (Object.prototype.hasOwnProperty.call(pinned, key)) return pinned[key]
      let source = resolve()
      let result = Reflect.get(source, key)
      return typeof result === 'function' ? result.bind(source) : result
    },
    set(_target, key, next) {
      return Reflect.set(resolve(), key, next)
    },
    has(_target, key) {
      return key in resolve()
    },
  })
}

/** Writes attribute values (`undefined` removes) to a trigger rendered outside its `Context`. */
export function writeAttributes(node: Element, values: Record<string, string | undefined>) {
  for (let [name, next] of Object.entries(values)) {
    if (next === undefined) node.removeAttribute(name)
    else if (node.getAttribute(name) !== next) node.setAttribute(name, next)
  }
}
