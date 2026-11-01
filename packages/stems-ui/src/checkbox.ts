import { attrs, createMixin, on, ref } from '@remix-run/component'
import type {
  Dispatched,
  ElementProps,
  Handle,
  MixinFactory,
  MixinHandle,
  RemixNode,
} from '@remix-run/component'

import { getCheckboxGroup, type CheckboxGroupItem } from './checkbox-group.ts'
import { ItemContext as FieldItemContext, type FieldItemContextValue } from './field.ts'
import {
  activationKeys,
  createFieldChange,
  checkableFieldAttrs,
  checkableLabelledBy,
  flag,
  NO_FIELD,
  renderHiddenInput,
  renderUncheckedValueInput,
  resolveLabelId,
  type CheckableField,
} from './lib/checkable.ts'
import { splitOptions } from './lib/collapsible-panel.ts'
import { connectFieldControl, FieldProvider, type FieldControl } from './lib/field-control.ts'
import { createPresence } from './lib/presence.ts'

const CHECKBOX_CHANGE_EVENT = 'stems:checkbox-change' as const

declare global {
  interface HTMLElementEventMap {
    [CHECKBOX_CHANGE_EVENT]: CheckboxChangeEvent
  }
}

/**
 * Bubbling event dispatched from the checkbox root (`stems:checkbox-change`) after the user ticks
 * or unticks the checkbox.
 */
export class CheckboxChangeEvent extends Event {
  /** The next checked state. */
  readonly checked: boolean
  /** The checkbox's `value` (or `name`) option, if any. */
  readonly value: string | undefined

  constructor(checked: boolean, value: string | undefined) {
    super(CHECKBOX_CHANGE_EVENT, { bubbles: true })
    this.checked = checked
    this.value = value
  }
}

type CheckboxChangeHandler<target extends HTMLElement> = (
  event: Dispatched<CheckboxChangeEvent, target>,
  signal: AbortSignal,
) => void | Promise<void>

/** Props for `<checkbox.Context>`. They match Base UI's `Checkbox.Root` props. */
export interface CheckboxContextProps {
  children?: RemixNode
  /** Whether the checkbox is ticked. Controlled when not `undefined`. Ignored inside a group. */
  checked?: boolean
  /**
   * Whether the checkbox is initially ticked (uncontrolled). Ignored inside a group.
   * @default false
   */
  defaultChecked?: boolean
  /** Called with the next checked state and the DOM event that caused the change. */
  onCheckedChange?: (checked: boolean, event: Event) => void
  /**
   * Whether the checkbox is in a mixed state: neither ticked nor unticked. A parent checkbox
   * computes this from its group instead.
   * @default false
   */
  indeterminate?: boolean
  /**
   * Whether the checkbox ignores user interaction. Also disables the hidden input. An enclosing
   * group, `<field.ItemContext disabled>`, `<field.Context disabled>` or
   * `<fieldset.Context disabled>` also disables it.
   * @default false
   */
  disabled?: boolean
  /**
   * Whether the user is unable to tick or untick the checkbox.
   * @default false
   */
  readOnly?: boolean
  /**
   * Whether the checkbox must be ticked before the form can be submitted.
   * @default false
   */
  required?: boolean
  /**
   * Identifies the field when a form is submitted. An enclosing `field.Context`'s `name` wins
   * (for a checkbox in a group inside a field too: each ticked checkbox submits its `value`
   * under the field's name).
   */
  name?: string
  /**
   * Identifies the checkbox inside a checkbox group (falls back to `name`). Submitted with the
   * form while ticked; without it, a ticked checkbox submits `"on"`, like a native checkbox.
   */
  value?: string
  /** Value submitted when the checkbox is unticked. By default nothing is submitted. */
  uncheckedValue?: string
  /** The id of the form that owns the hidden input. */
  form?: string
  /**
   * The id of the hidden input, for `<label for>` association with a non-`<button>` root.
   * With a `<button>` root, put `id` on the button instead. Inside a `field.Context` (or a
   * `field.ItemContext`), the hidden input gets the field's (or item's) control id unless this
   * is set.
   */
  id?: string
  /** Receives the hidden `<input type="checkbox">` and a signal aborted when it is removed. */
  inputRef?: (input: HTMLInputElement, signal: AbortSignal) => void
  /**
   * Whether the checkbox ticks and unticks every checkbox in the enclosing checkbox group
   * (listed in the group's `allValues`), and shows the mixed state when some are ticked.
   * @default false
   */
  parent?: boolean
}

/** State provided by `<checkbox.Context>`, readable with `handle.context.get(checkbox.Context)`. */
export interface CheckboxContextValue {
  readonly checked: boolean
  readonly indeterminate: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly required: boolean
}

export interface CheckboxIndicatorOptions {
  /**
   * Keep the indicator visible while unticked. Otherwise it is `hidden` once its exit animation
   * finishes.
   * @default false
   */
  keepMounted?: boolean
}

interface CheckboxInternals {
  readonly labelId: string | undefined
  /** The `aria-controls` of a parent checkbox. */
  readonly controls: string | undefined
  /** The default root id of a child checkbox in a group with a parent checkbox. */
  readonly rootId: string | undefined
  /** The enclosing field's (or field item's) wiring for the root and indicator. */
  readonly field: CheckableField
  setRoot(node: HTMLElement | undefined): void
  toggle(event: Event): void
  update(): void
  focus(): void
  blur(event: FocusEvent): void
}

const internalsByContext = new WeakMap<CheckboxContextValue, CheckboxInternals>()

function CheckboxProvider(
  handle: Handle<CheckboxContextProps, CheckboxContextValue>,
): () => RemixNode {
  let group = getCheckboxGroup(handle)
  let uncontrolledChecked = handle.props.defaultChecked ?? false
  let root: HTMLElement | undefined
  let input: HTMLInputElement | undefined
  let labelId: string | undefined
  let groupEntry: CheckboxGroupItem = {
    disabled: false,
    getNode: () => root,
    getInput: () => input,
  }
  let registeredValue: string | undefined

  handle.signal.addEventListener('abort', () => {
    if (registeredValue !== undefined) group?._unregister(registeredValue, groupEntry)
  })

  // Field integration. A checkbox in a group belongs to the group's field (the group is the
  // field's control); a `field.ItemContext` around it gives it its own label and descriptions.
  // A standalone checkbox (or one in a field nested inside the group) is the field's control.
  let nearestField = handle.context.get(FieldProvider)
  let groupOwnsField = group !== undefined && (!nearestField || nearestField === group._field)
  let fieldChange = createFieldChange<boolean>()
  let fieldControl: FieldControl | undefined = groupOwnsField
    ? undefined
    : connectFieldControl(handle, {
        getValue: () => fieldChange.read(getChecked),
        getValidityElement: () => input,
        getFocusElement: () => root,
        isFilled: (checked) => checked === true,
      })
  let maybeItem = handle.context.get(FieldItemContext) as FieldItemContextValue | undefined
  let item =
    groupOwnsField && maybeItem && maybeItem._field === group!._field ? maybeItem : undefined
  item?._connect(() => root, handle.signal)
  if (groupOwnsField) group!._addMember(groupEntry, handle.signal)
  let fieldDisabled = false
  let field: CheckableField = NO_FIELD

  function getItemValue() {
    return handle.props.value ?? handle.props.name
  }

  function isParent() {
    return group !== undefined && handle.props.parent === true
  }

  /** The value that identifies this checkbox in its group, when it is a group member. */
  function getGroupValue() {
    if (!group || isParent()) return undefined
    return getItemValue()
  }

  function isControlled() {
    return handle.props.checked !== undefined
  }

  function getChecked() {
    if (isParent()) return group!._parentState().checked
    let groupValue = getGroupValue()
    if (groupValue !== undefined) return group!._isChecked(groupValue)
    return isControlled() ? handle.props.checked === true : uncontrolledChecked
  }

  function getIndeterminate() {
    if (isParent()) return group!._parentState().indeterminate
    return handle.props.indeterminate === true
  }

  function isDisabled() {
    return handle.props.disabled === true || group?.disabled === true || fieldDisabled
  }

  function isInert() {
    return isDisabled() || handle.props.readOnly === true
  }

  function commit(nextChecked: boolean, event: Event) {
    if (isInert()) return
    if (!isParent() && nextChecked === getChecked()) return

    let groupValue = getGroupValue()
    if (!isParent() && groupValue === undefined && !isControlled()) {
      uncontrolledChecked = nextChecked
      void handle.update()
    }

    if (fieldControl && !isParent() && groupValue === undefined) {
      fieldChange.report(fieldControl, nextChecked, event)
    }
    handle.props.onCheckedChange?.(nextChecked, event)
    let origin = root ?? input
    origin?.dispatchEvent(new CheckboxChangeEvent(nextChecked, getItemValue()))

    if (isParent()) {
      group!._toggleParent(event, origin)
    } else if (groupValue !== undefined) {
      group!._setItem(groupValue, nextChecked, event, origin)
    }
    // A controlled (or parent) checkbox whose state didn't follow the input snaps back: Remix
    // restores the controlled `checked` property after the `change` event.
  }

  function syncLabel() {
    let nextLabelId = resolveLabelId(root, input, `${handle.id}-label`)
    if (nextLabelId !== labelId) {
      labelId = nextLabelId
      void handle.update()
    }
  }

  let context: CheckboxContextValue = {
    get checked() {
      return getChecked()
    },
    get indeterminate() {
      return getIndeterminate()
    },
    get disabled() {
      return isDisabled()
    },
    get readOnly() {
      return handle.props.readOnly === true
    },
    get required() {
      return handle.props.required === true
    },
  }

  internalsByContext.set(context, {
    get labelId() {
      return labelId
    },
    get controls() {
      return isParent() ? group!._controls() : undefined
    },
    get rootId() {
      let groupValue = getGroupValue()
      if (groupValue === undefined || !group!.allValues?.includes(groupValue)) return undefined
      return group!._itemId(groupValue)
    },
    get field() {
      return field
    },
    focus() {
      if (groupOwnsField) group!._fieldFocus()
      else fieldControl?.focus()
    },
    blur(event) {
      if (groupOwnsField) group!._fieldBlur(event)
      else fieldControl?.blur()
    },
    setRoot(node) {
      root = node
    },
    toggle(event) {
      if (isInert()) return
      // Route through the hidden input so native `input`/`change` events fire for forms.
      if (input?.isConnected) {
        input.click()
      } else {
        commit(!getChecked(), event)
      }
    },
    update() {
      void handle.update()
    },
  })

  handle.context.set(context)

  return () => {
    let { children, form, required, uncheckedValue, value } = handle.props
    let checked = getChecked()
    let indeterminate = getIndeterminate()
    let id = handle.props.id
    let name = handle.props.name

    if (fieldControl) {
      let f = fieldControl.render({
        value: checked,
        id,
        disabled: handle.props.disabled === true,
        name,
      })
      fieldDisabled = f.disabled
      field = f.inField ? f : NO_FIELD
      id = f.id
      name = f.name
    } else if (group) {
      let f = group._fieldState()
      item?._setControlId(id, handle)
      fieldDisabled = item?.disabled === true
      field = f.inField
        ? {
            labelId: item?.labelId,
            describedBy: item?.describedBy,
            invalid: f.invalid,
            dataAttrs: f.dataAttrs,
          }
        : NO_FIELD
      id ??= item?.controlId
      // Each ticked checkbox submits its value under the field's name; the parent submits
      // nothing unless it has a name of its own.
      if (!isParent()) name = f.name ?? name
    }
    let disabled = isDisabled()

    let groupValue = getGroupValue()
    if (registeredValue !== undefined && registeredValue !== groupValue) {
      group?._unregister(registeredValue, groupEntry)
    }
    groupEntry.disabled = disabled
    if (groupValue !== undefined) group!._register(groupValue, groupEntry)
    registeredValue = groupValue

    handle.queueTask(() => {
      // `indeterminate` is a property only; it has no content attribute.
      if (input) input.indeterminate = indeterminate
      syncLabel()
    })

    return [
      children,
      renderHiddenInput({
        type: 'checkbox',
        id,
        name,
        value,
        form,
        checked,
        disabled,
        required: required === true,
        isInert,
        bindInput(node, signal) {
          input = node
          signal.addEventListener('abort', () => {
            if (input === node) input = undefined
          })
        },
        inputRef: handle.props.inputRef,
        onChange(event) {
          commit(event.currentTarget.checked, event)
        },
        getFocusTarget: () => root,
      }),
      renderUncheckedValueInput({ checked, name, uncheckedValue, form, disabled }),
    ]
  }
}

function getCheckboxContext(handle: MixinHandle<HTMLElement, ElementProps>, part: string) {
  let context = handle.context.get(CheckboxProvider) as CheckboxContextValue | undefined
  if (!context) {
    throw new Error(`checkbox.${part}() must be rendered inside <checkbox.Context>`)
  }
  return context
}

function stateAttributes(context: CheckboxContextValue, field: CheckableField, root: boolean) {
  let { checked, indeterminate } = context
  return {
    ...checkableFieldAttrs(field, { root }),
    // Like Base UI, the mixed state replaces both `data-checked` and `data-unchecked`.
    'data-checked': flag(!indeterminate && checked),
    'data-unchecked': flag(!indeterminate && !checked),
    'data-indeterminate': flag(indeterminate),
    'data-disabled': flag(context.disabled),
    'data-readonly': flag(context.readOnly),
    'data-required': flag(context.required),
  }
}

const rootMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle, hostType) => {
  let context = getCheckboxContext(handle, 'root')
  let internals = internalsByContext.get(context)!
  let isButton = hostType === 'button'

  return (props) => {
    let { checked, indeterminate, disabled, readOnly, required } = context
    let hasName = props['aria-label'] !== undefined || props['aria-labelledby'] !== undefined
    let controls = internals.controls

    if (controls !== undefined) {
      // Child roots with an explicit `id` are only known after they mount.
      handle.queueTask((node) => {
        let next = internals.controls
        if (next && node.getAttribute('aria-controls') !== next && !props['aria-controls']) {
          node.setAttribute('aria-controls', next)
        }
      })
    }

    return [
      // ARIA values are strings: the server renderer serializes boolean `true` as a bare
      // attribute and drops `false`, which differs from the client.
      attrs({
        role: 'checkbox',
        id: internals.rootId,
        type: isButton ? 'button' : undefined,
        'aria-checked': indeterminate ? 'mixed' : checked ? 'true' : 'false',
        'aria-controls': controls,
        'aria-disabled': !isButton && disabled ? 'true' : undefined,
        'aria-readonly': readOnly ? 'true' : undefined,
        'aria-required': required ? 'true' : undefined,
        'aria-labelledby': checkableLabelledBy({
          isButton,
          hasName,
          fieldLabelId: internals.field.labelId,
          inputLabelId: internals.labelId,
        }),
        disabled: isButton && disabled ? true : undefined,
        tabIndex: isButton || disabled ? undefined : 0,
        ...stateAttributes(context, internals.field, true),
      }),
      ref((node: HTMLElement, signal) => {
        internals.setRoot(node)
        signal.addEventListener('abort', () => internals.setRoot(undefined))
      }),
      on<HTMLElement, 'focus'>('focus', () => internals.focus()),
      on<HTMLElement, 'blur'>('blur', (event) => internals.blur(event)),
      on<HTMLElement, 'click'>('click', (event) => {
        // Stops a wrapping <label> from also activating the hidden input, and a <button> root
        // from submitting its form.
        event.preventDefault()
        internals.toggle(event)
      }),
      on<HTMLElement, 'keydown'>('keydown', (event) => {
        // Checkboxes toggle with Space only (WAI-ARIA APG); Enter must not activate a <button>
        // root or submit a form.
        if (event.target === event.currentTarget && event.key === 'Enter') event.preventDefault()
      }),
      !isButton && activationKeys({ enter: false }),
    ]
  }
})

const indicatorMixin: MixinFactory<
  HTMLElement,
  [options?: CheckboxIndicatorOptions],
  ElementProps
> = createMixin<HTMLElement, [options?: CheckboxIndicatorOptions], ElementProps>((handle) => {
  let context = getCheckboxContext(handle, 'indicator')
  let internals = internalsByContext.get(context)!
  let presence = createPresence(handle, { update: () => internals.update() })

  return (options, props) => {
    ;[options] = splitOptions(options, props)
    let visible = context.checked || context.indeterminate
    presence.sync(visible)
    return attrs({
      'aria-hidden': 'true',
      hidden: options?.keepMounted || presence.present ? undefined : true,
      ...stateAttributes(context, internals.field, false),
      ...presence.attrs(),
    })
  }
})

/**
 * Provider that owns the checkbox state and renders the hidden `<input type="checkbox">` used for
 * form participation, right after its children. Inside `<checkboxGroup.Context>`, the state comes
 * from the group. Inside a `<field.Context>`, a standalone checkbox is the field's control (the
 * hidden input gets the field's control id, `name`, and validates `required`); in a group the
 * group is, and a `<field.ItemContext>` labels each checkbox.
 */
export const Context = CheckboxProvider

/**
 * Wires the checkbox control: `role="checkbox"`, `aria-checked` (`"mixed"` when indeterminate),
 * focus, click, and Space activation. Use a `<span>` or `<button>` host (not an `<input>`).
 */
export const root = rootMixin

/**
 * Mirrors the checkbox state attributes onto its indicator. The indicator is `hidden` while
 * unticked (after any exit animation) unless `keepMounted` is set.
 */
export const indicator = indicatorMixin

/** Listens for the bubbling `stems:checkbox-change` event. */
export function onCheckboxChange<target extends HTMLElement>(
  handler: CheckboxChangeHandler<target>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof CHECKBOX_CHANGE_EVENT>> {
  return on(CHECKBOX_CHANGE_EVENT, handler, captureBoolean)
}
