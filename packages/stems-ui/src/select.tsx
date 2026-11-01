// Adapted from @remix-run/ui 0.13.0 (packages/ui/src/select.tsx).
// https://github.com/remix-run/remix - Copyright (c) 2025 Shopify Inc. MIT License.

/**
 * `stems-ui/select`: Base UI's Select as a `Context` provider plus mixins, built on
 * `lib/popup.ts` (open state, top-layer popup, dismissal, positioning) and `lib/listbox.ts`
 * (value, options, highlight, keyboard, typeahead).
 *
 * Options use real DOM focus (roving `tabIndex={-1}`); `data-highlighted` follows focus and the
 * pointer. The provider renders the form input(s) itself, after its children.
 */

import { attrs, createMixin, on, ref } from '@remix-run/component'
import type {
  Dispatched,
  ElementProps,
  Handle,
  MixinFactory,
  MixinHandle,
  RemixNode,
} from '@remix-run/component'

import { separator as separatorMixin } from './separator.ts'
import { splitOptions } from './lib/collapsible-panel.ts'
import { connectFieldControl, type FieldControlRenderResult } from './lib/field-control.ts'
import {
  createListboxGroup,
  createListboxGroupLabel,
  createListboxItem,
  createListboxList,
  createListboxStore,
  markItemText,
} from './lib/listbox.ts'
import type {
  ListboxItemEntry,
  ListboxStore,
  ListboxValueChangeDetails,
  ListboxValueChangeReason,
} from './lib/listbox.ts'
import {
  createPopupArrow,
  createPopupBackdrop,
  createPopupStore,
  createPopupSurface,
  createPopupTrigger,
} from './lib/popup.ts'
import type {
  PopupAlignItem,
  PopupChangeRequest,
  PopupInteractionType,
  PopupOpenChangeReason,
  PopupStateProps,
  PopupStore,
  PopupSurfaceOptions,
} from './lib/popup.ts'
import { createPresence } from './lib/presence.ts'
import { getTabbableElements } from './lib/tabbable.ts'
import { matchNextItemBySearchText } from './lib/typeahead.ts'

export type {
  PopupAlign as SelectAlign,
  PopupAnchor as SelectAnchor,
  PopupFocusTarget as SelectFocusTarget,
  PopupInteractionType as SelectInteractionType,
  PopupOffsetFunction as SelectOffsetFunction,
  PopupOpenChangeDetails as SelectOpenChangeDetails,
  PopupOpenChangeReason as SelectOpenChangeReason,
  PopupSide as SelectSide,
} from './lib/popup.ts'

export type {
  ListboxValueChangeDetails as SelectValueChangeDetails,
  ListboxValueChangeReason as SelectValueChangeReason,
} from './lib/listbox.ts'

// ---------------------------------------------------------------------------------------------
// Events

const SELECT_CHANGE_EVENT = 'stems:select-change' as const
const SELECT_OPEN_CHANGE_EVENT = 'stems:select-open-change' as const

declare global {
  interface HTMLElementEventMap {
    [SELECT_CHANGE_EVENT]: SelectChangeEvent
    [SELECT_OPEN_CHANGE_EVENT]: SelectOpenChangeEvent
  }
}

/** Bubbling event dispatched from the trigger when the value changes. */
export class SelectChangeEvent extends Event {
  /** The new value (an array when `multiple`). */
  readonly value: unknown
  readonly reason: ListboxValueChangeReason

  constructor(value: unknown, reason: ListboxValueChangeReason) {
    super(SELECT_CHANGE_EVENT, { bubbles: true })
    this.value = value
    this.reason = reason
  }
}

/** Bubbling event dispatched from the trigger when the popup opens or closes. */
export class SelectOpenChangeEvent extends Event {
  readonly open: boolean
  readonly reason: PopupOpenChangeReason

  constructor(open: boolean, reason: PopupOpenChangeReason) {
    super(SELECT_OPEN_CHANGE_EVENT, { bubbles: true })
    this.open = open
    this.reason = reason
  }
}

/** Listens for the bubbling `stems:select-change` event. */
export function onSelectChange<target extends HTMLElement>(
  handler: (
    event: Dispatched<SelectChangeEvent, target>,
    signal: AbortSignal,
  ) => void | Promise<void>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof SELECT_CHANGE_EVENT>> {
  return on(SELECT_CHANGE_EVENT, handler, captureBoolean)
}

/** Listens for the bubbling `stems:select-open-change` event. */
export function onSelectOpenChange<target extends HTMLElement>(
  handler: (
    event: Dispatched<SelectOpenChangeEvent, target>,
    signal: AbortSignal,
  ) => void | Promise<void>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof SELECT_OPEN_CHANGE_EVENT>> {
  return on(SELECT_OPEN_CHANGE_EVENT, handler, captureBoolean)
}

// ---------------------------------------------------------------------------------------------
// Props and options

/** One entry of the `items` prop. */
export interface SelectItemData {
  value: unknown
  label: RemixNode
}

/**
 * Base UI's `items`: a `{ value: label }` record, an array of `{ value, label }`, or an array of
 * groups (`{ items: [...] }`). Used to render the selected label (also on the server).
 */
export type SelectItems =
  | Record<string, RemixNode>
  | ReadonlyArray<SelectItemData>
  | ReadonlyArray<{ items: ReadonlyArray<SelectItemData> }>

/** Props of `select.Context` (Base UI `Select.Root`). */
export interface SelectContextProps extends PopupStateProps {
  /** The selected value (controlled): a value or `null`, or an array when `multiple`. */
  value?: unknown
  /** The initially selected value (uncontrolled). */
  defaultValue?: unknown
  /** Called with the next value and the change details. Call `details.cancel()` to veto. */
  onValueChange?: (value: any, details: ListboxValueChangeDetails) => void
  /**
   * Whether multiple items can be selected. The value is then an array, and the popup stays
   * open when an item is toggled.
   * @default false
   */
  multiple?: boolean
  /** Identifies the field when a form is submitted. An enclosing `field.Context`'s `name` wins. */
  name?: string
  /** The id of the `<form>` that owns the input(s), when the select is rendered outside it. */
  form?: string
  /** The autofill hint for the input. */
  autoComplete?: string
  /**
   * Whether a value must be chosen before submitting the form (native constraint validation).
   * @default false
   */
  required?: boolean
  /**
   * Ignore user interaction. An enclosing `<field.Context disabled>` or
   * `<fieldset.Context disabled>` also disables the select.
   * @default false
   */
  disabled?: boolean
  /** The user can't open the popup or change the value. @default false */
  readOnly?: boolean
  /**
   * While open: lock page scroll, make outside content inert, and keep focus in the popup.
   * @default true
   */
  modal?: PopupStateProps['modal']
  /**
   * Highlight items as the pointer moves over them.
   * @default true
   */
  highlightItemOnHover?: boolean
  /**
   * Stems extra: loop keyboard navigation from the last item to the first (and back).
   * @default false
   */
  loopFocus?: boolean
  /** Compares an item's value with a selected value. @default Object.is */
  isItemEqualToValue?: (itemValue: any, value: any) => boolean
  /** Converts a value to the text shown by `ValueText`. */
  itemToStringLabel?: (value: any) => string
  /** Converts a value to the string submitted with the form. */
  itemToStringValue?: (value: any) => string
  /** The items, used to look up the label of the selected value(s). */
  items?: SelectItems
  /** Called when the highlighted item changes (`undefined` when nothing is highlighted). */
  onItemHighlighted?: (
    value: unknown,
    details: { reason: string; event: Event | undefined },
  ) => void
  children?: RemixNode
}

/** Trigger options. */
export interface SelectTriggerOptions {
  /** Ignore user interaction (in addition to the root `disabled`). */
  disabled?: boolean
}

/**
 * Popup options: Base UI's Positioner props plus Popup's `initialFocus` / `finalFocus`, and
 * `alignItemWithTrigger`.
 */
export interface SelectPopupOptions extends Omit<
  PopupSurfaceOptions,
  'inset' | 'relativeTo' | 'alignItem'
> {
  /**
   * Overlap the trigger so the selected item lines up with the value text (`data-side="none"`).
   * Turned off automatically when opened by touch or when the trigger is within 20px of the top
   * or bottom of the viewport.
   * @default true
   */
  alignItemWithTrigger?: boolean
}

export interface SelectItemOptions {
  /** The item's value (defaults to the enclosing `ItemContext`'s value, else `null`). */
  value?: unknown
  /** Text used by typeahead and as the label. Defaults to the item text or text content. */
  label?: string
  /** Ignore user interaction. */
  disabled?: boolean
}

export interface SelectItemIndicatorOptions {
  /**
   * Keep the indicator visible while the item isn't selected.
   * @default false
   */
  keepMounted?: boolean
}

export interface SelectScrollArrowOptions {
  /**
   * Keep the arrow rendered while it can't scroll in its direction.
   * @default false
   */
  keepMounted?: boolean
}

export interface SelectItemContextProps {
  /** The item's value. */
  value: unknown
  /** Text used by typeahead and as the label. */
  label?: string
  /** Ignore user interaction. */
  disabled?: boolean
  children?: RemixNode
}

// ---------------------------------------------------------------------------------------------
// Select state

type PendingFocus = 'first' | 'last' | null

/** Shared select state, read with `handle.context.get(select.Context)`. */
export interface SelectContextValue {
  /** The `lib/popup.ts` store: open state, reasons, ids, placement. */
  readonly store: PopupStore
  /** The `lib/listbox.ts` store: value, items, highlight. */
  readonly listbox: ListboxStore
  readonly open: boolean
  /** The value: a value or `null`, or an array when `multiple`. */
  readonly value: unknown
  readonly selectedValues: readonly unknown[]
  readonly hasValue: boolean
  readonly multiple: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly required: boolean
  /** The label for `value`: `items`, `itemToStringLabel`, a registered item, or the string. */
  labelOf(value: unknown): RemixNode
  /** The string submitted for `value` (`itemToStringValue`, `value.value`, or `String`). */
  stringValue(value: unknown): string
  /** The label shown for a `null` item in `items`, if any. */
  readonly nullLabel: RemixNode | undefined
  /** Requests a value change. Returns whether it was accepted. */
  setValue(value: unknown, request?: { reason?: ListboxValueChangeReason; event?: Event }): boolean
  /** Requests an open-state change (see `PopupStore.setOpen`). */
  setOpen(open: boolean, request: PopupChangeRequest): boolean
  /** @internal */
  readonly _triggerNode: HTMLElement | null
  /** @internal */
  readonly _triggerId: string | undefined
  /** @internal */
  readonly _labelId: string | undefined
  /** @internal */
  readonly _valueNode: HTMLElement | null
  /** @internal */
  _setTrigger(node: HTMLElement | null, id?: string): void
  /** @internal The trigger's own `id` prop (`undefined` for none). Call while rendering. */
  _setTriggerHostId(id: string | undefined, from: MixinHandle<HTMLElement>): void
  /** @internal */
  _setLabelId(id: string | undefined): void
  /** @internal */
  _setValueNode(node: HTMLElement | null): void
  /** @internal */
  _setPendingFocus(focus: PendingFocus): void
  /** @internal */
  _initialFocus(type: PopupInteractionType | null): HTMLElement | null | undefined
  /** @internal */
  _activate(entry: ListboxItemEntry, event: Event): void
  /** @internal */
  _onPopupKeyDown(event: KeyboardEvent): void
  /** @internal */
  _alignItem(enabled: boolean): PopupAlignItem | null
  /** @internal The field wiring from the provider's last render. */
  _field(): FieldControlRenderResult
  /** @internal The trigger or the popup received focus. */
  _fieldFocus(): void
  /** @internal The trigger or the popup lost focus to `related`. */
  _fieldBlur(related: EventTarget | null): void
  /** @internal */
  update(): Promise<unknown>
}

const VISUALLY_HIDDEN = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  margin: '-1px',
  padding: '0',
  border: '0',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  opacity: '0',
} as const

function lookupItems(
  items: SelectItems | undefined,
  value: unknown,
  isEqual: ListboxStore['isEqual'],
) {
  if (!items) return undefined
  if (!Array.isArray(items)) {
    if (value == null) return undefined
    let record = items as Record<string, RemixNode>
    let key = String(value)
    return Object.prototype.hasOwnProperty.call(record, key) ? { label: record[key] } : undefined
  }
  for (let entry of items as ReadonlyArray<Record<string, unknown>>) {
    if (Array.isArray(entry.items)) {
      for (let item of entry.items as SelectItemData[]) {
        if (isEqual(item.value, value)) return item
      }
    } else if ('value' in entry && isEqual(entry.value, value)) {
      return entry as unknown as SelectItemData
    }
  }
  return undefined
}

function SelectProvider(handle: Handle<SelectContextProps, SelectContextValue>): () => RemixNode {
  let triggerNode: HTMLElement | null = null
  let triggerId: string | undefined
  // The trigger's own `id` prop, which becomes the field's control id.
  let triggerHostId: string | undefined
  let labelId: string | undefined
  let valueNode: HTMLElement | null = null
  let pendingFocus: PendingFocus = null
  let alignActive = false
  let alignSelector: string | null = null
  let wasOpen = false
  let context: SelectContextValue
  let hiddenInput: HTMLInputElement | null = null
  let focusWithin = false
  // A value change being reported to the field, before a controlled owner re-rendered.
  let pendingChange: { value: unknown } | undefined
  // Inside a <field.Context>, the select is the field's control: the visually hidden input is
  // its validity element (`required`), the trigger is focused when it blocks a submission.
  let fieldControl = connectFieldControl(handle, {
    getValue: () => (pendingChange ? pendingChange.value : listbox.value),
    getValidityElement: () => hiddenInput,
    getFocusElement: () => store.activeTrigger ?? triggerNode,
    isFilled: (value) => (Array.isArray(value) ? value.length > 0 : value != null),
  })
  // Set by every render, before the parts inside render.
  let fieldState: FieldControlRenderResult | undefined

  function isDisabled() {
    return fieldState?.disabled ?? handle.props.disabled === true
  }

  function hiddenValue(value: unknown): string {
    let values = handle.props.multiple
      ? Array.isArray(value)
        ? value
        : []
      : value == null
        ? []
        : [value]
    let strings = values.map(stringValue)
    return handle.props.multiple ? strings.join(',') : (strings[0] ?? '')
  }

  /** Reports an accepted value change to the field. */
  function reportChange(value: unknown, event: Event | undefined) {
    // The hidden input re-renders later; validation reads its validity now.
    if (hiddenInput) hiddenInput.value = hiddenValue(value)
    pendingChange = { value }
    try {
      fieldControl.change(value, event)
    } finally {
      pendingChange = undefined
    }
  }

  let store = createPopupStore({
    id: handle.id,
    getProps: () => ({
      open: handle.props.open,
      defaultOpen: handle.props.defaultOpen,
      onOpenChange: handle.props.onOpenChange,
      onOpenChangeComplete: handle.props.onOpenChangeComplete,
      modal: handle.props.modal ?? true,
    }),
    update: () => handle.update(),
    signal: handle.signal,
    createChangeEvent: (open, details) => new SelectOpenChangeEvent(open, details.reason),
  })

  // Every open request (trigger, keyboard, controlled owners) goes through here.
  let baseSetOpen = store.setOpen
  store.setOpen = (open, request) => {
    if (open && (isDisabled() || handle.props.readOnly)) return false
    return baseSetOpen(open, request)
  }

  let listbox = createListboxStore({
    id: handle.id,
    getProps: () => ({
      value: handle.props.value,
      defaultValue: handle.props.defaultValue,
      onValueChange: handle.props.onValueChange,
      multiple: handle.props.multiple,
      disabled: isDisabled(),
      readOnly: handle.props.readOnly,
      loopFocus: handle.props.loopFocus ?? false,
      highlightItemOnHover: handle.props.highlightItemOnHover,
      isItemEqualToValue: handle.props.isItemEqualToValue,
      onItemHighlighted: handle.props.onItemHighlighted,
    }),
    update: () => handle.update(),
    focusMode: 'roving',
    getContainer: () => store.popupNode,
    // Called once a change was accepted (not cancelled by `onValueChange`).
    createChangeEvent: (value, details) => {
      reportChange(value, details.event)
      return new SelectChangeEvent(value, details.reason)
    },
    getEventTarget: () => store.activeTrigger ?? triggerNode,
  })

  function labelOf(value: unknown): RemixNode {
    let props = handle.props
    let fromItems = lookupItems(props.items, value, listbox.isEqual)
    if (fromItems) return fromItems.label
    if (value == null) return ''
    if (props.itemToStringLabel) return props.itemToStringLabel(value)
    let registered = listbox.labelOf(value)
    if (registered !== undefined && registered !== '') return registered
    if (typeof value === 'object' && 'label' in value) return String(value.label)
    return String(value)
  }

  function stringValue(value: unknown): string {
    if (value == null) return ''
    if (handle.props.itemToStringValue) return handle.props.itemToStringValue(value)
    if (typeof value === 'object' && 'value' in value) return String(value.value)
    return String(value)
  }

  function computeAlign(): boolean {
    if (store.interactionType === 'touch') return false
    let trigger = store.activeTrigger ?? triggerNode
    if (!trigger) return false
    let rect = trigger.getBoundingClientRect()
    let view = trigger.ownerDocument.defaultView
    if (!view) return false
    return rect.top >= 20 && rect.bottom <= view.innerHeight - 20
  }

  function focusTrigger() {
    ;(store.activeTrigger ?? triggerNode)?.focus()
  }

  function tabOut(event: KeyboardEvent) {
    let trigger = store.activeTrigger ?? triggerNode
    let backwards = event.shiftKey
    store._setInteractionType('keyboard')
    store.setOpen(false, { reason: 'focus-out', event })
    void store.update().then(() => {
      if (store.open || !trigger?.isConnected) return
      let tabbables = getTabbableElements(trigger.ownerDocument.body)
      let index = tabbables.indexOf(trigger)
      let target = backwards || index === -1 ? null : tabbables[index + 1]
      ;(target ?? trigger).focus()
    })
  }

  context = {
    store,
    listbox,
    get open() {
      return store.open
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
    get multiple() {
      return handle.props.multiple ?? false
    },
    get disabled() {
      return isDisabled()
    },
    get readOnly() {
      return handle.props.readOnly ?? false
    },
    get required() {
      return handle.props.required ?? false
    },
    get nullLabel() {
      return lookupItems(handle.props.items, null, (a, b) => a == null && b == null)?.label
    },
    labelOf,
    stringValue,
    setValue: (value, request) => listbox.setValue(value, request),
    setOpen: (open, request) => store.setOpen(open, request),
    get _triggerNode() {
      return triggerNode
    },
    get _triggerId() {
      return triggerId
    },
    get _labelId() {
      return labelId
    },
    get _valueNode() {
      return valueNode
    },
    _setTrigger(node, id) {
      triggerNode = node
      triggerId = id
    },
    _setTriggerHostId(id, from) {
      if (id === triggerHostId) return
      triggerHostId = id
      // The field's control id (and the label's `for`) follow on the next render.
      from.queueTask(() => void handle.update())
    },
    _setLabelId(id) {
      if (labelId === id) return
      labelId = id
      handle.queueTask(() => void handle.update())
    },
    _setValueNode(node) {
      valueNode = node
    },
    _setPendingFocus(focus) {
      pendingFocus = focus
    },
    _initialFocus(type) {
      let edge = pendingFocus
      pendingFocus = null
      let selected = listbox.selectedItem()
      let target: HTMLElement | null | undefined
      if (selected) {
        target = selected.node
      } else if (type === 'keyboard') {
        let enabled = listbox.items({ enabledOnly: true })
        target = (edge === 'last' ? enabled.at(-1) : enabled[0])?.node
      }
      if (target && !alignActive) {
        // The popup is positioned below the trigger: bring the item into view.
        let node = target
        queueMicrotask(() => node.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }))
      }
      return target ?? listbox.listNode ?? store.popupNode
    },
    _activate(entry, event) {
      if (context.multiple) {
        listbox.selectItem(entry.value, { reason: 'item-press', event })
        return
      }
      listbox.selectItem(entry.value, { reason: 'item-press', event })
      let keyboard = event instanceof KeyboardEvent || (event as MouseEvent).detail === 0
      store._setInteractionType(keyboard ? 'keyboard' : 'mouse')
      store.setOpen(false, { reason: 'item-press', event })
    },
    _onPopupKeyDown(event) {
      let popup = store.popupNode
      if (!popup || !(event.target instanceof Node) || !popup.contains(event.target)) return
      if (event.defaultPrevented) return
      if (event.key === 'Tab') {
        // Base UI: Tab closes the popup and moves on from the trigger.
        event.preventDefault()
        tabOut(event)
        return
      }
      listbox.onKeyDown(event, {
        onActivate: (entry, keyEvent) => context._activate(entry, keyEvent),
      })
    },
    _alignItem(enabled) {
      if (!enabled || !alignActive || !alignSelector) return null
      return { selector: alignSelector, textNode: valueNode }
    },
    _field() {
      return fieldState!
    },
    _fieldFocus() {
      if (focusWithin) return
      focusWithin = true
      fieldControl.focus()
    },
    _fieldBlur(related) {
      // Focus moving between the trigger and the popup stays inside the control.
      let inside = [store.activeTrigger ?? triggerNode, store.popupNode]
      if (related instanceof Node && inside.some((node) => node?.contains(related))) return
      if (!focusWithin) return
      focusWithin = false
      fieldControl.blur()
    },
    update: () => handle.update(),
  }

  handle.context.set(context)

  return () => {
    store.sync()
    let open = store.open
    if (open && !wasOpen) {
      // Decide the item-aligned mode once per opening, so toggling items doesn't move it.
      alignActive = computeAlign()
      let selected = listbox.selectedItem()
      alignSelector = selected ? `[id="${selected.id}"]` : '[role="option"]'
    }
    if (!open) {
      listbox.reset()
      pendingFocus = null
    }
    wasOpen = open

    let { form, autoComplete, required, multiple } = handle.props
    let f = (fieldState = fieldControl.render({
      value: listbox.value,
      id: triggerHostId,
      disabled: handle.props.disabled === true,
      name: handle.props.name,
    }))
    let name = f.name
    let disabled = f.disabled
    let values = listbox.selectedValues
    let strings = values.map(stringValue)

    return (
      <>
        {handle.props.children}
        <input
          aria-hidden="true"
          tabIndex={-1}
          name={multiple ? undefined : name}
          value={multiple ? strings.join(',') : (strings[0] ?? '')}
          form={form}
          autoComplete={autoComplete}
          required={required ? true : undefined}
          disabled={disabled ? true : undefined}
          style={VISUALLY_HIDDEN}
          mix={[
            on<HTMLInputElement, 'focus'>('focus', focusTrigger),
            ref((node: HTMLInputElement, signal) => {
              hiddenInput = node
              signal.addEventListener('abort', () => {
                if (hiddenInput === node) hiddenInput = null
              })
            }),
          ]}
        />
        {multiple && name
          ? strings.map((value) => (
              <input
                type="hidden"
                name={name}
                value={value}
                form={form}
                disabled={disabled ? true : undefined}
              />
            ))
          : null}
      </>
    )
  }
}

function getSelect(handle: MixinHandle<HTMLElement> | Handle<any, any>): SelectContextValue {
  return handle.context.get(SelectProvider) as SelectContextValue
}

// ---------------------------------------------------------------------------------------------
// Label, trigger, value, icon

const labelMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let select = getSelect(handle)
  handle.signal.addEventListener('abort', () => select._setLabelId(undefined))
  return (props) => {
    let id = typeof props.id === 'string' ? props.id : handle.id
    select._setLabelId(id)
    return [
      attrs({ id, 'data-disabled': select.disabled ? '' : undefined }),
      on<HTMLElement, 'click'>('click', () => {
        // Base UI: a press on the label focuses the trigger without opening the popup.
        select._triggerNode?.focus()
      }),
    ]
  }
})

const TYPEAHEAD_TIMEOUT = 750

const triggerMixin: MixinFactory<HTMLElement, [options?: SelectTriggerOptions], ElementProps> =
  createMixin<HTMLElement, [options?: SelectTriggerOptions], ElementProps>((handle, hostType) => {
    let select = getSelect(handle)
    let store = select.store
    let listbox = select.listbox
    let popupTrigger = createPopupTrigger(handle, hostType, store, { haspopup: 'listbox' })
    let typed = ''
    let typedTimer = 0
    let swallowSpaceUp = false
    let disabled = false
    let id = handle.id

    handle.addEventListener('insert', (event) => select._setTrigger(event.node, id))
    handle.addEventListener('remove', () => {
      clearTimeout(typedTimer)
      select._setTrigger(null)
    })

    function open(event: KeyboardEvent, edge: PendingFocus) {
      store.hover.cancel()
      store._setInteractionType('keyboard')
      select._setPendingFocus(edge)
      store.setOpen(true, { reason: 'trigger-press', event, trigger: popupTrigger.node })
    }

    // Typing on the closed trigger selects the next matching item (single selection only).
    function typeahead(char: string, event: KeyboardEvent) {
      clearTimeout(typedTimer)
      typed += char.toLowerCase()
      typedTimer = window.setTimeout(() => (typed = ''), TYPEAHEAD_TIMEOUT)
      let list = listbox.items({ enabledOnly: true })
      let current = list.findIndex((entry) => listbox.isSelected(entry.value))
      let repeated = typed.length > 1 && [...typed].every((c) => c === typed[0])
      let text = repeated ? typed[0] : typed
      let fromIndex = typed.length > 1 && !repeated ? current - 1 : current
      let match = matchNextItemBySearchText(text, list, {
        fromIndex,
        getSearchValues: (entry) => entry.label(),
      })
      if (match && !listbox.isSelected(match.value)) {
        listbox.selectItem(match.value, { reason: 'list-navigation', event })
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (disabled || select.disabled || select.readOnly || event.defaultPrevented) return
      let key = event.key
      if (key === 'ArrowDown' || key === 'ArrowUp') {
        event.preventDefault()
        if (!store.open) open(event, key === 'ArrowDown' ? 'first' : 'last')
        return
      }
      if (store.open || select.multiple) return
      if (key === ' ' && typed !== '') {
        // Space continues a typeahead search instead of opening the popup.
        event.preventDefault()
        swallowSpaceUp = true
        typeahead(key, event)
        return
      }
      if (key.length === 1 && key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        typeahead(key, event)
      }
    }

    return (options, props) => {
      ;[options, props] = splitOptions(options, props)
      disabled = (options?.disabled ?? false) || select.disabled
      let hostId = typeof props.id === 'string' ? props.id : undefined
      select._setTriggerHostId(hostId, handle)
      let f = select._field()
      // Inside a field, the trigger is the labelable control: `<label for>` targets it.
      id = hostId ?? (f.inField && f.id ? f.id : handle.id)
      select._setTrigger(popupTrigger.node, id)
      let open = store.open && store.isActiveTrigger(popupTrigger.entry)
      let placeholder = !select.hasValue
      let controls = listbox.hasList || !store.popupNode ? listbox.listId : store.popupId
      let { 'data-disabled': _disabled, ...fieldData } = f.dataAttrs
      return [
        attrs({
          id,
          role: 'combobox',
          'aria-controls': controls,
          'aria-labelledby': select._labelId ?? f.labelId,
          'aria-describedby': f.describedBy,
          'aria-invalid': f.invalid ? 'true' : undefined,
          ...fieldData,
          'aria-required': select.required ? 'true' : undefined,
          'aria-readonly': select.readOnly ? 'true' : undefined,
          'aria-autocomplete': 'none',
          'data-pressed': open ? '' : undefined,
          'data-placeholder': placeholder ? '' : undefined,
          'data-readonly': select.readOnly ? '' : undefined,
          'data-required': select.required ? '' : undefined,
        }),
        popupTrigger.render({ disabled }),
        on<HTMLElement, 'keydown'>('keydown', onKeyDown),
        on<HTMLElement, 'keyup'>('keyup', (event) => {
          if (event.key === ' ' && swallowSpaceUp) {
            swallowSpaceUp = false
            event.preventDefault()
          }
        }),
        on<HTMLElement, 'focusout'>('focusout', () => {
          clearTimeout(typedTimer)
          typed = ''
        }),
        on<HTMLElement, 'focus'>('focus', () => select._fieldFocus()),
        on<HTMLElement, 'blur'>('blur', (event) => select._fieldBlur(event.relatedTarget)),
      ]
    }
  })

const valueMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let select = getSelect(handle)
  handle.addEventListener('insert', (event) => select._setValueNode(event.node))
  handle.addEventListener('remove', () => select._setValueNode(null))
  return () => attrs({ 'data-placeholder': select.hasValue ? undefined : '' })
})

export interface SelectValueTextProps {
  /** Shown while no value is selected (Base UI `Value`'s `placeholder`). */
  placeholder?: RemixNode
  /**
   * Custom rendering of the value (an array when `multiple`). Overrides the label and the
   * placeholder.
   */
  children?: (value: any) => RemixNode
}

/**
 * Renders the selected item's label (or `placeholder`) as text, with no element of its own. Put
 * it inside the host that has `value()`: `<span mix={select.value()}><select.ValueText /></span>`.
 * Multiple values render as a comma-separated list.
 */
export function ValueText(handle: Handle<SelectValueTextProps>): () => RemixNode {
  let select = getSelect(handle)
  return () => {
    let { children, placeholder } = handle.props
    if (children) return children(select.value)
    if (!select.hasValue) return placeholder ?? select.nullLabel ?? ''
    let labels = select.selectedValues.map((value) => select.labelOf(value))
    if (labels.length === 1) return labels[0]
    let result: RemixNode[] = []
    labels.forEach((label, index) => {
      if (index > 0) result.push(', ')
      result.push(label)
    })
    return result
  }
}

const iconMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let select = getSelect(handle)
  return () =>
    attrs({
      'aria-hidden': 'true',
      'data-popup-open': select.open ? '' : undefined,
    })
})

// ---------------------------------------------------------------------------------------------
// Popup, list, arrow, backdrop

const popupMixin: MixinFactory<HTMLElement, [options?: SelectPopupOptions], ElementProps> =
  createMixin<HTMLElement, [options?: SelectPopupOptions], ElementProps>((handle) => {
    let select = getSelect(handle)
    let surface = createPopupSurface(handle, select.store)
    let initialFocus = (type: PopupInteractionType | null) => select._initialFocus(type)

    handle.addEventListener('insert', () => {
      // Without a list part the popup is the listbox: point the trigger at it.
      handle.queueTask(() => {
        if (!select.listbox.hasList) void select.update()
      })
    })

    return (options, props) => {
      ;[options, props] = splitOptions(options, props)
      let { alignItemWithTrigger = true, ...opts } = options ?? {}
      let listbox = select.listbox
      let isList = !listbox.hasList && select.store.popupNode !== null
      return [
        attrs({
          role: isList ? 'listbox' : undefined,
          'aria-multiselectable': isList && select.multiple ? 'true' : undefined,
          'aria-labelledby': isList ? (select._labelId ?? select._triggerId) : undefined,
        }),
        surface.render(
          {
            ...opts,
            alignItem: select._alignItem(alignItemWithTrigger),
            initialFocus: opts.initialFocus ?? initialFocus,
          },
          props,
        ),
        on<HTMLElement, 'keydown'>('keydown', (event) => select._onPopupKeyDown(event)),
        on<HTMLElement, 'focusout'>('focusout', (event) => select._fieldBlur(event.relatedTarget)),
      ]
    }
  })

const listMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let select = getSelect(handle)
  let list = createListboxList(handle, select.listbox)
  return (props) => [
    attrs({ 'aria-labelledby': select._labelId ?? select._triggerId }),
    list.render(props),
  ]
})

const arrowMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let part = createPopupArrow(handle, getSelect(handle).store)
  return () => part.render()
})

const backdropMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let part = createPopupBackdrop(handle, getSelect(handle).store)
  return () => part.render()
})

// ---------------------------------------------------------------------------------------------
// Items

/** Per-item state shared with `itemText()` and `itemIndicator()`. */
export interface SelectItemContextValue {
  readonly value: unknown
  readonly label: string | undefined
  readonly disabled: boolean
  readonly selected: boolean
}

function ItemProvider(
  handle: Handle<SelectItemContextProps, SelectItemContextValue>,
): () => RemixNode {
  let select = getSelect(handle)
  handle.context.set({
    get value() {
      return handle.props.value
    },
    get label() {
      return handle.props.label
    },
    get disabled() {
      return handle.props.disabled ?? false
    },
    get selected() {
      return select.listbox.isSelected(handle.props.value)
    },
  })
  return () => handle.props.children
}

function getItem(handle: MixinHandle<HTMLElement>): SelectItemContextValue | undefined {
  return handle.context.get(ItemProvider) as SelectItemContextValue | undefined
}

const itemMixin: MixinFactory<HTMLElement, [options?: SelectItemOptions], ElementProps> =
  createMixin<HTMLElement, [options?: SelectItemOptions], ElementProps>((handle, hostType) => {
    let select = getSelect(handle)
    let item = getItem(handle)
    let core = createListboxItem(handle, hostType, select.listbox, {
      onActivate: (entry, event) => select._activate(entry, event),
    })
    return (options, props) => {
      ;[options, props] = splitOptions(options, props)
      let opts = options ?? {}
      let value = 'value' in opts ? opts.value : item ? item.value : null
      return core.render(
        {
          value: value === undefined ? null : value,
          label: opts.label ?? item?.label,
          disabled: opts.disabled ?? item?.disabled ?? false,
        },
        props,
      )
    }
  })

const itemTextMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  handle.addEventListener('insert', (event) => markItemText(event.node))
  return () => attrs({})
})

const itemIndicatorMixin: MixinFactory<
  HTMLElement,
  [options?: SelectItemIndicatorOptions],
  ElementProps
> = createMixin<HTMLElement, [options?: SelectItemIndicatorOptions], ElementProps>((handle) => {
  let select = getSelect(handle)
  let item = getItem(handle)
  let presence = createPresence(handle, { update: () => select.update() })
  return (options, props) => {
    ;[options] = splitOptions(options, props)
    let selected = item?.selected ?? false
    presence.sync(selected)
    return attrs({
      'aria-hidden': 'true',
      hidden: options?.keepMounted || presence.present ? undefined : true,
      'data-selected': selected ? '' : undefined,
      ...presence.attrs(),
    })
  }
})

const groupMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let group = createListboxGroup(handle)
  return (props) => group.render(props)
})

const groupLabelMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let label = createListboxGroupLabel(handle)
  return (props) => label.render(props)
})

// ---------------------------------------------------------------------------------------------
// Scroll arrows

function isScrollable(node: HTMLElement) {
  let overflow = getComputedStyle(node).overflowY
  return (overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight
}

function createScrollArrow(handle: MixinHandle<HTMLElement>, direction: 'up' | 'down') {
  let select = getSelect(handle)
  let node: HTMLElement | null = null
  let visible = false
  let keepMounted = false
  let frame = 0
  let listening: HTMLElement | null = null
  let managed: 'sticky' | 'absolute' | null = null

  function scroller(): HTMLElement | null {
    let list = select.listbox.listNode
    if (list && isScrollable(list)) return list
    return select.store.popupNode
  }

  function sync() {
    let target = scroller()
    if (!node || !target) return
    let next =
      direction === 'up'
        ? target.scrollTop > 1
        : target.scrollTop + target.clientHeight < target.scrollHeight - 1
    if (!managed && getComputedStyle(node).position === 'static') {
      // Inside the scroller the arrow sticks to its edge; outside it, it overlays the popup.
      managed = target.contains(node) ? 'sticky' : 'absolute'
      node.style.position = managed
    }
    if (next === visible) return
    visible = next
    node.toggleAttribute('data-visible', visible)
    node.hidden = !visible && !keepMounted
    if (managed === 'sticky') {
      // Overlay the items instead of taking space: showing or hiding the arrow must not change
      // the scroll height (the item-aligned position re-solves the scroll when it changes).
      let margin = `-${node.offsetHeight}px`
      if (direction === 'up') node.style.marginBottom = margin
      else node.style.marginTop = margin
    }
  }

  function stop() {
    if (frame) cancelAnimationFrame(frame)
    frame = 0
  }

  function step() {
    let target = scroller()
    if (!target) return stop()
    target.scrollTop += direction === 'up' ? -4 : 4
    sync()
    if (!visible) return stop()
    frame = requestAnimationFrame(step)
  }

  // `scroll` doesn't bubble: listen in the capture phase on the popup (registered after this
  // part's own insert, so attach lazily).
  function listen() {
    let popup = select.store.popupNode
    if (!popup || listening === popup) return
    listening?.removeEventListener('scroll', sync, { capture: true })
    listening = popup
    popup.addEventListener('scroll', sync, { capture: true, passive: true })
  }

  handle.addEventListener('insert', (event) => {
    node = event.node
  })
  handle.addEventListener('remove', () => {
    stop()
    listening?.removeEventListener('scroll', sync, { capture: true })
    listening = null
    node = null
  })

  return (options: SelectScrollArrowOptions | undefined) => {
    keepMounted = options?.keepMounted ?? false
    if (select.open) {
      handle.queueTask(() => {
        listen()
        requestAnimationFrame(sync)
      })
    } else {
      stop()
    }
    return [
      attrs({
        'aria-hidden': 'true',
        'data-direction': direction,
        'data-side': select.store.side,
        'data-visible': visible ? '' : undefined,
        hidden: keepMounted || visible ? undefined : true,
      }),
      on<HTMLElement, 'pointerenter'>('pointerenter', (event) => {
        if (event.pointerType === 'touch' || frame) return
        frame = requestAnimationFrame(step)
      }),
      on<HTMLElement, 'pointerleave'>('pointerleave', stop),
    ]
  }
}

const scrollUpArrowMixin: MixinFactory<
  HTMLElement,
  [options?: SelectScrollArrowOptions],
  ElementProps
> = createMixin<HTMLElement, [options?: SelectScrollArrowOptions], ElementProps>((handle) => {
  let render = createScrollArrow(handle, 'up')
  return (options, props) => {
    ;[options] = splitOptions(options, props)
    return render(options)
  }
})

const scrollDownArrowMixin: MixinFactory<
  HTMLElement,
  [options?: SelectScrollArrowOptions],
  ElementProps
> = createMixin<HTMLElement, [options?: SelectScrollArrowOptions], ElementProps>((handle) => {
  let render = createScrollArrow(handle, 'down')
  return (options, props) => {
    ;[options] = splitOptions(options, props)
    return render(options)
  }
})

// ---------------------------------------------------------------------------------------------
// Exports

/**
 * Provider that owns the select state (Base UI `Select.Root`) and renders the form input(s)
 * after its children. Props: `value` / `defaultValue` / `onValueChange(value, details)`,
 * `multiple`, `name`, `form`, `autoComplete`, `required`, `disabled`, `readOnly`, `open` /
 * `defaultOpen` / `onOpenChange(open, details)`, `onOpenChangeComplete`, `modal` (default
 * `true`), `items`, `itemToStringLabel`, `itemToStringValue`, `isItemEqualToValue`,
 * `highlightItemOnHover`, `loopFocus`, `onItemHighlighted`.
 */
export const Context: (handle: Handle<SelectContextProps, SelectContextValue>) => () => RemixNode =
  SelectProvider

/**
 * Provider for one item's state, needed by `itemIndicator()` (and optional otherwise): `value`,
 * `label`, `disabled`. `item()` inside it takes its options from it.
 */
export const ItemContext: (
  handle: Handle<SelectItemContextProps, SelectItemContextValue>,
) => () => RemixNode = ItemProvider

/** Labels the trigger (`aria-labelledby`); a press focuses the trigger. */
export const label = labelMixin

/**
 * The button that opens the popup: `role="combobox"`, `aria-haspopup="listbox"`,
 * `aria-expanded`, `aria-controls`, `data-popup-open`, `data-pressed`, `data-placeholder`,
 * `data-disabled`, `data-readonly`, `data-required`. Click, Enter, Space, ArrowDown, and ArrowUp
 * open it; typing selects the next matching item (single selection). Options: `disabled`.
 */
export const trigger = triggerMixin

/** The element showing the value (put `ValueText` inside): `data-placeholder`. */
export const value = valueMixin

/** An icon in the trigger: `aria-hidden`, `data-popup-open`. */
export const icon = iconMixin

/**
 * The popup (Base UI Positioner + Popup), shown in the top layer: `data-open` / `data-closed`,
 * `data-side` (`'none'` when aligned with the trigger) / `data-align`, presence attributes, and
 * the positioning CSS variables. Options: `alignItemWithTrigger` (default `true`), `side`,
 * `align`, `sideOffset`, `alignOffset`, `collisionPadding`, `arrowPadding`, `anchor`,
 * `initialFocus`, `finalFocus`.
 */
export const popup = popupMixin

/** The list of items: `role="listbox"`, `aria-multiselectable`, `aria-labelledby`. */
export const list = listMixin

/** An element pointing at the trigger. */
export const arrow = arrowMixin

/** An optional overlay shown in the top layer beneath the popup. */
export const backdrop = backdropMixin

/**
 * An item: `role="option"`, `aria-selected`, `data-selected`, `data-highlighted`,
 * `data-disabled`. Options: `value`, `label`, `disabled`.
 */
export const item = itemMixin

/** The item's text label, used for typeahead and the value label. */
export const itemText = itemTextMixin

/**
 * Shows whether its item (from `ItemContext`) is selected: `hidden` while unselected unless
 * `keepMounted`, with presence attributes.
 */
export const itemIndicator = itemIndicatorMixin

/** Groups related items: `role="group"`, labelled by a `groupLabel()` inside it. */
export const group = groupMixin

/** Labels the enclosing `group()`. */
export const groupLabel = groupLabelMixin

/** A separator (`role="separator"`): the generic `stems-ui/separator` mixin. */
export const separator = separatorMixin

/**
 * Scrolls the list up while hovered: `data-direction="up"`, `data-visible`, `data-side`;
 * `hidden` while it can't scroll up unless `keepMounted`.
 */
export const scrollUpArrow = scrollUpArrowMixin

/** Scrolls the list down while hovered: `data-direction="down"`, `data-visible`, `data-side`. */
export const scrollDownArrow = scrollDownArrowMixin
