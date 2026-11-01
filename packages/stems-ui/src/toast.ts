import { attrs, createMixin, on } from '@remix-run/component'
import type {
  ElementProps,
  Handle,
  MixinFactory,
  MixinHandle,
  RemixNode,
} from '@remix-run/component'

import { splitOptions } from './lib/collapsible-panel.ts'
import { waitForAnimations } from './lib/presence.ts'
import { acquireToastAnnouncer, type ToastAnnouncer } from './lib/toast-announcer.ts'
import {
  createToastManager,
  getToastManagerInternals,
  type ToastAddOptions,
  type ToastManager,
  type ToastManagerEvent,
  type ToastObject,
  type ToastPromiseOptions,
  type ToastUpdateOptions,
} from './lib/toast-manager.ts'

export { createToastManager } from './lib/toast-manager.ts'
export type {
  ToastActionProps,
  ToastAddOptions,
  ToastManager,
  ToastManagerEvent,
  ToastManagerListener,
  ToastObject,
  ToastPriority,
  ToastPromiseOptions,
  ToastUpdateOptions,
} from './lib/toast-manager.ts'

export type ToastSwipeDirection = 'up' | 'down' | 'left' | 'right'

/** Props for `<toast.Context>`. They match Base UI's `Toast.Provider` props. */
export interface ToastContextProps {
  children?: RemixNode
  /**
   * The manager whose toasts are rendered, e.g. a module-level `createToastManager()` so toasts
   * can be added from anywhere. Without one, the provider creates its own; reach it with
   * `handle.context.get(toast.Context)`.
   */
  toastManager?: ToastManager
  /**
   * Default time in ms before a toast closes on its own. `0` keeps toasts open.
   * @default 5000
   */
  timeout?: number
  /**
   * The maximum number of toasts shown at once. Older toasts beyond the limit stay mounted with
   * `data-limited` and `inert`.
   * @default 3
   */
  limit?: number
}

/**
 * State provided by `<toast.Context>`, read with `handle.context.get(toast.Context)` (Base UI's
 * `useToastManager()`). Components below the provider re-render when the toasts change.
 */
export interface ToastContextValue {
  /** The toasts to render, newest first, with `limited` and `height` filled in. */
  readonly toasts: readonly ToastObject[]
  /** Whether the viewport is expanded (hovered or focused). */
  readonly expanded: boolean
  readonly toastManager: ToastManager
  add(options: ToastAddOptions): string
  update(
    id: string,
    options: ToastUpdateOptions | ((toast: ToastObject) => ToastUpdateOptions),
  ): void
  close(id?: string): void
  promise<Value>(promise: Promise<Value>, options: ToastPromiseOptions<Value>): Promise<Value>
}

export interface ToastRootOptions {
  /** The toast to render, from `handle.context.get(toast.Context).toasts`. */
  toast: ToastObject
  /**
   * Direction(s) in which the toast can be swiped to dismiss.
   * @default ['down', 'right']
   */
  swipeDirection?: ToastSwipeDirection | ToastSwipeDirection[]
}

/** Options for `title()`, `description()`, `content()`, `action()`, and `close()`. */
export interface ToastPartOptions {
  /** The toast this part belongs to (the same object passed to `toast.root()`). */
  toast?: ToastObject
}

interface ToastLayout {
  index: number
  offsetY: number
}

interface SwipeState {
  swiping: boolean
  direction?: ToastSwipeDirection
  movementX: number
  movementY: number
}

interface ToastInternals {
  readonly manager: ToastManager
  readonly expanded: boolean
  get(id: string): ToastObject | undefined
  layout(id: string): ToastLayout
  height(id: string): number | undefined
  frontmostHeight(): number | undefined
  hasActiveToasts(): boolean
  registerRoot(id: string, node: HTMLElement): void
  unregisterRoot(id: string, node: HTMLElement): void
  idForNode(node: Element | null): string | undefined
  setHeight(id: string, height: number): void
  swipe(id: string): SwipeState
  setSwiping(id: string, swiping: boolean, direction?: ToastSwipeDirection): void
  registerViewport(node: HTMLElement): () => void
  setHovering(hovering: boolean): void
  setFocused(focused: boolean): void
  update(): Promise<unknown>
}

const internalsByContext = new WeakMap<ToastContextValue, ToastInternals>()

const DEFAULT_TIMEOUT = 5000
const DEFAULT_LIMIT = 3
const SWIPE_THRESHOLD = 40
const SWIPE_FLICK_VELOCITY = 0.5 // px per ms
const SWIPE_START_DISTANCE = 4
const SWIPE_IGNORE_SELECTOR =
  'button, a[href], input, textarea, select, [role="button"], [contenteditable], [data-swipe-ignore]'

interface Timer {
  remaining: number
  startedAt: number
  handle: ReturnType<typeof setTimeout> | undefined
}

function ToastProvider(handle: Handle<ToastContextProps, ToastContextValue>): () => RemixNode {
  let manager: ToastManager = handle.props.toastManager ?? createToastManager()
  let disconnect: (() => void) | undefined
  let unsubscribe: (() => void) | undefined

  let derived: ToastObject[] = []
  let byId = new Map<string, ToastObject>()
  let layouts = new Map<string, ToastLayout>()
  let heights = new Map<string, number>()
  let roots = new Map<string, HTMLElement>()
  let ids = new WeakMap<Element, string>()
  let swipes = new Map<string, SwipeState>()
  let timers = new Map<string, Timer>()
  let pendingAnnouncements = new Set<string>()
  let announcer: ToastAnnouncer | undefined

  let hovering = false
  let focused = false
  let windowBlurred = false
  let documentHidden = false
  let swiping = 0
  let mounted = false

  function isPaused() {
    return hovering || focused || windowBlurred || documentHidden || swiping > 0
  }

  function rerender() {
    if (!mounted) return Promise.resolve()
    return handle.update()
  }

  // Timers -------------------------------------------------------------------------------------

  function startTimer(id: string, timer: Timer) {
    timer.startedAt = Date.now()
    timer.handle = setTimeout(() => {
      timers.delete(id)
      manager.close(id)
    }, timer.remaining)
  }

  function schedule(toast: ToastObject) {
    clearTimer(toast.id)
    let timeout = toast.timeout ?? handle.props.timeout ?? DEFAULT_TIMEOUT
    if (!(timeout > 0) || timeout === Infinity || toast.transitionStatus === 'ending') return
    let timer: Timer = { remaining: timeout, startedAt: 0, handle: undefined }
    timers.set(toast.id, timer)
    if (mounted && !isPaused()) startTimer(toast.id, timer)
  }

  function clearTimer(id: string) {
    let timer = timers.get(id)
    if (timer?.handle !== undefined) clearTimeout(timer.handle)
    timers.delete(id)
  }

  function syncTimers() {
    let paused = isPaused()
    for (let [id, timer] of timers) {
      if (paused && timer.handle !== undefined) {
        clearTimeout(timer.handle)
        timer.handle = undefined
        timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.startedAt))
      } else if (!paused && timer.handle === undefined) {
        startTimer(id, timer)
      }
    }
  }

  // Manager subscription -----------------------------------------------------------------------

  function onManagerEvent(_toasts: readonly ToastObject[], event: ToastManagerEvent) {
    let toast = manager.toasts.find((item) => item.id === event.id)
    switch (event.type) {
      case 'add':
        if (toast) schedule(toast)
        pendingAnnouncements.add(event.id)
        break
      case 'update':
        if (toast && 'timeout' in event.options) schedule(toast)
        if ('title' in event.options || 'description' in event.options) {
          pendingAnnouncements.add(event.id)
        }
        break
      case 'close':
        clearTimer(event.id)
        break
      case 'remove':
        clearTimer(event.id)
        heights.delete(event.id)
        layouts.delete(event.id)
        swipes.delete(event.id)
        roots.delete(event.id)
        pendingAnnouncements.delete(event.id)
        break
    }
    if (!manager.toasts.some((item) => item.transitionStatus !== 'ending')) {
      // Nothing left to hover: the pointer may be gone without a `pointerleave`.
      hovering = false
      syncTimers()
    }
    void rerender()
  }

  function connect(next: ToastManager) {
    unsubscribe?.()
    disconnect?.()
    manager = next
    unsubscribe = manager.subscribe(onManagerEvent)
    disconnect = getToastManagerInternals(manager).connect()
    for (let toast of manager.toasts) schedule(toast)
  }

  // Derived state ------------------------------------------------------------------------------

  function derive() {
    let limit = handle.props.limit ?? DEFAULT_LIMIT
    let index = 0
    let offsetY = 0
    derived = []
    byId = new Map()

    for (let toast of manager.toasts) {
      let layout: ToastLayout
      let limited = false
      if (toast.transitionStatus === 'ending') {
        // Keep the closing toast where it was while the rest of the stack moves up.
        layout = layouts.get(toast.id) ?? { index, offsetY }
      } else {
        layout = { index, offsetY }
        layouts.set(toast.id, layout)
        limited = index >= limit
        index++
        offsetY += heights.get(toast.id) ?? 0
      }
      let item: ToastObject = { ...toast, limited, height: heights.get(toast.id) }
      derived.push(item)
      byId.set(toast.id, item)
    }
  }

  function textOf(value: RemixNode, node: Element | null | undefined) {
    if (typeof value === 'string' || typeof value === 'number') return String(value)
    return node?.textContent ?? ''
  }

  function flushAfterCommit() {
    let internals = getToastManagerInternals(manager)
    for (let toast of manager.toasts) {
      // Closed toasts without a mounted root (not rendered by the app) have nothing to animate.
      if (toast.transitionStatus === 'ending' && !roots.get(toast.id)?.isConnected) {
        internals.remove(toast.id)
      }
    }

    for (let id of pendingAnnouncements) {
      let toast = manager.toasts.find((item) => item.id === id)
      if (!toast || toast.transitionStatus === 'ending') continue
      let root = roots.get(id)
      let doc = root?.ownerDocument
      let text = [
        textOf(toast.title, doc?.getElementById(`${id}-title`)),
        textOf(toast.description, doc?.getElementById(`${id}-description`)),
      ]
        .filter(Boolean)
        .join('. ')
      announcer?.announce(text, toast.priority === 'high' ? 'high' : 'low')
    }
    pendingAnnouncements.clear()
  }

  // Window / document listeners ----------------------------------------------------------------

  let lifetime = handle.signal

  handle.queueTask(() => {
    if (typeof window === 'undefined' || lifetime.aborted) return
    mounted = true
    announcer = acquireToastAnnouncer(document)
    documentHidden = document.visibilityState === 'hidden'
    syncTimers()
    flushAfterCommit()

    let onBlur = () => {
      windowBlurred = true
      syncTimers()
    }
    let onFocus = () => {
      windowBlurred = false
      syncTimers()
    }
    let onVisibility = () => {
      documentHidden = document.visibilityState === 'hidden'
      syncTimers()
    }
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)

    lifetime.addEventListener(
      'abort',
      () => {
        window.removeEventListener('blur', onBlur)
        window.removeEventListener('focus', onFocus)
        document.removeEventListener('visibilitychange', onVisibility)
      },
      { once: true },
    )
  })

  lifetime.addEventListener(
    'abort',
    () => {
      mounted = false
      for (let id of [...timers.keys()]) clearTimer(id)
      unsubscribe?.()
      disconnect?.()
      announcer?.release()
    },
    { once: true },
  )

  connect(manager)

  let value: ToastContextValue = {
    get toasts() {
      return derived
    },
    get expanded() {
      return hovering || focused
    },
    get toastManager() {
      return manager
    },
    add: (options) => manager.add(options),
    update: (id, options) => manager.update(id, options),
    close: (id) => manager.close(id),
    promise: (promise, options) => manager.promise(promise, options),
  }

  let internals: ToastInternals = {
    get manager() {
      return manager
    },
    get expanded() {
      return hovering || focused
    },
    get: (id) => byId.get(id),
    layout: (id) => layouts.get(id) ?? { index: 0, offsetY: 0 },
    height: (id) => heights.get(id),
    frontmostHeight() {
      let front = manager.toasts.find((toast) => toast.transitionStatus !== 'ending')
      return front ? heights.get(front.id) : undefined
    },
    hasActiveToasts() {
      return manager.toasts.some((toast) => toast.transitionStatus !== 'ending')
    },
    registerRoot(id, node) {
      roots.set(id, node)
      ids.set(node, id)
    },
    unregisterRoot(id, node) {
      if (roots.get(id) === node) roots.delete(id)
    },
    idForNode(node) {
      for (let current = node; current; current = current.parentElement) {
        let id = ids.get(current)
        if (id !== undefined) return id
      }
      return undefined
    },
    setHeight(id, height) {
      if (heights.get(id) === height) return
      heights.set(id, height)
      void rerender()
    },
    swipe(id) {
      let state = swipes.get(id)
      if (!state) {
        state = { swiping: false, movementX: 0, movementY: 0 }
        swipes.set(id, state)
      }
      return state
    },
    setSwiping(id, next, direction) {
      let state = internals.swipe(id)
      if (state.swiping !== next) {
        swiping += next ? 1 : -1
        syncTimers()
      }
      state.swiping = next
      state.direction = direction
      void rerender()
    },
    registerViewport(node) {
      let previousFocus: HTMLElement | null = null

      function onKeyDown(event: KeyboardEvent) {
        if (event.key !== 'F6' || event.defaultPrevented) return
        let active = node.ownerDocument.activeElement
        if (active instanceof Node && node.contains(active)) {
          event.preventDefault()
          if (previousFocus?.isConnected) previousFocus.focus()
          else (active as HTMLElement).blur?.()
          previousFocus = null
          return
        }
        if (!internals.hasActiveToasts()) return
        event.preventDefault()
        previousFocus = active instanceof HTMLElement ? active : null
        node.focus()
      }

      node.ownerDocument.addEventListener('keydown', onKeyDown)
      return () => node.ownerDocument.removeEventListener('keydown', onKeyDown)
    },
    setHovering(next) {
      if (hovering === next) return
      hovering = next
      syncTimers()
      void rerender()
    },
    setFocused(next) {
      if (focused === next) return
      focused = next
      syncTimers()
      void rerender()
    },
    update: () => rerender(),
  }

  handle.context.set(value)
  internalsByContext.set(value, internals)

  return () => {
    let next = handle.props.toastManager
    if (next && next !== manager) connect(next)
    derive()
    handle.queueTask(flushAfterCommit)
    return handle.props.children
  }
}

function getInternals(handle: MixinHandle<HTMLElement>): ToastInternals | undefined {
  let context = handle.context.get(ToastProvider) as ToastContextValue | undefined
  return context ? internalsByContext.get(context) : undefined
}

function px(value: number) {
  return `${value}px`
}

function isServer() {
  return typeof document === 'undefined'
}

// Viewport ---------------------------------------------------------------------------------------

const viewportMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let ctx = getInternals(handle)
  let node: HTMLElement | null = null
  let cleanup: (() => void) | undefined

  handle.addEventListener('insert', (event) => {
    node = event.node
    cleanup = ctx?.registerViewport(node)
  })
  handle.addEventListener('remove', () => {
    cleanup?.()
    node = null
  })

  function syncFrontmostHeight(target: HTMLElement) {
    let height = ctx?.frontmostHeight()
    if (height === undefined) target.style.removeProperty('--toast-frontmost-height')
    else target.style.setProperty('--toast-frontmost-height', px(height))
  }

  return () => {
    if (!isServer()) handle.queueTask(syncFrontmostHeight)
    let expanded = ctx?.expanded ?? false

    return [
      attrs({
        role: 'region',
        'aria-label': 'Notifications',
        tabIndex: -1,
        'data-expanded': expanded ? '' : undefined,
      }),
      on<HTMLElement, 'pointerenter'>('pointerenter', (event) => {
        if (event.pointerType === 'touch') return
        ctx?.setHovering(true)
      }),
      on<HTMLElement, 'pointerleave'>('pointerleave', (event) => {
        if (event.pointerType === 'touch') return
        ctx?.setHovering(false)
      }),
      on<HTMLElement, 'focusin'>('focusin', () => {
        ctx?.setFocused(true)
      }),
      on<HTMLElement, 'focusout'>('focusout', (event) => {
        let next = event.relatedTarget
        if (next instanceof Node && node?.contains(next)) return
        ctx?.setFocused(false)
      }),
    ]
  }
})

// Root -------------------------------------------------------------------------------------------

function normalizeDirections(value: ToastRootOptions['swipeDirection']): Set<ToastSwipeDirection> {
  if (value === undefined) return new Set(['down', 'right'])
  return new Set(Array.isArray(value) ? value : [value])
}

function dampen(delta: number) {
  return Math.sign(delta) * Math.sqrt(Math.abs(delta))
}

const rootMixin: MixinFactory<HTMLElement, [options?: ToastRootOptions], ElementProps> =
  createMixin<HTMLElement, [options?: ToastRootOptions], ElementProps>((handle) => {
    let ctx = getInternals(handle)
    let node: HTMLElement | null = null
    let id: string | undefined
    let status: ToastObject['transitionStatus']
    let entering = false
    let enterFrame = 0
    let exit: AbortController | null = null
    let measuredKey: number | undefined
    let directions = normalizeDirections(undefined)
    let gesture: {
      pointerId: number
      startX: number
      startY: number
      startTime: number
      axis?: 'x' | 'y'
      started: boolean
    } | null = null

    handle.addEventListener('insert', (event) => {
      node = event.node
      // Set the stack variables before the first style computation, so the starting style
      // transitions from a valid transform.
      if (id !== undefined) applyLayoutVars(node, id)
    })

    handle.addEventListener('remove', () => {
      cancelAnimationFrame(enterFrame)
      exit?.abort()
      if (node && id !== undefined) ctx?.unregisterRoot(id, node)
      node = null
    })

    function setSwipeVars(target: HTMLElement, x: number, y: number) {
      target.style.setProperty('--toast-swipe-movement-x', px(x))
      target.style.setProperty('--toast-swipe-movement-y', px(y))
    }

    function applyLayoutVars(target: HTMLElement, toastId: string) {
      if (!ctx) return
      let layout = ctx.layout(toastId)
      target.style.setProperty('--toast-index', String(layout.index))
      target.style.setProperty('--toast-offset-y', px(layout.offsetY))
      let height = ctx.height(toastId)
      if (height !== undefined) target.style.setProperty('--toast-height', px(height))
      let swipe = ctx.swipe(toastId)
      if (!swipe.swiping && swipe.direction === undefined) setSwipeVars(target, 0, 0)
    }

    function measure(target: HTMLElement) {
      // The stack may clamp the toast to the frontmost toast's height: measure it unclamped.
      let previous = target.style.height
      target.style.height = 'auto'
      let height = target.offsetHeight
      target.style.height = previous
      return height
    }

    function afterRender(target: HTMLElement, toast: ToastObject) {
      if (!ctx) return
      ctx.registerRoot(toast.id, target)
      applyLayoutVars(target, toast.id)

      if (toast.transitionStatus !== 'ending' && measuredKey !== toast.updateKey) {
        measuredKey = toast.updateKey
        let height = measure(target)
        target.style.setProperty('--toast-height', px(height))
        ctx.setHeight(toast.id, height)
      } else {
        let height = ctx.height(toast.id)
        if (height !== undefined) target.style.setProperty('--toast-height', px(height))
      }

      if (toast.transitionStatus === 'starting' && !entering) {
        entering = true
        // Make sure the starting style has been computed before it is removed.
        void target.offsetHeight
        enterFrame = requestAnimationFrame(() => {
          enterFrame = 0
          target.removeAttribute('data-starting-style')
          getToastManagerInternals(ctx!.manager).markEntered(toast.id)
        })
      }

      if (toast.transitionStatus === 'ending' && !exit) {
        let controller = new AbortController()
        exit = controller
        void waitForAnimations(target, controller.signal).then(() => {
          if (controller.signal.aborted) return
          getToastManagerInternals(ctx!.manager).remove(toast.id)
        })
      } else if (toast.transitionStatus !== 'ending' && exit) {
        // Re-added while closing.
        exit.abort()
        exit = null
      }
    }

    function onPointerDown(event: PointerEvent) {
      if (!ctx || id === undefined || status === 'ending' || event.button !== 0) return
      let target = event.target instanceof Element ? event.target : null
      let interactive = target?.closest(SWIPE_IGNORE_SELECTOR)
      if (interactive && node?.contains(interactive)) return
      gesture = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startTime: event.timeStamp,
        started: false,
      }
      try {
        node?.setPointerCapture(event.pointerId)
      } catch {
        // Synthetic or already released pointers can't be captured.
      }
    }

    function movement(current: NonNullable<typeof gesture>, event: PointerEvent) {
      let dx = event.clientX - current.startX
      let dy = event.clientY - current.startY
      let axis = current.axis
      if (axis === 'x') {
        let allowed = (dx > 0 && directions.has('right')) || (dx < 0 && directions.has('left'))
        return { x: allowed ? dx : dampen(dx), y: 0, dx, dy }
      }
      let allowed = (dy > 0 && directions.has('down')) || (dy < 0 && directions.has('up'))
      return { x: 0, y: allowed ? dy : dampen(dy), dx, dy }
    }

    function onPointerMove(event: PointerEvent) {
      if (!gesture || event.pointerId !== gesture.pointerId || !ctx || id === undefined || !node) {
        return
      }
      let dx = event.clientX - gesture.startX
      let dy = event.clientY - gesture.startY
      if (!gesture.started) {
        if (Math.hypot(dx, dy) < SWIPE_START_DISTANCE) return
        gesture.started = true
        gesture.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
        ctx.setSwiping(id, true)
      }
      let { x, y } = movement(gesture, event)
      let swipe = ctx.swipe(id)
      swipe.movementX = x
      swipe.movementY = y
      setSwipeVars(node, x, y)
    }

    function endGesture(event: PointerEvent, cancelled: boolean) {
      if (!gesture || event.pointerId !== gesture.pointerId || !ctx || id === undefined) return
      let current = gesture
      gesture = null
      try {
        if (node?.hasPointerCapture(event.pointerId)) node.releasePointerCapture(event.pointerId)
      } catch {
        // Ignore.
      }
      if (!current.started) return

      let { dx, dy } = movement(current, event)
      let distance = current.axis === 'x' ? dx : dy
      let elapsed = Math.max(1, event.timeStamp - current.startTime)
      let direction: ToastSwipeDirection =
        current.axis === 'x' ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
      let dismiss =
        !cancelled &&
        directions.has(direction) &&
        (Math.abs(distance) >= SWIPE_THRESHOLD ||
          (Math.abs(distance) > 10 && Math.abs(distance) / elapsed > SWIPE_FLICK_VELOCITY))

      if (dismiss) {
        ctx.setSwiping(id, false, direction)
        ctx.manager.close(id)
        return
      }
      let swipe = ctx.swipe(id)
      swipe.movementX = 0
      swipe.movementY = 0
      if (node) setSwipeVars(node, 0, 0)
      ctx.setSwiping(id, false)
    }

    return (options, props) => {
      ;[options] = splitOptions(options, props)
      let toast = options?.toast ? (ctx?.get(options.toast.id) ?? options.toast) : undefined
      directions = normalizeDirections(options?.swipeDirection)
      if (!toast) return attrs({ role: 'dialog', 'aria-modal': 'false', tabIndex: 0 })

      let nextStatus = toast.transitionStatus
      if (nextStatus === 'ending' && status !== 'ending' && node) {
        cancelAnimationFrame(enterFrame)
        // Flush the current (open) style so the ending style transitions from it.
        void getComputedStyle(node).opacity
      }
      status = nextStatus
      id = toast.id

      if (!isServer()) {
        let current = toast
        handle.queueTask((target) => afterRender(target, current))
      }

      let expanded = ctx?.expanded ?? false
      let swipe = ctx?.swipe(toast.id)
      let starting = status === 'starting'

      return [
        attrs({
          role: toast.priority === 'high' ? 'alertdialog' : 'dialog',
          'aria-modal': 'false',
          'aria-labelledby': toast.title != null ? `${toast.id}-title` : undefined,
          'aria-describedby': toast.description != null ? `${toast.id}-description` : undefined,
          tabIndex: 0,
          inert: toast.limited ? true : undefined,
          'data-type': toast.type,
          'data-expanded': expanded ? '' : undefined,
          'data-limited': toast.limited ? '' : undefined,
          'data-swiping': swipe?.swiping ? '' : undefined,
          'data-swipe-direction': swipe?.direction,
          'data-starting-style': starting ? '' : undefined,
          'data-ending-style': status === 'ending' ? '' : undefined,
        }),
        on<HTMLElement, 'pointerdown'>('pointerdown', onPointerDown),
        on<HTMLElement, 'pointermove'>('pointermove', onPointerMove),
        on<HTMLElement, 'pointerup'>('pointerup', (event) => endGesture(event, false)),
        on<HTMLElement, 'pointercancel'>('pointercancel', (event) => endGesture(event, true)),
      ]
    }
  })

// Parts ------------------------------------------------------------------------------------------

function resolvePart(handle: MixinHandle<HTMLElement>, options: ToastPartOptions | undefined) {
  let ctx = getInternals(handle)
  let toast = options?.toast ? (ctx?.get(options.toast.id) ?? options.toast) : undefined
  return { ctx, toast }
}

function createLabelMixin(suffix: 'title' | 'description') {
  return createMixin<HTMLElement, [options?: ToastPartOptions], ElementProps>((handle) => {
    return (options, props) => {
      ;[options] = splitOptions(options, props)
      let { toast } = resolvePart(handle, options)
      return attrs({
        id: toast ? `${toast.id}-${suffix}` : undefined,
        'data-type': toast?.type,
      })
    }
  })
}

const titleMixin = createLabelMixin('title')
const descriptionMixin = createLabelMixin('description')

const contentMixin: MixinFactory<HTMLElement, [options?: ToastPartOptions], ElementProps> =
  createMixin<HTMLElement, [options?: ToastPartOptions], ElementProps>((handle) => {
    return (options, props) => {
      ;[options] = splitOptions(options, props)
      let { ctx, toast } = resolvePart(handle, options)
      let behind = toast && ctx ? ctx.layout(toast.id).index > 0 : false
      return attrs({
        'data-behind': behind ? '' : undefined,
        'data-expanded': ctx?.expanded ? '' : undefined,
      })
    }
  })

function createButtonMixin(kind: 'action' | 'close') {
  return createMixin<HTMLElement, [options?: ToastPartOptions], ElementProps>(
    (handle, hostType) => {
      let isButton = hostType === 'button'

      return (options, props) => {
        ;[options] = splitOptions(options, props)
        let { ctx, toast } = resolvePart(handle, options)

        function toastId(event: Event) {
          if (toast) return toast.id
          let target = event.currentTarget instanceof Element ? event.currentTarget : null
          return ctx?.idForNode(target)
        }

        let actionProps = kind === 'action' ? toast?.actionProps : undefined
        let { children: _children, onClick, ...actionAttrs } = actionProps ?? {}

        return [
          attrs({
            ...actionAttrs,
            type: isButton ? 'button' : undefined,
            role: isButton ? undefined : 'button',
            tabIndex: isButton ? undefined : 0,
            'data-type': toast?.type,
          }),
          on<HTMLElement, 'click'>('click', (event) => {
            if (kind === 'action') {
              if (onClick) onClick(event)
              else if (!toast) {
                // Without options, look the toast up from the DOM.
                let id = toastId(event)
                let found = id !== undefined ? ctx?.get(id) : undefined
                found?.actionProps?.onClick?.(event)
              }
              return
            }
            let id = toastId(event)
            if (id !== undefined) ctx?.manager.close(id)
          }),
          !isButton &&
            on<HTMLElement, 'keydown'>('keydown', (event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              ;(event.currentTarget as HTMLElement).click()
            }),
        ]
      }
    },
  )
}

const actionMixin = createButtonMixin('action')
const closeMixin = createButtonMixin('close')

/**
 * Provider that subscribes to a toast manager and owns timers, the `limit`, the expanded state,
 * and announcements. Props: `toastManager`, `timeout` (5000), `limit` (3). Read the toasts with
 * `handle.context.get(toast.Context).toasts` and render them in `toast.viewport()`.
 */
export const Context: (handle: Handle<ToastContextProps, ToastContextValue>) => () => RemixNode =
  ToastProvider

/**
 * The toast container: `role="region"`, `aria-label="Notifications"`, `tabIndex=-1`,
 * `data-expanded` while hovered or focused (timers pause), `--toast-frontmost-height`. F6 moves
 * focus into it and back.
 */
export const viewport = viewportMixin

/**
 * A toast: `role="dialog"` (`"alertdialog"` for `priority: 'high'`), labelled by its title and
 * description, `data-type`, `data-expanded`, `data-limited` (+ `inert`), `data-swiping`,
 * `data-swipe-direction`, `data-starting-style` / `data-ending-style`, and the `--toast-index`,
 * `--toast-offset-y`, `--toast-height`, `--toast-swipe-movement-x/y` CSS variables. Closed
 * toasts stay mounted until their exit animation finishes. Swipe to dismiss.
 */
export const root = rootMixin

/** Groups a toast's contents: `data-behind` (not frontmost) and `data-expanded`. */
export const content = contentMixin

/** Labels the toast (`id`, `data-type`). Render `{toast.title}` inside it. */
export const title: MixinFactory<HTMLElement, [options?: ToastPartOptions], ElementProps> =
  titleMixin

/** Describes the toast (`id`, `data-type`). Render `{toast.description}` inside it. */
export const description: MixinFactory<HTMLElement, [options?: ToastPartOptions], ElementProps> =
  descriptionMixin

/**
 * The action button: applies the toast's `actionProps` (`onClick` and attributes) and
 * `data-type`. Render `{toast.actionProps?.children}` inside it.
 */
export const action: MixinFactory<HTMLElement, [options?: ToastPartOptions], ElementProps> =
  actionMixin

/** Closes the toast when clicked. Give it an accessible name (`aria-label="Close"`). */
export const close: MixinFactory<HTMLElement, [options?: ToastPartOptions], ElementProps> =
  closeMixin
