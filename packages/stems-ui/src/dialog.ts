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
  descriptionMixin,
  DialogRoot,
  popupMixin,
  titleMixin,
  triggerMixin,
  type DialogBackdropOptions,
  type DialogChangeReason,
  type DialogCloseOptions,
  type DialogPopupOptions,
  type DialogRootProps,
  type DialogTriggerOptions,
} from './lib/dialog-root.ts'

export type {
  DialogActions,
  DialogBackdropOptions,
  DialogChangeDetails,
  DialogChangeReason,
  DialogCloseOptions,
  DialogFocusTarget,
  DialogInteractionType,
  DialogModal,
  DialogPopupOptions,
  DialogTriggerOptions,
} from './lib/dialog-root.ts'

const DIALOG_CHANGE_EVENT = 'stems:dialog-change' as const

declare global {
  interface HTMLElementEventMap {
    [DIALOG_CHANGE_EVENT]: DialogChangeEvent
  }
}

/** Bubbling event dispatched from the popup when a dialog opens or closes. */
export class DialogChangeEvent extends Event {
  readonly open: boolean
  readonly reason: DialogChangeReason

  constructor(open: boolean, reason: DialogChangeReason) {
    super(DIALOG_CHANGE_EVENT, { bubbles: true })
    this.open = open
    this.reason = reason
  }
}

export type DialogContextProps = DialogRootProps

function createChangeEvent(open: boolean, reason: DialogChangeReason) {
  return new DialogChangeEvent(open, reason)
}

function DialogProvider(handle: Handle<DialogContextProps>): () => RemixNode {
  return () => {
    let { children, ...props } = handle.props
    return createElement(
      DialogRoot,
      { ...props, _kind: 'dialog', _createEvent: createChangeEvent },
      children,
    )
  }
}

/**
 * Provider that owns the open state. Props: `open` / `defaultOpen` / `onOpenChange` /
 * `onOpenChangeComplete`, `modal` (`true` | `false` | `'trap-focus'`),
 * `disablePointerDismissal`, `actionsRef`.
 */
export const Context: (handle: Handle<DialogContextProps>) => () => RemixNode = DialogProvider

/**
 * The button that opens the dialog: `aria-haspopup="dialog"`, `aria-expanded`,
 * `aria-controls`, `data-popup-open`, `data-disabled`. Non-button hosts get `role="button"`,
 * `tabIndex`, and Enter/Space activation.
 */
export const trigger: MixinFactory<HTMLElement, [options?: DialogTriggerOptions], ElementProps> =
  triggerMixin

/**
 * The `<dialog>` element. Opens with `showModal()` (modal) or `show()`, and closes with
 * `close()` once its exit animation finishes. `data-open` / `data-closed`,
 * `data-starting-style` / `data-ending-style`, `data-nested`, `data-nested-dialog-open`, and
 * `--nested-dialogs`. Options: `initialFocus`, `finalFocus`.
 */
export const popup: MixinFactory<HTMLDialogElement, [options?: DialogPopupOptions], ElementProps> =
  popupMixin

/**
 * Optional separate backdrop element (render it before the `<dialog>`, not inside a transformed
 * popup). Hidden while the dialog is closed and for nested dialogs unless `forceRender`.
 * Presses on it are outside presses. For modal dialogs, styling `::backdrop` is usually simpler.
 */
export const backdrop: MixinFactory<HTMLElement, [options?: DialogBackdropOptions], ElementProps> =
  backdropMixin

/** Labels the popup (`aria-labelledby`). */
export const title: MixinFactory<HTMLElement, [], ElementProps> = titleMixin

/** Describes the popup (`aria-describedby`). */
export const description: MixinFactory<HTMLElement, [], ElementProps> = descriptionMixin

/** A button that closes the dialog (reason `'close-press'`). */
export const close: MixinFactory<HTMLElement, [options?: DialogCloseOptions], ElementProps> =
  closeMixin

/** Listens for the bubbling `stems:dialog-change` event. */
export function onDialogChange<target extends HTMLElement>(
  handler: (
    event: Dispatched<DialogChangeEvent, target>,
    signal: AbortSignal,
  ) => void | Promise<void>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof DIALOG_CHANGE_EVENT>> {
  return on(DIALOG_CHANGE_EVENT, handler, captureBoolean)
}
