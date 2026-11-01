// Adapted from @remix-run/ui 0.13.0 (packages/ui/src/toggle.ts).
// https://github.com/remix-run/remix - Copyright (c) 2025 Shopify Inc. MIT License.

import { attrs, createElement, createMixin, on, ref } from '@remix-run/component'
import type {
  Dispatched,
  ElementProps,
  Handle,
  MixinFactory,
  MixinHandle,
  RemixNode,
} from '@remix-run/component'

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
   * Whether the switch ignores user interaction. Also disables the hidden input.
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
  /** Identifies the field when a form is submitted. */
  name?: string
  /** Value submitted when the switch is on. Defaults to `"on"`, like a native checkbox. */
  value?: string
  /** Value submitted when the switch is off. By default nothing is submitted. */
  uncheckedValue?: string
  /** The id of the form that owns the hidden input. */
  form?: string
  /**
   * The id of the hidden input, for `<label for>` association with a non-`<button>` root.
   * With a `<button>` root, put `id` on the button instead.
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
  setRoot(node: HTMLElement | undefined): void
  toggle(event: Event): void
}

const internalsByContext = new WeakMap<SwitchContextValue, SwitchInternals>()

// Mirrors Base UI's visually hidden input: still focusable by the browser for validation, but
// invisible and removed from the accessibility tree.
const hiddenInputStyle = {
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
} as const

function SwitchProvider(handle: Handle<SwitchContextProps, SwitchContextValue>): () => RemixNode {
  let uncontrolledChecked = handle.props.defaultChecked ?? false
  let root: HTMLElement | undefined
  let input: HTMLInputElement | undefined
  let labelId: string | undefined

  function isControlled() {
    return handle.props.checked !== undefined
  }

  function getChecked() {
    return isControlled() ? handle.props.checked === true : uncontrolledChecked
  }

  function isInert() {
    return handle.props.disabled === true || handle.props.readOnly === true
  }

  function commit(nextChecked: boolean, event: Event) {
    if (isInert() || nextChecked === getChecked()) return

    if (!isControlled()) {
      uncontrolledChecked = nextChecked
      void handle.update()
    }

    handle.props.onCheckedChange?.(nextChecked, event)
    ;(root ?? input)?.dispatchEvent(new SwitchChangeEvent(nextChecked))
  }

  // A non-button root is not labelable, so a wrapping `<label>` (or `<label for>` pointing at the
  // hidden input) does not name it. Point `aria-labelledby` at that label instead.
  function syncLabel() {
    if (!root || !input || root.localName === 'button') return
    let label = input.labels?.[0]
    let nextLabelId: string | undefined
    if (label) {
      if (!label.id) label.id = `${handle.id}-label`
      nextLabelId = label.id
    }
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
      return handle.props.disabled === true
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
  })

  handle.context.set(context)

  return () => {
    let { children, disabled, form, id, name, required, uncheckedValue, value } = handle.props
    let checked = getChecked()

    // Runs after this render commits, once the root and hidden input refs are bound.
    handle.queueTask(syncLabel)

    return [
      children,
      createElement('input', {
        type: 'checkbox',
        id,
        name,
        value,
        form,
        checked,
        disabled: disabled || undefined,
        required: required || undefined,
        'aria-hidden': 'true',
        tabIndex: -1,
        style: hiddenInputStyle,
        mix: [
          ref((node: HTMLInputElement, signal) => {
            input = node
            handle.props.inputRef?.(node, signal)
            signal.addEventListener('abort', () => {
              if (input === node) input = undefined
            })
          }),
          on<HTMLInputElement, 'click'>('click', (event) => {
            // Checkboxes ignore `readonly`; cancelling the click restores the checked state.
            if (isInert()) event.preventDefault()
          }),
          on<HTMLInputElement, 'change'>('change', (event) => {
            commit(event.currentTarget.checked, event)
          }),
          on<HTMLInputElement, 'focus'>('focus', () => {
            // Browser validation (and some label clicks) focus the hidden input.
            root?.focus()
          }),
        ],
      }),
      !checked && uncheckedValue !== undefined && name !== undefined
        ? createElement('input', {
            type: 'hidden',
            name,
            value: uncheckedValue,
            form,
            disabled: disabled || undefined,
          })
        : null,
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

function stateAttributes(context: SwitchContextValue) {
  return {
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
        'aria-labelledby': isButton || hasName ? undefined : internals.labelId,
        disabled: isButton && disabled ? true : undefined,
        tabIndex: isButton || disabled ? undefined : 0,
        ...stateAttributes(context),
      }),
      ref((node: HTMLElement, signal) => {
        internals.setRoot(node)
        signal.addEventListener('abort', () => internals.setRoot(undefined))
      }),
      on<HTMLElement, 'click'>('click', (event) => {
        // Stops a wrapping <label> from also activating the hidden input, and a <button> root
        // from submitting its form.
        event.preventDefault()
        internals.toggle(event)
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

const thumbMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let context = getSwitchContext(handle, 'thumb')
  return () => attrs(stateAttributes(context))
})

/**
 * Provider that owns the switch state and renders the hidden `<input type="checkbox">` used for
 * form participation, right after its children.
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
