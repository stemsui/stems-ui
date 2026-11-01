// Adapted from @remix-run/ui 0.13.0 (packages/ui/src/toggle.ts).
// https://github.com/remix-run/remix - Copyright (c) 2025 Shopify Inc. MIT License.

import { attrs, createMixin, on, ref } from '@remix-run/component'
import type {
  Dispatched,
  ElementProps,
  Handle,
  MixinFactory,
  MixinHandle,
  RemixNode,
} from '@remix-run/component'

import {
  activationKeys,
  createFieldChange,
  checkableFieldAttrs,
  checkableLabelledBy,
  NO_FIELD,
  renderHiddenInput,
  renderUncheckedValueInput,
  resolveLabelId,
  type CheckableField,
} from './lib/checkable.ts'
import { connectFieldControl } from './lib/field-control.ts'

const SWITCH_CHANGE_EVENT = 'stems:switch-change' as const

declare global {
  interface HTMLElementEventMap {
    [SWITCH_CHANGE_EVENT]: SwitchChangeEvent
  }
}

/**
 * Bubbling event dispatched from the switch root (`stems:switch-change`) after the user
 * activates or deactivates the switch.
 */
export class SwitchChangeEvent extends Event {
  /** The next checked state. */
  readonly checked: boolean

  constructor(checked: boolean) {
    super(SWITCH_CHANGE_EVENT, { bubbles: true })
    this.checked = checked
  }
}

type SwitchChangeHandler<target extends HTMLElement> = (
  event: Dispatched<SwitchChangeEvent, target>,
  signal: AbortSignal,
) => void | Promise<void>

/** Props for `<switch_.Context>`. They match Base UI's `Switch.Root` props. */
export interface SwitchContextProps {
  children?: RemixNode
  /** Whether the switch is on. Controlled when not `undefined`. */
  checked?: boolean
  /**
   * Whether the switch is initially on (uncontrolled).
   * @default false
   */
  defaultChecked?: boolean
  /** Called with the next checked state and the DOM event that caused the change. */
  onCheckedChange?: (checked: boolean, event: Event) => void
  /**
   * Whether the switch ignores user interaction. Also disables the hidden input. An enclosing
   * `<field.Context disabled>` or `<fieldset.Context disabled>` also disables it.
   * @default false
   */
  disabled?: boolean
  /**
   * Whether the user is unable to change the switch.
   * @default false
   */
  readOnly?: boolean
  /**
   * Whether the switch must be on before the form can be submitted.
   * @default false
   */
  required?: boolean
  /** Identifies the field when a form is submitted. An enclosing `field.Context`'s `name` wins. */
  name?: string
  /** Value submitted when the switch is on. Defaults to `"on"`, like a native checkbox. */
  value?: string
  /** Value submitted when the switch is off. By default nothing is submitted. */
  uncheckedValue?: string
  /** The id of the form that owns the hidden input. */
  form?: string
  /**
   * The id of the hidden input, for `<label for>` association with a non-`<button>` root.
   * With a `<button>` root, put `id` on the button instead. Inside a `field.Context`, the
   * hidden input gets the field's control id unless this is set.
   */
  id?: string
  /** Receives the hidden `<input type="checkbox">` and a signal aborted when it is removed. */
  inputRef?: (input: HTMLInputElement, signal: AbortSignal) => void
}

/** State provided by `<switch_.Context>`, readable with `handle.context.get(switch_.Context)`. */
export interface SwitchContextValue {
  readonly checked: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly required: boolean
}

interface SwitchInternals {
  readonly labelId: string | undefined
  /** The enclosing field's wiring for the root and thumb. */
  readonly field: CheckableField
  setRoot(node: HTMLElement | undefined): void
  toggle(event: Event): void
  focus(): void
  blur(): void
}

const internalsByContext = new WeakMap<SwitchContextValue, SwitchInternals>()

function SwitchProvider(handle: Handle<SwitchContextProps, SwitchContextValue>): () => RemixNode {
  let uncontrolledChecked = handle.props.defaultChecked ?? false
  let root: HTMLElement | undefined
  let input: HTMLInputElement | undefined
  let labelId: string | undefined
  // Inside a <field.Context>, the field owns the id, name, disabled state and validation; the
  // hidden checkbox is its validity element and the root is focused when it is invalid.
  let fieldChange = createFieldChange<boolean>()
  let fieldControl = connectFieldControl(handle, {
    getValue: () => fieldChange.read(getChecked),
    getValidityElement: () => input,
    getFocusElement: () => root,
    isFilled: (checked) => checked === true,
  })
  let fieldDisabled = false
  let field: CheckableField = NO_FIELD

  function isControlled() {
    return handle.props.checked !== undefined
  }

  function getChecked() {
    return isControlled() ? handle.props.checked === true : uncontrolledChecked
  }

  function isDisabled() {
    return handle.props.disabled === true || fieldDisabled
  }

  function isInert() {
    return isDisabled() || handle.props.readOnly === true
  }

  function commit(nextChecked: boolean, event: Event) {
    if (isInert() || nextChecked === getChecked()) return

    if (!isControlled()) {
      uncontrolledChecked = nextChecked
      void handle.update()
    }

    fieldChange.report(fieldControl, nextChecked, event)
    handle.props.onCheckedChange?.(nextChecked, event)
    ;(root ?? input)?.dispatchEvent(new SwitchChangeEvent(nextChecked))
  }

  // A non-button root is not labelable: point `aria-labelledby` at the hidden input's label.
  function syncLabel() {
    let nextLabelId = resolveLabelId(root, input, `${handle.id}-label`)
    if (nextLabelId !== labelId) {
      labelId = nextLabelId
      void handle.update()
    }
  }

  let context: SwitchContextValue = {
    get checked() {
      return getChecked()
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
    get field() {
      return field
    },
    setRoot(node) {
      root = node
    },
    focus() {
      fieldControl.focus()
    },
    blur() {
      fieldControl.blur()
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
  })

  handle.context.set(context)

  return () => {
    let { children, form, required, uncheckedValue, value } = handle.props
    let checked = getChecked()
    let f = fieldControl.render({
      value: checked,
      id: handle.props.id,
      disabled: handle.props.disabled === true,
      name: handle.props.name,
    })
    fieldDisabled = f.disabled
    field = f.inField ? f : NO_FIELD
    let disabled = isDisabled()
    let name = f.name

    // Runs after this render commits, once the root and hidden input refs are bound.
    handle.queueTask(syncLabel)

    return [
      children,
      renderHiddenInput({
        type: 'checkbox',
        id: f.id,
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
      renderUncheckedValueInput({
        checked,
        name,
        uncheckedValue,
        form,
        disabled,
      }),
    ]
  }
}

function getSwitchContext(handle: MixinHandle<HTMLElement, ElementProps>, part: string) {
  let context = handle.context.get(SwitchProvider) as SwitchContextValue | undefined
  if (!context) {
    throw new Error(`switch_.${part}() must be rendered inside <switch_.Context>`)
  }
  return context
}

function stateAttributes(context: SwitchContextValue, field: CheckableField, root: boolean) {
  return {
    ...checkableFieldAttrs(field, { root }),
    'data-checked': context.checked ? '' : undefined,
    'data-unchecked': context.checked ? undefined : '',
    'data-disabled': context.disabled ? '' : undefined,
    'data-readonly': context.readOnly ? '' : undefined,
    'data-required': context.required ? '' : undefined,
  }
}

const rootMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle, hostType) => {
  let context = getSwitchContext(handle, 'root')
  let internals = internalsByContext.get(context)!
  let isButton = hostType === 'button'

  return (props) => {
    let { checked, disabled, readOnly, required } = context
    let hasName = props['aria-label'] !== undefined || props['aria-labelledby'] !== undefined

    return [
      // ARIA values are strings: the server renderer serializes boolean `true` as a bare
      // attribute and drops `false`, which differs from the client.
      attrs({
        role: 'switch',
        type: isButton ? 'button' : undefined,
        'aria-checked': checked ? 'true' : 'false',
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
      on<HTMLElement, 'blur'>('blur', () => internals.blur()),
      on<HTMLElement, 'click'>('click', (event) => {
        // Stops a wrapping <label> from also activating the hidden input, and a <button> root
        // from submitting its form.
        event.preventDefault()
        internals.toggle(event)
      }),
      !isButton && activationKeys({ enter: true }),
    ]
  }
})

const thumbMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let context = getSwitchContext(handle, 'thumb')
  let internals = internalsByContext.get(context)!
  return () => attrs(stateAttributes(context, internals.field, false))
})

/**
 * Provider that owns the switch state and renders the hidden `<input type="checkbox">` used for
 * form participation, right after its children. Inside a `<field.Context>` it is the field's
 * control: the hidden input gets the field's control id and `name`, `required` validates
 * through it, and the root gets the field's label, descriptions and state attributes.
 */
export const Context = SwitchProvider

/**
 * Wires the switch control: `role="switch"`, `aria-checked`, focus, click, and keyboard
 * activation. Use a `<button>` or a `<span>` host (not an `<input>`).
 */
export const root = rootMixin

/** Mirrors the switch state attributes onto the thumb element. */
export const thumb = thumbMixin

/** Listens for the bubbling `stems:switch-change` event. */
export function onSwitchChange<target extends HTMLElement>(
  handler: SwitchChangeHandler<target>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof SWITCH_CHANGE_EVENT>> {
  return on(SWITCH_CHANGE_EVENT, handler, captureBoolean)
}
