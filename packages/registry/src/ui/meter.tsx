import type { Handle, Props } from 'remix/component'
import * as meter from 'stems-ui/meter'

import { cn } from '#stems/lib/utils.ts'

/*
 * shadcn has no Meter; this mirrors the Progress styles so the two sit together.
 */

export type MeterProps = Props<'div'> & Omit<meter.MeterContextProps, 'children'>

/** A meter. Children (e.g. `MeterLabel`, `MeterValue`) render before the track. */
export function Meter(handle: Handle<MeterProps>) {
  return () => {
    let {
      class: className,
      mix,
      children,
      value,
      min,
      max,
      format,
      locale,
      getAriaValueText,
      ...props
    } = handle.props

    return (
      <meter.Context
        value={value}
        min={min}
        max={max}
        format={format}
        locale={locale}
        getAriaValueText={getAriaValueText}
      >
        <div
          data-slot="meter"
          {...props}
          class={cn('flex flex-wrap gap-3', className)}
          mix={[meter.root(), mix]}
        >
          {children}
          <MeterTrack>
            <MeterIndicator />
          </MeterTrack>
        </div>
      </meter.Context>
    )
  }
}

export function MeterTrack(handle: Handle<Props<'div'>>) {
  return () => {
    let { class: className, mix, ...props } = handle.props

    return (
      <div
        data-slot="meter-track"
        {...props}
        class={cn(
          'relative flex h-1.5 w-full items-center overflow-x-hidden rounded-full bg-muted',
          className,
        )}
        mix={[meter.track(), mix]}
      />
    )
  }
}

export function MeterIndicator(handle: Handle<Props<'div'>>) {
  return () => {
    let { class: className, mix, ...props } = handle.props

    return (
      <div
        data-slot="meter-indicator"
        {...props}
        class={cn('h-full bg-primary transition-all', className)}
        mix={[meter.indicator(), mix]}
      />
    )
  }
}

export function MeterLabel(handle: Handle<Props<'span'>>) {
  return () => {
    let { class: className, mix, ...props } = handle.props

    return (
      <span
        data-slot="meter-label"
        {...props}
        class={cn('text-sm font-medium', className)}
        mix={[meter.label(), mix]}
      />
    )
  }
}

/** The formatted value. Pass children to replace the default text. */
export function MeterValue(handle: Handle<Props<'span'>>) {
  return () => {
    let { class: className, mix, children, ...props } = handle.props

    return (
      <span
        data-slot="meter-value"
        {...props}
        class={cn('ml-auto text-sm text-muted-foreground tabular-nums', className)}
        mix={[meter.value(), mix]}
      >
        {children ?? <meter.ValueText />}
      </span>
    )
  }
}
