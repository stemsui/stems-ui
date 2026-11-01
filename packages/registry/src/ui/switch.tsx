import type { Handle, Props } from 'remix/component'
import * as switch_ from 'stems-ui/switch'

import { cn } from '#stems/lib/utils.ts'

export { onSwitchChange, SwitchChangeEvent } from 'stems-ui/switch'

/*
 * State hooks used for styling (set by stems-ui/switch on root and thumb):
 *   data-checked / data-unchecked, data-disabled, data-readonly, data-required
 *
 * The root is a <span>, like Base UI. `id` goes to the hidden input, so both a wrapping
 * <label> and a sibling <label for={id}> work.
 */

export type SwitchProps = Omit<Props<'span'>, 'children' | keyof switch_.SwitchContextProps> &
  Omit<switch_.SwitchContextProps, 'children'> & {
    size?: 'sm' | 'default'
  }

export function Switch(handle: Handle<SwitchProps>) {
  return () => {
    let {
      class: className,
      mix,
      size = 'default',
      checked,
      defaultChecked,
      onCheckedChange,
      disabled,
      readOnly,
      required,
      name,
      value,
      uncheckedValue,
      form,
      id,
      inputRef,
      ...props
    } = handle.props

    return (
      <switch_.Context
        checked={checked}
        defaultChecked={defaultChecked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        name={name}
        value={value}
        uncheckedValue={uncheckedValue}
        form={form}
        id={id}
        inputRef={inputRef}
      >
        <span
          data-slot="switch"
          data-size={size}
          {...props}
          class={cn(
            'peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none group-has-[:focus-visible]/field-label:border-transparent group-has-[:focus-visible]/field-label:ring-0 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:bg-primary data-unchecked:bg-input dark:data-unchecked:bg-input/80 data-disabled:cursor-not-allowed data-disabled:opacity-50',
            className,
          )}
          mix={[switch_.root(), mix]}
        >
          <span
            data-slot="switch-thumb"
            class="pointer-events-none block rounded-full bg-background ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] dark:data-checked:bg-primary-foreground group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0 dark:data-unchecked:bg-foreground"
            mix={switch_.thumb()}
          />
        </span>
      </switch_.Context>
    )
  }
}
