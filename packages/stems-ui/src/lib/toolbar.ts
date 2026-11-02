/**
 * State shared by `stems-ui/toolbar` and the widgets that can sit inside a toolbar.
 *
 * `ToolbarProvider` (exported as `toolbar.Context`) owns the options and the roving tab stop.
 * Items register themselves (`toolbar.item()`, and the `button()` / `link()` / `input()` parts
 * built on it). Keyboard navigation is handled once on the `root()` element, in the bubble phase,
 * and only for keydown events whose target is a registered item that no other handler already
 * used (`defaultPrevented`). That lets a menu or select trigger in the toolbar keep its own keys
 * (ArrowDown opens it) while Left / Right move through the toolbar.
 *
 * `toggle-button-group` reads `getToolbar()`: inside a toolbar it hands its roving focus over to
 * the toolbar so its buttons become ordinary toolbar items.
 */

import type { Handle, MixinHandle, RemixNode } from '@remix-run/component'

import { getDirection } from './direction.ts'
import { getRovingMove, getRovingTargetIndex } from './roving-focus.ts'

export type ToolbarOrientation = 'horizontal' | 'vertical'

/** Props of `toolbar.Context` (Base UI `Toolbar.Root`). */
export interface ToolbarContextProps {
  /**
   * Whether the arrow keys move horizontally (Left / Right, mirrored in RTL) or vertically
   * (Up / Down).
   * @default 'horizontal'
   */
  orientation?: ToolbarOrientation
  /**
   * Whether arrow-key focus wraps from the last item to the first (and back).
   * @default true
   */
  loopFocus?: boolean
  /**
   * Whether every item in the toolbar is disabled. Disabled items stay focusable unless their
   * `focusableWhenDisabled` option is `false`.
   * @default false
   */
  disabled?: boolean
  children?: RemixNode
}

/** State provided by `toolbar.Context`, readable with `handle.context.get(toolbar.Context)`. */
export interface ToolbarContextValue {
  readonly orientation: ToolbarOrientation
  readonly loopFocus: boolean
  readonly disabled: boolean
  /** @internal */
  _register(entry: ToolbarItemEntry, signal: AbortSignal): void
  /** @internal Whether this item is the toolbar's single tab stop. */
  _isTabbable(entry: ToolbarItemEntry): boolean
  /** @internal Makes a focused item the tab stop. */
  _setActive(entry: ToolbarItemEntry): void
  /** @internal Delegated keydown handler of the root element. */
  _onKeyDown(event: KeyboardEvent): void
}

/** @internal A registered toolbar item. */
export interface ToolbarItemEntry {
  node: HTMLElement | null
  /** Whether the item is disabled (toolbar, group, or its own option). */
  disabled: boolean
  /** Whether the item stays in the arrow-key order while disabled. */
  focusableWhenDisabled: boolean
}

/** Props of `toolbar.GroupContext` (Base UI `Toolbar.Group`'s `disabled`). */
export interface ToolbarGroupContextProps {
  /**
   * Whether every item in the group is disabled.
   * @default false
   */
  disabled?: boolean
  children?: RemixNode
}

export interface ToolbarGroupContextValue {
  /** The group's `disabled` prop, or the toolbar's. */
  readonly disabled: boolean
}

/** Text fields whose caret the Left / Right (or Up / Down) keys move. */
export function isTextInput(node: Element): node is HTMLInputElement | HTMLTextAreaElement {
  return node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement
}

function isNavigable(entry: ToolbarItemEntry) {
  if (entry.disabled && !entry.focusableWhenDisabled) return false
  let node = entry.node
  if (!node) return true
  if (!node.isConnected || node.hidden) return false
  // A natively disabled element (e.g. a `disabled` toggle button) can't take focus.
  return !node.matches(':disabled')
}

function ToolbarProvider(
  handle: Handle<ToolbarContextProps, ToolbarContextValue>,
): () => RemixNode {
  let items = new Set<ToolbarItemEntry>()
  let active: ToolbarItemEntry | undefined

  /** Items in document order once mounted (registration order before that). */
  function list(): ToolbarItemEntry[] {
    let result = [...items]
    if (result.every((item) => item.node?.isConnected)) {
      result.sort((a, b) => {
        let position = a.node!.compareDocumentPosition(b.node!)
        return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
      })
    }
    return result
  }

  let context: ToolbarContextValue = {
    get orientation() {
      return handle.props.orientation ?? 'horizontal'
    },
    get loopFocus() {
      return handle.props.loopFocus ?? true
    },
    get disabled() {
      return handle.props.disabled === true
    },
    _register(entry, signal) {
      items.add(entry)
      signal.addEventListener('abort', () => {
        items.delete(entry)
        if (active === entry) active = undefined
      })
    },
    _isTabbable(entry) {
      if (active && items.has(active) && isNavigable(active)) return active === entry
      return list().find(isNavigable) === entry
    },
    _setActive(entry) {
      if (active === entry) return
      active = entry
      void handle.update()
    },
    _onKeyDown(event) {
      if (event.defaultPrevented || event.isComposing) return
      if (event.altKey || event.ctrlKey || event.metaKey) return
      let target = event.target
      if (!(target instanceof HTMLElement)) return
      let entries = list()
      let entry = entries.find((item) => item.node === target)
      if (!entry) return

      let move = getRovingMove(event.key, context.orientation, getDirection(target))
      if (!move) return

      // Base UI: in a text field the arrows move the caret, and only leave the field from its
      // edges. Shift (selecting) and an existing selection keep the native behavior.
      if (isTextInput(target) && target.getAttribute('aria-disabled') !== 'true') {
        if (move === 'first' || move === 'last') return
        let start = target.selectionStart
        if (start === null || event.shiftKey || start !== target.selectionEnd) return
        if (move === 'next' && start < target.value.length) return
        if (move === 'previous' && start > 0) return
      }

      event.preventDefault()
      let index = entries.indexOf(entry)
      let next = getRovingTargetIndex(entries.length, index, move, {
        loop: context.loopFocus,
        isEnabled: (i) => isNavigable(entries[i]!),
      })
      if (next === -1 || next === index) return
      let node = entries[next]!.node
      if (!node) return
      node.focus()
      // Like Base UI, a text field reached with the arrows has its text selected.
      if (isTextInput(node)) node.select()
    },
  }

  handle.context.set(context)
  return () => handle.props.children
}

function ToolbarGroupProvider(
  handle: Handle<ToolbarGroupContextProps, ToolbarGroupContextValue>,
): () => RemixNode {
  let toolbar = getToolbar(handle)
  handle.context.set({
    get disabled() {
      return handle.props.disabled === true || toolbar?.disabled === true
    },
  })
  return () => handle.props.children
}

/** @internal Reads the enclosing toolbar, if any. */
export function getToolbar(
  handle: Handle<any, any> | MixinHandle<any, any>,
): ToolbarContextValue | undefined {
  return handle.context.get(ToolbarProvider) as ToolbarContextValue | undefined
}

/** @internal Reads the enclosing toolbar group, if any. */
export function getToolbarGroup(
  handle: Handle<any, any> | MixinHandle<any, any>,
): ToolbarGroupContextValue | undefined {
  return handle.context.get(ToolbarGroupProvider) as ToolbarGroupContextValue | undefined
}

export const ToolbarContext: (
  handle: Handle<ToolbarContextProps, ToolbarContextValue>,
) => () => RemixNode = ToolbarProvider

export const ToolbarGroupContext: (
  handle: Handle<ToolbarGroupContextProps, ToolbarGroupContextValue>,
) => () => RemixNode = ToolbarGroupProvider
