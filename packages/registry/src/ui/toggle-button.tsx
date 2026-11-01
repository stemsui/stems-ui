import type { Handle, Props } from 'remix/component'
import { toggleButton, type ToggleButtonOptions } from 'stems-ui/toggle-button'

import { cn } from '#stems/lib/utils.ts'

export { onToggleButtonChange, ToggleButtonChangeEvent } from 'stems-ui/toggle-button'

/*
 * shadcn/ui's `toggle`, named `toggle-button` because Remix's `toggle` is a switch.
 * State hooks used for styling (set by stems-ui/toggle-button):
 *   aria-pressed / data-pressed, disabled / data-disabled
 */

const toggleButtonBase =
  "group/toggle inline-flex items-center justify-center gap-1 rounded-md text-sm font-medium whitespace-nowrap transition-[color,box-shadow] outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-pressed:bg-muted dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

const toggleButtonVariantClasses = {
  variant: {
    default: 'bg-transparent',
    outline: 'border border-input bg-transparent shadow-xs hover:bg-muted',
  },
  size: {
    default: 'h-9 min-w-9 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
    sm: 'h-8 min-w-8 px-2.5 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5',
    lg: 'h-10 min-w-10 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
  },
} as const

export interface ToggleButtonVariantProps {
  variant?: keyof typeof toggleButtonVariantClasses.variant
  size?: keyof typeof toggleButtonVariantClasses.size
}

/** Class names for a toggle button, for styling other elements like one (shadcn's `toggleVariants`). */
export function toggleButtonVariants({
  variant = 'default',
  size = 'default',
  class: className,
}: ToggleButtonVariantProps & { class?: string } = {}): string {
  return cn(
    toggleButtonBase,
    toggleButtonVariantClasses.variant[variant],
    toggleButtonVariantClasses.size[size],
    className,
  )
}

export type ToggleButtonProps = Omit<Props<'button'>, keyof ToggleButtonOptions> &
  ToggleButtonOptions &
  ToggleButtonVariantProps

export function ToggleButton(handle: Handle<ToggleButtonProps>) {
  return () => {
    let {
      class: className,
      mix,
      variant,
      size,
      pressed,
      defaultPressed,
      onPressedChange,
      disabled,
      value,
      ...props
    } = handle.props

    return (
      <button
        data-slot="toggle-button"
        {...props}
        class={toggleButtonVariants({ variant, size, class: className })}
        mix={[toggleButton({ pressed, defaultPressed, onPressedChange, disabled, value }), mix]}
      />
    )
  }
}
