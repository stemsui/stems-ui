import type { Handle, Props } from 'remix/component'
import { toggleButton, type ToggleButtonOptions } from 'stems-ui/toggle-button'
import * as toggleButtonGroup from 'stems-ui/toggle-button-group'

import { cn } from '#stems/lib/utils.ts'
import { toggleButtonVariants, type ToggleButtonVariantProps } from '#stems/ui/toggle-button.tsx'

export {
  onToggleButtonGroupChange,
  ToggleButtonGroupChangeEvent,
} from 'stems-ui/toggle-button-group'

/*
 * shadcn/ui's `toggle-group`, named `toggle-button-group` because Remix's `toggle` is a switch.
 * State hooks used for styling:
 *   group (stems-ui/toggle-button-group): data-orientation, data-disabled, data-multiple
 *   items (stems-ui/toggle-button): aria-pressed / data-pressed, disabled / data-disabled
 */

interface ToggleButtonGroupStyleContext {
  readonly variant: ToggleButtonVariantProps['variant']
  readonly size: ToggleButtonVariantProps['size']
  readonly spacing: number
}

export type ToggleButtonGroupProps = Omit<
  Props<'div'>,
  keyof toggleButtonGroup.ToggleButtonGroupContextProps
> &
  toggleButtonGroup.ToggleButtonGroupContextProps &
  ToggleButtonVariantProps & {
    /** Gap between items, in Tailwind spacing units. `0` joins the items into one control. */
    spacing?: number
  }

export function ToggleButtonGroup(
  handle: Handle<ToggleButtonGroupProps, ToggleButtonGroupStyleContext>,
) {
  handle.context.set({
    get variant() {
      return handle.props.variant
    },
    get size() {
      return handle.props.size
    },
    get spacing() {
      return handle.props.spacing ?? 2
    },
  })

  return () => {
    let {
      class: className,
      mix,
      children,
      style,
      variant,
      size,
      spacing = 2,
      value,
      defaultValue,
      onValueChange,
      multiple,
      disabled,
      orientation = 'horizontal',
      loopFocus,
      ...props
    } = handle.props

    return (
      <toggleButtonGroup.Context
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        multiple={multiple}
        disabled={disabled}
        orientation={orientation}
        loopFocus={loopFocus}
      >
        <div
          data-slot="toggle-button-group"
          data-variant={variant}
          data-size={size}
          data-spacing={spacing}
          {...props}
          style={{ '--gap': spacing, ...(typeof style === 'object' ? style : {}) }}
          class={cn(
            'group/toggle-group flex w-fit flex-row items-center gap-[--spacing(var(--gap))] rounded-md data-[spacing=0]:data-[variant=outline]:shadow-xs data-vertical:flex-col data-vertical:items-stretch',
            className,
          )}
          mix={[toggleButtonGroup.root(), mix]}
        >
          {children}
        </div>
      </toggleButtonGroup.Context>
    )
  }
}

export type ToggleButtonGroupItemProps = Omit<Props<'button'>, keyof ToggleButtonOptions> &
  Omit<ToggleButtonOptions, 'pressed' | 'defaultPressed'> &
  ToggleButtonVariantProps

export function ToggleButtonGroupItem(handle: Handle<ToggleButtonGroupItemProps>) {
  let context = handle.context.get(ToggleButtonGroup) as ToggleButtonGroupStyleContext | undefined

  return () => {
    let {
      class: className,
      mix,
      variant: itemVariant = 'default',
      size: itemSize = 'default',
      value,
      disabled,
      onPressedChange,
      ...props
    } = handle.props
    let variant = context?.variant || itemVariant
    let size = context?.size || itemSize

    return (
      <button
        data-slot="toggle-button-group-item"
        data-variant={variant}
        data-size={size}
        data-spacing={context?.spacing}
        {...props}
        class={cn(
          'shrink-0 group-data-[spacing=0]/toggle-group:rounded-none group-data-[spacing=0]/toggle-group:px-2 group-data-[spacing=0]/toggle-group:shadow-none focus:z-10 focus-visible:z-10 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-end]:pr-1.5 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-start]:pl-1.5 group-data-horizontal/toggle-group:data-[spacing=0]:first:rounded-l-md group-data-vertical/toggle-group:data-[spacing=0]:first:rounded-t-md group-data-horizontal/toggle-group:data-[spacing=0]:last:rounded-r-md group-data-vertical/toggle-group:data-[spacing=0]:last:rounded-b-md group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:border-l-0 group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:border-t-0 group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-l group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-t',
          toggleButtonVariants({ variant, size }),
          className,
        )}
        mix={[toggleButton({ value, disabled, onPressedChange }), mix]}
      />
    )
  }
}
