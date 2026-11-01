import type { Handle, Props } from 'remix/component'
import * as radio from 'stems-ui/radio'
import * as radioGroup from 'stems-ui/radio-group'

import { cn } from '#stems/lib/utils.ts'

export { onRadioGroupChange, RadioGroupChangeEvent } from 'stems-ui/radio-group'

/*
 * State hooks used for styling:
 *   group (stems-ui/radio-group): data-disabled, aria-orientation
 *   item and indicator (stems-ui/radio): data-checked / data-unchecked, data-disabled,
 *   data-readonly, data-required, aria-checked; inside a field also data-invalid (radios have
 *   no aria-invalid, so shadcn's `aria-invalid:` styles are mirrored as `data-invalid:`)
 *
 * Items are <span>s, like Base UI, so shadcn's `disabled:` styles become `data-disabled:`.
 * `id` goes to the item's hidden radio, so both a wrapping <label> and a sibling
 * <label for={id}> work.
 */

export type RadioGroupProps = Omit<Props<'div'>, keyof radioGroup.RadioGroupContextProps> &
  radioGroup.RadioGroupContextProps

export function RadioGroup(handle: Handle<RadioGroupProps>) {
  return () => {
    let {
      class: className,
      mix,
      children,
      value,
      defaultValue,
      onValueChange,
      name,
      form,
      disabled,
      readOnly,
      required,
      orientation,
      ...props
    } = handle.props

    return (
      <radioGroup.Context
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        name={name}
        form={form}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        orientation={orientation}
      >
        <div
          data-slot="radio-group"
          {...props}
          class={cn('grid w-full gap-3', className)}
          mix={[radioGroup.root(), mix]}
        >
          {children}
        </div>
      </radioGroup.Context>
    )
  }
}

export type RadioGroupItemProps = Omit<Props<'span'>, 'children' | keyof radio.RadioContextProps> &
  Omit<radio.RadioContextProps, 'children'>

export function RadioGroupItem(handle: Handle<RadioGroupItemProps>) {
  return () => {
    let {
      class: className,
      mix,
      value,
      disabled,
      readOnly,
      required,
      id,
      inputRef,
      ...props
    } = handle.props

    return (
      <radio.Context
        value={value}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        id={id}
        inputRef={inputRef}
      >
        <span
          data-slot="radio-group-item"
          {...props}
          class={cn(
            'group/radio-group-item peer relative flex aspect-square size-4 shrink-0 rounded-full border border-input outline-none group-has-[:focus-visible]/field-label:ring-0 group-has-[:focus-visible]/field-label:not-data-checked:border-input after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-disabled:cursor-not-allowed data-disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary data-invalid:border-destructive data-invalid:ring-3 data-invalid:ring-destructive/20 data-invalid:data-checked:border-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 dark:data-invalid:border-destructive/50 dark:data-invalid:ring-destructive/40 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground group-has-[:focus-visible]/field-label:data-checked:border-primary dark:data-checked:bg-primary',
            className,
          )}
          mix={[radio.root(), mix]}
        >
          <span
            data-slot="radio-group-indicator"
            class="flex size-4 items-center justify-center"
            mix={radio.indicator()}
          >
            <span class="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-foreground" />
          </span>
        </span>
      </radio.Context>
    )
  }
}
