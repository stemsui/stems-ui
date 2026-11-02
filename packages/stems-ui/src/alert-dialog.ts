import { createElement, on } from '@remix-run/component'
import type {
  Dispatched,
  ElementProps,
  Handle,
  MixinFactory,
  RemixNode,
} from '@remix-run/component'

import {
  backdropMixin,
  closeMixin,
  createDialogHandle,
  descriptionMixin,
  DialogRoot,
  popupMixin,
  titleMixin,
  triggerMixin,
  type DialogBackdropOptions,
  type DialogChangeReason,
  type DialogCloseOptions,
  type DialogHandle,
  type DialogPopupOptions,
  type DialogRootProps,
  type DialogTriggerOptions,
} from './lib/dialog-root.ts'

export type { PopupPayloadState as AlertDialogPayloadState } from './lib/popup-handle.ts'

export type {
  DialogHandle as AlertDialogHandle,
  DialogActions as AlertDialogActions,
  DialogBackdropOptions as AlertDialogBackdropOptions,
  DialogChangeDetails as AlertDialogChangeDetails,
  DialogChangeReason as AlertDialogChangeReason,
  DialogCloseOptions as AlertDialogCloseOptions,
  DialogFocusTarget as AlertDialogFocusTarget,
  DialogInteractionType as AlertDialogInteractionType,
  DialogPopupOptions as AlertDialogPopupOptions,
  DialogTriggerOptions as AlertDialogTriggerOptions,
} from './lib/dialog-root.ts'

const ALERT_DIALOG_CHANGE_EVENT = 'stems:alert-dialog-change' as const

declare global {
  interface HTMLElementEventMap {
    [ALERT_DIALOG_CHANGE_EVENT]: AlertDialogChangeEvent
  }
}

/** Bubbling event dispatched from the popup when an alert dialog opens or closes. */
export class AlertDialogChangeEvent extends Event {
  readonly open: boolean
  readonly reason: DialogChangeReason

  constructor(open: boolean, reason: DialogChangeReason) {
    super(ALERT_DIALOG_CHANGE_EVENT, { bubbles: true })
    this.open = open
    this.reason = reason
  }
}

/** Alert dialogs are always modal and ignore outside presses, so those props don't exist. */
export type AlertDialogContextProps<Payload = unknown> = Omit<
  DialogRootProps<Payload>,
  'modal' | 'disablePointerDismissal'
>

/**
 * Creates a handle for triggers rendered outside the `Context` (Base UI's
 * `AlertDialog.createHandle()`): `isOpen`, `open(triggerId?)`, `openWithPayload(payload)`,
 * `close()`.
 */
export const createHandle: <Payload = unknown>() => DialogHandle<Payload> = createDialogHandle

function createChangeEvent(open: boolean, reason: DialogChangeReason) {
  return new AlertDialogChangeEvent(open, reason)
}

function AlertDialogProvider(handle: Handle<AlertDialogContextProps>): () => RemixNode {
  return () => {
    let { children, ...props } = handle.props
    // `children` may be a payload render function, which `createElement` rejects as a child.
    return createElement(DialogRoot, {
      ...props,
      _children: children,
      modal: true,
      disablePointerDismissal: true,
      _kind: 'alert-dialog',
      _createEvent: createChangeEvent,
    })
  }
}

/**
 * Provider that owns the open state. Props: `open` / `defaultOpen` / `onOpenChange` /
 * `onOpenChangeComplete`, `actionsRef`, `handle`, `triggerId` / `defaultTriggerId`. Always
 * modal; outside presses never dismiss it, Escape does. `children` may be a function of
 * `{ payload }`.
 */
export const Context: <Payload = unknown>(
  handle: Handle<AlertDialogContextProps<Payload>>,
) => () => RemixNode = AlertDialogProvider as any

/** The button that opens the alert dialog. Same contract as `dialog.trigger()`. */
export const trigger: MixinFactory<HTMLElement, [options?: DialogTriggerOptions], ElementProps> =
  triggerMixin

/**
 * The `<dialog>` element, opened with `showModal()`, with `role="alertdialog"`. Same data
 * attributes and CSS variables as `dialog.popup()`.
 */
export const popup: MixinFactory<HTMLDialogElement, [options?: DialogPopupOptions], ElementProps> =
  popupMixin

/** Optional separate backdrop element; presses on it do not dismiss an alert dialog. */
export const backdrop: MixinFactory<HTMLElement, [options?: DialogBackdropOptions], ElementProps> =
  backdropMixin

/** Labels the popup (`aria-labelledby`). */
export const title: MixinFactory<HTMLElement, [], ElementProps> = titleMixin

/** Describes the popup (`aria-describedby`). */
export const description: MixinFactory<HTMLElement, [], ElementProps> = descriptionMixin

/** A button that closes the alert dialog (reason `'close-press'`). */
export const close: MixinFactory<HTMLElement, [options?: DialogCloseOptions], ElementProps> =
  closeMixin

/** Listens for the bubbling `stems:alert-dialog-change` event. */
export function onAlertDialogChange<target extends HTMLElement>(
  handler: (
    event: Dispatched<AlertDialogChangeEvent, target>,
    signal: AbortSignal,
  ) => void | Promise<void>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof ALERT_DIALOG_CHANGE_EVENT>> {
  return on(ALERT_DIALOG_CHANGE_EVENT, handler, captureBoolean)
}
