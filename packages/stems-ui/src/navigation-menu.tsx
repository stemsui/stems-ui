/**
 * Navigation Menu: a collection of links and menus for site navigation (Base UI
 * `NavigationMenu`).
 *
 * It's navigation, not an ARIA menu: triggers are buttons with `aria-expanded` /
 * `aria-controls`, links are plain `<a>` elements, and there are no `menu` roles. Tab moves
 * through open content (non-modal), Escape closes and returns focus to the trigger, and the arrow
 * keys move between the top-level triggers and links.
 *
 * One popup is shared by every item. While it is open, switching items keeps it open and morphs
 * its size (`--popup-width` / `--popup-height`), and the contents enter and exit with
 * `data-activation-direction` and the presence attributes.
 *
 * Content into the viewport, without portals: `<navigationMenu.Content>` is a component that
 * renders nothing where it is declared (inside its item). It registers its props and children
 * with the root, and `<navigationMenu.Viewport>` (rendered once, inside the popup) renders every
 * registered content as a `<div>` child of the viewport element. All contents are always in the
 * DOM (inactive ones `hidden`), so server HTML contains every link, hydration matches, and the
 * reconciler owns every node (nothing is moved behind its back). The viewport must come after the
 * items in render order for the server HTML to include the contents (the registry's
 * `NavigationMenu` renders it last); on the client a late viewport catches up with one re-render.
 */

import { attrs, createMixin, on } from '@remix-run/component'
import type {
  Dispatched,
  ElementProps,
  Handle,
  MixinFactory,
  MixinHandle,
  Props,
  RemixNode,
} from '@remix-run/component'

import { splitOptions } from './lib/collapsible-panel.ts'
import { getDirection } from './lib/direction.ts'
import { createHoverAim } from './lib/hover-aim.ts'
import {
  createPopupArrow,
  createPopupBackdrop,
  createPopupStore,
  createPopupSurface,
} from './lib/popup.ts'
import type { PopupPositionOptions, PopupStore, PopupTriggerEntry } from './lib/popup.ts'
import { createPresence, waitForAnimations } from './lib/presence.ts'
import { getRovingMove, getRovingTargetIndex } from './lib/roving-focus.ts'
import { getTabbableElements, isTabbable } from './lib/tabbable.ts'

export type {
  PopupAlign as NavigationMenuAlign,
  PopupAnchor as NavigationMenuAnchor,
  PopupOffsetFunction as NavigationMenuOffsetFunction,
  PopupSide as NavigationMenuSide,
} from './lib/popup.ts'

const NAVIGATION_MENU_CHANGE_EVENT = 'stems:navigation-menu-change' as const

/** Internal marker on list elements, used to scope arrow-key navigation. */
const LIST_ATTR = 'data-navigation-menu-list'

/** Base UI's "patient click" threshold: a press this soon after a hover-open keeps it open. */
const PATIENT_CLICK_MS = 500

declare global {
  interface HTMLElementEventMap {
    [NAVIGATION_MENU_CHANGE_EVENT]: NavigationMenuChangeEvent
  }
}

// ---------------------------------------------------------------------------------------------
// Types

export type NavigationMenuOrientation = 'horizontal' | 'vertical'

/** Where the newly active trigger sits relative to the previous one. */
export type NavigationMenuActivationDirection = 'left' | 'right' | 'up' | 'down'

/** Base UI's `NavigationMenu.Root.ChangeEventReason`. */
export type NavigationMenuChangeReason =
  | 'trigger-press'
  | 'trigger-hover'
  | 'outside-press'
  | 'list-navigation'
  | 'focus-out'
  | 'escape-key'
  | 'link-press'
  | 'imperative-action'
  | 'none'

/** The second argument of `onValueChange`, like Base UI's `eventDetails`. */
export interface NavigationMenuChangeDetails {
  /** Why the value is changing. */
  readonly reason: NavigationMenuChangeReason
  /** The DOM event that caused the change, if any. */
  readonly event: Event | undefined
  /** The trigger the change is associated with. */
  readonly trigger: HTMLElement | undefined
  /** Call from `onValueChange` to keep the current value. */
  cancel(): void
  readonly isCanceled: boolean
}

export interface NavigationMenuContextProps {
  /**
   * The value of the open item (controlled). `null` closes the menu. Controlled whenever this is
   * not `undefined`.
   */
  value?: string | null
  /**
   * The initially open item (uncontrolled).
   * @default null
   */
  defaultValue?: string | null
  /** Called with the next value (`null` when closing) and the change details. */
  onValueChange?: (value: string | null, details: NavigationMenuChangeDetails) => void
  /** Called after the popup's enter or exit animation has finished. */
  onOpenChangeComplete?: (open: boolean) => void
  /**
   * Milliseconds to wait before opening on hover.
   * @default 50
   */
  delay?: number
  /**
   * Milliseconds to wait before closing after the pointer leaves.
   * @default 50
   */
  closeDelay?: number
  /**
   * Layout of the list: horizontal lists use Left/Right arrows (mirrored in RTL) and open with
   * ArrowDown; vertical lists use Up/Down and open with ArrowRight (ArrowLeft in RTL).
   * @default 'horizontal'
   */
  orientation?: NavigationMenuOrientation
  children?: RemixNode
}

export interface NavigationMenuItemContextProps {
  /** Identifies the item (for `value` / `defaultValue`). Defaults to a generated id. */
  value?: string
  children?: RemixNode
}

export interface NavigationMenuTriggerOptions {
  /**
   * Ignore presses and hover. The trigger stays focusable (`aria-disabled`).
   * @default false
   */
  disabled?: boolean
}

export interface NavigationMenuLinkOptions {
  /**
   * Whether the link is the current page: renders `aria-current="page"` and `data-active`.
   * @default false
   */
  active?: boolean
  /**
   * Close the menu (reason `'link-press'`) when the link is clicked.
   * @default false
   */
  closeOnClick?: boolean
}

/**
 * Popup options: Base UI's Positioner props (`side`, `align`, `sideOffset`, `alignOffset`,
 * `collisionPadding`, `arrowPadding`, `anchor`).
 */
export interface NavigationMenuPopupOptions extends Pick<
  PopupPositionOptions,
  'side' | 'align' | 'sideOffset' | 'alignOffset' | 'collisionPadding' | 'arrowPadding' | 'anchor'
> {}

/** Host props of the content `<div>` (rendered inside the viewport). */
export type NavigationMenuContentProps = Props<'div'>

/** Host props of the viewport `<div>`. */
export type NavigationMenuViewportProps = Props<'div'>

/** Shared state, read with `handle.context.get(navigationMenu.Context)`. */
export interface NavigationMenuContextValue {
  /** The open item's value, or `null` while closed. */
  readonly value: string | null
  /** Whether an item is open. */
  readonly open: boolean
  readonly orientation: NavigationMenuOrientation
  /** Whether this menu is nested in another navigation menu's content. */
  readonly nested: boolean
  /** Direction of the last switch between items while open; `null` after (re)opening. */
  readonly activationDirection: NavigationMenuActivationDirection | null
  /** Why the menu is open (`null` while closed; `'none'` for a controlled or initial value). */
  readonly openReason: NavigationMenuChangeReason | null
  /** Requests a value change (reason `'imperative-action'` by default). Returns whether it was accepted. */
  setValue(
    value: string | null,
    options?: { reason?: NavigationMenuChangeReason; event?: Event },
  ): boolean
  /** Closes the menu (reason `'imperative-action'`). */
  close(): void
  /** Re-renders the provider. */
  update(): Promise<unknown>
  /** @internal */
  readonly _store: PopupStore
  /** @internal The value whose content is shown (lingers while the popup animates out). */
  readonly _displayedValue: string | null
  /** @internal */
  readonly _instantContent: boolean
  /** @internal */
  _request(value: string | null, request: ChangeRequest): boolean
  /** @internal */
  _setTrigger(value: string, entry: TriggerRecord | null, previous?: string): void
  /** @internal */
  _triggerNode(value: string | null): HTMLElement | null
  /** @internal */
  _triggerEnter(event: PointerEvent, value: string, node: HTMLElement): void
  /** @internal */
  _triggerLeave(event: PointerEvent, node: HTMLElement | null): void
  /** @internal */
  _triggerPress(event: Event, value: string, node: HTMLElement | null): void
  /** @internal */
  _triggerKeyDown(event: KeyboardEvent, item: ItemContextValue, node: HTMLElement | null): void
  /** @internal */
  _contentKeyDown(event: KeyboardEvent, item: ItemContextValue): void
  /** @internal */
  _popupEnter(event: PointerEvent): void
  /** @internal */
  _popupLeave(event: PointerEvent): void
  /** @internal */
  _focusOut(event: FocusEvent, from: 'root' | 'popup'): void
  /** @internal */
  _listKeyDown(event: KeyboardEvent): void
  /** @internal */
  _setNode(kind: 'root' | 'viewport', node: HTMLElement | null): void
  /** @internal */
  _registerContent(entry: ContentEntry, signal: AbortSignal): void
  /** @internal */
  _contentEntries(): ContentEntry[]
  /** @internal */
  _contentsChanged(): void
  /** @internal */
  _setViewport(viewport: ViewportRecord | null): void
  /** @internal */
  _registerChild(child: NavigationMenuContextValue, signal: AbortSignal): void
  /** @internal The menu whose popup morphs when the content changes (own, or a parent's). */
  _morphOwner(): NavigationMenuContextValue | null
  /** @internal */
  _measureMorph(): Size | null
  /** @internal */
  _applyMorph(from: Size): void
  /** @internal */
  _focusGuard(event: FocusEvent, edge: 'start' | 'end'): void
}

interface ChangeRequest {
  reason: NavigationMenuChangeReason
  event?: Event
  trigger?: HTMLElement | null
}

interface TriggerRecord {
  entry: PopupTriggerEntry
}

interface ViewportRecord {
  update(): void
  versions: Map<ContentEntry, number>
}

interface ItemContextValue {
  readonly value: string
  readonly contentId: string
  contentNode: HTMLElement | null
  /** @internal */
  _setContentId(id: string | undefined): boolean
}

interface ContentEntry {
  readonly key: string
  readonly item: ItemContextValue
  readonly props: NavigationMenuContentProps
  version: number
}

interface Size {
  width: number
  height: number
}

/** Bubbling event dispatched from the trigger (or the root) when the open item changes. */
export class NavigationMenuChangeEvent extends Event {
  readonly value: string | null
  readonly previousValue: string | null
  readonly reason: NavigationMenuChangeReason

  constructor(
    value: string | null,
    previousValue: string | null,
    reason: NavigationMenuChangeReason,
  ) {
    super(NAVIGATION_MENU_CHANGE_EVENT, { bubbles: true })
    this.value = value
    this.previousValue = previousValue
    this.reason = reason
  }
}

// ---------------------------------------------------------------------------------------------
// Root provider

function NavigationMenuProvider(
  handle: Handle<NavigationMenuContextProps, NavigationMenuContextValue>,
): () => RemixNode {
  let parent = handle.context.get(NavigationMenuProvider) as NavigationMenuContextValue | undefined
  let uncontrolledValue: string | null = handle.props.defaultValue ?? null
  let openReason: NavigationMenuChangeReason | null = null
  let hoverOpenedAt = 0
  let activationDirection: NavigationMenuActivationDirection | null = null
  let renderedValue: string | null | undefined
  let lingering: string | null = null
  let instantContent = false
  let rootNode: HTMLElement | null = null
  let viewportNode: HTMLElement | null = null
  let triggers = new Map<string, TriggerRecord>()
  let contents: ContentEntry[] = []
  let viewport: ViewportRecord | null = null
  let children = new Set<NavigationMenuContextValue>()
  let openTimer = 0
  let closeTimer = 0
  let aim = createHoverAim()
  let tracking: AbortController | null = null
  let morph: AbortController | null = null

  function isControlled() {
    return handle.props.value !== undefined
  }

  function getValue(): string | null {
    return isControlled() ? (handle.props.value ?? null) : uncontrolledValue
  }

  if (getValue() !== null) openReason = 'none'

  let store = createPopupStore({
    id: handle.id,
    getProps: () => ({
      open: getValue() !== null,
      onOpenChange(open, details) {
        // Only the popup surface calls `setOpen` (Escape, outside press): always a close.
        if (!open) commit(null, details as unknown as NavigationMenuChangeDetails)
        else details.cancel()
      },
      onOpenChangeComplete(open) {
        if (!open) {
          resetSizes()
          if (lingering !== null) {
            lingering = null
            instantContent = true
            void handle.update()
          }
        }
        handle.props.onOpenChangeComplete?.(open)
      },
      modal: false,
    }),
    update: () => handle.update(),
    signal: handle.signal,
  })

  handle.signal.addEventListener('abort', () => {
    cancelTimers()
    morph?.abort()
  })

  function triggerNode(value: string | null): HTMLElement | null {
    if (value === null) return null
    let node = triggers.get(value)?.entry.node ?? null
    return node?.isConnected ? node : null
  }

  function createDetails(request: ChangeRequest): NavigationMenuChangeDetails {
    let canceled = false
    return {
      reason: request.reason,
      event: request.event,
      trigger: request.trigger ?? undefined,
      cancel() {
        canceled = true
      },
      get isCanceled() {
        return canceled
      },
    }
  }

  function commit(next: string | null, details: NavigationMenuChangeDetails) {
    let previous = getValue()
    if (next === previous) return
    handle.props.onValueChange?.(next, details)
    if (details.isCanceled) return

    if (!isControlled()) uncontrolledValue = next
    openReason = next === null ? null : details.reason
    if (next !== null && details.reason === 'trigger-hover') hoverOpenedAt = performance.now()
    if (next === null) cancelTimers()

    let target = triggerNode(next) ?? triggerNode(previous) ?? rootNode
    target?.dispatchEvent(new NavigationMenuChangeEvent(next, previous, details.reason))
    if (!isControlled()) void handle.update()
  }

  function request(next: string | null, change: ChangeRequest): boolean {
    if (next === getValue()) return false
    let details = createDetails({
      ...change,
      trigger: change.trigger ?? triggerNode(next) ?? triggerNode(getValue()),
    })
    commit(next, details)
    return !details.isCanceled
  }

  // Hover ------------------------------------------------------------------------------------

  function cancelClose() {
    clearTimeout(closeTimer)
    closeTimer = 0
  }

  function stopTracking() {
    tracking?.abort()
    tracking = null
  }

  function cancelTimers() {
    clearTimeout(openTimer)
    openTimer = 0
    cancelClose()
    stopTracking()
  }

  /** Hover closing applies to a hover-opened menu that has a popup. */
  function hoverMode() {
    return getValue() !== null && openReason === 'trigger-hover' && store.popupNode !== null
  }

  function isInside(target: EventTarget | null) {
    return (
      target instanceof Node &&
      (store.popupNode?.contains(target) === true || store.containsTrigger(target))
    )
  }

  function scheduleClose(event: Event) {
    cancelClose()
    closeTimer = window.setTimeout(() => {
      closeTimer = 0
      stopTracking()
      if (hoverMode()) request(null, { reason: 'trigger-hover', event })
    }, handle.props.closeDelay ?? 50)
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

  // Size morph -------------------------------------------------------------------------------
  //
  // Like Base UI, the popup element (the positioner) takes the final size right away through
  // `--positioner-width` / `--positioner-height`, so `anchor()` positions it correctly while the
  // visible box (Base UI's Popup: the viewport's parent, which may be the popup element itself)
  // animates `--popup-width` / `--popup-height` from the old size to the new one.

  function resetSizes() {
    morph?.abort()
    morph = null
    let popup = store.popupNode
    if (popup) setRestingSize(popup)
  }

  function openPopup(): HTMLElement | null {
    let popup = store.popupNode
    return popup?.isConnected && popup.matches(':popover-open') ? popup : null
  }

  /** The element sized with `--popup-width`: the viewport's parent, or the popup itself. */
  function sizedBox(popup: HTMLElement): HTMLElement {
    let box = viewportNode?.parentElement
    return box?.isConnected && popup.contains(box) ? box : popup
  }

  function measureMorph(): Size | null {
    let popup = openPopup()
    return popup ? measure(sizedBox(popup)) : null
  }

  function applyMorph(from: Size) {
    let popup = openPopup()
    if (!popup) return
    morph?.abort()
    let controller = new AbortController()
    morph = controller
    let { signal } = controller
    let style = popup.style
    let box = sizedBox(popup)

    // Let the popup size itself to the new content (the exiting one is out of flow).
    setRestingSize(popup)
    let to = measure(box)
    if (from.width === 0 || from.height === 0) return
    if (from.width === to.width && from.height === to.height) return

    style.setProperty('--positioner-width', `${to.width}px`)
    style.setProperty('--positioner-height', `${to.height}px`)
    // Start from the old size, then transition to the new one on the next frame.
    style.setProperty('--popup-width', `${from.width}px`)
    style.setProperty('--popup-height', `${from.height}px`)
    void box.offsetWidth

    let frame = requestAnimationFrame(() => {
      if (signal.aborted) return
      style.setProperty('--popup-width', `${to.width}px`)
      style.setProperty('--popup-height', `${to.height}px`)
      void waitForAnimations(box, signal).then(() => {
        if (signal.aborted) return
        // Back to the content size so later content changes apply directly.
        setRestingSize(popup)
        if (morph === controller) morph = null
      })
    })
    signal.addEventListener('abort', () => cancelAnimationFrame(frame), { once: true })
  }

  /** The menu whose popup morphs when this menu's content changes: its own, or a parent's. */
  function morphOwner(): NavigationMenuContextValue | null {
    if (store.popupNode?.isConnected) return openPopup() ? context : null
    return parent?._morphOwner() ?? null
  }

  // Called during render when the value changed (the DOM still shows the previous value).
  function onValueRendered(previous: string | null, next: string | null) {
    if (previous !== null && next !== null) {
      activationDirection = computeDirection(previous, next) ?? activationDirection
      let owner = morphOwner()
      let from = owner?._measureMorph()
      if (owner && from) handle.queueTask(() => owner._applyMorph(from))
    } else {
      activationDirection = null
    }

    if (next === null && previous !== null && store.popupNode?.isConnected) {
      // Keep showing the content while the popup animates out.
      lingering = previous
    } else if (next !== null) {
      lingering = null
    }

    // Nested popups belong to the content that was showing: close them.
    if (children.size > 0) {
      handle.queueTask(() => {
        for (let child of children) {
          if (child.open && child._store.popupNode) {
            child.setValue(null, { reason: 'none' })
          }
        }
      })
    }
  }

  function computeDirection(
    previous: string,
    next: string,
  ): NavigationMenuActivationDirection | null {
    let a = triggerNode(previous)?.getBoundingClientRect()
    let b = triggerNode(next)?.getBoundingClientRect()
    if (!a || !b) return null
    if ((handle.props.orientation ?? 'horizontal') === 'horizontal') {
      return b.left === a.left ? null : b.left > a.left ? 'right' : 'left'
    }
    return b.top === a.top ? null : b.top > a.top ? 'down' : 'up'
  }

  // Focus -------------------------------------------------------------------------------------

  function hasPopup() {
    return store.popupNode?.isConnected === true
  }

  function contentTabbables(item: ItemContextValue) {
    let node = item.contentNode
    return node ? getTabbableElements(node) : []
  }

  /** Focuses the first tabbable element of the item's content once it's visible. */
  function focusContent(item: ItemContextValue, frames = 10) {
    let first = contentTabbables(item)[0]
    if (first) {
      first.focus()
      return
    }
    if (frames > 0) requestAnimationFrame(() => focusContent(item, frames - 1))
  }

  /** The tabbable element after `trigger`, skipping the popup's contents. */
  function nextTabbableAfter(trigger: HTMLElement, exclude: HTMLElement | null) {
    let all = getTabbableElements(trigger.ownerDocument.body).filter(
      (node) => node === trigger || !exclude?.contains(node),
    )
    let index = all.indexOf(trigger)
    return index === -1 ? null : (all[index + 1] ?? null)
  }

  function listItems(list: HTMLElement): HTMLElement[] {
    return [
      ...list.querySelectorAll<HTMLElement>('a[href], button, [role="button"], [tabindex]'),
    ].filter(
      (node) =>
        node.closest(`[${LIST_ATTR}]`) === list &&
        (isTabbable(node) || node.getAttribute('aria-disabled') === 'true'),
    )
  }

  let context: NavigationMenuContextValue = {
    get value() {
      return getValue()
    },
    get open() {
      return getValue() !== null
    },
    get orientation() {
      return handle.props.orientation ?? 'horizontal'
    },
    get nested() {
      return parent !== undefined
    },
    get activationDirection() {
      return activationDirection
    },
    get openReason() {
      return getValue() === null ? null : (openReason ?? 'none')
    },
    setValue(value, options = {}) {
      return request(value, {
        reason: options.reason ?? 'imperative-action',
        event: options.event,
      })
    },
    close() {
      request(null, { reason: 'imperative-action' })
    },
    update: () => handle.update(),
    _store: store,
    get _displayedValue() {
      return getValue() ?? lingering
    },
    get _instantContent() {
      return instantContent
    },
    _request: request,
    _setTrigger(value, record, previous) {
      if (previous !== undefined && previous !== value && triggers.get(previous) === record) {
        triggers.delete(previous)
      }
      if (record) triggers.set(value, record)
      else triggers.delete(value)
    },
    _triggerNode: triggerNode,
    _triggerEnter(event, value, node) {
      if (event.pointerType === 'touch') return
      cancelClose()
      stopTracking()
      let current = getValue()
      if (current === value) return
      clearTimeout(openTimer)
      if (current !== null) {
        // Moving between triggers while open switches right away.
        request(value, { reason: 'trigger-hover', event, trigger: node })
        return
      }
      openTimer = window.setTimeout(() => {
        openTimer = 0
        if (node.isConnected && getValue() !== value) {
          request(value, { reason: 'trigger-hover', event, trigger: node })
        }
      }, handle.props.delay ?? 50)
    },
    _triggerLeave(event, node) {
      clearTimeout(openTimer)
      openTimer = 0
      if (!hoverMode()) return
      if (isInside(event.relatedTarget)) return
      let popup = store.popupNode
      if (popup && node && aim.start(node, popup, event, () => scheduleClose(event))) {
        track(popup.ownerDocument)
        return
      }
      scheduleClose(event)
    },
    _triggerPress(event, value, node) {
      cancelTimers()
      if (getValue() === value) {
        if (
          openReason === 'trigger-hover' &&
          performance.now() - hoverOpenedAt < PATIENT_CLICK_MS
        ) {
          // Base UI: a press right after a hover-open keeps the menu open (and stops hover
          // from closing it).
          openReason = 'trigger-press'
          void handle.update()
          return
        }
        request(null, { reason: 'trigger-press', event, trigger: node })
        return
      }
      request(value, { reason: 'trigger-press', event, trigger: node })
    },
    _triggerKeyDown(event, item, node) {
      if (!node || event.altKey || event.ctrlKey || event.metaKey) return
      let active = getValue() === item.value

      if (event.key === 'Tab' && !event.shiftKey) {
        // The popup renders after the list: Tab from the open trigger enters its content.
        if (!active || !hasPopup()) return
        let first = contentTabbables(item)[0]
        if (!first) return
        event.preventDefault()
        first.focus()
        return
      }

      if (parent) return // Nested triggers leave arrow keys to the parent content.
      let horizontal = (handle.props.orientation ?? 'horizontal') === 'horizontal'
      let openKey = horizontal
        ? 'ArrowDown'
        : getDirection(node) === 'rtl'
          ? 'ArrowLeft'
          : 'ArrowRight'
      if (event.key !== openKey) return
      event.preventDefault()
      event.stopPropagation()
      cancelTimers()
      if (!active) {
        if (!request(item.value, { reason: 'list-navigation', event, trigger: node })) return
      }
      focusContent(item)
    },
    _contentKeyDown(event, item) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
      let content = event.currentTarget as HTMLElement
      let target = event.target as HTMLElement
      let tabbables = getTabbableElements(content)
      if (tabbables.length === 0) return
      let trigger = triggerNode(item.value)

      if (event.key === 'Tab') {
        if (!hasPopup() || !trigger) return
        if (!event.shiftKey && target === tabbables.at(-1)) {
          let next = nextTabbableAfter(trigger, store.popupNode)
          if (!next) return
          event.preventDefault()
          next.focus()
        } else if (event.shiftKey && target === tabbables[0]) {
          event.preventDefault()
          trigger.focus()
        }
        return
      }

      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
      if (isTextEntry(target)) return
      let index = tabbables.indexOf(target)
      if (index === -1) return
      let next = tabbables[index + (event.key === 'ArrowDown' ? 1 : -1)]
      if (!next) return
      event.preventDefault()
      next.focus()
    },
    _focusGuard(event, edge) {
      let guard = event.currentTarget as HTMLElement
      let from = event.relatedTarget
      let popup = openPopup()
      let doc = guard.ownerDocument
      let fromInside = from instanceof Node && (popup ?? viewportNode)?.contains(from) === true

      if (!popup || !popup.contains(guard)) {
        // Inline viewport: guards are just skipped in the direction of travel.
        let all = getTabbableElements(doc.body).filter((node) => !isGuard(node) || node === guard)
        let index = all.indexOf(guard)
        let forward = edge === 'start' ? !fromInside : fromInside
        all[index + (forward ? 1 : -1)]?.focus()
        return
      }

      let trigger = triggerNode(getValue())
      let outside = getTabbableElements(doc.body).filter((node) => !popup.contains(node))
      if (fromInside) {
        // Leaving the content: back to its trigger, or on to what follows the trigger.
        if (edge === 'start') trigger?.focus()
        else if (trigger) nextTabbableAfter(trigger, popup)?.focus()
        return
      }
      // Tabbing into the popup from elsewhere (it renders after the list): its content belongs
      // after its trigger, so skip over it in the direction of travel.
      let target =
        edge === 'start'
          ? outside.find((node) => popup.compareDocumentPosition(node) & FOLLOWING)
          : outside.findLast((node) => popup.compareDocumentPosition(node) & PRECEDING)
      if (target) {
        target.focus()
        return
      }
      // Nothing to skip to (the menu ends the page): let focus leave, and close.
      guard.blur()
      request(null, { reason: 'focus-out', event })
    },
    _popupEnter() {
      cancelClose()
      stopTracking()
    },
    _popupLeave(event) {
      if (!hoverMode()) return
      if (isInside(event.relatedTarget)) return
      scheduleClose(event)
    },
    _focusOut(event, from) {
      if (getValue() === null) return
      let popup = store.popupNode
      // Focus events from the popup also bubble through the root when it's inside it.
      if (from === 'popup' && popup && rootNode?.contains(popup)) return
      let next = event.relatedTarget
      if (!(next instanceof Node)) return
      if (rootNode?.contains(next) || popup?.contains(next)) return
      request(null, { reason: 'focus-out', event })
    },
    _listKeyDown(event) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
      let list = event.currentTarget as HTMLElement
      let items = listItems(list)
      let index = items.indexOf(event.target as HTMLElement)
      if (index === -1) return
      let orientation = handle.props.orientation ?? 'horizontal'
      let move = getRovingMove(event.key, orientation, getDirection(list))
      if (!move) return
      let next = getRovingTargetIndex(items.length, index, move, { loop: !parent })
      if (next === -1 || next === index) {
        // At the end of a nested list: let the parent content move on.
        if (!parent) event.preventDefault()
        return
      }
      event.preventDefault()
      items[next]!.focus()
    },
    _setNode(kind, node) {
      if (kind === 'root') rootNode = node
      else viewportNode = node
    },
    _registerContent(entry, signal) {
      contents.push(entry)
      signal.addEventListener('abort', () => {
        let index = contents.indexOf(entry)
        if (index !== -1) contents.splice(index, 1)
        queueMicrotask(() => context._contentsChanged())
      })
    },
    _contentEntries() {
      return contents
    },
    _contentsChanged() {
      if (!viewport) return
      let { versions } = viewport
      let stale =
        versions.size !== contents.length ||
        contents.some((entry) => versions.get(entry) !== entry.version)
      if (stale) viewport.update()
    },
    _setViewport(record) {
      viewport = record
    },
    _registerChild(child, signal) {
      children.add(child)
      signal.addEventListener('abort', () => children.delete(child))
    },
    _morphOwner: morphOwner,
    _measureMorph: measureMorph,
    _applyMorph: applyMorph,
  }

  handle.context.set(context)
  parent?._registerChild(context, handle.signal)

  return () => {
    store.sync()
    // Stems drives hover itself; keep the shared popup hover logic out of the way.
    if (store.openReason !== null) store._setOpenReason('none')

    let value = getValue()
    if (renderedValue !== undefined && value !== renderedValue) {
      onValueRendered(renderedValue, value)
    }
    renderedValue = value
    if (value !== null && openReason === null) openReason = 'none'
    if (instantContent) handle.queueTask(() => (instantContent = false))
    return handle.props.children
  }
}

/**
 * The popup's size while not morphing. `fit-content` rather than `auto`: a `[popover]` is
 * `position: fixed; inset: 0`, so `width: auto` would fill the viewport until `anchor()` places
 * it, and the first measurement would be wrong. Keywords aren't interpolable, so switching
 * between them and a pixel size never animates.
 */
function setRestingSize(popup: HTMLElement) {
  for (let name of [
    '--popup-width',
    '--popup-height',
    '--positioner-width',
    '--positioner-height',
  ]) {
    popup.style.setProperty(name, 'fit-content')
  }
}

function measure(node: HTMLElement): Size {
  let style = getComputedStyle(node)
  return {
    width: parseFloat(style.width) || node.offsetWidth,
    height: parseFloat(style.height) || node.offsetHeight,
  }
}

const FOLLOWING = 4 // Node.DOCUMENT_POSITION_FOLLOWING
const PRECEDING = 2 // Node.DOCUMENT_POSITION_PRECEDING

function isGuard(node: Element) {
  return node.hasAttribute('data-navigation-menu-focus-guard')
}

function isTextEntry(node: HTMLElement) {
  if (node.isContentEditable) return true
  if (node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement) return true
  if (!(node instanceof HTMLInputElement)) return false
  return !['button', 'checkbox', 'radio', 'submit', 'reset', 'image', 'file'].includes(node.type)
}

// ---------------------------------------------------------------------------------------------
// Item provider

function NavigationMenuItemProvider(
  handle: Handle<NavigationMenuItemContextProps, ItemContextValue>,
): () => RemixNode {
  let value = handle.props.value ?? handle.id
  let customContentId: string | undefined

  handle.context.set({
    get value() {
      return value
    },
    get contentId() {
      return customContentId ?? `${handle.id}-content`
    },
    contentNode: null,
    _setContentId(id) {
      if (id === customContentId) return false
      customContentId = id
      return true
    },
  })

  return () => {
    value = handle.props.value ?? handle.id
    return handle.props.children
  }
}

function getRoot(handle: MixinHandle<HTMLElement> | Handle<any, any>): NavigationMenuContextValue {
  return handle.context.get(NavigationMenuProvider)
}

function getItem(handle: MixinHandle<HTMLElement> | Handle<any, any>): ItemContextValue {
  return handle.context.get(NavigationMenuItemProvider)
}

// ---------------------------------------------------------------------------------------------
// Content and viewport (components)

/**
 * Registers the item's content with the root and renders nothing in place: the viewport renders
 * it. Re-renders of the declaring component reach the viewport through `_contentsChanged()`.
 */
function ContentComponent(handle: Handle<NavigationMenuContentProps>): () => RemixNode {
  let root = getRoot(handle)
  let item = getItem(handle)
  let entry: ContentEntry = { key: handle.id, item, props: handle.props, version: 0 }
  let snapshot: Record<string, unknown> = {}
  root._registerContent(entry, handle.signal)

  return () => {
    let props = handle.props as Record<string, unknown>
    let keys = new Set([...Object.keys(props), ...Object.keys(snapshot)])
    let changed = [...keys].some((key) => props[key] !== snapshot[key])
    if (changed) {
      snapshot = { ...props }
      entry.version++
    }
    // The viewport may have rendered before this content (or before this change).
    handle.queueTask(() => root._contentsChanged())
    return null
  }
}

/** Visually hidden, like Floating UI's focus guards. */
const FOCUS_GUARD_STYLE = {
  position: 'fixed',
  top: '0',
  left: '0',
  width: '1px',
  height: '1px',
  margin: '-1px',
  padding: '0',
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  border: '0',
} as const

function ViewportComponent(handle: Handle<NavigationMenuViewportProps>): () => RemixNode {
  let root = getRoot(handle)
  let record: ViewportRecord = {
    update: () => void handle.update(),
    versions: new Map(),
  }
  root._setViewport(record)
  handle.signal.addEventListener('abort', () => root._setViewport(null))

  return () => {
    let { children: _children, mix, ...props } = handle.props
    let entries = root._contentEntries()
    record.versions = new Map(entries.map((entry) => [entry, entry.version]))
    return (
      <div {...props} mix={[viewportMixin(), mix]}>
        <span
          key="start-guard"
          tabIndex={0}
          aria-hidden="true"
          data-navigation-menu-focus-guard=""
          style={FOCUS_GUARD_STYLE}
          mix={on<HTMLElement, 'focus'>('focus', (event) => root._focusGuard(event, 'start'))}
        />
        {entries.map((entry) => {
          let { children, mix: contentMix, ...contentProps } = entry.props
          return (
            <div key={entry.key} {...contentProps} mix={[contentMixin(entry), contentMix]}>
              {children}
            </div>
          )
        })}
        <span
          key="end-guard"
          tabIndex={0}
          aria-hidden="true"
          data-navigation-menu-focus-guard=""
          style={FOCUS_GUARD_STYLE}
          mix={on<HTMLElement, 'focus'>('focus', (event) => root._focusGuard(event, 'end'))}
        />
      </div>
    )
  }
}

const viewportMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let root = getRoot(handle)
  handle.addEventListener('insert', (event) => root._setNode('viewport', event.node))
  handle.addEventListener('remove', () => root._setNode('viewport', null))
  return () => attrs({ 'data-orientation': root.orientation })
})

const contentMixin: MixinFactory<HTMLElement, [entry: ContentEntry], ElementProps> = createMixin<
  HTMLElement,
  [entry: ContentEntry],
  ElementProps
>((handle) => {
  let root = getRoot(handle)
  let item: ItemContextValue | null = null
  let node: HTMLElement | null = null
  let absolute = false
  let presence = createPresence(handle, { update: () => root.update() })

  handle.addEventListener('insert', (event) => {
    node = event.node
    if (item) item.contentNode = node
  })
  handle.addEventListener('remove', () => {
    if (item?.contentNode === node) item.contentNode = null
    node = null
  })

  function setAbsolute(target: HTMLElement, next: boolean) {
    if (next === absolute) return
    absolute = next
    // Base UI: the exiting content leaves the flow so the popup sizes to the entering one.
    for (let [name, value] of [
      ['position', 'absolute'],
      ['top', '0'],
      ['left', '0'],
    ] as const) {
      if (next) target.style.setProperty(name, value)
      else target.style.removeProperty(name)
    }
  }

  return (entry, props) => {
    item = entry.item
    if (node) item.contentNode = node
    let open = root._displayedValue === item.value
    if (root._instantContent) presence.skipTransition()
    presence.sync(open)
    let exiting = presence.transitionStatus === 'ending'

    let id = typeof props.id === 'string' ? props.id : undefined
    if (item._setContentId(id)) handle.queueTask(() => void root.update())

    handle.queueTask((target) => setAbsolute(target, exiting))

    let current = item
    return [
      attrs({
        id: id ?? item.contentId,
        hidden: presence.present ? undefined : true,
        inert: exiting ? true : undefined,
        'data-open': open ? '' : undefined,
        'data-closed': open ? undefined : '',
        'data-activation-direction': root.activationDirection ?? undefined,
        ...presence.attrs(),
      }),
      on<HTMLElement, 'keydown'>('keydown', (event) => root._contentKeyDown(event, current)),
    ]
  }
})

// ---------------------------------------------------------------------------------------------
// Mixins

const rootMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let root = getRoot(handle)
  handle.addEventListener('insert', (event) => root._setNode('root', event.node))
  handle.addEventListener('remove', () => root._setNode('root', null))
  return () => [
    attrs({
      'data-orientation': root.orientation,
      'data-nested': root.nested ? '' : undefined,
    }),
    on<HTMLElement, 'focusout'>('focusout', (event) => root._focusOut(event, 'root')),
  ]
})

const listMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let root = getRoot(handle)
  return () => [
    attrs({ 'data-orientation': root.orientation, [LIST_ATTR]: '' }),
    on<HTMLElement, 'keydown'>('keydown', (event) => root._listKeyDown(event)),
  ]
})

const triggerMixin: MixinFactory<
  HTMLElement,
  [options?: NavigationMenuTriggerOptions],
  ElementProps
> = createMixin<HTMLElement, [options?: NavigationMenuTriggerOptions], ElementProps>(
  (handle, hostType) => {
    let root = getRoot(handle)
    let item = getItem(handle)
    let entry = root._store._registerTrigger(handle.signal)
    let record: TriggerRecord = { entry }
    let registered: string | undefined
    let isButton = hostType === 'button'
    let disabled = false

    handle.addEventListener('insert', (event) => {
      entry.node = event.node
    })
    handle.addEventListener('remove', () => {
      entry.node = null
    })
    handle.signal.addEventListener('abort', () => {
      if (registered !== undefined) root._setTrigger(registered, null)
    })

    function press(event: Event) {
      if (disabled) return
      root._triggerPress(event, item.value, entry.node)
    }

    return (options, props) => {
      ;[options] = splitOptions(options, props)
      disabled = options?.disabled ?? false
      entry.disabled = disabled
      let value = item.value
      root._setTrigger(value, record, registered)
      registered = value

      let active = root.value === value
      if (active) root._store._activateTrigger(entry)

      return [
        attrs({
          type: isButton ? 'button' : undefined,
          role: isButton ? undefined : 'button',
          tabIndex: isButton ? undefined : 0,
          'aria-expanded': active ? 'true' : 'false',
          'aria-controls': item.contentId,
          'aria-disabled': disabled ? 'true' : undefined,
          'data-popup-open': active ? '' : undefined,
          'data-pressed': active && root.openReason !== 'trigger-hover' ? '' : undefined,
          'data-disabled': disabled ? '' : undefined,
        }),
        on<HTMLElement, 'pointerenter'>('pointerenter', (event) => {
          if (!disabled && entry.node) root._triggerEnter(event, item.value, entry.node)
        }),
        on<HTMLElement, 'pointerleave'>('pointerleave', (event) => {
          root._triggerLeave(event, entry.node)
        }),
        on<HTMLElement, 'click'>('click', press),
        on<HTMLElement, 'keydown'>('keydown', (event) => {
          if (!isButton && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault()
            press(event)
            return
          }
          root._triggerKeyDown(event, item, entry.node)
        }),
      ]
    }
  },
)

const iconMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let root = getRoot(handle)
  let item = getItem(handle)
  return () =>
    attrs({
      'aria-hidden': 'true',
      'data-popup-open': item && root.value === item.value ? '' : undefined,
    })
})

const linkMixin: MixinFactory<HTMLElement, [options?: NavigationMenuLinkOptions], ElementProps> =
  createMixin<HTMLElement, [options?: NavigationMenuLinkOptions], ElementProps>((handle) => {
    let root = getRoot(handle) as NavigationMenuContextValue | undefined
    let closeOnClick = false
    return (options, props) => {
      ;[options] = splitOptions(options, props)
      let active = options?.active ?? false
      closeOnClick = options?.closeOnClick ?? false
      return [
        attrs({
          'aria-current': active ? 'page' : undefined,
          'data-active': active ? '' : undefined,
        }),
        on<HTMLElement, 'click'>('click', (event) => {
          if (!closeOnClick || !root) return
          root._request(null, { reason: 'link-press', event })
        }),
      ]
    }
  })

const popupMixin: MixinFactory<HTMLElement, [options?: NavigationMenuPopupOptions], ElementProps> =
  createMixin<HTMLElement, [options?: NavigationMenuPopupOptions], ElementProps>((handle) => {
    let root = getRoot(handle)
    let surface = createPopupSurface(handle, root._store, { closeOnFocusOut: false })
    handle.addEventListener('insert', (event) => setRestingSize(event.node))
    return (options, props) => {
      ;[options, props] = splitOptions(options, props)
      return [
        // Non-modal: opening never moves focus (keyboard users Tab or ArrowDown into it).
        surface.render({ ...options, initialFocus: false }, props),
        on<HTMLElement, 'focusout'>('focusout', (event) => root._focusOut(event, 'popup')),
        on<HTMLElement, 'pointerenter'>('pointerenter', (event) => root._popupEnter(event)),
        on<HTMLElement, 'pointerleave'>('pointerleave', (event) => root._popupLeave(event)),
      ]
    }
  })

const arrowMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let arrow = createPopupArrow(handle, getRoot(handle)._store)
  return () => arrow.render()
})

const backdropMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let backdrop = createPopupBackdrop(handle, getRoot(handle)._store)
  return () => backdrop.render()
})

// ---------------------------------------------------------------------------------------------
// Exports

/**
 * Provider that owns the open item (Base UI `NavigationMenu.Root` state). Props: `value` /
 * `defaultValue` / `onValueChange(value, details)`, `onOpenChangeComplete`, `delay`,
 * `closeDelay`, `orientation`. Nest one inside another menu's content for a submenu.
 */
export const Context: (
  handle: Handle<NavigationMenuContextProps, NavigationMenuContextValue>,
) => () => RemixNode = NavigationMenuProvider

/** Provider for one item (Base UI `NavigationMenu.Item`). Prop: `value`. */
export const ItemContext: (
  handle: Handle<NavigationMenuItemContextProps, ItemContextValue>,
) => () => RemixNode = NavigationMenuItemProvider

/**
 * The item's content (Base UI `NavigationMenu.Content`). Declare it inside the item; it renders
 * as a `<div>` inside the viewport with `data-open` / `data-closed`,
 * `data-activation-direction`, and presence attributes. Accepts `<div>` host props.
 */
export const Content: (handle: Handle<NavigationMenuContentProps>) => () => RemixNode =
  ContentComponent

/**
 * The clipping viewport that renders the active content (Base UI `NavigationMenu.Viewport`).
 * Render it once, inside the popup (or inline, for a nested menu without a popup), after the
 * items. Accepts `<div>` host props.
 */
export const Viewport: (handle: Handle<NavigationMenuViewportProps>) => () => RemixNode =
  ViewportComponent

/** The root element, usually `<nav>`: `data-orientation`, `data-nested`, focus-out handling. */
export const root = rootMixin

/** The list of items, usually `<ul>`: arrow keys move between its triggers and links. */
export const list = listMixin

/**
 * The button that opens the item's content on hover or press: `aria-expanded`, `aria-controls`,
 * `data-popup-open`, `data-pressed`, `data-disabled`. Option: `disabled`.
 */
export const trigger = triggerMixin

/** An icon inside the trigger: `aria-hidden`, `data-popup-open`. */
export const icon = iconMixin

/** A navigation link: `aria-current="page"` / `data-active` with `active`; `closeOnClick`. */
export const link = linkMixin

/**
 * The shared popup (Base UI Positioner + Popup): top layer with `popover="manual"`, positioned
 * against the active trigger, `data-open` / `data-closed`, `data-side` / `data-align`, presence
 * attributes, `--popup-width` / `--popup-height` (animated between items), and the positioner
 * CSS variables.
 */
export const popup = popupMixin

/** An element inside the popup pointing at the active trigger. */
export const arrow = arrowMixin

/** An optional overlay shown in the top layer beneath the popup. */
export const backdrop = backdropMixin

/** Listens for the bubbling `stems:navigation-menu-change` event. */
export function onNavigationMenuChange<target extends HTMLElement>(
  handler: (
    event: Dispatched<NavigationMenuChangeEvent, target>,
    signal: AbortSignal,
  ) => void | Promise<void>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof NAVIGATION_MENU_CHANGE_EVENT>> {
  return on(NAVIGATION_MENU_CHANGE_EVENT, handler, captureBoolean)
}
