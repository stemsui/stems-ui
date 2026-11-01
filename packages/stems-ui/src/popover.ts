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
  PopupTriggerOptions,
} from './lib/popup.ts'

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

export interface PopoverContextProps extends PopupStateProps {
  children?: RemixNode
}

/** Trigger options: `disabled`, and Base UI's `openOnHover` / `delay` / `closeDelay`. */
export interface PopoverTriggerOptions extends PopupTriggerOptions {}

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
  let store = createPopupStore({
    id: handle.id,
    getProps: () => handle.props,
    update: () => handle.update(),
    signal: handle.signal,
    createChangeEvent: (open, details) => new PopoverChangeEvent(open, details.reason),
  })
  handle.context.set(store)

  return () => {
    store.sync()
    return handle.props.children
  }
}

function getStore(handle: MixinHandle<HTMLElement>): PopoverContextValue {
  return handle.context.get(PopoverProvider)
}

const triggerMixin: MixinFactory<HTMLElement, [options?: PopoverTriggerOptions], ElementProps> =
  createMixin<HTMLElement, [options?: PopoverTriggerOptions], ElementProps>((handle, hostType) => {
    let trigger = createPopupTrigger(handle, hostType, getStore(handle), { haspopup: 'dialog' })
    return (options, props) => {
      ;[options] = splitOptions(options, props)
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
 * `'trap-focus'`).
 */
export const Context: (
  handle: Handle<PopoverContextProps, PopoverContextValue>,
) => () => RemixNode = PopoverProvider

/**
 * The button that toggles the popover: `aria-haspopup="dialog"`, `aria-expanded`,
 * `aria-controls`, `data-popup-open`, `data-disabled`. Options: `disabled`, `openOnHover`,
 * `delay`, `closeDelay`.
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
