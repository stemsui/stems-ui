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
import {
  connectFieldControl,
  type FieldControlRenderResult,
  type FieldStateAttrs,
} from './lib/field-control.ts'
import {
  addWithPrecision,
  clamp,
  formatNumber,
  getPrecision,
  isAllowedNumberChar,
  parseNumber,
  roundToPrecision,
} from './lib/number.ts'
import { mergeOwnedStyle } from './lib/slider.ts'

const NUMBER_FIELD_CHANGE_EVENT = 'stems:number-field-change' as const
const NUMBER_FIELD_COMMIT_EVENT = 'stems:number-field-commit' as const

declare global {
  interface HTMLElementEventMap {
    [NUMBER_FIELD_CHANGE_EVENT]: NumberFieldChangeEvent
    [NUMBER_FIELD_COMMIT_EVENT]: NumberFieldCommitEvent
  }
}

/** Why the value changed, like Base UI's `NumberField.Root.ChangeEventReason`. */
export type NumberFieldChangeReason =
  | 'input-change'
  | 'input-clear'
  | 'input-blur'
  | 'input-paste'
  | 'keyboard'
  | 'increment-press'
  | 'decrement-press'
  | 'wheel'
  | 'scrub'
  | 'none'

/** Why the value was committed, like Base UI's `NumberField.Root.CommitEventReason`. */
export type NumberFieldCommitReason =
  | 'input-blur'
  | 'input-clear'
  | 'keyboard'
  | 'increment-press'
  | 'decrement-press'
  | 'wheel'
  | 'scrub'
  | 'none'

/** The second argument of `onValueChange`, like Base UI's `eventDetails`. */
export interface NumberFieldChangeDetails {
  readonly reason: NumberFieldChangeReason
  readonly event: Event
  /** The element that triggered the change (input, button, or scrub area). */
  readonly trigger: Element | undefined
  /** `1` when stepping up, `-1` when stepping down; `undefined` for typed values. */
  readonly direction: 1 | -1 | undefined
  /** Call from `onValueChange` to keep the current value. */
  cancel(): void
  readonly isCanceled: boolean
}

export interface NumberFieldCommitDetails {
  readonly reason: NumberFieldCommitReason
  readonly event: Event
}

/** Bubbling `stems:number-field-change`, dispatched from the input after every value change. */
export class NumberFieldChangeEvent extends Event {
  readonly value: number | null
  readonly reason: NumberFieldChangeReason

  constructor(value: number | null, reason: NumberFieldChangeReason) {
    super(NUMBER_FIELD_CHANGE_EVENT, { bubbles: true })
    this.value = value
    this.reason = reason
  }
}

/** Bubbling `stems:number-field-commit`, dispatched when a value is committed. */
export class NumberFieldCommitEvent extends Event {
  readonly value: number | null
  readonly reason: NumberFieldCommitReason

  constructor(value: number | null, reason: NumberFieldCommitReason) {
    super(NUMBER_FIELD_COMMIT_EVENT, { bubbles: true })
    this.value = value
    this.reason = reason
  }
}

type NumberFieldEventHandler<event extends Event, target extends HTMLElement> = (
  event: Dispatched<event, target>,
  signal: AbortSignal,
) => void | Promise<void>

/** Props for `<numberField.Context>`. They match Base UI's `NumberField.Root` props. */
export interface NumberFieldContextProps {
  children?: RemixNode
  /** The value (controlled). `null` is an empty field. */
  value?: number | null
  /** The initial value (uncontrolled). */
  defaultValue?: number | null
  /** Called with the next value and the change details. Call `details.cancel()` to veto. */
  onValueChange?: (value: number | null, details: NumberFieldChangeDetails) => void
  /**
   * Called when a value is committed: on blur after typing, on pointer release after
   * pressing a stepper button or scrubbing, and with each keyboard or wheel step.
   */
  onValueCommitted?: (value: number | null, details: NumberFieldCommitDetails) => void
  min?: number
  max?: number
  /**
   * The amount buttons, arrow keys, and scrubbing step by. `'any'` steps by 1 and turns off
   * step validation. Step validation of the hidden input only applies when `min` is set.
   * @default 1
   */
  step?: number | 'any'
  /**
   * The step while Alt is held.
   * @default 0.1
   */
  smallStep?: number
  /**
   * The step while Shift is held (and for Page Up / Page Down).
   * @default 10
   */
  largeStep?: number
  /**
   * Whether stepping snaps to the nearest multiple of the step amount.
   * @default false
   */
  snapOnStep?: boolean
  /**
   * Whether typed values may stay outside `min`/`max` (stepping still clamps).
   * @default false
   */
  allowOutOfRange?: boolean
  /** Options for `Intl.NumberFormat`, used to display and parse the value. */
  format?: Intl.NumberFormatOptions
  /** The locale used to format and parse. Defaults to the runtime locale. */
  locale?: Intl.LocalesArgument
  /**
   * Whether the mouse wheel changes the value while the input is focused and hovered.
   * @default false
   */
  allowWheelScrub?: boolean
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
   * The id of the visible input (for `<label for>`). Inside a `field.Context` it becomes the
   * field's control id; without it, the input gets the field's generated control id.
   */
  id?: string
  /** Receives the hidden `<input type="number">` and a signal aborted when it is removed. */
  inputRef?: (input: HTMLInputElement, signal: AbortSignal) => void
}

/** State provided by `<numberField.Context>`. */
export interface NumberFieldContextValue {
  readonly value: number | null
  /** The text shown in the input (raw while typing, formatted otherwise). */
  readonly inputValue: string
  readonly min: number | undefined
  readonly max: number | undefined
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly required: boolean
  /** Whether the user is scrubbing with the scrub area. */
  readonly scrubbing: boolean
  readonly inputId: string
}

export interface StepModifiers {
  shiftKey?: boolean
  altKey?: boolean
}

interface ScrubSession {
  pointerId: number
  locked: boolean
  accumulated: number
  x: number
  y: number
  startValue: number | null
}

interface NumberFieldInternals {
  readonly scrubCursorVisible: boolean
  /** The field wiring from the provider's last render. */
  readonly field: FieldControlRenderResult | undefined
  focus(): void
  blur(): void
  allowWheel(): boolean
  setInput(node: HTMLInputElement | undefined): void
  setCursor(node: HTMLElement | undefined): void
  canStep(direction: 1 | -1): boolean
  stepBy(
    direction: 1 | -1,
    event: Event,
    reason: NumberFieldChangeReason,
    trigger: Element | undefined,
    modifiers?: StepModifiers,
  ): void
  commit(reason: NumberFieldCommitReason, event: Event): void
  setBoundary(which: 'min' | 'max', event: KeyboardEvent): void
  typed(text: string, event: Event, reason: 'input-change' | 'input-paste'): void
  finishTyping(event: Event, reason: 'input-blur' | 'keyboard'): void
  format(value: number | null): string
  isInert(): boolean
  startScrub(event: PointerEvent, node: HTMLElement): void
  moveScrub(event: PointerEvent, options: ScrubAreaOptions, node: HTMLElement): void
  endScrub(event: Event, node: HTMLElement): void
  allowsChar(char: string): boolean
}

const internalsByContext = new WeakMap<NumberFieldContextValue, NumberFieldInternals>()

// Mirrors Base UI's visually hidden input: focusable by the browser for validation, but
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

function isSafari() {
  if (typeof navigator === 'undefined') return false
  let agent = navigator.userAgent
  return /Safari\//.test(agent) && !/Chrome\/|Chromium\/|Edg\//.test(agent)
}

function NumberFieldProvider(
  handle: Handle<NumberFieldContextProps, NumberFieldContextValue>,
): () => RemixNode {
  let uncontrolledValue: number | null = handle.props.defaultValue ?? null
  // The raw text while the user is typing; `undefined` shows the formatted value.
  let editingText: string | undefined
  let typedSinceCommit = false
  let scrubbing = false
  let scrub: ScrubSession | undefined
  let input: HTMLInputElement | undefined
  let hiddenInput: HTMLInputElement | undefined
  let cursor: HTMLElement | undefined
  let inputId = handle.props.id ?? `${handle.id}-input`
  // Inside a <field.Context>, the number field is the field's control: the hidden
  // `<input type="number">` carries `required` / `min` / `max` / `step` validity, the visible
  // input is labelled by the field and focused when it blocks a submission.
  let fieldChange = createFieldChange<number | null>()
  let fieldControl = connectFieldControl(handle, {
    getValue: () => fieldChange.read(getValue),
    getValidityElement: () => hiddenInput,
    getFocusElement: () => input,
    isFilled: (value) => value !== null && value !== undefined,
  })
  // Set by every render, before the parts inside render.
  let fieldState: FieldControlRenderResult | undefined

  function isDisabled() {
    return fieldState?.disabled ?? handle.props.disabled === true
  }

  function isControlled() {
    return handle.props.value !== undefined
  }

  function getValue(): number | null {
    let value = isControlled() ? handle.props.value! : uncontrolledValue
    return value === null || Number.isFinite(value) ? value : null
  }

  function formatOptions() {
    let { format, locale } = handle.props
    // Without `format`, keep every typed decimal instead of Intl's default of 3.
    return { format: format ?? { maximumFractionDigits: 20 }, locale }
  }

  function format(value: number | null) {
    return formatNumber(value, formatOptions())
  }

  function isInert() {
    return isDisabled() || handle.props.readOnly === true
  }

  function clampValue(value: number) {
    let { min = -Infinity, max = Infinity } = handle.props
    return clamp(value, min, max)
  }

  function setValue(
    next: number | null,
    reason: NumberFieldChangeReason,
    event: Event,
    trigger: Element | undefined,
    direction?: 1 | -1,
  ): boolean {
    if (next !== null && !Number.isFinite(next)) return false
    if (Object.is(next, getValue())) return false

    let canceled = false
    let details: NumberFieldChangeDetails = {
      reason,
      event,
      trigger,
      direction,
      cancel() {
        canceled = true
      },
      get isCanceled() {
        return canceled
      },
    }
    handle.props.onValueChange?.(next, details)
    if (canceled) return false

    if (!isControlled()) uncontrolledValue = next
    // Keep the form value current before the re-render (Enter submits synchronously). The
    // field also validates the hidden input right away.
    if (hiddenInput) hiddenInput.value = next === null ? '' : String(next)
    fieldChange.report(fieldControl, next, event)
    void handle.update()
    ;(input ?? hiddenInput)?.dispatchEvent(new NumberFieldChangeEvent(next, reason))
    return true
  }

  function commit(reason: NumberFieldCommitReason, event: Event) {
    typedSinceCommit = false
    let value = getValue()
    handle.props.onValueCommitted?.(value, { reason, event })
    ;(input ?? hiddenInput)?.dispatchEvent(new NumberFieldCommitEvent(value, reason))
  }

  function stepAmount(modifiers: StepModifiers) {
    let { step = 1, smallStep = 0.1, largeStep = 10 } = handle.props
    if (modifiers.altKey) return smallStep
    if (modifiers.shiftKey) return largeStep
    return step === 'any' || !(step > 0) ? 1 : step
  }

  function nextStepValue(direction: 1 | -1, modifiers: StepModifiers) {
    let amount = stepAmount(modifiers)
    let base = getValue() ?? 0
    let next: number
    if (handle.props.snapOnStep) {
      let ratio = roundToPrecision(base / amount, 10)
      let multiple = direction > 0 ? Math.floor(ratio) + 1 : Math.ceil(ratio) - 1
      next = roundToPrecision(multiple * amount, Math.max(getPrecision(amount), 0))
    } else {
      next = addWithPrecision(base, direction * amount)
    }
    return clampValue(next)
  }

  function eventModifiers(event: Event): StepModifiers {
    let source = event as Partial<MouseEvent & KeyboardEvent>
    return { shiftKey: source.shiftKey === true, altKey: source.altKey === true }
  }

  function placeCursor() {
    if (!cursor || !scrub) return
    cursor.style.transform = `translate3d(${scrub.x}px, ${scrub.y}px, 0)`
  }

  let context: NumberFieldContextValue = {
    get value() {
      return getValue()
    },
    get inputValue() {
      return editingText ?? format(getValue())
    },
    get min() {
      return handle.props.min
    },
    get max() {
      return handle.props.max
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
    get scrubbing() {
      return scrubbing
    },
    get inputId() {
      return (fieldState?.inField ? fieldState.id : undefined) ?? handle.props.id ?? inputId
    },
  }

  internalsByContext.set(context, {
    get scrubCursorVisible() {
      return scrubbing && scrub?.locked === true
    },
    get field() {
      return fieldState
    },
    focus() {
      fieldControl.focus()
    },
    blur() {
      fieldControl.blur()
    },
    allowWheel() {
      return handle.props.allowWheelScrub === true
    },
    setInput(node) {
      input = node
    },
    setCursor(node) {
      cursor = node
    },
    canStep(direction) {
      if (isInert()) return false
      let value = getValue()
      if (value === null) return true
      let { min, max } = handle.props
      return direction > 0 ? max === undefined || value < max : min === undefined || value > min
    },
    stepBy(direction, event, reason, trigger, modifiers = eventModifiers(event)) {
      if (isInert()) return
      let next = nextStepValue(direction, modifiers)
      editingText = undefined
      if (!setValue(next, reason, event, trigger, direction)) void handle.update()
    },
    commit,
    setBoundary(which, event) {
      if (isInert()) return
      let bound = handle.props[which]
      if (bound === undefined) return
      event.preventDefault()
      editingText = undefined
      if (setValue(bound, 'keyboard', event, input)) commit('keyboard', event)
      else void handle.update()
    },
    typed(text, event, reason) {
      if (isInert()) return
      editingText = text
      typedSinceCommit = true
      if (text.trim() === '') {
        setValue(null, 'input-clear', event, input)
      } else {
        let parsed = parseNumber(text, formatOptions())
        if (parsed !== null && Number.isFinite(parsed)) setValue(parsed, reason, event, input)
      }
      void handle.update()
    },
    finishTyping(event, reason) {
      if (editingText === undefined && !typedSinceCommit) return
      let text = editingText ?? ''
      editingText = undefined
      let parsed = text.trim() === '' ? null : parseNumber(text, formatOptions())
      if (parsed !== null && !Number.isFinite(parsed)) {
        // Unparseable text reverts to the last valid value.
        void handle.update()
        if (typedSinceCommit) commit(reason === 'keyboard' ? 'keyboard' : 'input-blur', event)
        return
      }
      if (parsed !== null && !handle.props.allowOutOfRange) parsed = clampValue(parsed)
      setValue(parsed, reason === 'keyboard' ? 'keyboard' : 'input-blur', event, input)
      void handle.update()
      if (typedSinceCommit) {
        commit(
          parsed === null ? 'input-clear' : reason === 'keyboard' ? 'keyboard' : 'input-blur',
          event,
        )
      }
    },
    format,
    isInert,
    startScrub(event, node) {
      if (isInert() || event.button !== 0) return
      event.preventDefault()
      let locked = false
      let pointerId = event.pointerId
      let session: ScrubSession | undefined
      function capture() {
        try {
          node.setPointerCapture(pointerId)
        } catch {
          // Synthetic pointers (and pointers already released) can't be captured.
        }
      }
      if (event.pointerType !== 'touch' && !isSafari() && 'requestPointerLock' in node) {
        try {
          let doc = node.ownerDocument
          // The lock can be refused asynchronously: a rejected promise (current engines) or a
          // `pointerlockerror` event (engines whose `requestPointerLock()` returns undefined).
          // Fall back to pointer capture so moves and the release outside the area still arrive.
          let refused = () => {
            doc.removeEventListener('pointerlockerror', refused)
            if (!session || scrub !== session || !session.locked) return
            session.locked = false
            capture()
            void handle.update()
          }
          doc.addEventListener('pointerlockerror', refused)
          let settled = () => doc.removeEventListener('pointerlockerror', refused)
          doc.addEventListener('pointerlockchange', settled, { once: true })
          let result = node.requestPointerLock() as unknown
          locked = true
          if (result instanceof Promise) result.then(settled, refused)
        } catch {
          locked = false
        }
      }
      if (!locked) capture()
      scrub = session = {
        pointerId,
        locked,
        accumulated: 0,
        x: event.clientX,
        y: event.clientY,
        startValue: getValue(),
      }
      scrubbing = true
      editingText = undefined
      // Keep typing focus in the field, like Base UI.
      input?.focus({ preventScroll: true })
      void handle.update().then(placeCursor)
    },
    moveScrub(event, options, node) {
      if (!scrub || (event.pointerId !== scrub.pointerId && !scrub.locked)) return
      let vertical = options.direction === 'vertical'
      let movement = vertical ? -event.movementY : event.movementX
      scrub.x += event.movementX
      scrub.y += event.movementY

      // Keep the virtual cursor near the scrub area (teleportDistance) or inside the viewport.
      let rect = node.getBoundingClientRect()
      let view = node.ownerDocument.defaultView
      if (options.teleportDistance !== undefined) {
        let centerX = rect.left + rect.width / 2
        let centerY = rect.top + rect.height / 2
        let distance = options.teleportDistance
        if (scrub.x > centerX + distance) scrub.x = centerX - distance
        else if (scrub.x < centerX - distance) scrub.x = centerX + distance
        if (scrub.y > centerY + distance) scrub.y = centerY - distance
        else if (scrub.y < centerY - distance) scrub.y = centerY + distance
      } else if (view) {
        if (scrub.x > view.innerWidth) scrub.x = 0
        else if (scrub.x < 0) scrub.x = view.innerWidth
        if (scrub.y > view.innerHeight) scrub.y = 0
        else if (scrub.y < 0) scrub.y = view.innerHeight
      }
      placeCursor()

      let sensitivity = Math.max(1, options.pixelSensitivity ?? 2)
      scrub.accumulated += movement
      while (Math.abs(scrub.accumulated) >= sensitivity) {
        let direction: 1 | -1 = scrub.accumulated > 0 ? 1 : -1
        scrub.accumulated -= direction * sensitivity
        let next = nextStepValue(direction, eventModifiers(event))
        setValue(next, 'scrub', event, node, direction)
      }
    },
    endScrub(event, node) {
      if (!scrub) return
      let session = scrub
      scrub = undefined
      scrubbing = false
      if (session.locked && node.ownerDocument.pointerLockElement === node) {
        node.ownerDocument.exitPointerLock()
      }
      try {
        if (node.hasPointerCapture(session.pointerId)) node.releasePointerCapture(session.pointerId)
      } catch {
        // Already released.
      }
      void handle.update()
      if (!Object.is(session.startValue, getValue())) commit('scrub', event)
    },
    allowsChar(char) {
      return isAllowedNumberChar(char, formatOptions())
    },
  })

  handle.context.set(context)

  return () => {
    let { children, form, min, max, step = 1, required } = handle.props
    let value = getValue()
    let f = (fieldState = fieldControl.render({
      value,
      id: handle.props.id,
      disabled: handle.props.disabled === true,
      name: handle.props.name,
    }))
    let name = f.name
    let disabled = f.disabled
    return [
      children,
      createElement('input', {
        type: 'number',
        name,
        form,
        value: value === null ? '' : String(value),
        min,
        max,
        // Step validation only with an explicit `min` (Base UI): stepping from 0.5 by 1 is fine.
        step: min !== undefined && step !== 'any' ? step : 'any',
        disabled: disabled || undefined,
        required: required || undefined,
        'aria-hidden': 'true',
        tabIndex: -1,
        style: hiddenInputStyle,
        mix: [
          ref((node: HTMLInputElement, signal) => {
            hiddenInput = node
            handle.props.inputRef?.(node, signal)
            signal.addEventListener('abort', () => {
              if (hiddenInput === node) hiddenInput = undefined
            })
          }),
          on<HTMLInputElement, 'focus'>('focus', () => {
            // Browser validation focuses the hidden input; move focus to the visible one.
            input?.focus()
          }),
        ],
      }),
    ]
  }
}

function getNumberFieldContext(
  handle: MixinHandle<HTMLElement, ElementProps> | Handle<any, any>,
): NumberFieldContextValue {
  let context = handle.context.get(NumberFieldProvider) as NumberFieldContextValue | undefined
  if (!context) {
    throw new Error('stems-ui/number-field parts must render inside <numberField.Context>')
  }
  return context
}

function fieldAttributes(context: NumberFieldContextValue): Omit<FieldStateAttrs, 'data-disabled'> {
  let field = internalsByContext.get(context)!.field
  if (!field?.inField) return {}
  let { 'data-disabled': _disabled, ...data } = field.dataAttrs
  return data
}

function stateAttributes(context: NumberFieldContextValue) {
  return {
    ...fieldAttributes(context),
    'data-disabled': context.disabled ? '' : undefined,
    'data-readonly': context.readOnly ? '' : undefined,
    'data-required': context.required ? '' : undefined,
    'data-scrubbing': context.scrubbing ? '' : undefined,
  }
}

function stateMixin(extra: () => ElementProps = () => ({})) {
  return createMixin<HTMLElement, [], ElementProps>((handle) => {
    let context = getNumberFieldContext(handle)
    return () => attrs({ ...extra(), ...stateAttributes(context) })
  })
}

const rootMixin: MixinFactory<HTMLElement, [], ElementProps> = stateMixin()

const groupMixin: MixinFactory<HTMLElement, [], ElementProps> = stateMixin(() => ({
  role: 'group',
}))

const inputMixin: MixinFactory<HTMLInputElement, [], ElementProps> = createMixin<
  HTMLInputElement,
  [],
  ElementProps
>((handle) => {
  let context = getNumberFieldContext(handle)
  let internals = internalsByContext.get(context)!
  let hovered = false

  return () => {
    let min = context.min
    return [
      attrs({
        id: context.inputId,
        type: 'text',
        // Mobile numeric keypads have no minus sign; allow text entry when negatives are valid.
        inputMode: min !== undefined && min >= 0 ? 'decimal' : 'text',
        autoComplete: 'off',
        autoCorrect: 'off',
        spellCheck: 'false',
        'aria-roledescription': 'Number field',
        'aria-describedby': internals.field?.describedBy,
        'aria-invalid': internals.field?.invalid ? 'true' : undefined,
        value: context.inputValue,
        disabled: context.disabled || undefined,
        readOnly: context.readOnly || undefined,
        required: context.required || undefined,
        ...stateAttributes(context),
      }),
      ref((node: HTMLInputElement, signal) => {
        internals.setInput(node)
        signal.addEventListener('abort', () => internals.setInput(undefined))
      }),
      on<HTMLInputElement, 'input'>('input', (event) => {
        internals.typed(event.currentTarget.value, event, 'input-change')
      }),
      on<HTMLInputElement, 'paste'>('paste', (event) => {
        if (internals.isInert()) return
        let pasted = event.clipboardData?.getData('text/plain') ?? ''
        let node = event.currentTarget
        let start = node.selectionStart ?? node.value.length
        let end = node.selectionEnd ?? node.value.length
        let text = node.value.slice(0, start) + pasted.trim() + node.value.slice(end)
        event.preventDefault()
        // Reject pastes that aren't numbers, like Base UI.
        if (![...pasted.trim()].every((char) => internals.allowsChar(char))) return
        node.value = text
        internals.typed(text, event, 'input-paste')
      }),
      on<HTMLInputElement, 'keydown'>('keydown', (event) => {
        if (event.ctrlKey || event.metaKey) return
        switch (event.key) {
          case 'ArrowUp':
          case 'ArrowDown': {
            event.preventDefault()
            if (internals.isInert()) return
            internals.stepBy(
              event.key === 'ArrowUp' ? 1 : -1,
              event,
              'keyboard',
              event.currentTarget,
            )
            internals.commit('keyboard', event)
            return
          }
          case 'PageUp':
          case 'PageDown': {
            event.preventDefault()
            if (internals.isInert()) return
            internals.stepBy(
              event.key === 'PageUp' ? 1 : -1,
              event,
              'keyboard',
              event.currentTarget,
              {
                shiftKey: true,
              },
            )
            internals.commit('keyboard', event)
            return
          }
          case 'Home':
            internals.setBoundary('min', event)
            return
          case 'End':
            internals.setBoundary('max', event)
            return
          case 'Enter':
            internals.finishTyping(event, 'keyboard')
            return
        }
        // Block characters that can't be part of a number.
        if (event.key.length === 1 && !event.altKey && !internals.allowsChar(event.key)) {
          event.preventDefault()
        }
      }),
      on<HTMLInputElement, 'focus'>('focus', () => internals.focus()),
      on<HTMLInputElement, 'blur'>('blur', (event) => {
        // Commit the typed text first, so `validationMode="onBlur"` validates the parsed value.
        internals.finishTyping(event, 'input-blur')
        internals.blur()
      }),
      on<HTMLInputElement, 'pointerenter'>('pointerenter', () => {
        hovered = true
      }),
      on<HTMLInputElement, 'pointerleave'>('pointerleave', () => {
        hovered = false
      }),
      on<HTMLInputElement, 'wheel'>('wheel', (event) => {
        let node = event.currentTarget
        if (!internals.allowWheel() || internals.isInert()) return
        if (node.ownerDocument.activeElement !== node || (!hovered && !node.matches(':hover'))) {
          return
        }
        if (event.deltaY === 0) return
        event.preventDefault()
        internals.stepBy(event.deltaY < 0 ? 1 : -1, event, 'wheel', node)
        internals.commit('wheel', event)
      }),
    ]
  }
})

function stepperMixin(direction: 1 | -1, reason: 'increment-press' | 'decrement-press') {
  return createMixin<HTMLElement, [], ElementProps>((handle, hostType) => {
    let context = getNumberFieldContext(handle)
    let internals = internalsByContext.get(context)!
    let isButton = hostType === 'button'
    let delayTimer: ReturnType<typeof setTimeout> | undefined
    let repeatTimer: ReturnType<typeof setInterval> | undefined
    let pressStart: number | null | undefined
    let pressedByPointer = false
    let modifiers: StepModifiers = {}
    let signal = handle.signal

    function stop() {
      clearTimeout(delayTimer)
      clearInterval(repeatTimer)
      delayTimer = undefined
      repeatTimer = undefined
    }

    signal.addEventListener('abort', stop)

    function stepOnce(event: Event, node: HTMLElement) {
      if (!internals.canStep(direction)) {
        stop()
        return
      }
      internals.stepBy(direction, event, reason, node, modifiers)
    }

    return () => {
      let disabled = !internals.canStep(direction)
      return [
        attrs({
          type: isButton ? 'button' : undefined,
          tabIndex: -1,
          'aria-label': direction > 0 ? 'Increase' : 'Decrease',
          'aria-controls': context.inputId,
          disabled: isButton && disabled ? true : undefined,
          'aria-disabled': !isButton && disabled ? 'true' : undefined,
          ...stateAttributes(context),
          'data-disabled': disabled ? '' : undefined,
        }),
        on<HTMLElement, 'mousedown'>('mousedown', (event) => {
          // Keep focus (and the caret) in the input while pressing the button.
          event.preventDefault()
        }),
        on<HTMLElement, 'pointerdown'>('pointerdown', (event) => {
          if (event.button !== 0 || !internals.canStep(direction)) return
          let node = event.currentTarget
          pressedByPointer = true
          pressStart = context.value
          modifiers = { shiftKey: event.shiftKey, altKey: event.altKey }
          try {
            node.setPointerCapture(event.pointerId)
          } catch {
            // Synthetic pointers can't be captured.
          }
          stepOnce(event, node)
          stop()
          // Press and hold: repeat after a delay, like native spin buttons.
          delayTimer = setTimeout(() => {
            repeatTimer = setInterval(() => stepOnce(event, node), 60)
          }, 400)
        }),
        on<HTMLElement, 'pointerup'>('pointerup', (event) => {
          if (!pressedByPointer) return
          stop()
          if (pressStart !== undefined && !Object.is(pressStart, context.value)) {
            internals.commit(reason, event)
          }
          pressStart = undefined
        }),
        on<HTMLElement, 'pointercancel'>('pointercancel', (event) => {
          stop()
          if (pressStart !== undefined && !Object.is(pressStart, context.value)) {
            internals.commit(reason, event)
          }
          pressStart = undefined
          pressedByPointer = false
        }),
        on<HTMLElement, 'contextmenu'>('contextmenu', (event) => {
          // Long-press on touch screens opens the context menu; it would interrupt the repeat.
          if (pressStart !== undefined) event.preventDefault()
        }),
        on<HTMLElement, 'click'>('click', (event) => {
          event.preventDefault()
          // Pointer presses already stepped on pointerdown; clicks from the keyboard or
          // assistive technology step once here.
          if (pressedByPointer) {
            pressedByPointer = false
            return
          }
          if (!internals.canStep(direction)) return
          modifiers = { shiftKey: event.shiftKey, altKey: event.altKey }
          stepOnce(event, event.currentTarget)
          internals.commit(reason, event)
        }),
        !isButton &&
          on<HTMLElement, 'keydown'>('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            event.currentTarget.click()
          }),
      ]
    }
  })
}

const incrementMixin: MixinFactory<HTMLElement, [], ElementProps> = stepperMixin(
  1,
  'increment-press',
)
const decrementMixin: MixinFactory<HTMLElement, [], ElementProps> = stepperMixin(
  -1,
  'decrement-press',
)

export interface ScrubAreaOptions {
  /**
   * The cursor movement direction that changes the value.
   * @default 'horizontal'
   */
  direction?: 'horizontal' | 'vertical'
  /**
   * Pixels of movement per step.
   * @default 2
   */
  pixelSensitivity?: number
  /**
   * How far (px) the virtual cursor can move from the scrub area's center before it wraps
   * around. Without it, the cursor wraps at the viewport edges.
   */
  teleportDistance?: number
}

const scrubAreaMixin: MixinFactory<HTMLElement, [options?: ScrubAreaOptions], ElementProps> =
  createMixin<HTMLElement, [options?: ScrubAreaOptions], ElementProps>((handle) => {
    let context = getNumberFieldContext(handle)
    let internals = internalsByContext.get(context)!
    let options: ScrubAreaOptions = {}

    return (...args: [options: ScrubAreaOptions | undefined, props: ElementProps]) => {
      let [scrubOptions, props] = splitOptions(args[0], args[1])
      options = scrubOptions ?? {}
      let vertical = options.direction === 'vertical'
      // Defaults only: host `style` replaces them.
      let style = props.style ?? {
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        cursor: vertical ? 'ns-resize' : 'ew-resize',
      }
      return createElement(handle.element, {
        style,
        mix: [
          attrs({ role: 'presentation', ...stateAttributes(context) }),
          on<HTMLElement, 'pointerdown'>('pointerdown', (event) =>
            internals.startScrub(event, event.currentTarget),
          ),
          on<HTMLElement, 'pointermove'>('pointermove', (event) =>
            internals.moveScrub(event, options, event.currentTarget),
          ),
          on<HTMLElement, 'pointerup'>('pointerup', (event) =>
            internals.endScrub(event, event.currentTarget),
          ),
          on<HTMLElement, 'pointercancel'>('pointercancel', (event) =>
            internals.endScrub(event, event.currentTarget),
          ),
          on<HTMLElement, 'lostpointercapture'>('lostpointercapture', (event) => {
            if (event.currentTarget.ownerDocument.pointerLockElement !== event.currentTarget) {
              internals.endScrub(event, event.currentTarget)
            }
          }),
        ],
      })
    }
  })

const scrubAreaCursorMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let context = getNumberFieldContext(handle)
  let internals = internalsByContext.get(context)!
  return (props) =>
    createElement(handle.element, {
      // Shown only while the pointer is locked (the native cursor is hidden then).
      hidden: internals.scrubCursorVisible ? undefined : true,
      style: mergeOwnedStyle(
        { position: 'fixed', top: '0', left: '0', pointerEvents: 'none' },
        props.style,
      ),
      mix: [
        attrs({ 'aria-hidden': 'true', ...stateAttributes(context) }),
        ref((node: HTMLElement, signal) => {
          internals.setCursor(node)
          signal.addEventListener('abort', () => internals.setCursor(undefined))
        }),
      ],
    })
})

/**
 * Provider that owns the value and renders the hidden `<input type="number">` used for form
 * submission and native validation, after its children. Inside a `<field.Context>` it is the
 * field's control: the visible input gets the field's control id, `aria-describedby` and
 * `aria-invalid`, every part gets the field state attributes, and the hidden input gets the
 * field's `name` and validates `required` / `min` / `max` / `step`.
 */
export const Context = NumberFieldProvider

/** The root element; carries the state attributes. */
export const root = rootMixin

/** Groups the input with the stepper buttons (`role="group"`). */
export const group = groupMixin

/**
 * The text input: shows the formatted value, parses locale-formatted typing, steps with the
 * keyboard, and commits on blur or Enter. Use an `<input>` host.
 */
export const input = inputMixin

/** A button that increases the value; press and hold repeats. */
export const increment = incrementMixin

/** A button that decreases the value; press and hold repeats. */
export const decrement = decrementMixin

/** An area where dragging changes the value (pointer lock where available). */
export const scrubArea = scrubAreaMixin

/** A custom cursor shown while scrubbing with the pointer locked. */
export const scrubAreaCursor = scrubAreaCursorMixin

/** Listens for the bubbling `stems:number-field-change` event. */
export function onNumberFieldChange<target extends HTMLElement>(
  handler: NumberFieldEventHandler<NumberFieldChangeEvent, target>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof NUMBER_FIELD_CHANGE_EVENT>> {
  return on(NUMBER_FIELD_CHANGE_EVENT, handler, captureBoolean)
}

/** Listens for the bubbling `stems:number-field-commit` event. */
export function onNumberFieldCommit<target extends HTMLElement>(
  handler: NumberFieldEventHandler<NumberFieldCommitEvent, target>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof NUMBER_FIELD_COMMIT_EVENT>> {
  return on(NUMBER_FIELD_COMMIT_EVENT, handler, captureBoolean)
}
