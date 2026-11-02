import { attrs, createMixin, on } from '@remix-run/component'
import type {
  Dispatched,
  ElementProps,
  Handle,
  MixinFactory,
  MixinHandle,
  RemixNode,
} from '@remix-run/component'

import type { AnchorPoint } from './anchor.ts'
import { splitOptions } from './lib/collapsible-panel.ts'
import { createDelayGroup } from './lib/delay-group.ts'
import type { DelayGroup, DelayGroupMember } from './lib/delay-group.ts'
import {
  attachPopupHandle,
  bindPopupTrigger,
  createPopupArrow,
  createPopupStore,
  createPopupSurface,
} from './lib/popup.ts'
import type {
  PopupOpenChangeDetails,
  PopupOpenChangeReason,
  PopupPositionOptions,
  PopupStore,
  PopupTriggerIdProps,
} from './lib/popup.ts'
import { createPopupHandle, resolvePayloadChildren } from './lib/popup-handle.ts'
import type { PopupHandle, PopupPayloadChildren } from './lib/popup-handle.ts'
import { createHintTrigger } from './lib/tooltip-trigger.ts'

export type { PopupPayloadState as TooltipPayloadState } from './lib/popup-handle.ts'

export type {
  PopupAlign as TooltipAlign,
  PopupAnchor as TooltipAnchor,
  PopupOffsetFunction as TooltipOffsetFunction,
  PopupSide as TooltipSide,
} from './lib/popup.ts'

const TOOLTIP_CHANGE_EVENT = 'stems:tooltip-change' as const

/** Base UI's tooltip change reasons. */
export type TooltipOpenChangeReason = Extract<
  PopupOpenChangeReason,
  | 'trigger-hover'
  | 'trigger-focus'
  | 'trigger-press'
  | 'outside-press'
  | 'escape-key'
  | 'disabled'
  | 'imperative-action'
  | 'none'
>

export interface TooltipOpenChangeDetails extends PopupOpenChangeDetails {}

/** Base UI's `data-instant` values: why the popup should skip its animation. */
export type TooltipInstantType = 'delay' | 'dismiss' | 'focus'

/** Base UI's `trackCursorAxis`. */
export type TooltipTrackCursorAxis = 'none' | 'x' | 'y' | 'both'

declare global {
  interface HTMLElementEventMap {
    [TOOLTIP_CHANGE_EVENT]: TooltipChangeEvent
  }
}

/** Bubbling event dispatched from the active trigger when the tooltip opens or closes. */
export class TooltipChangeEvent extends Event {
  readonly open: boolean
  readonly reason: PopupOpenChangeReason

  constructor(open: boolean, reason: PopupOpenChangeReason) {
    super(TOOLTIP_CHANGE_EVENT, { bubbles: true })
    this.open = open
    this.reason = reason
  }
}

// ---------------------------------------------------------------------------------------------
// Provider (delay group)

/** Base UI's `Tooltip.Provider` props. */
export interface TooltipProviderProps {
  /** Hover-open delay for tooltips whose trigger doesn't set `delay`, in ms. */
  delay?: number
  /** Hover-close delay for tooltips whose trigger doesn't set `closeDelay`, in ms. */
  closeDelay?: number
  /**
   * Another tooltip opens instantly if the previous one closed less than this long ago, in ms.
   * @default 400
   */
  timeout?: number
  children?: RemixNode
}

function TooltipDelayProvider(handle: Handle<TooltipProviderProps, DelayGroup>): () => RemixNode {
  let group = createDelayGroup(() => handle.props)
  handle.context.set(group)
  return () => handle.props.children
}

// ---------------------------------------------------------------------------------------------
// Context (root)

/**
 * Links a `Context` with triggers rendered outside it (Base UI's `Tooltip.Handle`): `isOpen`,
 * `open(triggerId?)`, `close()`.
 */
export type TooltipHandle<Payload = unknown> = PopupHandle<Payload, 'tooltip'>

/** Creates a handle for detached triggers (Base UI's `Tooltip.createHandle()`). */
export function createHandle<Payload = unknown>(): TooltipHandle<Payload> {
  return createPopupHandle<Payload, 'tooltip'>('tooltip')
}

export interface TooltipContextProps<Payload = unknown> extends PopupTriggerIdProps {
  /** Connects triggers rendered outside the `Context` (`trigger({ handle })`). Read once. */
  handle?: TooltipHandle<Payload>
  /** Whether the tooltip is open (controlled). */
  open?: boolean
  /**
   * Whether the tooltip is initially open (uncontrolled).
   * @default false
   */
  defaultOpen?: boolean
  /** Called with the next open state and the change details. Call `details.cancel()` to veto. */
  onOpenChange?: (open: boolean, details: TooltipOpenChangeDetails) => void
  /** Called after the enter or exit animation has finished. */
  onOpenChangeComplete?: (open: boolean) => void
  /**
   * Whether the tooltip is disabled: triggers don't open it, and an open tooltip closes
   * (reason `'disabled'`).
   * @default false
   */
  disabled?: boolean
  /**
   * Whether the tooltip closes as soon as the pointer leaves the trigger, instead of staying
   * open while the pointer moves onto the popup.
   * @default false
   */
  disableHoverablePopup?: boolean
  /**
   * Which axis the popup follows the cursor on while the pointer is over the trigger. `'both'`
   * also disables the hoverable popup.
   * @default 'none'
   */
  trackCursorAxis?: TooltipTrackCursorAxis
  /** Nodes, or a function of `{ payload }` (the active trigger's `payload`). */
  children?: PopupPayloadChildren<RemixNode, Payload>
}

/** Trigger options (Base UI's `Tooltip.Trigger` props). */
export interface TooltipTriggerOptions {
  /** The tooltip to control when the trigger is outside its `Context`. Read once. */
  handle?: TooltipHandle<any>
  /** Data for the popup while this trigger is active (`payload` in the `Context`). */
  payload?: unknown
  /**
   * Hover-open delay in ms. Inside a `Provider`, defaults to the provider's `delay`, and is `0`
   * while another tooltip of the group is open or just closed.
   * @default 600
   */
  delay?: number
  /**
   * Hover-close delay in ms. Inside a `Provider`, defaults to the provider's `closeDelay`.
   * @default 0
   */
  closeDelay?: number
  /**
   * Whether pressing the trigger closes the tooltip.
   * @default true
   */
  closeOnClick?: boolean
  /**
   * Don't open from this trigger. Doesn't disable the element itself.
   * @default false
   */
  disabled?: boolean
}

/**
 * Popup options: Base UI's Positioner props (`side`, `align`, `sideOffset`, `alignOffset`,
 * `collisionPadding`, `arrowPadding`, `anchor`). `side` defaults to `'top'`.
 */
export interface TooltipPopupOptions extends PopupPositionOptions {}

/**
 * Shared tooltip state, read with `handle.context.get(tooltip.Context)`: everything on the
 * popup store (`open`, `openReason`, `setOpen(open, { reason })`, `activeTrigger`, `side`, …)
 * plus the tooltip's own state.
 */
export interface TooltipContextValue extends PopupStore {
  /** Base UI's `instant`: why the popup should skip its animation right now, if at all. */
  readonly instant: TooltipInstantType | undefined
  readonly disabled: boolean
  readonly disableHoverablePopup: boolean
  readonly trackCursorAxis: TooltipTrackCursorAxis
  /** The enclosing `Provider`'s delay group, if any. */
  readonly group: DelayGroup | null
  /** @internal */
  _trackPointer(event: PointerEvent): void
  /** @internal */
  _cursorAnchor(): AnchorPoint | null
}

function TooltipRoot(handle: Handle<TooltipContextProps, TooltipContextValue>): () => RemixNode {
  let group = (handle.context.get(TooltipDelayProvider) as DelayGroup | undefined) ?? null
  let instantType: TooltipInstantType | undefined
  let instantPhase = false
  let closedForSibling = false
  let cursor: { x: number; y: number } | null = null
  let cursorAnchor: AnchorPoint | null = null
  let frame = 0

  let store = createPopupStore({
    id: handle.id,
    getProps: () => handle.props,
    update: () => handle.update(),
    signal: handle.signal,
    createChangeEvent: (open, details) => new TooltipChangeEvent(open, details.reason),
    handle: handle.props.handle,
  })

  let member: DelayGroupMember = {
    isOpen: () => store.open,
    closeForSibling() {
      closedForSibling = true
      if (store.open) store.setOpen(false, { reason: 'none' })
      else void handle.update()
    },
    setInstantPhase(value) {
      if (instantPhase === value) return
      instantPhase = value
      void handle.update()
    },
  }

  handle.signal.addEventListener('abort', () => {
    group?.remove(member)
    cancelAnimationFrame(frame)
  })

  let context = Object.create(store, {
    instant: {
      get: (): TooltipInstantType | undefined =>
        (store.open ? instantPhase : closedForSibling) ? 'delay' : instantType,
    },
    disabled: { get: () => handle.props.disabled ?? false },
    disableHoverablePopup: { get: () => handle.props.disableHoverablePopup ?? false },
    trackCursorAxis: { get: () => handle.props.trackCursorAxis ?? 'none' },
    group: { value: group },
    _trackPointer: {
      value(event: PointerEvent) {
        cursor = { x: event.clientX, y: event.clientY }
        if (!store.open || frame) return
        frame = requestAnimationFrame(() => {
          frame = 0
          if (store.open) void handle.update()
        })
      },
    },
    _cursorAnchor: {
      value(): AnchorPoint | null {
        let axis = handle.props.trackCursorAxis ?? 'none'
        let trigger = store.activeTrigger
        if (axis === 'none' || !cursor || !trigger) return null
        let rect = trigger.getBoundingClientRect()
        let next: AnchorPoint =
          axis === 'x'
            ? { x: cursor.x, y: rect.top, width: 0, height: rect.height }
            : axis === 'y'
              ? { x: rect.left, y: cursor.y, width: rect.width, height: 0 }
              : { x: cursor.x, y: cursor.y, width: 0, height: 0 }
        // Keep the identity while unchanged so the popup doesn't restart positioning.
        if (
          !cursorAnchor ||
          cursorAnchor.x !== next.x ||
          cursorAnchor.y !== next.y ||
          cursorAnchor.width !== next.width ||
          cursorAnchor.height !== next.height
        ) {
          cursorAnchor = next
        }
        return cursorAnchor
      },
    },
  }) as TooltipContextValue
  handle.context.set(context)
  attachPopupHandle(handle.props.handle, context, store, handle.signal)

  let lastOpen = store.open
  if (lastOpen && group) group.notifyOpen(member)

  return () => {
    store.sync()
    let open = store.open

    if (open !== lastOpen) {
      lastOpen = open
      let reason = store.lastChange?.reason ?? 'none'
      if (open) {
        closedForSibling = false
        if (reason === 'trigger-focus') instantType = 'focus'
        else if (reason === 'trigger-hover') instantType = undefined
        instantPhase = group ? group.notifyOpen(member) : false
      } else {
        if (reason === 'trigger-press' || reason === 'escape-key') instantType = 'dismiss'
        else if (reason === 'trigger-hover') instantType = undefined
        if (!closedForSibling) instantPhase = false
        cursorAnchor = null
        group?.notifyClose(member)
      }
    }

    if (open && handle.props.disabled) {
      handle.queueTask(() => {
        if (handle.props.disabled && store.open) store.setOpen(false, { reason: 'disabled' })
      })
    }

    return resolvePayloadChildren(handle.props.children, store.payload)
  }
}

// A detached trigger's context while no `Context` is attached: closed and inert.
function detachedContext(store: PopupStore): TooltipContextValue {
  return Object.create(store, {
    instant: { value: undefined },
    disabled: { value: false },
    disableHoverablePopup: { value: false },
    trackCursorAxis: { value: 'none' },
    group: { value: null },
    _trackPointer: { value() {} },
    _cursorAnchor: { value: () => null },
  }) as TooltipContextValue
}

function getContext(handle: MixinHandle<HTMLElement>): TooltipContextValue {
  return handle.context.get(TooltipRoot)
}

const OPEN_DELAY = 600

const triggerMixin: MixinFactory<HTMLElement, [options?: TooltipTriggerOptions], ElementProps> =
  createMixin<HTMLElement, [options?: TooltipTriggerOptions], ElementProps>((handle) => {
    let binding = bindPopupTrigger(
      handle,
      getContext(handle) as TooltipContextValue | undefined,
      detachedContext,
    )
    let context = binding.context
    let trigger = createHintTrigger(handle, context, {
      onPointer: (event) => context._trackPointer(event),
      isDetached: () => binding.detached,
    })
    return (options, props) => {
      ;[options] = splitOptions(options, props)
      let triggerOptions = options ?? {}
      binding.bind(triggerOptions.handle, () => {
        trigger.refresh()
        let node = trigger.entry.node
        if (!node) return
        let disabled = context.disabled || (triggerOptions.disabled ?? false)
        node.toggleAttribute('data-trigger-disabled', disabled)
      })
      let disabled = context.disabled || (triggerOptions.disabled ?? false)
      return [
        attrs({ 'data-trigger-disabled': disabled ? '' : undefined }),
        trigger.render(() => {
          let group = context.group
          let axis = context.trackCursorAxis
          return {
            delay: group
              ? group.openDelay(triggerOptions.delay, OPEN_DELAY)
              : (triggerOptions.delay ?? OPEN_DELAY),
            closeDelay: group
              ? group.closeDelay(triggerOptions.closeDelay, 0)
              : (triggerOptions.closeDelay ?? 0),
            focusDelay: 0,
            disabled: context.disabled || (triggerOptions.disabled ?? false),
            closeOnClick: triggerOptions.closeOnClick ?? true,
            hoverablePopup: !context.disableHoverablePopup && axis !== 'both',
            trackPointer: axis !== 'none',
            payload: triggerOptions.payload,
          }
        }),
      ]
    }
  })

const popupMixin: MixinFactory<HTMLElement, [options?: TooltipPopupOptions], ElementProps> =
  createMixin<HTMLElement, [options?: TooltipPopupOptions], ElementProps>((handle) => {
    let context = getContext(handle)
    let surface = createPopupSurface(handle, context)
    let cursorAnchor = () => context._cursorAnchor()
    return (options, props) => {
      ;[options, props] = splitOptions(options, props)
      let popupOptions = options ?? {}
      return [
        attrs({ role: 'tooltip', 'data-instant': context.instant }),
        surface.render(
          {
            ...popupOptions,
            side: popupOptions.side ?? 'top',
            anchor:
              popupOptions.anchor ??
              (context.trackCursorAxis !== 'none' ? cursorAnchor : undefined),
            // Tooltips never move focus.
            initialFocus: false,
            finalFocus: false,
          },
          props,
        ),
      ]
    }
  })

const arrowMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let context = getContext(handle)
  let arrow = createPopupArrow(handle, context)
  return () => [attrs({ 'data-instant': context.instant }), arrow.render()]
})

/**
 * Shares hover delays between the tooltips inside it (Base UI's `Tooltip.Provider`): once one
 * tooltip is open, hovering an adjacent trigger opens its tooltip instantly. Props: `delay`,
 * `closeDelay`, `timeout` (default `400`).
 */
export const Provider: (handle: Handle<TooltipProviderProps, DelayGroup>) => () => RemixNode =
  TooltipDelayProvider

/**
 * Provider that owns one tooltip's open state (Base UI's `Tooltip.Root`). Props: `open` /
 * `defaultOpen` / `onOpenChange(open, details)`, `onOpenChangeComplete`, `disabled`,
 * `disableHoverablePopup`, `trackCursorAxis`, `handle`, `triggerId` / `defaultTriggerId`.
 * `children` may be a function of `{ payload }`.
 */
export const Context: <Payload = unknown>(
  handle: Handle<TooltipContextProps<Payload>, TooltipContextValue>,
) => () => RemixNode = TooltipRoot as any

/**
 * The element the tooltip describes. Opens it on hover (after `delay`) and on keyboard focus;
 * closes it on press, blur, and pointer leave. Renders `data-popup-open` and
 * `data-trigger-disabled`. Options: `delay`, `closeDelay`, `closeOnClick`, `disabled`, and
 * `handle` / `payload` for a trigger outside the `Context`.
 */
export const trigger = triggerMixin

/**
 * The tooltip, shown in the top layer with `popover="manual"` and positioned against the
 * trigger (`side` defaults to `'top'`). `role="tooltip"`, `data-open` / `data-closed`,
 * `data-side` / `data-align`, `data-instant`, presence attributes, and the positioning CSS
 * variables. Never takes focus.
 */
export const popup = popupMixin

/** An element inside the popup pointing at the anchor. Positioned with inline `left` / `top`. */
export const arrow = arrowMixin

/** Listens for the bubbling `stems:tooltip-change` event. */
export function onTooltipChange<target extends HTMLElement>(
  handler: (
    event: Dispatched<TooltipChangeEvent, target>,
    signal: AbortSignal,
  ) => void | Promise<void>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof TOOLTIP_CHANGE_EVENT>> {
  return on(TOOLTIP_CHANGE_EVENT, handler, captureBoolean)
}
