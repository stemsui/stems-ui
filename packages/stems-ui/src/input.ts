import { attrs, createMixin, on } from '@remix-run/component'
import type { Dispatched, ElementProps, MixinFactory } from '@remix-run/component'

import { connectFieldControl } from './lib/field-control.ts'

const INPUT_CHANGE_EVENT = 'stems:input-change' as const

export type InputValue = string | number

export interface InputOptions {
  /** The value of the input. Use when controlled. */
  value?: InputValue
  /** The default value of the input. Use when uncontrolled. */
  defaultValue?: InputValue
  /** Called with the next value whenever the user changes it. */
  onValueChange?: (value: string, event: Event) => void
  /**
   * Whether the input should ignore user interaction. Falls back to the host's `disabled` prop.
   * An enclosing `<field.Context disabled>` (or `<fieldset.Context disabled>`) also disables it.
   * @default false
   */
  disabled?: boolean
}

/** Interaction state reflected as data attributes outside a Field. */
export interface InputState {
  disabled: boolean
  focused: boolean
  touched: boolean
  dirty: boolean
  filled: boolean
}

export class InputChangeEvent extends Event {
  readonly value: string

  constructor(value: string) {
    super(INPUT_CHANGE_EVENT, { bubbles: true })
    this.value = value
  }
}

declare global {
  interface HTMLElementEventMap {
    [INPUT_CHANGE_EVENT]: InputChangeEvent
  }
}

type InputChangeHandler<target extends HTMLElement> = (
  event: Dispatched<InputChangeEvent, target>,
  signal: AbortSignal,
) => void | Promise<void>

function readArgs<options>(args: readonly unknown[]): [options, ElementProps] {
  return args.length > 1
    ? [(args[0] ?? {}) as options, args[1] as ElementProps]
    : [{} as options, (args[0] ?? {}) as ElementProps]
}

function toText(value: unknown): string {
  return value === undefined || value === null ? '' : String(value)
}

const STATE_ATTRIBUTES = ['focused', 'touched', 'dirty', 'filled'] as const

/** Hosts `input()` (and `field.control()`) supports. */
export type InputElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

const inputMixin: MixinFactory<InputElement, [options?: InputOptions], ElementProps> = createMixin<
  InputElement,
  [options?: InputOptions],
  ElementProps
>((handle) => {
  // Inside a <field.Context>, the field owns the state, ids and validation. Outside, the
  // connection is inert and the local flags below drive the data attributes.
  let fieldControl = connectFieldControl(handle)
  let initialValue: string | undefined
  // The DOM value in uncontrolled mode, once the user has typed.
  let uncontrolledValue: string | undefined
  let focused = false
  let touched = false

  function getState(value: string, disabled: boolean): InputState {
    return {
      disabled,
      focused,
      touched,
      dirty: value !== initialValue,
      filled: value !== '',
    }
  }

  // Standalone interaction state changes between renders are written straight to the node. A
  // mixin `handle.update()` would re-render with the host props from the last full render.
  // Inside a field, the field re-renders its parts instead.
  function sync(node: InputElement, value: string, disabled: boolean) {
    if (fieldControl.inField) return
    let state = getState(value, disabled)
    for (let name of STATE_ATTRIBUTES) node.toggleAttribute(`data-${name}`, state[name])
  }

  return (...args) => {
    let [options, props] = readArgs<InputOptions>(args)
    let controlledValue = options.value ?? props.value
    let controlled = controlledValue !== undefined
    let defaultValue = options.defaultValue ?? props.defaultValue
    let hasKnownValue = controlled || defaultValue !== undefined

    initialValue ??= toText(controlled ? controlledValue : defaultValue)

    let currentValue = controlled
      ? toText(controlledValue)
      : (uncontrolledValue ?? toText(defaultValue))
    let ownDisabled = options.disabled ?? props.disabled === true
    let f = fieldControl.render({
      // A <select> without a value is filled with its first option; let the field read it.
      value: hasKnownValue || uncontrolledValue !== undefined ? currentValue : undefined,
      id: typeof props.id === 'string' ? props.id : undefined,
      disabled: ownDisabled,
      name: typeof props.name === 'string' ? props.name : undefined,
      local: getState(currentValue, ownDisabled),
    })
    let disabled = f.disabled

    // Only pass `value` / `defaultValue` when the options set them. `attrs()` copies keys whose
    // value is `undefined`, and an explicit `value: undefined` makes Remix clear the input,
    // which wiped uncontrolled default values.
    let valueProps: ElementProps = {}
    if (options.value !== undefined) valueProps.value = options.value
    if (!controlled && options.defaultValue !== undefined) {
      valueProps.defaultValue = options.defaultValue
    }

    return [
      attrs({
        ...valueProps,
        ...f.attrs,
        name: f.inField ? f.name : undefined,
        disabled: options.disabled || (f.inField && disabled) || undefined,
      }),
      on('input', (event) => {
        let node = event.currentTarget
        let value = node.value
        if (!controlled) uncontrolledValue = value
        sync(node, value, disabled)
        fieldControl.change(value, event)
        options.onValueChange?.(value, event)
        node.dispatchEvent(new InputChangeEvent(value))
      }),
      on('focus', (event) => {
        focused = true
        sync(event.currentTarget, event.currentTarget.value, disabled)
        fieldControl.focus()
      }),
      on('blur', (event) => {
        focused = false
        touched = true
        sync(event.currentTarget, event.currentTarget.value, disabled)
        fieldControl.blur()
      }),
    ]
  }
})

/**
 * Wires a native `<input>` (or `<textarea>` / `<select>`) with controlled/uncontrolled value
 * handling and Base UI's state data attributes (`data-disabled`, `data-focused`, `data-touched`,
 * `data-dirty`, `data-filled`). Inside a `<field.Context>` it is the field's control: it gets
 * the field's ids, `name`, `disabled`, `aria-invalid` / `aria-describedby`, and the field's
 * state attributes (adding `data-valid` / `data-invalid`). `field.control()` is this mixin.
 */
export const input = inputMixin

/** Listens for `stems:input-change`, dispatched after every user edit. */
export function onInputChange<target extends HTMLElement>(
  handler: InputChangeHandler<target>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof INPUT_CHANGE_EVENT>> {
  return on(INPUT_CHANGE_EVENT, handler, captureBoolean)
}
