/**
 * State shared by `stems-ui/menubar` and `lib/menu.tsx`.
 *
 * `MenubarProvider` (exported as `menubar.Context`) owns the menubar options and the list of
 * menus inside it. Every `menu.Context` rendered inside it registers itself here (see
 * `getMenubar()` in `lib/menu.tsx`), and its trigger becomes a menubar item: `role="menuitem"`,
 * one roving tab stop across the triggers, arrow keys between them, and switching between menus
 * by hovering or with the arrow keys while one is open.
 *
 * Modality is owned by the menubar rather than by each menu: while any of its menus is open and
 * `modal` is `true`, page scroll is locked and everything outside the menubar (and the open
 * popups) is inert. The menubar itself stays interactive so other triggers can be hovered and
 * pressed.
 */

import type { Handle, MixinHandle, RemixNode } from '@remix-run/component'

import { getDirection } from './direction.ts'
import { inertOthers } from './focus-trap.ts'
import type { MenuContextValue, MenuFocusStrategy } from './menu.tsx'
import type { PopupOpenChangeReason } from './popup.ts'
import { getRovingMove, getRovingTargetIndex, type RovingMove } from './roving-focus.ts'
import { lockScroll } from './scroll-lock.ts'

export type MenubarOrientation = 'horizontal' | 'vertical'

/** Props of `menubar.Context` (Base UI `Menubar`). */
export interface MenubarContextProps {
  /**
   * Whether the arrow keys move between the triggers horizontally (Left / Right, mirrored in RTL)
   * or vertically (Up / Down). Menus of a vertical menubar open to the inline-end side.
   * @default 'horizontal'
   */
  orientation?: MenubarOrientation
  /**
   * Whether arrow-key focus wraps from the last trigger to the first (and back).
   * @default true
   */
  loopFocus?: boolean
  /**
   * While a menu is open: lock page scroll and make content outside the menubar inert. Replaces
   * the `modal` prop of the menus inside it.
   * @default true
   */
  modal?: boolean
  /**
   * Whether every menu in the menubar is disabled.
   * @default false
   */
  disabled?: boolean
  children?: RemixNode
}

/** State provided by `menubar.Context`, readable with `handle.context.get(menubar.Context)`. */
export interface MenubarContextValue {
  readonly orientation: MenubarOrientation
  readonly loopFocus: boolean
  readonly modal: boolean
  readonly disabled: boolean
  /** Whether any menu of the menubar is open (Base UI `hasSubmenuOpen`). */
  readonly hasSubmenuOpen: boolean
  /** @internal */
  _register(menu: MenuContextValue, signal: AbortSignal): void
  /** @internal Whether this menu's trigger is the menubar's tab stop. */
  _isTabbable(menu: MenuContextValue): boolean
  /** @internal Makes a focused trigger the tab stop. */
  _setActive(menu: MenuContextValue): void
  /** @internal Called when a menu opened. */
  _menuOpened(menu: MenuContextValue): void
  /** @internal Closes the other open menus before `menu` opens. */
  _closeOthers(menu: MenuContextValue, event: Event | undefined): void
  /** @internal Whether a menu other than `menu` is open (a switch is in progress). */
  _otherOpen(menu: MenuContextValue): boolean
  /** @internal Keyboard handling on a trigger. Returns whether the key was handled. */
  _onTriggerKeyDown(menu: MenuContextValue, event: KeyboardEvent): boolean
  /** @internal Left / Right inside an open popup tree. Returns whether the key was handled. */
  _onPopupArrow(menu: MenuContextValue, step: -1 | 1, event: KeyboardEvent): boolean
  /** @internal Pointer entering a trigger: switches menus while one is open. */
  _onTriggerHover(menu: MenuContextValue, event: PointerEvent): void
  /** @internal Records where the pointer is (pointer events inside the menubar). */
  _notePointer(event: PointerEvent): void
  /** @internal Called from each menu's render to sync `data-has-submenu-open` and modality. */
  _sync(): void
  /** @internal */
  _setRoot(node: HTMLElement | null): void
}

function MenubarProvider(
  handle: Handle<MenubarContextProps, MenubarContextValue>,
): () => RemixNode {
  let menus = new Set<MenuContextValue>()
  let active: MenuContextValue | undefined
  let root: HTMLElement | null = null
  let renderedOpen = false
  let releaseModal: (() => void) | null = null
  // The last pointer position seen inside the menubar (its triggers and popups).
  let lastPoint: string | null = null

  function triggerOf(menu: MenuContextValue): HTMLElement | null {
    return menu.store.activeTrigger
  }

  /** Menus in document order of their triggers once mounted (registration order before). */
  function list(): MenuContextValue[] {
    let result = [...menus]
    if (result.every((menu) => triggerOf(menu))) {
      result.sort((a, b) => {
        let position = triggerOf(a)!.compareDocumentPosition(triggerOf(b)!)
        return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
      })
    }
    return result
  }

  function isEnabled(menu: MenuContextValue) {
    if (context.disabled || menu.disabled) return false
    let trigger = triggerOf(menu)
    return !trigger?.matches(':disabled')
  }

  function anyOpen() {
    for (let menu of menus) if (menu.store.open) return true
    return false
  }

  /** Moves focus to `target`'s trigger and, when a menu was open, opens `target`'s menu. */
  function moveTo(
    target: MenuContextValue,
    event: Event,
    open: { focus: MenuFocusStrategy; reason: PopupOpenChangeReason } | null,
  ) {
    let trigger = triggerOf(target)
    if (!trigger) return
    if (!open) {
      trigger.focus()
      return
    }
    let store = target.store
    store.hover.cancel()
    store._setInteractionType(open.reason === 'trigger-hover' ? 'mouse' : 'keyboard')
    target._setPendingFocus(open.focus)
    // Open first so the closing menu doesn't send focus back to its own trigger.
    if (!store.open) store.setOpen(true, { reason: open.reason, event, trigger })
    if (open.focus === 'none') trigger.focus({ preventScroll: true })
  }

  function navigate(menu: MenuContextValue, move: RovingMove, event: Event): boolean {
    let items = list()
    let index = items.indexOf(menu)
    let target = getRovingTargetIndex(items.length, index, move, {
      loop: context.loopFocus,
      isEnabled: (i) => isEnabled(items[i]!),
    })
    if (target === -1 || target === index) return false
    let next = items[target]!
    let open = anyOpen()
    moveTo(next, event, open ? { focus: 'none', reason: 'trigger-focus' } : null)
    return true
  }

  function syncModal(open: boolean) {
    if (open && context.modal && !releaseModal && root?.isConnected) {
      let doc = root.ownerDocument
      let popups = [...menus].map((menu) => menu.store.popupNode)
      let unlock = lockScroll(doc)
      let restore = inertOthers([root, ...popups])
      releaseModal = () => {
        restore()
        unlock()
      }
    } else if (!open && releaseModal) {
      releaseModal()
      releaseModal = null
    }
  }

  let context: MenubarContextValue = {
    get orientation() {
      return handle.props.orientation ?? 'horizontal'
    },
    get loopFocus() {
      return handle.props.loopFocus ?? true
    },
    get modal() {
      return handle.props.modal ?? true
    },
    get disabled() {
      return handle.props.disabled === true
    },
    get hasSubmenuOpen() {
      return anyOpen()
    },
    _register(menu, signal) {
      menus.add(menu)
      signal.addEventListener('abort', () => {
        menus.delete(menu)
        if (active === menu) active = undefined
      })
    },
    _isTabbable(menu) {
      if (active && menus.has(active) && isEnabled(active)) return active === menu
      return list().find(isEnabled) === menu
    },
    _setActive(menu) {
      if (active === menu) return
      active = menu
      void handle.update()
    },
    _menuOpened(menu) {
      context._setActive(menu)
    },
    _closeOthers(menu, event) {
      for (let other of menus) {
        if (other !== menu && other.store.open) {
          // Base UI reports 'sibling-open'; lib/popup.ts has no such reason, so 'none' is used.
          other.store.setOpen(false, { reason: 'none', event })
        }
      }
    },
    _otherOpen(menu) {
      for (let other of menus) if (other !== menu && other.store.open) return true
      return false
    },
    _onTriggerKeyDown(menu, event) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return false
      let trigger = triggerOf(menu)
      let dir = getDirection(trigger ?? root)
      let vertical = context.orientation === 'vertical'
      let move = getRovingMove(event.key, context.orientation, dir)
      if (move) {
        event.preventDefault()
        navigate(menu, move, event)
        return true
      }
      // In a vertical menubar the menus open to the inline-end side, so that arrow opens them.
      let inlineEnd = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
      if (vertical && event.key === inlineEnd && isEnabled(menu)) {
        event.preventDefault()
        if (menu.store.open) menu._focusEdge('first')
        else moveTo(menu, event, { focus: 'first', reason: 'trigger-press' })
        return true
      }
      return false
    },
    _onPopupArrow(menu, step, event) {
      if (context.orientation !== 'horizontal') {
        // A vertical menubar's menus open sideways: the arrow toward the menubar closes the menu
        // (focus returns to its trigger).
        if (step === -1 && menu.parent === undefined) {
          event.preventDefault()
          menu.store._setInteractionType('keyboard')
          menu.store.setOpen(false, { reason: 'list-navigation', event })
          return true
        }
        return false
      }
      event.preventDefault()
      let items = list()
      let index = items.indexOf(menu)
      let target = getRovingTargetIndex(items.length, index, step === 1 ? 'next' : 'previous', {
        loop: context.loopFocus,
        isEnabled: (i) => isEnabled(items[i]!),
      })
      if (target === -1 || target === index) return true
      moveTo(items[target]!, event, { focus: 'first', reason: 'list-navigation' })
      return true
    },
    _onTriggerHover(menu, event) {
      // Browsers dispatch boundary events (`pointerenter`) when the layout changes under a
      // resting pointer, e.g. when a keyboard switch closes the menu the pointer opened. Only a
      // pointer that really moved switches menus.
      let point = `${event.clientX},${event.clientY}`
      let moved = point !== lastPoint
      lastPoint = point
      if (!moved) return
      if (event.pointerType === 'touch' || menu.store.open || !isEnabled(menu)) return
      if (!context._otherOpen(menu)) return
      moveTo(menu, event, { focus: 'none', reason: 'trigger-hover' })
    },
    _notePointer(event) {
      lastPoint = `${event.clientX},${event.clientY}`
    },
    _sync() {
      let open = anyOpen()
      if (open === renderedOpen) return
      renderedOpen = open
      if (root) root.toggleAttribute('data-has-submenu-open', open)
      syncModal(open)
    },
    _setRoot(node) {
      root = node
      // A menu that was open before the root mounted (`defaultOpen`) still needs the attribute
      // (the root renders before its menus register) and modality.
      if (node && renderedOpen) {
        node.toggleAttribute('data-has-submenu-open', true)
        syncModal(true)
      }
    },
  }

  handle.context.set(context)
  handle.signal.addEventListener('abort', () => syncModal(false))

  return () => handle.props.children
}

/** @internal Reads the enclosing menubar, if any. */
export function getMenubar(
  handle: Handle<any, any> | MixinHandle<any, any>,
): MenubarContextValue | undefined {
  return handle.context.get(MenubarProvider) as MenubarContextValue | undefined
}

/** Provider for a menubar (Base UI `Menubar` props). */
export const MenubarContext: (
  handle: Handle<MenubarContextProps, MenubarContextValue>,
) => () => RemixNode = MenubarProvider
