import { attrs, createElement, createMixin, on, ref } from '@remix-run/component'
import type {
  Dispatched,
  ElementProps,
  Handle,
  MixinFactory,
  MixinHandle,
  RemixNode,
} from '@remix-run/component'

import { createFieldChange } from './lib/checkable.ts'
import { splitOptions } from './lib/collapsible-panel.ts'
import { connectFieldControl, type FieldControlRenderResult } from './lib/field-control.ts'
import { getDirection, horizontalArrowStep } from './lib/direction.ts'
import { normalizeOTPValue, type OTPValidationType } from './lib/otp.ts'

export type { OTPValidationType } from './lib/otp.ts'
export { normalizeOTPValue } from './lib/otp.ts'

const OTP_FIELD_CHANGE_EVENT = 'stems:otp-field-change' as const
const OTP_FIELD_COMPLETE_EVENT = 'stems:otp-field-complete' as const

declare global {
  interface HTMLElementEventMap {
    [OTP_FIELD_CHANGE_EVENT]: OTPFieldChangeEvent
    [OTP_FIELD_COMPLETE_EVENT]: OTPFieldCompleteEvent
  }
}

/** Why the value changed, like Base UI's `OTPField.Root.ChangeEventReason`. */
export type OTPFieldChangeReason = 'input-change' | 'input-clear' | 'input-paste' | 'keyboard'

/** The second argument of `onValueChange`. */
export interface OTPFieldChangeDetails {
  readonly reason: OTPFieldChangeReason
  readonly event: Event
  /** The slot input that triggered the change. */
  readonly trigger: Element | undefined
  /** Call from `onValueChange` to keep the current value. */
  cancel(): void
  readonly isCanceled: boolean
}

/** The second argument of `onValueComplete` and `onValueInvalid`. */
export interface OTPFieldEntryDetails {
  readonly reason: 'input-change' | 'input-paste'
  readonly event: Event
}

/** Bubbling `stems:otp-field-change`, dispatched from the slot after every value change. */
export class OTPFieldChangeEvent extends Event {
  readonly value: string
  readonly reason: OTPFieldChangeReason

  constructor(value: string, reason: OTPFieldChangeReason) {
    super(OTP_FIELD_CHANGE_EVENT, { bubbles: true })
    this.value = value
    this.reason = reason
  }
}

/** Bubbling `stems:otp-field-complete`, dispatched when every slot is filled. */
export class OTPFieldCompleteEvent extends Event {
  readonly value: string

  constructor(value: string) {
    super(OTP_FIELD_COMPLETE_EVENT, { bubbles: true })
    this.value = value
  }
}

type OTPFieldEventHandler<event extends Event, target extends HTMLElement> = (
  event: Dispatched<event, target>,
  signal: AbortSignal,
) => void | Promise<void>

type InputMode = 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search'

/** Props for `<otpField.Context>`. They match Base UI's `OTPField.Root` props. */
export interface OTPFieldContextProps {
  children?: RemixNode
  /** The number of slots. */
  length: number
  /** The value (controlled). */
  value?: string
  /** The initial value (uncontrolled). */
  defaultValue?: string
  /** Called with the next value and the change details. Call `details.cancel()` to veto. */
  onValueChange?: (value: string, details: OTPFieldChangeDetails) => void
  /**
   * Called when the value becomes complete, or when a complete value is pasted into an
   * already complete field.
   */
  onValueComplete?: (value: string, details: OTPFieldEntryDetails) => void
  /** Called with the attempted text when typed or pasted characters are rejected. */
  onValueInvalid?: (value: string, details: OTPFieldEntryDetails) => void
  /**
   * Which characters are accepted.
   * @default 'numeric'
   */
  validationType?: OTPValidationType
  /**
   * Normalizes accepted values (for example to uppercase). Runs after `validationType`
   * filtering; the result is filtered again. Must be idempotent.
   */
  normalizeValue?: (value: string) => string
  /**
   * Whether the slots mask their characters (`type="password"`).
   * @default false
   */
  mask?: boolean
  /** The virtual keyboard hint. Defaults to `numeric` for numeric codes, `text` otherwise. */
  inputMode?: InputMode
  /**
   * The first slot's `autocomplete`.
   * @default 'one-time-code'
   */
  autoComplete?: string
  /**
   * Whether to submit the owning form when the value becomes complete.
   * @default false
   */
  autoSubmit?: boolean
  /**
   * An enclosing `<field.Context disabled>` or `<fieldset.Context disabled>` also disables it.
   * @default false
   */
  disabled?: boolean
  /** @default false */
  readOnly?: boolean
  /** @default false */
  required?: boolean
  /** Identifies the field when a form is submitted. An enclosing `field.Context`'s `name` wins. */
  name?: string
  /** The id of the form that owns the hidden input. */
  form?: string
  /**
   * The id of the first slot; later slots use `{id}-2`, `{id}-3`, … Inside a `field.Context`
   * it becomes the field's control id; without it, the first slot gets the field's control id.
   */
  id?: string
}

/** State provided by `<otpField.Context>`. */
export interface OTPFieldContextValue {
  readonly value: string
  readonly length: number
  /** Whether every slot is filled. */
  readonly complete: boolean
  /** Whether at least one slot is filled. */
  readonly filled: boolean
  /** Whether a slot has focus. */
  readonly focused: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly required: boolean
}

interface OTPFieldInternals {
  /** The field wiring from the provider's last render. */
  readonly field: FieldControlRenderResult | undefined
  claimIndex(): number
  slotId(index: number): string
  inputMode(): InputMode
  autoComplete(index: number): string
  setSlot(index: number, node: HTMLInputElement | undefined): void
  /** The slot that takes the next character (the first empty one). */
  activeIndex(): number
  focusSlot(index: number): void
  setFocused(focused: boolean): void
  enter(index: number, text: string, event: Event, reason: 'input-change' | 'input-paste'): void
  remove(index: number, event: Event, reason: 'input-clear' | 'keyboard'): boolean
  isInert(): boolean
  mask(): boolean
}

const internalsByContext = new WeakMap<OTPFieldContextValue, OTPFieldInternals>()

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

function OTPFieldProvider(
  handle: Handle<OTPFieldContextProps, OTPFieldContextValue>,
): () => RemixNode {
  let uncontrolledValue = normalize(handle.props.defaultValue ?? '')
  let focused = false
  let autoIndex = 0
  let slots = new Map<number, HTMLInputElement>()
  let hiddenInput: HTMLInputElement | undefined
  // Inside a <field.Context>, the OTP field is the field's control: the hidden input carries
  // `required` / `pattern` (complete code) validity, the first empty slot is focused when the
  // field blocks a submission.
  let fieldChange = createFieldChange<string>()
  let fieldControl = connectFieldControl(handle, {
    getValue: () => fieldChange.read(getValue),
    getValidityElement: () => hiddenInput,
    getFocusElement: () => slots.get(activeIndex()) ?? slots.get(0),
  })
  // Set by every render, before the parts inside render.
  let fieldState: FieldControlRenderResult | undefined

  function isDisabled() {
    return fieldState?.disabled ?? handle.props.disabled === true
  }

  function getLength() {
    return Math.max(0, Math.floor(handle.props.length))
  }

  function normalize(value: string) {
    let { validationType = 'numeric', normalizeValue } = handle.props
    return normalizeOTPValue(value, validationType, getLength(), normalizeValue).value
  }

  function getValue() {
    return handle.props.value !== undefined ? normalize(handle.props.value) : uncontrolledValue
  }

  function isInert() {
    return isDisabled() || handle.props.readOnly === true
  }

  function activeIndex() {
    return Math.min(getValue().length, Math.max(0, getLength() - 1))
  }

  // Slot DOM values can differ from the rendered value (two characters typed into one slot, a
  // rejected character) without the virtual DOM noticing, so write them after each edit.
  function syncSlots() {
    let value = getValue()
    for (let [index, node] of slots) {
      let char = value[index] ?? ''
      if (node.value !== char) node.value = char
    }
  }

  function focusSlot(index: number) {
    let node = slots.get(index)
    if (!node) return
    node.focus()
    node.select()
  }

  function setValue(next: string, reason: OTPFieldChangeReason, event: Event, trigger?: Element) {
    if (next === getValue()) return false
    let canceled = false
    handle.props.onValueChange?.(next, {
      reason,
      event,
      trigger,
      cancel() {
        canceled = true
      },
      get isCanceled() {
        return canceled
      },
    })
    if (canceled) return false
    if (handle.props.value === undefined) uncontrolledValue = next
    if (hiddenInput) hiddenInput.value = next
    fieldChange.report(fieldControl, next, event)
    void handle.update()
    ;(trigger ?? hiddenInput)?.dispatchEvent(new OTPFieldChangeEvent(next, reason))
    return true
  }

  function completed(value: string, event: Event, reason: 'input-change' | 'input-paste') {
    handle.props.onValueComplete?.(value, { reason, event })
    ;(slots.get(0) ?? hiddenInput)?.dispatchEvent(new OTPFieldCompleteEvent(value))
    if (handle.props.autoSubmit) {
      let form = hiddenInput?.form ?? slots.get(0)?.form
      // Submit after the hidden input holds the new value.
      if (form) queueMicrotask(() => form.requestSubmit())
    }
  }

  let context: OTPFieldContextValue = {
    get value() {
      return getValue()
    },
    get length() {
      return getLength()
    },
    get complete() {
      return getLength() > 0 && getValue().length === getLength()
    },
    get filled() {
      return getValue().length > 0
    },
    get focused() {
      return focused
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
    get field() {
      return fieldState
    },
    claimIndex() {
      return autoIndex++
    },
    slotId(index) {
      let base =
        (fieldState?.inField ? fieldState.id : undefined) ?? handle.props.id ?? `${handle.id}-input`
      return index === 0 ? base : `${base}-${index + 1}`
    },
    inputMode() {
      let { inputMode, validationType = 'numeric' } = handle.props
      return inputMode ?? (validationType === 'numeric' ? 'numeric' : 'text')
    },
    autoComplete(index) {
      return index === 0 ? (handle.props.autoComplete ?? 'one-time-code') : 'off'
    },
    setSlot(index, node) {
      if (node) slots.set(index, node)
      else if (slots.get(index)) slots.delete(index)
    },
    activeIndex,
    focusSlot,
    setFocused(next) {
      if (focused === next) return
      focused = next
      if (next) fieldControl.focus()
      else fieldControl.blur()
      void handle.update()
    },
    enter(index, text, event, reason) {
      if (isInert()) return
      let { validationType = 'numeric', normalizeValue } = handle.props
      let length = getLength()
      let current = getValue()
      let { value: accepted, rejected } = normalizeOTPValue(
        text,
        validationType,
        length,
        normalizeValue,
      )
      if (rejected) handle.props.onValueInvalid?.(text, { reason, event })
      if (!accepted) {
        // Restore the slot's character after a rejected entry.
        syncSlots()
        return
      }
      let start = Math.min(index, current.length)
      let next =
        reason === 'input-paste' && accepted.length >= length
          ? accepted
          : current.slice(0, start) + accepted + current.slice(start + accepted.length)
      next = normalize(next)
      let wasComplete = current.length === length
      let changed = setValue(next, reason, event, slots.get(index))
      syncSlots()
      let value = getValue()
      if (value.length === length && (changed ? true : reason === 'input-paste' && wasComplete)) {
        completed(value, event, reason)
      }
      let target = Math.min(start + accepted.length, length - 1)
      if (reason === 'input-paste' && accepted.length >= length) target = length - 1
      void handle.update().then(() => {
        syncSlots()
        focusSlot(target)
      })
    },
    remove(index, event, reason) {
      if (isInert()) return false
      let current = getValue()
      if (index >= current.length) return false
      let next = current.slice(0, index) + current.slice(index + 1)
      let changed = setValue(next, reason, event, slots.get(index))
      syncSlots()
      void handle.update().then(syncSlots)
      return changed
    },
    isInert,
    mask() {
      return handle.props.mask === true
    },
  })

  handle.context.set(context)

  return () => {
    let { children, form, required } = handle.props
    let length = getLength()
    let f = (fieldState = fieldControl.render({
      value: getValue(),
      id: handle.props.id,
      disabled: handle.props.disabled === true,
      name: handle.props.name,
    }))
    let name = f.name
    let disabled = f.disabled
    return [
      children,
      createElement('input', {
        type: 'text',
        name,
        form,
        value: getValue(),
        required: required || undefined,
        disabled: disabled || undefined,
        // `pattern` (unlike `minlength`) also validates values set by script.
        pattern: length > 0 ? `[\\s\\S]{${length}}` : undefined,
        autoComplete: 'off',
        'aria-hidden': 'true',
        tabIndex: -1,
        style: hiddenInputStyle,
        mix: [
          ref((node: HTMLInputElement, signal) => {
            hiddenInput = node
            signal.addEventListener('abort', () => {
              if (hiddenInput === node) hiddenInput = undefined
            })
          }),
          on<HTMLInputElement, 'focus'>('focus', () => {
            // Browser validation focuses the hidden input; move to the first empty slot.
            focusSlot(activeIndex())
          }),
        ],
      }),
    ]
  }
}

function getOTPFieldContext(handle: MixinHandle<HTMLElement, ElementProps>): OTPFieldContextValue {
  let context = handle.context.get(OTPFieldProvider) as OTPFieldContextValue | undefined
  if (!context) throw new Error('stems-ui/otp-field parts must render inside <otpField.Context>')
  return context
}

function stateAttributes(context: OTPFieldContextValue) {
  let field = internalsByContext.get(context)!.field
  return {
    // Inside a field: data-valid / data-invalid / data-dirty / data-touched. `data-filled` and
    // `data-focused` are tracked by the OTP field itself (the same values as the field's).
    'data-valid': field?.dataAttrs['data-valid'],
    'data-invalid': field?.dataAttrs['data-invalid'],
    'data-dirty': field?.dataAttrs['data-dirty'],
    'data-touched': field?.dataAttrs['data-touched'],
    'data-disabled': context.disabled ? '' : undefined,
    'data-readonly': context.readOnly ? '' : undefined,
    'data-required': context.required ? '' : undefined,
    'data-complete': context.complete ? '' : undefined,
    'data-filled': context.filled ? '' : undefined,
    'data-focused': context.focused ? '' : undefined,
  }
}

const rootMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let context = getOTPFieldContext(handle)
  let internals = internalsByContext.get(context)!
  return (props) =>
    attrs({
      role: 'group',
      // A field label names the group (its `for` targets the first slot).
      'aria-labelledby': props['aria-label'] === undefined ? internals.field?.labelId : undefined,
      ...stateAttributes(context),
    })
})

export interface OTPFieldInputOptions {
  /** The slot's index. Without it, slots are numbered in render order. */
  index?: number
}

const inputMixin: MixinFactory<HTMLInputElement, [options?: OTPFieldInputOptions], ElementProps> =
  createMixin<HTMLInputElement, [options?: OTPFieldInputOptions], ElementProps>((handle) => {
    let context = getOTPFieldContext(handle)
    let internals = internalsByContext.get(context)!
    let autoIndex: number | undefined
    let index = 0

    function move(target: number) {
      let last = internals.activeIndex()
      internals.focusSlot(Math.max(0, Math.min(target, last)))
    }

    return (...args: [options: OTPFieldInputOptions | undefined, props: ElementProps]) => {
      let [options] = splitOptions(args[0], args[1])
      index = options?.index ?? (autoIndex ??= internals.claimIndex())
      let char = context.value[index] ?? ''
      let active = internals.activeIndex()

      return [
        attrs({
          id: internals.slotId(index),
          type: internals.mask() ? 'password' : 'text',
          inputMode: internals.inputMode(),
          autoComplete: internals.autoComplete(index),
          autoCorrect: 'off',
          autoCapitalize: 'off',
          spellCheck: 'false',
          // One tab stop for the whole field: the slot that takes the next character.
          tabIndex: index === active ? 0 : -1,
          value: char,
          disabled: context.disabled || undefined,
          readOnly: context.readOnly || undefined,
          'aria-describedby': internals.field?.describedBy,
          'aria-invalid': internals.field?.invalid ? 'true' : undefined,
          ...stateAttributes(context),
          'data-filled': char ? '' : undefined,
        }),
        ref((node: HTMLInputElement, signal) => {
          let registered = index
          internals.setSlot(registered, node)
          signal.addEventListener('abort', () => internals.setSlot(registered, undefined))
        }),
        on<HTMLInputElement, 'focus'>('focus', (event) => {
          internals.setFocused(true)
          // Slots past the first empty one can't take input yet.
          if (index > internals.activeIndex()) {
            internals.focusSlot(internals.activeIndex())
            return
          }
          event.currentTarget.select()
        }),
        on<HTMLInputElement, 'blur'>('blur', (event) => {
          let next = event.relatedTarget
          let root = event.currentTarget.closest('[role="group"]')
          if (next instanceof Node && root?.contains(next) && next instanceof HTMLInputElement) {
            return
          }
          internals.setFocused(false)
        }),
        on<HTMLInputElement, 'pointerup'>('pointerup', (event) => {
          // A click places the caret; keep the slot's character selected so typing replaces it.
          if (event.currentTarget.ownerDocument.activeElement === event.currentTarget) {
            event.currentTarget.select()
          }
        }),
        on<HTMLInputElement, 'input'>('input', (event) => {
          let node = event.currentTarget
          let text = node.value
          let previous = context.value[index] ?? ''
          if (text === '') {
            internals.remove(index, event, 'input-clear')
            return
          }
          // Typing next to an unselected character leaves both in the slot: keep the new one.
          if (previous && text.length === 2 && text.includes(previous)) {
            text = text[0] === previous ? text.slice(1) : text.slice(0, 1)
          }
          internals.enter(index, text, event, 'input-change')
        }),
        on<HTMLInputElement, 'paste'>('paste', (event) => {
          event.preventDefault()
          let text = event.clipboardData?.getData('text/plain') ?? ''
          internals.enter(index, text, event, 'input-paste')
        }),
        on<HTMLInputElement, 'keydown'>('keydown', (event) => {
          if (event.altKey || event.ctrlKey || event.metaKey) return
          let node = event.currentTarget
          switch (event.key) {
            case 'Backspace': {
              event.preventDefault()
              if (internals.isInert()) return
              if (context.value[index] !== undefined) {
                internals.remove(index, event, 'keyboard')
                void Promise.resolve().then(() => internals.focusSlot(index))
              } else if (index > 0) {
                internals.remove(index - 1, event, 'keyboard')
                void Promise.resolve().then(() => internals.focusSlot(index - 1))
              }
              return
            }
            case 'Delete': {
              event.preventDefault()
              if (internals.isInert()) return
              internals.remove(index, event, 'keyboard')
              void Promise.resolve().then(() => internals.focusSlot(index))
              return
            }
            case 'ArrowLeft':
            case 'ArrowRight': {
              event.preventDefault()
              move(index + horizontalArrowStep(event.key, getDirection(node)))
              return
            }
            case 'Home':
              event.preventDefault()
              move(0)
              return
            case 'End':
              event.preventDefault()
              move(context.length - 1)
              return
          }
        }),
      ]
    }
  })

export interface OTPFieldSeparatorOptions {
  /** @default 'horizontal' */
  orientation?: 'horizontal' | 'vertical'
}

const separatorMixin: MixinFactory<
  HTMLElement,
  [options?: OTPFieldSeparatorOptions],
  ElementProps
> = createMixin<HTMLElement, [options?: OTPFieldSeparatorOptions], ElementProps>(() => {
  return (...args: [options: OTPFieldSeparatorOptions | undefined, props: ElementProps]) => {
    let [options] = splitOptions(args[0], args[1])
    let orientation = options?.orientation ?? 'horizontal'
    return attrs({
      role: 'separator',
      'aria-orientation': orientation,
      'data-orientation': orientation,
    })
  }
})

/**
 * Provider that owns the code and renders a visually hidden `<input>` holding the whole value
 * (form submission and `required` validation), after its children. Inside a `<field.Context>`
 * it is the field's control: the first slot gets the field's control id, slots get
 * `aria-describedby` / `aria-invalid`, every part the field state attributes, and the hidden
 * input the field's `name`.
 */
export const Context = OTPFieldProvider

/** The root (`role="group"`) with the field state attributes. */
export const root = rootMixin

/**
 * One character slot (an `<input>`). Typing advances, Backspace goes back, arrows move, and
 * pasting or autofilling a code fills the slots.
 */
export const input = inputMixin

/** A separator between groups of slots (`role="separator"`). */
export const separator = separatorMixin

/** Listens for the bubbling `stems:otp-field-change` event. */
export function onOTPFieldChange<target extends HTMLElement>(
  handler: OTPFieldEventHandler<OTPFieldChangeEvent, target>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof OTP_FIELD_CHANGE_EVENT>> {
  return on(OTP_FIELD_CHANGE_EVENT, handler, captureBoolean)
}

/** Listens for the bubbling `stems:otp-field-complete` event. */
export function onOTPFieldComplete<target extends HTMLElement>(
  handler: OTPFieldEventHandler<OTPFieldCompleteEvent, target>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof OTP_FIELD_COMPLETE_EVENT>> {
  return on(OTP_FIELD_COMPLETE_EVENT, handler, captureBoolean)
}
