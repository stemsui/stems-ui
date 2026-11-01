import { attrs, createMixin, on } from '@remix-run/component'
import type { Dispatched, ElementProps, MixinFactory } from '@remix-run/component'

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
   * @default false
   */
  disabled?: boolean
}

/** Interaction state reflected as data attributes. */
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

const inputMixin: MixinFactory<HTMLInputElement, [options?: InputOptions], ElementProps> =
  createMixin<HTMLInputElement, [options?: InputOptions], ElementProps>(() => {
    let initialValue: string | undefined
    // The DOM value in uncontrolled mode, once the user has typed.
    let uncontrolledValue: string | undefined
    let focused = false
    let touched = false

    function getState(value: string, disabled: boolean): InputState {
      // TODO(field): a future `field.Context` supplies touched/dirty/valid and data-valid/invalid.
      return {
        disabled,
        focused,
        touched,
        dirty: value !== initialValue,
        filled: value !== '',
      }
    }

    // Interaction state changes between renders are written straight to the node. A mixin
    // `handle.update()` would re-render with the host props from the last full render.
    function sync(node: HTMLInputElement, value: string, disabled: boolean) {
      let state = getState(value, disabled)
      for (let name of STATE_ATTRIBUTES) node.toggleAttribute(`data-${name}`, state[name])
    }

    return (...args) => {
      let [options, props] = readArgs<InputOptions>(args)
      let controlledValue = options.value ?? props.value
      let controlled = controlledValue !== undefined
      let defaultValue = options.defaultValue ?? props.defaultValue

      initialValue ??= toText(controlled ? controlledValue : defaultValue)

      let currentValue = controlled
        ? toText(controlledValue)
        : (uncontrolledValue ?? toText(defaultValue))
      let disabled = options.disabled ?? props.disabled === true
      let state = getState(currentValue, disabled)

      return [
        attrs({
          value: options.value,
          defaultValue: controlled ? undefined : options.defaultValue,
          disabled: options.disabled || undefined,
          'data-disabled': state.disabled ? '' : undefined,
          'data-focused': state.focused ? '' : undefined,
          'data-touched': state.touched ? '' : undefined,
          'data-dirty': state.dirty ? '' : undefined,
          'data-filled': state.filled ? '' : undefined,
        }),
        on('input', (event) => {
          let node = event.currentTarget
          let value = node.value
          if (!controlled) uncontrolledValue = value
          sync(node, value, disabled)
          options.onValueChange?.(value, event)
          node.dispatchEvent(new InputChangeEvent(value))
        }),
        on('focus', (event) => {
          focused = true
          sync(event.currentTarget, event.currentTarget.value, disabled)
        }),
        on('blur', (event) => {
          focused = false
          touched = true
          sync(event.currentTarget, event.currentTarget.value, disabled)
        }),
      ]
    }
  })

/**
 * Wires a native `<input>` with controlled/uncontrolled value handling and Base UI's state data
 * attributes (`data-disabled`, `data-focused`, `data-touched`, `data-dirty`, `data-filled`).
 */
export const input = inputMixin

/** Listens for `stems:input-change`, dispatched after every user edit. */
export function onInputChange<target extends HTMLElement>(
  handler: InputChangeHandler<target>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof INPUT_CHANGE_EVENT>> {
  return on(INPUT_CHANGE_EVENT, handler, captureBoolean)
}
