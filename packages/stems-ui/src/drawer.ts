import { attrs, createElement, createMixin, on } from '@remix-run/component'
import type {
  Dispatched,
  ElementProps,
  Handle,
  MixinFactory,
  MixinHandle,
  RemixNode,
} from '@remix-run/component'

import { splitOptions } from './lib/collapsible-panel.ts'
import {
  backdropMixin,
  closeMixin,
  descriptionMixin,
  DialogRoot,
  getDialogRoot,
  mergeStyle,
  popupMixin,
  titleMixin,
  triggerMixin,
  type DialogBackdropOptions,
  type DialogChangeReason,
  type DialogCloseOptions,
  type DialogPopupOptions,
  type DialogRootContextValue,
  type DialogRootProps,
  type DialogTriggerOptions,
} from './lib/dialog-root.ts'
import {
  createSwipeTracker,
  shouldDismiss,
  SWIPE_START_THRESHOLD,
  swipeAxis,
  swipeMovement,
  swipeMovementVars,
  swipeProgress,
  swipeStrength,
  type SwipeDirection,
  type SwipeTracker,
} from './lib/swipe.ts'

export type {
  DialogActions as DrawerActions,
  DialogBackdropOptions as DrawerBackdropOptions,
  DialogChangeDetails as DrawerChangeDetails,
  DialogChangeReason as DrawerChangeReason,
  DialogCloseOptions as DrawerCloseOptions,
  DialogFocusTarget as DrawerFocusTarget,
  DialogInteractionType as DrawerInteractionType,
  DialogModal as DrawerModal,
  DialogPopupOptions as DrawerPopupOptions,
  DialogTriggerOptions as DrawerTriggerOptions,
} from './lib/dialog-root.ts'

export type DrawerSwipeDirection = SwipeDirection

const DRAWER_CHANGE_EVENT = 'stems:drawer-change' as const

declare global {
  interface HTMLElementEventMap {
    [DRAWER_CHANGE_EVENT]: DrawerChangeEvent
  }
}

/** Bubbling event dispatched from the popup when a drawer opens or closes. */
export class DrawerChangeEvent extends Event {
  readonly open: boolean
  readonly reason: DialogChangeReason

  constructor(open: boolean, reason: DialogChangeReason) {
    super(DRAWER_CHANGE_EVENT, { bubbles: true })
    this.open = open
    this.reason = reason
  }
}

export interface DrawerContextProps extends DialogRootProps {
  /**
   * The direction a swipe dismisses the drawer in. Position the popup with CSS to match:
   * `'down'` for a bottom sheet, `'right'` for a panel on the right edge, and so on.
   * @default 'down'
   */
  swipeDirection?: DrawerSwipeDirection
}

interface DrawerContextValue {
  readonly swipeDirection: DrawerSwipeDirection
  readonly swiping: boolean
  readonly swipeDismissed: boolean
  /** Whether a drawer nested in this one is being swiped. */
  readonly nestedSwiping: boolean
  readonly parent: DrawerContextValue | null
  readonly root: DialogRootContextValue | null
  readonly indent: DrawerIndentContextValue | null
  readonly id: string
  readonly children: Set<DrawerContextValue>
  _bindRoot(root: DialogRootContextValue): void
  _setSwiping(swiping: boolean): void
  _setSwipeDismissed(dismissed: boolean): void
  _setNestedSwiping(swiping: boolean): void
  _register(kind: 'backdrop' | 'content', node: HTMLElement, signal: AbortSignal): void
  _nodes(kind: 'backdrop' | 'content'): Set<HTMLElement>
}

function createChangeEvent(open: boolean, reason: DialogChangeReason) {
  return new DrawerChangeEvent(open, reason)
}

function DrawerProvider(handle: Handle<DrawerContextProps, DrawerContextValue>): () => RemixNode {
  let parent = (handle.context.get(DrawerProvider) as DrawerContextValue | undefined) ?? null
  let indent =
    (handle.context.get(DrawerIndentProvider) as DrawerIndentContextValue | undefined) ?? null
  let signal = handle.signal
  let root: DialogRootContextValue | null = null
  let swiping = false
  let swipeDismissed = false
  let nestedSwiping = false
  let nodes = { backdrop: new Set<HTMLElement>(), content: new Set<HTMLElement>() }

  let drawer: DrawerContextValue = {
    get swipeDirection() {
      return handle.props.swipeDirection ?? 'down'
    },
    get swiping() {
      return swiping
    },
    get swipeDismissed() {
      return swipeDismissed
    },
    get nestedSwiping() {
      return nestedSwiping
    },
    parent,
    get root() {
      return root
    },
    indent,
    id: handle.id,
    children: new Set(),
    _bindRoot(next) {
      root = next
    },
    _setSwiping(next) {
      if (swiping === next) return
      swiping = next
      parent?._setNestedSwiping(next)
    },
    _setSwipeDismissed(next) {
      swipeDismissed = next
    },
    _setNestedSwiping(next) {
      if (nestedSwiping === next) return
      nestedSwiping = next
      void root?.update()
    },
    _register(kind, node, nodeSignal) {
      nodes[kind].add(node)
      nodeSignal.addEventListener('abort', () => nodes[kind].delete(node), { once: true })
    },
    _nodes(kind) {
      return nodes[kind]
    },
  }

  parent?.children.add(drawer)
  signal.addEventListener('abort', () => {
    parent?.children.delete(drawer)
    indent?._setOpen(drawer.id, false)
  })
  handle.context.set(drawer)

  return () => {
    let { children, swipeDirection: _swipeDirection, ...props } = handle.props
    return createElement(
      DialogRoot,
      { ...props, _kind: 'drawer', _createEvent: createChangeEvent },
      children,
    )
  }
}

function getDrawer(handle: MixinHandle<any>): DrawerContextValue {
  return handle.context.get(DrawerProvider) as DrawerContextValue
}

// ---------------------------------------------------------------------------------------------
// Provider + Indent: app-level "a drawer is open" state.

interface DrawerIndentContextValue {
  readonly active: boolean
  _setOpen(id: string, open: boolean): void
  _register(node: HTMLElement, signal: AbortSignal): void
  _setProgress(progress: string): void
}

export interface DrawerProviderProps {
  children?: RemixNode
}

function DrawerIndentProvider(
  handle: Handle<DrawerProviderProps, DrawerIndentContextValue>,
): () => RemixNode {
  let open = new Set<string>()
  let nodes = new Set<HTMLElement>()

  handle.context.set({
    get active() {
      return open.size > 0
    },
    _setOpen(id, next) {
      let had = open.has(id)
      if (had === next) return
      if (next) open.add(id)
      else open.delete(id)
      if (!handle.signal.aborted) void handle.update()
    },
    _register(node, nodeSignal) {
      nodes.add(node)
      nodeSignal.addEventListener('abort', () => nodes.delete(node), { once: true })
    },
    _setProgress(progress) {
      for (let node of nodes) node.style.setProperty('--drawer-swipe-progress', progress)
    },
  })

  return () => handle.props.children
}

function createIndentMixin() {
  return createMixin<HTMLElement, [], ElementProps>((handle) => {
    let indent =
      (handle.context.get(DrawerIndentProvider) as DrawerIndentContextValue | undefined) ?? null
    let signal = handle.signal

    handle.addEventListener('insert', (event) => {
      indent?._register(event.node, signal)
    })

    return () => [
      attrs({ 'data-active': indent?.active ? '' : undefined }),
      mergeStyle({ '--drawer-swipe-progress': '0' }),
    ]
  })
}

// ---------------------------------------------------------------------------------------------
// Popup with swipe-to-dismiss

const IGNORED_TARGETS =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [data-swipe-ignore]'

/** Whether `target` sits in a scroll container that would scroll instead of swiping. */
function scrollsFirst(target: Element, popup: HTMLElement, direction: SwipeDirection): boolean {
  let axis = swipeAxis(direction)
  for (let node: Element | null = target; node && node !== popup; node = node.parentElement) {
    if (!(node instanceof HTMLElement)) continue
    let style = getComputedStyle(node)
    let overflow = axis === 'y' ? style.overflowY : style.overflowX
    if (overflow !== 'auto' && overflow !== 'scroll') continue
    let scroll = axis === 'y' ? node.scrollTop : node.scrollLeft
    let max =
      axis === 'y' ? node.scrollHeight - node.clientHeight : node.scrollWidth - node.clientWidth
    if (max <= 0) continue
    // Swiping down/right scrolls toward the start; up/left toward the end.
    let towardStart = direction === 'down' || direction === 'right'
    if (towardStart ? scroll > 0 : scroll < max - 1) return true
  }
  return false
}

const drawerPopupMixin = createMixin<
  HTMLDialogElement,
  [options?: DialogPopupOptions],
  ElementProps
>((handle) => {
  let drawer = getDrawer(handle)
  let store = getDialogRoot(handle)
  drawer._bindRoot(store)
  let node: HTMLDialogElement | null = null
  let tracker: SwipeTracker | null = null
  let pointerId: number | null = null
  let swiping = false
  let size = 0
  let suppressClick = false
  let lastOpen: boolean | undefined

  function onClickCapture(event: MouseEvent) {
    if (!suppressClick) return
    suppressClick = false
    event.preventDefault()
    event.stopPropagation()
  }

  handle.addEventListener('insert', (event) => {
    node = event.node
    node.addEventListener('click', onClickCapture, true)
  })

  handle.addEventListener('remove', () => {
    node?.removeEventListener('click', onClickCapture, true)
    node = null
  })

  function setProgress(progress: number) {
    let value = String(Math.round(progress * 1000) / 1000)
    node?.style.setProperty('--drawer-swipe-progress', value)
    for (let backdrop of drawer._nodes('backdrop')) {
      backdrop.style.setProperty('--drawer-swipe-progress', value)
    }
    // Drawers behind this one read the frontmost drawer's progress to un-stack while it moves.
    for (let ancestor = drawer.parent; ancestor; ancestor = ancestor.parent) {
      ancestor.root?.popupNode?.style.setProperty('--drawer-swipe-progress', value)
    }
    if (!drawer.parent) drawer.indent?._setProgress(value)
  }

  function setMovement(movement: number) {
    if (!node) return
    let vars = swipeMovementVars(drawer.swipeDirection, movement)
    node.style.setProperty('--drawer-swipe-movement-x', vars.x)
    node.style.setProperty('--drawer-swipe-movement-y', vars.y)
  }

  function resetSwipe() {
    setMovement(0)
    setProgress(0)
    node?.style.setProperty('--drawer-swipe-strength', '1')
  }

  function endGesture() {
    if (node && pointerId !== null && node.hasPointerCapture?.(pointerId)) {
      node.releasePointerCapture(pointerId)
    }
    tracker = null
    pointerId = null
    if (swiping) {
      swiping = false
      drawer._setSwiping(false)
    }
  }

  function onPointerDown(event: PointerEvent) {
    suppressClick = false
    if (!store.open || tracker || !node) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    let target = event.target
    if (!(target instanceof Element)) return

    let ignored = target.closest(IGNORED_TARGETS)
    if (ignored && node.contains(ignored)) {
      let axis = ignored.getAttribute('data-swipe-ignore')
      let axisOnly = axis === 'x' || axis === 'y'
      if (!axisOnly || event.pointerType !== 'touch' || axis === swipeAxis(drawer.swipeDirection)) {
        return
      }
    }
    if (event.pointerType === 'mouse') {
      for (let content of drawer._nodes('content')) if (content.contains(target)) return
    }

    tracker = createSwipeTracker(
      drawer.swipeDirection,
      event.clientX,
      event.clientY,
      event.timeStamp,
    )
    pointerId = event.pointerId
  }

  function onPointerMove(event: PointerEvent) {
    if (!tracker || event.pointerId !== pointerId || !node) return
    tracker.move(event.clientX, event.clientY, event.timeStamp)

    if (!swiping) {
      let distance = Math.abs(tracker.delta)
      if (distance < SWIPE_START_THRESHOLD && tracker.cross < SWIPE_START_THRESHOLD) return
      // Mostly sideways, or a scroll container should scroll: not a swipe.
      if (tracker.cross > distance) {
        endGesture()
        return
      }
      let target = event.target instanceof Element ? event.target : node
      if (tracker.delta > 0 && scrollsFirst(target, node, drawer.swipeDirection)) {
        endGesture()
        return
      }
      swiping = true
      let axis = swipeAxis(drawer.swipeDirection)
      size = axis === 'y' ? node.offsetHeight : node.offsetWidth
      try {
        node.setPointerCapture(event.pointerId)
      } catch {
        // Synthetic or already-released pointers can't be captured.
      }
      drawer._setSwiping(true)
      void store.update()
    }

    event.preventDefault()
    let movement = swipeMovement(tracker.delta)
    setMovement(movement)
    setProgress(swipeProgress(movement, size))
  }

  function onPointerUp(event: PointerEvent) {
    if (!tracker || event.pointerId !== pointerId) return
    let current = tracker
    let wasSwiping = swiping
    tracker.move(event.clientX, event.clientY, event.timeStamp)
    endGesture()
    if (!wasSwiping) return

    suppressClick = true
    let movement = swipeMovement(current.delta)
    let velocity = current.velocity(event.timeStamp)

    if (shouldDismiss(movement, size, velocity)) {
      node?.style.setProperty(
        '--drawer-swipe-strength',
        String(Math.round(swipeStrength(movement, size, velocity) * 1000) / 1000),
      )
      drawer._setSwipeDismissed(true)
      if (store.setOpen(false, 'swipe', event)) {
        void store.update()
        return
      }
      drawer._setSwipeDismissed(false)
    }
    resetSwipe()
    void store.update()
  }

  function onPointerCancel(event: PointerEvent) {
    if (event.pointerId !== pointerId) return
    let wasSwiping = swiping
    endGesture()
    if (wasSwiping) {
      resetSwipe()
      void store.update()
    }
  }

  return (options, props) => {
    ;[options] = splitOptions(options, props)
    let open = store.open
    let direction = drawer.swipeDirection

    if (open !== lastOpen) {
      let opening = open && lastOpen === false
      handle.queueTask(() => {
        if (opening) {
          drawer._setSwipeDismissed(false)
          resetSwipe()
        }
        if (!drawer.parent) drawer.indent?._setOpen(drawer.id, open)
        requestAnimationFrame(() => refreshStack(drawer))
      })
    }
    lastOpen = open

    let nestedDrawers = store.nestedOpenCount('drawer')

    return [
      popupMixin(options),
      attrs({
        'data-swipe-direction': direction,
        'data-swiping': drawer.swiping ? '' : undefined,
        'data-swipe-dismiss': drawer.swipeDismissed ? '' : undefined,
        'data-nested-drawer-open': nestedDrawers > 0 ? '' : undefined,
        'data-nested-drawer-swiping': drawer.nestedSwiping ? '' : undefined,
      }),
      mergeStyle({
        '--nested-drawers': String(nestedDrawers),
        '--drawer-swipe-movement-x': '0px',
        '--drawer-swipe-movement-y': '0px',
        '--drawer-swipe-progress': '0',
        '--drawer-swipe-strength': '1',
        '--drawer-snap-point-offset': '0px',
        // Let the drawer own drags along its swipe axis; nested scroll containers still scroll.
        touchAction: swipeAxis(direction) === 'y' ? 'pan-x' : 'pan-y',
      }),
      on<HTMLDialogElement, 'pointerdown'>('pointerdown', onPointerDown),
      on<HTMLDialogElement, 'pointermove'>('pointermove', onPointerMove),
      on<HTMLDialogElement, 'pointerup'>('pointerup', onPointerUp),
      on<HTMLDialogElement, 'pointercancel'>('pointercancel', onPointerCancel),
    ]
  }
})

/**
 * Writes `--drawer-frontmost-height` (the frontmost open drawer's height) on every drawer
 * behind it in the nested stack, so collapsed drawers can match it.
 */
function refreshStack(drawer: DrawerContextValue) {
  let top = drawer
  while (top.parent) top = top.parent
  let chain: DrawerContextValue[] = []
  for (let current: DrawerContextValue | undefined = top; current;) {
    if (!current.root?.open) break
    chain.push(current)
    current = [...current.children].find((child) => child.root?.open)
  }
  let frontmost = chain.at(-1)
  let height = frontmost?.root?.popupNode?.offsetHeight
  for (let entry of [top, ...collectDescendants(top)]) {
    let popup = entry.root?.popupNode
    if (!popup) continue
    if (entry !== frontmost && chain.includes(entry) && height !== undefined) {
      popup.style.setProperty('--drawer-frontmost-height', `${height}px`)
    } else {
      popup.style.removeProperty('--drawer-frontmost-height')
    }
  }
}

function collectDescendants(drawer: DrawerContextValue): DrawerContextValue[] {
  let result: DrawerContextValue[] = []
  for (let child of drawer.children) result.push(child, ...collectDescendants(child))
  return result
}

const drawerBackdropMixin = createMixin<
  HTMLElement,
  [options?: DialogBackdropOptions],
  ElementProps
>((handle) => {
  let drawer = getDrawer(handle)
  let signal = handle.signal

  handle.addEventListener('insert', (event) => {
    drawer._register('backdrop', event.node, signal)
  })

  return (options, props) => {
    ;[options] = splitOptions(options, props)
    return [backdropMixin(options), mergeStyle({ '--drawer-swipe-progress': '0' })]
  }
})

const contentMixin = createMixin<HTMLElement, [], ElementProps>((handle) => {
  let drawer = getDrawer(handle)
  let signal = handle.signal
  handle.addEventListener('insert', (event) => {
    drawer._register('content', event.node, signal)
  })
})

/**
 * Provider that owns the open state: the dialog props (`open` / `defaultOpen` /
 * `onOpenChange` / `onOpenChangeComplete`, `modal`, `disablePointerDismissal`, `actionsRef`)
 * plus `swipeDirection`.
 */
export const Context: (handle: Handle<DrawerContextProps>) => () => RemixNode =
  DrawerProvider as unknown as (handle: Handle<DrawerContextProps>) => () => RemixNode

/**
 * Optional app-level provider: `indent()` / `indentBackground()` parts inside it get
 * `data-active` while any drawer in it is open.
 */
export const Provider: (handle: Handle<DrawerProviderProps>) => () => RemixNode =
  DrawerIndentProvider as unknown as (handle: Handle<DrawerProviderProps>) => () => RemixNode

/** The button that opens the drawer. Same contract as `dialog.trigger()`. */
export const trigger: MixinFactory<HTMLElement, [options?: DialogTriggerOptions], ElementProps> =
  triggerMixin

/**
 * The `<dialog>` element: everything `dialog.popup()` does, plus swipe-to-dismiss with pointer
 * events. `data-swipe-direction`, `data-swiping`, `data-swipe-dismiss`,
 * `data-nested-drawer-open`, `data-nested-drawer-swiping`, and the `--drawer-swipe-*`,
 * `--nested-drawers`, `--drawer-frontmost-height` CSS variables.
 */
export const popup: MixinFactory<HTMLDialogElement, [options?: DialogPopupOptions], ElementProps> =
  drawerPopupMixin

/** Optional separate backdrop element, with `--drawer-swipe-progress`. */
export const backdrop: MixinFactory<HTMLElement, [options?: DialogBackdropOptions], ElementProps> =
  drawerBackdropMixin

/** A region where mouse drags select text instead of swiping. */
export const content: MixinFactory<HTMLElement, [], ElementProps> = contentMixin

/** Labels the popup (`aria-labelledby`). */
export const title: MixinFactory<HTMLElement, [], ElementProps> = titleMixin

/** Describes the popup (`aria-describedby`). */
export const description: MixinFactory<HTMLElement, [], ElementProps> = descriptionMixin

/** A button that closes the drawer (reason `'close-press'`). */
export const close: MixinFactory<HTMLElement, [options?: DialogCloseOptions], ElementProps> =
  closeMixin

/** Wraps the app's main UI; `data-active` while any drawer in `drawer.Provider` is open. */
export const indent: MixinFactory<HTMLElement, [], ElementProps> = createIndentMixin()

/** A background layer placed before `indent()`; `data-active` while any drawer is open. */
export const indentBackground: MixinFactory<HTMLElement, [], ElementProps> = createIndentMixin()

/** Listens for the bubbling `stems:drawer-change` event. */
export function onDrawerChange<target extends HTMLElement>(
  handler: (
    event: Dispatched<DrawerChangeEvent, target>,
    signal: AbortSignal,
  ) => void | Promise<void>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof DRAWER_CHANGE_EVENT>> {
  return on(DRAWER_CHANGE_EVENT, handler, captureBoolean)
}
