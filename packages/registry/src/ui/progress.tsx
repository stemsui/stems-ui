import type { Handle, Props } from 'remix/component'
import * as progress from 'stems-ui/progress'

import { cn } from '#stems/lib/utils.ts'

export type ProgressProps = Props<'div'> & Omit<progress.ProgressContextProps, 'children'>

/** A progress bar. Children (e.g. `ProgressLabel`, `ProgressValue`) render before the track. */
export function Progress(handle: Handle<ProgressProps>) {
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
      <progress.Context
        value={value}
        min={min}
        max={max}
        format={format}
        locale={locale}
        getAriaValueText={getAriaValueText}
      >
        <div
          data-slot="progress"
          {...props}
          class={cn('flex flex-wrap gap-3', className)}
          mix={[progress.root(), mix]}
        >
          {children}
          <ProgressTrack>
            <ProgressIndicator />
          </ProgressTrack>
        </div>
      </progress.Context>
    )
  }
}

export function ProgressTrack(handle: Handle<Props<'div'>>) {
  return () => {
    let { class: className, mix, ...props } = handle.props

    return (
      <div
        data-slot="progress-track"
        {...props}
        class={cn(
          'relative flex h-1.5 w-full items-center overflow-x-hidden rounded-full bg-muted',
          className,
        )}
        mix={[progress.track(), mix]}
      />
    )
  }
}

export function ProgressIndicator(handle: Handle<Props<'div'>>) {
  return () => {
    let { class: className, mix, ...props } = handle.props

    return (
      <div
        data-slot="progress-indicator"
        {...props}
        class={cn('h-full bg-primary transition-all', className)}
        mix={[progress.indicator(), mix]}
      />
    )
  }
}

export function ProgressLabel(handle: Handle<Props<'span'>>) {
  return () => {
    let { class: className, mix, ...props } = handle.props

    return (
      <span
        data-slot="progress-label"
        {...props}
        class={cn('text-sm font-medium', className)}
        mix={[progress.label(), mix]}
      />
    )
  }
}

/** The formatted value. Pass children to replace the default text. */
export function ProgressValue(handle: Handle<Props<'span'>>) {
  return () => {
    let { class: className, mix, children, ...props } = handle.props

    return (
      <span
        data-slot="progress-value"
        {...props}
        class={cn('ml-auto text-sm text-muted-foreground tabular-nums', className)}
        mix={[progress.value(), mix]}
      >
        {children ?? <progress.ValueText />}
      </span>
    )
  }
}
