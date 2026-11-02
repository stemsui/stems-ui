// Adapted from @remix-run/ui 0.13.0 (packages/ui/src/menu.tsx).
// https://github.com/remix-run/remix - Copyright (c) 2025 Shopify Inc. MIT License.

/**
 * Shared implementation of `stems-ui/menu` and `stems-ui/context-menu`.
 *
 * Every menu (root, submenu, context menu) is a `MenuProvider` that owns a popup store from
 * `lib/popup.ts`, the highlighted item, and its registered items. Submenus are providers nested
 * inside their parent's popup: they register with the parent so closing a menu closes its
 * open descendants, and opening a submenu closes its open siblings.
 *
 * Items use real DOM focus (roving `tabIndex={-1}`); `data-highlighted` follows focus and pointer
 * hover. Keyboard handling lives on the popup element and ignores events from nested submenus.
 */

import { attrs, createMixin, on } from '@remix-run/component'
import type {
  Dispatched,
  ElementProps,
  Handle,
  MixInput,
  MixinFactory,
  MixinHandle,
  RemixNode,
} from '@remix-run/component'

import { separator as separatorMixin } from '../separator.ts'
import { splitOptions } from './collapsible-panel.ts'
import { getDirection, horizontalArrowStep } from './direction.ts'
import { createHoverAim } from './hover-aim.ts'
import { getMenubar, type MenubarContextValue } from './menubar.ts'
import { claimMenuFilter, type MenuFilterContextValue } from './menu-filter.ts'
import {
  attachPopupHandle,
  createDetachedPopupStore,
  createPopupArrow,
  createPopupBackdrop,
  createPopupStore,
  createPopupSurface,
  createPopupTrigger,
} from './popup.ts'
import {
  createPopupHandle,
  createTriggerBinding,
  forward,
  resolvePayloadChildren,
  writeAttributes,
} from './popup-handle.ts'
import type { PopupHandle, PopupPayloadChildren } from './popup-handle.ts'
import type {
  PopupAnchor,
  PopupChangeRequest,
  PopupFocusTarget,
  PopupInteractionType,
  PopupOpenChangeDetails,
  PopupOpenChangeReason,
  PopupStateProps,
  PopupStore,
  PopupSurfaceOptions,
  PopupTriggerEntry,
  PopupTriggerIdProps,
  PopupTriggerOptions,
} from './popup.ts'
import { createPresence } from './presence.ts'
import { getRovingMove, getRovingTargetIndex } from './roving-focus.ts'
import { getTabbableElements } from './tabbable.ts'
import { matchNextItemBySearchText } from './typeahead.ts'

// ---------------------------------------------------------------------------------------------
// Types and events

export type MenuKind = 'menu' | 'submenu' | 'context-menu'
export type MenuOrientation = 'horizontal' | 'vertical'
export type MenuItemKind = 'item' | 'checkbox-item' | 'radio-item' | 'link-item' | 'submenu-trigger'
export type MenuHighlightReason = 'keyboard' | 'pointer' | 'none'

/** The second argument of `onItemHighlighted`, like Base UI's `HighlightEventDetails`. */
export interface MenuHighlightDetails {
  readonly reason: MenuHighlightReason
  readonly event: Event | undefined
  /** The item's text label (its `label` option or text content). */
  readonly label: string | undefined
}

/** The second argument of `onCheckedChange` / `onValueChange`. */
export interface MenuItemChangeDetails {
  readonly reason: 'item-press'
  readonly event: Event
  /** Call to keep the current state. */
  cancel(): void
  readonly isCanceled: boolean
}

const MENU_CHANGE_EVENT = 'stems:menu-change' as const
const CONTEXT_MENU_CHANGE_EVENT = 'stems:context-menu-change' as const
const MENU_SELECT_EVENT = 'stems:menu-select' as const

declare global {
  interface HTMLElementEventMap {
    [MENU_CHANGE_EVENT]: MenuChangeEvent
    [CONTEXT_MENU_CHANGE_EVENT]: ContextMenuChangeEvent
    [MENU_SELECT_EVENT]: MenuSelectEvent
  }
}

/**
 * Bubbling event dispatched when a menu or submenu opens or closes, from its active trigger (or
 * the popup when there is none).
 */
export class MenuChangeEvent extends Event {
  readonly open: boolean
  readonly reason: PopupOpenChangeReason

  constructor(open: boolean, reason: PopupOpenChangeReason) {
    super(MENU_CHANGE_EVENT, { bubbles: true })
    this.open = open
    this.reason = reason
  }
}

/** Bubbling event dispatched from the popup when a context menu opens or closes. */
export class ContextMenuChangeEvent extends Event {
  readonly open: boolean
  readonly reason: PopupOpenChangeReason

  constructor(open: boolean, reason: PopupOpenChangeReason) {
    super(CONTEXT_MENU_CHANGE_EVENT, { bubbles: true })
    this.open = open
    this.reason = reason
  }
}

export interface MenuSelectEventInit {
  item: HTMLElement
  kind: Exclude<MenuItemKind, 'submenu-trigger'>
  label: string
  value: unknown
  checked: boolean | undefined
  closeOnClick: boolean
}

/**
 * Bubbling, cancelable event dispatched from an item when it is activated (click, Enter, or
 * Space), after checkbox / radio state has changed. Call `preventDefault()` to keep the menu
 * open even when the item would close it.
 */
export class MenuSelectEvent extends Event {
  /** The activated item element. */
  readonly item: HTMLElement
  readonly kind: Exclude<MenuItemKind, 'submenu-trigger'>
  /** The item's `label` option, or its text content. */
  readonly label: string
  /** The item's `value` option (the radio value for radio items). */
  readonly value: unknown
  /** The new checked state for checkbox and radio items. */
  readonly checked: boolean | undefined
  /** Whether the activation closes the menu (unless the event is canceled). */
  readonly closeOnClick: boolean

  constructor(init: MenuSelectEventInit) {
    super(MENU_SELECT_EVENT, { bubbles: true, cancelable: true })
    this.item = init.item
    this.kind = init.kind
    this.label = init.label
    this.value = init.value
    this.checked = init.checked
    this.closeOnClick = init.closeOnClick
  }
}

/** Listens for the bubbling `stems:menu-change` event. */
export function onMenuChange<target extends HTMLElement>(
  handler: (
    event: Dispatched<MenuChangeEvent, target>,
    signal: AbortSignal,
  ) => void | Promise<void>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof MENU_CHANGE_EVENT>> {
  return on(MENU_CHANGE_EVENT, handler, captureBoolean)
}

/** Listens for the bubbling `stems:context-menu-change` event. */
export function onContextMenuChange<target extends HTMLElement>(
  handler: (
    event: Dispatched<ContextMenuChangeEvent, target>,
    signal: AbortSignal,
  ) => void | Promise<void>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof CONTEXT_MENU_CHANGE_EVENT>> {
  return on(CONTEXT_MENU_CHANGE_EVENT, handler, captureBoolean)
}

/** Listens for the bubbling `stems:menu-select` event. */
export function onMenuSelect<target extends HTMLElement>(
  handler: (
    event: Dispatched<MenuSelectEvent, target>,
    signal: AbortSignal,
  ) => void | Promise<void>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof MENU_SELECT_EVENT>> {
  return on(MENU_SELECT_EVENT, handler, captureBoolean)
}

// ---------------------------------------------------------------------------------------------
// Props and options

interface MenuSharedProps {
  /**
   * Loop keyboard focus from the last item back to the first (and back).
   * @default true
   */
  loopFocus?: boolean
  /**
   * Which arrow keys move between items: Up/Down (`'vertical'`) or Left/Right (`'horizontal'`).
   * @default 'vertical'
   */
  orientation?: MenuOrientation
  /** Ignore user interaction: the trigger is disabled. */
  disabled?: boolean
  /**
   * Highlight (and focus) items as the pointer moves over them.
   * @default true
   */
  highlightItemOnHover?: boolean
  /** Called when the highlighted item changes (`undefined` when nothing is highlighted). */
  onItemHighlighted?: (item: HTMLElement | undefined, details: MenuHighlightDetails) => void
  children?: RemixNode
}

/**
 * Links a `menu.Context` with triggers rendered outside it (Base UI's `Menu.Handle`): `isOpen`,
 * `open(triggerId?)`, `close()`.
 */
export type MenuHandle<Payload = unknown> = PopupHandle<Payload, 'menu'>

/** Creates a handle for detached menu triggers (Base UI's `Menu.createHandle()`). */
export function createMenuHandle<Payload = unknown>(): MenuHandle<Payload> {
  return createPopupHandle<Payload, 'menu'>('menu')
}

/** Props of `menu.Context` (Base UI `Menu.Root`). */
export interface MenuContextProps<Payload = unknown>
  extends PopupStateProps, Omit<MenuSharedProps, 'children'>, PopupTriggerIdProps {
  /**
   * While open: lock page scroll, make outside content inert, and keep focus in the menu.
   * Ignored (treated as `false`) while the menu was opened by hovering the trigger.
   * @default true
   */
  modal?: PopupStateProps['modal']
  /** Connects triggers rendered outside the `Context` (`trigger({ handle })`). Read once. */
  handle?: MenuHandle<Payload>
  /** Nodes, or a function of `{ payload }` (the active trigger's `payload`). */
  children?: PopupPayloadChildren<RemixNode, Payload>
}

/** Props of `menu.SubmenuContext` (Base UI `Menu.SubmenuRoot`). Submenus are never modal. */
export interface SubmenuContextProps extends Omit<PopupStateProps, 'modal'>, MenuSharedProps {
  /**
   * Escape closes the whole menu tree instead of only this submenu.
   * @default false
   */
  closeParentOnEsc?: boolean
}

/** Props of `contextMenu.Context` (Base UI `ContextMenu.Root`). */
export interface ContextMenuContextProps extends PopupStateProps, MenuSharedProps {
  /**
   * Modal behavior while open. Context menus default to non-modal so a right click elsewhere in
   * the trigger area can reposition the menu.
   * @default false
   */
  modal?: PopupStateProps['modal']
}

/** Trigger options: `disabled`, and Base UI's `openOnHover` / `delay` / `closeDelay`. */
export interface MenuTriggerOptions extends PopupTriggerOptions {
  /** The menu to control when the trigger is outside its `Context`. Read on first render. */
  handle?: MenuHandle<any>
  /** Data for the menu while this trigger is active (`payload` in the `Context`). */
  payload?: unknown
}

/** Popup options: Base UI's Positioner props plus Popup's `initialFocus` / `finalFocus`. */
export interface MenuPopupOptions extends PopupSurfaceOptions {}

interface BaseItemOptions {
  /** Text used for typeahead (and the select event). Defaults to the text content. */
  label?: string
  /** Ignore user interaction; skipped by keyboard navigation. */
  disabled?: boolean
}

export interface MenuItemOptions extends BaseItemOptions {
  /**
   * Close the menu (the whole tree) when the item is activated.
   * @default true
   */
  closeOnClick?: boolean
  /** Stems extra: a value reported by `MenuSelectEvent.value`. */
  value?: unknown
}

export interface MenuLinkItemOptions {
  label?: string
  /**
   * Close the menu when the link is activated.
   * @default false
   */
  closeOnClick?: boolean
}

export interface MenuCheckboxItemOptions {
  label?: string
  /**
   * Close the menu when the item is toggled.
   * @default false
   */
  closeOnClick?: boolean
  /** Stems extra: a value reported by `MenuSelectEvent.value`. */
  value?: unknown
}

export interface MenuRadioItemOptions {
  label?: string
  /**
   * Close the menu when the item is selected.
   * @default false
   */
  closeOnClick?: boolean
}

export interface MenuIndicatorOptions {
  /**
   * Keep the indicator visible while unchecked (otherwise it is `hidden` once its exit
   * animation finishes).
   * @default false
   */
  keepMounted?: boolean
}

export interface SubmenuTriggerOptions extends BaseItemOptions {
  /**
   * Open the submenu when the trigger is hovered.
   * @default true
   */
  openOnHover?: boolean
  /**
   * Milliseconds to wait before opening on hover.
   * @default 100
   */
  delay?: number
  /**
   * Milliseconds to wait before closing a hover-opened submenu after the pointer leaves.
   * @default 0
   */
  closeDelay?: number
}

export interface CheckboxItemContextProps {
  /** Whether the item is checked (controlled). */
  checked?: boolean
  /**
   * Whether the item is initially checked (uncontrolled).
   * @default false
   */
  defaultChecked?: boolean
  /** Called with the next checked state. Call `details.cancel()` to veto. */
  onCheckedChange?: (checked: boolean, details: MenuItemChangeDetails) => void
  /** Ignore user interaction. */
  disabled?: boolean
  children?: RemixNode
}

export interface RadioGroupContextProps {
  /** The selected value (controlled). */
  value?: unknown
  /** The initially selected value (uncontrolled). */
  defaultValue?: unknown
  /** Called with the next value. Call `details.cancel()` to veto. */
  onValueChange?: (value: unknown, details: MenuItemChangeDetails) => void
  /** Ignore user interaction for every item in the group. */
  disabled?: boolean
  children?: RemixNode
}

export interface RadioItemContextProps {
  /** The value the group takes when this item is selected. */
  value: unknown
  /** Ignore user interaction. */
  disabled?: boolean
  children?: RemixNode
}

// ---------------------------------------------------------------------------------------------
// Menu state

interface ItemEntry {
  readonly kind: MenuItemKind
  disabled(): boolean
  label(): string
  submenu?: MenuContextValue
}

type FocusStrategy = 'first' | 'last' | 'popup' | 'none'

/** @internal Where focus goes when a menu opens: an edge item, the popup, or nowhere. */
export type MenuFocusStrategy = FocusStrategy

interface HighlightOptions {
  focus?: boolean
  reason?: MenuHighlightReason
  event?: Event
}

/**
 * Shared menu state, read with `handle.context.get(menu.Context)`. `store` is the
 * `lib/popup.ts` store (open state, reasons, ids, placement).
 */
export interface MenuContextValue {
  readonly kind: MenuKind
  readonly store: PopupStore
  /** The parent menu of a submenu. */
  readonly parent: MenuContextValue | undefined
  /** The outermost menu of the tree. */
  readonly root: MenuContextValue
  readonly open: boolean
  readonly disabled: boolean
  readonly orientation: MenuOrientation
  /** The highlighted item element, if any. */
  readonly highlighted: HTMLElement | null
  /** Requests an open-state change (see `PopupStore.setOpen`). */
  setOpen(open: boolean, request: PopupChangeRequest): boolean
  /** Closes the whole menu tree. */
  close(request?: Partial<PopupChangeRequest>): void
  /** @internal */
  _registerItem(node: HTMLElement, entry: ItemEntry): void
  /** @internal */
  _unregisterItem(node: HTMLElement): void
  /** @internal */
  _addChild(child: MenuContextValue, signal: AbortSignal): void
  /** @internal */
  _closeChildren(request: PopupChangeRequest, except?: MenuContextValue): void
  /** @internal */
  _highlight(node: HTMLElement | null, options?: HighlightOptions): void
  /** @internal */
  _pointerHighlight(node: HTMLElement | null, event: PointerEvent): void
  /** @internal */
  _pointerLeave(node: HTMLElement | null, event: PointerEvent): void
  /** @internal */
  _focusHighlight(node: HTMLElement | null): void
  /** @internal */
  _focusEdge(edge: 'first' | 'last'): boolean
  /** @internal */
  _setPendingFocus(strategy: FocusStrategy): void
  /** @internal */
  _initialFocus: Extract<PopupFocusTarget, Function>
  /** @internal */
  _finalFocus: Extract<PopupFocusTarget, Function>
  /** @internal */
  _onKeyDown(event: KeyboardEvent): void
  /** @internal */
  _setTriggerId(entry: object, id: string): void
  /** @internal */
  _labelId(): string | undefined
  /** @internal */
  _contextAnchor: PopupAnchor
  /** @internal */
  _contextFocus: HTMLElement | null
  /** @internal */
  _contextArea: HTMLElement | null
  /** @internal The enclosing `menubar.Context` of a top-level menu. */
  readonly _menubar: MenubarContextValue | undefined
  /** @internal */
  update(): Promise<unknown>
  /** The `FilterProvider` this menu claimed, if it's filterable. */
  readonly filter: MenuFilterContextValue | undefined
  /** @internal Whether the filter input holds focus while items are highlighted virtually. */
  readonly _virtual: boolean
  /** @internal */
  readonly _highlightSource: MenuHighlightReason
  /** @internal Whether the filter hides this item (or group of items). */
  _filterHidden(node: HTMLElement | null): boolean
  /** @internal Number of this menu's items the filter shows. */
  _visibleCount(): number
  /** @internal */
  _setFilterNode(kind: 'input' | 'list', node: HTMLElement | null): void
  /** @internal */
  readonly _filterInput: HTMLElement | null
}

// Internal prop set by the SubmenuContext / ContextMenuContext wrappers.
const KIND = '__stemsMenuKind'

interface InternalProps extends Omit<MenuContextProps, 'children'> {
  children?: PopupPayloadChildren<RemixNode>
  closeParentOnEsc?: boolean
  [KIND]?: MenuKind
}

// Open context menus, so opening one closes the others.
const openContextMenus = new Set<MenuContextValue>()

function MenuProvider(handle: Handle<InternalProps, MenuContextValue>): () => RemixNode {
  let kind: MenuKind = handle.props[KIND] ?? 'menu'
  let parent =
    kind === 'submenu'
      ? (handle.context.get(MenuProvider) as MenuContextValue | undefined)
      : undefined
  if (kind === 'submenu' && !parent) kind = 'menu'
  // A top-level menu inside `menubar.Context` becomes one of its menus.
  let menubar = kind === 'menu' ? getMenubar(handle) : undefined

  let entries = new Map<HTMLElement, ItemEntry>()
  let children = new Set<MenuContextValue>()
  let highlighted: HTMLElement | null = null
  let highlightSource: MenuHighlightReason = 'none'
  let pendingFocus: FocusStrategy | null = null
  let triggerIds = new Map<object, string>()
  let aim = createHoverAim()
  let typed = ''
  let typedTimer = 0
  let closingTree = false
  let menu: MenuContextValue
  // Filterable menus (lib/menu-filter.ts): the input keeps focus and items are highlighted
  // virtually (`aria-activedescendant`).
  let filter = claimMenuFilter(handle, handle)
  let filterInput: HTMLElement | null = null
  let filterList: HTMLElement | null = null
  let lastQuery = filter?.value
  let itemIds = 0

  let storeProps: PopupStateProps & PopupTriggerIdProps = {
    get open() {
      return handle.props.open
    },
    get defaultOpen() {
      return handle.props.defaultOpen
    },
    get onOpenChange() {
      return handle.props.onOpenChange
    },
    get onOpenChangeComplete() {
      if (!filter) return handle.props.onOpenChangeComplete
      return (open: boolean) => {
        handle.props.onOpenChangeComplete?.(open)
        // Base UI resets the query once the menu has closed (reason 'popup-close').
        if (!open && !store.open) filter?.setValue('', 'popup-close')
      }
    },
    get triggerId() {
      return handle.props.triggerId
    },
    get defaultTriggerId() {
      return handle.props.defaultTriggerId
    },
    get modal() {
      if (kind === 'submenu') return false
      // The menubar owns modality for its menus (lib/menubar.ts), keeping the menubar usable.
      if (menubar) return false
      // Base UI: a menu opened by hovering its trigger is never modal.
      if (store.openReason === 'trigger-hover') return false
      return handle.props.modal ?? kind === 'menu'
    },
  }

  // Detached triggers (`handle`) are for top-level menus only.
  let popupHandle = kind === 'menu' ? handle.props.handle : undefined
  let store = createPopupStore({
    handle: popupHandle,
    id: handle.id,
    getProps: () => storeProps,
    update: () => handle.update(),
    signal: handle.signal,
    createChangeEvent: (open, details) =>
      kind === 'context-menu'
        ? new ContextMenuChangeEvent(open, details.reason)
        : new MenuChangeEvent(open, details.reason),
  })

  // Wrap setOpen so every caller (trigger, surface, hover, items) keeps the tree consistent.
  let baseSetOpen = store.setOpen
  store.setOpen = (open, request) => {
    if (open === store.open) return false
    if (!open) {
      if (
        kind === 'submenu' &&
        request.reason === 'escape-key' &&
        handle.props.closeParentOnEsc &&
        parent &&
        !closingTree
      ) {
        closingTree = true
        try {
          parent.root.close(request)
        } finally {
          closingTree = false
        }
        return !store.open
      }
      for (let child of children) {
        if (child.store.open) child.store.setOpen(false, request)
      }
    } else {
      if (handle.props.disabled || menubar?.disabled) return false
      // Base UI reports 'sibling-open'; lib/popup.ts has no such reason, so 'none' is used.
      parent?._closeChildren({ ...request, reason: 'none' }, menu)
      menubar?._closeOthers(menu, request.event)
      if (kind === 'context-menu') {
        for (let other of openContextMenus) {
          if (other !== menu) other.close({ reason: 'outside-press', event: request.event })
        }
      }
    }
    let accepted = baseSetOpen(open, request)
    if (accepted && kind === 'context-menu') {
      if (open) openContextMenus.add(menu)
      else openContextMenus.delete(menu)
    }
    if (accepted && open) menubar?._menuOpened(menu)
    return accepted
  }
  handle.signal.addEventListener('abort', () => openContextMenus.delete(menu))
  if (menubar) {
    // Menubar menus stay open when the pointer leaves the popup after a hover switch (Base UI).
    store.hover.popupLeave = () => {}
  }

  function orientation(): MenuOrientation {
    return handle.props.orientation ?? 'vertical'
  }

  function visibleItems(): Array<[HTMLElement, ItemEntry]> {
    let popup = store.popupNode
    if (!popup) return []
    let result: Array<[HTMLElement, ItemEntry]> = []
    for (let node of popup.querySelectorAll<HTMLElement>('[role^="menuitem"]')) {
      let entry = entries.get(node)
      if (entry && !node.hidden) result.push([node, entry])
    }
    return result
  }

  function focusItem(node: HTMLElement) {
    if (node.ownerDocument.activeElement !== node) node.focus({ preventScroll: true })
    node.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }

  function labelOf(node: HTMLElement | null) {
    return node ? entries.get(node)?.label() : undefined
  }

  /** Whether the filter input owns focus, so highlighting doesn't move DOM focus. */
  function isVirtual() {
    let popup = store.popupNode
    return !!(filter && filterInput?.isConnected && popup?.contains(filterInput))
  }

  function highlight(node: HTMLElement | null, options: HighlightOptions = {}) {
    let { focus = false, reason = 'none', event } = options
    if (isVirtual()) {
      focus = false
      // `aria-activedescendant` needs an id.
      if (node && !node.id) node.id = `${store.popupId}-item-${++itemIds}`
    }
    if (highlighted !== node) {
      // Record the highlight before focusing: focusing runs `_focusHighlight` synchronously.
      highlighted = node
      highlightSource = reason
      if (node) {
        // Highlighting another item closes open submenus (Base UI).
        for (let child of children) {
          if (child.store.open && child.store.activeTrigger !== node) {
            child.store.setOpen(false, {
              reason: reason === 'pointer' ? 'trigger-hover' : 'list-navigation',
              event,
            })
          }
        }
      }
      handle.props.onItemHighlighted?.(node ?? undefined, { reason, event, label: labelOf(node) })
      void handle.update()
    }
    if (node && focus) focusItem(node)
  }

  function navigate(move: ReturnType<typeof getRovingMove>, event: KeyboardEvent) {
    if (!move) return
    let list = visibleItems()
    let current = list.findIndex(([node]) => node === highlighted)
    let index = getRovingTargetIndex(list.length, current, move, {
      loop: handle.props.loopFocus ?? true,
      isEnabled: (i) => !list[i][1].disabled(),
    })
    if (index >= 0) highlight(list[index][0], { focus: true, reason: 'keyboard', event })
  }

  function typeahead(char: string, event: KeyboardEvent) {
    clearTimeout(typedTimer)
    typed += char.toLowerCase()
    typedTimer = window.setTimeout(() => (typed = ''), 750)
    let list = visibleItems().filter(([, entry]) => !entry.disabled())
    let current = list.findIndex(([node]) => node === highlighted)
    // Repeating one character cycles through the items starting with it.
    let repeated = typed.length > 1 && [...typed].every((c) => c === typed[0])
    let text = repeated ? typed[0] : typed
    let fromIndex = typed.length > 1 && !repeated ? current - 1 : current
    let match = matchNextItemBySearchText(text, list, {
      fromIndex,
      getSearchValues: ([, entry]) => entry.label(),
    })
    if (match) highlight(match[0], { focus: true, reason: 'keyboard', event })
  }

  function focusEdge(edge: 'first' | 'last') {
    let list = visibleItems().filter(([, entry]) => !entry.disabled())
    let target = edge === 'first' ? list[0] : list.at(-1)
    if (!target) return false
    highlight(target[0], { focus: true, reason: 'keyboard' })
    return true
  }

  function tabOut(event: KeyboardEvent) {
    let root = menu.root
    let trigger = root.store.activeTrigger ?? root._contextArea
    let backwards = event.shiftKey
    root.store._setInteractionType('keyboard')
    root.close({ reason: 'focus-out', event })
    void root.store.update().then(() => {
      if (root.store.open || !trigger?.isConnected) return
      let tabbables = getTabbableElements(trigger.ownerDocument.body)
      let index = tabbables.indexOf(trigger)
      let target = backwards || index === -1 ? null : tabbables[index + 1]
      ;(target ?? trigger).focus()
    })
  }

  function onKeyDown(event: KeyboardEvent) {
    let popup = store.popupNode
    let target = event.target
    if (!popup || !(target instanceof Element)) return
    // Ignore keys from nested submenus. A filterable menu's popup is a dialog holding the input
    // and the `role="menu"` list.
    let owner = target.closest('[role="menu"], [role="dialog"]')
    if (owner !== popup && !(owner !== null && owner === filterList && popup.contains(owner))) {
      return
    }
    if (event.defaultPrevented || event.isComposing) return

    let key = event.key
    let fromInput = filter !== undefined && target === filterInput
    if (fromInput && !filterKey(event)) return
    let dir = getDirection(popup)
    let vertical = orientation() === 'vertical'
    let step = horizontalArrowStep(key, dir)
    let entry = highlighted ? entries.get(highlighted) : undefined

    let openKey = vertical ? step === 1 : key === 'ArrowDown'
    let closeKey = vertical ? step === -1 : key === 'ArrowUp'

    if (openKey && entry?.submenu && !entry.disabled()) {
      event.preventDefault()
      let sub = entry.submenu
      if (sub.store.open) {
        sub.store._setOpenReason('list-navigation')
        sub._focusEdge('first')
      } else {
        sub.store.hover.cancel()
        sub._setPendingFocus('first')
        sub.store._setInteractionType('keyboard')
        sub.store.setOpen(true, { reason: 'list-navigation', event, trigger: highlighted })
      }
      return
    }

    if (closeKey && kind === 'submenu') {
      event.preventDefault()
      store._setInteractionType('keyboard')
      store.setOpen(false, { reason: 'list-navigation', event })
      return
    }

    // In a menubar, Left / Right that no submenu used move to the adjacent menu.
    let menubarOfTree = menu.root._menubar
    if (vertical && step !== 0 && menubarOfTree?._onPopupArrow(menu.root, step, event)) return

    let move = getRovingMove(key, vertical ? 'vertical' : 'horizontal', dir)
    if (move) {
      event.preventDefault()
      navigate(move, event)
      return
    }

    if (key === 'Enter' || (key === ' ' && typed === '')) {
      event.preventDefault()
      if (highlighted && entry && !entry.disabled()) highlighted.click()
      return
    }

    if (key === 'Tab') {
      // Base UI: Tab closes the menu tree and moves on from the trigger.
      event.preventDefault()
      event.stopImmediatePropagation()
      tabOut(event)
      return
    }

    // A filterable menu has no typeahead: characters go to the input.
    if (filter) return
    if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (key === ' ') event.preventDefault()
      typeahead(key, event)
    }
  }

  /**
   * Whether a key typed in the filter input navigates the menu (`true`) or edits the text
   * (`false`), after Base UI's `getMenuFilterKeyAction`.
   */
  function filterKey(event: KeyboardEvent): boolean {
    let key = event.key
    if (event.keyCode === 229) return false
    if (key === 'Tab' || key === 'Escape') return true
    if (key === 'Enter') {
      event.preventDefault()
      let entry = highlighted ? entries.get(highlighted) : undefined
      if (highlighted && entry && !entry.disabled()) highlighted.click()
      return false
    }
    let arrow = key.startsWith('Arrow')
    let boundary = key === 'Home' || key === 'End'
    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
      return !(arrow || boundary || key.length === 1)
    }
    if (key.length === 1) return false
    let hasValue = (filter?.value ?? '') !== ''
    if (boundary) return highlighted !== null && !hasValue
    if (!arrow) return true
    let vertical = orientation() === 'vertical'
    let mainAxis = vertical
      ? key === 'ArrowUp' || key === 'ArrowDown'
      : !(key === 'ArrowUp' || key === 'ArrowDown')
    if (mainAxis) return true
    // Cross-axis keys open / close a highlighted submenu trigger's submenu, and otherwise move
    // the caret of a non-empty input.
    if (highlighted && entries.get(highlighted)?.submenu) return true
    return !hasValue
  }

  menu = {
    get kind() {
      return kind
    },
    store,
    parent,
    get root() {
      return parent ? parent.root : menu
    },
    get open() {
      return store.open
    },
    get disabled() {
      return handle.props.disabled ?? false
    },
    get orientation() {
      return orientation()
    },
    get highlighted() {
      return highlighted
    },
    setOpen: (open, request) => store.setOpen(open, request),
    close(request = {}) {
      let root = menu.root
      root.store.setOpen(false, { reason: 'imperative-action', ...request })
    },
    update: () => handle.update(),
    _registerItem(node, entry) {
      entries.set(node, entry)
    },
    _unregisterItem(node) {
      entries.delete(node)
      if (highlighted === node) highlighted = null
    },
    _addChild(child, signal) {
      children.add(child)
      signal.addEventListener('abort', () => children.delete(child))
    },
    _closeChildren(request, except) {
      for (let child of children) {
        if (child !== except && child.store.open) child.store.setOpen(false, request)
      }
    },
    _highlight: highlight,
    _pointerHighlight(node, event) {
      if (!node || event.pointerType === 'touch') return
      if (handle.props.highlightItemOnHover === false) return
      if (!aim.accepts(event)) return
      let entry = entries.get(node)
      if (!entry || entry.disabled()) return
      if (highlighted === node && node.ownerDocument.activeElement === node) return
      highlight(node, { focus: true, reason: 'pointer', event })
    },
    _pointerLeave(node, event) {
      if (!node || highlighted !== node || event.pointerType === 'touch') return
      if (handle.props.highlightItemOnHover === false) return
      // Only pointer highlights end on pointer leave: a keyboard highlight stays when a popup
      // shows up (or moves) under a resting pointer.
      if (highlightSource !== 'pointer') return
      let sub = entries.get(node)?.submenu
      if (sub?.store.open) {
        // Keep the trigger highlighted while its submenu is open, and ignore sibling items the
        // pointer crosses on the way to it.
        let subPopup = sub.store.popupNode
        if (subPopup) aim.start(node, subPopup, event)
        return
      }
      let next = event.relatedTarget
      let popup = store.popupNode
      if (
        next instanceof Element &&
        popup &&
        next.closest('[role^="menuitem"]') &&
        next.closest('[role="menu"]') === popup
      ) {
        return
      }
      highlight(null, { reason: 'pointer', event })
      if (popup && !isVirtual() && popup.contains(popup.ownerDocument.activeElement)) {
        popup.focus({ preventScroll: true })
      }
    },
    _focusHighlight(node) {
      if (node && highlighted !== node && entries.has(node)) highlight(node, { reason: 'keyboard' })
    },
    _focusEdge: focusEdge,
    _setPendingFocus(strategy) {
      pendingFocus = strategy
    },
    _initialFocus(type: PopupInteractionType | null) {
      let strategy = pendingFocus ?? (type === 'keyboard' ? 'first' : 'popup')
      pendingFocus = null
      if (filter && filterInput?.isConnected && store.popupNode?.contains(filterInput)) {
        // Base UI: a click or keyboard open focuses the input; hover, touch and pen opens
        // don't (no on-screen keyboard). A keyboard open highlights the first item.
        let hover = store.openReason === 'trigger-hover'
        if (strategy === 'none' || hover || type === 'touch' || type === 'pen') {
          return strategy === 'none' ? undefined : store.popupNode
        }
        let list = visibleItems().filter(([, entry]) => !entry.disabled())
        let edge = strategy === 'last' ? list.at(-1) : list[0]
        if (
          edge &&
          (strategy === 'first' || strategy === 'last' || filter.autoHighlight === 'always')
        ) {
          highlight(edge[0], { reason: strategy === 'popup' ? 'none' : 'keyboard' })
        }
        return filterInput
      }
      if (strategy === 'none') return undefined
      if (strategy === 'first' || strategy === 'last') {
        let list = visibleItems().filter(([, entry]) => !entry.disabled())
        let target = strategy === 'first' ? list[0] : list.at(-1)
        if (target) return target[0]
      }
      return store.popupNode
    },
    _finalFocus() {
      let target = menu._contextFocus
      return target?.isConnected ? target : false
    },
    _onKeyDown: onKeyDown,
    _setTriggerId(entry, id) {
      if (triggerIds.get(entry) === id) return
      triggerIds.set(entry, id)
    },
    _labelId() {
      let active = store.activeTrigger
      if (active?.id) return active.id
      return triggerIds.values().next().value
    },
    _contextAnchor: null,
    _contextFocus: null,
    _contextArea: null,
    _menubar: menubar,
    filter,
    get _virtual() {
      return isVirtual()
    },
    get _highlightSource() {
      return highlightSource
    },
    _filterHidden(node) {
      if (!filter?.active || !node) return false
      let entry = entries.get(node)
      if (entry) return !filter.matches(entry.label())
      // A group: hidden when it has items of this menu and the filter hides all of them.
      let own = [...node.querySelectorAll<HTMLElement>('[role^="menuitem"]')].filter((item) =>
        entries.has(item),
      )
      return own.length > 0 && own.every((item) => !filter!.matches(entries.get(item)!.label()))
    },
    _visibleCount() {
      let popup = store.popupNode
      let count = 0
      for (let [node, entry] of entries) {
        if (popup && !popup.contains(node)) continue
        if (!filter?.active || filter.matches(entry.label())) count++
      }
      return count
    },
    _setFilterNode(kind, node) {
      if (kind === 'input') {
        filterInput = node
        filter?._setInput(node)
      } else {
        filterList = node
      }
    },
    get _filterInput() {
      return filterInput
    },
  }

  filter?._setUpdate(() => handle.update())

  /** After the query changed: drop a highlight the filter hid, and auto-highlight. */
  function afterFilter() {
    if (!store.open) return
    let list = visibleItems().filter(([, entry]) => !entry.disabled())
    if (highlighted && !list.some(([node]) => node === highlighted)) {
      highlight(null, { reason: 'none' })
    }
    let auto = filter?.autoHighlight
    let query = filter?.value.trim() ?? ''
    if ((auto === 'always' || (auto && query !== '')) && list[0]) {
      highlight(list[0][0], { reason: 'none' })
    }
    store.popupNode?.querySelector('[role="menu"]')?.scrollTo?.({ top: 0 })
    if (highlighted) highlighted.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }

  parent?._addChild(menu, handle.signal)
  menubar?._register(menu, handle.signal)
  handle.context.set(menu)
  attachPopupHandle(popupHandle, menu, store, handle.signal)
  handle.signal.addEventListener('abort', () => clearTimeout(typedTimer))

  return () => {
    store.sync()
    menubar?._sync()
    if (filter && filter.value !== lastQuery) {
      lastQuery = filter.value
      handle.queueTask(afterFilter)
    }
    if (!store.open) {
      highlighted = null
      pendingFocus = null
      typed = ''
    }
    if (parent && store.open && !parent.store.open) {
      handle.queueTask(() => {
        if (store.open && !parent.store.open) store.setOpen(false, { reason: 'none' })
      })
    }
    return resolvePayloadChildren(handle.props.children, store.payload)
  }
}

// A detached trigger's menu while no `Context` is attached: closed and inert (methods no-op).
function createDetachedMenu(store: PopupStore): MenuContextValue {
  let values: Partial<MenuContextValue> = {
    kind: 'menu',
    store,
    parent: undefined,
    open: false,
    disabled: false,
    orientation: 'vertical',
    highlighted: null,
    _contextAnchor: null,
    _contextFocus: null,
    _contextArea: null,
    _menubar: undefined,
  }
  let menu: MenuContextValue = new Proxy(values as MenuContextValue, {
    get(target, key) {
      if (key === 'root') return menu
      if (key in target) return Reflect.get(target, key)
      return () => undefined
    },
  })
  return menu
}

function withKind(kind: MenuKind) {
  return function MenuKindProvider(handle: Handle<InternalProps>): () => RemixNode {
    return () => <MenuProvider {...handle.props} {...{ [KIND]: kind }} />
  }
}

function getMenu(handle: MixinHandle<HTMLElement>): MenuContextValue {
  return handle.context.get(MenuProvider) as MenuContextValue
}

/**
 * Provider that owns a menu's state (Base UI `Menu.Root`). Props: `open` / `defaultOpen` /
 * `onOpenChange(open, details)`, `onOpenChangeComplete`, `modal` (default `true`), `loopFocus`,
 * `orientation`, `disabled`, `highlightItemOnHover`, `onItemHighlighted`.
 */
export const MenuContext = MenuProvider as unknown as <Payload = unknown>(
  handle: Handle<MenuContextProps<Payload>, MenuContextValue>,
) => () => RemixNode

/** Provider for a submenu nested in a menu popup (Base UI `Menu.SubmenuRoot`). */
export const SubmenuContext = withKind('submenu') as unknown as (
  handle: Handle<SubmenuContextProps>,
) => () => RemixNode

/** Provider for a context menu (Base UI `ContextMenu.Root`). */
export const ContextMenuContext = withKind('context-menu') as unknown as (
  handle: Handle<ContextMenuContextProps>,
) => () => RemixNode

// ---------------------------------------------------------------------------------------------
// Trigger, popup, arrow, backdrop

export const trigger: MixinFactory<HTMLElement, [options?: MenuTriggerOptions], ElementProps> =
  createMixin<HTMLElement, [options?: MenuTriggerOptions], ElementProps>((handle, hostType) => {
    // Resolves to the attached root of `options.handle`, else the enclosing menu.
    let binding = createTriggerBinding(
      handle,
      getMenu(handle) as MenuContextValue | undefined,
      (popupHandle) => createDetachedMenu(createDetachedPopupStore(popupHandle)),
      (resolve) => ({ store: forward(() => resolve().store) }),
    )
    // Menubar calls compare menus by identity, so they get `binding.current`.
    let menu = binding.context
    let store = menu.store
    let menubar = menu._menubar
    // A filterable menu's popup is a dialog holding the input and the menu list (Base UI).
    let filterable = (getMenu(handle) as MenuContextValue | undefined)?.filter !== undefined
    let popupTrigger = createPopupTrigger(handle, hostType, store, {
      haspopup: filterable ? 'dialog' : 'menu',
      isDetached: () => binding.detached,
    })

    function refresh() {
      popupTrigger.refresh()
      let node = popupTrigger.node
      let open = store.open && store.isActiveTrigger(popupTrigger.entry)
      if (node) writeAttributes(node, { 'data-pressed': open ? '' : undefined })
    }

    function onKeyDown(event: KeyboardEvent) {
      if (
        menubar &&
        !popupTrigger.entry.disabled &&
        menubar._onTriggerKeyDown(binding.current, event)
      )
        return
      if (popupTrigger.entry.disabled || menu.orientation === 'horizontal') return
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
      event.preventDefault()
      let edge: 'first' | 'last' = event.key === 'ArrowDown' ? 'first' : 'last'
      if (store.open) {
        if (!menu._focusEdge(edge)) store.popupNode?.focus()
        return
      }
      store.hover.cancel()
      store._setInteractionType('keyboard')
      menu._setPendingFocus(edge)
      store.setOpen(true, { reason: 'trigger-press', event, trigger: popupTrigger.node })
    }

    return (options, props) => {
      ;[options, props] = splitOptions(options, props)
      let opts = options ?? {}
      binding.bind(opts.handle, refresh)
      let id = typeof props.id === 'string' ? props.id : handle.id
      menu._setTriggerId(popupTrigger.entry, id)
      let open = store.open && store.isActiveTrigger(popupTrigger.entry)
      let disabled = (opts.disabled ?? menu.disabled) || (menubar?.disabled ?? false)
      return [
        attrs({ id, 'data-pressed': open ? '' : undefined }),
        // Inside a menubar the trigger is a menubar item with a roving tab stop. Rendered before
        // the generic trigger attributes so `role` and `tabIndex` take precedence.
        menubar &&
          attrs({
            role: 'menuitem',
            tabIndex: disabled ? undefined : menubar._isTabbable(binding.current) ? 0 : -1,
          }),
        popupTrigger.render({
          disabled,
          openOnHover: opts.openOnHover,
          delay: opts.delay ?? 100,
          closeDelay: opts.closeDelay,
          payload: opts.payload,
        }),
        on<HTMLElement, 'keydown'>('keydown', onKeyDown),
        menubar && on<HTMLElement, 'focus'>('focus', () => menubar._setActive(binding.current)),
        menubar &&
          on<HTMLElement, 'pointerenter'>('pointerenter', (event) => {
            if (!disabled) menubar._onTriggerHover(binding.current, event)
          }),
      ]
    }
  })

const DEFAULT_PLACEMENT: Record<MenuKind, Pick<PopupSurfaceOptions, 'side' | 'align'>> = {
  menu: { side: 'bottom', align: 'center' },
  submenu: { side: 'inline-end', align: 'start' },
  'context-menu': { side: 'bottom', align: 'start' },
}

// Menus of a menubar line up with their trigger's start edge (below, or beside when vertical).
const MENUBAR_PLACEMENT: Pick<PopupSurfaceOptions, 'side' | 'align'> = {
  side: 'bottom',
  align: 'start',
}
const MENUBAR_VERTICAL_PLACEMENT: Pick<PopupSurfaceOptions, 'side' | 'align'> = {
  side: 'inline-end',
  align: 'start',
}

export const popup: MixinFactory<HTMLElement, [options?: MenuPopupOptions], ElementProps> =
  createMixin<HTMLElement, [options?: MenuPopupOptions], ElementProps>((handle) => {
    let menu = getMenu(handle)
    let surface = createPopupSurface(handle, menu.store)
    let contextAnchor = () => menu._contextAnchor
    let menubar = menu._menubar
    // While switching between menubar menus, the closing menu keeps focus where the switch put it.
    let menubarFinalFocus = () => !menubar?._otherOpen(menu)

    return (options, props) => {
      ;[options, props] = splitOptions(options, props)
      let opts = options ?? {}
      let defaults = menubar
        ? menubar.orientation === 'vertical'
          ? MENUBAR_VERTICAL_PLACEMENT
          : MENUBAR_PLACEMENT
        : DEFAULT_PLACEMENT[menu.kind]
      let isContext = menu.root.kind === 'context-menu'
      return [
        attrs({
          // A filterable menu's popup is a dialog; `list()` takes the menu role.
          role: menu.filter ? 'dialog' : 'menu',
          'aria-orientation':
            !menu.filter && menu.orientation === 'horizontal' ? 'horizontal' : undefined,
          'aria-labelledby': menu._labelId(),
        }),
        surface.render(
          {
            ...opts,
            side: opts.side ?? defaults.side,
            align: opts.align ?? defaults.align,
            anchor: opts.anchor ?? (menu.kind === 'context-menu' ? contextAnchor : undefined),
            initialFocus: opts.initialFocus ?? menu._initialFocus,
            finalFocus:
              opts.finalFocus ??
              (menu.kind === 'context-menu'
                ? menu._finalFocus
                : menubar
                  ? menubarFinalFocus
                  : undefined),
          },
          props,
        ),
        on<HTMLElement, 'keydown'>('keydown', (event) => menu._onKeyDown(event)),
        isContext &&
          on<HTMLElement, 'contextmenu'>('contextmenu', (event) => event.preventDefault()),
      ]
    }
  })

export const arrow: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let part = createPopupArrow(handle, getMenu(handle).store)
  return () => part.render()
})

export const backdrop: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let part = createPopupBackdrop(handle, getMenu(handle).store)
  return () => part.render()
})

// ---------------------------------------------------------------------------------------------
// Items

function normalizeText(text: string | null | undefined) {
  return (text ?? '').replace(/\s+/g, ' ').trim()
}

function changeDetails(event: Event): MenuItemChangeDetails {
  let canceled = false
  return {
    reason: 'item-press',
    event,
    cancel() {
      canceled = true
    },
    get isCanceled() {
      return canceled
    },
  }
}

interface ItemCore {
  readonly node: HTMLElement | null
  /** Renders role, focus, highlight, and pointer / focus listeners. */
  render(state: {
    role: string
    disabled: boolean
    label: string | undefined
  }): MixInput<HTMLElement, ElementProps>
}

/**
 * Behavior shared by every item kind: registration with the owning menu (for navigation and
 * typeahead), `tabIndex={-1}`, `data-highlighted`, `data-disabled`, pointer highlight, and the
 * click handler that runs `activate` (keyboard Enter / Space call `click()`).
 */
function createItemCore(
  handle: MixinHandle<HTMLElement>,
  hostType: string,
  menu: MenuContextValue,
  kind: MenuItemKind,
  activate: (event: MouseEvent, node: HTMLElement) => void,
): ItemCore {
  let node: HTMLElement | null = null
  let disabled = false
  let label: string | undefined
  let entry: ItemEntry = {
    kind,
    disabled: () => disabled,
    label: () => normalizeText(label ?? node?.textContent),
  }

  handle.addEventListener('insert', (event) => {
    node = event.node
    menu._registerItem(node, entry)
  })
  handle.addEventListener('remove', () => {
    if (node) menu._unregisterItem(node)
    node = null
  })

  return {
    get node() {
      return node
    },
    render(state) {
      disabled = state.disabled
      label = state.label
      let highlighted = node !== null && menu.highlighted === node
      return [
        attrs({
          role: state.role,
          type: hostType === 'button' ? 'button' : undefined,
          tabIndex: -1,
          'aria-disabled': disabled ? 'true' : undefined,
          'data-disabled': disabled ? '' : undefined,
          'data-highlighted': highlighted ? '' : undefined,
          hidden: menu._filterHidden(node) ? true : undefined,
        }),
        on<HTMLElement, 'click'>('click', (event) => {
          if (disabled || !node) {
            event.preventDefault()
            return
          }
          activate(event, node)
        }),
        on<HTMLElement, 'pointermove'>('pointermove', (event) =>
          menu._pointerHighlight(node, event),
        ),
        on<HTMLElement, 'pointerleave'>('pointerleave', (event) => menu._pointerLeave(node, event)),
        on<HTMLElement, 'focus'>('focus', () => menu._focusHighlight(node)),
      ]
    },
  }
}

function finishActivation(
  menu: MenuContextValue,
  node: HTMLElement,
  event: MouseEvent,
  init: Omit<MenuSelectEventInit, 'item'>,
) {
  let select = new MenuSelectEvent({ item: node, ...init })
  node.dispatchEvent(select)
  if (!init.closeOnClick || select.defaultPrevented) return
  let root = menu.root
  root.store._setInteractionType(event.detail === 0 ? 'keyboard' : 'mouse')
  root.close({ reason: 'item-press', event })
}

export const item: MixinFactory<HTMLElement, [options?: MenuItemOptions], ElementProps> =
  createMixin<HTMLElement, [options?: MenuItemOptions], ElementProps>((handle, hostType) => {
    let menu = getMenu(handle)
    let opts: MenuItemOptions = {}
    let core = createItemCore(handle, hostType, menu, 'item', (event, node) => {
      finishActivation(menu, node, event, {
        kind: 'item',
        label: normalizeText(opts.label ?? node.textContent),
        value: opts.value,
        checked: undefined,
        closeOnClick: opts.closeOnClick ?? true,
      })
    })
    return (options, props) => {
      ;[options, props] = splitOptions(options, props)
      opts = options ?? {}
      return core.render({ role: 'menuitem', disabled: opts.disabled ?? false, label: opts.label })
    }
  })

export const linkItem: MixinFactory<HTMLElement, [options?: MenuLinkItemOptions], ElementProps> =
  createMixin<HTMLElement, [options?: MenuLinkItemOptions], ElementProps>((handle, hostType) => {
    let menu = getMenu(handle)
    let opts: MenuLinkItemOptions = {}
    let core = createItemCore(handle, hostType, menu, 'link-item', (event, node) => {
      finishActivation(menu, node, event, {
        kind: 'link-item',
        label: normalizeText(opts.label ?? node.textContent),
        value: node.getAttribute('href') ?? undefined,
        checked: undefined,
        closeOnClick: opts.closeOnClick ?? false,
      })
    })
    return (options, props) => {
      ;[options, props] = splitOptions(options, props)
      opts = options ?? {}
      return core.render({ role: 'menuitem', disabled: false, label: opts.label })
    }
  })

// Checkbox items -------------------------------------------------------------------------------

export interface CheckboxItemContextValue {
  readonly checked: boolean
  readonly disabled: boolean
  /** Requests a checked-state change. Returns whether it was accepted. */
  setChecked(checked: boolean, event: Event): boolean
}

function CheckboxItemProvider(
  handle: Handle<CheckboxItemContextProps, CheckboxItemContextValue>,
): () => RemixNode {
  let uncontrolled = handle.props.defaultChecked ?? false
  let value: CheckboxItemContextValue = {
    get checked() {
      return handle.props.checked ?? uncontrolled
    },
    get disabled() {
      return handle.props.disabled ?? false
    },
    setChecked(next, event) {
      let details = changeDetails(event)
      handle.props.onCheckedChange?.(next, details)
      if (details.isCanceled) return false
      if (handle.props.checked === undefined) uncontrolled = next
      void handle.update()
      return true
    },
  }
  handle.context.set(value)
  return () => handle.props.children
}

/**
 * Provider for a checkbox item's state (Base UI `Menu.CheckboxItem` state props): `checked` /
 * `defaultChecked` / `onCheckedChange(checked, details)`, `disabled`.
 */
export const CheckboxItemContext: (
  handle: Handle<CheckboxItemContextProps, CheckboxItemContextValue>,
) => () => RemixNode = CheckboxItemProvider

export const checkboxItem: MixinFactory<
  HTMLElement,
  [options?: MenuCheckboxItemOptions],
  ElementProps
> = createMixin<HTMLElement, [options?: MenuCheckboxItemOptions], ElementProps>(
  (handle, hostType) => {
    let menu = getMenu(handle)
    let state =
      (handle.context.get(CheckboxItemProvider) as CheckboxItemContextValue | undefined) ??
      localCheckboxState(menu)
    let opts: MenuCheckboxItemOptions = {}
    let core = createItemCore(handle, hostType, menu, 'checkbox-item', (event, node) => {
      let next = !state.checked
      if (!state.setChecked(next, event)) return
      finishActivation(menu, node, event, {
        kind: 'checkbox-item',
        label: normalizeText(opts.label ?? node.textContent),
        value: opts.value,
        checked: next,
        closeOnClick: opts.closeOnClick ?? false,
      })
    })
    return (options, props) => {
      ;[options, props] = splitOptions(options, props)
      opts = options ?? {}
      let checked = state.checked
      return [
        attrs({
          'aria-checked': checked ? 'true' : 'false',
          'data-checked': checked ? '' : undefined,
          'data-unchecked': checked ? undefined : '',
        }),
        core.render({ role: 'menuitemcheckbox', disabled: state.disabled, label: opts.label }),
      ]
    }
  },
)

// Used when a checkbox item has no CheckboxItemContext: uncontrolled, starts unchecked.
function localCheckboxState(menu: MenuContextValue): CheckboxItemContextValue {
  let checked = false
  return {
    get checked() {
      return checked
    },
    disabled: false,
    setChecked(next) {
      checked = next
      void menu.update()
      return true
    },
  }
}

const NO_RADIO_ITEM: RadioItemContextValue = {
  value: undefined,
  checked: false,
  disabled: false,
  group: undefined,
}

function createIndicator(
  handle: MixinHandle<HTMLElement>,
  menu: MenuContextValue,
  getState: () => { checked: boolean; disabled: boolean },
) {
  let presence = createPresence(handle, { update: () => menu.update() })
  return (options: MenuIndicatorOptions | undefined) => {
    let { checked, disabled } = getState()
    presence.sync(checked)
    return attrs({
      'aria-hidden': 'true',
      hidden: options?.keepMounted || presence.present ? undefined : true,
      'data-checked': checked ? '' : undefined,
      'data-unchecked': checked ? undefined : '',
      'data-disabled': disabled ? '' : undefined,
      ...presence.attrs(),
    })
  }
}

export const checkboxItemIndicator: MixinFactory<
  HTMLElement,
  [options?: MenuIndicatorOptions],
  ElementProps
> = createMixin<HTMLElement, [options?: MenuIndicatorOptions], ElementProps>((handle) => {
  let state = (handle.context.get(CheckboxItemProvider) as
    CheckboxItemContextValue | undefined) ?? {
    checked: false,
    disabled: false,
  }
  let render = createIndicator(handle, getMenu(handle), () => state)
  return (options, props) => {
    ;[options] = splitOptions(options, props)
    return render(options)
  }
})

// Radio items ----------------------------------------------------------------------------------

export interface RadioGroupContextValue {
  readonly value: unknown
  readonly disabled: boolean
  /** Requests a value change. Returns whether it was accepted (or already selected). */
  setValue(value: unknown, event: Event): boolean
}

function RadioGroupProvider(
  handle: Handle<RadioGroupContextProps, RadioGroupContextValue>,
): () => RemixNode {
  let uncontrolled = handle.props.defaultValue
  let group: RadioGroupContextValue = {
    get value() {
      return handle.props.value !== undefined ? handle.props.value : uncontrolled
    },
    get disabled() {
      return handle.props.disabled ?? false
    },
    setValue(next, event) {
      if (Object.is(next, group.value)) return true
      let details = changeDetails(event)
      handle.props.onValueChange?.(next, details)
      if (details.isCanceled) return false
      if (handle.props.value === undefined) uncontrolled = next
      void handle.update()
      return true
    },
  }
  handle.context.set(group)
  return () => handle.props.children
}

/**
 * Provider for a radio group's value (Base UI `Menu.RadioGroup` props): `value` /
 * `defaultValue` / `onValueChange(value, details)`, `disabled`.
 */
export const RadioGroupContext: (
  handle: Handle<RadioGroupContextProps, RadioGroupContextValue>,
) => () => RemixNode = RadioGroupProvider

export interface RadioItemContextValue {
  readonly value: unknown
  readonly checked: boolean
  readonly disabled: boolean
  readonly group: RadioGroupContextValue | undefined
}

function RadioItemProvider(
  handle: Handle<RadioItemContextProps, RadioItemContextValue>,
): () => RemixNode {
  let group = handle.context.get(RadioGroupProvider) as RadioGroupContextValue | undefined
  let value: RadioItemContextValue = {
    get value() {
      return handle.props.value
    },
    get checked() {
      return Object.is(group?.value, handle.props.value)
    },
    get disabled() {
      return (handle.props.disabled ?? false) || (group?.disabled ?? false)
    },
    group,
  }
  handle.context.set(value)
  return () => handle.props.children
}

/** Provider for a radio item (Base UI `Menu.RadioItem` state props): `value`, `disabled`. */
export const RadioItemContext: (
  handle: Handle<RadioItemContextProps, RadioItemContextValue>,
) => () => RemixNode = RadioItemProvider

export const radioItem: MixinFactory<HTMLElement, [options?: MenuRadioItemOptions], ElementProps> =
  createMixin<HTMLElement, [options?: MenuRadioItemOptions], ElementProps>((handle, hostType) => {
    let menu = getMenu(handle)
    let state =
      (handle.context.get(RadioItemProvider) as RadioItemContextValue | undefined) ?? NO_RADIO_ITEM
    let opts: MenuRadioItemOptions = {}
    let core = createItemCore(handle, hostType, menu, 'radio-item', (event, node) => {
      if (!state.group?.setValue(state.value, event)) return
      finishActivation(menu, node, event, {
        kind: 'radio-item',
        label: normalizeText(opts.label ?? node.textContent),
        value: state.value,
        checked: true,
        closeOnClick: opts.closeOnClick ?? false,
      })
    })
    return (options, props) => {
      ;[options, props] = splitOptions(options, props)
      opts = options ?? {}
      let checked = state.checked
      return [
        attrs({
          'aria-checked': checked ? 'true' : 'false',
          'data-checked': checked ? '' : undefined,
          'data-unchecked': checked ? undefined : '',
        }),
        core.render({ role: 'menuitemradio', disabled: state.disabled, label: opts.label }),
      ]
    }
  })

export const radioItemIndicator: MixinFactory<
  HTMLElement,
  [options?: MenuIndicatorOptions],
  ElementProps
> = createMixin<HTMLElement, [options?: MenuIndicatorOptions], ElementProps>((handle) => {
  let state =
    (handle.context.get(RadioItemProvider) as RadioItemContextValue | undefined) ?? NO_RADIO_ITEM
  let render = createIndicator(handle, getMenu(handle), () => state)
  return (options, props) => {
    ;[options] = splitOptions(options, props)
    return render(options)
  }
})

// Groups ---------------------------------------------------------------------------------------

const groupLabels = new WeakSet<Element>()

function labelGroup(node: HTMLElement, props: ElementProps) {
  if (props['aria-labelledby'] !== undefined || props['aria-label'] !== undefined) return
  for (let candidate of node.querySelectorAll('[id]')) {
    if (!groupLabels.has(candidate)) continue
    if (candidate.parentElement?.closest('[role="group"]') !== node) continue
    if (node.getAttribute('aria-labelledby') !== candidate.id) {
      node.setAttribute('aria-labelledby', candidate.id)
    }
    return
  }
}

function createGroupMixin(radio: boolean) {
  return createMixin<HTMLElement, [], ElementProps>((handle) => {
    let group = radio ? (handle.context.get(RadioGroupProvider) as RadioGroupContextValue) : null
    let menu = handle.context.get(MenuProvider) as MenuContextValue | undefined
    let node: HTMLElement | null = null
    handle.addEventListener('insert', (event) => {
      node = event.node
    })
    return (props) => {
      handle.queueTask((node) => labelGroup(node, props))
      return attrs({
        role: 'group',
        'data-disabled': group?.disabled ? '' : undefined,
        // Base UI keeps filtered-out groups mounted with `hidden`.
        hidden: menu?._filterHidden(node) ? true : undefined,
      })
    }
  })
}

/** Groups related items: `role="group"`, labelled by a `groupLabel()` inside it. */
export const group: MixinFactory<HTMLElement, [], ElementProps> = createGroupMixin(false)

/** The element of a `RadioGroupContext`: `role="group"`, `data-disabled`, labelling. */
export const radioGroup: MixinFactory<HTMLElement, [], ElementProps> = createGroupMixin(true)

/** Labels the enclosing `group()` / `radioGroup()` (`aria-labelledby`). */
export const groupLabel: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  handle.addEventListener('insert', (event) => groupLabels.add(event.node))
  return (props) => attrs({ id: typeof props.id === 'string' ? props.id : handle.id })
})

/** Base UI's `Menu.Separator` is the generic separator. */
export const separator = separatorMixin

// Submenu trigger --------------------------------------------------------------------------------

export const submenuTrigger: MixinFactory<
  HTMLElement,
  [options?: SubmenuTriggerOptions],
  ElementProps
> = createMixin<HTMLElement, [options?: SubmenuTriggerOptions], ElementProps>(
  (handle, hostType) => {
    let sub = getMenu(handle)
    let parent = sub.parent
    let store = sub.store
    let entry: PopupTriggerEntry = store._registerTrigger(handle.signal)
    let node: HTMLElement | null = null
    let disabled = false
    let label: string | undefined
    let opts: SubmenuTriggerOptions = {}
    let armed = false
    let itemEntry: ItemEntry = {
      kind: 'submenu-trigger',
      disabled: () => disabled,
      label: () => normalizeText(label ?? node?.textContent),
      submenu: sub,
    }

    handle.addEventListener('insert', (event) => {
      node = event.node
      entry.node = node
      parent?._registerItem(node, itemEntry)
    })
    handle.addEventListener('remove', () => {
      if (node) parent?._unregisterItem(node)
      entry.node = null
      node = null
    })

    function hoverOptions() {
      return { delay: opts.delay ?? 100, closeDelay: opts.closeDelay ?? 0 }
    }

    function press(event: MouseEvent) {
      if (disabled || !node) return
      let keyboard = event.detail === 0
      if (!keyboard) parent?._highlight(node, { focus: true, reason: 'pointer', event })
      if (store.open) {
        if (store.openReason === 'trigger-hover') store._setOpenReason('trigger-press')
        if (keyboard) sub._focusEdge('first')
        return
      }
      store.hover.cancel()
      store._setInteractionType(keyboard ? 'keyboard' : 'mouse')
      sub._setPendingFocus(keyboard ? 'first' : 'none')
      store.setOpen(true, { reason: 'trigger-press', event, trigger: node })
    }

    return (options, props) => {
      ;[options, props] = splitOptions(options, props)
      opts = options ?? {}
      disabled = (opts.disabled ?? false) || sub.disabled
      label = opts.label
      let id = typeof props.id === 'string' ? props.id : handle.id
      sub._setTriggerId(entry, id)
      let open = store.open
      let highlighted = node !== null && parent?.highlighted === node
      let hover = opts.openOnHover ?? true
      return [
        attrs({
          id,
          role: 'menuitem',
          type: hostType === 'button' ? 'button' : undefined,
          tabIndex: -1,
          'aria-haspopup': 'menu',
          'aria-expanded': open ? 'true' : 'false',
          'aria-controls': store.popupId,
          'aria-disabled': disabled ? 'true' : undefined,
          'data-disabled': disabled ? '' : undefined,
          'data-popup-open': open ? '' : undefined,
          'data-highlighted': highlighted ? '' : undefined,
          hidden: parent?._filterHidden(node) ? true : undefined,
        }),
        on<HTMLElement, 'click'>('click', press),
        on<HTMLElement, 'pointerenter'>('pointerenter', () => {
          armed = true
        }),
        on<HTMLElement, 'pointermove'>('pointermove', (event) => {
          parent?._pointerHighlight(node, event)
          if (!armed || !hover || disabled || !node || event.pointerType === 'touch') return
          // Only start the open delay once the pointer has really arrived (not while it crosses
          // this item on the way to a sibling's submenu).
          if (parent?.highlighted !== node) return
          armed = false
          store.hover.triggerEnter(event, node, hoverOptions())
        }),
        on<HTMLElement, 'pointerleave'>('pointerleave', (event) => {
          armed = false
          if (hover) store.hover.triggerLeave(event, hoverOptions())
          parent?._pointerLeave(node, event)
        }),
        on<HTMLElement, 'focus'>('focus', () => parent?._focusHighlight(node)),
      ]
    }
  },
)

// Context menu trigger ---------------------------------------------------------------------------

const LONG_PRESS_MS = 500
const LONG_PRESS_TOLERANCE = 10

/**
 * The area that opens a context menu: right click (`contextmenu`) opens at the pointer, a touch
 * long press opens at the touch point, and Shift+F10 / the ContextMenu key open at the area's
 * bottom-start corner. Renders `data-popup-open` / `data-pressed` while open.
 */
export const contextTrigger: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let menu = getMenu(handle)
  let store = menu.store
  let node: HTMLElement | null = null
  let pressTimer = 0
  let pressStart: { x: number; y: number } | null = null
  let lastKeyboardOpen = 0
  let longPressed = false

  handle.addEventListener('insert', (event) => {
    node = event.node
    menu._contextArea = node
  })
  handle.addEventListener('remove', () => {
    cancelPress()
    if (menu._contextArea === node) menu._contextArea = null
    node = null
  })

  function cancelPress() {
    clearTimeout(pressTimer)
    pressTimer = 0
    pressStart = null
  }

  function openAt(
    point: { x: number; y: number; width?: number; height?: number },
    event: Event,
    type: PopupInteractionType,
  ) {
    if (menu.disabled || !node) return
    let doc = node.ownerDocument
    let active = doc.activeElement as HTMLElement | null
    if (!store.popupNode?.contains(active)) {
      menu._contextFocus = active && active !== doc.body ? active : null
    }
    menu._contextAnchor = { ...point }
    store._setInteractionType(type)
    if (store.open) {
      // Right-clicking again repositions the open menu. The press focused the area, so move
      // focus back into the menu.
      menu._highlight(null)
      store.popupNode?.focus({ preventScroll: true })
      void store.update()
      return
    }
    menu._setPendingFocus(type === 'keyboard' ? 'first' : 'popup')
    store.setOpen(true, { reason: 'trigger-press', event })
  }

  return () => {
    let open = store.open
    return [
      attrs({
        'data-popup-open': open ? '' : undefined,
        'data-pressed': open ? '' : undefined,
      }),
      on<HTMLElement, 'contextmenu'>('contextmenu', (event) => {
        if (menu.disabled) return
        event.preventDefault()
        // Keyboard-initiated contextmenu events follow our own keydown handling.
        if (Date.now() - lastKeyboardOpen < 500) return
        cancelPress()
        let pointerType = (event as Partial<PointerEvent>).pointerType
        openAt(
          { x: event.clientX, y: event.clientY },
          event,
          pointerType === 'touch' ? 'touch' : 'mouse',
        )
      }),
      on<HTMLElement, 'keydown'>('keydown', (event) => {
        if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return
        if (menu.disabled || !node) return
        event.preventDefault()
        lastKeyboardOpen = Date.now()
        let rect = node.getBoundingClientRect()
        openAt({ x: rect.left, y: rect.bottom }, event, 'keyboard')
      }),
      on<HTMLElement, 'pointerdown'>('pointerdown', (event) => {
        cancelPress()
        longPressed = false
        if (event.pointerType !== 'touch' || menu.disabled) return
        pressStart = { x: event.clientX, y: event.clientY }
        let point = pressStart
        pressTimer = window.setTimeout(() => {
          pressTimer = 0
          pressStart = null
          longPressed = true
          openAt(point, event, 'touch')
        }, LONG_PRESS_MS)
      }),
      // Lifting the finger after a long press would fire compatibility mouse events and a click
      // (moving focus out of the menu, or pressing outside it); cancel them.
      on<HTMLElement, 'touchend'>('touchend', (event) => {
        if (!longPressed) return
        longPressed = false
        if (event.cancelable) event.preventDefault()
      }),
      on<HTMLElement, 'pointermove'>('pointermove', (event) => {
        if (!pressStart) return
        let dx = event.clientX - pressStart.x
        let dy = event.clientY - pressStart.y
        if (Math.hypot(dx, dy) > LONG_PRESS_TOLERANCE) cancelPress()
      }),
      on<HTMLElement, 'pointerup'>('pointerup', cancelPress),
      on<HTMLElement, 'pointercancel'>('pointercancel', cancelPress),
    ]
  }
})

// Filtering (Base UI 1.9 `Menu.Input` / `Clear` / `Empty` / `List`) -------------------------------

export interface MenuFilterClearOptions {
  /** Whether the button ignores presses. */
  disabled?: boolean
}

/**
 * The filter input of a menu inside a `FilterProvider`: `role="searchbox"`, `aria-controls`
 * (the list), `aria-activedescendant` (the highlighted item), `data-highlighted` while it shows
 * its focus ring (cleared when the keyboard highlights an item). Typing filters the items; the
 * arrow keys move the highlight while focus stays here, and Enter activates the highlighted item.
 */
export const filterInput: MixinFactory<HTMLInputElement, [], ElementProps> = createMixin<
  HTMLInputElement,
  [],
  ElementProps
>((handle) => {
  let menu = getMenu(handle as unknown as MixinHandle<HTMLElement>)
  let filter = menu.filter
  let focused = false

  handle.addEventListener('insert', (event) => menu._setFilterNode('input', event.node))
  handle.addEventListener('remove', () => {
    if (menu._filterInput) menu._setFilterNode('input', null)
  })

  function onInput(event: Event) {
    let input = event.currentTarget as HTMLInputElement
    let next = input.value
    if (!filter?.setValue(next, next === '' ? 'input-clear' : 'input-change', event)) {
      // Cancelled (or controlled and not updated): show the current query again.
      if (filter && input.value !== filter.value) input.value = filter.value
    }
  }

  return () => {
    let value = filter?.value ?? ''
    let highlighted = menu.highlighted
    let keyboardHighlight = highlighted !== null && menu._highlightSource === 'keyboard'
    let listId = menu.store.popupNode?.querySelector('[role="menu"]')?.id
    return [
      attrs({
        type: 'text',
        role: 'searchbox',
        autoComplete: 'off',
        spellCheck: 'false',
        'aria-controls': listId || undefined,
        'aria-activedescendant': highlighted?.id || undefined,
        'data-highlighted': focused && !keyboardHighlight ? '' : undefined,
      }),
      // The query is owned by the provider; keep the DOM value in sync with it.
      attrs({ value }),
      on<HTMLInputElement, 'input'>('input', onInput),
      on<HTMLInputElement, 'focus'>('focus', () => {
        focused = true
        void menu.update()
      }),
      on<HTMLInputElement, 'blur'>('blur', () => {
        focused = false
        void menu.update()
      }),
    ]
  }
})

/**
 * Clears the filter query (reason `'clear-press'`) and refocuses the input. `hidden` while the
 * query is empty, `tabIndex={-1}`, `aria-hidden`, `data-disabled`.
 */
export const filterClear: MixinFactory<
  HTMLElement,
  [options?: MenuFilterClearOptions],
  ElementProps
> = createMixin<HTMLElement, [options?: MenuFilterClearOptions], ElementProps>(
  (handle, hostType) => {
    let menu = getMenu(handle)
    let filter = menu.filter
    let disabled = false
    return (options, props) => {
      ;[options, props] = splitOptions(options, props)
      disabled = (options?.disabled ?? false) || menu.disabled
      let isButton = hostType === 'button'
      return [
        attrs({
          type: isButton ? 'button' : undefined,
          tabIndex: -1,
          'aria-hidden': 'true',
          disabled: isButton && disabled ? true : undefined,
          hidden: (filter?.value ?? '') === '' ? true : undefined,
          'data-disabled': disabled ? '' : undefined,
        }),
        // Keep focus in the input.
        on<HTMLElement, 'mousedown'>('mousedown', (event) => event.preventDefault()),
        on<HTMLElement, 'click'>('click', (event) => {
          if (disabled || !filter) return
          filter.setValue('', 'clear-press', event)
          menu._filterInput?.focus({ preventScroll: true })
        }),
      ]
    }
  },
)

/**
 * The live region for "no matching items": `role="status"`, `aria-live="polite"`,
 * `aria-atomic`, `data-empty` while the filter shows no items. It stays rendered so screen
 * readers announce the change; put the message in `EmptyText` inside it.
 */
export const filterEmpty: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let menu = getMenu(handle)
  let ready = false
  handle.addEventListener('insert', () => {
    // Items register as they mount (and never on the server), so decide after the first commit.
    ready = true
    handle.queueTask(() => void menu.update())
  })
  return () =>
    attrs({
      role: 'status',
      'aria-live': 'polite',
      'aria-atomic': 'true',
      'data-empty': ready && menu._visibleCount() === 0 ? '' : undefined,
    })
})

export interface MenuEmptyTextProps {
  /** Rendered only while the filter shows no items. */
  children?: RemixNode
}

/** Renders its children only while the filter shows no items (inside `empty()`). */
export function EmptyText(handle: Handle<MenuEmptyTextProps>): () => RemixNode {
  let menu = handle.context.get(MenuProvider) as MenuContextValue | undefined
  let ready = false
  handle.queueTask(() => {
    ready = true
    void handle.update()
  })
  return () => (ready && menu && menu._visibleCount() === 0 ? handle.props.children : null)
}

/**
 * Wraps the items so other content (the filter input) can share the popup. In a filterable menu
 * it is the `role="menu"` element (the popup is a dialog); otherwise it's a plain wrapper
 * (`role="presentation"`) and the popup keeps the menu role.
 */
export const list: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let menu = getMenu(handle)
  handle.addEventListener('insert', (event) => menu._setFilterNode('list', event.node))
  handle.addEventListener('remove', () => menu._setFilterNode('list', null))
  return (props) => {
    if (!menu.filter) return attrs({ role: 'presentation' })
    let id = typeof props.id === 'string' ? props.id : `${menu.store.popupId}-list`
    return attrs({
      id,
      role: 'menu',
      tabIndex: -1,
      'aria-orientation': menu.orientation === 'horizontal' ? 'horizontal' : undefined,
      'aria-labelledby': menu._labelId(),
    })
  }
})
