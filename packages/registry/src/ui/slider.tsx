import type { Handle, Props } from 'remix/component'
import * as slider from 'stems-ui/slider'

import { cn } from '#stems/lib/utils.ts'

/*
 * Styled after shadcn/ui's Base UI slider (base-vega). Behavior: stems-ui/slider.
 *
 * shadcn's `data-horizontal:` / `data-vertical:` variants are spelled `data-[orientation=...]:`
 * here so the component works without `shadcn/tailwind.css`.
 *
 * State hooks used for styling (set by stems-ui/slider on every part):
 *   data-orientation="horizontal|vertical", data-disabled, data-dragging
 *   thumb: data-index, :focus-visible (thumbs are focusable role="slider" elements)
 *
 * A range slider renders one thumb per value: pass an array as `value` or `defaultValue`.
 * `aria-label` / `aria-labelledby` name the thumbs (use `getAriaLabel` for per-thumb names).
 */

export { onSliderChange, onSliderCommit } from 'stems-ui/slider'
export type { SliderChangeEvent, SliderCommitEvent, SliderValue } from 'stems-ui/slider'

type SliderContextOptions = Omit<slider.SliderContextProps, 'children'>

export type SliderProps = Omit<Props<'div'>, keyof SliderContextOptions | 'children'> &
  SliderContextOptions &
  Pick<slider.SliderThumbOptions, 'getAriaLabel' | 'getAriaValueText'>

export function Slider(handle: Handle<SliderProps>) {
  return () => {
    let {
      class: className,
      mix,
      value,
      defaultValue,
      onValueChange,
      onValueCommitted,
      min,
      max,
      step,
      largeStep,
      minStepsBetweenValues,
      orientation,
      disabled,
      name,
      form,
      format,
      locale,
      thumbAlignment = 'edge',
      thumbCollisionBehavior,
      getAriaLabel,
      getAriaValueText,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      ...props
    } = handle.props

    let initial = value ?? defaultValue
    let count = Array.isArray(initial) ? initial.length : 1

    return (
      <slider.Context
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        onValueCommitted={onValueCommitted}
        min={min}
        max={max}
        step={step}
        largeStep={largeStep}
        minStepsBetweenValues={minStepsBetweenValues}
        orientation={orientation}
        disabled={disabled}
        name={name}
        form={form}
        format={format}
        locale={locale}
        thumbAlignment={thumbAlignment}
        thumbCollisionBehavior={thumbCollisionBehavior}
      >
        <div
          data-slot="slider"
          {...props}
          class={cn(
            'data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full',
            className,
          )}
          mix={[slider.root(), mix]}
        >
          <div
            data-slot="slider-control"
            class="relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-40 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col"
            mix={slider.control()}
          >
            <div
              data-slot="slider-track"
              class="relative grow overflow-hidden rounded-full bg-muted select-none data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
              mix={slider.track()}
            >
              <div
                data-slot="slider-range"
                class="bg-primary select-none data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
                mix={slider.indicator()}
              />
            </div>
            {Array.from({ length: count }, (_, index) => (
              <span
                key={index}
                data-slot="slider-thumb"
                aria-label={ariaLabel}
                aria-labelledby={ariaLabelledBy}
                class="block size-4 shrink-0 rounded-full border border-primary bg-white shadow-sm ring-ring/50 transition-[color,box-shadow] select-none hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden data-disabled:pointer-events-none data-disabled:opacity-50"
                mix={slider.thumb({ index, getAriaLabel, getAriaValueText })}
              />
            ))}
          </div>
        </div>
      </slider.Context>
    )
  }
}
