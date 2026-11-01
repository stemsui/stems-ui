/**
 * `stems-ui/autocomplete`: Base UI's Autocomplete as a `Context` provider plus mixins, built on
 * `lib/combobox-core.ts` (shared with `stems-ui/combobox`).
 *
 * The value is the input text itself: free text is kept as typed, and suggestions only fill it
 * in. `mode` chooses whether suggestions are filtered by the text and whether the highlighted
 * suggestion is completed inline. The input itself carries `name` for forms.
 */

import { createMixin, on } from '@remix-run/component'
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
  ComboboxClearOptions,
  ComboboxCore,
  ComboboxFilter,
  ComboboxInputChangeDetails,
  ComboboxItems,
  ComboboxTriggerOptions,
} from './lib/combobox-core.ts'
import { createListboxGroup, createListboxGroupLabel } from './lib/listbox.ts'
import type { ListboxHighlightDetails } from './lib/listbox.ts'
import { createPopupArrow, createPopupBackdrop } from './lib/popup.ts'
import type { PopupOpenChangeDetails, PopupStateProps, PopupSurfaceOptions } from './lib/popup.ts'

export type {
  PopupAlign as AutocompleteAlign,
  PopupAnchor as AutocompleteAnchor,
  PopupFocusTarget as AutocompleteFocusTarget,
  PopupInteractionType as AutocompleteInteractionType,
  PopupOffsetFunction as AutocompleteOffsetFunction,
  PopupSide as AutocompleteSide,
} from './lib/popup.ts'

export type {
  ComboboxChangeReason as AutocompleteChangeReason,
  ComboboxClearOptions as AutocompleteClearOptions,
  ComboboxFilter as AutocompleteFilter,
  ComboboxItemGroup as AutocompleteItemGroup,
  ComboboxItems as AutocompleteItems,
  ComboboxTriggerOptions as AutocompleteTriggerOptions,
} from './lib/combobox-core.ts'
export { containsText, startsWithText } from './lib/combobox-core.ts'

/** The second argument of `onValueChange`. */
export type AutocompleteValueChangeDetails = ComboboxInputChangeDetails

/** The second argument of `onOpenChange`. `reason` is an `AutocompleteChangeReason`. */
export type AutocompleteOpenChangeDetails = Omit<PopupOpenChangeDetails, 'reason'> & {
  readonly reason: ComboboxChangeReason
}

/**
 * Base UI's `mode` (the `aria-autocomplete` values):
 * - `'list'`: suggestions are filtered by the text.
 * - `'both'`: filtered, and the highlighted suggestion is completed inline.
 * - `'inline'`: not filtered, completed inline.
 * - `'none'`: not filtered, not completed.
 */
export type AutocompleteMode = 'list' | 'both' | 'inline' | 'none'

// ---------------------------------------------------------------------------------------------
// Events

const AUTOCOMPLETE_CHANGE_EVENT = 'stems:autocomplete-change' as const
const AUTOCOMPLETE_OPEN_CHANGE_EVENT = 'stems:autocomplete-open-change' as const

declare global {
  interface HTMLElementEventMap {
    [AUTOCOMPLETE_CHANGE_EVENT]: AutocompleteChangeEvent
    [AUTOCOMPLETE_OPEN_CHANGE_EVENT]: AutocompleteOpenChangeEvent
  }
}

/** Bubbling event dispatched from the input when the value (the text) changes. */
export class AutocompleteChangeEvent extends Event {
  readonly value: string
  readonly reason: ComboboxChangeReason

  constructor(value: string, reason: ComboboxChangeReason) {
    super(AUTOCOMPLETE_CHANGE_EVENT, { bubbles: true })
    this.value = value
    this.reason = reason
  }
}

/** Bubbling event dispatched from the input when the popup opens or closes. */
export class AutocompleteOpenChangeEvent extends Event {
  readonly open: boolean
  readonly reason: ComboboxChangeReason

  constructor(open: boolean, reason: ComboboxChangeReason) {
    super(AUTOCOMPLETE_OPEN_CHANGE_EVENT, { bubbles: true })
    this.open = open
    this.reason = reason
  }
}

/** Listens for the bubbling `stems:autocomplete-change` event. */
export function onAutocompleteChange<target extends HTMLElement>(
  handler: (
    event: Dispatched<AutocompleteChangeEvent, target>,
    signal: AbortSignal,
  ) => void | Promise<void>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof AUTOCOMPLETE_CHANGE_EVENT>> {
  return on(AUTOCOMPLETE_CHANGE_EVENT, handler, captureBoolean)
}

/** Listens for the bubbling `stems:autocomplete-open-change` event. */
export function onAutocompleteOpenChange<target extends HTMLElement>(
  handler: (
    event: Dispatched<AutocompleteOpenChangeEvent, target>,
    signal: AbortSignal,
  ) => void | Promise<void>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof AUTOCOMPLETE_OPEN_CHANGE_EVENT>> {
  return on(AUTOCOMPLETE_OPEN_CHANGE_EVENT, handler, captureBoolean)
}

// ---------------------------------------------------------------------------------------------
// Props and options

/** Props of `autocomplete.Context` (Base UI `Autocomplete.Root`). */
export interface AutocompleteContextProps extends Omit<PopupStateProps, 'modal' | 'onOpenChange'> {
  /** The input text (controlled). */
  value?: string | number
  /** The initial input text (uncontrolled). */
  defaultValue?: string | number
  /** Called with the next text and the change details. Call `details.cancel()` to veto. */
  onValueChange?: (value: string, details: AutocompleteValueChangeDetails) => void
  /** Called with the next open state and the change details. Call `details.cancel()` to veto. */
  onOpenChange?: (open: boolean, details: AutocompleteOpenChangeDetails) => void
  /**
   * How suggestions relate to the text (see `AutocompleteMode`).
   * @default 'list'
   */
  mode?: AutocompleteMode
  /**
   * The suggestions: a flat array, or groups (`{ value, items: [...] }`). Filtered by the text
   * into `filteredItems` (render them with `Collection`).
   */
  items?: ComboboxItems
  /**
   * Whether a suggestion matches the text. `null` disables filtering.
   * @default case- and diacritic-insensitive "contains" on the suggestion's text
   */
  filter?: ComboboxFilter | null
  /** The maximum number of `filteredItems` (`items` only). @default -1 (no limit) */
  limit?: number
  /** The locale used by the default filter. Defaults to the runtime locale. */
  locale?: Intl.LocalesArgument
  /**
   * Converts a suggestion to the text put in the input. Defaults to its `label`, its `value`,
   * or `String(item)`.
   */
  itemToStringValue?: (item: any) => string
  /**
   * Highlight the first suggestion automatically: `true` while typing, `'always'` whenever the
   * list is shown.
   * @default false
   */
  autoHighlight?: boolean | 'always'
  /** Highlight suggestions as the pointer moves over them. @default true */
  highlightItemOnHover?: boolean
  /**
   * Loop keyboard navigation through the input.
   * @default true
   */
  loopFocus?: boolean
  /** Called when the highlighted suggestion changes (`undefined` when nothing is highlighted). */
  onItemHighlighted?: (value: unknown, details: ListboxHighlightDetails) => void
  /** Open the popup when the input is clicked. @default false */
  openOnInputClick?: boolean
  /**
   * Submit the owning form when a suggestion is pressed (or chosen with Enter).
   * @default false
   */
  submitOnItemClick?: boolean
  /** While open: lock page scroll and make outside content inert. @default false */
  modal?: boolean
  /**
   * Identifies the field when a form is submitted (set on the input). An enclosing
   * `field.Context`'s `name` wins.
   */
  name?: string
  /** The id of the `<form>` that owns the input, when rendered outside it. */
  form?: string
  /** Text is required before submitting the form. @default false */
  required?: boolean
  /**
   * Ignore user interaction. An enclosing `<field.Context disabled>` or
   * `<fieldset.Context disabled>` also disables the autocomplete.
   * @default false
   */
  disabled?: boolean
  /** The text can't be changed. @default false */
  readOnly?: boolean
  children?: RemixNode
}

/** Popup options: Base UI's Positioner props plus Popup's `initialFocus` / `finalFocus`. */
export type AutocompletePopupOptions = Omit<
  PopupSurfaceOptions,
  'inset' | 'relativeTo' | 'alignItem'
>

export interface AutocompleteItemOptions {
  /** The suggestion (its text fills the input when pressed). */
  value?: unknown
  /** Text used for filtering. Defaults to the item's text content. */
  label?: string
  /** Ignore user interaction. */
  disabled?: boolean
}

// ---------------------------------------------------------------------------------------------
// State

/** Shared autocomplete state, read with `handle.context.get(autocomplete.Context)`. */
export interface AutocompleteContextValue extends ComboboxCore {
  readonly mode: AutocompleteMode
  /** @internal The input's form attributes. */
  _formAttrs(): { name?: string; form?: string; required?: true }
}

function AutocompleteProvider(
  handle: Handle<AutocompleteContextProps, AutocompleteContextValue>,
): () => RemixNode {
  let mode = () => handle.props.mode ?? 'list'
  // Set by every render, before the parts inside render.
  let fieldState: FieldControlRenderResult | undefined
  // The input's own `id` prop, which becomes the field's control id.
  let inputHostId: string | undefined
  let fieldChange = createFieldChange<string>()

  function isDisabled() {
    return fieldState?.disabled ?? handle.props.disabled === true
  }

  let core = createComboboxCore(handle, {
    kind: 'autocomplete',
    getProps: () => {
      let props = handle.props
      return {
        inputValue: props.value,
        defaultInputValue: props.defaultValue,
        onInputValueChange: props.onValueChange,
        items: props.items,
        filter: props.filter,
        limit: props.limit,
        locale: props.locale,
        itemToString: props.itemToStringValue,
        open: props.open,
        defaultOpen: props.defaultOpen,
        onOpenChange: props.onOpenChange as (open: boolean, details: any) => void,
        onOpenChangeComplete: props.onOpenChangeComplete,
        modal: props.modal,
        autoHighlight: props.autoHighlight,
        highlightItemOnHover: props.highlightItemOnHover,
        loopFocus: props.loopFocus,
        onItemHighlighted: props.onItemHighlighted,
        openOnInputClick: props.openOnInputClick ?? false,
        disabled: isDisabled(),
        readOnly: props.readOnly,
        required: props.required,
      }
    },
    filtering: () => mode() === 'list' || mode() === 'both',
    inline: () => mode() === 'both' || mode() === 'inline',
    ariaAutocomplete: mode,
    // Called once a text change was accepted (not cancelled by `onValueChange`).
    createInputValueEvent: (value, reason) => {
      // The input re-renders later (an item press sets its text after this); validation reads
      // its validity now.
      let input = core.inputNode
      if (input && input.value !== value) input.value = value
      fieldChange.report(fieldControl, value)
      return new AutocompleteChangeEvent(value, reason)
    },
    createOpenEvent: (open, reason) => new AutocompleteOpenChangeEvent(open, reason),
    onItemActivated() {
      if (!handle.props.submitOnItemClick) return
      let form = core.inputNode?.form
      if (form) queueMicrotask(() => form.requestSubmit())
    },
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

  // Inside a <field.Context>, the autocomplete is the field's control, like a plain input: the
  // visible input carries the text, `name`, `required` and validity, and is focused when the
  // field blocks a submission.
  let fieldControl = connectFieldControl(handle, {
    getValue: () => fieldChange.read(() => core.inputValue),
    getValidityElement: () => core.inputNode,
    getFocusElement: () => core.inputNode,
  })

  let context = Object.defineProperties(core, {
    mode: { get: mode, enumerable: true },
    _formAttrs: {
      value: () => ({
        name: fieldState ? fieldState.name : handle.props.name,
        form: handle.props.form,
        required: handle.props.required ? (true as const) : undefined,
      }),
    },
  }) as AutocompleteContextValue
  handle.context.set(context)

  return () => {
    fieldState = fieldControl.render({
      value: core.inputValue,
      id: inputHostId,
      disabled: handle.props.disabled === true,
      name: handle.props.name,
    })
    core.render()
    return handle.props.children
  }
}

function getAutocomplete(handle: MixinHandle<any> | Handle<any, any>): AutocompleteContextValue {
  return handle.context.get(AutocompleteProvider) as AutocompleteContextValue
}

// ---------------------------------------------------------------------------------------------
// Mixins

const inputMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let autocomplete = getAutocomplete(handle)
  let part = createComboboxInput(handle, autocomplete, () => autocomplete._formAttrs())
  return (props) => part.render(props)
})

const inputGroupMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let part = createComboboxInputGroup(handle, getAutocomplete(handle))
  return () => part.render()
})

const triggerMixin: MixinFactory<HTMLElement, [options?: ComboboxTriggerOptions], ElementProps> =
  createMixin<HTMLElement, [options?: ComboboxTriggerOptions], ElementProps>((handle, hostType) => {
    let part = createComboboxTrigger(handle, hostType, getAutocomplete(handle))
    return (options, props) => {
      ;[options] = splitOptions(options, props)
      return part.render(options)
    }
  })

const clearMixin: MixinFactory<HTMLElement, [options?: ComboboxClearOptions], ElementProps> =
  createMixin<HTMLElement, [options?: ComboboxClearOptions], ElementProps>((handle, hostType) => {
    let part = createComboboxClear(handle, hostType, getAutocomplete(handle))
    return (options, props) => {
      ;[options] = splitOptions(options, props)
      return part.render(options)
    }
  })

export interface AutocompleteValueTextProps {
  /** Custom rendering of the text. */
  children?: (value: string) => RemixNode
}

/** Renders the current text, with no element of its own (Base UI `Value`). */
export function ValueText(handle: Handle<AutocompleteValueTextProps>): () => RemixNode {
  let autocomplete = getAutocomplete(handle)
  return () => {
    let value = autocomplete.inputValue
    return handle.props.children ? handle.props.children(value) : value
  }
}

const iconMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let part = createComboboxIcon(getAutocomplete(handle))
  return () => part.render()
})

const popupMixin: MixinFactory<HTMLElement, [options?: AutocompletePopupOptions], ElementProps> =
  createMixin<HTMLElement, [options?: AutocompletePopupOptions], ElementProps>((handle) => {
    let part = createComboboxPopup(handle, getAutocomplete(handle))
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
  let part = createComboboxList(handle, getAutocomplete(handle))
  return (props) => part.render(props)
})

const emptyMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let part = createComboboxEmpty(getAutocomplete(handle))
  return () => part.render()
})

export interface AutocompleteEmptyTextProps {
  /** Rendered only while no suggestions match. */
  children?: RemixNode
}

/** Renders its children only while no suggestions match. Put it inside `empty()`. */
export function EmptyText(handle: Handle<AutocompleteEmptyTextProps>): () => RemixNode {
  let autocomplete = getAutocomplete(handle)
  return () => (autocomplete.empty ? handle.props.children : null)
}

const statusMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>(() => {
  let part = createComboboxStatus()
  return () => part.render()
})

export interface AutocompleteCollectionProps {
  /** The items to render. Defaults to the root's `filteredItems`. Pass a group's `items`. */
  items?: readonly any[]
  /** Renders one suggestion (or group, when `items` is grouped). */
  children: (item: any, index: number) => RemixNode
}

/** Renders the filtered suggestions (Base UI `Collection`), with no element of its own. */
export function Collection(handle: Handle<AutocompleteCollectionProps>): () => RemixNode {
  let autocomplete = getAutocomplete(handle)
  return () => {
    let items = handle.props.items ?? autocomplete.filteredItems
    return items.map((item, index) => handle.props.children(item, index))
  }
}

const arrowMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let part = createPopupArrow(handle, getAutocomplete(handle).popup)
  return () => part.render()
})

const backdropMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let part = createPopupBackdrop(handle, getAutocomplete(handle).popup)
  return () => part.render()
})

const itemMixin: MixinFactory<HTMLElement, [options?: AutocompleteItemOptions], ElementProps> =
  createMixin<HTMLElement, [options?: AutocompleteItemOptions], ElementProps>(
    (handle, hostType) => {
      let part = createComboboxItem(handle, hostType, getAutocomplete(handle))
      return (options, props) => {
        ;[options, props] = splitOptions(options, props)
        let opts = options ?? {}
        return part.render(
          {
            value: opts.value === undefined ? null : opts.value,
            label: opts.label,
            disabled: opts.disabled ?? false,
          },
          props,
        )
      }
    },
  )

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
// Exports

/** Provider that owns the autocomplete state (Base UI `Autocomplete.Root`). */
export const Context: (
  handle: Handle<AutocompleteContextProps, AutocompleteContextValue>,
) => () => RemixNode = AutocompleteProvider

/**
 * The text input: `role="combobox"`, `aria-autocomplete` (the `mode`), `aria-expanded`,
 * `aria-controls`, `aria-activedescendant`, `value`, `name` / `form` / `required`, and
 * `data-popup-open`, `data-popup-side`, `data-list-empty`, `data-disabled`, `data-readonly`,
 * `data-required`.
 */
export const input = inputMixin

/** Wraps the input and its buttons; the popup is positioned against it. */
export const inputGroup = inputGroupMixin

/** A button that toggles the popup and keeps focus in the input. Options: `disabled`. */
export const trigger = triggerMixin

/** A button that clears the text: `data-visible`, `hidden` while empty unless `keepMounted`. */
export const clear = clearMixin

/** An icon: `aria-hidden`, `data-popup-open`. */
export const icon = iconMixin

/**
 * The popup, shown in the top layer: `data-open` / `data-closed`, `data-side` / `data-align`,
 * `data-empty`, presence attributes, and the positioning CSS variables.
 */
export const popup = popupMixin

/** The list of suggestions: `role="listbox"`, `data-empty`. */
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
 * A suggestion: `role="option"`, `data-highlighted`, `data-disabled`; `hidden` while it doesn't
 * match the text. Pressing it fills the input. Options: `value`, `label`, `disabled`.
 */
export const item = itemMixin

/** Groups related suggestions: `role="group"`, labelled by a `groupLabel()`. */
export const group = groupMixin

/** Labels the enclosing `group()`. */
export const groupLabel = groupLabelMixin

/** A separator (`role="separator"`): the generic `stems-ui/separator` mixin. */
export const separator = separatorMixin
