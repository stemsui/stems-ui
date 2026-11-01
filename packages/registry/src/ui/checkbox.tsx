import type { Handle, Props } from 'remix/component'
import * as checkbox from 'stems-ui/checkbox'

import { cn } from '#stems/lib/utils.ts'

export { CheckboxChangeEvent, onCheckboxChange } from 'stems-ui/checkbox'

/*
 * State hooks used for styling (set by stems-ui/checkbox on root and indicator):
 *   data-checked / data-unchecked, data-indeterminate, data-disabled, data-readonly,
 *   data-required, aria-checked ("true" / "false" / "mixed")
 *
 * The root is a <span>, like Base UI, so shadcn's `disabled:` styles become `data-disabled:`.
 * `id` goes to the hidden input, so both a wrapping <label> and a sibling <label for={id}> work.
 * The indicator shows a check, or a dash while indeterminate.
 */

export type CheckboxProps = Omit<Props<'span'>, 'children' | keyof checkbox.CheckboxContextProps> &
  Omit<checkbox.CheckboxContextProps, 'children'>

export function Checkbox(handle: Handle<CheckboxProps>) {
  return () => {
    let {
      class: className,
      mix,
      checked,
      defaultChecked,
      onCheckedChange,
      indeterminate,
      disabled,
      readOnly,
      required,
      name,
      value,
      uncheckedValue,
      form,
      id,
      inputRef,
      parent,
      ...props
    } = handle.props

    return (
      <checkbox.Context
        checked={checked}
        defaultChecked={defaultChecked}
        onCheckedChange={onCheckedChange}
        indeterminate={indeterminate}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        name={name}
        value={value}
        uncheckedValue={uncheckedValue}
        form={form}
        id={id}
        inputRef={inputRef}
        parent={parent}
      >
        <span
          data-slot="checkbox"
          {...props}
          class={cn(
            'peer group/checkbox relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input shadow-xs transition-shadow outline-none group-has-disabled/field:opacity-50 group-has-[:focus-visible]/field-label:ring-0 group-has-[:focus-visible]/field-label:not-data-checked:border-input after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-disabled:cursor-not-allowed data-disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground group-has-[:focus-visible]/field-label:data-checked:border-primary dark:data-checked:bg-primary data-indeterminate:border-primary data-indeterminate:bg-primary data-indeterminate:text-primary-foreground dark:data-indeterminate:bg-primary',
            className,
          )}
          mix={[checkbox.root(), mix]}
        >
          <span
            data-slot="checkbox-indicator"
            class="grid place-content-center text-current transition-none [&>svg]:size-3.5"
            mix={checkbox.indicator()}
          >
            <CheckIcon />
            <MinusIcon />
          </span>
        </span>
      </checkbox.Context>
    )
  }
}

function CheckIcon() {
  return () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class="group-data-indeterminate/checkbox:hidden"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function MinusIcon() {
  return () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class="hidden group-data-indeterminate/checkbox:block"
    >
      <path d="M5 12h14" />
    </svg>
  )
}
