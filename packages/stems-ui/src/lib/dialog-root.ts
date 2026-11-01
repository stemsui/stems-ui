/**
 * The shared engine behind `stems-ui/dialog`, `stems-ui/alert-dialog`, and `stems-ui/drawer`.
 *
 * - The popup is a native `<dialog>`: `showModal()` for `modal: true` (top layer, inert page,
 *   `::backdrop`), `show()` for `modal: false | 'trap-focus'`. The closed dialog stays mounted
 *   (`display: none` by the UA stylesheet), so state attributes render on the server.
 * - Escape and outside presses go through `lib/dismiss-layer.ts`. The stack cancels the Escape
 *   `keydown`, which stops the browser's own close request; the dialog's `cancel` event is
 *   cancelled too, and only acted on (reason `'close-watcher'`) when this dialog is the topmost
 *   layer. A native `close` that we didn't start (`<form method="dialog">`, app code calling
 *   `dialog.close()`) is reported as reason `'none'`.
 * - An outside press on a modal dialog is a click on the `<dialog>` element itself outside its
 *   border box, i.e. on `::backdrop`, or a press on a `backdrop()` element.
 * - Exit animations finish (via `lib/presence.ts`) before `dialog.close()` runs, then focus
 *   returns to the trigger (or `finalFocus`).
 * - Nested dialogs: every root finds its parent root through context. Parents expose
 *   `data-nested-dialog-open` and `--nested-dialogs`; children `data-nested`.
 */

import { attrs, createElement, createMixin, on } from '@remix-run/component'
import type {
  ElementProps,
  Handle,
  MixinFactory,
  MixinHandle,
  RemixNode,
} from '@remix-run/component'

import { splitOptions } from './collapsible-panel.ts'
import {
  focusPopupDefault,
  resolveFocusTarget,
  trapTabKey,
  type DialogFocusTarget,
  type DialogInteractionType,
} from './dialog-focus.ts'
import { isTopDismissLayer, registerDismissLayer } from './dismiss-layer.ts'
import { createPresence } from './presence.ts'
import { lockScroll } from './scroll-lock.ts'

export type { DialogFocusTarget, DialogInteractionType } from './dialog-focus.ts'

export type DialogKind = 'dialog' | 'alert-dialog' | 'drawer'

/**
 * Base UI's `modal` prop. `true`: `showModal()`, focus trapped, page inert, scroll locked.
 * `'trap-focus'`: `show()` with Tab trapped inside; the page stays scrollable and clickable.
 * `false`: `show()`, nothing trapped; moving focus outside closes the dialog.
 */
export type DialogModal = boolean | 'trap-focus'

/** Why the open state changed (Base UI's `ChangeEventReason`, plus `'close-watcher'`). */
export type DialogChangeReason =
  | 'trigger-press'
  | 'outside-press'
  | 'escape-key'
  | 'close-press'
  | 'focus-out'
  | 'imperative-action'
  | 'close-watcher'
  | 'swipe'
  | 'none'

export interface DialogChangeDetails {
  readonly reason: DialogChangeReason
  /** The DOM event behind the change, when there is one. */
  readonly event: Event | undefined
  /** The trigger that opened (or is associated with) the dialog. */
  readonly trigger: HTMLElement | undefined
  /** Keeps the current state: the change is not applied and no event is dispatched. */
  cancel(): void
  readonly isCanceled: boolean
}

/** Imperative actions written to `actionsRef.current` (Base UI's `Root.Actions`). */
export interface DialogActions {
  /** Opens the dialog (reason `'imperative-action'`). */
  open(): void
  /** Closes the dialog (reason `'imperative-action'`). */
  close(): void
}

export interface DialogRootProps {
  children?: RemixNode
  /** Whether the dialog is open (controlled). */
  open?: boolean
  /**
   * Whether the dialog is initially open (uncontrolled).
   * @default false
   */
  defaultOpen?: boolean
  /** Called before the open state changes. Call `details.cancel()` to keep it. */
  onOpenChange?: (open: boolean, details: DialogChangeDetails) => void
  /** Called after the enter or exit animation has finished. */
  onOpenChangeComplete?: (open: boolean) => void
  /**
   * @default true
   */
  modal?: DialogModal
  /**
   * Whether outside presses (and, for non-modal dialogs, focus moving outside) keep the dialog
   * open. Read when the dialog opens.
   * @default false
   */
  disablePointerDismissal?: boolean
  /** Receives `{ open(), close() }` while the root is mounted. */
  actionsRef?: { current: DialogActions | null }
}

/** @internal Props only the stems modules pass. */
export interface DialogRootInternalProps extends DialogRootProps {
  _kind?: DialogKind
  _createEvent?: (open: boolean, reason: DialogChangeReason) => Event
}

/** Shared state, read by every part through context. */
export interface DialogRootContextValue {
  readonly open: boolean
  readonly kind: DialogKind
  readonly modal: DialogModal
  readonly role: 'dialog' | 'alertdialog'
  readonly pointerDismissible: boolean
  readonly popupId: string
  readonly titleId: string | undefined
  readonly descriptionId: string | undefined
  /** The enclosing dialog root, if this dialog is nested in one. */
  readonly parent: DialogRootContextValue | null
  /** The `<dialog>` element, once mounted. */
  readonly popupNode: HTMLDialogElement | null
  /** The trigger that last opened the dialog. */
  readonly activeTrigger: HTMLElement | null
  /** How the dialog was last opened. */
  readonly interaction: DialogInteractionType
  /** Depth of the chain of open dialogs nested inside this one (optionally of one kind). */
  nestedOpenCount(kind?: DialogKind): number
  /** Requests an open state change; returns whether it was applied. */
  setOpen(open: boolean, reason: DialogChangeReason, event?: Event, trigger?: HTMLElement): boolean
  /** Re-renders the root (and so every part). */
  update(): Promise<unknown>
  /** @internal */
  _setInteraction(type: DialogInteractionType): void
  /** @internal */
  _setPopup(node: HTMLDialogElement | null): void
  /** @internal */
  _register(kind: 'trigger' | 'backdrop', node: HTMLElement, signal: AbortSignal): void
  /** @internal */
  _registerLabel(kind: 'title' | 'description', id: string, signal: AbortSignal): void
  /** @internal */
  _labelsKnown(): void
  /** @internal */
  _defaultLabelId(kind: 'title' | 'description'): string
  /** @internal */
  _contains(kind: 'trigger' | 'backdrop', target: Node): boolean
  /** @internal Whether `target` is inside a nested dialog's popup. */
  _containsNested(target: Node): boolean
  /** @internal */
  _addChild(child: DialogRootContextValue, signal: AbortSignal): void
  /** @internal */
  _nestedChanged(): void
  /** @internal */
  _complete(open: boolean): void
}

export function DialogRoot(
  handle: Handle<DialogRootInternalProps, DialogRootContextValue>,
): () => RemixNode {
  let uncontrolledOpen = handle.props.defaultOpen ?? false
  let parent = (handle.context.get(DialogRoot) as DialogRootContextValue | undefined) ?? null
  let signal = handle.signal
  let children = new Set<DialogRootContextValue>()
  let nodes = { trigger: new Set<HTMLElement>(), backdrop: new Set<HTMLElement>() }
  let labels = {
    title: { id: `${handle.id}-title`, count: 0 },
    description: { id: `${handle.id}-description`, count: 0 },
  }
  // Until the popup has mounted we can't know whether a title exists, so server HTML and the
  // hydration render point aria-labelledby at the default title id.
  let labelsKnown = false
  let popupNode: HTMLDialogElement | null = null
  let activeTrigger: HTMLElement | null = null
  let interaction: DialogInteractionType = ''
  let lastOpen: boolean | undefined

  function isOpen() {
    return handle.props.open ?? uncontrolledOpen
  }

  function kind(): DialogKind {
    return handle.props._kind ?? 'dialog'
  }

  function scheduleUpdate() {
    queueMicrotask(() => {
      if (!signal.aborted) void handle.update()
    })
  }

  let actions: DialogActions = {
    open: () => void store.setOpen(true, 'imperative-action'),
    close: () => void store.setOpen(false, 'imperative-action'),
  }

  let store: DialogRootContextValue = {
    get open() {
      return isOpen()
    },
    get kind() {
      return kind()
    },
    get modal() {
      return kind() === 'alert-dialog' ? true : (handle.props.modal ?? true)
    },
    get role() {
      return kind() === 'alert-dialog' ? 'alertdialog' : 'dialog'
    },
    get pointerDismissible() {
      return kind() !== 'alert-dialog' && !handle.props.disablePointerDismissal
    },
    popupId: `${handle.id}-popup`,
    get titleId() {
      return !labelsKnown || labels.title.count > 0 ? labels.title.id : undefined
    },
    get descriptionId() {
      return !labelsKnown || labels.description.count > 0 ? labels.description.id : undefined
    },
    parent,
    get popupNode() {
      return popupNode
    },
    get activeTrigger() {
      return activeTrigger
    },
    get interaction() {
      return interaction
    },
    nestedOpenCount(filter) {
      let depth = 0
      for (let child of children) {
        if (!child.open || (filter && child.kind !== filter)) continue
        depth = Math.max(depth, 1 + child.nestedOpenCount(filter))
      }
      return depth
    },
    setOpen(open, reason, event, trigger) {
      if (open === isOpen()) return false

      let canceled = false
      let details: DialogChangeDetails = {
        reason,
        event,
        trigger: trigger ?? activeTrigger ?? undefined,
        cancel() {
          canceled = true
        },
        get isCanceled() {
          return canceled
        },
      }
      handle.props.onOpenChange?.(open, details)
      if (canceled) return false

      if (open) activeTrigger = trigger ?? null
      if (handle.props.open === undefined) {
        uncontrolledOpen = open
        void handle.update()
      }

      let changeEvent = handle.props._createEvent?.(open, reason)
      let target = popupNode ?? trigger ?? (event?.target instanceof Element ? event.target : null)
      if (changeEvent) target?.dispatchEvent(changeEvent)
      return true
    },
    update() {
      return handle.update()
    },
    _setInteraction(type) {
      interaction = type
    },
    _setPopup(node) {
      popupNode = node
    },
    _register(kind, node, nodeSignal) {
      nodes[kind].add(node)
      nodeSignal.addEventListener('abort', () => nodes[kind].delete(node), { once: true })
    },
    _registerLabel(kind, id, labelSignal) {
      let label = labels[kind]
      let changed = label.id !== id || label.count === 0
      label.id = id
      label.count++
      labelSignal.addEventListener(
        'abort',
        () => {
          label.count--
          if (label.count === 0 && !signal.aborted) scheduleUpdate()
        },
        { once: true },
      )
      if (changed && labelsKnown) scheduleUpdate()
    },
    _defaultLabelId(kind) {
      return `${handle.id}-${kind}`
    },
    _labelsKnown() {
      if (labelsKnown) return
      labelsKnown = true
      if (labels.title.count === 0 || labels.description.count === 0) scheduleUpdate()
    },
    _contains(kind, target) {
      for (let node of nodes[kind]) if (node.contains(target)) return true
      return false
    },
    _containsNested(target) {
      for (let child of children) {
        if (child.popupNode?.contains(target) || child._containsNested(target)) return true
      }
      return false
    },
    _addChild(child, childSignal) {
      children.add(child)
      childSignal.addEventListener(
        'abort',
        () => {
          children.delete(child)
          if (child.open && !signal.aborted) scheduleUpdate()
        },
        { once: true },
      )
    },
    _nestedChanged() {
      if (signal.aborted) return
      void handle.update()
      parent?._nestedChanged()
    },
    _complete(open) {
      handle.props.onOpenChangeComplete?.(open)
    },
  }

  parent?._addChild(store, signal)
  handle.context.set(store)

  signal.addEventListener('abort', () => {
    let ref = handle.props.actionsRef
    if (ref?.current === actions) ref.current = null
  })

  return () => {
    let open = isOpen()
    if (handle.props.actionsRef) handle.props.actionsRef.current = actions
    if (parent && open !== (lastOpen ?? false)) {
      // The parent's nested attributes depend on this state; re-render it after this commit.
      handle.queueTask(() => parent._nestedChanged())
    }
    lastOpen = open
    return handle.props.children
  }
}

export function getDialogRoot(handle: MixinHandle<any>): DialogRootContextValue {
  return handle.context.get(DialogRoot) as DialogRootContextValue
}

// ---------------------------------------------------------------------------------------------
// Style merging: `attrs()` drops our defaults when the host has a `style`, but CSS variables
// must always be present, so merge them under the host's own style.

type StyleValue = string | Record<string, unknown> | undefined

const mergeStyleMixin = createMixin<Element, [vars: Record<string, string>], ElementProps>(
  (handle) => (vars, props) => {
    let style = props.style as StyleValue
    let merged: StyleValue
    if (typeof style === 'string') {
      let prefix = Object.entries(vars)
        .map(([key, value]) => `${key}: ${value}`)
        .join('; ')
      merged = style.trim() ? `${prefix}; ${style}` : prefix
    } else {
      merged = { ...vars, ...style }
    }
    return createElement(handle.element, { ...props, style: merged })
  },
)

export function mergeStyle(vars: Record<string, string>) {
  return mergeStyleMixin(vars)
}

// ---------------------------------------------------------------------------------------------
// Parts

export interface DialogTriggerOptions {
  /** Whether the trigger ignores presses. */
  disabled?: boolean
}

export interface DialogCloseOptions {
  /** Whether the close button ignores presses. */
  disabled?: boolean
}

export interface DialogPopupOptions {
  /**
   * Where focus goes when the dialog opens. Defaults to `[autofocus]` or the first tabbable
   * element (the popup itself when opened by touch).
   */
  initialFocus?: DialogFocusTarget
  /**
   * Where focus goes when the dialog closes. Defaults to the trigger that opened it (or the
   * element focused before it opened), unless focus already moved outside the dialog.
   */
  finalFocus?: DialogFocusTarget
}

export interface DialogBackdropOptions {
  /** Render the backdrop even when the dialog is nested in another dialog. */
  forceRender?: boolean
}

function pointerType(type: string): DialogInteractionType {
  return type === 'mouse' || type === 'touch' || type === 'pen' ? type : ''
}

function clickInteraction(event: MouseEvent, last: DialogInteractionType): DialogInteractionType {
  return event.detail === 0 ? 'keyboard' : last || 'mouse'
}

function buttonParts(isButton: boolean, disabled: boolean) {
  return {
    type: isButton ? 'button' : undefined,
    role: isButton ? undefined : 'button',
    tabIndex: isButton ? undefined : disabled ? -1 : 0,
    disabled: isButton && disabled ? true : undefined,
    'aria-disabled': !isButton && disabled ? 'true' : undefined,
    'data-disabled': disabled ? '' : undefined,
  }
}

function activationKeys(handler: (event: KeyboardEvent) => void) {
  return on<HTMLElement, 'keydown'>('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    handler(event)
  })
}

export const triggerMixin: MixinFactory<
  HTMLElement,
  [options?: DialogTriggerOptions],
  ElementProps
> = createMixin<HTMLElement, [options?: DialogTriggerOptions], ElementProps>((handle, hostType) => {
  let store = getDialogRoot(handle)
  let signal = handle.signal
  let isButton = hostType === 'button'
  let node: HTMLElement | null = null
  let disabled = false
  let lastPointer: DialogInteractionType = ''

  handle.addEventListener('insert', (event) => {
    node = event.node
    store._register('trigger', event.node, signal)
  })

  function press(event: Event, type: DialogInteractionType) {
    if (disabled) return
    let target = (event.currentTarget as HTMLElement | null) ?? node ?? undefined
    if (!store.open) store._setInteraction(type)
    store.setOpen(!store.open, 'trigger-press', event, target)
  }

  return (options, props) => {
    ;[options] = splitOptions(options, props)
    disabled = options?.disabled ?? false
    let open = store.open
    let active = open && (store.activeTrigger === null || store.activeTrigger === node)

    return [
      attrs({
        ...buttonParts(isButton, disabled),
        'aria-haspopup': 'dialog',
        'aria-expanded': active ? 'true' : 'false',
        'aria-controls': store.popupId,
        'data-popup-open': active ? '' : undefined,
      }),
      on<HTMLElement, 'pointerdown'>('pointerdown', (event) => {
        lastPointer = pointerType(event.pointerType)
      }),
      on<HTMLElement, 'click'>('click', (event) =>
        press(event, clickInteraction(event, lastPointer)),
      ),
      !isButton && activationKeys((event) => press(event, 'keyboard')),
    ]
  }
})

export const closeMixin: MixinFactory<HTMLElement, [options?: DialogCloseOptions], ElementProps> =
  createMixin<HTMLElement, [options?: DialogCloseOptions], ElementProps>((handle, hostType) => {
    let store = getDialogRoot(handle)
    let isButton = hostType === 'button'
    let disabled = false

    function press(event: Event) {
      if (disabled) return
      store.setOpen(false, 'close-press', event)
    }

    return (options, props) => {
      ;[options] = splitOptions(options, props)
      disabled = options?.disabled ?? false
      return [
        attrs(buttonParts(isButton, disabled)),
        on<HTMLElement, 'click'>('click', press),
        !isButton && activationKeys(press),
      ]
    }
  })

function createLabelMixin(kind: 'title' | 'description') {
  return createMixin<HTMLElement, [], ElementProps>((handle) => {
    let store = getDialogRoot(handle)
    let signal = handle.signal
    let fallback = store._defaultLabelId(kind)
    let registered = false

    return (props) => {
      let hostId = (props as { id?: string } | undefined)?.id
      if (!registered) {
        registered = true
        store._registerLabel(kind, hostId ?? fallback, signal)
      }
      return attrs({ id: fallback })
    }
  })
}

export const titleMixin: MixinFactory<HTMLElement, [], ElementProps> = createLabelMixin('title')
export const descriptionMixin: MixinFactory<HTMLElement, [], ElementProps> =
  createLabelMixin('description')

export const backdropMixin: MixinFactory<
  HTMLElement,
  [options?: DialogBackdropOptions],
  ElementProps
> = createMixin<HTMLElement, [options?: DialogBackdropOptions], ElementProps>((handle) => {
  let store = getDialogRoot(handle)
  let signal = handle.signal
  let presence = createPresence(handle, { update: () => store.update() })

  handle.addEventListener('insert', (event) => {
    store._register('backdrop', event.node, signal)
  })

  return (options, props) => {
    ;[options] = splitOptions(options, props)
    let open = store.open
    presence.sync(open)
    let suppressed = store.parent !== null && !options?.forceRender

    return attrs({
      role: 'presentation',
      hidden: !presence.present || suppressed ? true : undefined,
      'data-open': open ? '' : undefined,
      'data-closed': open ? undefined : '',
      ...presence.attrs(),
    })
  }
})

export const popupMixin: MixinFactory<
  HTMLDialogElement,
  [options?: DialogPopupOptions],
  ElementProps
> = createMixin<HTMLDialogElement, [options?: DialogPopupOptions], ElementProps>((handle) => {
  let store = getDialogRoot(handle)
  let node: HTMLDialogElement | null = null
  let options: DialogPopupOptions | undefined
  let unregisterLayer: (() => void) | null = null
  let unlockScroll: (() => void) | null = null
  let previouslyFocused: HTMLElement | null = null
  let pendingInternalCloses = 0
  let lastOpen: boolean | undefined

  let presence = createPresence<HTMLDialogElement>(handle, {
    update: () => store.update(),
    onBeforeEnter: (node) => activate(node),
    onAfterEnter: () => store._complete(true),
    onAfterExit(node) {
      deactivate(node)
      store._complete(false)
    },
  })

  handle.addEventListener('insert', (event) => {
    node = event.node
    store._setPopup(event.node)
    store._labelsKnown()
  })

  handle.addEventListener('remove', () => {
    teardown()
    if (store.popupNode === node) store._setPopup(null)
    node = null
  })

  function teardown() {
    unregisterLayer?.()
    unregisterLayer = null
    unlockScroll?.()
    unlockScroll = null
  }

  function closeNative(node: HTMLDialogElement) {
    if (!node.open) return
    pendingInternalCloses++
    node.close()
  }

  function contains(node: HTMLDialogElement, target: Node, event: Event) {
    if (store._contains('trigger', target) || store._containsNested(target)) return true
    if (store._contains('backdrop', target)) return false
    if (target !== node) return undefined
    // A press on the <dialog> box itself: inside its border box is the popup (padding),
    // outside it is the ::backdrop.
    if (!(event instanceof MouseEvent) || event.detail === 0) return true
    let rect = node.getBoundingClientRect()
    return (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    )
  }

  function activate(node: HTMLDialogElement) {
    if (!node.isConnected) return
    let modal = store.modal
    let reopening = node.open
    let doc = node.ownerDocument

    if (!node.open) {
      let active = doc.activeElement
      previouslyFocused = active instanceof HTMLElement && active !== doc.body ? active : null
      if (modal === true) node.showModal()
      else node.show()
    } else if (modal === true && !node.matches(':modal')) {
      closeNative(node)
      node.showModal()
    }

    if (!unregisterLayer) {
      unregisterLayer = registerDismissLayer({
        node,
        onDismiss: (reason, event) => void store.setOpen(false, reason, event),
        contains: (target, event) => contains(node, target, event),
        dismissOnOutsidePress: store.pointerDismissible,
      })
    }
    if (modal === true && !unlockScroll) unlockScroll = lockScroll(doc)

    if (reopening && node.contains(doc.activeElement)) return
    let target = resolveFocusTarget(options?.initialFocus, store.interaction, node)
    if (target === false) return
    if (target === true) focusPopupDefault(node, store.interaction)
    else target.focus()
  }

  function deactivate(node: HTMLDialogElement) {
    let doc = node.ownerDocument
    let active = doc.activeElement
    let focusInside = !active || active === doc.body || node.contains(active)

    unregisterLayer?.()
    unregisterLayer = null
    closeNative(node)
    unlockScroll?.()
    unlockScroll = null

    let target = resolveFocusTarget(options?.finalFocus, store.interaction, doc)
    if (target === false) return
    if (target !== true) {
      target.focus()
      return
    }
    if (!focusInside) return
    let fallback =
      store.activeTrigger && store.activeTrigger.isConnected
        ? store.activeTrigger
        : previouslyFocused
    fallback?.focus({ preventScroll: true })
  }

  function syncNative(node: HTMLDialogElement) {
    // Covers the initial mount of an open dialog and native closes the owner overrode.
    if (store.open && !node.open && presence.transitionStatus === undefined) activate(node)
  }

  return (opts, props) => {
    ;[options] = splitOptions(opts, props)
    let open = store.open
    if (lastOpen === true && !open) {
      // Closing starts now: later Escapes and presses belong to the layer below, even
      // while this one animates out.
      unregisterLayer?.()
      unregisterLayer = null
    }
    lastOpen = open
    presence.sync(open)
    handle.queueTask(syncNative)

    let nestedCount = store.nestedOpenCount()
    let modal = store.modal

    return [
      attrs({
        id: store.popupId,
        role: store.role === 'alertdialog' ? 'alertdialog' : undefined,
        'aria-modal': modal === true ? 'true' : undefined,
        'aria-labelledby': store.titleId,
        'aria-describedby': store.descriptionId,
        'data-open': open ? '' : undefined,
        'data-closed': open ? undefined : '',
        'data-nested': store.parent ? '' : undefined,
        'data-nested-dialog-open': nestedCount > 0 ? '' : undefined,
        ...presence.attrs(),
      }),
      mergeStyle({ '--nested-dialogs': String(nestedCount) }),
      on<HTMLDialogElement, 'cancel'>('cancel', (event) => {
        // Escape is routed through the dismiss stack (which cancels the keydown, so this
        // normally doesn't fire). Other close requests only close the topmost layer.
        event.preventDefault()
        let node = event.currentTarget
        if (store.open && isTopDismissLayer(node)) {
          store.setOpen(false, 'close-watcher', event)
        }
      }),
      on<HTMLDialogElement, 'close'>('close', (event) => {
        if (pendingInternalCloses > 0) {
          pendingInternalCloses--
          return
        }
        if (!store.open) return
        presence.skipTransition()
        if (!store.setOpen(false, 'none', event)) {
          let node = event.currentTarget
          queueMicrotask(() => {
            if (store.open && !node.open && node.isConnected) activate(node)
          })
        }
      }),
      on<HTMLDialogElement, 'keydown'>('keydown', (event) => {
        if (event.key !== 'Tab' || store.modal === false || !store.open) return
        let target = event.target
        if (target instanceof Node && store._containsNested(target)) return
        trapTabKey(event.currentTarget, event)
      }),
      on<HTMLDialogElement, 'focusout'>('focusout', (event) => {
        if (store.modal !== false || !store.open || !store.pointerDismissible) return
        let next = event.relatedTarget
        if (!(next instanceof Node)) return
        let node = event.currentTarget
        if (node.contains(next) || store._contains('trigger', next)) return
        if (store._containsNested(next)) return
        store.setOpen(false, 'focus-out', event)
      }),
    ]
  }
})
