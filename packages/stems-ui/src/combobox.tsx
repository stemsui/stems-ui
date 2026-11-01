// Adapted from @remix-run/ui 0.13.0 (packages/ui/src/combobox.tsx).
// https://github.com/remix-run/remix - Copyright (c) 2025 Shopify Inc. MIT License.

/**
 * `stems-ui/combobox`: Base UI's Combobox as a `Context` provider plus mixins, built on
 * `lib/combobox-core.ts` (shared with `stems-ui/autocomplete`), which composes `lib/popup.ts`
 * and `lib/listbox.ts` in virtual-focus mode.
 *
 * The value is the chosen item (or items, with `multiple`); the input text is a draft used to
 * filter. DOM focus stays in the input and `aria-activedescendant` points at the highlighted
 * item. The provider renders the form input(s) itself, after its children.
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
import { createFieldChange } from './lib/checkable.ts'
import { splitOptions } from './lib/collapsible-panel.ts'
import { connectFieldControl, type FieldControlRenderResult } from './lib/field-control.ts'
import {
  createComboboxChip,
  createComboboxChipRemove,
  createComboboxChips,
  createComboboxClear,
  createComboboxCore,
  createComboboxEmpty,
  createComboboxGroup,
  createComboboxIcon,
  createComboboxInput,
  createComboboxInputGroup,
  createComboboxItem,
  createComboboxList,
  createComboboxPopup,
  createComboboxStatus,
  createComboboxTrigger,
} from './lib/combobox-core.ts'
import type {
  ComboboxChangeReason,
  ComboboxChipPartOptions,
  ComboboxChipRemoveOptions,
  ComboboxClearOptions,
  ComboboxCore,
  ComboboxTriggerOptions,
  ComboboxFilter,
  ComboboxInputChangeDetails,
  ComboboxItems,
} from './lib/combobox-core.ts'
import { createListboxGroup, createListboxGroupLabel } from './lib/listbox.ts'
import type { ListboxHighlightDetails, ListboxValueChangeDetails } from './lib/listbox.ts'
import { createPopupArrow, createPopupBackdrop } from './lib/popup.ts'
import type { PopupOpenChangeDetails, PopupStateProps, PopupSurfaceOptions } from './lib/popup.ts'
import { createPresence } from './lib/presence.ts'

export type {
  PopupAlign as ComboboxAlign,
  PopupAnchor as ComboboxAnchor,
  PopupFocusTarget as ComboboxFocusTarget,
  PopupInteractionType as ComboboxInteractionType,
  PopupOffsetFunction as ComboboxOffsetFunction,
  PopupSide as ComboboxSide,
} from './lib/popup.ts'

export type {
  ComboboxChangeReason,
  ComboboxFilter,
  ComboboxInputChangeDetails,
  ComboboxItemGroup,
  ComboboxItems,
} from './lib/combobox-core.ts'
export { containsText, startsWithText } from './lib/combobox-core.ts'

/** The second argument of `onValueChange`. `reason` is a `ComboboxChangeReason`. */
export type ComboboxValueChangeDetails = Omit<ListboxValueChangeDetails, 'reason'> & {
  readonly reason: ComboboxChangeReason
}

/** The second argument of `onOpenChange`. `reason` is a `ComboboxChangeReason`. */
export type ComboboxOpenChangeDetails = Omit<PopupOpenChangeDetails, 'reason'> & {
  readonly reason: ComboboxChangeReason
}

// ---------------------------------------------------------------------------------------------
// Events

const COMBOBOX_CHANGE_EVENT = 'stems:combobox-change' as const
const COMBOBOX_INPUT_CHANGE_EVENT = 'stems:combobox-input-change' as const
const COMBOBOX_OPEN_CHANGE_EVENT = 'stems:combobox-open-change' as const

declare global {
  interface HTMLElementEventMap {
    [COMBOBOX_CHANGE_EVENT]: ComboboxChangeEvent
    [COMBOBOX_INPUT_CHANGE_EVENT]: ComboboxInputChangeEvent
    [COMBOBOX_OPEN_CHANGE_EVENT]: ComboboxOpenChangeEvent
  }
}

/** Bubbling event dispatched from the input when the value changes. */
export class ComboboxChangeEvent extends Event {
  /** The new value (an array when `multiple`). */
  readonly value: unknown
  readonly reason: ComboboxChangeReason

  constructor(value: unknown, reason: ComboboxChangeReason) {
    super(COMBOBOX_CHANGE_EVENT, { bubbles: true })
    this.value = value
    this.reason = reason
  }
}

/** Bubbling event dispatched from the input when the input text changes. */
export class ComboboxInputChangeEvent extends Event {
  readonly inputValue: string
  readonly reason: ComboboxChangeReason

  constructor(inputValue: string, reason: ComboboxChangeReason) {
    super(COMBOBOX_INPUT_CHANGE_EVENT, { bubbles: true })
    this.inputValue = inputValue
    this.reason = reason
  }
}

/** Bubbling event dispatched from the input when the popup opens or closes. */
export class ComboboxOpenChangeEvent extends Event {
  readonly open: boolean
  readonly reason: ComboboxChangeReason

  constructor(open: boolean, reason: ComboboxChangeReason) {
    super(COMBOBOX_OPEN_CHANGE_EVENT, { bubbles: true })
    this.open = open
    this.reason = reason
  }
}

/** Listens for the bubbling `stems:combobox-change` event. */
export function onComboboxChange<target extends HTMLElement>(
  handler: (
    event: Dispatched<ComboboxChangeEvent, target>,
    signal: AbortSignal,
  ) => void | Promise<void>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof COMBOBOX_CHANGE_EVENT>> {
  return on(COMBOBOX_CHANGE_EVENT, handler, captureBoolean)
}

/** Listens for the bubbling `stems:combobox-input-change` event. */
export function onComboboxInputChange<target extends HTMLElement>(
  handler: (
    event: Dispatched<ComboboxInputChangeEvent, target>,
    signal: AbortSignal,
  ) => void | Promise<void>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof COMBOBOX_INPUT_CHANGE_EVENT>> {
  return on(COMBOBOX_INPUT_CHANGE_EVENT, handler, captureBoolean)
}

/** Listens for the bubbling `stems:combobox-open-change` event. */
export function onComboboxOpenChange<target extends HTMLElement>(
  handler: (
    event: Dispatched<ComboboxOpenChangeEvent, target>,
    signal: AbortSignal,
  ) => void | Promise<void>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof COMBOBOX_OPEN_CHANGE_EVENT>> {
  return on(COMBOBOX_OPEN_CHANGE_EVENT, handler, captureBoolean)
}

// ---------------------------------------------------------------------------------------------
// Props and options

/** Props of `combobox.Context` (Base UI `Combobox.Root`). */
export interface ComboboxContextProps extends Omit<PopupStateProps, 'modal' | 'onOpenChange'> {
  /** The selected value (controlled): an item or `null`, or an array when `multiple`. */
  value?: unknown
  /** The initially selected value (uncontrolled). */
  defaultValue?: unknown
  /** Called with the next value and the change details. Call `details.cancel()` to veto. */
  onValueChange?: (value: any, details: ComboboxValueChangeDetails) => void
  /** The input text (controlled). */
  inputValue?: string | number
  /** The initial input text (uncontrolled). Defaults to the selected item's label. */
  defaultInputValue?: string | number
  /** Called with the next input text and the change details. Call `details.cancel()` to veto. */
  onInputValueChange?: (inputValue: string, details: ComboboxInputChangeDetails) => void
  /** Called with the next open state and the change details. Call `details.cancel()` to veto. */
  onOpenChange?: (open: boolean, details: ComboboxOpenChangeDetails) => void
  /**
   * Whether multiple items can be selected. The value is then an array, shown as chips.
   * @default false
   */
  multiple?: boolean
  /**
   * The items: a flat array, or groups (`{ value, items: [...] }`). Filtered by the input text
   * into `filteredItems` (render them with `Collection`); also used to look up labels.
   */
  items?: ComboboxItems
  /**
   * Whether an item matches the input text. `null` disables filtering.
   * @default case- and diacritic-insensitive "contains" on the item's label
   */
  filter?: ComboboxFilter | null
  /** The maximum number of `filteredItems` (`items` only). @default -1 (no limit) */
  limit?: number
  /** The locale used by the default filter. Defaults to the runtime locale. */
  locale?: Intl.LocalesArgument
  /** Converts a value to its label (shown in the input, chips, and used by the filter). */
  itemToStringLabel?: (value: any) => string
  /** Converts a value to the string submitted with the form. */
  itemToStringValue?: (value: any) => string
  /** Compares an item's value with a selected value. @default Object.is */
  isItemEqualToValue?: (itemValue: any, value: any) => boolean
  /**
   * Highlight the first matching item while filtering.
   * @default false
   */
  autoHighlight?: boolean
  /** Highlight items as the pointer moves over them. @default true */
  highlightItemOnHover?: boolean
  /**
   * Loop keyboard navigation through the input: past the last item the highlight clears, and
   * the next ArrowDown highlights the first item again.
   * @default true
   */
  loopFocus?: boolean
  /** Called when the highlighted item changes (`undefined` when nothing is highlighted). */
  onItemHighlighted?: (value: unknown, details: ListboxHighlightDetails) => void
  /** Open the popup when the input is clicked. @default true */
  openOnInputClick?: boolean
  /** While open: lock page scroll and make outside content inert. @default false */
  modal?: boolean
  /** Identifies the field when a form is submitted. An enclosing `field.Context`'s `name` wins. */
  name?: string
  /** The id of the `<form>` that owns the input(s), when rendered outside it. */
  form?: string
  /** The autofill hint for the form input. */
  autoComplete?: string
  /** A value must be chosen before submitting the form. @default false */
  required?: boolean
  /**
   * Ignore user interaction. An enclosing `<field.Context disabled>` or
   * `<fieldset.Context disabled>` also disables the combobox.
   * @default false
   */
  disabled?: boolean
  /** The user can't change the value or open the popup. @default false */
  readOnly?: boolean
  children?: RemixNode
}

/** Popup options: Base UI's Positioner props plus Popup's `initialFocus` / `finalFocus`. */
export type ComboboxPopupOptions = Omit<PopupSurfaceOptions, 'inset' | 'relativeTo' | 'alignItem'>

export interface ComboboxItemOptions {
  /** The item's value (defaults to the enclosing `ItemContext`'s value, else `null`). */
  value?: unknown
  /** Text used for filtering and as the label. Defaults to the item's text content. */
  label?: string
  /** Ignore user interaction. */
  disabled?: boolean
}

export interface ComboboxItemIndicatorOptions {
  /** Keep the indicator visible while the item isn't selected. @default false */
  keepMounted?: boolean
}

export interface ComboboxItemContextProps {
  value: unknown
  label?: string
  disabled?: boolean
  children?: RemixNode
}

export type {
  ComboboxChipPartOptions as ComboboxChipOptions,
  ComboboxChipRemoveOptions,
  ComboboxClearOptions,
  ComboboxTriggerOptions,
} from './lib/combobox-core.ts'

// ---------------------------------------------------------------------------------------------
// Combobox state

/** Shared combobox state, read with `handle.context.get(combobox.Context)`. */
export interface ComboboxContextValue extends ComboboxCore {
  /** The string submitted for `value` (`itemToStringValue`, `value.value`, or `String`). */
  stringValue(value: unknown): string
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

function ComboboxProvider(
  handle: Handle<ComboboxContextProps, ComboboxContextValue>,
): () => RemixNode {
  let hiddenInput: HTMLInputElement | null = null
  // Set by every render, before the parts inside render.
  let fieldState: FieldControlRenderResult | undefined
  // The input's own `id` prop, which becomes the field's control id.
  let inputHostId: string | undefined
  let fieldChange = createFieldChange<unknown>()

  function isDisabled() {
    return fieldState?.disabled ?? handle.props.disabled === true
  }

  let core = createComboboxCore(handle, {
    kind: 'combobox',
    getProps: () => {
      let props = handle.props
      return {
        inputValue: props.inputValue,
        defaultInputValue: props.defaultInputValue,
        onInputValueChange: props.onInputValueChange,
        value: props.value,
        defaultValue: props.defaultValue,
        onValueChange: props.onValueChange as (value: any, details: any) => void,
        multiple: props.multiple,
        items: props.items,
        filter: props.filter,
        limit: props.limit,
        locale: props.locale,
        itemToString: props.itemToStringLabel,
        isItemEqualToValue: props.isItemEqualToValue,
        open: props.open,
        defaultOpen: props.defaultOpen,
        onOpenChange: props.onOpenChange as (open: boolean, details: any) => void,
        onOpenChangeComplete: props.onOpenChangeComplete,
        modal: props.modal,
        autoHighlight: props.autoHighlight,
        highlightItemOnHover: props.highlightItemOnHover,
        loopFocus: props.loopFocus,
        onItemHighlighted: props.onItemHighlighted,
        openOnInputClick: props.openOnInputClick,
        disabled: isDisabled(),
        readOnly: props.readOnly,
        required: props.required,
      }
    },
    filtering: () => true,
    inline: () => false,
    ariaAutocomplete: () => 'list',
    // Called once a value change was accepted (not cancelled by `onValueChange`).
    createValueEvent: (value, reason) => {
      reportChange(value)
      return new ComboboxChangeEvent(value, reason)
    },
    createInputValueEvent: (value, reason) => new ComboboxInputChangeEvent(value, reason),
    createOpenEvent: (open, reason) => new ComboboxOpenChangeEvent(open, reason),
    field: {
      result: () => fieldState,
      setInputId(id, from) {
        if (id === inputHostId) return
        inputHostId = id
        // The field's control id (and the label's `for`) follow on the next render.
        from.queueTask(() => void handle.update())
      },
      focus: () => fieldControl.focus(),
      blur: () => fieldControl.blur(),
    },
  })

  // Inside a <field.Context>, the combobox is the field's control: the visually hidden input is
  // its validity element (`required`), the visible input is labelled by the field and focused
  // when it blocks a submission.
  let fieldControl = connectFieldControl(handle, {
    getValue: () => fieldChange.read(() => core.value),
    getValidityElement: () => hiddenInput,
    getFocusElement: () => core.inputNode,
    isFilled: (value) => (Array.isArray(value) ? value.length > 0 : value != null),
  })

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

  function reportChange(value: unknown) {
    // The hidden input re-renders later; validation reads its validity now.
    if (hiddenInput) hiddenInput.value = hiddenValue(value)
    fieldChange.report(fieldControl, value)
  }

  function stringValue(value: unknown): string {
    if (value == null) return ''
    if (handle.props.itemToStringValue) return handle.props.itemToStringValue(value)
    if (typeof value === 'object' && 'value' in value) return String(value.value)
    return String(value)
  }

  let context: ComboboxContextValue = Object.assign(core, { stringValue })
  handle.context.set(context)

  function focusInput() {
    core.inputNode?.focus()
  }

  return () => {
    let f = (fieldState = fieldControl.render({
      value: core.value,
      id: inputHostId,
      disabled: handle.props.disabled === true,
      name: handle.props.name,
    }))
    core.render()
    let { form, autoComplete, required, multiple } = handle.props
    let name = f.name
    let disabled = f.disabled
    let strings = core.selectedValues.map(stringValue)
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
            on<HTMLInputElement, 'focus'>('focus', focusInput),
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

function getCombobox(handle: MixinHandle<any> | Handle<any, any>): ComboboxContextValue {
  return handle.context.get(ComboboxProvider) as ComboboxContextValue
}

// ---------------------------------------------------------------------------------------------
// Input, input group, trigger, clear, value, icon

const inputMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let combobox = getCombobox(handle)
  let part = createComboboxInput(handle, combobox, () => ({
    'aria-required': combobox.required ? 'true' : undefined,
  }))
  return (props) => part.render(props)
})

const inputGroupMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let part = createComboboxInputGroup(handle, getCombobox(handle))
  return () => part.render()
})

const triggerMixin: MixinFactory<HTMLElement, [options?: ComboboxTriggerOptions], ElementProps> =
  createMixin<HTMLElement, [options?: ComboboxTriggerOptions], ElementProps>((handle, hostType) => {
    let part = createComboboxTrigger(handle, hostType, getCombobox(handle))
    return (options, props) => {
      ;[options] = splitOptions(options, props)
      return part.render(options)
    }
  })

const clearMixin: MixinFactory<HTMLElement, [options?: ComboboxClearOptions], ElementProps> =
  createMixin<HTMLElement, [options?: ComboboxClearOptions], ElementProps>((handle, hostType) => {
    let part = createComboboxClear(handle, hostType, getCombobox(handle))
    return (options, props) => {
      ;[options] = splitOptions(options, props)
      return part.render(options)
    }
  })

const valueMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let combobox = getCombobox(handle)
  return () => attrs({ 'data-placeholder': combobox.hasValue ? undefined : '' })
})

export interface ComboboxValueTextProps {
  /** Shown while no value is selected. */
  placeholder?: RemixNode
  /** Custom rendering of the value (an array when `multiple`). */
  children?: (value: any) => RemixNode
}

/**
 * Renders the selected item's label (or `placeholder`) as text, with no element of its own
 * (Base UI `Value`). Multiple values render as a comma-separated list; pass a function child to
 * render chips: `<combobox.ValueText>{(values) => values.map(...)}</combobox.ValueText>`.
 */
export function ValueText(handle: Handle<ComboboxValueTextProps>): () => RemixNode {
  let combobox = getCombobox(handle)
  return () => {
    let { children, placeholder } = handle.props
    if (children) return children(combobox.value)
    if (!combobox.hasValue) return placeholder ?? ''
    return combobox.selectedValues.map((value) => combobox.labelOf(value)).join(', ')
  }
}

const iconMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let part = createComboboxIcon(getCombobox(handle))
  return () => part.render()
})

// ---------------------------------------------------------------------------------------------
// Popup, list, empty, status, collection, arrow, backdrop

const popupMixin: MixinFactory<HTMLElement, [options?: ComboboxPopupOptions], ElementProps> =
  createMixin<HTMLElement, [options?: ComboboxPopupOptions], ElementProps>((handle) => {
    let part = createComboboxPopup(handle, getCombobox(handle))
    return (options, props) => {
      ;[options, props] = splitOptions(options, props)
      return part.render(options ?? {}, props)
    }
  })

const listMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let part = createComboboxList(handle, getCombobox(handle))
  return (props) => part.render(props)
})

const emptyMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let part = createComboboxEmpty(getCombobox(handle))
  return () => part.render()
})

export interface ComboboxEmptyTextProps {
  /** Rendered only while no items match. */
  children?: RemixNode
}

/**
 * Renders its children only while no items match, with no element of its own. Put it inside
 * the host that has `empty()` (which stays rendered so screen readers announce the change).
 */
export function EmptyText(handle: Handle<ComboboxEmptyTextProps>): () => RemixNode {
  let combobox = getCombobox(handle)
  return () => (combobox.empty ? handle.props.children : null)
}

const statusMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>(() => {
  let part = createComboboxStatus()
  return () => part.render()
})

export interface ComboboxCollectionProps {
  /** The items to render. Defaults to the root's `filteredItems`. Pass a group's `items`. */
  items?: readonly any[]
  /** Renders one item (or group, when `items` is grouped). */
  children: (item: any, index: number) => RemixNode
}

/**
 * Renders the filtered items (Base UI `Collection`, and `List`'s function child), with no
 * element of its own. It re-renders as the input text changes, so the list only contains
 * matching items.
 */
export function Collection(handle: Handle<ComboboxCollectionProps>): () => RemixNode {
  let combobox = getCombobox(handle)
  return () => {
    let items = handle.props.items ?? combobox.filteredItems
    return items.map((item, index) => handle.props.children(item, index))
  }
}

const arrowMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let part = createPopupArrow(handle, getCombobox(handle).popup)
  return () => part.render()
})

const backdropMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let part = createPopupBackdrop(handle, getCombobox(handle).popup)
  return () => part.render()
})

// ---------------------------------------------------------------------------------------------
// Items and groups

/** Per-item state shared with `itemIndicator()`. */
export interface ComboboxItemContextValue {
  readonly value: unknown
  readonly label: string | undefined
  readonly disabled: boolean
  readonly selected: boolean
}

function ItemProvider(
  handle: Handle<ComboboxItemContextProps, ComboboxItemContextValue>,
): () => RemixNode {
  let combobox = getCombobox(handle)
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
      return combobox.listbox.isSelected(handle.props.value)
    },
  })
  return () => handle.props.children
}

function getItem(handle: MixinHandle<HTMLElement>): ComboboxItemContextValue | undefined {
  return handle.context.get(ItemProvider) as ComboboxItemContextValue | undefined
}

const itemMixin: MixinFactory<HTMLElement, [options?: ComboboxItemOptions], ElementProps> =
  createMixin<HTMLElement, [options?: ComboboxItemOptions], ElementProps>((handle, hostType) => {
    let item = getItem(handle)
    let part = createComboboxItem(handle, hostType, getCombobox(handle))
    return (options, props) => {
      ;[options, props] = splitOptions(options, props)
      let opts = options ?? {}
      let value = 'value' in opts ? opts.value : item ? item.value : null
      return part.render(
        {
          value: value === undefined ? null : value,
          label: opts.label ?? item?.label,
          disabled: opts.disabled ?? item?.disabled ?? false,
        },
        props,
      )
    }
  })

const itemIndicatorMixin: MixinFactory<
  HTMLElement,
  [options?: ComboboxItemIndicatorOptions],
  ElementProps
> = createMixin<HTMLElement, [options?: ComboboxItemIndicatorOptions], ElementProps>((handle) => {
  let combobox = getCombobox(handle)
  let item = getItem(handle)
  let presence = createPresence(handle, { update: () => combobox.update() })
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
  let filtered = createComboboxGroup(handle)
  return (props) => [group.render(props), filtered.render()]
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
// Chips

const chipsMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let part = createComboboxChips(handle, getCombobox(handle))
  return () => part.render()
})

const chipMixin: MixinFactory<HTMLElement, [options: ComboboxChipPartOptions], ElementProps> =
  createMixin<HTMLElement, [options: ComboboxChipPartOptions], ElementProps>((handle) => {
    let part = createComboboxChip(handle, getCombobox(handle))
    return (options, props) => {
      let [opts] = splitOptions<ComboboxChipPartOptions>(options, props)
      return part.render(opts ?? { value: null })
    }
  })

const chipRemoveMixin: MixinFactory<
  HTMLElement,
  [options?: ComboboxChipRemoveOptions],
  ElementProps
> = createMixin<HTMLElement, [options?: ComboboxChipRemoveOptions], ElementProps>(
  (handle, hostType) => {
    let part = createComboboxChipRemove(hostType, getCombobox(handle))
    return (options, props) => {
      ;[options] = splitOptions(options, props)
      return part.render(options)
    }
  },
)

// ---------------------------------------------------------------------------------------------
// Exports

/**
 * Provider that owns the combobox state (Base UI `Combobox.Root`) and renders the form input(s)
 * after its children. See `ComboboxContextProps`.
 */
export const Context: (
  handle: Handle<ComboboxContextProps, ComboboxContextValue>,
) => () => RemixNode = ComboboxProvider

/**
 * Provider for one item's state, needed by `itemIndicator()`: `value`, `label`, `disabled`.
 * `item()` inside it takes its options from it.
 */
export const ItemContext: (
  handle: Handle<ComboboxItemContextProps, ComboboxItemContextValue>,
) => () => RemixNode = ItemProvider

/**
 * The text input: `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`,
 * `aria-controls`, `aria-activedescendant`, `value` (the input text), and `data-popup-open`,
 * `data-popup-side`, `data-list-empty`, `data-disabled`, `data-readonly`, `data-required`.
 */
export const input = inputMixin

/**
 * Wraps the input and its buttons (Base UI `InputGroup`): the popup is positioned against it.
 * `role="group"`, `data-popup-open`, `data-popup-side`, `data-list-empty`, `data-disabled`,
 * `data-readonly`, `data-placeholder`.
 */
export const inputGroup = inputGroupMixin

/**
 * A button that toggles the popup: `aria-haspopup="listbox"`, `aria-expanded`,
 * `data-popup-open`, `data-list-empty`, `data-placeholder`, `data-disabled`, `data-readonly`,
 * `data-required`. Keeps focus in the input. Options: `disabled`.
 */
export const trigger = triggerMixin

/**
 * A button that clears the value and the input text: `data-visible`, `hidden` while there is
 * nothing to clear (unless `keepMounted`). Options: `disabled`, `keepMounted`.
 */
export const clear = clearMixin

/** The element showing the value (put `ValueText` inside): `data-placeholder`. */
export const value = valueMixin

/** An icon: `aria-hidden`, `data-popup-open`. */
export const icon = iconMixin

/**
 * The popup (Base UI Positioner + Popup), shown in the top layer: `data-open` / `data-closed`,
 * `data-side` / `data-align`, `data-empty`, presence attributes, and the positioning CSS
 * variables. Options: `side`, `align`, `sideOffset`, `alignOffset`, `collisionPadding`,
 * `arrowPadding`, `anchor`, `initialFocus`, `finalFocus`.
 */
export const popup = popupMixin

/** The list of items: `role="listbox"`, `aria-multiselectable`, `data-empty`. */
export const list = listMixin

/** The empty-state live region (put `EmptyText` inside): `role="status"`, `data-empty`. */
export const empty = emptyMixin

/** A polite live region for status messages (e.g. loading). */
export const status = statusMixin

/** An element pointing at the anchor. */
export const arrow = arrowMixin

/** An optional overlay shown in the top layer beneath the popup. */
export const backdrop = backdropMixin

/**
 * An item: `role="option"`, `aria-selected`, `data-selected`, `data-highlighted`,
 * `data-disabled`; `hidden` while it doesn't match the input text. Options: `value`, `label`,
 * `disabled`.
 */
export const item = itemMixin

/** Shows whether its item (from `ItemContext`) is selected: `hidden` while unselected. */
export const itemIndicator = itemIndicatorMixin

/** Groups related items: `role="group"`, labelled by a `groupLabel()`; hidden when empty. */
export const group = groupMixin

/** Labels the enclosing `group()`. */
export const groupLabel = groupLabelMixin

/** A separator (`role="separator"`): the generic `stems-ui/separator` mixin. */
export const separator = separatorMixin

/** The container of the chips (multiple). Presses on its empty area focus the input. */
export const chips = chipsMixin

/**
 * A chip showing one selected value: focusable, `data-disabled`. ArrowLeft / ArrowRight move
 * between chips, Backspace / Delete remove it. Options: `value`, `disabled`.
 */
export const chip = chipMixin

/** Removes the enclosing chip's value. Options: `value` (override), `disabled`. */
export const chipRemove = chipRemoveMixin
