import { attrs, createMixin, on } from '@remix-run/component'
import type { Dispatched, ElementProps, MixinFactory } from '@remix-run/component'

const TOGGLE_BUTTON_CHANGE_EVENT = 'stems:toggle-button-change' as const

declare global {
  interface HTMLElementEventMap {
    [TOGGLE_BUTTON_CHANGE_EVENT]: ToggleButtonChangeEvent
  }
}

/**
 * Bubbling event dispatched from a toggle button (`stems:toggle-button-change`) after the user
 * presses or releases it.
 */
export class ToggleButtonChangeEvent extends Event {
  /** The next pressed state. */
  readonly pressed: boolean
  /** The toggle button's `value` option, if any. */
  readonly value: string | undefined

  constructor(pressed: boolean, value: string | undefined) {
    super(TOGGLE_BUTTON_CHANGE_EVENT, { bubbles: true })
    this.pressed = pressed
    this.value = value
  }
}

type ToggleButtonChangeHandler<target extends HTMLElement> = (
  event: Dispatched<ToggleButtonChangeEvent, target>,
  signal: AbortSignal,
) => void | Promise<void>

/** Options for `toggleButton()`. They match Base UI's `Toggle` props. */
export interface ToggleButtonOptions {
  /** Whether the button is pressed. Controlled when not `undefined`. */
  pressed?: boolean
  /**
   * Whether the button is initially pressed (uncontrolled).
   * @default false
   */
  defaultPressed?: boolean
  /** Called with the next pressed state and the DOM event that caused the change. */
  onPressedChange?: (pressed: boolean, event: Event) => void
  /**
   * Whether the button ignores user interaction. A `disabled` host prop works too.
   * @default false
   */
  disabled?: boolean
  /** Identifies the button inside a future toggle button group. Included in change events. */
  value?: string
}

function isTrue(value: unknown) {
  return value === true || value === 'true' || value === ''
}

const toggleButtonMixin: MixinFactory<HTMLElement, [options: ToggleButtonOptions], ElementProps> =
  createMixin<HTMLElement, [options: ToggleButtonOptions], ElementProps>((handle, hostType) => {
    let isButton = hostType === 'button'
    let uncontrolledPressed: boolean | undefined

    function getPressed(options: ToggleButtonOptions) {
      if (options.pressed !== undefined) return options.pressed
      uncontrolledPressed ??= options.defaultPressed ?? false
      return uncontrolledPressed
    }

    return (options, props) => {
      let pressed = getPressed(options)
      let disabled =
        options.disabled === true || isTrue(props.disabled) || isTrue(props['aria-disabled'])

      function setPressed(nextPressed: boolean, event: Event) {
        if (options.pressed === undefined) {
          uncontrolledPressed = nextPressed
          void handle.update()
        }

        options.onPressedChange?.(nextPressed, event)
        ;(event.currentTarget as HTMLElement).dispatchEvent(
          new ToggleButtonChangeEvent(nextPressed, options.value),
        )
      }

      return [
        // ARIA values are strings: the server renderer serializes boolean `true` as a bare
        // attribute and drops `false`, which differs from the client.
        attrs({
          type: isButton ? 'button' : undefined,
          role: isButton ? undefined : 'button',
          'aria-pressed': pressed ? 'true' : 'false',
          'aria-disabled': !isButton && disabled ? 'true' : undefined,
          disabled: isButton && disabled ? true : undefined,
          tabIndex: isButton || disabled ? undefined : 0,
          'data-pressed': pressed ? '' : undefined,
          'data-disabled': disabled ? '' : undefined,
        }),
        on<HTMLElement, 'click'>('click', (event) => {
          if (disabled) {
            event.preventDefault()
            return
          }
          setPressed(!pressed, event)
        }),
        !isButton &&
          on<HTMLElement, 'keydown'>('keydown', (event) => {
            if (event.target !== event.currentTarget) return
            if (event.key === ' ') {
              // Prevent page scroll; activation happens on keyup, like a native button.
              event.preventDefault()
            } else if (event.key === 'Enter') {
              event.preventDefault()
              event.currentTarget.click()
            }
          }),
        !isButton &&
          on<HTMLElement, 'keyup'>('keyup', (event) => {
            if (event.target !== event.currentTarget || event.key !== ' ') return
            event.currentTarget.click()
          }),
      ]
    }
  })

/**
 * Wires a two-state toggle button: `aria-pressed`, `data-pressed`, click and keyboard
 * activation. Prefer a `<button>` host; other hosts get `role="button"` and keyboard support.
 */
export function toggleButton<node extends HTMLElement = HTMLElement>(
  options: ToggleButtonOptions = {},
): ReturnType<typeof toggleButtonMixin<node>> {
  // Always pass `options`: the runtime appends host props after the factory arguments, so an
  // omitted argument would shift the props into the `options` slot.
  return toggleButtonMixin<node>(options)
}

/** Listens for the bubbling `stems:toggle-button-change` event. */
export function onToggleButtonChange<target extends HTMLElement>(
  handler: ToggleButtonChangeHandler<target>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof TOGGLE_BUTTON_CHANGE_EVENT>> {
  return on(TOGGLE_BUTTON_CHANGE_EVENT, handler, captureBoolean)
}
