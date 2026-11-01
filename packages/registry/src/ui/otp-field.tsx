import type { Handle, Props } from 'remix/component'
import * as otpField from 'stems-ui/otp-field'

import { cn } from '#stems/lib/utils.ts'

/*
 * Styled after shadcn/ui's InputOTP (base-vega), renamed after Base UI's OTP Field.
 * Behavior: stems-ui/otp-field.
 *
 * Unlike shadcn's InputOTP (one hidden input with painted slots), every slot is a real
 * <input>, so the focused slot is styled with `focus:` and shows the native caret.
 *
 * State hooks used for styling (set by stems-ui/otp-field):
 *   root, slots: data-complete, data-filled (slot: has a character), data-focused,
 *                data-disabled, data-readonly, data-required
 *
 *   <OTPField length={6}>
 *     <OTPFieldGroup>
 *       <OTPFieldSlot index={0} /> <OTPFieldSlot index={1} /> <OTPFieldSlot index={2} />
 *     </OTPFieldGroup>
 *     <OTPFieldSeparator />
 *     <OTPFieldGroup> …index 3-5… </OTPFieldGroup>
 *   </OTPField>
 */

export { onOTPFieldChange, onOTPFieldComplete } from 'stems-ui/otp-field'
export type { OTPFieldChangeEvent, OTPFieldCompleteEvent } from 'stems-ui/otp-field'

type OTPFieldContextOptions = Omit<otpField.OTPFieldContextProps, 'children'>

export type OTPFieldProps = Omit<Props<'div'>, keyof OTPFieldContextOptions> &
  OTPFieldContextOptions

export function OTPField(handle: Handle<OTPFieldProps>) {
  return () => {
    let {
      class: className,
      mix,
      children,
      length,
      value,
      defaultValue,
      onValueChange,
      onValueComplete,
      onValueInvalid,
      validationType,
      normalizeValue,
      mask,
      inputMode,
      autoComplete,
      autoSubmit,
      disabled,
      readOnly,
      required,
      name,
      form,
      id,
      ...props
    } = handle.props

    return (
      <otpField.Context
        length={length}
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        onValueComplete={onValueComplete}
        onValueInvalid={onValueInvalid}
        validationType={validationType}
        normalizeValue={normalizeValue}
        mask={mask}
        inputMode={inputMode}
        autoComplete={autoComplete}
        autoSubmit={autoSubmit}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        name={name}
        form={form}
        id={id}
      >
        <div
          data-slot="otp-field"
          {...props}
          class={cn('flex items-center gap-2 has-disabled:opacity-50', className)}
          mix={[otpField.root(), mix]}
        >
          {children}
        </div>
      </otpField.Context>
    )
  }
}

export function OTPFieldGroup(handle: Handle<Props<'div'>>) {
  return () => {
    let { class: className, ...props } = handle.props
    return (
      <div
        data-slot="otp-field-group"
        {...props}
        class={cn(
          'flex items-center rounded-md has-aria-invalid:border-destructive has-aria-invalid:ring-3 has-aria-invalid:ring-destructive/20 dark:has-aria-invalid:ring-destructive/40',
          className,
        )}
      />
    )
  }
}

export type OTPFieldSlotProps = Omit<Props<'input'>, 'value' | 'defaultValue'> &
  otpField.OTPFieldInputOptions

export function OTPFieldSlot(handle: Handle<OTPFieldSlotProps>) {
  return () => {
    let { class: className, mix, index, ...rest } = handle.props
    let props = rest as Props<'input'>
    return (
      <input
        data-slot="otp-field-slot"
        {...props}
        class={cn(
          'relative flex size-9 items-center justify-center border-y border-r border-input bg-transparent p-0 text-center text-sm shadow-xs transition-all caret-foreground outline-none first:rounded-l-md first:border-l last:rounded-r-md focus:z-10 focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:cursor-not-allowed aria-invalid:border-destructive focus:aria-invalid:border-destructive focus:aria-invalid:ring-destructive/20 dark:bg-input/30 dark:focus:aria-invalid:ring-destructive/40',
          className,
        )}
        mix={[otpField.input({ index }), mix]}
      />
    )
  }
}

export function OTPFieldSeparator(handle: Handle<Props<'div'>>) {
  return () => {
    let { class: className, mix, children, ...props } = handle.props
    return (
      <div
        data-slot="otp-field-separator"
        {...props}
        class={cn("flex items-center [&_svg:not([class*='size-'])]:size-4", className)}
        mix={[otpField.separator(), mix]}
      >
        {children ?? <MinusIcon />}
      </div>
    )
  }
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
    >
      <path d="M5 12h14" />
    </svg>
  )
}
