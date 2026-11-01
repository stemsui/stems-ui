import { attrs, createElement, createMixin } from '@remix-run/component'
import type {
  ElementProps,
  Handle,
  MixinFactory,
  MixinHandle,
  RemixNode,
} from '@remix-run/component'

import { formatValue, indicatorStyle, valueToPercent } from './progress.ts'

export { formatValue } from './progress.ts'

export interface MeterContextProps {
  /** The current value. */
  value: number
  /** @default 0 */
  min?: number
  /** @default 100 */
  max?: number
  /** Options for `Intl.NumberFormat`. Without it, the value is formatted as a percent of 100. */
  format?: Intl.NumberFormatOptions
  /** The locale used by `Intl.NumberFormat`. Defaults to the runtime locale. */
  locale?: Intl.LocalesArgument
  /** Returns a human-readable text alternative for the current value (`aria-valuetext`). */
  getAriaValueText?: (formattedValue: string, value: number) => string
  children?: RemixNode
}

export interface MeterContextValue {
  readonly value: number
  readonly min: number
  readonly max: number
  /** The value formatted with `format`/`locale`. */
  readonly formattedValue: string
  /** Position of the value in the range, 0-100. */
  readonly percentage: number
  readonly ariaValueText: string
  readonly labelId: string
}

function MeterProvider(handle: Handle<MeterContextProps, MeterContextValue>): () => RemixNode {
  let labelId = `${handle.id}-label`
  let cacheKey: unknown[] = []
  let cached: Omit<MeterContextValue, 'labelId'> | undefined

  function read() {
    let { value, min = 0, max = 100, format, locale, getAriaValueText } = handle.props
    let key = [value, min, max, format, locale, getAriaValueText]
    if (cached && key.every((part, index) => Object.is(part, cacheKey[index]))) return cached

    let formattedValue = formatValue(value, { format, locale })
    cacheKey = key
    cached = {
      value,
      min,
      max,
      formattedValue,
      percentage: valueToPercent(value, min, max),
      ariaValueText: getAriaValueText
        ? getAriaValueText(formattedValue, value)
        : formattedValue || String(value),
    }
    return cached
  }

  handle.context.set({
    get value() {
      return read().value
    },
    get min() {
      return read().min
    },
    get max() {
      return read().max
    },
    get formattedValue() {
      return read().formattedValue
    },
    get percentage() {
      return read().percentage
    },
    get ariaValueText() {
      return read().ariaValueText
    },
    labelId,
  })

  return () => handle.props.children
}

function getMeterContext(handle: MixinHandle | Handle<any, any>): MeterContextValue {
  let context = handle.context.get(MeterProvider)
  if (!context) throw new Error('stems-ui/meter parts must render inside <meter.Context>')
  return context
}

function partMixin(
  getAttrs: (context: MeterContextValue, props: ElementProps) => ElementProps,
): MixinFactory<HTMLElement, [], ElementProps> {
  return createMixin<HTMLElement, [], ElementProps>((handle) => {
    let context = getMeterContext(handle)
    return (props) => attrs(getAttrs(context, props))
  })
}

const rootMixin = partMixin((context, props) => ({
  role: 'meter',
  'aria-valuemin': context.min,
  'aria-valuemax': context.max,
  'aria-valuenow': context.value,
  'aria-valuetext': context.ariaValueText,
  'aria-labelledby': props['aria-label'] === undefined ? context.labelId : undefined,
}))

const trackMixin = partMixin(() => ({}))

const indicatorMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let context = getMeterContext(handle)
  return (props) =>
    createElement(handle.element, {
      ...props,
      style: indicatorStyle(context.percentage, props.style),
    })
})

const valueMixin = partMixin(() => ({ 'aria-hidden': 'true' }))

const labelMixin = partMixin((context) => ({ id: context.labelId }))

export interface MeterValueTextProps {
  /** Custom rendering of the value. */
  children?: (formattedValue: string, value: number) => RemixNode
}

/**
 * Renders the formatted value as text (no element of its own). Put it inside the host that has
 * `value()`: `<span mix={meter.value()}><meter.ValueText /></span>`.
 */
export function ValueText(handle: Handle<MeterValueTextProps>): () => RemixNode {
  let context = getMeterContext(handle)
  return () => {
    let render = handle.props.children
    return render ? render(context.formattedValue, context.value) : context.formattedValue
  }
}

/** Provides the value, range, and formatting to the meter parts. */
export const Context = MeterProvider
/** The root: `role="meter"` with `aria-valuenow/min/max/valuetext`. */
export const root: MixinFactory<HTMLElement, [], ElementProps> = rootMixin
/** The track representing the whole range. */
export const track: MixinFactory<HTMLElement, [], ElementProps> = trackMixin
/** The indicator. Sets an inline `width` percentage. */
export const indicator: MixinFactory<HTMLElement, [], ElementProps> = indicatorMixin
/** The host for the value text. Hidden from assistive technology (the root has the value). */
export const value: MixinFactory<HTMLElement, [], ElementProps> = valueMixin
/** The visible label; the root's `aria-labelledby` points at it. */
export const label: MixinFactory<HTMLElement, [], ElementProps> = labelMixin
