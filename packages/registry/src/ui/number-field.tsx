import type { Handle, Props, RemixNode } from 'remix/component'
import * as numberField from 'stems-ui/number-field'

import { cn } from '#stems/lib/utils.ts'

/*
 * A number input with decrement / increment buttons, styled like shadcn/ui's input group
 * (base-vega has no number field). Behavior: stems-ui/number-field.
 *
 * State hooks used for styling (set by stems-ui/number-field on every part):
 *   data-disabled, data-readonly, data-required, data-scrubbing
 *   buttons: :disabled at min / max
 *
 * `NumberField` renders `children` (a label, a scrub area) before the group. `id`,
 * `placeholder`, and the `aria-*` naming props go to the input.
 */

export { onNumberFieldChange, onNumberFieldCommit } from 'stems-ui/number-field'
export type { NumberFieldChangeEvent, NumberFieldCommitEvent } from 'stems-ui/number-field'

type NumberFieldContextOptions = Omit<numberField.NumberFieldContextProps, 'children'>

type InputNamingProps = Pick<
  Props<'input'>,
  'placeholder' | 'aria-label' | 'aria-labelledby' | 'aria-describedby' | 'aria-invalid'
>

export type NumberFieldProps = Omit<
  Props<'div'>,
  keyof NumberFieldContextOptions | keyof InputNamingProps
> &
  NumberFieldContextOptions &
  InputNamingProps

export function NumberField(handle: Handle<NumberFieldProps>) {
  return () => {
    let {
      class: className,
      mix,
      children,
      value,
      defaultValue,
      onValueChange,
      onValueCommitted,
      min,
      max,
      step,
      smallStep,
      largeStep,
      snapOnStep,
      allowOutOfRange,
      format,
      locale,
      allowWheelScrub,
      disabled,
      readOnly,
      required,
      name,
      form,
      id,
      inputRef,
      placeholder,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
      ...props
    } = handle.props

    return (
      <numberField.Context
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        onValueCommitted={onValueCommitted}
        min={min}
        max={max}
        step={step}
        smallStep={smallStep}
        largeStep={largeStep}
        snapOnStep={snapOnStep}
        allowOutOfRange={allowOutOfRange}
        format={format}
        locale={locale}
        allowWheelScrub={allowWheelScrub}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        name={name}
        form={form}
        id={id}
        inputRef={inputRef}
      >
        <div
          data-slot="number-field"
          {...props}
          class={cn('flex w-full flex-col gap-2', className)}
          mix={[numberField.root(), mix]}
        >
          {children}
          <NumberFieldGroup>
            <NumberFieldDecrement />
            <NumberFieldInput
              placeholder={placeholder}
              aria-label={ariaLabel}
              aria-labelledby={ariaLabelledBy}
              aria-describedby={ariaDescribedBy}
              aria-invalid={ariaInvalid}
            />
            <NumberFieldIncrement />
          </NumberFieldGroup>
        </div>
      </numberField.Context>
    )
  }
}

export function NumberFieldGroup(handle: Handle<Props<'div'>>) {
  return () => {
    let { class: className, mix, ...props } = handle.props
    return (
      <div
        data-slot="number-field-group"
        {...props}
        class={cn(
          'relative flex h-9 w-full min-w-0 items-center rounded-md border border-input shadow-xs transition-[color,box-shadow] outline-none has-[[data-slot=number-field-input]:focus-visible]:border-ring has-[[data-slot=number-field-input]:focus-visible]:ring-3 has-[[data-slot=number-field-input]:focus-visible]:ring-ring/50 has-[[aria-invalid=true]]:border-destructive has-[[aria-invalid=true]]:ring-3 has-[[aria-invalid=true]]:ring-destructive/20 data-disabled:opacity-50 dark:bg-input/30 dark:has-[[aria-invalid=true]]:ring-destructive/40',
          className,
        )}
        mix={[numberField.group(), mix]}
      />
    )
  }
}

export function NumberFieldInput(handle: Handle<Props<'input'>>) {
  return () => {
    let { class: className, mix, ...rest } = handle.props
    // Rest-destructuring flattens the `type`-discriminated input props union; restore it.
    let props = rest as Props<'input'>
    return (
      <input
        data-slot="number-field-input"
        {...props}
        class={cn(
          'h-full w-full min-w-0 flex-1 bg-transparent px-2 text-center text-base tabular-nums outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed md:text-sm',
          className,
        )}
        mix={[numberField.input(), mix]}
      />
    )
  }
}

const stepperClass =
  'flex size-9 shrink-0 items-center justify-center text-muted-foreground transition-colors outline-none select-none first:rounded-l-md last:rounded-r-md hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4'

export function NumberFieldDecrement(handle: Handle<Props<'button'>>) {
  return () => {
    let { class: className, mix, children, ...props } = handle.props
    return (
      <button
        data-slot="number-field-decrement"
        {...props}
        class={cn(stepperClass, className)}
        mix={[numberField.decrement(), mix]}
      >
        {children ?? <MinusIcon />}
      </button>
    )
  }
}

export function NumberFieldIncrement(handle: Handle<Props<'button'>>) {
  return () => {
    let { class: className, mix, children, ...props } = handle.props
    return (
      <button
        data-slot="number-field-increment"
        {...props}
        class={cn(stepperClass, className)}
        mix={[numberField.increment(), mix]}
      >
        {children ?? <PlusIcon />}
      </button>
    )
  }
}

export type NumberFieldScrubAreaProps = Props<'span'> &
  numberField.ScrubAreaOptions & {
    /** Custom cursor shown while scrubbing with the pointer locked. */
    cursor?: RemixNode
  }

/** A label-like area: drag it horizontally to change the value. */
export function NumberFieldScrubArea(handle: Handle<NumberFieldScrubAreaProps>) {
  return () => {
    let {
      class: className,
      mix,
      children,
      direction,
      pixelSensitivity,
      teleportDistance,
      cursor,
      ...props
    } = handle.props
    return (
      <span
        data-slot="number-field-scrub-area"
        {...props}
        class={cn(
          'w-fit cursor-ew-resize text-sm leading-none font-medium select-none data-disabled:cursor-not-allowed data-disabled:opacity-50',
          className,
        )}
        mix={[numberField.scrubArea({ direction, pixelSensitivity, teleportDistance }), mix]}
      >
        {children}
        <span
          data-slot="number-field-scrub-area-cursor"
          class="z-50 -translate-x-1/2 -translate-y-1/2 text-foreground drop-shadow-sm [&_svg]:size-5"
          mix={numberField.scrubAreaCursor()}
        >
          {cursor ?? <ScrubCursorIcon />}
        </span>
      </span>
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

function PlusIcon() {
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
      <path d="M12 5v14" />
    </svg>
  )
}

function ScrubCursorIcon() {
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
      <path d="m18 8 4 4-4 4" />
      <path d="M2 12h20" />
      <path d="m6 8-4 4 4 4" />
    </svg>
  )
}
