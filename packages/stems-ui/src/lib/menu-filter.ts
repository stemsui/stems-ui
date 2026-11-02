/**
 * The query state of a filterable menu (Base UI 1.9 `Menu.FilterProvider`). The provider wraps a
 * `menu.Context` or `menu.SubmenuContext`; the first menu created inside it claims it, so a
 * submenu nested in a filterable menu stays unfiltered unless it has its own provider. The menu
 * (lib/menu.tsx) reads the query to hide items, routes the input's keys, and resets the query
 * once it has closed.
 */

import { on } from '@remix-run/component'
import type { Dispatched, Handle, RemixNode } from '@remix-run/component'

import { containsText } from './text-filter.ts'

/** Why the query changed (Base UI's `FilterProvider.ChangeEventReason`). */
export type MenuFilterChangeReason = 'input-change' | 'input-clear' | 'clear-press' | 'popup-close'

export interface MenuFilterChangeDetails {
  readonly reason: MenuFilterChangeReason
  /** The DOM event behind the change, when there is one. */
  readonly event: Event | undefined
  /** Keeps the current query: the change is not applied and no event is dispatched. */
  cancel(): void
  readonly isCanceled: boolean
}

/** Matches an item's text against the trimmed, non-empty query. */
export type MenuFilterFunction = (text: string, query: string) => boolean

export interface MenuFilterProviderProps {
  children?: RemixNode
  /** The query (controlled). */
  value?: string
  /**
   * The initial query (uncontrolled).
   * @default ''
   */
  defaultValue?: string
  /**
   * Called before the query changes. It resets to `''` (reason `'popup-close'`) once the menu
   * has closed; call `details.cancel()` to keep it.
   */
  onValueChange?: (value: string, details: MenuFilterChangeDetails) => void
  /**
   * Highlight the first match automatically: `true` while the query isn't empty, `'always'`
   * even when it is.
   * @default false
   */
  autoHighlight?: boolean | 'always'
  /**
   * Replaces the matching. Receives each item's `label` (or text) and the trimmed query. The
   * default keeps items whose text contains the query, ignoring case and diacritics. Pass
   * `null` to filter the items yourself (none are hidden).
   */
  filter?: MenuFilterFunction | null
  /** The locale of the default matching. Defaults to the runtime locale. */
  locale?: Intl.LocalesArgument
}

/** Filter state shared with the menu that claimed the provider. */
export interface MenuFilterContextValue {
  /** The query as typed. */
  readonly value: string
  readonly autoHighlight: boolean | 'always'
  /** Whether items are being hidden: there's a trimmed query and a filter function. */
  readonly active: boolean
  /** Whether an item with this text matches the query (always `true` when not `active`). */
  matches(text: string): boolean
  /** Requests a query change; returns whether it was applied. */
  setValue(value: string, reason: MenuFilterChangeReason, event?: Event): boolean
  /** @internal The first menu inside the provider owns it. */
  _claim(owner: object): boolean
  /** @internal Re-renders the owning menu after an uncontrolled change. */
  _setUpdate(update: () => unknown): void
  /** @internal The input element, which receives the change event. */
  _setInput(node: HTMLElement | null): void
  readonly _input: HTMLElement | null
}

const MENU_FILTER_CHANGE_EVENT = 'stems:menu-filter-change' as const

declare global {
  interface HTMLElementEventMap {
    [MENU_FILTER_CHANGE_EVENT]: MenuFilterChangeEvent
  }
}

/** Bubbling event dispatched from the filter input when the query changes. */
export class MenuFilterChangeEvent extends Event {
  readonly value: string
  readonly reason: MenuFilterChangeReason

  constructor(value: string, reason: MenuFilterChangeReason) {
    super(MENU_FILTER_CHANGE_EVENT, { bubbles: true })
    this.value = value
    this.reason = reason
  }
}

/** Listens for the bubbling `stems:menu-filter-change` event. */
export function onMenuFilterChange<target extends HTMLElement>(
  handler: (
    event: Dispatched<MenuFilterChangeEvent, target>,
    signal: AbortSignal,
  ) => void | Promise<void>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof MENU_FILTER_CHANGE_EVENT>> {
  return on(MENU_FILTER_CHANGE_EVENT, handler, captureBoolean)
}

export function MenuFilterProvider(
  handle: Handle<MenuFilterProviderProps, MenuFilterContextValue>,
): () => RemixNode {
  let uncontrolled = handle.props.defaultValue ?? ''
  let owner: object | null = null
  let update: (() => unknown) | null = null
  let input: HTMLElement | null = null

  function value() {
    return handle.props.value ?? uncontrolled
  }

  function filterFunction(): MenuFilterFunction | null {
    let { filter, locale } = handle.props
    if (filter === null) return null
    return filter ?? ((text, query) => containsText(text, query, locale))
  }

  let context: MenuFilterContextValue = {
    get value() {
      return value()
    },
    get autoHighlight() {
      return handle.props.autoHighlight ?? false
    },
    get active() {
      return value().trim() !== '' && filterFunction() !== null
    },
    matches(text) {
      let query = value().trim()
      let filter = filterFunction()
      if (query === '' || !filter) return true
      return filter(text, query)
    },
    setValue(next, reason, event) {
      if (next === value()) return false
      let canceled = false
      let details: MenuFilterChangeDetails = {
        reason,
        event,
        cancel() {
          canceled = true
        },
        get isCanceled() {
          return canceled
        },
      }
      handle.props.onValueChange?.(next, details)
      if (canceled) return false
      if (handle.props.value === undefined) {
        uncontrolled = next
        void update?.()
      }
      input?.dispatchEvent(new MenuFilterChangeEvent(next, reason))
      return true
    },
    _claim(menu) {
      if (owner && owner !== menu) return false
      owner = menu
      return true
    },
    _setUpdate(next) {
      update = next
    },
    _setInput(node) {
      input = node
    },
    get _input() {
      return input
    },
  }

  handle.context.set(context)
  return () => handle.props.children
}

/**
 * The filter for the menu being created, if it is the first menu inside a `FilterProvider`.
 */
export function claimMenuFilter(
  handle: Handle<any, any>,
  owner: object,
): MenuFilterContextValue | undefined {
  let filter = handle.context.get(MenuFilterProvider) as MenuFilterContextValue | undefined
  return filter?._claim(owner) ? filter : undefined
}
