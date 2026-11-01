import { attrs, createMixin, on, ref } from '@remix-run/component'
import type {
  ElementProps,
  Handle,
  MixinFactory,
  MixinHandle,
  RemixNode,
} from '@remix-run/component'

import { ItemContext as FieldItemContext, type FieldItemContextValue } from './field.ts'
import { getRadioGroup, type RadioGroupContextValue, type RadioGroupItem } from './radio-group.ts'
import {
  activationKeys,
  checkableFieldAttrs,
  checkableLabelledBy,
  flag,
  NO_FIELD,
  renderHiddenInput,
  resolveLabelId,
  type CheckableField,
} from './lib/checkable.ts'
import { splitOptions } from './lib/collapsible-panel.ts'
import { createPresence } from './lib/presence.ts'

/** Props for `<radio.Context>`. They match Base UI's `Radio.Root` props. */
export interface RadioContextProps {
  children?: RemixNode
  /** Identifies the radio in its group. Submitted with the form while selected. */
  value: string
  /**
   * Whether the radio ignores user interaction. The group's `disabled` (and a
   * `<field.ItemContext disabled>` around the radio) also disables it.
   */
  disabled?: boolean
  /** Whether the user is unable to select the radio. Defaults to the group's `readOnly`. */
  readOnly?: boolean
  /** Whether a radio must be selected before submitting. Defaults to the group's `required`. */
  required?: boolean
  /**
   * The id of the hidden input, for `<label for>` association with a non-`<button>` root.
   * With a `<button>` root, put `id` on the button instead. Inside a `field.ItemContext`, the
   * hidden input gets the item's control id unless this is set.
   */
  id?: string
  /** Receives the hidden `<input type="radio">` and a signal aborted when it is removed. */
  inputRef?: (input: HTMLInputElement, signal: AbortSignal) => void
}

/** State provided by `<radio.Context>`, readable with `handle.context.get(radio.Context)`. */
export interface RadioContextValue {
  readonly value: string
  readonly checked: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly required: boolean
}

export interface RadioIndicatorOptions {
  /**
   * Keep the indicator visible while the radio is not selected. Otherwise it is `hidden` once its
   * exit animation finishes.
   * @default false
   */
  keepMounted?: boolean
}

interface RadioInternals {
  readonly group: RadioGroupContextValue
  readonly entry: RadioGroupItem
  readonly labelId: string | undefined
  /** The group's field state plus the field item's label and descriptions. */
  readonly field: CheckableField
  setRoot(node: HTMLElement | undefined): void
  update(): void
}

const internalsByContext = new WeakMap<RadioContextValue, RadioInternals>()

function RadioProvider(handle: Handle<RadioContextProps, RadioContextValue>): () => RemixNode {
  let maybeGroup = getRadioGroup(handle)
  if (!maybeGroup) {
    throw new Error('<radio.Context> must be rendered inside <radioGroup.Context>')
  }
  let group = maybeGroup
  let root: HTMLElement | undefined
  let input: HTMLInputElement | undefined
  let labelId: string | undefined
  // The group is the field's control; a `field.ItemContext` around the radio gives it its own
  // label and descriptions.
  let maybeItem = handle.context.get(FieldItemContext) as FieldItemContextValue | undefined
  let item = maybeItem && maybeItem._field === group._field ? maybeItem : undefined
  item?._connect(() => root, handle.signal)
  let field: CheckableField = NO_FIELD

  function getChecked() {
    return group.value === handle.props.value
  }

  function isDisabled() {
    return handle.props.disabled === true || group.disabled || item?.disabled === true
  }

  function isReadOnly() {
    return handle.props.readOnly ?? group.readOnly
  }

  function isInert() {
    return isDisabled() || isReadOnly()
  }

  let entry: RadioGroupItem = {
    get value() {
      return handle.props.value
    },
    get disabled() {
      return isDisabled()
    },
    getNode: () => root,
    select(event) {
      if (isInert()) return
      // Route through the hidden input so native `input`/`change` events fire for forms.
      if (input?.isConnected) {
        input.click()
      } else {
        group._select(handle.props.value, event, root)
      }
    },
    syncInput() {
      if (input) input.checked = getChecked()
    },
    getInput: () => input,
  }

  group._register(entry)
  handle.signal.addEventListener('abort', () => group._unregister(entry))

  function syncLabel() {
    let nextLabelId = resolveLabelId(root, input, `${handle.id}-label`)
    if (nextLabelId !== labelId) {
      labelId = nextLabelId
      void handle.update()
    }
  }

  let context: RadioContextValue = {
    get value() {
      return handle.props.value
    },
    get checked() {
      return getChecked()
    },
    get disabled() {
      return isDisabled()
    },
    get readOnly() {
      return isReadOnly()
    },
    get required() {
      return handle.props.required ?? group.required
    },
  }

  internalsByContext.set(context, {
    group,
    entry,
    get labelId() {
      return labelId
    },
    get field() {
      return field
    },
    setRoot(node) {
      root = node
    },
    update() {
      void handle.update()
    },
  })

  handle.context.set(context)

  return () => {
    let { children, value } = handle.props
    // Re-adding keeps the entry registered if the group was swapped out and back.
    group._register(entry)
    handle.queueTask(syncLabel)

    let f = group._fieldState()
    item?._setControlId(handle.props.id, handle)
    let id = handle.props.id ?? item?.controlId
    // `role="radio"` has no `aria-invalid`; the radiogroup gets it.
    field = f.inField
      ? {
          labelId: item?.labelId,
          describedBy: item?.describedBy,
          invalid: false,
          dataAttrs: f.dataAttrs,
        }
      : NO_FIELD

    return [
      children,
      renderHiddenInput({
        type: 'radio',
        id,
        name: group.name,
        value,
        form: group.form,
        checked: getChecked(),
        disabled: isDisabled(),
        required: context.required,
        isInert,
        bindInput(node, signal) {
          input = node
          signal.addEventListener('abort', () => {
            if (input === node) input = undefined
          })
        },
        inputRef: handle.props.inputRef,
        onChange(event) {
          if (event.currentTarget.checked && !isInert()) {
            group._select(handle.props.value, event, root ?? event.currentTarget)
          }
        },
        getFocusTarget: () => root,
      }),
    ]
  }
}

function getRadioContext(handle: MixinHandle<HTMLElement, ElementProps>, part: string) {
  let context = handle.context.get(RadioProvider) as RadioContextValue | undefined
  if (!context) {
    throw new Error(`radio.${part}() must be rendered inside <radio.Context>`)
  }
  return context
}

function stateAttributes(context: RadioContextValue, field: CheckableField, root: boolean) {
  return {
    ...checkableFieldAttrs(field, { root, ariaInvalid: false }),
    'data-checked': flag(context.checked),
    'data-unchecked': flag(!context.checked),
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
  let context = getRadioContext(handle, 'root')
  let internals = internalsByContext.get(context)!
  let isButton = hostType === 'button'

  return (props) => {
    let { checked, disabled } = context
    let hasName = props['aria-label'] !== undefined || props['aria-labelledby'] !== undefined
    let tabbable = internals.group._isTabbable(internals.entry)

    return [
      // ARIA values are strings: the server renderer serializes boolean `true` as a bare
      // attribute and drops `false`, which differs from the client.
      attrs({
        role: 'radio',
        type: isButton ? 'button' : undefined,
        'aria-checked': checked ? 'true' : 'false',
        'aria-disabled': !isButton && disabled ? 'true' : undefined,
        'aria-labelledby': checkableLabelledBy({
          isButton,
          hasName,
          fieldLabelId: internals.field.labelId,
          inputLabelId: internals.labelId,
        }),
        disabled: isButton && disabled ? true : undefined,
        // Roving tabindex: the selected radio (or the first enabled one) is the tab stop.
        tabIndex: disabled ? undefined : tabbable ? 0 : -1,
        ...stateAttributes(context, internals.field, true),
      }),
      ref((node: HTMLElement, signal) => {
        internals.setRoot(node)
        signal.addEventListener('abort', () => internals.setRoot(undefined))
      }),
      on<HTMLElement, 'focus'>('focus', () => internals.group._fieldFocus()),
      on<HTMLElement, 'blur'>('blur', (event) => internals.group._fieldBlur(event)),
      on<HTMLElement, 'click'>('click', (event) => {
        // Stops a wrapping <label> from also activating the hidden input, and a <button> root
        // from submitting its form.
        event.preventDefault()
        internals.entry.select(event)
      }),
      on<HTMLElement, 'keydown'>('keydown', (event) => {
        if (event.target !== event.currentTarget) return
        if (event.key === 'Enter') {
          // Radios select with Space or the arrow keys (WAI-ARIA APG), not Enter.
          event.preventDefault()
          return
        }
        internals.group._navigate(internals.entry, event)
      }),
      !isButton && activationKeys({ enter: false }),
    ]
  }
})

const indicatorMixin: MixinFactory<HTMLElement, [options?: RadioIndicatorOptions], ElementProps> =
  createMixin<HTMLElement, [options?: RadioIndicatorOptions], ElementProps>((handle) => {
    let context = getRadioContext(handle, 'indicator')
    let internals = internalsByContext.get(context)!
    let presence = createPresence(handle, { update: () => internals.update() })

    return (options, props) => {
      ;[options] = splitOptions(options, props)
      presence.sync(context.checked)
      return attrs({
        'aria-hidden': 'true',
        hidden: options?.keepMounted || presence.present ? undefined : true,
        ...stateAttributes(context, internals.field, false),
        ...presence.attrs(),
      })
    }
  })

/**
 * Per-radio provider: identifies the radio in its `<radioGroup.Context>` and renders the hidden
 * `<input type="radio">` used for form participation, right after its children.
 */
export const Context = RadioProvider

/**
 * Wires the radio control: `role="radio"`, `aria-checked`, roving tabindex, click, Space, and
 * arrow-key selection. Use a `<span>` or `<button>` host (not an `<input>`).
 */
export const root = rootMixin

/**
 * Mirrors the radio state attributes onto its indicator. The indicator is `hidden` while the
 * radio is not selected (after any exit animation) unless `keepMounted` is set.
 */
export const indicator = indicatorMixin
