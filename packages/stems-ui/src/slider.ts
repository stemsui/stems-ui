import { attrs, createElement, createMixin, on, ref } from '@remix-run/component'
import type {
  Dispatched,
  ElementProps,
  Handle,
  MixinFactory,
  MixinHandle,
  RemixNode,
} from '@remix-run/component'

import { createFieldChange, focusStaysInside } from './lib/checkable.ts'
import { splitOptions } from './lib/collapsible-panel.ts'
import { connectFieldControl, type FieldControlRenderResult } from './lib/field-control.ts'
import { getDirection, horizontalArrowStep } from './lib/direction.ts'
import { formatNumber, roundToStep } from './lib/number.ts'
import {
  closestThumbIndex,
  fractionToValue,
  indicatorPositionStyle,
  mergeOwnedStyle,
  moveThumb,
  pointerToFraction,
  sanitizeValues,
  setThumbValue,
  thumbPositionStyle,
  valueToPercent,
  type SliderOrientation,
  type SliderRange,
  type ThumbAlignment,
  type ThumbCollisionBehavior,
} from './lib/slider.ts'

export type { SliderOrientation, ThumbAlignment, ThumbCollisionBehavior } from './lib/slider.ts'

const SLIDER_CHANGE_EVENT = 'stems:slider-change' as const
const SLIDER_COMMIT_EVENT = 'stems:slider-commit' as const

declare global {
  interface HTMLElementEventMap {
    [SLIDER_CHANGE_EVENT]: SliderChangeEvent
    [SLIDER_COMMIT_EVENT]: SliderCommitEvent
  }
}

/**
 * Why the value changed, like Base UI's `Slider.Root.ChangeEventReason`. Stems thumbs are
 * `role="slider"` elements rather than native range inputs, so `'input-change'` is never used.
 */
export type SliderChangeReason = 'input-change' | 'track-press' | 'drag' | 'keyboard' | 'none'

/** The value shape: a number for a single thumb, an array for a range slider. */
export type SliderValue = number | number[]

/** The second argument of `onValueChange`, like Base UI's `eventDetails`. */
export interface SliderChangeDetails {
  readonly reason: SliderChangeReason
  /** The DOM event that caused the change. */
  readonly event: Event
  /** The thumb (or control, for track presses) that triggered the change. */
  readonly trigger: Element | undefined
  /** The index of the thumb being moved. */
  readonly activeThumbIndex: number
  /** Call from `onValueChange` to keep the current value. */
  cancel(): void
  readonly isCanceled: boolean
}

/** The second argument of `onValueCommitted`. */
export interface SliderCommitDetails {
  readonly reason: SliderChangeReason
  readonly event: Event
}

/** Bubbling `stems:slider-change`, dispatched from the root after every value change. */
export class SliderChangeEvent extends Event {
  readonly value: SliderValue
  readonly reason: SliderChangeReason
  readonly activeThumbIndex: number

  constructor(value: SliderValue, reason: SliderChangeReason, activeThumbIndex: number) {
    super(SLIDER_CHANGE_EVENT, { bubbles: true })
    this.value = value
    this.reason = reason
    this.activeThumbIndex = activeThumbIndex
  }
}

/**
 * Bubbling `stems:slider-commit`, dispatched when an interaction ends with a changed value
 * (pointer release, or each keyboard step).
 */
export class SliderCommitEvent extends Event {
  readonly value: SliderValue
  readonly reason: SliderChangeReason

  constructor(value: SliderValue, reason: SliderChangeReason) {
    super(SLIDER_COMMIT_EVENT, { bubbles: true })
    this.value = value
    this.reason = reason
  }
}

type SliderEventHandler<event extends Event, target extends HTMLElement> = (
  event: Dispatched<event, target>,
  signal: AbortSignal,
) => void | Promise<void>

/** Props for `<slider.Context>`. They match Base UI's `Slider.Root` props. */
export interface SliderContextProps {
  children?: RemixNode
  /** The value (controlled). An array makes a range slider with one thumb per value. */
  value?: number | readonly number[]
  /** The initial value (uncontrolled). Defaults to `min`. */
  defaultValue?: number | readonly number[]
  /** Called with the next value and the change details. Call `details.cancel()` to veto. */
  onValueChange?: (value: SliderValue, details: SliderChangeDetails) => void
  /** Called when an interaction ends with a changed value (pointer up, or a keyboard step). */
  onValueCommitted?: (value: SliderValue, details: SliderCommitDetails) => void
  /** @default 0 */
  min?: number
  /** @default 100 */
  max?: number
  /**
   * The granularity of the value. `min` is the origin of the valid values.
   * @default 1
   */
  step?: number
  /**
   * The step for Page Up / Page Down and Shift + arrow keys.
   * @default 10
   */
  largeStep?: number
  /**
   * The minimum number of steps between neighboring thumbs of a range slider.
   * @default 0
   */
  minStepsBetweenValues?: number
  /** @default 'horizontal' */
  orientation?: SliderOrientation
  /**
   * Whether the slider ignores user interaction. An enclosing `<field.Context disabled>` or
   * `<fieldset.Context disabled>` also disables it.
   * @default false
   */
  disabled?: boolean
  /**
   * Identifies the field when a form is submitted (one hidden input per thumb). An enclosing
   * `field.Context`'s `name` wins.
   */
  name?: string
  /** The id of the form that owns the hidden inputs. */
  form?: string
  /** Options for `Intl.NumberFormat`, used for `ValueText` and `aria-valuetext`. */
  format?: Intl.NumberFormatOptions
  /** The locale used to format values. Defaults to the runtime locale. */
  locale?: Intl.LocalesArgument
  /**
   * How thumbs align with the control's edges at `min` and `max`: `'center'` puts the thumb's
   * center on the edge; `'edge'` (and Base UI's `'edge-client-only'`, treated the same) keeps
   * the whole thumb inside the control. Both are pure CSS, so they are correct in server HTML.
   * @default 'center'
   */
  thumbAlignment?: ThumbAlignment
  /**
   * How range thumbs behave when they collide during pointer drags.
   * @default 'push'
   */
  thumbCollisionBehavior?: ThumbCollisionBehavior
}

/** State provided by `<slider.Context>`, readable with `handle.context.get(slider.Context)`. */
export interface SliderContextValue {
  /** The current values, one per thumb, ascending. */
  readonly values: readonly number[]
  /** The value in the shape the slider was given (number or array). */
  readonly value: SliderValue
  /** The values formatted with `format` / `locale`. */
  readonly formattedValues: readonly string[]
  readonly min: number
  readonly max: number
  readonly step: number
  readonly largeStep: number
  readonly minStepsBetweenValues: number
  readonly orientation: SliderOrientation
  readonly disabled: boolean
  /** Whether a thumb is being dragged with a pointer. */
  readonly dragging: boolean
  /** The index of the last focused or moved thumb; `-1` before any interaction. */
  readonly activeThumbIndex: number
  /** Whether this is a range slider (array value). */
  readonly range: boolean
  readonly labelId: string
}

interface DragState {
  pointerId: number
  index: number
  offsetX: number
  offsetY: number
  startValues: readonly number[]
  moved: boolean
  pressedTrack: boolean
}

interface SliderInternals {
  /** The field wiring from the provider's last render. */
  readonly field: FieldControlRenderResult | undefined
  fieldFocus(): void
  fieldBlur(event: FocusEvent): void
  readonly rtl: boolean
  readonly hasLabel: boolean
  readonly alignment: ThumbAlignment
  readonly thumbIdBase: string
  claimThumbIndex(): number
  registerLabel(): void
  labelMounted(): void
  setRtl(rtl: boolean): void
  setControl(node: HTMLElement | undefined): void
  setThumb(index: number, node: HTMLElement | undefined): void
  setActive(index: number): void
  isThumbDisabled(index: number): boolean
  setThumbDisabled(index: number, disabled: boolean): void
  focusThumb(index: number): void
  keyboardStep(index: number, event: KeyboardEvent): void
  pointerDown(event: PointerEvent): void
  pointerMove(event: PointerEvent): void
  pointerUp(event: PointerEvent): void
  ariaValueText(index: number): string | undefined
}

const internalsByContext = new WeakMap<SliderContextValue, SliderInternals>()

function toArray(value: number | readonly number[] | undefined): number[] | undefined {
  if (value === undefined) return undefined
  return typeof value === 'number' ? [value] : [...value]
}

function sameValues(a: readonly number[], b: readonly number[]) {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

function SliderProvider(handle: Handle<SliderContextProps, SliderContextValue>): () => RemixNode {
  let initial = handle.props.value ?? handle.props.defaultValue
  let isRange = Array.isArray(initial)
  let uncontrolledValues = sanitizeValues(
    toArray(handle.props.defaultValue) ?? [readRange().min],
    readRange(),
  )
  let dragging = false
  let activeThumbIndex = -1
  let rtl = false
  let hasLabel = false
  let labelSynced = false
  let autoIndex = 0
  let control: HTMLElement | undefined
  let thumbs = new Map<number, HTMLElement>()
  let disabledThumbs = new Set<number>()
  let drag: DragState | undefined
  let thumbIdBase = `${handle.id}-thumb`
  let focusWithin = false
  // Inside a <field.Context>, the slider is the field's control: its value is the field value
  // (`validate` receives it), the first enabled thumb is focused when it blocks a submission.
  // Base UI's Slider has no `required`, so there is no native validity element.
  let fieldChange = createFieldChange<SliderValue>()
  let fieldControl = connectFieldControl(handle, {
    getValue: () => fieldChange.read(() => output(getValues())),
    getValidityElement: () => null,
    getFocusElement: () => {
      let enabled = [...thumbs.entries()]
        .filter(([index]) => !disabledThumbs.has(index))
        .sort(([a], [b]) => a - b)
      return enabled[0]?.[1] ?? null
    },
  })
  // Set by every render, before the parts inside render.
  let fieldState: FieldControlRenderResult | undefined

  function isDisabled() {
    return fieldState?.disabled ?? handle.props.disabled === true
  }

  function readRange(): SliderRange {
    let { min = 0, max = 100, step = 1, minStepsBetweenValues = 0 } = handle.props
    let safeStep = step > 0 ? step : 1
    return { min, max, step: safeStep, minDistance: Math.max(0, minStepsBetweenValues) * safeStep }
  }

  function isControlled() {
    return handle.props.value !== undefined
  }

  function getValues(): number[] {
    let controlled = toArray(handle.props.value)
    return controlled ? sanitizeValues(controlled, readRange()) : uncontrolledValues
  }

  function output(values: readonly number[]): SliderValue {
    return isRange ? [...values] : values[0]
  }

  function getOrientation(): SliderOrientation {
    return handle.props.orientation ?? 'horizontal'
  }

  function rootNode(): HTMLElement | undefined {
    return control ?? thumbs.values().next().value
  }

  function change(
    next: number[],
    reason: SliderChangeReason,
    event: Event,
    index: number,
    trigger: Element | undefined,
  ): boolean {
    if (isDisabled()) return false
    if (sameValues(next, getValues())) return false

    let canceled = false
    let details: SliderChangeDetails = {
      reason,
      event,
      trigger,
      activeThumbIndex: index,
      cancel() {
        canceled = true
      },
      get isCanceled() {
        return canceled
      },
    }
    handle.props.onValueChange?.(output(next), details)
    if (canceled) return false

    if (!isControlled()) uncontrolledValues = next
    activeThumbIndex = index
    fieldChange.report(fieldControl, output(next), event)
    void handle.update()
    rootNode()?.dispatchEvent(new SliderChangeEvent(output(next), reason, index))
    return true
  }

  function commit(reason: SliderChangeReason, event: Event) {
    let value = output(getValues())
    handle.props.onValueCommitted?.(value, { reason, event })
    rootNode()?.dispatchEvent(new SliderCommitEvent(value, reason))
  }

  function geometry(index: number) {
    let rect = control!.getBoundingClientRect()
    let orientation = getOrientation()
    let thumbSize = 0
    if ((handle.props.thumbAlignment ?? 'center') !== 'center') {
      let thumbRect = thumbs.get(index)?.getBoundingClientRect()
      if (thumbRect) thumbSize = orientation === 'vertical' ? thumbRect.height : thumbRect.width
    }
    return { rect, orientation, thumbSize, rtl: getDirection(control) === 'rtl' }
  }

  function valueAt(x: number, y: number, index: number) {
    return fractionToValue(pointerToFraction(x, y, geometry(index)), readRange())
  }

  function thumbIndexOf(target: EventTarget | null): number {
    if (!(target instanceof Node)) return -1
    for (let [index, node] of thumbs) if (node.contains(target)) return index
    return -1
  }

  function setDragging(next: boolean) {
    if (dragging === next) return
    dragging = next
    void handle.update()
  }

  let context: SliderContextValue = {
    get values() {
      return getValues()
    },
    get value() {
      return output(getValues())
    },
    get formattedValues() {
      let { format, locale } = handle.props
      return getValues().map((value) => formatNumber(value, { format, locale }))
    },
    get min() {
      return readRange().min
    },
    get max() {
      return readRange().max
    },
    get step() {
      return readRange().step
    },
    get largeStep() {
      return handle.props.largeStep ?? 10
    },
    get minStepsBetweenValues() {
      return handle.props.minStepsBetweenValues ?? 0
    },
    get orientation() {
      return getOrientation()
    },
    get disabled() {
      return isDisabled()
    },
    get dragging() {
      return dragging
    },
    get activeThumbIndex() {
      return activeThumbIndex
    },
    get range() {
      return isRange
    },
    labelId: `${handle.id}-label`,
  }

  internalsByContext.set(context, {
    get field() {
      return fieldState
    },
    fieldFocus() {
      if (focusWithin) return
      focusWithin = true
      fieldControl.focus()
    },
    fieldBlur(event) {
      // Moving between thumbs is not a blur of the field.
      if (focusStaysInside(event.relatedTarget, [control, ...thumbs.values()])) return
      focusWithin = false
      fieldControl.blur()
    },
    get rtl() {
      return rtl
    },
    get hasLabel() {
      return hasLabel
    },
    get alignment() {
      return handle.props.thumbAlignment ?? 'center'
    },
    thumbIdBase,
    claimThumbIndex() {
      return autoIndex++
    },
    registerLabel() {
      hasLabel = true
    },
    labelMounted() {
      // Parts rendered before the label (the root, at least) pick up `aria-labelledby` on the
      // next render. In server HTML, only parts after the label have it.
      if (labelSynced) return
      labelSynced = true
      void handle.update()
    },
    setRtl(next) {
      if (rtl === next) return
      rtl = next
      void handle.update()
    },
    setControl(node) {
      control = node
    },
    setThumb(index, node) {
      if (node) thumbs.set(index, node)
      else thumbs.delete(index)
    },
    setActive(index) {
      if (activeThumbIndex === index) return
      activeThumbIndex = index
      void handle.update()
    },
    isThumbDisabled(index) {
      return isDisabled() || disabledThumbs.has(index)
    },
    setThumbDisabled(index, disabled) {
      if (disabled) disabledThumbs.add(index)
      else disabledThumbs.delete(index)
    },
    focusThumb(index) {
      thumbs.get(index)?.focus({ preventScroll: true })
    },
    keyboardStep(index, event) {
      if (isDisabled() || disabledThumbs.has(index)) return
      let range = readRange()
      let largeStep = handle.props.largeStep ?? 10
      let values = getValues()
      let current = values[index]
      if (current === undefined) return
      let amount = event.shiftKey ? largeStep : range.step
      let next: number | undefined
      switch (event.key) {
        case 'ArrowUp':
          next = current + amount
          break
        case 'ArrowDown':
          next = current - amount
          break
        case 'ArrowRight':
        case 'ArrowLeft': {
          let step =
            getOrientation() === 'horizontal'
              ? horizontalArrowStep(event.key, getDirection(event.currentTarget as Element))
              : event.key === 'ArrowRight'
                ? 1
                : -1
          next = current + step * amount
          break
        }
        case 'PageUp':
          next = current + largeStep
          break
        case 'PageDown':
          next = current - largeStep
          break
        case 'Home':
          next = range.min
          break
        case 'End':
          next = range.max
          break
        default:
          return
      }
      event.preventDefault()
      let snapped = roundToStep(next, range.step, range.min)
      let nextValues = setThumbValue(values, index, snapped, range)
      if (change(nextValues, 'keyboard', event, index, event.currentTarget as Element)) {
        commit('keyboard', event)
      }
    },
    pointerDown(event) {
      if (isDisabled() || !control || event.button !== 0) return
      let values = getValues()
      let pressedThumb = thumbIndexOf(event.target)
      if (pressedThumb !== -1 && disabledThumbs.has(pressedThumb)) return
      let index = pressedThumb
      let offsetX = 0
      let offsetY = 0
      if (index === -1) {
        let value = valueAt(event.clientX, event.clientY, 0)
        index = closestThumbIndex(values, value)
        if (disabledThumbs.has(index)) return
      } else {
        // Keep the grab point under the pointer instead of jumping the thumb's center to it.
        let rect = thumbs.get(index)!.getBoundingClientRect()
        offsetX = event.clientX - (rect.left + rect.width / 2)
        offsetY = event.clientY - (rect.top + rect.height / 2)
      }

      // Prevents text selection and the focus change of the press; focus goes to the thumb.
      event.preventDefault()
      try {
        control.setPointerCapture(event.pointerId)
      } catch {
        // Synthetic or already-released pointers can't be captured.
      }
      drag = {
        pointerId: event.pointerId,
        index,
        offsetX,
        offsetY,
        startValues: values,
        moved: false,
        pressedTrack: pressedThumb === -1,
      }
      activeThumbIndex = index
      if (pressedThumb === -1) {
        let value = valueAt(event.clientX, event.clientY, index)
        let result = moveThumb(
          values,
          index,
          value,
          readRange(),
          handle.props.thumbCollisionBehavior ?? 'push',
        )
        drag.index = result.activeIndex
        change(result.values, 'track-press', event, result.activeIndex, control)
      }
      void handle.update()
      thumbs.get(drag.index)?.focus({ preventScroll: true })
    },
    pointerMove(event) {
      if (!drag || event.pointerId !== drag.pointerId) return
      let value = valueAt(event.clientX - drag.offsetX, event.clientY - drag.offsetY, drag.index)
      let result = moveThumb(
        getValues(),
        drag.index,
        value,
        readRange(),
        handle.props.thumbCollisionBehavior ?? 'push',
      )
      drag.moved = true
      setDragging(true)
      let swapped = result.activeIndex !== drag.index
      drag.index = result.activeIndex
      change(result.values, 'drag', event, result.activeIndex, thumbs.get(result.activeIndex))
      if (swapped) {
        // The moved thumb now has a different index; keep focus on the thumb under the pointer.
        let index = result.activeIndex
        void handle.update().then(() => thumbs.get(index)?.focus({ preventScroll: true }))
      }
    },
    pointerUp(event) {
      if (!drag || event.pointerId !== drag.pointerId) return
      let state = drag
      drag = undefined
      try {
        if (control?.hasPointerCapture(event.pointerId)) {
          control.releasePointerCapture(event.pointerId)
        }
      } catch {
        // Already released.
      }
      setDragging(false)
      if (!sameValues(state.startValues, getValues())) {
        commit(state.moved ? 'drag' : 'track-press', event)
      }
    },
    ariaValueText(index) {
      let values = getValues()
      let value = values[index]
      if (value === undefined) return undefined
      let { format, locale } = handle.props
      let formatted = formatNumber(value, { format, locale })
      if (values.length > 1) {
        if (index === 0) return `${formatted} start range`
        if (index === values.length - 1) return `${formatted} end range`
        return formatted
      }
      return format ? formatted : undefined
    },
  })

  handle.context.set(context)

  return () => {
    let { children, form } = handle.props
    let values = getValues()
    let f = (fieldState = fieldControl.render({
      value: output(values),
      disabled: handle.props.disabled === true,
      name: handle.props.name,
    }))
    let name = f.name
    let disabled = f.disabled
    return [
      children,
      name === undefined
        ? null
        : values.map((value) =>
            createElement('input', {
              type: 'hidden',
              name,
              form,
              value: String(value),
              disabled: disabled || undefined,
            }),
          ),
    ]
  }
}

function getSliderContext(handle: MixinHandle<HTMLElement, ElementProps> | Handle<any, any>) {
  let context = handle.context.get(SliderProvider) as SliderContextValue | undefined
  if (!context) throw new Error('stems-ui/slider parts must render inside <slider.Context>')
  return context
}

function stateAttributes(context: SliderContextValue) {
  let field = internalsByContext.get(context)!.field
  // Base UI's slider parts have the field attributes except `data-filled`.
  let {
    'data-disabled': _disabled,
    'data-filled': _filled,
    ...fieldData
  } = field?.inField ? field.dataAttrs : {}
  return {
    ...fieldData,
    'data-orientation': context.orientation,
    'data-dragging': context.dragging ? '' : undefined,
    'data-disabled': context.disabled ? '' : undefined,
  }
}

const rootMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let context = getSliderContext(handle)
  let internals = internalsByContext.get(context)!
  return (props) => {
    let field = internals.field
    return attrs({
      role: 'group',
      // Inside a field, the root takes the field's control id (a `field.label()` pointing at
      // it focuses the first thumb) and is labelled by the slider's or the field's label.
      id: field?.inField ? field.id : undefined,
      'aria-labelledby':
        props['aria-label'] === undefined
          ? internals.hasLabel
            ? context.labelId
            : field?.labelId
          : undefined,
      ...stateAttributes(context),
    })
  }
})

const labelMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let context = getSliderContext(handle)
  let internals = internalsByContext.get(context)!
  internals.registerLabel()
  return () => [
    attrs({ id: context.labelId, ...stateAttributes(context) }),
    ref(() => internals.labelMounted()),
    on<HTMLElement, 'click'>('click', () => {
      // Like a native <label>: clicking it focuses the (first enabled) control.
      for (let index = 0; index < context.values.length; index++) {
        if (!internals.isThumbDisabled(index)) {
          internals.focusThumb(index)
          return
        }
      }
    }),
  ]
})

const valueMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let context = getSliderContext(handle)
  let internals = internalsByContext.get(context)!
  return () =>
    attrs({
      'aria-live': 'off',
      for: context.values.map((_, index) => `${internals.thumbIdBase}-${index}`).join(' '),
      ...stateAttributes(context),
    })
})

const controlMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let context = getSliderContext(handle)
  let internals = internalsByContext.get(context)!
  return () => [
    attrs(stateAttributes(context)),
    ref((node: HTMLElement, signal) => {
      internals.setControl(node)
      signal.addEventListener('abort', () => internals.setControl(undefined))
    }),
    on<HTMLElement, 'pointerdown'>('pointerdown', (event) => internals.pointerDown(event)),
    on<HTMLElement, 'pointermove'>('pointermove', (event) => internals.pointerMove(event)),
    on<HTMLElement, 'pointerup'>('pointerup', (event) => internals.pointerUp(event)),
    on<HTMLElement, 'pointercancel'>('pointercancel', (event) => internals.pointerUp(event)),
    on<HTMLElement, 'lostpointercapture'>('lostpointercapture', (event) =>
      internals.pointerUp(event),
    ),
  ]
})

const trackMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let context = getSliderContext(handle)
  return (props) =>
    createElement(handle.element, {
      style: props.style ?? { position: 'relative' },
      mix: attrs(stateAttributes(context)),
    })
})

const indicatorMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let context = getSliderContext(handle)
  return (props) => {
    let { values, min, max, orientation } = context
    let start = values.length > 1 ? valueToPercent(values[0], min, max) : 0
    let end = valueToPercent(values[values.length - 1], min, max)
    return createElement(handle.element, {
      style: mergeOwnedStyle(indicatorPositionStyle(start, end, orientation), props.style),
      mix: attrs(stateAttributes(context)),
    })
  }
})

export interface SliderThumbOptions {
  /**
   * The index of the thumb's value in the value array. Without it, thumbs are numbered in render
   * order; pass it for range sliders whose thumbs render conditionally or out of order.
   */
  index?: number
  /**
   * Whether this thumb ignores user interaction.
   * @default false
   */
  disabled?: boolean
  /** Returns the thumb's `aria-label`. */
  getAriaLabel?: (index: number) => string
  /** Returns the thumb's `aria-valuetext`. */
  getAriaValueText?: (formattedValue: string, value: number, index: number) => string
}

const thumbMixin: MixinFactory<HTMLElement, [options?: SliderThumbOptions], ElementProps> =
  createMixin<HTMLElement, [options?: SliderThumbOptions], ElementProps>((handle) => {
    let context = getSliderContext(handle)
    let internals = internalsByContext.get(context)!
    let autoIndex: number | undefined
    let currentIndex = 0

    return (...args: [options: SliderThumbOptions | undefined, props: ElementProps]) => {
      // Called as `thumb()`, the runtime passes the host props in the first slot.
      let [options, props] = splitOptions(args[0], args[1])
      let index = options?.index ?? (autoIndex ??= internals.claimThumbIndex())
      currentIndex = index
      internals.setThumbDisabled(index, options?.disabled === true)

      let { values, min, max, orientation } = context
      let value = values[index] ?? min
      let disabled = internals.isThumbDisabled(index)
      let percent = valueToPercent(value, min, max)
      let hasName = props['aria-label'] !== undefined || props['aria-labelledby'] !== undefined
      let formatted = context.formattedValues[index] ?? ''
      let valueText = options?.getAriaValueText
        ? options.getAriaValueText(formatted, value, index)
        : internals.ariaValueText(index)

      return createElement(handle.element, {
        style: mergeOwnedStyle(
          thumbPositionStyle(
            percent,
            orientation,
            internals.alignment,
            internals.rtl,
            context.activeThumbIndex === index,
          ),
          props.style,
        ),
        mix: [
          attrs({
            id: `${internals.thumbIdBase}-${index}`,
            role: 'slider',
            tabIndex: disabled ? -1 : 0,
            'aria-valuenow': value,
            'aria-valuemin': min,
            'aria-valuemax': max,
            'aria-valuetext': valueText,
            'aria-orientation': orientation,
            'aria-disabled': disabled ? 'true' : undefined,
            'aria-label': options?.getAriaLabel?.(index),
            'aria-labelledby':
              !hasName && !options?.getAriaLabel
                ? internals.hasLabel
                  ? context.labelId
                  : internals.field?.labelId
                : undefined,
            'aria-describedby': internals.field?.describedBy,
            'aria-invalid': internals.field?.invalid ? 'true' : undefined,
            'data-index': String(index),
            ...stateAttributes(context),
            'data-disabled': disabled ? '' : undefined,
          }),
          ref((node: HTMLElement, signal) => {
            let registered = currentIndex
            internals.setThumb(registered, node)
            // Server HTML assumes LTR; correct thumb offsets once the real direction is known.
            internals.setRtl(getDirection(node) === 'rtl')
            signal.addEventListener('abort', () => internals.setThumb(registered, undefined))
          }),
          on<HTMLElement, 'keydown'>('keydown', (event) => {
            if (event.target !== event.currentTarget) return
            internals.keyboardStep(currentIndex, event)
          }),
          on<HTMLElement, 'focus'>('focus', () => {
            internals.setActive(currentIndex)
            internals.fieldFocus()
          }),
          on<HTMLElement, 'blur'>('blur', (event) => internals.fieldBlur(event)),
        ],
      })
    }
  })

export interface SliderValueTextProps {
  /** Custom rendering of the values. */
  children?: (formattedValues: readonly string[], values: readonly number[]) => RemixNode
}

/**
 * Renders the formatted value(s) as text (no element of its own); range values are joined with
 * an en dash. Put it inside the `value()` host: `<output mix={slider.value()}><slider.ValueText /></output>`.
 */
export function ValueText(handle: Handle<SliderValueTextProps>): () => RemixNode {
  let context = getSliderContext(handle)
  return () => {
    let render = handle.props.children
    if (render) return render(context.formattedValues, context.values)
    return context.formattedValues.join(' – ')
  }
}

/**
 * Provider that owns the slider value and renders one hidden `<input>` per thumb (when `name`
 * is set) for form submission, after its children. Inside a `<field.Context>` it is the field's
 * control: thumbs are labelled and described by the field, every part gets the field state
 * attributes, and the field's `name` and `disabled` apply.
 */
export const Context = SliderProvider

/** The root: `role="group"`, labelled by `label()`, with the slider state attributes. */
export const root = rootMixin

/** A visible label. Thumbs without their own `aria-label` point `aria-labelledby` at it. */
export const label = labelMixin

/** The host for the value text (use an `<output>`); see `ValueText`. */
export const value = valueMixin

/**
 * The interactive area. A press moves the closest thumb there; dragging moves it with pointer
 * capture. Give it `touch-action: none` and make it the thumbs' containing block
 * (`position: relative`).
 */
export const control = controlMixin

/** The track. Defaults to `position: relative` unless the host sets `style`. */
export const track = trackMixin

/** The filled part of the track. Owns its position and size (inline style). */
export const indicator = indicatorMixin

/**
 * A draggable thumb: a focusable `role="slider"` element with `aria-valuenow/min/max/valuetext`
 * and keyboard support. Owns its inline position.
 */
export const thumb = thumbMixin

/** Listens for the bubbling `stems:slider-change` event. */
export function onSliderChange<target extends HTMLElement>(
  handler: SliderEventHandler<SliderChangeEvent, target>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof SLIDER_CHANGE_EVENT>> {
  return on(SLIDER_CHANGE_EVENT, handler, captureBoolean)
}

/** Listens for the bubbling `stems:slider-commit` event. */
export function onSliderCommit<target extends HTMLElement>(
  handler: SliderEventHandler<SliderCommitEvent, target>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof SLIDER_COMMIT_EVENT>> {
  return on(SLIDER_COMMIT_EVENT, handler, captureBoolean)
}
