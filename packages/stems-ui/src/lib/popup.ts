/**
 * Shared machinery for anchored popups (popover, menu, tooltip, preview card, select, combobox).
 *
 * A widget composes these pieces:
 *
 * - `createPopupStore()` in its Context provider: open state (controlled or uncontrolled) with
 *   Base UI change details and reasons, trigger registration, ids, labelling, and the resolved
 *   side / align. Call `store.sync()` at the top of the provider's render function.
 * - `createPopupTrigger()` in its trigger mixin: ARIA (`aria-haspopup`, `aria-expanded`,
 *   `aria-controls`), `data-popup-open`, press-to-toggle, and optional hover opening.
 * - `createPopupSurface()` in its popup mixin: `popover="manual"` top-layer display,
 *   `lib/presence.ts` enter/exit transitions, `anchor()` positioning with `data-side` /
 *   `data-align` and Base UI's CSS variables, the `lib/dismiss-layer.ts` layer (Escape, outside
 *   press), focus management, and `modal` (scroll lock, focus trap, inert outside).
 * - `createPopupArrow()`, `createPopupBackdrop()`, `createPopupClose()`, `createPopupLabel()` for
 *   the optional parts.
 *
 * Every helper is called during a mixin's setup with the mixin `handle` and returns an object
 * whose `render()` is called from the mixin's render function and returns mixin descriptors.
 * The widget adds its own role and ARIA on top (e.g. `role="dialog"` for a popover).
 */

import { attrs, on } from '@remix-run/component'
import type { ElementProps, MixInput, MixinHandle } from '@remix-run/component'

import { anchor } from '../anchor.ts'
import type { AnchorPadding, AnchorPoint, AnchorPosition } from '../anchor.ts'
import { getDirection } from './direction.ts'
import type { TextDirection } from './direction.ts'
import { registerDismissLayer } from './dismiss-layer.ts'
import type { DismissReason } from './dismiss-layer.ts'
import { inertOthers, trapFocus } from './focus-trap.ts'
import { createHoverAim } from './hover-aim.ts'
import { createPresence } from './presence.ts'
import type { Presence } from './presence.ts'
import { createTriggerBinding, writeAttributes } from './popup-handle.ts'
import type { PopupHandle, PopupHandleController, TriggerBinding } from './popup-handle.ts'
import { lockScroll } from './scroll-lock.ts'
import { focusFirst } from './tabbable.ts'

// ---------------------------------------------------------------------------------------------
// Types

/** Base UI's `Side`. `inline-start` / `inline-end` follow the text direction. */
export type PopupSide = 'top' | 'bottom' | 'left' | 'right' | 'inline-start' | 'inline-end'

/** Base UI's `Align`. `start` / `end` follow the text direction on the top and bottom sides. */
export type PopupAlign = 'start' | 'center' | 'end'

/** How the user interacted to open or close the popup. */
export type PopupInteractionType = 'mouse' | 'touch' | 'pen' | 'keyboard'

/**
 * Base UI's `modal`: `true` locks page scroll, traps focus, and makes outside content inert;
 * `'trap-focus'` only traps focus; `false` (default) does neither.
 */
export type PopupModal = boolean | 'trap-focus'

/** Base UI's change reasons. */
export type PopupOpenChangeReason =
  | 'trigger-press'
  | 'trigger-hover'
  | 'trigger-focus'
  | 'outside-press'
  | 'escape-key'
  | 'close-press'
  | 'focus-out'
  | 'list-navigation'
  | 'item-press'
  | 'imperative-action'
  | 'disabled'
  | 'none'

/** The second argument of `onOpenChange`, like Base UI's `eventDetails`. */
export interface PopupOpenChangeDetails {
  /** Why the open state is changing. */
  readonly reason: PopupOpenChangeReason
  /** The DOM event that caused the change, if any. */
  readonly event: Event | undefined
  /** The trigger the change is associated with. */
  readonly trigger: HTMLElement | undefined
  /** Call from `onOpenChange` to keep the current state. */
  cancel(): void
  readonly isCanceled: boolean
}

export interface PopupChangeRequest {
  reason: PopupOpenChangeReason
  event?: Event
  /** The trigger that requested the change (becomes the active trigger when opening). */
  trigger?: HTMLElement | null
}

/** Root props shared by popup widgets (spread them into the Context provider's props). */
export interface PopupStateProps {
  /** Whether the popup is open (controlled). */
  open?: boolean
  /**
   * Whether the popup is initially open (uncontrolled).
   * @default false
   */
  defaultOpen?: boolean
  /** Called with the next open state and the change details. Call `details.cancel()` to veto. */
  onOpenChange?: (open: boolean, details: PopupOpenChangeDetails) => void
  /** Called after the enter or exit animation has finished. */
  onOpenChangeComplete?: (open: boolean) => void
  /**
   * Modal behavior while open.
   * @default false
   */
  modal?: PopupModal
}

/**
 * Root props for popups that support detached triggers (Base UI's `handle`, `triggerId`,
 * `defaultTriggerId`).
 */
export interface PopupTriggerIdProps {
  /**
   * The `id` of the active trigger (controlled): the one the popup anchors to, returns focus to,
   * and takes its `payload` from. Pair it with `open`; read the trigger to store from
   * `details.trigger` in `onOpenChange`. `null` / `undefined`: the trigger that opened it.
   */
  triggerId?: string | null
  /** The `id` of the initially active trigger (with `defaultOpen`). */
  defaultTriggerId?: string | null
}

/** Base UI's offset function: receives the anchor and popup sizes and the requested side/align. */
export type PopupOffsetFunction = (data: {
  side: PopupSide
  align: PopupAlign
  anchor: { width: number; height: number }
  positioner: { width: number; height: number }
}) => number

/** Base UI's positioner props, applied to the popup element itself. */
export interface PopupPositionOptions {
  /**
   * Which side of the anchor to place the popup on. Flips to the opposite side when it doesn't
   * fit; `data-side` reports the final side.
   * @default 'bottom'
   */
  side?: PopupSide
  /**
   * How to align the popup relative to the side.
   * @default 'center'
   */
  align?: PopupAlign
  /**
   * Distance between the anchor and the popup in pixels.
   * @default 0
   */
  sideOffset?: number | PopupOffsetFunction
  /**
   * Offset along the alignment axis in pixels.
   * @default 0
   */
  alignOffset?: number | PopupOffsetFunction
  /**
   * Space to keep from the viewport edges.
   * @default 5
   */
  collisionPadding?: number | Partial<AnchorPadding>
  /**
   * Minimum distance between the arrow and the popup's edges.
   * @default 5
   */
  arrowPadding?: number
  /**
   * What to position against. Defaults to the trigger that opened the popup. Accepts an element,
   * viewport coordinates (`{ x, y, width?, height? }`), or a function returning either.
   */
  anchor?: PopupAnchor | (() => PopupAnchor)
  /** `anchor()`'s inset alignment (Stems extra, used by select). */
  inset?: boolean
  /** `anchor()`'s `relativeTo` selector (Stems extra, used by select). */
  relativeTo?: string
  /**
   * Stems extra (select's `alignItemWithTrigger`): overlap the anchor so the popup descendant
   * matching `selector` sits over it, vertically centered, with its inline-start edge lined up
   * with `textNode` (an element inside the anchor, e.g. the select value) or with the anchor's
   * own edge. `side`, `align`, and the offsets are ignored, and `data-side` is `'none'`.
   */
  alignItem?: PopupAlignItem | null
}

export interface PopupAlignItem {
  /** Selector for the popup descendant to place over the anchor. */
  selector: string
  /** Element inside the anchor whose inline-start edge the descendant lines up with. */
  textNode?: HTMLElement | null
}

export type PopupAnchor = HTMLElement | AnchorPoint | null | undefined

/**
 * Base UI's `initialFocus` / `finalFocus`: `false` doesn't move focus, `true` (or `undefined`)
 * uses the default, an element or selector (scoped to the popup for `initialFocus`, to the
 * document for `finalFocus`) is focused, and a function is called with the interaction type and
 * may return any of those (`null` uses the default, `undefined` does nothing).
 */
export type PopupFocusTarget =
  | boolean
  | string
  | HTMLElement
  | null
  | ((interactionType: PopupInteractionType | null) => boolean | HTMLElement | null | void)

export interface PopupFocusOptions {
  /**
   * Element to focus when the popup opens. By default the first `[autofocus]` or tabbable
   * element inside the popup, or the popup itself (also when opened by touch). Popups opened by
   * hover never move focus.
   */
  initialFocus?: PopupFocusTarget
  /**
   * Element to focus when the popup closes. By default the trigger, unless focus already moved
   * elsewhere (e.g. an outside press on a focusable element, or tabbing out).
   */
  finalFocus?: PopupFocusTarget
}

export interface PopupSurfaceOptions extends PopupPositionOptions, PopupFocusOptions {}

// ---------------------------------------------------------------------------------------------
// Store

export interface PopupTriggerEntry {
  node: HTMLElement | null
  disabled: boolean
  /** The trigger's `payload` option. */
  payload?: unknown
}

interface BackdropEntry {
  node(): HTMLElement | null
  show(): void
}

export interface PopupStoreOptions {
  /** Id prefix, usually the provider's `handle.id`. */
  id: string
  /** Reads the provider's current props. */
  getProps(): PopupStateProps & PopupTriggerIdProps
  /** Re-renders the provider (and so every part). */
  update(): Promise<unknown>
  /** The provider's `handle.signal`, captured during setup. */
  signal?: AbortSignal
  /** Builds the bubbling change event dispatched from the active trigger (or the popup). */
  createChangeEvent?(open: boolean, details: PopupOpenChangeDetails): Event
  /**
   * The `Context`'s `handle` prop (read once). The store shares the handle's trigger registry
   * and notifies detached triggers when it renders; attach the widget's context value with
   * `attachPopupHandle()`.
   */
  handle?: PopupHandle<any>
}

/** Shared popup state. Widgets usually expose it (or an object extending it) as their context. */
export interface PopupStore {
  /** Whether the popup is open. */
  readonly open: boolean
  readonly modal: PopupModal
  /** Why the popup is open (`null` while closed; `'none'` when opened by a controlled prop). */
  readonly openReason: PopupOpenChangeReason | null
  /** Details of the change that produced the current open state, if it came from `setOpen()`. */
  readonly lastChange: PopupOpenChangeDetails | null
  /** The interaction that last opened or closed the popup. */
  readonly interactionType: PopupInteractionType | null
  /** The popup element's id (the host `id` if one is set). */
  readonly popupId: string
  /** The first registered title's id, for `aria-labelledby`. */
  readonly titleId: string | undefined
  /** The first registered description's id, for `aria-describedby`. */
  readonly descriptionId: string | undefined
  /** The trigger the popup is anchored to and returns focus to. */
  readonly activeTrigger: HTMLElement | null
  /** The active trigger's `payload` option. */
  readonly payload: unknown
  readonly popupNode: HTMLElement | null
  readonly arrowNode: HTMLElement | null
  readonly backdropNode: HTMLElement | null
  /**
   * The rendered side: the final (flipped) side while positioned, else the requested side.
   * `'none'` while positioned with `alignItem`.
   */
  readonly side: PopupSide | 'none'
  readonly align: PopupAlign
  /** Hover-open timers and pointer tracking shared by the trigger and the popup. */
  readonly hover: PopupHover
  /**
   * Requests an open-state change. Calls `onOpenChange`, then (unless canceled) updates
   * uncontrolled state and dispatches the change event. Returns whether the change was accepted.
   */
  setOpen(open: boolean, request: PopupChangeRequest): boolean
  /** Re-renders the provider. */
  update(): Promise<unknown>
  /** Call at the top of the provider's render function to record open-state transitions. */
  sync(): void
  /** Whether `node` is inside any registered trigger. */
  containsTrigger(node: Node): boolean
  isActiveTrigger(entry: PopupTriggerEntry): boolean
  /** Default id for a title or description part. */
  labelId(kind: 'title' | 'description'): string
  /** @internal */
  _registerTrigger(signal: AbortSignal): PopupTriggerEntry
  /** @internal */
  _activateTrigger(entry: PopupTriggerEntry): void
  /** @internal */
  _registerLabel(kind: 'title' | 'description', id: string): () => void
  /** @internal */
  _registerBackdrop(entry: BackdropEntry, signal: AbortSignal): void
  /** @internal */
  _showBackdrop(): void
  /** @internal */
  _setPopup(node: HTMLElement | null, id?: string): void
  /** @internal */
  _setArrow(node: HTMLElement | null): void
  /** @internal */
  _setPopupId(id: string): boolean
  /** @internal */
  _setRequestedPlacement(side: PopupSide | 'none', align: PopupAlign): void
  /** @internal */
  _setPlacement(side: PopupSide | 'none', align: PopupAlign): void
  /** @internal */
  _clearPlacement(): void
  /** @internal */
  _setInteractionType(type: PopupInteractionType | null): void
  /** @internal */
  _setOpenReason(reason: PopupOpenChangeReason): void
  /** @internal */
  _complete(open: boolean): void
}

export function createPopupStore(options: PopupStoreOptions): PopupStore {
  let { id, getProps, update, signal } = options
  let uncontrolledOpen = getProps().defaultOpen ?? false
  let defaultTriggerId = getProps().defaultTriggerId ?? null
  let popupHandle = options.handle
  // With a handle, triggers register with the handle so detached ones are seen too.
  let triggers: PopupTriggerEntry[] = popupHandle
    ? popupHandle._state.shared<PopupTriggerEntry[]>('popup-triggers', () => [])
    : []
  let activeEntry: PopupTriggerEntry | null = null
  let popupNode: HTMLElement | null = null
  let arrowNode: HTMLElement | null = null
  let backdrop: BackdropEntry | null = null
  let popupId = `${id}-popup`
  let labels: Record<'title' | 'description', string[]> = { title: [], description: [] }
  let requested: { side: PopupSide | 'none'; align: PopupAlign } = {
    side: 'bottom',
    align: 'center',
  }
  let placed: { side: PopupSide | 'none'; align: PopupAlign } | null = null
  let interactionType: PopupInteractionType | null = null

  function isOpen() {
    return getProps().open ?? uncontrolledOpen
  }

  let seenOpen = isOpen()
  let pending: { open: boolean; details: PopupOpenChangeDetails } | null = null
  let lastChange: PopupOpenChangeDetails | null = null
  let openReason: PopupOpenChangeReason | null = seenOpen ? 'none' : null

  function findTrigger(triggerId: string) {
    return triggers.find((entry) => entry.node?.id === triggerId) ?? null
  }

  function currentActive(): PopupTriggerEntry | null {
    let controlledId = getProps().triggerId
    if (controlledId != null) {
      let entry = findTrigger(controlledId)
      if (entry) return entry
    }
    if (activeEntry && triggers.includes(activeEntry)) return activeEntry
    if (defaultTriggerId != null) {
      let entry = findTrigger(defaultTriggerId)
      if (entry) return entry
    }
    return triggers[0] ?? null
  }

  function activeTrigger(): HTMLElement | null {
    let node = currentActive()?.node
    return node?.isConnected ? node : null
  }

  function writePlacement() {
    let side = placed?.side ?? requested.side
    let align = placed?.align ?? requested.align
    for (let node of [popupNode, arrowNode]) {
      if (!node) continue
      if (node.getAttribute('data-side') !== side) node.setAttribute('data-side', side)
      if (node.getAttribute('data-align') !== align) node.setAttribute('data-align', align)
    }
  }

  let store: PopupStore = {
    get open() {
      return isOpen()
    },
    get modal() {
      return getProps().modal ?? false
    },
    get openReason() {
      return isOpen() ? (openReason ?? 'none') : null
    },
    get lastChange() {
      return lastChange
    },
    get interactionType() {
      return interactionType
    },
    get popupId() {
      return popupId
    },
    get titleId() {
      return labels.title[0]
    },
    get descriptionId() {
      return labels.description[0]
    },
    get activeTrigger() {
      return activeTrigger()
    },
    get payload() {
      // Until a trigger has been active (opened it, or named by `triggerId` /
      // `defaultTriggerId`), there's no payload: the fallback to the first trigger is only for
      // anchoring, and a payload from it would differ from the server render.
      let props = getProps()
      let known =
        isOpen() ||
        (activeEntry !== null && triggers.includes(activeEntry)) ||
        props.triggerId != null ||
        defaultTriggerId != null
      return known ? currentActive()?.payload : undefined
    },
    get popupNode() {
      return popupNode
    },
    get arrowNode() {
      return arrowNode
    },
    get backdropNode() {
      return backdrop?.node() ?? null
    },
    get side() {
      return placed?.side ?? requested.side
    },
    get align() {
      return placed?.align ?? requested.align
    },
    hover: undefined as unknown as PopupHover,
    setOpen(next, request) {
      if (next === isOpen()) return false
      let canceled = false
      let triggerNode = request.trigger ?? activeTrigger() ?? undefined
      let details: PopupOpenChangeDetails = {
        reason: request.reason,
        event: request.event,
        trigger: triggerNode,
        cancel() {
          canceled = true
        },
        get isCanceled() {
          return canceled
        },
      }

      getProps().onOpenChange?.(next, details)
      if (canceled) return false

      if (next && request.trigger) {
        let entry = triggers.find((candidate) => candidate.node === request.trigger)
        if (entry) {
          activeEntry = entry
          defaultTriggerId = null
        }
      }
      pending = { open: next, details }

      let controlled = getProps().open !== undefined
      if (!controlled) uncontrolledOpen = next

      let target = activeTrigger() ?? popupNode
      let event = options.createChangeEvent?.(next, details)
      if (event && target) target.dispatchEvent(event)

      if (!controlled) void update()
      return true
    },
    update,
    sync() {
      // Detached triggers aren't re-rendered by the provider; let them refresh.
      popupHandle?._state.notify()
      let open = isOpen()
      if (open === seenOpen) return
      seenOpen = open
      lastChange = pending && pending.open === open ? pending.details : null
      pending = null
      openReason = open ? (lastChange?.reason ?? 'none') : null
    },
    containsTrigger(node) {
      return triggers.some((entry) => entry.node?.contains(node))
    },
    isActiveTrigger(entry) {
      return currentActive() === entry
    },
    labelId(kind) {
      return `${id}-${kind}`
    },
    _registerTrigger(entrySignal) {
      let entry: PopupTriggerEntry = { node: null, disabled: false }
      triggers.push(entry)
      entrySignal.addEventListener('abort', () => {
        let index = triggers.indexOf(entry)
        if (index !== -1) triggers.splice(index, 1)
        if (activeEntry === entry) activeEntry = null
      })
      return entry
    },
    _activateTrigger(entry) {
      activeEntry = entry
      defaultTriggerId = null
    },
    _registerLabel(kind, labelId) {
      let list = labels[kind]
      list.push(labelId)
      return () => {
        let index = list.indexOf(labelId)
        if (index !== -1) list.splice(index, 1)
      }
    },
    _registerBackdrop(entry, entrySignal) {
      backdrop = entry
      entrySignal.addEventListener('abort', () => {
        if (backdrop === entry) backdrop = null
      })
    },
    _showBackdrop() {
      backdrop?.show()
    },
    _setPopup(node) {
      popupNode = node
    },
    _setArrow(node) {
      arrowNode = node
    },
    _setPopupId(nextId) {
      if (nextId === popupId) return false
      popupId = nextId
      return true
    },
    _setRequestedPlacement(side, align) {
      requested = { side, align }
    },
    _setPlacement(side, align) {
      if (placed && placed.side === side && placed.align === align) return
      placed = { side, align }
      writePlacement()
    },
    _clearPlacement() {
      placed = null
    },
    _setInteractionType(type) {
      interactionType = type
    },
    _setOpenReason(reason) {
      openReason = reason
    },
    _complete(open) {
      getProps().onOpenChangeComplete?.(open)
    },
  }

  ;(store as { hover: PopupHover }).hover = createPopupHover(store)
  signal?.addEventListener('abort', () => store.hover.cancel())

  return store
}

// ---------------------------------------------------------------------------------------------
// Detached triggers

/**
 * Attaches a provider to its `handle` prop (see `lib/popup-handle.ts`): detached triggers then
 * resolve `value` (the widget's context value) and the handle's `open()` / `close()` act on
 * `store` (reason `'imperative-action'`). Call during the provider's setup.
 */
export function attachPopupHandle(
  popupHandle: PopupHandle<any> | undefined,
  value: object,
  store: PopupStore,
  signal: AbortSignal,
): void {
  if (!popupHandle) return
  let triggers = popupHandle._state.shared<PopupTriggerEntry[]>('popup-triggers', () => [])
  let controller: PopupHandleController = {
    get isOpen() {
      return store.open
    },
    open(triggerId) {
      let entry =
        triggerId == null
          ? undefined
          : triggers.find((candidate) => candidate.node?.id === triggerId)
      if (store.open) {
        if (entry && !store.isActiveTrigger(entry)) {
          store._activateTrigger(entry)
          void store.update()
        }
        return
      }
      store.hover.cancel()
      store._setInteractionType(null)
      store.setOpen(true, { reason: 'imperative-action', trigger: entry?.node ?? null })
    },
    close() {
      store.setOpen(false, { reason: 'imperative-action' })
    },
  }
  popupHandle._state.attach(value, controller, signal)
}

const CLOSED: PopupStateProps = { open: false }

/**
 * An inert, closed store for a detached trigger whose `Context` isn't mounted: it registers
 * triggers with the handle (so the root sees them once it mounts) and renders no
 * `aria-controls`.
 */
export function createDetachedPopupStore(popupHandle: PopupHandle<any> | undefined): PopupStore {
  let store = createPopupStore({
    id: 'stems-detached',
    getProps: () => CLOSED,
    update: () => Promise.resolve(),
    handle: popupHandle,
  })
  return Object.create(store, { popupId: { get: () => undefined } }) as PopupStore
}

/**
 * The context binding for a trigger mixin of a popup built on a plain `PopupStore` (or an object
 * extending one): `inside` is the enclosing `Context`'s value, `fallback` extends the detached
 * store when the widget's context has extra members.
 */
export function bindPopupTrigger<Value extends PopupStore>(
  handle: MixinHandle<HTMLElement>,
  inside: Value | undefined,
  fallback: (store: PopupStore) => Value = (store) => store as Value,
): TriggerBinding<Value> {
  return createTriggerBinding(handle, inside, (popupHandle) =>
    fallback(createDetachedPopupStore(popupHandle)),
  )
}

// ---------------------------------------------------------------------------------------------
// Hover

export interface PopupHoverOptions {
  /**
   * Milliseconds to wait before opening on hover.
   * @default 300
   */
  delay?: number
  /**
   * Milliseconds to wait before closing a hover-opened popup after the pointer leaves.
   * @default 0
   */
  closeDelay?: number
}

/**
 * Hover-open behavior (Base UI's `openOnHover`). Wire `triggerEnter` / `triggerLeave` to the
 * trigger's `pointerenter` / `pointerleave` and `popupEnter` / `popupLeave` to the popup's
 * (`createPopupTrigger` and `createPopupSurface` do this). Only popups opened with reason
 * `'trigger-hover'` close on pointer leave; pressing the trigger of a hover-opened popup makes it
 * stay open. Moving the pointer from the trigger toward the popup keeps it open
 * (`lib/hover-aim.ts`).
 */
export interface PopupHover {
  triggerEnter(event: PointerEvent, trigger: HTMLElement, options?: PopupHoverOptions): void
  triggerLeave(event: PointerEvent, options?: PopupHoverOptions): void
  popupEnter(event: PointerEvent): void
  popupLeave(event: PointerEvent): void
  /** Clears pending timers and pointer tracking. */
  cancel(): void
}

function createPopupHover(store: PopupStore): PopupHover {
  let openTimer = 0
  let closeTimer = 0
  let closeDelay = 0
  let aim = createHoverAim()
  let tracking: AbortController | null = null

  function hoverOpen() {
    return store.open && store.openReason === 'trigger-hover'
  }

  function stopTracking() {
    tracking?.abort()
    tracking = null
  }

  function cancelClose() {
    clearTimeout(closeTimer)
    closeTimer = 0
  }

  function scheduleClose(event?: Event) {
    cancelClose()
    closeTimer = window.setTimeout(() => {
      closeTimer = 0
      stopTracking()
      if (hoverOpen()) store.setOpen(false, { reason: 'trigger-hover', event })
    }, closeDelay)
  }

  function isInside(target: EventTarget | null) {
    return (
      target instanceof Node &&
      (store.popupNode?.contains(target) === true || store.containsTrigger(target))
    )
  }

  function track(doc: Document) {
    stopTracking()
    tracking = new AbortController()
    doc.addEventListener(
      'pointermove',
      (event) => {
        if (!aim.accepts(event)) return
        stopTracking()
        if (!isInside(event.target)) scheduleClose(event)
      },
      { capture: true, signal: tracking.signal },
    )
  }

  return {
    triggerEnter(event, trigger, options = {}) {
      if (event.pointerType === 'touch') return
      cancelClose()
      stopTracking()
      closeDelay = options.closeDelay ?? 0
      if (store.open) return
      clearTimeout(openTimer)
      openTimer = window.setTimeout(() => {
        openTimer = 0
        if (!store.open && trigger.isConnected) {
          store.setOpen(true, { reason: 'trigger-hover', event, trigger })
        }
      }, options.delay ?? 300)
    },
    triggerLeave(event, options = {}) {
      clearTimeout(openTimer)
      openTimer = 0
      if (!hoverOpen()) return
      closeDelay = options.closeDelay ?? closeDelay
      let popup = store.popupNode
      if (isInside(event.relatedTarget)) return
      let trigger = event.currentTarget
      if (
        popup &&
        trigger instanceof HTMLElement &&
        aim.start(trigger, popup, event, () => scheduleClose(event))
      ) {
        track(popup.ownerDocument)
        return
      }
      scheduleClose(event)
    },
    popupEnter() {
      cancelClose()
      stopTracking()
    },
    popupLeave(event) {
      if (!hoverOpen()) return
      if (isInside(event.relatedTarget)) return
      scheduleClose(event)
    },
    cancel() {
      clearTimeout(openTimer)
      openTimer = 0
      cancelClose()
      stopTracking()
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Trigger

export interface PopupTriggerOptions extends PopupHoverOptions {
  /** Ignore presses (and hover). */
  disabled?: boolean
  /**
   * Also open when the trigger is hovered.
   * @default false
   */
  openOnHover?: boolean
}

export interface PopupTriggerConfig {
  /** The `aria-haspopup` value: `'dialog'`, `'menu'`, `'listbox'`, … */
  haspopup: string
  /**
   * Whether a press toggles the popup.
   * @default true
   */
  toggleOnPress?: boolean
  /** Whether the trigger is detached from its `Context` (`TriggerBinding.detached`). */
  isDetached?: () => boolean
}

export interface PopupTrigger {
  /** The trigger's registration (registered on first access). */
  readonly entry: PopupTriggerEntry
  readonly node: HTMLElement | null
  /** Toggles the popup as a trigger press would. */
  press(event: Event): void
  /** Writes the state attributes to the element (for detached triggers). */
  refresh(): void
  render(options?: PopupTriggerOptions & PopupPayloadOption): MixInput<HTMLElement, ElementProps>
}

export interface PopupPayloadOption {
  /** Data for the popup while this trigger is active (`store.payload`). */
  payload?: unknown
}

/**
 * Records a trigger's `payload`. When the active trigger's payload changes while open, the
 * provider re-renders: always for detached triggers, and on the first render for triggers
 * inside the `Context` (later changes there show up on the provider's next render; re-rendering
 * every time could loop when a children render function creates a new payload each render).
 */
export function setTriggerPayload(
  handle: MixinHandle<HTMLElement>,
  store: PopupStore,
  entry: PopupTriggerEntry,
  payload: unknown,
  rerender: boolean,
): void {
  if (Object.is(entry.payload, payload)) return
  entry.payload = payload
  if (!rerender || !store.open || !store.isActiveTrigger(entry)) return
  handle.queueTask(() => void store.update())
}

/**
 * Trigger behavior: registers the host as a trigger and renders `type="button"` (or
 * `role="button"` + `tabIndex` + Enter/Space for non-buttons), `aria-haspopup`, `aria-expanded`
 * (`'true'` only on the active trigger), `aria-controls`, `data-popup-open`, `data-disabled`, and
 * `disabled`. A press toggles the popup with reason `'trigger-press'`; pressing another trigger
 * of an open popup moves the popup to it.
 */
export function createPopupTrigger(
  handle: MixinHandle<HTMLElement>,
  hostType: string,
  store: PopupStore,
  config: PopupTriggerConfig,
): PopupTrigger {
  let signal = handle.signal
  // Registered lazily: a detached trigger's handle is only known once its mixin renders.
  let registered: PopupTriggerEntry | null = null
  let isButton = hostType === 'button'
  let pointerType: PopupInteractionType | null = null
  let hoverOptions: PopupTriggerOptions = {}
  let rendered = false

  function ensureEntry() {
    return (registered ??= store._registerTrigger(signal))
  }

  handle.addEventListener('insert', (event) => {
    ensureEntry().node = event.node
  })
  handle.addEventListener('remove', () => {
    if (registered) registered.node = null
  })

  function stateAttrs(entry: PopupTriggerEntry) {
    let open = store.open && store.isActiveTrigger(entry)
    return {
      'aria-expanded': open ? 'true' : 'false',
      'aria-controls': store.popupId as string | undefined,
      'data-popup-open': open ? '' : undefined,
    }
  }

  function press(event: Event) {
    let entry = ensureEntry()
    if (entry.disabled || config.toggleOnPress === false) return
    let detail = (event as MouseEvent).detail
    store._setInteractionType(
      event instanceof KeyboardEvent || detail === 0 ? 'keyboard' : (pointerType ?? 'mouse'),
    )
    store.hover.cancel()

    if (store.open) {
      if (!store.isActiveTrigger(entry)) {
        store._activateTrigger(entry)
        void store.update()
        return
      }
      if (store.openReason === 'trigger-hover') {
        // Base UI: pressing the trigger of a hover-opened popup keeps it open.
        store._setOpenReason('trigger-press')
        return
      }
      store.setOpen(false, { reason: 'trigger-press', event, trigger: entry.node })
      return
    }
    store.setOpen(true, { reason: 'trigger-press', event, trigger: entry.node })
  }

  return {
    get entry() {
      return ensureEntry()
    },
    get node() {
      return registered?.node ?? null
    },
    press,
    refresh() {
      let node = registered?.node
      if (node) writeAttributes(node, stateAttrs(registered!))
    },
    render(options = {}) {
      let entry = ensureEntry()
      let disabled = options.disabled ?? false
      entry.disabled = disabled
      hoverOptions = options
      setTriggerPayload(
        handle,
        store,
        entry,
        options.payload,
        !rendered || (config.isDetached?.() ?? false),
      )
      rendered = true

      return [
        attrs({
          type: isButton ? 'button' : undefined,
          role: isButton ? undefined : 'button',
          tabIndex: isButton ? undefined : disabled ? -1 : 0,
          'aria-haspopup': config.haspopup,
          'aria-disabled': !isButton && disabled ? 'true' : undefined,
          disabled: isButton && disabled ? true : undefined,
          'data-disabled': disabled ? '' : undefined,
          ...stateAttrs(entry),
        }),
        on<HTMLElement, 'pointerdown'>('pointerdown', (event) => {
          pointerType = toInteractionType(event.pointerType)
        }),
        on<HTMLElement, 'click'>('click', press),
        !isButton &&
          on<HTMLElement, 'keydown'>('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            press(event)
          }),
        options.openOnHover &&
          on<HTMLElement, 'pointerenter'>('pointerenter', (event) => {
            if (entry.disabled || !entry.node) return
            store.hover.triggerEnter(event, entry.node, hoverOptions)
          }),
        options.openOnHover &&
          on<HTMLElement, 'pointerleave'>('pointerleave', (event) => {
            store.hover.triggerLeave(event, hoverOptions)
          }),
      ]
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Surface (the popup element)

export interface PopupSurfaceConfig {
  /**
   * Close (reason `'focus-out'`) when keyboard focus moves outside the popup and its triggers.
   * Ignored while `modal`.
   * @default true
   */
  closeOnFocusOut?: boolean
  /** Whether Escape dismisses. @default true */
  dismissOnEscape?: boolean
  /** Whether outside presses dismiss. @default true */
  dismissOnOutsidePress?: boolean
}

export interface PopupSurface {
  readonly presence: Presence<HTMLElement>
  readonly node: HTMLElement | null
  /**
   * Call from the popup mixin's render function. Returns `id`, `popover="manual"`,
   * `tabIndex={-1}`, `hidden` (while closed and not animating out), `data-open` / `data-closed`,
   * `data-side` / `data-align`, presence attributes, and the focus-out / hover listeners.
   */
  render(options: PopupSurfaceOptions, props: ElementProps): MixInput<HTMLElement, ElementProps>
}

/**
 * Popup element behavior. On open: `showPopover()`, positioning with `anchor()`, a dismiss layer
 * (the triggers count as inside), modal handling, and initial focus. On close: the dismiss layer
 * and modal handling are released and focus is restored right away; positioning continues until
 * the exit animation has finished, then `hidePopover()` runs and `hidden` is rendered.
 *
 * Positioning writes `data-side` / `data-align` (final side) on the popup and arrow, and the
 * `--anchor-width`, `--anchor-height`, `--available-width`, `--available-height`, and
 * `--transform-origin` CSS variables on the popup.
 */
export function createPopupSurface(
  handle: MixinHandle<HTMLElement>,
  store: PopupStore,
  config: PopupSurfaceConfig = {},
): PopupSurface {
  let options: PopupSurfaceOptions = {}
  let node: HTMLElement | null = null
  let lastOpen: boolean | undefined
  let shown = false
  let stopAnchor: (() => void) | null = null
  let anchorKey: unknown[] | null = null
  let teardown: Array<() => void> = []
  let interactive = false
  let focusedOnOpen = false
  let pointerPressed = false
  let lastSideOffset = 0

  let presence = createPresence(handle, {
    update: () => store.update(),
    onBeforeEnter: (node) => show(node),
    onAfterEnter: () => store._complete(true),
    onAfterExit(node) {
      hide(node)
      store._complete(false)
    },
  })

  handle.addEventListener('insert', (event) => {
    node = event.node
    store._setPopup(node)
  })

  handle.addEventListener('remove', () => {
    deactivate()
    stopPositioning()
    shown = false
    if (store.popupNode === node) store._setPopup(null)
    node = null
  })

  function show(node: HTMLElement) {
    if (!node.isConnected) return
    store._showBackdrop()
    if (!node.matches(':popover-open')) node.showPopover()
    shown = true
    startPositioning(node)
    activate(node)
    focusInitial(node)
  }

  function hide(node: HTMLElement) {
    stopPositioning()
    shown = false
    store._clearPlacement()
    if (node.matches(':popover-open')) node.hidePopover()
  }

  // Positioning ------------------------------------------------------------------------------

  function resolveAnchor(): HTMLElement | AnchorPoint | null {
    let target = typeof options.anchor === 'function' ? options.anchor() : options.anchor
    return target ?? store.activeTrigger
  }

  function positionKey(target: unknown, dir: TextDirection): unknown[] {
    return [
      target,
      dir,
      options.side ?? 'bottom',
      options.align ?? 'center',
      options.sideOffset,
      options.alignOffset,
      JSON.stringify(options.collisionPadding ?? null),
      options.arrowPadding,
      options.inset,
      options.relativeTo,
      options.alignItem?.selector,
      options.alignItem?.textNode,
    ]
  }

  function stopPositioning() {
    stopAnchor?.()
    stopAnchor = null
    anchorKey = null
  }

  function startPositioning(node: HTMLElement) {
    stopPositioning()
    let target = resolveAnchor()
    let dir = getDirection(node)
    anchorKey = positionKey(target, dir)
    if (!target) return

    let side = options.side ?? 'bottom'
    let align = options.align ?? 'center'
    let physicalSide = toPhysicalSide(side, dir)
    let vertical = physicalSide === 'top' || physicalSide === 'bottom'
    let anchorTarget = target

    function offsetData(floating: HTMLElement) {
      let rect =
        anchorTarget instanceof HTMLElement
          ? anchorTarget.getBoundingClientRect()
          : { width: anchorTarget.width ?? 0, height: anchorTarget.height ?? 0 }
      return {
        side,
        align,
        anchor: { width: rect.width, height: rect.height },
        positioner: { width: floating.offsetWidth, height: floating.offsetHeight },
      }
    }

    function resolve(value: number | PopupOffsetFunction | undefined, floating: HTMLElement) {
      return typeof value === 'function' ? value(offsetData(floating)) : (value ?? 0)
    }

    let alignSign = getAlignOffsetSign(align, vertical, dir)
    let alignOffset = (floating: HTMLElement) => alignSign * resolve(options.alignOffset, floating)

    let alignItem = options.alignItem
    if (alignItem && anchorTarget instanceof HTMLElement) {
      // Overlap the anchor: an inset placement on the inline-start side, aligned against the
      // matching descendant, shifted so it lines up with the text inside the anchor.
      let anchorNode = anchorTarget
      let textNode = alignItem.textNode
      let rtl = dir === 'rtl'
      lastSideOffset = 0
      stopAnchor = anchor(node, anchorNode, {
        placement: rtl ? 'right' : 'left',
        inset: true,
        relativeTo: alignItem.selector,
        offsetX: () => {
          if (!textNode?.isConnected || !anchorNode.contains(textNode)) return 0
          let anchorRect = anchorNode.getBoundingClientRect()
          let textRect = textNode.getBoundingClientRect()
          return rtl ? textRect.right - anchorRect.right : textRect.left - anchorRect.left
        },
        collisionPadding: options.collisionPadding ?? 5,
        onPosition: (position) => applyPosition(node, position, 'none', 'center', dir),
      })
      return
    }

    stopAnchor = anchor(node, anchorTarget, {
      placement: toPlacement(physicalSide, align, vertical, dir),
      offset: (floating) => (lastSideOffset = resolve(options.sideOffset, floating)),
      offsetX: vertical ? alignOffset : 0,
      offsetY: vertical ? 0 : alignOffset,
      collisionPadding: options.collisionPadding ?? 5,
      inset: options.inset,
      relativeTo: options.relativeTo,
      onPosition: (position) => applyPosition(node, position, side, align, dir),
    })
  }

  function applyPosition(
    node: HTMLElement,
    position: AnchorPosition,
    side: PopupSide | 'none',
    align: PopupAlign,
    dir: TextDirection,
  ) {
    let finalSide: PopupSide | 'none' = side === 'none' ? 'none' : position.side
    if (side === 'inline-start' || side === 'inline-end') {
      let start = dir === 'rtl' ? 'right' : 'left'
      finalSide = position.side === start ? 'inline-start' : 'inline-end'
    }
    store._setPlacement(finalSide, align)

    let { anchorRect, width, height } = position
    let left = position.fixed ? position.left : position.left - window.scrollX
    let top = position.fixed ? position.top : position.top - window.scrollY
    let style = node.style
    style.setProperty('--anchor-width', `${anchorRect.width}px`)
    style.setProperty('--anchor-height', `${anchorRect.height}px`)
    style.setProperty('--available-width', `${Math.floor(position.availableWidth)}px`)
    style.setProperty('--available-height', `${Math.floor(position.availableHeight)}px`)

    let anchorX = clamp(anchorRect.left + anchorRect.width / 2 - left, 0, width)
    let anchorY = clamp(anchorRect.top + anchorRect.height / 2 - top, 0, height)
    let offset = lastSideOffset
    let origin =
      position.side === 'bottom'
        ? `${anchorX}px ${-offset}px`
        : position.side === 'top'
          ? `${anchorX}px ${height + offset}px`
          : position.side === 'right'
            ? `${-offset}px ${anchorY}px`
            : `${width + offset}px ${anchorY}px`
    style.setProperty('--transform-origin', origin)

    let arrow = store.arrowNode
    if (arrow && node.contains(arrow)) {
      let padding = options.arrowPadding ?? 5
      let vertical = position.side === 'top' || position.side === 'bottom'
      arrow.style.position = 'absolute'
      let uncentered: boolean
      if (vertical) {
        let size = arrow.offsetWidth
        let ideal = anchorRect.left + anchorRect.width / 2 - left - node.clientLeft - size / 2
        let x = clamp(ideal, padding, node.clientWidth - padding - size)
        arrow.style.left = `${x}px`
        arrow.style.top = ''
        uncentered = Math.abs(x - ideal) > 0.5
      } else {
        let size = arrow.offsetHeight
        let ideal = anchorRect.top + anchorRect.height / 2 - top - node.clientTop - size / 2
        let y = clamp(ideal, padding, node.clientHeight - padding - size)
        arrow.style.top = `${y}px`
        arrow.style.left = ''
        uncentered = Math.abs(y - ideal) > 0.5
      }
      arrow.toggleAttribute('data-uncentered', uncentered)
    }
  }

  // Dismissal, modality, focus --------------------------------------------------------------

  function activate(node: HTMLElement) {
    if (interactive) return
    interactive = true
    let doc = node.ownerDocument

    teardown.push(
      registerDismissLayer({
        node,
        contains: (target) => (store.containsTrigger(target) ? true : undefined),
        onDismiss(reason: DismissReason, event: Event) {
          store._setInteractionType(
            reason === 'escape-key'
              ? 'keyboard'
              : toInteractionType((event as PointerEvent).pointerType),
          )
          store.setOpen(false, { reason, event })
        },
        dismissOnEscape: config.dismissOnEscape,
        dismissOnOutsidePress: config.dismissOnOutsidePress,
      }),
    )

    let modal = store.modal
    if (modal === true) {
      teardown.push(lockScroll(doc))
      teardown.push(inertOthers([node, store.backdropNode]))
    }
    if (modal) teardown.push(trapFocus(node))

    // A pointer press that moves focus outside is an outside press, not a focus-out.
    let controller = new AbortController()
    let listen = { capture: true, signal: controller.signal }
    doc.addEventListener('pointerdown', () => (pointerPressed = true), listen)
    let release = () => setTimeout(() => (pointerPressed = false))
    doc.addEventListener('pointerup', release, listen)
    doc.addEventListener('pointercancel', release, listen)
    teardown.push(() => {
      controller.abort()
      pointerPressed = false
    })
  }

  function deactivate() {
    interactive = false
    let fns = teardown
    teardown = []
    for (let fn of fns.reverse()) fn()
  }

  function focusInitial(node: HTMLElement) {
    focusedOnOpen = false
    if (store.openReason === 'trigger-hover') return
    let target = resolveFocusTarget(options.initialFocus, node, store.interactionType, true)
    if (target === false) return
    if (target === true) {
      if (store.interactionType === 'touch') node.focus({ preventScroll: true })
      else focusFirst(node, { preventScroll: true })
    } else {
      target.focus({ preventScroll: true })
    }
    focusedOnOpen = true
  }

  function restoreFocus(node: HTMLElement, details: PopupOpenChangeDetails | null) {
    let doc = node.ownerDocument
    let active = doc.activeElement
    let inside = active !== null && node.contains(active)
    let lost = active === null || active === doc.body
    let movedIn = focusedOnOpen
    focusedOnOpen = false
    if (!inside && !(lost && movedIn)) return
    if (details?.reason === 'focus-out') return
    if (details?.reason === 'outside-press' && isFocusableOutside(details.event?.target, node)) {
      return
    }
    let target = resolveFocusTarget(options.finalFocus, node, store.interactionType, false)
    if (target === false) return
    let element = target === true ? store.activeTrigger : target
    element?.focus()
  }

  function onFocusOut(event: FocusEvent) {
    if (!interactive || !node || store.modal) return
    if (config.closeOnFocusOut === false || pointerPressed) return
    let next = event.relatedTarget
    if (!(next instanceof Node)) return
    if (node.contains(next) || store.containsTrigger(next)) return
    store._setInteractionType('keyboard')
    store.setOpen(false, { reason: 'focus-out', event })
  }

  return {
    presence,
    get node() {
      return node
    },
    render(nextOptions, props) {
      options = nextOptions
      let open = store.open
      let first = lastOpen === undefined

      if (typeof props.id === 'string' && store._setPopupId(props.id)) {
        // Triggers rendered before the popup used the default id.
        handle.queueTask(() => void store.update())
      }

      if (!first && open !== lastOpen && !open) {
        let details = store.lastChange
        deactivate()
        handle.queueTask((node) => restoreFocus(node, details))
      }
      if (first && open) {
        handle.queueTask((node) => {
          if (store.open && !shown) show(node)
        })
      }
      lastOpen = open
      presence.sync(open)

      let side = options.side ?? 'bottom'
      let align = options.align ?? 'center'
      store._setRequestedPlacement(options.alignItem ? 'none' : side, align)

      if (shown) {
        handle.queueTask((node) => {
          if (!shown || !anchorKey) return
          let key = positionKey(resolveAnchor(), getDirection(node))
          if (key.some((value, index) => value !== anchorKey![index])) startPositioning(node)
        })
      }

      return [
        attrs({
          id: store.popupId,
          popover: 'manual',
          tabIndex: -1,
          hidden: presence.present ? undefined : true,
          'data-open': open ? '' : undefined,
          'data-closed': open ? undefined : '',
          'data-side': store.side,
          'data-align': store.align,
          ...presence.attrs(),
        }),
        on<HTMLElement, 'focusout'>('focusout', onFocusOut),
        on<HTMLElement, 'pointerenter'>('pointerenter', (event) => store.hover.popupEnter(event)),
        on<HTMLElement, 'pointerleave'>('pointerleave', (event) => store.hover.popupLeave(event)),
      ]
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Optional parts

export interface PopupPart {
  render(props?: ElementProps): MixInput<HTMLElement, ElementProps>
}

/**
 * Arrow behavior: registers the host so positioning can place it (`position: absolute` plus
 * `left` or `top` inline, and `data-uncentered` when it can't point at the anchor's center).
 * Renders `aria-hidden`, `data-open` / `data-closed`, `data-side` / `data-align`.
 */
export function createPopupArrow(handle: MixinHandle<HTMLElement>, store: PopupStore): PopupPart {
  handle.addEventListener('insert', (event) => store._setArrow(event.node))
  handle.addEventListener('remove', () => store._setArrow(null))

  return {
    render() {
      let open = store.open
      return attrs({
        'aria-hidden': 'true',
        'data-open': open ? '' : undefined,
        'data-closed': open ? undefined : '',
        'data-side': store.side,
        'data-align': store.align,
      })
    },
  }
}

/**
 * Backdrop behavior: a `popover="manual"` element shown in the top layer just below the popup
 * (so it covers the page regardless of z-index), with `role="presentation"`, `hidden` while
 * closed, `data-open` / `data-closed`, and presence attributes. Style it to cover the viewport
 * (`position: fixed; inset: 0; width/height: 100%`; reset the UA popover border, padding and
 * background).
 */
export function createPopupBackdrop(
  handle: MixinHandle<HTMLElement>,
  store: PopupStore,
): PopupPart {
  let node: HTMLElement | null = null
  let lastOpen: boolean | undefined

  function showNode(target: HTMLElement) {
    if (target.isConnected && !target.matches(':popover-open')) target.showPopover()
  }

  let presence = createPresence(handle, {
    update: () => store.update(),
    onBeforeEnter: showNode,
    onAfterExit(target) {
      if (target.matches(':popover-open')) target.hidePopover()
    },
  })

  store._registerBackdrop(
    {
      node: () => node,
      show() {
        if (node && presence.present) showNode(node)
      },
    },
    handle.signal,
  )

  handle.addEventListener('insert', (event) => {
    node = event.node
  })
  handle.addEventListener('remove', () => {
    node = null
  })

  return {
    render() {
      let open = store.open
      if (lastOpen === undefined && open) {
        handle.queueTask((target) => {
          if (store.open) showNode(target)
        })
      }
      lastOpen = open
      presence.sync(open)
      return attrs({
        popover: 'manual',
        role: 'presentation',
        hidden: presence.present ? undefined : true,
        'data-open': open ? '' : undefined,
        'data-closed': open ? undefined : '',
        ...presence.attrs(),
      })
    },
  }
}

/** Close-button behavior: `type="button"` on buttons; a press closes with `'close-press'`. */
export function createPopupClose(
  _handle: MixinHandle<HTMLElement>,
  hostType: string,
  store: PopupStore,
): PopupPart {
  let isButton = hostType === 'button'
  return {
    render() {
      return [
        attrs({ type: isButton ? 'button' : undefined }),
        on<HTMLElement, 'click'>('click', (event) => {
          store._setInteractionType(event.detail === 0 ? 'keyboard' : 'mouse')
          store.setOpen(false, { reason: 'close-press', event })
        }),
      ]
    },
  }
}

/**
 * Title / description behavior: renders an `id` (the host's own `id` wins) and registers it so
 * the popup can reference it with `aria-labelledby` / `aria-describedby`.
 */
export function createPopupLabel(
  handle: MixinHandle<HTMLElement>,
  store: PopupStore,
  kind: 'title' | 'description',
): PopupPart {
  let id: string | undefined
  let unregister: (() => void) | undefined

  handle.signal.addEventListener('abort', () => unregister?.())

  return {
    render(props = {}) {
      let next = typeof props.id === 'string' ? props.id : store.labelId(kind)
      if (next !== id) {
        unregister?.()
        id = next
        unregister = store._registerLabel(kind, next)
        // The popup rendered before its title/description registered.
        handle.queueTask(() => void store.update())
      }
      return attrs({ id: next })
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Helpers

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

function toInteractionType(pointerType: string | undefined): PopupInteractionType {
  return pointerType === 'touch' || pointerType === 'pen' ? pointerType : 'mouse'
}

/** Maps a logical side to a physical one for the text direction. */
export function toPhysicalSide(
  side: PopupSide,
  dir: TextDirection,
): 'top' | 'bottom' | 'left' | 'right' {
  if (side === 'inline-start') return dir === 'rtl' ? 'right' : 'left'
  if (side === 'inline-end') return dir === 'rtl' ? 'left' : 'right'
  return side
}

function toPlacement(
  side: 'top' | 'bottom' | 'left' | 'right',
  align: PopupAlign,
  vertical: boolean,
  dir: TextDirection,
) {
  if (align === 'center') return side
  // On the top and bottom sides, `start` is the leading inline edge, which is right in RTL.
  let edge = vertical && dir === 'rtl' ? (align === 'start' ? 'end' : 'start') : align
  return `${side}-${edge}` as const
}

// Positive `alignOffset` moves the popup away from the aligned edge (Base UI / Floating UI).
function getAlignOffsetSign(align: PopupAlign, vertical: boolean, dir: TextDirection) {
  let rtl = vertical && dir === 'rtl'
  if (align === 'end') return rtl ? 1 : -1
  return rtl ? -1 : 1
}

function resolveFocusTarget(
  value: PopupFocusTarget | undefined,
  popup: HTMLElement,
  type: PopupInteractionType | null,
  scoped: boolean,
): HTMLElement | boolean {
  let result: boolean | string | HTMLElement | null | void =
    typeof value === 'function' ? value(type) : value
  if (typeof value === 'function' && result === undefined) return false
  if (result === undefined || result === null || result === true) return true
  if (result === false) return false
  if (typeof result === 'string') {
    let root: ParentNode = scoped ? popup : popup.ownerDocument
    return root.querySelector<HTMLElement>(result) ?? true
  }
  return result
}

const FOCUSABLE =
  'a[href], area[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), iframe, summary, [tabindex], [contenteditable]:not([contenteditable="false"])'

function isFocusableOutside(target: EventTarget | null | undefined, popup: HTMLElement) {
  if (!(target instanceof Element) || popup.contains(target)) return false
  return target.closest(FOCUSABLE) !== null
}
