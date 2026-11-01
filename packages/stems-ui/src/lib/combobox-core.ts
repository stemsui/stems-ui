/**
 * Shared machinery for input-driven listbox widgets: `stems-ui/combobox` (a filterable select
 * whose value is the chosen item) and `stems-ui/autocomplete` (a free-text input whose value is
 * the text, with suggestions).
 *
 * A widget composes these pieces, like `lib/popup.ts` and `lib/listbox.ts`:
 *
 * - `createComboboxCore()` in its Context provider. It owns a popup store (`lib/popup.ts`), a
 *   listbox store in `'virtual'` focus mode (`lib/listbox.ts`), the input text (controlled or
 *   uncontrolled, with Base UI change details), filtering (`items` + `filter`, or registered
 *   items hidden automatically), the empty state, highlight management (`autoHighlight`,
 *   looping through the input), inline completion (autocomplete's `mode`), chips, and the
 *   modal state. Call `core.render()` at the top of the provider's render function.
 * - `create*Part()` helpers in the widget's mixins. Each is called during mixin setup with the
 *   mixin `handle` and returns an object whose `render()` returns mixin descriptors.
 *
 * DOM focus stays in the input. The highlighted item is announced with `aria-activedescendant`;
 * items prevent `mousedown` so pressing one doesn't blur the input. The popup is shown in the
 * top layer and positioned against the input group (or the chips container, or the input).
 */

import { attrs, on } from '@remix-run/component'
import type { ElementProps, Handle, MixInput, MixinHandle } from '@remix-run/component'

import { getDirection, horizontalArrowStep } from './direction.ts'
import type { FieldControlRenderResult } from './field-control.ts'
import { inertOthers } from './focus-trap.ts'
import { createListboxItem, createListboxList, createListboxStore } from './listbox.ts'
import type {
  ListboxHighlightDetails,
  ListboxItemEntry,
  ListboxStore,
  ListboxValueChangeDetails,
  ListboxValueChangeReason,
} from './listbox.ts'
import { createPopupStore, createPopupSurface, createPopupTrigger } from './popup.ts'
import type {
  PopupChangeRequest,
  PopupInteractionType,
  PopupOpenChangeDetails,
  PopupOpenChangeReason,
  PopupStore,
  PopupSurfaceOptions,
} from './popup.ts'
import { createPresence } from './presence.ts'
import { lockScroll } from './scroll-lock.ts'

// ---------------------------------------------------------------------------------------------
// Types

/** Base UI's combobox / autocomplete change reasons (value, input value, and open state). */
export type ComboboxChangeReason =
  | 'trigger-press'
  | 'input-press'
  | 'outside-press'
  | 'item-press'
  | 'close-press'
  | 'escape-key'
  | 'list-navigation'
  | 'focus-out'
  | 'input-change'
  | 'input-clear'
  | 'clear-press'
  | 'chip-remove-press'
  | 'imperative-action'
  | 'none'

/** The second argument of `onInputValueChange` (and autocomplete's `onValueChange`). */
export interface ComboboxInputChangeDetails {
  readonly reason: ComboboxChangeReason
  readonly event: Event | undefined
  /** Multiple mode: the input is being cleared because an item was pressed. */
  readonly isItemPress?: boolean
  /** Call from the change handler to keep the current text. */
  cancel(): void
  readonly isCanceled: boolean
}

/** A group of items in `items`: `{ value?, items: [...] }`. */
export interface ComboboxItemGroup<item = unknown> {
  readonly value?: unknown
  readonly label?: unknown
  readonly items: readonly item[]
}

/** Base UI's `items`: a flat array of items or an array of groups. */
export type ComboboxItems<item = unknown> = readonly item[] | readonly ComboboxItemGroup<item>[]

/**
 * Base UI's `filter`: whether `item` matches `query`. `itemToString` converts an item to the
 * text the default filter compares.
 */
export type ComboboxFilter<item = any> = (
  item: item,
  query: string,
  itemToString?: (item: item) => string,
) => boolean

type HighlightTarget = 'selected' | 'first' | 'last'

export interface ComboboxCoreProps {
  /** The input text (controlled). */
  inputValue?: string | number
  /** The initial input text (uncontrolled). */
  defaultInputValue?: string | number
  onInputValueChange?: (value: string, details: ComboboxInputChangeDetails) => void
  value?: unknown
  defaultValue?: unknown
  onValueChange?: (value: any, details: ListboxValueChangeDetails) => void
  multiple?: boolean
  items?: ComboboxItems
  filter?: ComboboxFilter | null
  limit?: number
  locale?: Intl.LocalesArgument
  /** Converts an item to its display / filter text. */
  itemToString?: (item: any) => string
  isItemEqualToValue?: (itemValue: any, value: any) => boolean
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean, details: PopupOpenChangeDetails) => void
  onOpenChangeComplete?: (open: boolean) => void
  modal?: boolean
  autoHighlight?: boolean | 'always'
  highlightItemOnHover?: boolean
  loopFocus?: boolean
  onItemHighlighted?: (value: unknown, details: ListboxHighlightDetails) => void
  openOnInputClick?: boolean
  disabled?: boolean
  readOnly?: boolean
  required?: boolean
}

export interface ComboboxCoreConfig {
  /** `'combobox'` commits items as the value; `'autocomplete'` only fills in the text. */
  kind: 'combobox' | 'autocomplete'
  /** Reads the widget props, mapped onto the core's names. */
  getProps(): ComboboxCoreProps
  /** Filter the list by the input text (autocomplete `mode` `'list'` / `'both'`). */
  filtering(): boolean
  /** Inline completion (autocomplete `mode` `'both'` / `'inline'`). */
  inline(): boolean
  /** `aria-autocomplete` on the input. */
  ariaAutocomplete(): 'list' | 'both' | 'inline' | 'none'
  createValueEvent?(value: unknown, reason: ComboboxChangeReason): Event
  createInputValueEvent?(value: string, reason: ComboboxChangeReason): Event
  createOpenEvent?(open: boolean, reason: ComboboxChangeReason): Event
  /** Autocomplete: called after an item was activated (e.g. to submit the form). */
  onItemActivated?(entry: ListboxItemEntry, event: Event): void
  /** The provider's `lib/field-control.ts` connection (see {@link ComboboxFieldWiring}). */
  field?: ComboboxFieldWiring
}

/**
 * How a provider plugs its field connection into the core: the parts render the field's
 * attributes, and focus moving anywhere inside the widget (input, input group, chips, trigger,
 * clear button, popup) counts as one focus of the field.
 */
export interface ComboboxFieldWiring {
  /** The field's render result from the provider's last render. */
  result(): FieldControlRenderResult | undefined
  /**
   * The input's own `id` prop changed (`undefined` for none): it becomes the field's control
   * id on the provider's next render. Called while rendering.
   */
  setInputId(id: string | undefined, from: { queueTask(task: () => void): void }): void
  focus(): void
  blur(): void
}

// ---------------------------------------------------------------------------------------------
// Filtering

const collators = new Map<string, Intl.Collator>()

function getCollator(locale: Intl.LocalesArgument): Intl.Collator {
  let key = locale === undefined ? '' : String(locale)
  let collator = collators.get(key)
  if (!collator) {
    collator = new Intl.Collator(locale as string | string[] | undefined, {
      usage: 'search',
      sensitivity: 'base',
    })
    collators.set(key, collator)
  }
  return collator
}

/**
 * Whether `text` contains `query`, ignoring case and diacritics (Base UI `useFilter().contains`).
 */
export function containsText(text: string, query: string, locale?: Intl.LocalesArgument): boolean {
  if (query === '') return true
  let collator = getCollator(locale)
  let normalizedText = text.normalize('NFC')
  let normalizedQuery = query.normalize('NFC')
  let length = normalizedQuery.length
  for (let index = 0; index + length <= normalizedText.length; index++) {
    if (collator.compare(normalizedText.slice(index, index + length), normalizedQuery) === 0) {
      return true
    }
  }
  return false
}

/** Whether `text` starts with `query`, ignoring case and diacritics. */
export function startsWithText(
  text: string,
  query: string,
  locale?: Intl.LocalesArgument,
): boolean {
  if (query === '') return true
  let slice = text.normalize('NFC').slice(0, query.normalize('NFC').length)
  return getCollator(locale).compare(slice, query.normalize('NFC')) === 0
}

/** The default text of an item: `label`, then `value`, then `String(item)`. */
export function defaultItemString(item: unknown): string {
  if (item == null) return ''
  if (typeof item === 'object') {
    let record = item as Record<string, unknown>
    if ('label' in record && record.label != null) return String(record.label)
    if ('value' in record && record.value != null) return String(record.value)
  }
  return String(item)
}

export function isGroup(entry: unknown): entry is ComboboxItemGroup {
  return (
    typeof entry === 'object' &&
    entry !== null &&
    Array.isArray((entry as { items?: unknown }).items)
  )
}

function flatten(items: ComboboxItems | undefined): unknown[] {
  if (!items) return []
  let result: unknown[] = []
  for (let entry of items) {
    if (isGroup(entry)) result.push(...entry.items)
    else result.push(entry)
  }
  return result
}

// ---------------------------------------------------------------------------------------------
// Core

export interface ComboboxCore {
  readonly kind: 'combobox' | 'autocomplete'
  readonly popup: PopupStore
  readonly listbox: ListboxStore
  readonly open: boolean
  /** The input text: the draft, or (single combobox) the selected item's label. */
  readonly inputValue: string
  /** What the input shows: the inline completion preview, else `inputValue`. */
  readonly displayValue: string
  /** The text items are filtered by (`''` while the input shows the selected label). */
  readonly query: string
  /** The `items` prop. */
  readonly items: ComboboxItems | undefined
  /** `items` filtered by the query, with the same flat or grouped shape (empty groups dropped). */
  readonly filteredItems: readonly unknown[]
  /** The filtered items as a flat array. */
  readonly flatFilteredItems: readonly unknown[]
  /** Whether no items match (or no items are registered). */
  readonly empty: boolean
  readonly multiple: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly required: boolean
  readonly value: unknown
  readonly selectedValues: readonly unknown[]
  readonly hasValue: boolean
  readonly inputNode: HTMLInputElement | null
  /** Whether the input is rendered inside the popup (Base UI's input-inside-popup pattern). */
  readonly inputInsidePopup: boolean
  readonly ariaAutocomplete: 'list' | 'both' | 'inline' | 'none'
  /** The text for an item or value (`itemToString`, `label`, a registered label, `String`). */
  labelOf(value: unknown): string
  /** Whether an item with `value` (and text `label`) matches the current query. */
  isItemVisible(value: unknown, label: string | undefined): boolean
  /** Requests an input text change. Returns whether it was accepted. */
  setInputValue(
    value: string,
    request: { reason: ComboboxChangeReason; event?: Event; isItemPress?: boolean },
  ): boolean
  /** Requests a value change (combobox). Returns whether it was accepted. */
  setValue(value: unknown, request: { reason: ComboboxChangeReason; event?: Event }): boolean
  /** Requests an open-state change. */
  setOpen(open: boolean, request: { reason: ComboboxChangeReason; event?: Event }): boolean
  /** Removes one value (multiple). */
  removeValue(value: unknown, event?: Event, reason?: ComboboxChangeReason): boolean
  /** Clears the value and the input text (the clear button). */
  clear(event?: Event): void
  /** Presses an item (click or Enter). */
  activate(entry: ListboxItemEntry, event: Event): void
  /** The element the popup is positioned against. */
  anchor(): HTMLElement | null
  /** Whether `node` is inside the widget's controls (input, input group, chips, triggers). */
  containsControl(node: Node): boolean
  /** Call at the top of the provider's render function. */
  render(): void
  update(): Promise<unknown>
  /** @internal */
  _setInput(node: HTMLInputElement | null): void
  /** @internal */
  _setGroup(node: HTMLElement | null): void
  /** @internal */
  _setChips(node: HTMLElement | null): void
  /** @internal */
  _registerChip(node: HTMLElement, getValue: () => unknown, disabled: () => boolean): () => void
  /** @internal */
  _chipValue(node: Element): { value: unknown } | undefined
  /** @internal */
  _onInput(event: Event): void
  /** @internal */
  _onInputKeyDown(event: KeyboardEvent): void
  /** @internal */
  _onInputClick(event: MouseEvent): void
  /** @internal */
  _onInputFocusOut(event: FocusEvent): void
  /** @internal */
  _onChipKeyDown(event: KeyboardEvent, node: HTMLElement): void
  /** @internal */
  _syncInput(node: HTMLInputElement): void
  /** @internal */
  _setComposing(composing: boolean): void
  /** @internal */
  _initialFocus(type: PopupInteractionType | null): HTMLElement | false
  /** @internal Field wiring for the input: `id`, `aria-describedby`, `aria-invalid`, state. */
  _fieldInputAttrs(): ElementProps
  /** @internal Field state data attributes (without `data-disabled`) for the other parts. */
  _fieldDataAttrs(): ElementProps
  /** @internal The input's own `id` prop (see {@link ComboboxFieldWiring.setInputId}). */
  _setInputHostId(id: string | undefined, from: { queueTask(task: () => void): void }): void
  /** @internal Focus entered the widget. */
  _onFieldFocusIn(): void
  /** @internal Focus left a part of the widget. */
  _onFieldFocusOut(event: FocusEvent): void
}

const UNSET = Symbol('unset')

function inputDetails(
  reason: ComboboxChangeReason,
  event: Event | undefined,
  isItemPress?: boolean,
): ComboboxInputChangeDetails {
  let canceled = false
  return {
    reason,
    event,
    isItemPress,
    cancel() {
      canceled = true
    },
    get isCanceled() {
      return canceled
    },
  }
}

function isPrintableKey(event: KeyboardEvent) {
  return event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey
}

export function createComboboxCore(
  handle: Handle<any, any>,
  config: ComboboxCoreConfig,
): ComboboxCore {
  let { getProps, kind } = config
  let initial = getProps()
  let draft: string | null =
    initial.defaultInputValue !== undefined ? String(initial.defaultInputValue) : null
  let preview: string | null = null
  let pendingSelection: [number, number] | null = null
  let composing = false
  let lastInputType = ''
  let inputNode: HTMLInputElement | null = null
  let groupNode: HTMLElement | null = null
  let chipsNode: HTMLElement | null = null
  let chips = new Map<HTMLElement, { value: () => unknown; disabled: () => boolean }>()
  let pendingHighlight: { target: HighlightTarget; reason: 'keyboard' | 'none' } | null = null
  let highlightQuery: string | null = null
  let pendingChipFocus: { value: unknown } | 'input' | null = null
  let registeredEmpty = false
  let wasOpen: boolean | undefined
  let seenValue: unknown = UNSET
  let releaseModal: (() => void) | null = null
  let fieldFocused = false
  let filterCache: {
    items: ComboboxItems | undefined
    query: string
    filter: unknown
    limit: number | undefined
    filtering: boolean
    result: unknown[]
    flat: unknown[]
  } | null = null

  let popup = createPopupStore({
    id: handle.id,
    getProps: () => {
      let props = getProps()
      return {
        open: props.open,
        defaultOpen: props.defaultOpen,
        onOpenChange: props.onOpenChange,
        onOpenChangeComplete: props.onOpenChangeComplete,
        // The core implements `modal` itself: the popup's focus trap would take focus from the
        // input.
        modal: false,
      }
    },
    update: () => handle.update(),
    signal: handle.signal,
  })

  let baseSetOpen = popup.setOpen
  popup.setOpen = (open, request) => {
    let props = getProps()
    if (open && (props.disabled || props.readOnly)) return false
    if (open && !pendingHighlight && request.reason === 'trigger-press') {
      pendingHighlight = { target: 'selected', reason: 'none' }
    }
    let accepted = baseSetOpen(open, request)
    if (!accepted) {
      if (open) pendingHighlight = null
      return false
    }
    let event = config.createOpenEvent?.(open, request.reason as ComboboxChangeReason)
    let target = inputNode ?? popup.activeTrigger ?? popup.popupNode
    if (event && target) target.dispatchEvent(event)
    return true
  }

  // Presses on the input, input group, and chips count as inside the popup (no dismissal).
  let baseContainsTrigger = popup.containsTrigger
  popup.containsTrigger = (node) => baseContainsTrigger(node) || containsOwnControls(node)

  let listbox = createListboxStore({
    id: handle.id,
    getProps: () => {
      let props = getProps()
      return {
        value: kind === 'combobox' ? props.value : undefined,
        defaultValue: kind === 'combobox' ? props.defaultValue : undefined,
        onValueChange: props.onValueChange,
        multiple: props.multiple,
        disabled: props.disabled,
        readOnly: props.readOnly,
        loopFocus: props.loopFocus ?? true,
        highlightItemOnHover: props.highlightItemOnHover,
        isItemEqualToValue: props.isItemEqualToValue,
        onItemHighlighted: (value, details) => {
          props.onItemHighlighted?.(value, details)
          onHighlight(value, details)
        },
      }
    },
    update: () => handle.update(),
    focusMode: 'virtual',
    getContainer: () => (listbox?.listNode ? null : popup.popupNode),
    createChangeEvent: (value, details) =>
      config.createValueEvent?.(value, details.reason as ComboboxChangeReason),
    getEventTarget: () => inputNode ?? popup.activeTrigger ?? popup.popupNode,
  })

  function containsOwnControls(node: Node) {
    return [inputNode, groupNode, chipsNode].some((owner) => owner?.contains(node) === true)
  }

  function multiple() {
    return getProps().multiple ?? false
  }

  function isEqual(a: unknown, b: unknown) {
    return listbox.isEqual(a, b)
  }

  function findItem(value: unknown): unknown | typeof UNSET {
    let items = getProps().items
    if (!items) return UNSET
    for (let item of flatten(items)) {
      if (isEqual(item, value)) return item
      if (
        typeof item === 'object' &&
        item !== null &&
        'value' in item &&
        (typeof value !== 'object' || value === null) &&
        isEqual((item as { value: unknown }).value, value)
      ) {
        return item
      }
    }
    return UNSET
  }

  function labelOf(value: unknown): string {
    if (value == null) return ''
    let props = getProps()
    if (props.itemToString) return props.itemToString(value)
    if (typeof value === 'object') return defaultItemString(value)
    let item = findItem(value)
    if (item !== UNSET && item !== value) return defaultItemString(item)
    let registered = listbox.labelOf(value)
    if (registered) return registered
    return String(value)
  }

  function itemString(item: unknown): string {
    let props = getProps()
    return props.itemToString ? props.itemToString(item) : defaultItemString(item)
  }

  function derivedInput(): string {
    if (kind !== 'combobox' || multiple()) return ''
    return labelOf(listbox.value)
  }

  function inputValue(): string {
    let props = getProps()
    if (props.inputValue !== undefined) return String(props.inputValue)
    return draft ?? derivedInput()
  }

  function query(): string {
    if (!config.filtering()) return ''
    let text = inputValue()
    // A single combobox shows its selected label: list every item until the user edits it.
    if (kind === 'combobox' && !multiple() && listbox.hasValue && text === derivedInput()) {
      return ''
    }
    return text
  }

  function matches(item: unknown, text: string, label?: string) {
    let props = getProps()
    let toString = label === undefined ? itemString : () => label
    if (props.filter === null) return true
    if (props.filter) return props.filter(item, text, toString)
    return containsText(toString(item), text, props.locale)
  }

  function computeFiltered() {
    let props = getProps()
    let items = props.items
    let text = query()
    let filtering = config.filtering() && props.filter !== null
    let cache = filterCache
    if (
      cache &&
      cache.items === items &&
      cache.query === text &&
      cache.filter === props.filter &&
      cache.limit === props.limit &&
      cache.filtering === filtering
    ) {
      return cache
    }
    let limit = props.limit !== undefined && props.limit >= 0 ? props.limit : Infinity
    let count = 0
    let keep = (item: unknown) => {
      if (count >= limit) return false
      let ok = !filtering || text === '' || matches(item, text)
      if (ok) count++
      return ok
    }
    let result: unknown[] = []
    let flat: unknown[] = []
    for (let entry of items ?? []) {
      if (isGroup(entry)) {
        let groupItems = entry.items.filter(keep)
        if (groupItems.length > 0) {
          result.push({ ...entry, items: groupItems })
          flat.push(...groupItems)
        }
      } else if (keep(entry)) {
        result.push(entry)
        flat.push(entry)
      }
    }
    filterCache = {
      items,
      query: text,
      filter: props.filter,
      limit: props.limit,
      filtering,
      result,
      flat,
    }
    return filterCache
  }

  function enabledEntries() {
    return listbox.items({ enabledOnly: true })
  }

  function setSelection(start: number, end: number) {
    pendingSelection = [start, end]
    if (inputNode && inputNode.value === core.displayValue) applySelection(inputNode)
  }

  function applySelection(node: HTMLInputElement) {
    if (!pendingSelection) return
    let [start, end] = pendingSelection
    pendingSelection = null
    if (node.ownerDocument.activeElement === node) node.setSelectionRange(start, end)
  }

  // Inline completion: the input temporarily shows the highlighted item.
  function showPreview(value: unknown, completeTyped: boolean) {
    let text = itemString(value)
    let typed = inputValue()
    if (completeTyped) {
      if (typed === '' || !startsWithText(text, typed, getProps().locale)) return
      preview = typed + text.slice(typed.length)
      setSelection(typed.length, preview.length)
      return
    }
    preview = text
    let prefix = typed !== '' && startsWithText(text, typed, getProps().locale)
    setSelection(prefix ? typed.length : text.length, text.length)
  }

  function onHighlight(value: unknown, details: ListboxHighlightDetails) {
    if (!config.inline() || details.reason !== 'keyboard') return
    if (details.node) {
      showPreview(value, false)
    } else if (preview !== null) {
      preview = null
      let length = inputValue().length
      setSelection(length, length)
    }
  }

  function highlightEntry(entry: ListboxItemEntry | undefined, reason: 'keyboard' | 'none') {
    listbox.highlight(entry?.node ?? null, { reason })
  }

  function navigate(direction: 1 | -1, event: KeyboardEvent) {
    let list = enabledEntries()
    if (list.length === 0) return
    let current = list.findIndex((entry) => entry.node === listbox.highlighted)
    let loop = getProps().loopFocus ?? true
    let always = getProps().autoHighlight === 'always'
    let next: number
    if (current === -1) next = direction === 1 ? 0 : list.length - 1
    else next = current + direction
    if (next < 0 || next >= list.length) {
      if (!loop) return
      // Base UI: the input is part of the loop (unless an item must stay highlighted).
      if (always) next = next < 0 ? list.length - 1 : 0
      else next = -1
    }
    listbox.highlight(next === -1 ? null : list[next].node, { reason: 'keyboard', event })
  }

  function commitInput(reason: ComboboxChangeReason, event?: Event) {
    if (kind === 'autocomplete') {
      if (preview === null) return
      let text = preview
      preview = null
      if (reason === 'escape-key') {
        void handle.update()
        return
      }
      if (text !== inputValue()) core.setInputValue(text, { reason: 'list-navigation', event })
      else void handle.update()
      return
    }
    if (multiple()) {
      if (inputValue() !== '') core.setInputValue('', { reason: 'input-clear', event })
      return
    }
    let label = derivedInput()
    if (inputValue() !== label) core.setInputValue(label, { reason, event })
    else if (getProps().inputValue === undefined) draft = null
  }

  function focusPendingChip() {
    let target = pendingChipFocus
    pendingChipFocus = null
    if (!target) return
    let node =
      target === 'input'
        ? undefined
        : chipNodes().find((chip) => isEqual(chips.get(chip)?.value(), target.value))
    ;(node ?? inputNode)?.focus()
  }

  // Works around a Remix 3.1 reconciler bug: when an ancestor re-renders a component whose
  // output (an array, like `ValueText`'s chips) grows, the new nodes are appended to the end of
  // the shared DOM parent, after following siblings such as the input. Put chips that should
  // precede the input back before it, in value order.
  function fixChipOrder() {
    let input = inputNode
    let parent = input?.parentNode
    if (!input || !parent || chips.size === 0) return
    let siblings = [...chips.keys()].filter((node) => node.parentNode === parent)
    let before = (node: Node) =>
      (node.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    if (siblings.length === 0 || !siblings.some(before)) return
    let values = listbox.selectedValues
    let rank = (node: HTMLElement) => {
      let index = values.findIndex((value) => isEqual(chips.get(node)?.value(), value))
      return index === -1 ? values.length : index
    }
    let ordered = siblings.slice().sort((a, b) => rank(a) - rank(b))
    let current = [...parent.childNodes].filter((node) => ordered.includes(node as HTMLElement))
    let inPlace = ordered.every((node, index) => current[index] === node && before(node))
    if (inPlace) return
    for (let node of ordered) parent.insertBefore(node, input)
  }

  function afterRender() {
    fixChipOrder()
    focusPendingChip()
    let props = getProps()
    if (props.items === undefined) {
      let empty = listbox.items().length === 0
      if (empty !== registeredEmpty) {
        registeredEmpty = empty
        void handle.update()
      }
    }

    let highlighted = listbox.highlighted
    if (highlighted && !listbox.items().some((entry) => entry.node === highlighted)) {
      listbox.highlight(null)
    }
    if (!popup.open) return

    let list = enabledEntries()
    let text = query()
    if (pendingHighlight) {
      let { target, reason } = pendingHighlight
      pendingHighlight = null
      highlightQuery = text
      let selected = kind === 'combobox' ? listbox.selectedItem() : undefined
      let entry =
        selected && !selected.disabled()
          ? selected
          : target === 'first'
            ? list[0]
            : target === 'last'
              ? list.at(-1)
              : undefined
      if (entry) {
        highlightEntry(entry, reason)
        requestAnimationFrame(() => listbox.scrollToHighlighted())
      }
    } else if (text !== highlightQuery) {
      highlightQuery = text
      if (props.autoHighlight && list[0]) {
        highlightEntry(list[0], 'none')
        let insertion = lastInputType.startsWith('insert')
        if (config.inline() && insertion) {
          showPreview(list[0].value, true)
          void handle.update()
        }
      } else if (listbox.highlighted) {
        listbox.highlight(null)
      }
    }
    if (props.autoHighlight === 'always' && !listbox.highlighted && list[0]) {
      highlightEntry(list[0], 'none')
    }
  }

  function syncModal(open: boolean) {
    if (!open || !getProps().modal) {
      releaseModal?.()
      releaseModal = null
      return
    }
    if (releaseModal || !popup.popupNode) return
    let doc = popup.popupNode.ownerDocument
    let unlock = lockScroll(doc)
    let restore = inertOthers([
      popup.popupNode,
      groupNode,
      chipsNode,
      inputNode,
      popup.activeTrigger,
    ])
    releaseModal = () => {
      restore()
      unlock()
    }
  }
  handle.signal.addEventListener('abort', () => syncModal(false))

  let core: ComboboxCore = {
    kind,
    popup,
    listbox,
    get open() {
      return popup.open
    },
    get inputValue() {
      return inputValue()
    },
    get displayValue() {
      return preview ?? inputValue()
    },
    get query() {
      return query()
    },
    get items() {
      return getProps().items
    },
    get filteredItems() {
      return computeFiltered().result
    },
    get flatFilteredItems() {
      return computeFiltered().flat
    },
    get empty() {
      if (getProps().items !== undefined) return computeFiltered().flat.length === 0
      return registeredEmpty
    },
    get multiple() {
      return multiple()
    },
    get disabled() {
      return getProps().disabled ?? false
    },
    get readOnly() {
      return getProps().readOnly ?? false
    },
    get required() {
      return getProps().required ?? false
    },
    get value() {
      return listbox.value
    },
    get selectedValues() {
      return listbox.selectedValues
    },
    get hasValue() {
      return listbox.hasValue
    },
    get inputNode() {
      return inputNode
    },
    get inputInsidePopup() {
      return !!(inputNode && popup.popupNode?.contains(inputNode))
    },
    get ariaAutocomplete() {
      return config.ariaAutocomplete()
    },
    labelOf: (value) => (kind === 'autocomplete' ? itemString(value) : labelOf(value)),
    isItemVisible(value, label) {
      if (!config.filtering() || getProps().filter === null) return true
      let props = getProps()
      if (props.items !== undefined) {
        let flat = computeFiltered().flat
        return flat.some(
          (item) =>
            isEqual(item, value) ||
            (typeof item === 'object' &&
              item !== null &&
              'value' in item &&
              isEqual((item as { value: unknown }).value, value)),
        )
      }
      let text = query()
      if (text === '' || label === undefined) return true
      return matches(value, text, label)
    },
    setInputValue(next, request) {
      let props = getProps()
      let details = inputDetails(request.reason, request.event, request.isItemPress)
      props.onInputValueChange?.(next, details)
      if (details.isCanceled) {
        void handle.update()
        return false
      }
      if (props.inputValue === undefined) draft = next
      let event = config.createInputValueEvent?.(next, request.reason)
      let target = inputNode ?? popup.activeTrigger ?? popup.popupNode
      if (event && target) target.dispatchEvent(event)
      void handle.update()
      return true
    },
    setValue(next, request) {
      return listbox.setValue(next, {
        reason: request.reason as ListboxValueChangeReason,
        event: request.event,
      })
    },
    setOpen(open, request) {
      return popup.setOpen(open, request as PopupChangeRequest & { reason: PopupOpenChangeReason })
    },
    removeValue(value, event, reason = 'chip-remove-press') {
      if (core.disabled || core.readOnly) return false
      let next = listbox.selectedValues.filter((selected) => !isEqual(value, selected))
      return core.setValue(next, { reason, event })
    },
    clear(event) {
      if (core.disabled || core.readOnly) return
      if (kind === 'combobox' && listbox.hasValue) {
        core.setValue(multiple() ? [] : null, { reason: 'clear-press', event })
      }
      preview = null
      if (inputValue() !== '') core.setInputValue('', { reason: 'clear-press', event })
      if (!core.inputInsidePopup) inputNode?.focus()
    },
    activate(entry, event) {
      if (core.disabled || core.readOnly || entry.disabled()) return
      let request = { reason: 'item-press' as const, event }
      if (kind === 'autocomplete') {
        let text = itemString(entry.value)
        preview = null
        core.setInputValue(text, request)
        if (inputNode) inputNode.value = text
        popup.setOpen(false, request)
        config.onItemActivated?.(entry, event)
        return
      }
      if (multiple()) {
        listbox.selectItem(entry.value, { reason: 'item-press', event })
        if (inputValue() !== '') {
          core.setInputValue('', { reason: 'input-clear', event, isItemPress: true })
        }
        if (!core.inputInsidePopup) popup.setOpen(false, request)
        return
      }
      let selected = listbox.isSelected(entry.value)
      if (!selected && !listbox.selectItem(entry.value, { reason: 'item-press', event })) return
      let label = labelOf(entry.value)
      if (inputValue() !== label) core.setInputValue(label, request)
      else if (getProps().inputValue === undefined) draft = null
      popup.setOpen(false, request)
    },
    anchor() {
      let popupNode = popup.popupNode
      for (let node of [groupNode, chipsNode, inputNode]) {
        if (node?.isConnected && !popupNode?.contains(node)) return node
      }
      return popup.activeTrigger
    },
    containsControl(node) {
      return popup.containsTrigger(node) || popup.popupNode?.contains(node) === true
    },
    _fieldInputAttrs() {
      let f = config.field?.result()
      if (!f?.inField) return {}
      return {
        id: f.id,
        'aria-describedby': f.describedBy,
        'aria-invalid': f.invalid ? 'true' : undefined,
        ...core._fieldDataAttrs(),
      }
    },
    _fieldDataAttrs() {
      let f = config.field?.result()
      if (!f?.inField) return {}
      let { 'data-disabled': _disabled, ...data } = f.dataAttrs
      return data
    },
    _setInputHostId(id, from) {
      config.field?.setInputId(id, from)
    },
    _onFieldFocusIn() {
      if (fieldFocused || !config.field) return
      fieldFocused = true
      config.field.focus()
    },
    _onFieldFocusOut(event) {
      if (!fieldFocused || !config.field) return
      let next = event.relatedTarget
      // Moving between the input, chips, buttons and the popup stays inside the field.
      if (next instanceof Node && core.containsControl(next)) return
      fieldFocused = false
      config.field.blur()
    },
    render() {
      popup.sync()
      let open = popup.open
      if (kind === 'combobox' && !multiple()) {
        let value = listbox.value
        if (
          seenValue !== UNSET &&
          !Object.is(value, seenValue) &&
          getProps().inputValue === undefined
        ) {
          // The value changed (e.g. a controlled owner): show its label.
          draft = null
        }
        seenValue = value
      }
      if (wasOpen !== undefined && open !== wasOpen) {
        if (open) {
          // Typing opened the popup: the query changed (autoHighlight applies).
          if ((popup.openReason as string) !== 'input-change') highlightQuery = query()
        } else {
          highlightQuery = null
          let reason = (popup.lastChange?.reason ?? 'none') as ComboboxChangeReason
          let event = popup.lastChange?.event
          pendingHighlight = null
          handle.queueTask(() => commitInput(reason, event))
        }
        handle.queueTask(() => syncModal(open))
      } else if (wasOpen === undefined && open) {
        handle.queueTask(() => syncModal(true))
      }
      if (!open) listbox.reset()
      wasOpen = open
      handle.queueTask(afterRender)
    },
    update: () => handle.update(),
    _setInput(node) {
      inputNode = node
    },
    _setGroup(node) {
      groupNode = node
    },
    _setChips(node) {
      chipsNode = node
    },
    _registerChip(node, getValue, disabled) {
      chips.set(node, { value: getValue, disabled })
      return () => {
        chips.delete(node)
      }
    },
    _chipValue(node) {
      let chip = node.closest('*') as HTMLElement | null
      while (chip) {
        let entry = chips.get(chip)
        if (entry) return { value: entry.value() }
        chip = chip.parentElement
      }
      return undefined
    },
    _onInput(event) {
      let node = event.currentTarget as HTMLInputElement
      lastInputType = (event as InputEvent).inputType ?? 'insertText'
      preview = null
      pendingSelection = null
      let next = node.value
      if (!core.setInputValue(next, { reason: 'input-change', event })) return
      if (kind === 'combobox' && !multiple() && next === '' && listbox.hasValue) {
        core.setValue(null, { reason: 'input-clear', event })
      }
      if (!popup.open) {
        popup._setInteractionType('keyboard')
        popup.setOpen(true, { reason: 'input-change' as PopupOpenChangeReason, event })
      }
    },
    _onInputKeyDown(event) {
      if (event.defaultPrevented || event.isComposing || core.disabled) return
      let node = event.currentTarget as HTMLInputElement
      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowUp': {
          if (event.altKey && event.key === 'ArrowUp' && popup.open) {
            event.preventDefault()
            popup.setOpen(false, { reason: 'list-navigation', event })
            return
          }
          event.preventDefault()
          if (!popup.open) {
            if (core.readOnly) return
            pendingHighlight = {
              target: event.altKey ? 'selected' : event.key === 'ArrowDown' ? 'first' : 'last',
              reason: 'keyboard',
            }
            popup._setInteractionType('keyboard')
            popup.setOpen(true, { reason: 'list-navigation', event })
            return
          }
          navigate(event.key === 'ArrowDown' ? 1 : -1, event)
          return
        }
        case 'Enter': {
          let entry = listbox.highlightedEntry
          if (!popup.open || !entry || entry.disabled()) return
          event.preventDefault()
          core.activate(entry, event)
          return
        }
        case 'Escape': {
          // An open popup is dismissed by the dismiss layer before this runs.
          if (kind === 'autocomplete' && !popup.open && inputValue() !== '' && !core.readOnly) {
            event.preventDefault()
            core.setInputValue('', { reason: 'escape-key', event })
          }
          return
        }
        case 'Backspace': {
          if (!multiple() || node.value !== '' || core.readOnly) return
          let last = listbox.selectedValues.at(-1)
          if (last === undefined) return
          event.preventDefault()
          core.removeValue(last, event)
          return
        }
        case 'ArrowLeft':
        case 'ArrowRight': {
          if (!multiple() || node.selectionStart !== 0 || node.selectionEnd !== 0) return
          if (horizontalArrowStep(event.key, getDirection(node)) !== -1) return
          let list = chipNodes()
          let last = list.at(-1)
          if (!last) return
          event.preventDefault()
          last.focus()
          return
        }
      }
    },
    _onInputClick() {
      if (core.disabled || core.readOnly || popup.open) return
      if (!(getProps().openOnInputClick ?? true)) return
      pendingHighlight = { target: 'selected', reason: 'none' }
      popup._setInteractionType('mouse')
      popup.setOpen(true, { reason: 'input-press' as PopupOpenChangeReason })
    },
    _onInputFocusOut(event) {
      let next = event.relatedTarget
      if (next instanceof Node && core.containsControl(next)) return
      if (popup.open) {
        // A press outside closes through the dismiss layer (reason `outside-press`).
        if (next instanceof Node) popup.setOpen(false, { reason: 'focus-out', event })
        return
      }
      commitInput('focus-out', event)
    },
    _onChipKeyDown(event, node) {
      if (event.defaultPrevented) return
      let list = chipNodes()
      let index = list.indexOf(node)
      if (index === -1) return
      let focusAt = (i: number) => {
        let target = list[i]
        if (target) target.focus()
        else inputNode?.focus()
      }
      let step = horizontalArrowStep(event.key, getDirection(node))
      if (step !== 0) {
        event.preventDefault()
        if (step === -1 && index === 0) return
        focusAt(index + step)
        return
      }
      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault()
        let entry = chips.get(node)
        if (!entry || entry.disabled()) return
        let rest = list.filter((chip) => chip !== node)
        let target = event.key === 'Backspace' ? (rest[index - 1] ?? rest[index]) : rest[index]
        let entryTarget = target ? chips.get(target) : undefined
        if (!core.removeValue(entry.value(), event)) return
        // Focus the neighbour once the chips re-render (nodes may be reused).
        pendingChipFocus = entryTarget ? { value: entryTarget.value() } : 'input'
        return
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || isPrintableKey(event)) {
        inputNode?.focus()
      }
    },
    _syncInput(node) {
      if (composing) return
      let display = core.displayValue
      if (node.value !== display) node.value = display
      applySelection(node)
    },
    _setComposing(value) {
      composing = value
    },
    _initialFocus() {
      return core.inputInsidePopup && inputNode ? inputNode : false
    },
  }

  function chipNodes(): HTMLElement[] {
    return [...chips.keys()]
      .filter((node) => node.isConnected)
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
  }

  return core
}

// ---------------------------------------------------------------------------------------------
// Parts

export interface ComboboxPart {
  render(props?: ElementProps): MixInput<HTMLElement, ElementProps>
}

function listEmptyAttrs(core: ComboboxCore) {
  return core.empty ? '' : undefined
}

/**
 * Input behavior: `role="combobox"`, `aria-autocomplete`, `aria-expanded`, `aria-haspopup`,
 * `aria-controls`, `aria-activedescendant` (while open), `autocomplete="off"`, the text
 * (`value`), `disabled` / `readOnly`, and `data-popup-open`, `data-popup-side`,
 * `data-list-empty`, `data-disabled`, `data-readonly`, `data-required`. Typing opens the popup
 * and filters; ArrowDown / ArrowUp open it and move the highlight; Enter presses the highlighted
 * item.
 */
export function createComboboxInput(
  handle: MixinHandle<HTMLElement>,
  core: ComboboxCore,
  extra?: () => ElementProps,
): ComboboxPart {
  handle.addEventListener('insert', (event) => {
    if (event.node instanceof HTMLInputElement) core._setInput(event.node)
  })
  handle.addEventListener('remove', () => core._setInput(null))

  return {
    render(props?: ElementProps) {
      let { popup, listbox } = core
      let open = popup.open
      core._setInputHostId(typeof props?.id === 'string' ? props.id : undefined, handle)
      handle.queueTask((node) => {
        if (node instanceof HTMLInputElement) core._syncInput(node)
      })
      let controls = listbox.hasList || !popup.popupNode ? listbox.listId : popup.popupId
      return [
        attrs({
          ...extra?.(),
          ...core._fieldInputAttrs(),
          role: 'combobox',
          'aria-autocomplete': core.ariaAutocomplete,
          'aria-expanded': open ? 'true' : 'false',
          'aria-haspopup': 'listbox',
          'aria-controls': controls,
          'aria-activedescendant': open ? listbox.highlightedId : undefined,
          autoComplete: 'off',
          autoCapitalize: 'none',
          spellCheck: 'false',
          value: core.displayValue,
          disabled: core.disabled ? true : undefined,
          readOnly: core.readOnly ? true : undefined,
          'data-popup-open': open ? '' : undefined,
          'data-popup-side': open ? popup.side : undefined,
          'data-list-empty': listEmptyAttrs(core),
          'data-disabled': core.disabled ? '' : undefined,
          'data-readonly': core.readOnly ? '' : undefined,
          'data-required': core.required ? '' : undefined,
        }),
        on<HTMLElement, 'input'>('input', (event) => core._onInput(event)),
        on<HTMLElement, 'keydown'>('keydown', (event) => core._onInputKeyDown(event)),
        on<HTMLElement, 'click'>('click', (event) => core._onInputClick(event)),
        on<HTMLElement, 'focusout'>('focusout', (event) => core._onInputFocusOut(event)),
        ...fieldFocusHandlers(core),
        on<HTMLElement, 'compositionstart'>('compositionstart', () => core._setComposing(true)),
        on<HTMLElement, 'compositionend'>('compositionend', () => core._setComposing(false)),
      ]
    },
  }
}

/**
 * Input group behavior (Base UI `InputGroup`): the popup is positioned against it, presses on it
 * don't dismiss the popup, and a press on its empty area focuses the input. Renders
 * `role="group"` and the input's state attributes.
 */
export function createComboboxInputGroup(
  handle: MixinHandle<HTMLElement>,
  core: ComboboxCore,
): ComboboxPart {
  handle.addEventListener('insert', (event) => core._setGroup(event.node))
  handle.addEventListener('remove', () => core._setGroup(null))
  return {
    render() {
      let open = core.popup.open
      return [
        attrs({
          role: 'group',
          ...core._fieldDataAttrs(),
          'data-popup-open': open ? '' : undefined,
          'data-popup-side': open ? core.popup.side : undefined,
          'data-list-empty': listEmptyAttrs(core),
          'data-disabled': core.disabled ? '' : undefined,
          'data-readonly': core.readOnly ? '' : undefined,
          'data-placeholder': core.kind === 'combobox' && !core.hasValue ? '' : undefined,
        }),
        on<HTMLElement, 'mousedown'>('mousedown', (event) => focusInputFromPress(core, event)),
        ...fieldFocusHandlers(core),
      ]
    },
  }
}

/** Reports focus entering and leaving the widget to the field (deduplicated by the core). */
function fieldFocusHandlers(core: ComboboxCore) {
  return [
    on<HTMLElement, 'focusin'>('focusin', () => core._onFieldFocusIn()),
    on<HTMLElement, 'focusout'>('focusout', (event) => core._onFieldFocusOut(event)),
  ]
}

function focusInputFromPress(core: ComboboxCore, event: MouseEvent) {
  let target = event.target
  let input = core.inputNode
  if (!input || !(target instanceof Element) || event.button !== 0) return
  if (target.closest('input, textarea, select, button, a[href], [tabindex]')) return
  event.preventDefault()
  input.focus()
}

export interface ComboboxTriggerOptions {
  /** Ignore user interaction (in addition to the root `disabled`). */
  disabled?: boolean
}

/**
 * Trigger behavior: a button that toggles the popup (`aria-haspopup="listbox"`,
 * `aria-expanded`, `aria-controls`, `data-popup-open`, `data-list-empty`, `data-disabled`,
 * `data-readonly`, `data-required`, `data-placeholder`). With the input outside the popup it
 * keeps focus in the input and is skipped by Tab (`tabIndex={-1}`).
 */
export function createComboboxTrigger(
  handle: MixinHandle<HTMLElement>,
  hostType: string,
  core: ComboboxCore,
) {
  let trigger = createPopupTrigger(handle, hostType, core.popup, { haspopup: 'listbox' })
  return {
    render(options: ComboboxTriggerOptions = {}) {
      let disabled = (options.disabled ?? false) || core.disabled
      let outside = core.inputNode !== null && !core.inputInsidePopup
      return [
        attrs({
          ...core._fieldDataAttrs(),
          tabIndex: outside ? -1 : undefined,
          'data-list-empty': listEmptyAttrs(core),
          'data-readonly': core.readOnly ? '' : undefined,
          'data-required': core.required ? '' : undefined,
          'data-placeholder': core.kind === 'combobox' && !core.hasValue ? '' : undefined,
        }),
        trigger.render({ disabled: disabled || core.readOnly }),
        on<HTMLElement, 'mousedown'>('mousedown', (event) => {
          if (core.inputNode && !core.inputInsidePopup) event.preventDefault()
        }),
        on<HTMLElement, 'click'>('click', () => {
          if (disabled || !core.inputNode || core.inputInsidePopup) return
          core.inputNode.focus()
        }),
        ...fieldFocusHandlers(core),
      ]
    },
  }
}

export interface ComboboxClearOptions {
  /** Ignore user interaction. */
  disabled?: boolean
  /**
   * Keep the button rendered (not `hidden`) while there is nothing to clear.
   * @default false
   */
  keepMounted?: boolean
}

/**
 * Clear button behavior: `type="button"`, `aria-label`-less (label it yourself), `tabIndex={-1}`,
 * `data-visible` while there is a value or text, `hidden` otherwise (unless `keepMounted`),
 * `data-popup-open`, `data-disabled`, and presence attributes. A press clears the value and the
 * text (reason `'clear-press'`) and focuses the input.
 */
export function createComboboxClear(
  handle: MixinHandle<HTMLElement>,
  hostType: string,
  core: ComboboxCore,
) {
  let presence = createPresence(handle, { update: () => core.update() })
  return {
    render(options: ComboboxClearOptions = {}) {
      let visible =
        (core.kind === 'combobox' && core.hasValue) || core.inputValue !== '' ? true : false
      presence.sync(visible)
      let disabled = (options.disabled ?? false) || core.disabled || core.readOnly
      let isButton = hostType === 'button'
      return [
        attrs({
          type: isButton ? 'button' : undefined,
          role: isButton ? undefined : 'button',
          tabIndex: -1,
          disabled: isButton && disabled ? true : undefined,
          'aria-disabled': !isButton && disabled ? 'true' : undefined,
          hidden: options.keepMounted || presence.present ? undefined : true,
          'data-visible': visible ? '' : undefined,
          'data-popup-open': core.popup.open ? '' : undefined,
          'data-disabled': disabled ? '' : undefined,
          ...presence.attrs(),
        }),
        on<HTMLElement, 'mousedown'>('mousedown', (event) => {
          if (core.inputNode && !core.inputInsidePopup) event.preventDefault()
        }),
        on<HTMLElement, 'click'>('click', (event) => {
          if (disabled) return
          core.clear(event)
        }),
        ...fieldFocusHandlers(core),
      ]
    },
  }
}

/** Icon behavior: `aria-hidden`, `data-popup-open`. */
export function createComboboxIcon(core: ComboboxCore): ComboboxPart {
  return {
    render() {
      return attrs({ 'aria-hidden': 'true', 'data-popup-open': core.popup.open ? '' : undefined })
    },
  }
}

/**
 * Popup behavior: the `lib/popup.ts` surface (top layer, positioning against the input group,
 * dismissal, presence) plus `data-empty`. Focus stays in the input (unless the input is inside
 * the popup); pressing the popup's background doesn't blur the input.
 */
export function createComboboxPopup(handle: MixinHandle<HTMLElement>, core: ComboboxCore) {
  let surface = createPopupSurface(handle, core.popup)
  let initialFocus = (type: PopupInteractionType | null) => core._initialFocus(type)
  // Return focus to the input, or to the trigger when the input is inside the popup.
  let finalFocus = () => (core.inputNode && !core.inputInsidePopup ? core.inputNode : true)

  handle.addEventListener('insert', () => {
    // Without a list part the popup is the listbox: point the input at it.
    handle.queueTask(() => {
      if (!core.listbox.hasList) void core.update()
    })
  })

  return {
    render(options: PopupSurfaceOptions, props: ElementProps) {
      let listbox = core.listbox
      let isList = !listbox.hasList && core.popup.popupNode !== null
      return [
        attrs({
          role: isList ? 'listbox' : undefined,
          'aria-multiselectable': isList && core.multiple ? 'true' : undefined,
          'data-empty': core.empty ? '' : undefined,
        }),
        surface.render(
          {
            ...options,
            anchor: options.anchor ?? (() => core.anchor()),
            initialFocus: options.initialFocus ?? initialFocus,
            finalFocus: options.finalFocus ?? finalFocus,
          },
          props,
        ),
        on<HTMLElement, 'mousedown'>('mousedown', (event) => {
          if (!core.inputNode || core.inputInsidePopup) return
          let target = event.target
          if (target instanceof Element && target.closest('input, textarea, select, button')) {
            return
          }
          event.preventDefault()
        }),
        ...fieldFocusHandlers(core),
      ]
    },
  }
}

/** List behavior: `role="listbox"`, `id`, `aria-multiselectable`, `data-empty`. */
export function createComboboxList(handle: MixinHandle<HTMLElement>, core: ComboboxCore) {
  let list = createListboxList(handle, core.listbox)
  return {
    render(props: ElementProps) {
      return [attrs({ 'data-empty': core.empty ? '' : undefined }), list.render(props)]
    },
  }
}

/**
 * Empty-state behavior (Base UI `Empty`): a polite live region (`role="status"`,
 * `aria-live="polite"`, `aria-atomic`), with `data-empty` while nothing matches. It stays
 * rendered so announcements work: render its content only while empty (the widget's `EmptyText`
 * does that).
 */
export function createComboboxEmpty(core: ComboboxCore): ComboboxPart {
  return {
    render() {
      return attrs({
        role: 'status',
        'aria-live': 'polite',
        'aria-atomic': 'true',
        'data-empty': core.empty ? '' : undefined,
      })
    },
  }
}

/** Status behavior (Base UI `Status`): a polite live region for loading / result counts. */
export function createComboboxStatus(): ComboboxPart {
  return {
    render() {
      return attrs({ role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' })
    },
  }
}

export interface ComboboxItemPartOptions {
  value: unknown
  label?: string
  disabled?: boolean
}

/**
 * Item behavior: the `lib/listbox.ts` option (`role="option"`, `aria-selected`,
 * `data-selected`, `data-highlighted`, `data-disabled`), hidden while it doesn't match the
 * query. A press (or Enter while highlighted) activates it.
 */
export function createComboboxItem(
  handle: MixinHandle<HTMLElement>,
  hostType: string,
  core: ComboboxCore,
) {
  // Registered before the listbox item's own listener, which clears the highlight silently.
  let node: HTMLElement | null = null
  handle.addEventListener('insert', (event) => (node = event.node))
  handle.addEventListener('remove', () => {
    // A highlighted item that unmounts (e.g. filtered out of a Collection): drop its id from
    // `aria-activedescendant`.
    if (node && core.listbox.highlighted === node) queueMicrotask(() => void core.update())
    node = null
  })
  let item = createListboxItem(handle, hostType, core.listbox, {
    onActivate: (entry, event) => core.activate(entry, event),
  })
  let labelPending = true
  return {
    render(options: ComboboxItemPartOptions, props: ElementProps) {
      let label = options.label ?? item.entry?.label()
      if (labelPending && options.label === undefined && item.entry === null) {
        // The text label is only known once inserted: filter again then.
        labelPending = false
        handle.queueTask(() => {
          if (core.query !== '') void core.update()
        })
      }
      let visible = core.isItemVisible(options.value, label)
      return [attrs({ hidden: visible ? undefined : true }), item.render(options, props)]
    },
  }
}

/**
 * Group behavior: `role="group"` labelled by its group label; hidden while none of its items
 * match the query.
 */
export function createComboboxGroup(handle: MixinHandle<HTMLElement>) {
  let hiddenByFilter = false
  return {
    render() {
      handle.queueTask((node) => {
        let options = node.querySelectorAll<HTMLElement>('[role="option"]')
        let empty = options.length > 0 && [...options].every((option) => option.hidden)
        if (empty === hiddenByFilter) return
        hiddenByFilter = empty
        node.hidden = empty
      })
      return attrs({ role: 'group' })
    },
  }
}

/**
 * Chips container behavior (Base UI `Chips`): presses on its empty area focus the input and
 * don't dismiss the popup; the popup is positioned against it when there is no input group.
 */
export function createComboboxChips(handle: MixinHandle<HTMLElement>, core: ComboboxCore) {
  handle.addEventListener('insert', (event) => core._setChips(event.node))
  handle.addEventListener('remove', () => core._setChips(null))
  return {
    render() {
      return [
        on<HTMLElement, 'mousedown'>('mousedown', (event) => focusInputFromPress(core, event)),
        ...fieldFocusHandlers(core),
      ]
    },
  }
}

export interface ComboboxChipPartOptions {
  /** The selected value this chip shows. */
  value: unknown
  disabled?: boolean
}

/**
 * Chip behavior: focusable (`tabIndex={-1}`), `data-disabled`. ArrowLeft / ArrowRight move
 * between chips (and back to the input), Backspace / Delete remove the chip, typing returns to
 * the input.
 */
export function createComboboxChip(handle: MixinHandle<HTMLElement>, core: ComboboxCore) {
  let options: ComboboxChipPartOptions = { value: null }
  handle.addEventListener('insert', (event) => {
    let unregister = core._registerChip(
      event.node,
      () => options.value,
      () => (options.disabled ?? false) || core.disabled || core.readOnly,
    )
    handle.signal.addEventListener('abort', unregister)
  })
  return {
    render(next: ComboboxChipPartOptions) {
      options = next
      let disabled = (next.disabled ?? false) || core.disabled
      return [
        attrs({ tabIndex: -1, 'data-disabled': disabled ? '' : undefined }),
        on<HTMLElement, 'keydown'>('keydown', (event) => {
          if (event.currentTarget === event.target) core._onChipKeyDown(event, event.currentTarget)
        }),
      ]
    },
  }
}

export interface ComboboxChipRemoveOptions {
  /** The value to remove. Defaults to the value of the enclosing `chip()`. */
  value?: unknown
  disabled?: boolean
}

/**
 * Chip remove button behavior: `type="button"`, `tabIndex={-1}`, `data-disabled`. A press
 * removes the chip's value (reason `'chip-remove-press'`) and focuses the input.
 */
export function createComboboxChipRemove(hostType: string, core: ComboboxCore) {
  let isButton = hostType === 'button'
  return {
    render(options: ComboboxChipRemoveOptions = {}) {
      let disabled = (options.disabled ?? false) || core.disabled || core.readOnly
      return [
        attrs({
          type: isButton ? 'button' : undefined,
          role: isButton ? undefined : 'button',
          tabIndex: -1,
          disabled: isButton && disabled ? true : undefined,
          'aria-disabled': !isButton && disabled ? 'true' : undefined,
          'data-disabled': disabled ? '' : undefined,
        }),
        on<HTMLElement, 'mousedown'>('mousedown', (event) => {
          if (core.inputNode) event.preventDefault()
        }),
        on<HTMLElement, 'click'>('click', (event) => {
          if (disabled) return
          let value =
            'value' in options ? options.value : core._chipValue(event.currentTarget)?.value
          if (value === undefined) return
          event.stopPropagation()
          core.removeValue(value, event)
          core.inputNode?.focus()
        }),
      ]
    },
  }
}
