// Adapted from @remix-run/ui 0.13.0 (packages/ui/src/listbox.ts).
// https://github.com/remix-run/remix - Copyright (c) 2025 Shopify Inc. MIT License.

/**
 * Shared listbox machinery (WAI-ARIA APG listbox) for select, combobox, and autocomplete.
 *
 * Like `lib/popup.ts`, a widget composes these pieces:
 *
 * - `createListboxStore()` in its Context provider: the selected value (single or multiple,
 *   controlled or uncontrolled, with Base UI change details), option registration, the
 *   highlighted option, keyboard navigation, typeahead, and scrolling.
 * - `createListboxList()` in its list mixin: `role="listbox"`, `id`, `aria-multiselectable`,
 *   and (virtual focus only) `aria-activedescendant`.
 * - `createListboxItem()` in its item mixin: `role="option"`, `id`, `aria-selected`,
 *   `data-selected` / `data-highlighted` / `data-disabled`, pointer highlight, and press to
 *   select.
 * - `createListboxGroup()` / `createListboxGroupLabel()` for groups.
 *
 * Highlight is not selection: the highlighted option is the one keyboard focus (or the pointer)
 * is on; the selected option(s) are the value. Two focus models are supported:
 *
 * - `'roving'` (select): options get `tabIndex={-1}` and real DOM focus follows the highlight.
 *   Put the store's `onKeyDown` on the element that contains the options (the popup).
 * - `'virtual'` (combobox): DOM focus stays in another element (the input). Options are never
 *   focused; the widget renders `aria-activedescendant={store.highlightedId}` on the focused
 *   element and forwards its keydown events to `store.onKeyDown(event, { typeahead: false })`.
 *   Items prevent `mousedown` so pressing an option doesn't blur the input.
 *
 * Every helper takes the mixin `handle` during setup and returns an object whose `render()` is
 * called from the mixin's render function.
 */

import { attrs, on } from '@remix-run/component'
import type { ElementProps, MixInput, MixinHandle } from '@remix-run/component'

import { getRovingTargetIndex } from './roving-focus.ts'
import type { RovingMove } from './roving-focus.ts'
import { matchNextItemBySearchText } from './typeahead.ts'

// ---------------------------------------------------------------------------------------------
// Types

export type ListboxFocusMode = 'roving' | 'virtual'

/** Why the highlight moved. */
export type ListboxHighlightReason = 'keyboard' | 'pointer' | 'none'

/** Base UI's value change reasons used by listbox widgets. */
export type ListboxValueChangeReason = 'item-press' | 'list-navigation' | 'none'

/** The second argument of `onValueChange`, like Base UI's `eventDetails`. */
export interface ListboxValueChangeDetails {
  readonly reason: ListboxValueChangeReason
  readonly event: Event | undefined
  /** Call from `onValueChange` to keep the current value. */
  cancel(): void
  readonly isCanceled: boolean
}

export interface ListboxHighlightDetails {
  readonly reason: ListboxHighlightReason
  readonly event: Event | undefined
  /** The highlighted option element (`undefined` when the highlight is cleared). */
  readonly node: HTMLElement | undefined
}

/** Root props shared by listbox widgets (spread them into the Context provider's props). */
export interface ListboxStateProps {
  /**
   * The selected value (controlled). A single value (or `null`), or an array when `multiple`.
   */
  value?: unknown
  /** The initially selected value (uncontrolled). */
  defaultValue?: unknown
  /** Called with the next value and the change details. Call `details.cancel()` to veto. */
  onValueChange?: (value: any, details: ListboxValueChangeDetails) => void
  /**
   * Whether more than one option can be selected. The value is then an array.
   * @default false
   */
  multiple?: boolean
  /** Ignore user interaction. */
  disabled?: boolean
  /** The value can't be changed by the user. */
  readOnly?: boolean
  /**
   * Loop keyboard navigation from the last option back to the first (and back).
   * @default true
   */
  loopFocus?: boolean
  /**
   * Highlight options as the pointer moves over them.
   * @default true
   */
  highlightItemOnHover?: boolean
  /**
   * Compares an option's value with a selected value.
   * @default Object.is
   */
  isItemEqualToValue?: (itemValue: any, value: any) => boolean
  /** Called when the highlighted option changes (`undefined` when nothing is highlighted). */
  onItemHighlighted?: (value: unknown, details: ListboxHighlightDetails) => void
}

/** A registered option. */
export interface ListboxItemEntry {
  readonly node: HTMLElement
  readonly id: string
  readonly value: unknown
  disabled(): boolean
  /** The option's text label (its `label` option, its item text, or its text content). */
  label(): string
}

export interface ListboxStoreOptions {
  /** Id prefix, usually the provider's `handle.id`. */
  id: string
  /** Reads the provider's current props. */
  getProps(): ListboxStateProps
  /** Re-renders the provider (and so every part). */
  update(): Promise<unknown>
  /** `'roving'` moves DOM focus to options; `'virtual'` uses `aria-activedescendant`. */
  focusMode: ListboxFocusMode
  /** The element containing the options. Defaults to the registered list element. */
  getContainer?(): HTMLElement | null
  /** Builds the bubbling change event dispatched when the value changes. */
  createChangeEvent?(value: unknown, details: ListboxValueChangeDetails): Event | undefined
  /** Where the change event is dispatched from. Defaults to the list (or container) element. */
  getEventTarget?(): HTMLElement | null
}

export interface ListboxSelectRequest {
  reason?: ListboxValueChangeReason
  event?: Event
}

export interface ListboxHighlightOptions {
  reason?: ListboxHighlightReason
  event?: Event
  /** Move DOM focus to the option (`'roving'` only). Defaults to `true` in roving mode. */
  focus?: boolean
  /** Scroll the option into view. @default true */
  scroll?: boolean
}

export interface ListboxKeyDownOptions {
  /**
   * Handle printable characters as typeahead (highlight the next option whose label starts
   * with the typed text), and Space as activation. Combobox passes `false`: the input owns
   * typing, including Space; only Enter activates.
   * @default true
   */
  typeahead?: boolean
  /** Called for Enter / Space on the highlighted option. Defaults to `store.selectItem()`. */
  onActivate?(entry: ListboxItemEntry, event: KeyboardEvent): void
  /**
   * Which arrow keys move the highlight.
   * @default 'vertical'
   */
  orientation?: 'vertical' | 'horizontal'
}

export interface ListboxStore {
  readonly focusMode: ListboxFocusMode
  readonly multiple: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
  /** The value: a single value (`null` when empty) or an array when `multiple`. */
  readonly value: unknown
  /** The selected values as an array (empty when nothing is selected). */
  readonly selectedValues: readonly unknown[]
  /** Whether at least one value is selected. */
  readonly hasValue: boolean
  /** The highlighted option element. */
  readonly highlighted: HTMLElement | null
  readonly highlightedEntry: ListboxItemEntry | undefined
  /** Why the current highlight was set. */
  readonly highlightReason: ListboxHighlightReason
  /** The highlighted option's id, for `aria-activedescendant`. */
  readonly highlightedId: string | undefined
  /** The list element's id (the host `id` if one is set; `${id}-list` by default). */
  readonly listId: string
  readonly listNode: HTMLElement | null
  /** Whether a list part has been registered. */
  readonly hasList: boolean
  /** Whether `value` is one of the selected values. */
  isSelected(value: unknown): boolean
  isEqual(itemValue: unknown, value: unknown): boolean
  /** Registered, visible (not `hidden`) options in DOM order. */
  items(options?: { enabledOnly?: boolean }): ListboxItemEntry[]
  /** The first registered option with `value`. */
  findItem(value: unknown): ListboxItemEntry | undefined
  /** The first selected option in DOM order. */
  selectedItem(): ListboxItemEntry | undefined
  /** The registered label for `value`, if an option with that value is registered. */
  labelOf(value: unknown): string | undefined
  /**
   * Requests a value change. Calls `onValueChange` (which may cancel), then updates
   * uncontrolled state and dispatches the change event. Returns whether it was accepted.
   */
  setValue(next: unknown, request?: ListboxSelectRequest): boolean
  /** Selects `value` (single) or toggles it (multiple). Returns whether the value changed. */
  selectItem(value: unknown, request?: ListboxSelectRequest): boolean
  /** Moves the highlight (and focus, in roving mode). `null` clears it. */
  highlight(node: HTMLElement | null, options?: ListboxHighlightOptions): void
  /** Moves the highlight by a roving move (`first`, `last`, `next`, `previous`). */
  move(move: RovingMove, event?: Event): ListboxItemEntry | undefined
  /** Feeds one typed character to typeahead and highlights the match. */
  typeahead(char: string, event?: Event): ListboxItemEntry | undefined
  /** Whether a typeahead search is in progress (Space then belongs to the search). */
  readonly typing: boolean
  /** Finds the next enabled option matching `text`, searching after `from`. */
  matchText(text: string, from?: ListboxItemEntry | null): ListboxItemEntry | undefined
  /**
   * Handles listbox keys: ArrowDown / ArrowUp, Home / End, Enter / Space, and typeahead.
   * Returns whether the event was handled (it is then `preventDefault()`ed).
   */
  onKeyDown(event: KeyboardEvent, options?: ListboxKeyDownOptions): boolean
  /** Scrolls the highlighted option into view. */
  scrollToHighlighted(): void
  /** Clears the highlight and typeahead without re-rendering (call while closing). */
  reset(): void
  /** Re-renders the provider. */
  update(): Promise<unknown>
  /** @internal */
  _registerItem(entry: ListboxItemEntry): void
  /** @internal */
  _unregisterItem(node: HTMLElement): void
  /** @internal */
  _setList(node: HTMLElement | null, id?: string): void
  /** @internal */
  _focusHighlight(node: HTMLElement): void
  /** @internal */
  _pointerMove(node: HTMLElement, event: PointerEvent): void
  /** @internal */
  _pointerLeave(node: HTMLElement, event: PointerEvent): void
}

const EMPTY: readonly unknown[] = Object.freeze([])
const TYPEAHEAD_TIMEOUT = 750

function changeDetails(
  reason: ListboxValueChangeReason,
  event: Event | undefined,
): ListboxValueChangeDetails {
  let canceled = false
  return {
    reason,
    event,
    cancel() {
      canceled = true
    },
    get isCanceled() {
      return canceled
    },
  }
}

export function normalizeText(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim()
}

// ---------------------------------------------------------------------------------------------
// Store

export function createListboxStore(options: ListboxStoreOptions): ListboxStore {
  let { getProps, update, focusMode } = options
  let initial = getProps()
  let uncontrolled: unknown = normalizeValue(initial.defaultValue, initial.multiple ?? false)
  let entries = new Map<HTMLElement, ListboxItemEntry>()
  let highlighted: HTMLElement | null = null
  let highlightReason: ListboxHighlightReason = 'none'
  let listNode: HTMLElement | null = null
  let listId = `${options.id}-list`
  let hasList = false
  let typed = ''
  let typedTimer = 0
  let updateQueued = false

  function multiple() {
    return getProps().multiple ?? false
  }

  function currentValue(): unknown {
    let props = getProps()
    let value = props.value !== undefined ? props.value : uncontrolled
    return normalizeValue(value, multiple())
  }

  function isEqual(itemValue: unknown, value: unknown) {
    let compare = getProps().isItemEqualToValue
    if (compare && itemValue != null && value != null) return compare(itemValue, value)
    return Object.is(itemValue, value)
  }

  function selectedValues(): readonly unknown[] {
    let value = currentValue()
    if (Array.isArray(value)) return value
    return value == null ? EMPTY : [value]
  }

  function container() {
    return options.getContainer?.() ?? listNode
  }

  function items(opts: { enabledOnly?: boolean } = {}) {
    let root = container()
    if (!root) return []
    let result: ListboxItemEntry[] = []
    for (let node of root.querySelectorAll<HTMLElement>('[role="option"]')) {
      let entry = entries.get(node)
      if (!entry || node.hidden || node.closest('[hidden]') !== root.closest('[hidden]')) continue
      if (opts.enabledOnly && entry.disabled()) continue
      result.push(entry)
    }
    return result
  }

  function scheduleUpdate() {
    if (updateQueued) return
    updateQueued = true
    queueMicrotask(() => {
      updateQueued = false
      void update()
    })
  }

  function scrollIntoView(node: HTMLElement) {
    node.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }

  function highlight(node: HTMLElement | null, opts: ListboxHighlightOptions = {}) {
    let { reason = 'none', event, scroll = true } = opts
    let focus = opts.focus ?? focusMode === 'roving'
    if (highlighted !== node) {
      // Record the highlight before focusing: focusing runs `_focusHighlight` synchronously.
      highlighted = node
      highlightReason = reason
      getProps().onItemHighlighted?.(node ? entries.get(node)?.value : undefined, {
        reason,
        event,
        node: node ?? undefined,
      })
      void update()
    }
    if (!node) return
    if (focus && focusMode === 'roving' && node.ownerDocument.activeElement !== node) {
      node.focus({ preventScroll: true })
    }
    if (scroll) scrollIntoView(node)
  }

  function matchText(text: string, from: ListboxItemEntry | null = null) {
    let list = items({ enabledOnly: true })
    let fromIndex = from ? list.indexOf(from) : -1
    return (
      matchNextItemBySearchText(text, list, {
        fromIndex,
        getSearchValues: (entry) => entry.label(),
      }) ?? undefined
    )
  }

  function clearTypeahead() {
    clearTimeout(typedTimer)
    typedTimer = 0
    typed = ''
  }

  let store: ListboxStore = {
    focusMode,
    get multiple() {
      return multiple()
    },
    get disabled() {
      return getProps().disabled ?? false
    },
    get readOnly() {
      return getProps().readOnly ?? false
    },
    get value() {
      return currentValue()
    },
    get selectedValues() {
      return selectedValues()
    },
    get hasValue() {
      return selectedValues().length > 0
    },
    get highlighted() {
      return highlighted
    },
    get highlightedEntry() {
      return highlighted ? entries.get(highlighted) : undefined
    },
    get highlightReason() {
      return highlightReason
    },
    get highlightedId() {
      return highlighted ? entries.get(highlighted)?.id : undefined
    },
    get listId() {
      return listId
    },
    get listNode() {
      return listNode
    },
    get hasList() {
      return hasList
    },
    get typing() {
      return typed !== ''
    },
    isSelected(value) {
      return selectedValues().some((selected) => isEqual(value, selected))
    },
    isEqual,
    items,
    findItem(value) {
      for (let entry of entries.values()) if (isEqual(entry.value, value)) return entry
      return undefined
    },
    selectedItem() {
      return items().find((entry) => store.isSelected(entry.value))
    },
    labelOf(value) {
      return store.findItem(value)?.label()
    },
    setValue(next, request = {}) {
      let details = changeDetails(request.reason ?? 'none', request.event)
      let props = getProps()
      props.onValueChange?.(next, details)
      if (details.isCanceled) return false
      if (props.value === undefined) uncontrolled = next
      let event = options.createChangeEvent?.(next, details)
      let target = options.getEventTarget?.() ?? listNode ?? container()
      if (event && target) target.dispatchEvent(event)
      void update()
      return true
    },
    selectItem(value, request = {}) {
      if (store.disabled || store.readOnly) return false
      if (multiple()) {
        let current = selectedValues()
        let next = store.isSelected(value)
          ? current.filter((selected) => !isEqual(value, selected))
          : [...current, value]
        return store.setValue(next, { reason: 'item-press', ...request })
      }
      let current = currentValue()
      if (current != null && isEqual(value, current)) return false
      return store.setValue(value, { reason: 'item-press', ...request })
    },
    highlight,
    move(move, event) {
      let list = items()
      let current = highlighted ? list.findIndex((entry) => entry.node === highlighted) : -1
      let index = getRovingTargetIndex(list.length, current, move, {
        loop: getProps().loopFocus ?? true,
        isEnabled: (i) => !list[i].disabled(),
      })
      let target = index >= 0 ? list[index] : undefined
      if (target) highlight(target.node, { reason: 'keyboard', event })
      return target
    },
    typeahead(char, event) {
      clearTimeout(typedTimer)
      typed += char.toLowerCase()
      typedTimer = window.setTimeout(clearTypeahead, TYPEAHEAD_TIMEOUT)
      let list = items({ enabledOnly: true })
      let current = highlighted ? list.findIndex((entry) => entry.node === highlighted) : -1
      // Repeating one character cycles through the options starting with it.
      let repeated = typed.length > 1 && [...typed].every((c) => c === typed[0])
      let text = repeated ? typed[0] : typed
      let fromIndex = typed.length > 1 && !repeated ? current - 1 : current
      let match = matchNextItemBySearchText(text, list, {
        fromIndex,
        getSearchValues: (entry) => entry.label(),
      })
      if (match) highlight(match.node, { reason: 'keyboard', event })
      return match ?? undefined
    },
    matchText,
    onKeyDown(event, opts = {}) {
      if (event.defaultPrevented || event.isComposing) return false
      let key = event.key
      let vertical = (opts.orientation ?? 'vertical') === 'vertical'
      let move: RovingMove | null =
        key === 'Home'
          ? 'first'
          : key === 'End'
            ? 'last'
            : key === (vertical ? 'ArrowDown' : 'ArrowRight')
              ? 'next'
              : key === (vertical ? 'ArrowUp' : 'ArrowLeft')
                ? 'previous'
                : null
      if (move) {
        event.preventDefault()
        store.move(move, event)
        return true
      }
      let typeahead = opts.typeahead ?? true
      // Without typeahead (combobox), Space is text for the input.
      if (key === 'Enter' || (key === ' ' && typeahead && typed === '')) {
        let entry = store.highlightedEntry
        event.preventDefault()
        if (entry && !entry.disabled()) {
          if (opts.onActivate) opts.onActivate(entry, event)
          else store.selectItem(entry.value, { reason: 'item-press', event })
        }
        return true
      }
      if (typeahead && key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (key === ' ') event.preventDefault()
        store.typeahead(key, event)
        return true
      }
      return false
    },
    scrollToHighlighted() {
      if (highlighted) scrollIntoView(highlighted)
    },
    reset() {
      highlighted = null
      highlightReason = 'none'
      clearTypeahead()
    },
    update,
    _registerItem(entry) {
      entries.set(entry.node, entry)
      // The value text rendered before this option registered its label.
      if (store.isSelected(entry.value)) scheduleUpdate()
    },
    _unregisterItem(node) {
      entries.delete(node)
      if (highlighted === node) highlighted = null
    },
    _setList(node, id) {
      listNode = node
      if (node) hasList = true
      if (id && id !== listId) {
        listId = id
        scheduleUpdate()
      }
    },
    _focusHighlight(node) {
      if (highlighted !== node && entries.has(node)) {
        highlight(node, { reason: 'keyboard', scroll: false })
      }
    },
    _pointerMove(node, event) {
      if (event.pointerType === 'touch') return
      if (getProps().highlightItemOnHover === false) return
      let entry = entries.get(node)
      if (!entry || entry.disabled()) return
      if (
        highlighted === node &&
        (focusMode === 'virtual' || node.ownerDocument.activeElement === node)
      ) {
        return
      }
      highlight(node, { reason: 'pointer', event, scroll: false })
    },
    _pointerLeave(node, event) {
      if (highlighted !== node || event.pointerType === 'touch') return
      if (getProps().highlightItemOnHover === false) return
      // Only pointer highlights end on pointer leave: a keyboard highlight stays when the popup
      // shows up under a resting pointer.
      if (highlightReason !== 'pointer') return
      let next = event.relatedTarget
      let root = container()
      if (next instanceof Element && root?.contains(next) && next.closest('[role="option"]')) {
        return
      }
      highlight(null, { reason: 'pointer', event })
      if (focusMode === 'roving' && root?.contains(root.ownerDocument.activeElement)) {
        ;(listNode ?? root).focus({ preventScroll: true })
      }
    },
  }

  return store
}

function normalizeValue(value: unknown, multiple: boolean): unknown {
  if (multiple) {
    if (Array.isArray(value)) return value
    return value == null ? EMPTY : [value]
  }
  if (Array.isArray(value)) return value[0] ?? null
  return value === undefined ? null : value
}

// ---------------------------------------------------------------------------------------------
// List

export interface ListboxPart {
  render(props?: ElementProps): MixInput<HTMLElement, ElementProps>
}

export interface ListboxListConfig {
  /**
   * Render `aria-activedescendant` on the list (virtual focus where the list itself keeps DOM
   * focus). Combobox renders it on its input instead.
   * @default false
   */
  activeDescendant?: boolean
}

/**
 * List behavior: registers the host as the listbox and renders `role="listbox"`, `id` (the
 * host `id` wins), `tabIndex={-1}`, and `aria-multiselectable` when `multiple`.
 */
export function createListboxList(
  handle: MixinHandle<HTMLElement>,
  store: ListboxStore,
  config: ListboxListConfig = {},
): ListboxPart {
  let node: HTMLElement | null = null
  handle.addEventListener('insert', (event) => {
    node = event.node
    store._setList(node, node.id || undefined)
  })
  handle.addEventListener('remove', () => {
    if (store.listNode === node) store._setList(null)
    node = null
  })

  return {
    render(props = {}) {
      let id = typeof props.id === 'string' ? props.id : store.listId
      return attrs({
        id,
        role: 'listbox',
        tabIndex: -1,
        'aria-multiselectable': store.multiple ? 'true' : undefined,
        'aria-activedescendant': config.activeDescendant ? store.highlightedId : undefined,
      })
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Items

export interface ListboxItemOptions {
  /** The option's value. */
  value: unknown
  /**
   * Text label used by typeahead (and value display). Defaults to the item text (see
   * `markItemText`) or the option's text content.
   */
  label?: string
  /** Ignore user interaction; skipped by keyboard navigation and typeahead. */
  disabled?: boolean
}

export interface ListboxItemConfig {
  /**
   * Called when the option is pressed (click, or Enter / Space through `onKeyDown`'s default).
   * Defaults to `store.selectItem(value)`.
   */
  onActivate?(entry: ListboxItemEntry, event: MouseEvent): void
}

export interface ListboxItem {
  readonly node: HTMLElement | null
  readonly entry: ListboxItemEntry | null
  render(options: ListboxItemOptions, props?: ElementProps): MixInput<HTMLElement, ElementProps>
}

const itemTexts = new WeakSet<Element>()

/** Marks `node` as an option's text, which is then used as its label (Base UI `ItemText`). */
export function markItemText(node: Element): void {
  itemTexts.add(node)
}

function textLabel(node: HTMLElement) {
  for (let candidate of node.querySelectorAll('*')) {
    if (itemTexts.has(candidate)) return candidate.textContent
  }
  return node.textContent
}

/**
 * Option behavior: registers the host with the store (for navigation, typeahead, and label
 * lookup) and renders `role="option"`, `id` (the host `id` wins), `aria-selected`,
 * `aria-disabled`, `data-selected`, `data-highlighted`, `data-disabled`, and `tabIndex={-1}`
 * (roving focus). Pointer movement highlights; a press runs `onActivate`.
 */
export function createListboxItem(
  handle: MixinHandle<HTMLElement>,
  hostType: string,
  store: ListboxStore,
  config: ListboxItemConfig = {},
): ListboxItem {
  let node: HTMLElement | null = null
  let opts: ListboxItemOptions = { value: null }
  let id = handle.id
  let entry: ListboxItemEntry | null = null

  function makeEntry(target: HTMLElement): ListboxItemEntry {
    return {
      node: target,
      get id() {
        return id
      },
      get value() {
        return opts.value
      },
      disabled: () => opts.disabled ?? false,
      label: () => normalizeText(opts.label ?? textLabel(target)),
    }
  }

  handle.addEventListener('insert', (event) => {
    node = event.node
    entry = makeEntry(node)
    store._registerItem(entry)
  })
  handle.addEventListener('remove', () => {
    if (node) store._unregisterItem(node)
    node = null
    entry = null
  })

  return {
    get node() {
      return node
    },
    get entry() {
      return entry
    },
    render(options, props = {}) {
      opts = options
      if (typeof props.id === 'string') id = props.id
      let disabled = options.disabled ?? false
      let selected = store.isSelected(options.value)
      let highlighted = node !== null && store.highlighted === node
      let roving = store.focusMode === 'roving'
      return [
        attrs({
          id,
          role: 'option',
          type: hostType === 'button' ? 'button' : undefined,
          tabIndex: roving ? -1 : undefined,
          'aria-selected': selected ? 'true' : 'false',
          'aria-disabled': disabled ? 'true' : undefined,
          'data-selected': selected ? '' : undefined,
          'data-highlighted': highlighted ? '' : undefined,
          'data-disabled': disabled ? '' : undefined,
        }),
        on<HTMLElement, 'click'>('click', (event) => {
          if (disabled || !entry) {
            event.preventDefault()
            return
          }
          if (config.onActivate) config.onActivate(entry, event)
          else store.selectItem(entry.value, { reason: 'item-press', event })
        }),
        on<HTMLElement, 'pointermove'>('pointermove', (event) => {
          if (node) store._pointerMove(node, event)
        }),
        on<HTMLElement, 'pointerleave'>('pointerleave', (event) => {
          if (node) store._pointerLeave(node, event)
        }),
        roving
          ? on<HTMLElement, 'focus'>('focus', () => {
              if (node) store._focusHighlight(node)
            })
          : on<HTMLElement, 'mousedown'>('mousedown', (event) => event.preventDefault()),
      ]
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Groups

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

/** Group behavior: `role="group"`, labelled (`aria-labelledby`) by a group label inside it. */
export function createListboxGroup(handle: MixinHandle<HTMLElement>): ListboxPart {
  return {
    render(props = {}) {
      handle.queueTask((node) => labelGroup(node, props))
      return attrs({ role: 'group' })
    },
  }
}

/** Group label behavior: an `id` (the host `id` wins) that the enclosing group references. */
export function createListboxGroupLabel(handle: MixinHandle<HTMLElement>): ListboxPart {
  handle.addEventListener('insert', (event) => groupLabels.add(event.node))
  return {
    render(props = {}) {
      return attrs({ id: typeof props.id === 'string' ? props.id : handle.id })
    },
  }
}
