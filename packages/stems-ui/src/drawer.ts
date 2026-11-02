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
  createDialogHandle,
  descriptionMixin,
  DialogRoot,
  getDialogRoot,
  mergeStyle,
  popupMixin,
  titleMixin,
  triggerMixin,
  type DialogBackdropOptions,
  type DialogChangeDetails as DrawerChangeDetails,
  type DialogChangeReason,
  type DialogCloseOptions,
  type DialogHandle,
  type DialogPopupOptions,
  type DialogRootContextValue,
  type DialogRootProps,
  type DialogTriggerOptions,
} from './lib/dialog-root.ts'
import {
  createSwipeTracker,
  findSnapPoint,
  oppositeDirection,
  resolveSnapPoints,
  resolveSnapRelease,
  shouldDismiss,
  snapMovement,
  snapProgress,
  SWIPE_START_THRESHOLD,
  swipeAxis,
  swipeMovement,
  swipeMovementVars,
  swipeProgress,
  swipeStrength,
  type ResolvedSnapPoint,
  type SnapPoint,
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
  DialogHandle as DrawerHandle,
} from './lib/dialog-root.ts'
export type { PopupPayloadState as DrawerPayloadState } from './lib/popup-handle.ts'

/**
 * Creates a handle for triggers rendered outside the `Context` (Base UI's
 * `Drawer.createHandle()`): pass it to `<drawer.Context handle>` and `drawer.trigger({ handle,
 * payload })`. `isOpen`, `open(triggerId?)`, `openWithPayload(payload)`, `close()`. `children`
 * of the `Context` may be a function of `{ payload }`.
 */
export const createHandle: <Payload = unknown>() => DialogHandle<Payload> = createDialogHandle

export type DrawerSwipeDirection = SwipeDirection

/**
 * A snap point: a number from 0 to 1 is a fraction of the viewport height, a number above 1 is a
 * pixel height, and a string is a `px` or `rem` height (`'148px'`, `'30rem'`).
 */
export type DrawerSnapPoint = SnapPoint

export interface DrawerSnapPointChangeDetails {
  /** Why the snap point changed: `'swipe'`, or the close reason when closing resets it. */
  readonly reason: DialogChangeReason
  /** The DOM event behind the change, when there is one. */
  readonly event: Event | undefined
  /** Keeps the current snap point: the change is not applied and no event is dispatched. */
  cancel(): void
  readonly isCanceled: boolean
}

const DRAWER_CHANGE_EVENT = 'stems:drawer-change' as const
const DRAWER_SNAP_POINT_CHANGE_EVENT = 'stems:drawer-snap-point-change' as const

declare global {
  interface HTMLElementEventMap {
    [DRAWER_CHANGE_EVENT]: DrawerChangeEvent
    [DRAWER_SNAP_POINT_CHANGE_EVENT]: DrawerSnapPointChangeEvent
  }
}

/** Bubbling event dispatched from the popup when the active snap point changes. */
export class DrawerSnapPointChangeEvent extends Event {
  readonly snapPoint: DrawerSnapPoint | null
  readonly reason: DialogChangeReason

  constructor(snapPoint: DrawerSnapPoint | null, reason: DialogChangeReason) {
    super(DRAWER_SNAP_POINT_CHANGE_EVENT, { bubbles: true })
    this.snapPoint = snapPoint
    this.reason = reason
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
  /**
   * Heights a bottom (`'down'`) or top (`'up'`) sheet rests at. Numbers from 0 to 1 are
   * fractions of the viewport height, numbers above 1 are pixels, strings are `px` or `rem`
   * (`['148px', 1]`). Ignored for horizontal drawers.
   */
  snapPoints?: DrawerSnapPoint[]
  /** The active snap point (controlled). `null` means none. */
  snapPoint?: DrawerSnapPoint | null
  /**
   * The initial snap point (uncontrolled). The drawer also returns to it when it closes.
   * @default snapPoints[0]
   */
  defaultSnapPoint?: DrawerSnapPoint | null
  /** Called before the active snap point changes. Call `details.cancel()` to keep it. */
  onSnapPointChange?: (
    snapPoint: DrawerSnapPoint | null,
    details: DrawerSnapPointChangeDetails,
  ) => void
  /**
   * Disables velocity-based snap skipping, so the drag distance picks the next snap point.
   * @default false
   */
  snapToSequentialPoints?: boolean
}

/** What a popup exposes to the swipe area and the provider. */
interface DrawerPopupController {
  /** The popup's size along the swipe axis while it's shown, else 0. */
  size(): number
  /** Positions the popup for a swipe-area drag of `displacement` px in the open direction. */
  areaDrag(displacement: number): void
  /** Ends a swipe-area drag: the popup animates to its resting position. */
  areaEnd(): void
}

interface DrawerContextValue {
  readonly swipeDirection: DrawerSwipeDirection
  readonly snapPoints: readonly DrawerSnapPoint[]
  readonly activeSnapPoint: DrawerSnapPoint | null
  readonly snapToSequentialPoints: boolean
  /** Whether a `swipeArea()` drag is opening this drawer. */
  readonly areaSwiping: boolean
  readonly popup: DrawerPopupController | null
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
  /** Requests a snap point change; returns whether it was applied (or already active). */
  _setSnapPoint(
    snapPoint: DrawerSnapPoint | null,
    reason: DialogChangeReason,
    event?: Event,
  ): boolean
  _setAreaSwiping(swiping: boolean): void
  _setPopup(popup: DrawerPopupController | null): void
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
  let areaSwiping = false
  let popup: DrawerPopupController | null = null
  let nodes = { backdrop: new Set<HTMLElement>(), content: new Set<HTMLElement>() }

  function snapPoints(): readonly DrawerSnapPoint[] {
    return handle.props.snapPoints ?? []
  }

  function defaultSnapPoint(): DrawerSnapPoint | null {
    let { defaultSnapPoint } = handle.props
    return defaultSnapPoint !== undefined ? defaultSnapPoint : (snapPoints()[0] ?? null)
  }

  let uncontrolledSnapPoint = defaultSnapPoint()

  function activeSnapPoint(): DrawerSnapPoint | null {
    let { snapPoint } = handle.props
    if (snapPoint !== undefined) return snapPoint
    let points = snapPoints()
    if (points.length === 0) return uncontrolledSnapPoint
    // Uncontrolled: anything that isn't one of the points (such as `null` after a swipe
    // dismissal) falls back to the default.
    if (uncontrolledSnapPoint === null) return defaultSnapPoint()
    if (!points.some((point) => Object.is(point, uncontrolledSnapPoint))) return defaultSnapPoint()
    return uncontrolledSnapPoint
  }

  let drawer: DrawerContextValue = {
    get swipeDirection() {
      return handle.props.swipeDirection ?? 'down'
    },
    get snapPoints() {
      return snapPoints()
    },
    get activeSnapPoint() {
      return activeSnapPoint()
    },
    get snapToSequentialPoints() {
      return handle.props.snapToSequentialPoints ?? false
    },
    get areaSwiping() {
      return areaSwiping
    },
    get popup() {
      return popup
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
    _setSnapPoint(next, reason, event) {
      let { snapPoint } = handle.props
      let current = snapPoint !== undefined ? snapPoint : uncontrolledSnapPoint
      if (Object.is(next, current)) return true
      let canceled = false
      let details: DrawerSnapPointChangeDetails = {
        reason,
        event,
        cancel() {
          canceled = true
        },
        get isCanceled() {
          return canceled
        },
      }
      handle.props.onSnapPointChange?.(next, details)
      if (canceled) return false
      if (handle.props.snapPoint === undefined) uncontrolledSnapPoint = next
      root?.popupNode?.dispatchEvent(new DrawerSnapPointChangeEvent(next, reason))
      void root?.update()
      return true
    },
    _setAreaSwiping(next) {
      if (areaSwiping === next) return
      areaSwiping = next
      drawer._setSwiping(next)
    },
    _setPopup(next) {
      popup = next
    },
  }

  function onOpenChange(open: boolean, details: DrawerChangeDetails) {
    handle.props.onOpenChange?.(open, details)
    // Closing returns the drawer to its default snap point (Base UI resets it the same way).
    if (open || details.isCanceled || snapPoints().length === 0) return
    drawer._setSnapPoint(defaultSnapPoint(), details.reason, details.event)
  }

  parent?.children.add(drawer)
  signal.addEventListener('abort', () => {
    parent?.children.delete(drawer)
    indent?._setOpen(drawer.id, false)
  })
  handle.context.set(drawer)

  return () => {
    let {
      children,
      swipeDirection: _swipeDirection,
      snapPoints: _snapPoints,
      snapPoint: _snapPoint,
      defaultSnapPoint: _defaultSnapPoint,
      onSnapPointChange: _onSnapPointChange,
      snapToSequentialPoints: _snapToSequentialPoints,
      ...props
    } = handle.props
    return createElement(
      DialogRoot,
      // `children` may be a payload render function, which `createElement` rejects as a child.
      {
        ...props,
        _children: children,
        onOpenChange,
        _kind: 'drawer',
        _createEvent: createChangeEvent,
      },
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
  let signal = handle.signal
  let node: HTMLDialogElement | null = null
  let tracker: SwipeTracker | null = null
  let pointerId: number | null = null
  let swiping = false
  let size = 0
  /** The snap offset the current drag started from, or `null` without snap points. */
  let dragBase: number | null = null
  let suppressClick = false
  let lastOpen: boolean | undefined
  // Measurements for snap points and `--drawer-height`, taken while the popup is shown.
  let popupHeight = 0
  let viewportHeight = 0
  let rootFontSize = 16
  let resizeObserver: ResizeObserver | null = null
  // Swipe-area drags.
  let areaDisplacement = 0
  let areaClosedOffset: number | null = null

  function onClickCapture(event: MouseEvent) {
    if (!suppressClick) return
    suppressClick = false
    event.preventDefault()
    event.stopPropagation()
  }

  function onWindowResize() {
    measure()
  }

  handle.addEventListener('insert', (event) => {
    node = event.node
    node.addEventListener('click', onClickCapture, true)
    let win = node.ownerDocument.defaultView
    win?.addEventListener('resize', onWindowResize)
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(() => measure())
      resizeObserver.observe(node)
    }
  })

  handle.addEventListener('remove', () => {
    node?.removeEventListener('click', onClickCapture, true)
    node?.ownerDocument.defaultView?.removeEventListener('resize', onWindowResize)
    resizeObserver?.disconnect()
    resizeObserver = null
    node = null
  })

  let controller: DrawerPopupController = {
    size() {
      if (!node?.open) return 0
      return swipeAxis(drawer.swipeDirection) === 'y' ? node.offsetHeight : node.offsetWidth
    },
    areaDrag(displacement) {
      areaDisplacement = displacement
      let current = controller.size()
      if (!node || current <= 0) return
      if (areaClosedOffset === null) areaClosedOffset = current - (snapOffset() ?? 0)
      let closed = Math.max(1, areaClosedOffset)
      let distance = Math.max(0, displacement)
      let damped = distance > closed ? closed + Math.sqrt(distance - closed) : distance
      setMovement(closed - damped)
      setProgress(1 - Math.min(1, distance / closed))
    },
    areaEnd() {
      areaDisplacement = 0
      areaClosedOffset = null
      measure()
      applyRest()
    },
  }
  drawer._setPopup(controller)
  signal.addEventListener('abort', () => {
    if (drawer.popup === controller) drawer._setPopup(null)
  })

  // -------------------------------------------------------------------------------------------
  // Snap points

  /** Whether snap points apply: a vertical drawer with at least one snap point. */
  function snapMode() {
    return drawer.snapPoints.length > 0 && swipeAxis(drawer.swipeDirection) === 'y'
  }

  function resolved(): ResolvedSnapPoint[] {
    if (!snapMode()) return []
    return resolveSnapPoints(drawer.snapPoints, popupHeight, viewportHeight, rootFontSize)
  }

  function activePoint(points = resolved()): ResolvedSnapPoint | undefined {
    return findSnapPoint(points, drawer.activeSnapPoint, popupHeight, viewportHeight, rootFontSize)
  }

  /** The active snap point's offset toward the closed position, or `null` when there's none. */
  function snapOffset(): number | null {
    return activePoint()?.offset ?? null
  }

  /** `--drawer-snap-point-offset`: the offset as a signed screen distance. */
  function snapOffsetVar(): string {
    let offset = snapOffset()
    if (offset === null) return '0px'
    let signed = drawer.swipeDirection === 'up' ? -offset : offset
    return `${Math.round(signed * 100) / 100}px`
  }

  /** `--drawer-swipe-progress` while resting on the active snap point. */
  function restProgress(): number {
    let points = resolved()
    let point = activePoint(points)
    if (!point) return 0
    return snapProgress(points, point.offset) ?? 0
  }

  function measure() {
    if (!node || !node.open || !store.open || swiping || drawer.areaSwiping) return
    // A nested drawer may collapse this one to the stack height; keep the resting size.
    if (store.nestedOpenCount('drawer') > 0 && popupHeight > 0) return
    let doc = node.ownerDocument
    let html = doc.documentElement
    let nextHeight = node.offsetHeight
    let nextViewport = html.clientHeight
    let fontSize = Number.parseFloat(getComputedStyle(html).fontSize)
    let nextFont = Number.isFinite(fontSize) ? fontSize : 16
    if (nextHeight <= 0) return
    if (
      nextHeight === popupHeight &&
      nextViewport === viewportHeight &&
      nextFont === rootFontSize
    ) {
      return
    }
    popupHeight = nextHeight
    viewportHeight = nextViewport
    rootFontSize = nextFont
    if (snapMode()) {
      node.style.setProperty('--drawer-snap-point-offset', snapOffsetVar())
      applyRest()
      void store.update()
    }
  }

  // -------------------------------------------------------------------------------------------
  // Swipe styles

  function setProgress(progress: number, shared = progress) {
    let value = String(Math.round(progress * 1000) / 1000)
    let sharedValue = String(Math.round(shared * 1000) / 1000)
    node?.style.setProperty('--drawer-swipe-progress', value)
    for (let backdrop of drawer._nodes('backdrop')) {
      backdrop.style.setProperty('--drawer-swipe-progress', value)
    }
    // Drawers behind this one read the frontmost drawer's progress to un-stack while it moves.
    for (let ancestor = drawer.parent; ancestor; ancestor = ancestor.parent) {
      ancestor.root?.popupNode?.style.setProperty('--drawer-swipe-progress', sharedValue)
    }
    if (!drawer.parent) drawer.indent?._setProgress(sharedValue)
  }

  function setMovement(movement: number) {
    if (!node) return
    let vars = swipeMovementVars(drawer.swipeDirection, movement)
    node.style.setProperty('--drawer-swipe-movement-x', vars.x)
    node.style.setProperty('--drawer-swipe-movement-y', vars.y)
  }

  /** Resets the swipe variables to the resting position (the active snap point, if any). */
  function applyRest() {
    setMovement(0)
    // At rest only this drawer reflects its snap point; parents follow active drags only.
    setProgress(restProgress(), 0)
    if (node && snapMode()) node.style.setProperty('--drawer-snap-point-offset', snapOffsetVar())
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
    if (!store.open || tracker || !node || drawer.areaSwiping) return
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
      dragBase = resolved().length > 0 ? (snapOffset() ?? 0) : null
      let target = event.target instanceof Element ? event.target : node
      let direction = drawer.swipeDirection
      if (tracker.delta > 0 && scrollsFirst(target, node, direction)) {
        endGesture()
        return
      }
      // Dragging toward "more open" scrolls content first once the drawer is fully open.
      if (
        tracker.delta < 0 &&
        (dragBase ?? 0) <= 0 &&
        scrollsFirst(target, node, oppositeDirection(direction))
      ) {
        endGesture()
        return
      }
      swiping = true
      let axis = swipeAxis(direction)
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
    if (dragBase !== null) {
      let movement = snapMovement(dragBase, tracker.delta)
      setMovement(movement)
      let points = resolved()
      let offset = Math.min(popupHeight, Math.max(0, dragBase + tracker.delta))
      let progress = snapProgress(points, offset)
      setProgress(progress ?? swipeProgress(movement, size - dragBase))
      return
    }
    let movement = swipeMovement(tracker.delta)
    setMovement(movement)
    setProgress(swipeProgress(movement, size))
  }

  function dismiss(event: PointerEvent, movement: number, distance: number, velocity: number) {
    node?.style.setProperty(
      '--drawer-swipe-strength',
      String(Math.round(swipeStrength(movement, distance, velocity) * 1000) / 1000),
    )
    drawer._setSwipeDismissed(true)
    if (store.setOpen(false, 'swipe', event)) {
      void store.update()
      return true
    }
    drawer._setSwipeDismissed(false)
    return false
  }

  function onPointerUp(event: PointerEvent) {
    if (!tracker || event.pointerId !== pointerId) return
    let current = tracker
    let wasSwiping = swiping
    let base = dragBase
    tracker.move(event.clientX, event.clientY, event.timeStamp)
    endGesture()
    dragBase = null
    if (!wasSwiping) return

    suppressClick = true
    let velocity = current.velocity(event.timeStamp)
    let points = resolved()

    if (base !== null && points.length > 0) {
      let release = resolveSnapRelease({
        points,
        currentOffset: base,
        delta: current.delta,
        velocity,
        popupHeight,
        sequential: drawer.snapToSequentialPoints,
      })
      if (release.type === 'snap') {
        drawer._setSnapPoint(release.point.value, 'swipe', event)
      } else {
        let previous = drawer.activeSnapPoint
        if (drawer._setSnapPoint(null, 'swipe', event)) {
          let movement = snapMovement(base, current.delta)
          if (dismiss(event, movement, popupHeight - base, velocity)) return
          drawer._setSnapPoint(previous, 'swipe', event)
        }
      }
      applyRest()
      void store.update()
      return
    }

    let movement = swipeMovement(current.delta)
    if (shouldDismiss(movement, size, velocity) && dismiss(event, movement, size, velocity)) return
    applyRest()
    void store.update()
  }

  function onPointerCancel(event: PointerEvent) {
    if (event.pointerId !== pointerId) return
    let wasSwiping = swiping
    endGesture()
    dragBase = null
    if (wasSwiping) {
      applyRest()
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
          if (!drawer.areaSwiping) applyRest()
        }
        if (!drawer.parent) drawer.indent?._setOpen(drawer.id, open)
        requestAnimationFrame(() => {
          refreshStack(drawer)
          if (!opening) return
          // The swipe area keeps the popup under the pointer while the dialog opens.
          if (drawer.areaSwiping) controller.areaDrag(areaDisplacement)
          else measure()
        })
      })
    }
    lastOpen = open

    let nestedDrawers = store.nestedOpenCount('drawer')
    let points = drawer.snapPoints
    let offset = snapMode() ? snapOffset() : null
    let active = drawer.activeSnapPoint
    let expanded = points.length > 0 && (Object.is(active, 1) || offset === 0)
    let style: Record<string, string> = {
      '--nested-drawers': String(nestedDrawers),
      '--drawer-swipe-movement-x': '0px',
      '--drawer-swipe-movement-y': '0px',
      '--drawer-swipe-progress': String(Math.round(restProgress() * 1000) / 1000),
      '--drawer-swipe-strength': '1',
      '--drawer-snap-point-offset': snapMode() ? snapOffsetVar() : '0px',
      // Let the drawer own drags along its swipe axis; nested scroll containers still scroll.
      touchAction: swipeAxis(direction) === 'y' ? 'pan-x' : 'pan-y',
    }
    // Base UI sets the height only while it must stay fixed: a nested drawer is open (so the
    // stack can collapse to it) or the drawer is closing.
    if (popupHeight > 0 && (nestedDrawers > 0 || !open)) {
      style['--drawer-height'] = `${popupHeight}px`
    }

    return [
      popupMixin(options),
      attrs({
        'data-swipe-direction': direction,
        'data-swiping': drawer.swiping ? '' : undefined,
        'data-swipe-dismiss': drawer.swipeDismissed ? '' : undefined,
        'data-nested-drawer-open': nestedDrawers > 0 ? '' : undefined,
        'data-nested-drawer-swiping': drawer.nestedSwiping ? '' : undefined,
        'data-expanded': expanded ? '' : undefined,
      }),
      mergeStyle(style),
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

// ---------------------------------------------------------------------------------------------
// Swipe area: swipe-to-open. Thresholds follow Base UI 1.9 (drawer/swipe-area).

/** Fraction of the popup size a swipe-area drag must cover to stay open on release. */
const SWIPE_OPEN_FRACTION = 0.5
/** Release velocity (px/ms, open direction) that keeps the drawer open regardless of distance. */
const SWIPE_OPEN_VELOCITY = 0.1
/** Distance (px) used instead of the popup size when it can't be measured. */
const SWIPE_OPEN_FALLBACK = 40

export interface DrawerSwipeAreaOptions {
  /**
   * The direction a swipe opens the drawer in. Defaults to the opposite of the Context's
   * `swipeDirection` (an `'up'` swipe opens a `'down'` bottom sheet).
   */
  swipeDirection?: DrawerSwipeDirection
  /** Whether the swipe area ignores swipes. */
  disabled?: boolean
}

interface AreaGesture {
  pointerId: number
  tracker: SwipeTracker
  opened: boolean
  win: Window
  cleanup(): void
}

const swipeAreaMixin = createMixin<HTMLElement, [options?: DrawerSwipeAreaOptions], ElementProps>(
  (handle) => {
    let drawer = getDrawer(handle)
    let store = getDialogRoot(handle)
    let signal = handle.signal
    let options: DrawerSwipeAreaOptions | undefined
    let gesture: AreaGesture | null = null

    handle.addEventListener('insert', (event) => {
      // Registered like a trigger: the click that ends the gesture isn't an outside press.
      store._register('trigger', event.node, signal)
    })
    signal.addEventListener('abort', () => gesture?.cleanup())

    function openDirection(): SwipeDirection {
      return options?.swipeDirection ?? oppositeDirection(drawer.swipeDirection)
    }

    /**
     * The pointerup that ends a drag fires a click on the common ancestor of the press and the
     * release, which would otherwise count as an outside press and close the drawer it just
     * opened. Swallow that one click: the guard ends at the next press (a deliberate click has
     * its own pointerdown) and lets keyboard clicks (`detail === 0`) through.
     */
    function guardReleaseClick(win: Window) {
      let options = { capture: true }
      function onClick(event: MouseEvent) {
        if (event.detail === 0) return
        event.stopPropagation()
        event.preventDefault()
        remove()
      }
      function remove() {
        win.removeEventListener('click', onClick, options)
        win.removeEventListener('pointerdown', remove, options)
      }
      win.addEventListener('click', onClick, options)
      win.addEventListener('pointerdown', remove, options)
      signal.addEventListener('abort', remove, { once: true })
    }

    function finish(event: PointerEvent | null, release: boolean) {
      let current = gesture
      if (!current) return
      gesture = null
      current.cleanup()
      if (!current.opened) return
      if (release) guardReleaseClick(current.win)
      if (release && event && store.open) {
        let displacement = current.tracker.delta
        let velocity = current.tracker.velocity(event.timeStamp)
        let popupSize = drawer.popup?.size() ?? 0
        let threshold = popupSize > 0 ? popupSize * SWIPE_OPEN_FRACTION : SWIPE_OPEN_FALLBACK
        let stayOpen =
          displacement > 0 && (displacement >= threshold || velocity >= SWIPE_OPEN_VELOCITY)
        if (!stayOpen) store.setOpen(false, 'swipe', event)
      } else if (store.open) {
        store.setOpen(false, 'swipe', event ?? undefined)
      }
      drawer._setAreaSwiping(false)
      drawer.popup?.areaEnd()
      void store.update()
    }

    function onMove(event: PointerEvent) {
      let current = gesture
      if (!current || event.pointerId !== current.pointerId) return
      let { tracker } = current
      tracker.move(event.clientX, event.clientY, event.timeStamp)
      if (!current.opened) {
        let distance = tracker.delta
        if (Math.abs(distance) < SWIPE_START_THRESHOLD && tracker.cross < SWIPE_START_THRESHOLD) {
          return
        }
        if (distance <= 0 || tracker.cross > distance) {
          finish(event, false)
          return
        }
        current.opened = true
        drawer._setAreaSwiping(true)
        store._setInteraction(
          event.pointerType === 'mouse' ||
            event.pointerType === 'touch' ||
            event.pointerType === 'pen'
            ? event.pointerType
            : '',
        )
        if (!store.open && !store.setOpen(true, 'swipe', event)) {
          current.opened = false
          drawer._setAreaSwiping(false)
          finish(event, false)
          return
        }
        void store.update()
      }
      if (event.cancelable) event.preventDefault()
      drawer.popup?.areaDrag(tracker.delta)
    }

    function onUp(event: PointerEvent) {
      if (!gesture || event.pointerId !== gesture.pointerId) return
      gesture.tracker.move(event.clientX, event.clientY, event.timeStamp)
      finish(event, true)
    }

    function onCancel(event: PointerEvent) {
      if (!gesture || event.pointerId !== gesture.pointerId) return
      finish(event, false)
    }

    function onPointerDown(event: PointerEvent) {
      if (options?.disabled || store.open || gesture) return
      if (event.pointerType === 'mouse' && event.button !== 0) return
      // Keep mouse drags from selecting text or dragging images.
      if (event.pointerType !== 'touch' && event.cancelable) event.preventDefault()
      // The dialog may open over the area (and make it inert), so follow the pointer on the
      // window rather than through pointer capture.
      let win = (event.currentTarget as HTMLElement).ownerDocument.defaultView ?? window
      let listenerOptions = { capture: true }
      win.addEventListener('pointermove', onMove, listenerOptions)
      win.addEventListener('pointerup', onUp, listenerOptions)
      win.addEventListener('pointercancel', onCancel, listenerOptions)
      gesture = {
        pointerId: event.pointerId,
        tracker: createSwipeTracker(openDirection(), event.clientX, event.clientY, event.timeStamp),
        opened: false,
        win,
        cleanup() {
          win.removeEventListener('pointermove', onMove, listenerOptions)
          win.removeEventListener('pointerup', onUp, listenerOptions)
          win.removeEventListener('pointercancel', onCancel, listenerOptions)
        },
      }
    }

    return (opts, props) => {
      ;[options] = splitOptions(opts, props)
      let open = store.open
      let disabled = options?.disabled ?? false
      let direction = openDirection()
      let enabled = !disabled && (!open || drawer.areaSwiping)
      return [
        attrs({
          role: 'presentation',
          'aria-hidden': 'true',
          'data-open': open ? '' : undefined,
          'data-closed': open ? undefined : '',
          'data-disabled': disabled ? '' : undefined,
          'data-swipe-direction': direction,
          'data-swiping': drawer.areaSwiping ? '' : undefined,
        }),
        mergeStyle({
          touchAction: swipeAxis(direction) === 'y' ? 'pan-x' : 'pan-y',
          pointerEvents: enabled ? 'auto' : 'none',
        }),
        on<HTMLElement, 'pointerdown'>('pointerdown', onPointerDown),
      ]
    }
  },
)

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
 * `data-nested-drawer-open`, `data-nested-drawer-swiping`, `data-expanded`, and the
 * `--drawer-swipe-*`, `--drawer-snap-point-offset`, `--drawer-height`, `--nested-drawers`,
 * `--drawer-frontmost-height` CSS variables. Snap points are resolved against the popup's
 * measured height.
 */
export const popup: MixinFactory<HTMLDialogElement, [options?: DialogPopupOptions], ElementProps> =
  drawerPopupMixin

/** Optional separate backdrop element, with `--drawer-swipe-progress`. */
export const backdrop: MixinFactory<HTMLElement, [options?: DialogBackdropOptions], ElementProps> =
  drawerBackdropMixin

/** A region where mouse drags select text instead of swiping. */
export const content: MixinFactory<HTMLElement, [], ElementProps> = contentMixin

/**
 * An element along a screen edge (usually invisible) where a swipe opens the drawer and the
 * popup follows the pointer. `data-open` / `data-closed`, `data-swiping`, `data-disabled`,
 * `data-swipe-direction` (the open direction).
 */
export const swipeArea: MixinFactory<
  HTMLElement,
  [options?: DrawerSwipeAreaOptions],
  ElementProps
> = swipeAreaMixin

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

/** Listens for the bubbling `stems:drawer-snap-point-change` event. */
export function onDrawerSnapPointChange<target extends HTMLElement>(
  handler: (
    event: Dispatched<DrawerSnapPointChangeEvent, target>,
    signal: AbortSignal,
  ) => void | Promise<void>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof DRAWER_SNAP_POINT_CHANGE_EVENT>> {
  return on(DRAWER_SNAP_POINT_CHANGE_EVENT, handler, captureBoolean)
}
