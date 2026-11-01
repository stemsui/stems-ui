import { createMixin, on } from '@remix-run/component'
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
  createPopupStore,
  createPopupSurface,
} from './lib/popup.ts'
import type {
  PopupOpenChangeDetails,
  PopupOpenChangeReason,
  PopupPositionOptions,
  PopupStore,
} from './lib/popup.ts'
import { createHintTrigger } from './lib/tooltip-trigger.ts'

export type {
  PopupAlign as PreviewCardAlign,
  PopupAnchor as PreviewCardAnchor,
  PopupOffsetFunction as PreviewCardOffsetFunction,
  PopupSide as PreviewCardSide,
} from './lib/popup.ts'

const PREVIEW_CARD_CHANGE_EVENT = 'stems:preview-card-change' as const

/** Base UI's preview card change reasons. */
export type PreviewCardOpenChangeReason = Extract<
  PopupOpenChangeReason,
  | 'trigger-hover'
  | 'trigger-focus'
  | 'trigger-press'
  | 'outside-press'
  | 'escape-key'
  | 'focus-out'
  | 'imperative-action'
  | 'none'
>

export interface PreviewCardOpenChangeDetails extends PopupOpenChangeDetails {}

declare global {
  interface HTMLElementEventMap {
    [PREVIEW_CARD_CHANGE_EVENT]: PreviewCardChangeEvent
  }
}

/** Bubbling event dispatched from the active trigger when the preview card opens or closes. */
export class PreviewCardChangeEvent extends Event {
  readonly open: boolean
  readonly reason: PopupOpenChangeReason

  constructor(open: boolean, reason: PopupOpenChangeReason) {
    super(PREVIEW_CARD_CHANGE_EVENT, { bubbles: true })
    this.open = open
    this.reason = reason
  }
}

export interface PreviewCardContextProps {
  /** Whether the preview card is open (controlled). */
  open?: boolean
  /**
   * Whether the preview card is initially open (uncontrolled).
   * @default false
   */
  defaultOpen?: boolean
  /** Called with the next open state and the change details. Call `details.cancel()` to veto. */
  onOpenChange?: (open: boolean, details: PreviewCardOpenChangeDetails) => void
  /** Called after the enter or exit animation has finished. */
  onOpenChangeComplete?: (open: boolean) => void
  children?: RemixNode
}

/** Trigger options (Base UI's `PreviewCard.Trigger` props). */
export interface PreviewCardTriggerOptions {
  /**
   * How long to wait before opening on hover or keyboard focus, in ms.
   * @default 600
   */
  delay?: number
  /**
   * How long to wait before closing after the pointer leaves, in ms.
   * @default 300
   */
  closeDelay?: number
}

/**
 * Popup options: Base UI's Positioner props (`side`, `align`, `sideOffset`, `alignOffset`,
 * `collisionPadding`, `arrowPadding`, `anchor`). `side` defaults to `'bottom'`.
 */
export interface PreviewCardPopupOptions extends PopupPositionOptions {}

/**
 * Shared preview card state, read with `handle.context.get(previewCard.Context)`: `open`,
 * `openReason`, `setOpen(open, { reason })`, `activeTrigger`, `side` / `align`, …
 */
export interface PreviewCardContextValue extends PopupStore {}

function PreviewCardRoot(
  handle: Handle<PreviewCardContextProps, PreviewCardContextValue>,
): () => RemixNode {
  let store = createPopupStore({
    id: handle.id,
    getProps: () => handle.props,
    update: () => handle.update(),
    signal: handle.signal,
    createChangeEvent: (open, details) => new PreviewCardChangeEvent(open, details.reason),
  })
  handle.context.set(store)

  return () => {
    store.sync()
    return handle.props.children
  }
}

function getStore(handle: MixinHandle<HTMLElement>): PreviewCardContextValue {
  return handle.context.get(PreviewCardRoot)
}

const OPEN_DELAY = 600
const CLOSE_DELAY = 300

const triggerMixin: MixinFactory<HTMLElement, [options?: PreviewCardTriggerOptions], ElementProps> =
  createMixin<HTMLElement, [options?: PreviewCardTriggerOptions], ElementProps>((handle) => {
    let trigger = createHintTrigger(handle, getStore(handle))
    return (options, props) => {
      ;[options] = splitOptions(options, props)
      let triggerOptions = options ?? {}
      return trigger.render(() => {
        let delay = triggerOptions.delay ?? OPEN_DELAY
        return {
          delay,
          closeDelay: triggerOptions.closeDelay ?? CLOSE_DELAY,
          focusDelay: delay,
          disabled: false,
          closeOnClick: false,
          hoverablePopup: true,
          trackPointer: false,
        }
      })
    }
  })

const popupMixin: MixinFactory<HTMLElement, [options?: PreviewCardPopupOptions], ElementProps> =
  createMixin<HTMLElement, [options?: PreviewCardPopupOptions], ElementProps>((handle) => {
    let surface = createPopupSurface(handle, getStore(handle))
    return (options, props) => {
      ;[options, props] = splitOptions(options, props)
      let popupOptions = options ?? {}
      return surface.render(
        {
          ...popupOptions,
          side: popupOptions.side ?? 'bottom',
          // Base UI: the card is a visual preview; it never moves focus.
          initialFocus: false,
          finalFocus: false,
        },
        props,
      )
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

/**
 * Provider that owns the open state (Base UI's `PreviewCard.Root`). Props: `open` /
 * `defaultOpen` / `onOpenChange(open, details)`, `onOpenChangeComplete`.
 */
export const Context: (
  handle: Handle<PreviewCardContextProps, PreviewCardContextValue>,
) => () => RemixNode = PreviewCardRoot

/**
 * A link that opens the preview card on hover and keyboard focus (after `delay`). Renders
 * `data-popup-open`; doesn't change the link's role or press behavior. Options: `delay`
 * (default `600`), `closeDelay` (default `300`).
 */
export const trigger = triggerMixin

/**
 * The card, shown in the top layer with `popover="manual"` and positioned against the trigger
 * (`side` defaults to `'bottom'`). `data-open` / `data-closed`, `data-side` / `data-align`,
 * presence attributes, and the positioning CSS variables. Never takes focus.
 */
export const popup = popupMixin

/** An element inside the popup pointing at the anchor. Positioned with inline `left` / `top`. */
export const arrow = arrowMixin

/** An optional overlay shown in the top layer beneath the popup. */
export const backdrop = backdropMixin

/** Listens for the bubbling `stems:preview-card-change` event. */
export function onPreviewCardChange<target extends HTMLElement>(
  handler: (
    event: Dispatched<PreviewCardChangeEvent, target>,
    signal: AbortSignal,
  ) => void | Promise<void>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof PREVIEW_CARD_CHANGE_EVENT>> {
  return on(PREVIEW_CARD_CHANGE_EVENT, handler, captureBoolean)
}
