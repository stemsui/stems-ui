// Adapted from @remix-run/ui 0.13.0 (packages/ui/src/popover.ts).
// https://github.com/remix-run/remix - Copyright (c) 2025 Shopify Inc. MIT License.

import { attrs, createMixin, on } from '@remix-run/component'
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
  attachPopupHandle,
  bindPopupTrigger,
  createPopupArrow,
  createPopupBackdrop,
  createPopupClose,
  createPopupLabel,
  createPopupStore,
  createPopupSurface,
  createPopupTrigger,
} from './lib/popup.ts'
import type {
  PopupOpenChangeReason,
  PopupStateProps,
  PopupStore,
  PopupSurfaceOptions,
  PopupTriggerIdProps,
  PopupTriggerOptions,
} from './lib/popup.ts'
import { createPopupHandle, resolvePayloadChildren } from './lib/popup-handle.ts'
import type { PopupHandle, PopupPayloadChildren } from './lib/popup-handle.ts'

export type { PopupPayloadState as PopoverPayloadState } from './lib/popup-handle.ts'

export type {
  PopupAlign as PopoverAlign,
  PopupAnchor as PopoverAnchor,
  PopupFocusTarget as PopoverFocusTarget,
  PopupInteractionType as PopoverInteractionType,
  PopupModal as PopoverModal,
  PopupOffsetFunction as PopoverOffsetFunction,
  PopupOpenChangeDetails as PopoverOpenChangeDetails,
  PopupOpenChangeReason as PopoverOpenChangeReason,
  PopupSide as PopoverSide,
} from './lib/popup.ts'

const POPOVER_CHANGE_EVENT = 'stems:popover-change' as const

declare global {
  interface HTMLElementEventMap {
    [POPOVER_CHANGE_EVENT]: PopoverChangeEvent
  }
}

/** Bubbling event dispatched from the active trigger when the popover opens or closes. */
export class PopoverChangeEvent extends Event {
  readonly open: boolean
  readonly reason: PopupOpenChangeReason

  constructor(open: boolean, reason: PopupOpenChangeReason) {
    super(POPOVER_CHANGE_EVENT, { bubbles: true })
    this.open = open
    this.reason = reason
  }
}

/**
 * Links a `Context` with triggers rendered outside it (Base UI's `Popover.Handle`). Create one
 * with `createHandle()`. `isOpen`, `open(triggerId?)`, and `close()` act on the attached
 * `Context` and are ignored while none is mounted.
 */
export type PopoverHandle<Payload = unknown> = PopupHandle<Payload, 'popover'>

/** Creates a handle for detached triggers (Base UI's `Popover.createHandle()`). */
export function createHandle<Payload = unknown>(): PopoverHandle<Payload> {
  return createPopupHandle<Payload, 'popover'>('popover')
}

export interface PopoverContextProps<Payload = unknown>
  extends PopupStateProps, PopupTriggerIdProps {
  /**
   * Nodes, or a function of `{ payload }` (the active trigger's `payload`), re-run whenever the
   * provider renders.
   */
  children?: PopupPayloadChildren<RemixNode, Payload>
  /** Connects triggers rendered outside the `Context` (`trigger({ handle })`). Read once. */
  handle?: PopoverHandle<Payload>
}

/**
 * Trigger options: `disabled`, Base UI's `openOnHover` / `delay` / `closeDelay`, and the
 * detached-trigger options `handle` / `payload`.
 */
export interface PopoverTriggerOptions extends PopupTriggerOptions {
  /** The popover to control when the trigger is outside its `Context`. Read on first render. */
  handle?: PopoverHandle<any>
  /** Data for the popup while this trigger is active (`payload` in the `Context`). */
  payload?: unknown
}

/**
 * Popup options: Base UI's Positioner props (`side`, `align`, `sideOffset`, `alignOffset`,
 * `collisionPadding`, `arrowPadding`, `anchor`) and Popup props (`initialFocus`, `finalFocus`).
 */
export interface PopoverPopupOptions extends PopupSurfaceOptions {}

/**
 * Shared popover state, read with `handle.context.get(popover.Context)`: `open`, `openReason`,
 * `setOpen(open, { reason })`, `activeTrigger`, `side` / `align`, …
 */
export interface PopoverContextValue extends PopupStore {}

function PopoverProvider(
  handle: Handle<PopoverContextProps, PopoverContextValue>,
): () => RemixNode {
  let popupHandle = handle.props.handle
  let store = createPopupStore({
    id: handle.id,
    getProps: () => handle.props,
    update: () => handle.update(),
    signal: handle.signal,
    createChangeEvent: (open, details) => new PopoverChangeEvent(open, details.reason),
    handle: popupHandle,
  })
  handle.context.set(store)
  attachPopupHandle(popupHandle, store, store, handle.signal)

  return () => {
    store.sync()
    return resolvePayloadChildren(handle.props.children, store.payload)
  }
}

function getStore(handle: MixinHandle<HTMLElement>): PopoverContextValue {
  return handle.context.get(PopoverProvider)
}

const triggerMixin: MixinFactory<HTMLElement, [options?: PopoverTriggerOptions], ElementProps> =
  createMixin<HTMLElement, [options?: PopoverTriggerOptions], ElementProps>((handle, hostType) => {
    let binding = bindPopupTrigger(handle, getStore(handle) as PopoverContextValue | undefined)
    let trigger = createPopupTrigger(handle, hostType, binding.context, {
      haspopup: 'dialog',
      isDetached: () => binding.detached,
    })
    return (options, props) => {
      ;[options] = splitOptions(options, props)
      binding.bind(options?.handle, trigger.refresh)
      return trigger.render(options)
    }
  })

const popupMixin: MixinFactory<HTMLElement, [options?: PopoverPopupOptions], ElementProps> =
  createMixin<HTMLElement, [options?: PopoverPopupOptions], ElementProps>((handle) => {
    let store = getStore(handle)
    let surface = createPopupSurface(handle, store)
    return (options, props) => {
      ;[options, props] = splitOptions(options, props)
      return [
        attrs({
          role: 'dialog',
          'aria-labelledby': store.titleId,
          'aria-describedby': store.descriptionId,
          'aria-modal': store.modal === true ? 'true' : undefined,
        }),
        surface.render(options ?? {}, props),
      ]
    }
  })

const arrowMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let arrow = createPopupArrow(handle, getStore(handle))
  return () => arrow.render()
})

const backdropMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let backdrop = createPopupBackdrop(handle, getStore(handle))
  return () => backdrop.render()
})

const titleMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let label = createPopupLabel(handle, getStore(handle), 'title')
  return (props) => label.render(props)
})

const descriptionMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let label = createPopupLabel(handle, getStore(handle), 'description')
  return (props) => label.render(props)
})

const closeMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle, hostType) => {
  let close = createPopupClose(handle, hostType, getStore(handle))
  return () => close.render()
})

/**
 * Provider that owns the open state. Props: `open` / `defaultOpen` /
 * `onOpenChange(open, details)`, `onOpenChangeComplete`, `modal` (`false` | `true` |
 * `'trap-focus'`), `handle`, `triggerId` / `defaultTriggerId`. `children` may be a function of
 * `{ payload }`.
 */
export const Context: <Payload = unknown>(
  handle: Handle<PopoverContextProps<Payload>, PopoverContextValue>,
) => () => RemixNode = PopoverProvider as any

/**
 * The button that toggles the popover: `aria-haspopup="dialog"`, `aria-expanded`,
 * `aria-controls`, `data-popup-open`, `data-disabled`. Options: `disabled`, `openOnHover`,
 * `delay`, `closeDelay`, and `handle` / `payload` for a trigger outside the `Context`.
 */
export const trigger = triggerMixin

/**
 * The popup, shown in the top layer with `popover="manual"` and positioned against the trigger.
 * Combines Base UI's Positioner and Popup: `role="dialog"`, labelling, `data-open` /
 * `data-closed`, `data-side` / `data-align`, presence attributes, and the positioning CSS
 * variables.
 */
export const popup = popupMixin

/** An element inside the popup pointing at the anchor. Positioned with inline `left` / `top`. */
export const arrow = arrowMixin

/** An optional overlay shown in the top layer beneath the popup. */
export const backdrop = backdropMixin

/** Labels the popup (`aria-labelledby`). */
export const title = titleMixin

/** Describes the popup (`aria-describedby`). */
export const description = descriptionMixin

/** A button inside the popup that closes it (reason `'close-press'`). */
export const close = closeMixin

/** Listens for the bubbling `stems:popover-change` event. */
export function onPopoverChange<target extends HTMLElement>(
  handler: (
    event: Dispatched<PopoverChangeEvent, target>,
    signal: AbortSignal,
  ) => void | Promise<void>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof POPOVER_CHANGE_EVENT>> {
  return on(POPOVER_CHANGE_EVENT, handler, captureBoolean)
}
