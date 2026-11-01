import { attrs, createElement, createMixin } from '@remix-run/component'
import type {
  ElementProps,
  Handle,
  MixinFactory,
  MixinHandle,
  RemixNode,
} from '@remix-run/component'

export type ProgressStatus = 'indeterminate' | 'progressing' | 'complete'

export interface ProgressContextProps {
  /** The current value. The progress bar is indeterminate when `null`. */
  value: number | null
  /** @default 0 */
  min?: number
  /** @default 100 */
  max?: number
  /** Options for `Intl.NumberFormat`. Without it, the value is formatted as a percent of 100. */
  format?: Intl.NumberFormatOptions
  /** The locale used by `Intl.NumberFormat`. Defaults to the runtime locale. */
  locale?: Intl.LocalesArgument
  /** Returns a human-readable text alternative for the current value (`aria-valuetext`). */
  getAriaValueText?: (formattedValue: string, value: number | null) => string
  children?: RemixNode
}

export interface ProgressContextValue {
  readonly value: number | null
  readonly min: number
  readonly max: number
  readonly status: ProgressStatus
  /** The value formatted with `format`/`locale`; `''` when indeterminate. */
  readonly formattedValue: string
  /** Position of the value in the range, 0-100; `null` when indeterminate. */
  readonly percentage: number | null
  readonly ariaValueText: string
  readonly labelId: string
}

/**
 * Formats a progress or meter value like Base UI: with `format`, via `Intl.NumberFormat`;
 * without it, as a percentage of 100 (`value / 100` with `style: 'percent'`).
 */
export function formatValue(
  value: number | null,
  options: { format?: Intl.NumberFormatOptions; locale?: Intl.LocalesArgument } = {},
): string {
  if (value === null || !Number.isFinite(value)) return ''
  if (!options.format) {
    return new Intl.NumberFormat(options.locale, { style: 'percent' }).format(value / 100)
  }
  return new Intl.NumberFormat(options.locale, options.format).format(value)
}

/** Converts a value to its position in `[min, max]` as a 0-100 percentage. */
export function valueToPercent(value: number, min: number, max: number): number {
  if (max === min) return 0
  return Math.min(100, Math.max(0, ((value - min) * 100) / (max - min)))
}

function getStatus(value: number | null, max: number): ProgressStatus {
  if (value === null || !Number.isFinite(value)) return 'indeterminate'
  return value === max ? 'complete' : 'progressing'
}

function ProgressProvider(
  handle: Handle<ProgressContextProps, ProgressContextValue>,
): () => RemixNode {
  let labelId = `${handle.id}-label`

  let cacheKey: unknown[] = []
  let cached: Omit<ProgressContextValue, 'labelId'> | undefined

  // Derived state, recomputed only when the inputs change (formatting builds an Intl formatter).
  function read() {
    let { value = null, min = 0, max = 100, format, locale, getAriaValueText } = handle.props
    let key = [value, min, max, format, locale, getAriaValueText]
    if (cached && key.every((part, index) => Object.is(part, cacheKey[index]))) return cached

    let finite = value !== null && Number.isFinite(value)
    let formattedValue = formatValue(value, { format, locale })
    cacheKey = key
    cached = {
      value,
      min,
      max,
      formattedValue,
      status: getStatus(value, max),
      percentage: finite ? valueToPercent(value!, min, max) : null,
      ariaValueText: getAriaValueText
        ? getAriaValueText(formattedValue, value)
        : finite
          ? formattedValue || String(value)
          : 'indeterminate progress',
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
    get status() {
      return read().status
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

function getProgressContext(handle: MixinHandle | Handle<any, any>): ProgressContextValue {
  let context = handle.context.get(ProgressProvider)
  if (!context) throw new Error('stems-ui/progress parts must render inside <progress.Context>')
  return context
}

function statusAttrs(status: ProgressStatus) {
  return {
    'data-complete': status === 'complete' ? '' : undefined,
    'data-progressing': status === 'progressing' ? '' : undefined,
    'data-indeterminate': status === 'indeterminate' ? '' : undefined,
  }
}

function partMixin(
  getAttrs: (context: ProgressContextValue, props: ElementProps) => ElementProps,
): MixinFactory<HTMLElement, [], ElementProps> {
  return createMixin<HTMLElement, [], ElementProps>((handle) => {
    let context = getProgressContext(handle)
    return (props) => attrs({ ...getAttrs(context, props), ...statusAttrs(context.status) })
  })
}

const rootMixin = partMixin((context, props) => ({
  role: 'progressbar',
  'aria-valuemin': context.min,
  'aria-valuemax': context.max,
  'aria-valuenow': context.value ?? undefined,
  'aria-valuetext': context.ariaValueText,
  // An explicit `aria-label` names the bar; otherwise point at `label()`.
  'aria-labelledby': props['aria-label'] === undefined ? context.labelId : undefined,
}))

const trackMixin = partMixin(() => ({}))

/**
 * Base UI's indicator style for a finite percentage, merged with the host's own `style` (host
 * declarations win, except `width`, which the indicator owns).
 */
export function indicatorStyle(
  percentage: number | null,
  hostStyle: unknown,
): ElementProps['style'] | undefined {
  if (percentage === null) return hostStyle as ElementProps['style']
  let width = `${percentage}%`
  if (typeof hostStyle === 'string' && hostStyle.trim() !== '') {
    return `inset-inline-start:0;height:inherit;${hostStyle.replace(/;?\s*$/, ';')}width:${width}`
  }
  let base = hostStyle && typeof hostStyle === 'object' ? hostStyle : {}
  return { insetInlineStart: 0, height: 'inherit', ...base, width }
}

const indicatorMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let context = getProgressContext(handle)
  return (props) =>
    createElement(handle.element, {
      ...statusAttrs(context.status),
      ...props,
      style: indicatorStyle(context.percentage, props.style),
    })
})

const valueMixin = partMixin(() => ({ 'aria-hidden': 'true' }))

const labelMixin = partMixin((context) => ({ id: context.labelId }))

export interface ProgressValueTextProps {
  /** Custom rendering of the value. Receives `null` as the formatted value when indeterminate. */
  children?: (formattedValue: string | null, value: number | null) => RemixNode
}

/**
 * Renders the formatted value as text (no element of its own). Put it inside the host that has
 * `value()`: `<span mix={progress.value()}><progress.ValueText /></span>`.
 */
export function ValueText(handle: Handle<ProgressValueTextProps>): () => RemixNode {
  let context = getProgressContext(handle)
  return () => {
    let render = handle.props.children
    if (render) {
      return render(context.value === null ? null : context.formattedValue, context.value)
    }
    return context.formattedValue
  }
}

/** Provides the value, range, and formatting to the progress parts. */
export const Context = ProgressProvider
/** The root: `role="progressbar"` with `aria-valuenow/min/max/valuetext`. */
export const root: MixinFactory<HTMLElement, [], ElementProps> = rootMixin
/** The track containing the indicator. */
export const track: MixinFactory<HTMLElement, [], ElementProps> = trackMixin
/** The indicator. Sets an inline `width` percentage. */
export const indicator: MixinFactory<HTMLElement, [], ElementProps> = indicatorMixin
/** The host for the value text. Hidden from assistive technology (the root has the value). */
export const value: MixinFactory<HTMLElement, [], ElementProps> = valueMixin
/** The visible label; the root's `aria-labelledby` points at it. */
export const label: MixinFactory<HTMLElement, [], ElementProps> = labelMixin
