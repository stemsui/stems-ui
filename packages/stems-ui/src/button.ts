import { attrs, createMixin, on } from '@remix-run/component'
import type { ElementProps, MixinFactory } from '@remix-run/component'

export interface ButtonOptions {
  /**
   * Whether the button should ignore user interaction.
   * Falls back to the host's `disabled` prop.
   * @default false
   */
  disabled?: boolean
  /**
   * Whether the button stays focusable when disabled. The button gets `aria-disabled` instead of
   * the native `disabled` attribute, and activation (click, Enter, Space) is blocked.
   * @default false
   */
  focusableWhenDisabled?: boolean
  /**
   * Whether the host is a native `<button>`. Non-native hosts get `role="button"`, `tabIndex`, and
   * Enter/Space activation.
   * @default true when the host is a `<button>`, otherwise false
   */
  nativeButton?: boolean
}

// The runtime calls mixin renderers with the factory args followed by the host props, so a call
// without options (`button()`) passes the props first.
function readArgs<options>(args: readonly unknown[]): [options, ElementProps] {
  return args.length > 1
    ? [(args[0] ?? {}) as options, args[1] as ElementProps]
    : [{} as options, (args[0] ?? {}) as ElementProps]
}

const buttonMixin: MixinFactory<HTMLElement, [options?: ButtonOptions], ElementProps> = createMixin<
  HTMLElement,
  [options?: ButtonOptions],
  ElementProps
>((_handle, hostType) => {
  return (...args) => {
    let [options, props] = readArgs<ButtonOptions>(args)
    let native = options.nativeButton ?? hostType === 'button'
    let disabled = options.disabled ?? props.disabled === true
    let focusable = options.focusableWhenDisabled === true
    // Activation is guarded in JS whenever the browser won't block it for us.
    let guarded = disabled && (focusable || !native)

    return [
      attrs({
        // Base UI: `type="submit"` must be explicit.
        type: hostType === 'button' ? 'button' : undefined,
        role: native ? undefined : 'button',
        tabIndex: native ? undefined : disabled && !focusable ? -1 : 0,
        disabled: native && disabled && !focusable ? true : undefined,
        'aria-disabled': guarded ? 'true' : undefined,
        'data-disabled': disabled ? '' : undefined,
      }),
      // Capture phase so the guard runs before bubble listeners on the same host.
      on(
        'click',
        (event) => {
          if (!guarded) return
          event.preventDefault()
          event.stopImmediatePropagation()
        },
        true,
      ),
      on('keydown', (event) => {
        if (event.target !== event.currentTarget) return
        let isEnter = event.key === 'Enter'
        let isSpace = event.key === ' '
        if (!isEnter && !isSpace) return

        if (guarded) {
          event.preventDefault()
          return
        }
        if (native) return

        // Space activates on keyup (like a native button); prevent page scroll now.
        event.preventDefault()
        if (isEnter) event.currentTarget.click()
      }),
      on('keyup', (event) => {
        if (native || guarded || event.key !== ' ') return
        if (event.target !== event.currentTarget) return
        event.currentTarget.click()
      }),
    ]
  }
})

/**
 * Wires a host element as a button.
 *
 * Native `<button>` hosts get `type="button"` by default. Other hosts get `role="button"`, a
 * `tabIndex`, and Enter/Space activation. `focusableWhenDisabled` keeps a disabled button
 * focusable (via `aria-disabled`) and blocks its activation. `data-disabled` marks the disabled
 * state for styling.
 */
export const button = buttonMixin
